# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — dev.12 real D4 pass + dev.13 isolated C++ core bridge

### Real dev.12 evidence received
The user returned four files from the real GTA V Enhanced installation:
- `runtime_game_thread.log`
- `asiloader(5).log`
- `RageOpenV(5).log`
- `ScriptHookV(5).log`

Observed facts:
- ASI loader maps `VOXModernOverhaul.asi` and completes plugin enumeration.
- RageOpenV reports successful initialization.
- ScriptHookV reports build `v3889.0/1158.13`, identifies `VER_EN_1_0_1158_13` and explicitly registers `VOXModernOverhaul.asi`.
- `runtime_game_thread.log` contains `VOX_SCRIPT_MAIN_ENTER`.
- The same log contains `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`, proving the ScriptHookV script yielded and resumed rather than only executing during load.
- Exactly five fresh `VOX_SCRIPT_HEARTBEAT` markers were returned.
- User reports the game launches and remains stable.

Conclusion: dev.12 is promoted to the first **D4 real active runtime**. The dev.11 real failure was not a scheduler failure; the export-resolution fallback in dev.12 fixed the registration boundary sufficiently for the user's current ScriptHookV build.

### Why dev.13 splits the runtime
Keeping the full long-lived project in the tiny no-CRT ASI would make normal C++ features unnecessarily difficult and would tempt future code back into the loader callback. The selected production architecture is therefore:

1. `VOXModernOverhaul.asi` stays deliberately tiny and CRT-free.
2. It owns only ASI load safety, ScriptHookV discovery/registration, scheduler entry and host callbacks.
3. `VoxScriptMain` yields through `scriptWait(0)` and only after that resume loads `VOXModernCore.dll`.
4. `VOXModernCore.dll` is a normal C++20 DLL using the tested `vox_core` library.
5. ASI↔Core communication uses a small versioned plain-C ABI so implementation details do not leak across the boundary.

This preserves the safety lesson from dev.8/dev.9 while giving the actual project a normal C++ environment for persistence, entity systems, events and future GTA adapters.

### Core API added
Added `CoreApi.h` with:
- `VOX_CORE_API_VERSION`
- `VoxHostApi`
- host log callback
- `VoxCoreStart`
- `VoxCoreTick`
- `VoxCoreStop`

`VoxCoreStart` validates struct size, API version and callback presence. It refuses a second start, then allocates one test ID through `EntityIdGenerator`. Expected proof markers:
- `VOX_CORE_START`
- `VOX_CORE_ENTITY_ID=1`

The ASI resolves all required core exports and only declares the bridge ready after successful `VoxCoreStart`:
- `VOX_CORE_BRIDGE_READY`

`VoxCoreTick` records the first five core ticks:
- `VOX_CORE_TICK=1` through `VOX_CORE_TICK=5`

No persistent registry/database or GTA native call is present yet; the ID allocation is strictly a bridge proof.

### Loader-context boundary
- `VOXModernCore.dll` is **not** loaded from `VoxDllEntry` / the ASI loader callback.
- The ASI remains CRT-free.
- `LoadLibraryW(VOXModernCore.dll)` occurs only from `VoxScriptMain` after the real ScriptHookV scheduling boundary has already been crossed and resumed.
- Core export failure, API rejection or missing DLL fails closed and writes explicit markers instead of continuing in an ambiguous state.

### Synthetic checkpoint changes
The Windows smoke host now requires:
- core DLL physically present;
- ScriptHook export-drift fallback still working;
- ASI registration;
- ScriptMain entry;
- wait/resume;
- `VOX_CORE_START`;
- `VOX_CORE_ENTITY_ID=1`;
- `VOX_CORE_BRIDGE_READY`;
- at least five core ticks;
- at least five ScriptHook heartbeats.

CI run `33881321657` passed:
- Windows core build/tests;
- Linux core build/tests;
- ASan + UBSan;
- ASI custom PE/CRT boundary;
- fallback ABI path;
- ScriptHook registration and scheduler proof;
- core DLL load/export/start/tick handshake;
- first EntityId marker;
- package creation and content verification.

### Packaging trace issue caught before delivery
The first `dev.13` artifact from run `33881321657` was structurally correct and contained:
- `VOXModernOverhaul.asi`
- `VOXModernCore.dll`
- config
- `BUILD_INFO.txt`
- `README_FIRST_TEST.txt`

Hashes in that artifact matched `BUILD_INFO.txt`, and CI package validation passed. However, manual inspection before user delivery found that `README_FIRST_TEST.txt` still described dev.12. This was a trace/documentation defect, not a binary defect.

Action:
- do **not** deliver that first dev.13 artifact as the final user checkpoint;
- update packaged instructions to Checkpoint 0G/dev.13;
- update PATCHNOTES, STATUS and TODO_PHASE0;
- rebuild from the documented branch head so package commit/hash and instructions describe the same state.

### Current gate
The next user checkpoint is dev.13 real D4 core bridge validation. Required runtime markers:
- `VOX_SCRIPT_MAIN_ENTER`
- `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`
- `VOX_CORE_START`
- `VOX_CORE_ENTITY_ID=1`
- `VOX_CORE_BRIDGE_READY`
- five core tick markers
- five ScriptHook heartbeat markers

No world mutation is attached until this passes.

### Work immediately after dev.13 D4
1. Persistent Entity Registry.
2. Queued/deferred game-thread EventBus adapter.
3. First atomic/versioned persistent-state file including ID high-water mark.
4. Read-only mission-active detector and Story Compatibility skeleton.
5. In parallel, start the Enhanced asset locator/override pipeline so the next major checkpoint can begin producing visible graphical changes rather than remaining runtime-only.

## 2026-09-04 — dev.11 ScriptHookV game-thread lifecycle checkpoint

### Trigger / user validation
- User reports the dev.10 no-CRT baseline now launches GTA V Enhanced normally/repeatably after the earlier remove/restore cycle.
- dev.10 is therefore promoted from provisional to the stable ASI **load baseline**.
- Earlier intermittent crash root cause remains unknown; WER capture tooling remains available instead of inventing a cause after the fact.

### Production lifecycle decision
- The dev.8 `CreateThread`-from-`DllMain` design remains permanently quarantined.
- dev.11 follows the ScriptHookV script lifecycle instead of creating a free-running bootstrap thread.
- The ASI retains a custom CRT-free entrypoint and `/NODEFAULTLIB`.
- ScriptHookV is not directly linked/imported and is not loaded from inside the loader callback.
- On `DLL_PROCESS_ATTACH`, the runtime calls `GetModuleHandleW(L"ScriptHookV.dll")`, then dynamically resolves the pinned x64 `scriptRegister` and `scriptWait` exports.
- If ScriptHookV or either export is absent, the checkpoint fails closed and returns success to the host without scheduling any runtime work.
- When both exports exist, the ASI stores `scriptWait` and calls `scriptRegister(module, VoxScriptMain)`.

### ScriptMain proof design
- `VoxScriptMain` is the only repeated runtime execution path.
- It writes `VOX_SCRIPT_MAIN_ENTER`.
- It calls `scriptWait(0)`.
- Only after that call returns does it write `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`.
- It then performs five `scriptWait(1000)` cycles and writes one `VOX_SCRIPT_HEARTBEAT` after each resume.
- After five heartbeats it remains resident but inert, calling only `scriptWait(1000)` forever.
- No GTA native, memory patch, gameplay hook, save mutation or world mutation exists in dev.11.

### Runtime binary boundary
- The dev.11 ASI imports only the required Kernel32 APIs for module/export lookup and bounded diagnostic file output.
- CI rejects CRT/C++ runtime imports, TLS and any direct `ScriptHookV.dll` import.
- CI verifies the custom non-zero PE entrypoint and the intended Kernel32 API list.
- `dumpbin.exe` is resolved through Visual Studio `vswhere` and the actual x64 MSVC toolchain rather than assuming PATH configuration.

### Synthetic scheduler harness
Added a test-only fake `ScriptHookV.dll` and `gta5_enhanced.exe` host.

The harness proves these stages separately:
1. fake DLL exposes the exact ScriptHookV x64 ABI export names expected by production runtime;
2. ASI loading actually invokes `scriptRegister`;
3. registered ScriptMain executes;
4. ScriptMain resumes after `scriptWait(0)`;
5. five heartbeat resumes occur.

The fake ScriptHookV is never included in the GTA user package; package verification fails if a `ScriptHookV.dll` is present.

### Blocker 1 — duplicate NOMINMAX under /WX
- First Windows build of the new test targets failed with MSVC C4005 because `NOMINMAX` was defined both by the common CMake platform policy and locally in two new C++ test files.
- Linux and sanitizer paths were unaffected.
- Fix: removed the local macro definitions; the shared CMake definition is the single authority.
- Regression protection: `/WX` remains enabled, so future macro redefinition debt cannot silently ship.

### Blocker 2 — unnecessary PE entrypoint export
- Linker diagnostics showed the custom PE entry function did not need to be exported.
- Fix: removed `__declspec(dllexport)` from `VoxDllEntry` while keeping `/ENTRY:VoxDllEntry`.
- This removes warning debt without changing the runtime entry mechanism.

### Blocker 3 — dumpbin PATH assumption
- Runtime PE verification initially failed despite a successful ASI build because the Windows 2025 / Visual Studio 2026 Actions environment did not expose `dumpbin.exe` on PATH.
- This was a CI tooling failure, not a binary failure.
- Fix: resolve Visual Studio using `vswhere.exe`, locate the installed Hostx64/x64 `dumpbin.exe`, then run import verification with its absolute path.
- The same step subsequently passed and proved the intended dependency boundary.

### Blocker 4 — fake ScriptHookV ABI mismatch
- First scheduler smoke test produced no runtime marker.
- The smoke host was upgraded to fail at explicit stages rather than a generic heartbeat timeout.
- The next run failed specifically at `ABI_EXPORT_SCRIPT_REGISTER`, proving the fake DLL did not expose the exact pinned production export name.
- Cause: relying on compiler-generated C++ mangling in the fake test DLL made the test ABI compiler-version-dependent.
- Production runtime ABI strings were not changed simply to satisfy the fake.
- Fix: fake implementation uses plain internal C functions plus explicit linker `/EXPORT:` aliases for the exact production ABI names.
- Result: exact ABI lookup, registration, ScriptMain execution, wait/resume and five-heartbeat smoke all pass.

### Latest synthetic validation
- Windows core build/tests: PASS.
- Linux core build/tests: PASS.
- ASan + UBSan: PASS.
- dev.11 ASI build: PASS.
- custom PE / intended Kernel32 boundary: PASS.
- no CRT/C++ runtime/TLS/direct ScriptHookV import: PASS.
- exact fake ScriptHookV ABI exports: PASS.
- `scriptRegister` invoked by ASI: PASS.
- ScriptMain execution: PASS.
- `scriptWait(0)` resume: PASS.
- five heartbeat resumes: PASS.
- GTA-ready package creation and required-content verification: PASS.
- fake ScriptHookV redistribution guard: PASS.

### Current evidence boundary
- At dev.11 this lifecycle was D3 synthetic only; the later real dev.11 test failed at registration and dev.12 subsequently fixed it.

## 2026-09-04 — dev.10 intermittent behavior: successful load after remove/restore

### New user evidence
- After prior dev.10 crashes, the user reports manually removing the VOX plugin, putting it back, and then successfully reaching a loaded GTA V Enhanced state.
- `asiloader(3).log` shows the same plugin order as previous attempts: RageOpenV, ScriptHookVDotNet, TrainerV, then `VOXModernOverhaul.asi`, followed by `LOADER: Finished loading *.asi plugins`.
- `ScriptHookV(3).log` reports `INIT: Success, game version is VER_EN_1_0_1158_13` and registers ScriptHookVDotNet/TrainerV normally.
- `RageOpenV(3).log` reports successful initialization.
- dev.10 itself remains intentionally silent because it has no imports, CRT, logging, GTA calls or ScriptHookV calls.

### Interpretation
- This proves the exact dev.10 loading concept is not deterministically incompatible with the current GTA V Enhanced + plugin environment.
- At the time of this entry it was kept provisional; the later user report of normal repeatable launches promoted it to the stable load baseline used for dev.11.
- The exact earlier crash cause remains unresolved.

## 2026-09-04 — dev.9 real crash, binary inspection, dev.10 no-CRT isolation

### User evidence received for dev.9
- User reported GTA V Enhanced still crashed with `0.0.1-dev.9`.
- ASI loader showed RageOpenV, ScriptHookVDotNet, TrainerV and VOX all loaded; adjacent framework logs showed successful initialization.
- No VOX log was expected because explicit project logging had been removed.

### Important dev.9 binary finding
- Despite inert project code, the MSVC-generated DLL still used normal CRT startup.
- Imports included `VCRUNTIME140.dll` and `api-ms-win-crt-runtime-l1-1-0.dll` initialization/termination routines.
- Therefore dev.9 did not prove zero associated startup execution.

### dev.10 design and proof
- Added `NoCrtEntry.c` with `/NODEFAULTLIB`, `/ENTRY:VoxDllEntry`, `/GS-`, `/Zl`.
- No project core, STL, CRT, Win32 API, ScriptHookV or GTA code linked into dev.10.
- PE gates required custom entrypoint, zero import directory and zero TLS.
- Run `33873756374`: Windows/Linux/sanitizers/no-CRT load smoke/package PASS.
- Independent downloaded-package inspection confirmed zero Import/IAT/TLS/LoadConfig/DelayImport/CLR and a tiny `.text` path.

## 2026-09-04 — Real GTA dev.8 crash + dev.9 inert isolation

- dev.8 real log proved Enhanced `1.0.1158.13`, config/dependency detection and exact `CHECKPOINT_OK`, then the game crashed.
- The free thread created from `DllMain` was quarantined rather than extended.
- dev.9 removed project core/logger/filesystem/config/probing/ScriptHook/natives/hooks/memory/save/world work and reduced project logic to immediate success.
- Synthetic inert load passed, but real game still crashed; later CRT inspection motivated dev.10.

## 2026-09-04 — Checkpoint 0: GTA-ready diagnostic ASI + reproducible package

- Added project-local `AGENT.md` as authoritative development contract.
- Added Windows x64 diagnostic ASI and synthetic host.
- Added reproducible `PackageCheckpoint.ps1` with commit and ASI hash in `BUILD_INFO.txt`.
- Windows CI exposed `windows.h` `max` macro pollution; fixed globally with `NOMINMAX`.
- Run `33865763371`: Windows/Linux/sanitizers/ASI smoke/package PASS before real-game test.

## 2026-09-04 — GTA V Enhanced install/build probe foundation

- Added explicit-root Enhanced installation probe requiring `gta5_enhanced.exe`.
- Validates root, executable, MZ/PE signature and AMD64 machine.
- Added Windows file-version reader with `VS_FIXEDFILEINFO` validation.

## 2026-09-04 — Phase 0 execution checklist + config CI promotion

- Added `TODO_PHASE0.md` granular execution tracking.
- Exact config commit `58cec3c98e44da4b7d284cf1ff0743833140b0ed`, CI run `33864582553`: SUCCESS.

## 2026-09-04 — Versioned configuration parser

- Added strict `key=value` parser with mandatory non-zero numeric `schema_version`.
- Duplicate/invalid keys fail closed.
- Typed exact boolean and unsigned readers added.
- Removed incorrect `noexcept` lookup declarations that could have converted allocation failure into `std::terminate`.
- Warnings-as-errors + ASan + UBSan + CTest: PASS.

## 2026-09-04 — CI hardening / concurrent EventBus validation

- Added warnings-as-errors validation mode (`-Werror` / `/WX`).
- EventBus concurrent validation: 4 publisher threads × 1000 events, expected/observed 4000.
- Added `docs/STATUS.md` evidence levels.

## 2026-09-04 — Precommit defect catch / ID generator hardening

- Fixed EventBus use-after-invalidation risk in `Unsubscribe`.
- Corrected a test-edit failure that had omitted generator assertions before commit.
- Added fail-closed EventBus subscription token exhaustion.
- Added resumable `EntityIdGenerator`, reserves zero and fails closed after maximum 64-bit ID.

## 2026-09-04 — Core compile/test checkpoint

- Added typed native EventBus and GitHub Actions Windows/Linux workflow.
- Core configure/compile/link/test passed; no GTA runtime behavior claimed.

## 2026-09-04 — Project initialization / Phase 0 start

- Created charter, architecture, TODO, roadmap, story compatibility contract and data model.
- Visual quality first; persistence/procedural systems mandatory; vanilla story compatibility non-negotiable.
- Critical runtime direction: native C++ with GTA calls isolated behind adapters.
- CodeWalker Enhanced/Gen9, Sollumz Enhanced conversion and OpenRPF non-destructive override paths recorded.
- Stable project IDs, validation gates, patch notes and development log are mandatory.
