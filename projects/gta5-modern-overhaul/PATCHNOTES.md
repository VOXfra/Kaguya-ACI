# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.13] — 2026-09-04

### dev.12 promoted to real D4 active runtime
- Real GTA V Enhanced evidence now confirms `VOXModernOverhaul.asi` is registered by ScriptHookV on Enhanced `1.0.1158.13`.
- `runtime_game_thread.log` contains `VOX_SCRIPT_MAIN_ENTER`, `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` and five fresh `VOX_SCRIPT_HEARTBEAT` markers.
- GTA remains stable in the validated launch.
- The ScriptHookV lifecycle gate is therefore promoted from synthetic D3 to **real D4 active runtime**.

### Isolated C++ core bridge
- Added `VOXModernCore.dll` as the normal C++20 project runtime behind a small plain-C versioned ABI.
- The validated CRT-free ASI remains the minimal ScriptHookV host.
- `VOXModernCore.dll` is loaded only after `ScriptMain` has entered and resumed through `scriptWait(0)`; it is never loaded from the ASI loader callback.
- Added `VoxCoreStart`, `VoxCoreTick` and `VoxCoreStop` exports plus a versioned `VoxHostApi` callback contract.
- The core allocates the first test EntityId through the existing `EntityIdGenerator` and logs `VOX_CORE_ENTITY_ID=1`.
- The host/core handshake logs `VOX_CORE_START`, `VOX_CORE_BRIDGE_READY` and five `VOX_CORE_TICK=n` markers.
- No GTA natives, hooks, memory patches, save writes or world mutations are active yet.

### Validation and packaging
- Windows core build/tests: PASS.
- Linux core build/tests: PASS.
- ASan + UBSan: PASS.
- CRT-free ASI PE boundary: PASS.
- ScriptHookV export-drift fallback: PASS.
- ScriptHook registration + wait/resume smoke: PASS.
- C++ core DLL load/export/start/tick handshake: PASS.
- First EntityId allocation marker: PASS.
- Package contains both `VOXModernOverhaul.asi` and `VOXModernCore.dll`: PASS.
- Package excludes fake test `ScriptHookV.dll`: PASS.
- CI run `33881321657`: fully green.

### Traceability fix before delivery
- The first dev.13 artifact inherited the old dev.12 `README_FIRST_TEST.txt` because packaging instructions had not yet been advanced with the new core-bridge checkpoint.
- That artifact is not delivered as final.
- Packaged test instructions were updated to dev.13 and a new documented build is required before user delivery.

### Next gate
- Real GTA validation of the isolated C++ core bridge.
- After that: Persistent Entity Registry, queued game-thread EventBus adapter and first atomic versioned persistent state.
- Enhanced asset locator/override tooling begins in parallel toward the first visible graphics checkpoint.

## [0.0.1-dev.12] — 2026-09-04

### Real dev.11 result
- User reports GTA V Enhanced remains stable with dev.11 installed, but `VOXModernOverhaul/runtime_game_thread.log` is not created.
- New ASI-loader evidence confirms `VOXModernOverhaul.asi` is mapped and plugin enumeration completes.
- New ScriptHookV log confirms Enhanced `1.0.1158.13` initialization but lists only ScriptHookVDotNet and TrainerV registrations; VOXModernOverhaul is absent.
- Therefore dev.11 passes ASI loading but **fails the real ScriptHookV registration gate before ScriptMain executes**.
- RageOpenV initializes normally in the same launch.

### Root-cause boundary
- dev.11 used exact historical/current MSVC-decorated export strings for `scriptRegister` and `scriptWait` and silently disabled itself if either `GetProcAddress` failed.
- The real evidence is consistent with that resolution path failing before `scriptRegister` is called. The exact export-table spelling in the user's ScriptHookV binary was not captured at that stage, so decoration mismatch was treated as the leading compatibility issue rather than claimed as proven fact.

### dev.12 compatibility fix
- Keeps the dev.11 no-CRT custom-entrypoint architecture and the same restricted Kernel32 import boundary.
- Still never loads ScriptHookV from the loader callback and never directly imports it.
- Export resolution uses three stages: historical exact name, undecorated alias, then PE export-name scan for the unique semantic `?scriptRegister@@` / `?scriptWait@@` function identifiers.
- Ambiguous matches fail closed.
- No GTA native calls, gameplay hooks, memory patches, save writes or world mutations are added.

### Regression test hardened
- The fake ScriptHookV intentionally no longer exposes the historical exact names.
- It exports deliberately drifted names containing the same semantic identifiers, forcing the production runtime to exercise the new PE export-scan fallback.
- The smoke host verifies that the historical exact names are absent before loading the ASI, then still requires registration, ScriptMain entry, wait/resume and five heartbeats.

### Real-game outcome
- PASS: ScriptHookV registers `VOXModernOverhaul.asi`.
- PASS: `VOX_SCRIPT_MAIN_ENTER` observed.
- PASS: `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` observed.
- PASS: five `VOX_SCRIPT_HEARTBEAT` markers observed.
- PASS: GTA remains stable in the reported test.
- dev.12 is the first **real D4 active runtime** foundation.

## [0.0.1-dev.11] — 2026-09-04

### Stable load baseline promoted
- User reports GTA V Enhanced now launches normally/repeatably with the dev.10 no-CRT baseline after the earlier remove/restore cycle.
- dev.10 is therefore promoted from provisional to the stable **ASI load baseline**.
- The earlier intermittent crash cause remains unproven; WER crash-capture tooling stays available if it returns.
- The dev.8 free-thread-from-`DllMain` architecture remains permanently quarantined despite the stable load baseline.

### Proper ScriptHookV lifecycle checkpoint
- Replaced the zero-work dev.10 runtime body with a still non-invasive ScriptHookV lifecycle proof.
- ASI keeps a custom CRT-free PE entrypoint and `/NODEFAULTLIB`.
- Runtime imports only the required Kernel32 boundary; no CRT/C++ runtime, TLS or direct `ScriptHookV.dll` import is accepted.
- DLL attach uses `GetModuleHandleW` only; it never calls `LoadLibrary` from the loader callback.
- Current x64 ScriptHookV `scriptRegister` and `scriptWait` exports are resolved dynamically from the already-loaded module.
- The ASI registers one `ScriptMain` callback and performs all repeated work from that ScriptHookV-owned execution context.
- No GTA native calls, gameplay hooks, memory patches, save writes or world mutations are present.

### Real-game proof markers
`ScriptMain` writes `VOXModernOverhaul/runtime_game_thread.log` with:
- `VOX_SCRIPT_MAIN_ENTER`
- `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`
- five `VOX_SCRIPT_HEARTBEAT` lines

The resume marker is only emitted after `scriptWait(0)` returns, so a real-game pass proves actual scheduler yield/resume rather than one-shot DLL initialization.

### Synthetic ScriptHookV scheduler harness
- Added a test-only `ScriptHookV.dll` and `gta5_enhanced.exe` host.
- Fake ScriptHookV exposes the exact x64 ABI names expected by the runtime through explicit linker aliases rather than compiler-version-dependent name mangling.
- Test stages are independent and fail with explicit labels for:
  1. ABI export presence;
  2. `scriptRegister` callback registration;
  3. ScriptMain execution;
  4. `scriptWait(0)` resume;
  5. heartbeat count.
- Latest implementation path passes all stages and the user package explicitly rejects accidental inclusion of the fake `ScriptHookV.dll`.

### Defects caught before delivery
- MSVC `/WX` rejected duplicate `NOMINMAX` definitions in new test targets. Local duplicates were removed; the shared CMake platform definition remains authoritative.
- The custom PE entrypoint was unnecessarily exported, generating linker warning debt. Export annotation removed; `/ENTRY:VoxDllEntry` remains the only required entrypoint declaration.
- PE verification incorrectly assumed `dumpbin.exe` was on PATH on the Windows 2025 / Visual Studio 2026 runner. CI now resolves the installed x64 MSVC `dumpbin.exe` through `vswhere`.
- Initial fake ScriptHookV C++ mangling did not match the pinned real SDK ABI. The fake now uses explicit linker export aliases and the smoke host verifies the exact names before the ASI is loaded.
- The previous generic heartbeat timeout was replaced with stage-specific diagnostics, preventing repeated blind retries.

### Automated validation
- Windows core build/tests: PASS.
- Linux core build/tests: PASS.
- ASan + UBSan: PASS.
- custom-entry runtime build: PASS.
- PE dependency-boundary validation: PASS.
- exact ScriptHookV ABI export check: PASS.
- callback registration proof: PASS.
- ScriptMain execution proof: PASS.
- wait/resume proof: PASS.
- five-heartbeat proof: PASS.
- package creation/content verification: PASS.
- fake ScriptHookV redistribution guard: PASS.

### Real-game outcome
- ASI loads successfully and GTA remains stable.
- Real ScriptHookV registration is not observed and no runtime game-thread log is created.
- dev.11 is therefore not promoted to D4 live runtime.

## [0.0.1-debug.2] — 2026-09-04

### dev.10 successful real-game load observed after remove/restore cycle
- After previous real-game crashes with dev.10, the user manually removed the VOX ASI, restored/re-added it, and reports that GTA V Enhanced then appeared to load successfully.
- New `asiloader(3).log` confirms `VOXModernOverhaul.asi` was mapped successfully after RageOpenV, ScriptHookVDotNet and TrainerV and the loader completed plugin enumeration.
- New `ScriptHookV(3).log` reports successful initialization for `VER_EN_1_0_1158_13` and registration of ScriptHookVDotNet/TrainerV.
- New `RageOpenV(3).log` reports successful initialization.
- No VOX runtime log is expected because dev.10 remains the zero-import/no-CRT isolation image.

### Classification
- dev.10 was moved from "always crashes" to D4 provisional at this point.
- A later repeated-success user report promotes it to the stable load baseline in dev.11.
- Root cause of the earlier crashes remains unresolved.

## [0.0.1-debug.1] — 2026-09-04

### dev.10 initial real-game result
- User initially reported GTA V Enhanced still crashed with `0.0.1-dev.10` despite the no-CRT/zero-import image.
- Loader/ScriptHookV/RageOpenV logs all showed successful framework initialization but no faulting module.
- No further application runtime code was added at that point; a reversible WER LocalDumps crash-capture pack and controlled VOX-disable baseline tool were built instead.

### Crash-capture tooling
- Per-app WER capture scoped to `GTA5_Enhanced.exe`, default minidump type.
- Backup/restore of pre-existing WER state.
- Evidence collector for Application/WER events, dumps, game/plugin hashes and relevant logs.
- Two wildcard/`-LiteralPath` PowerShell defects were caught by CI and fixed before delivery.
- Final crash-capture run `33875088958`: parser, fake-GTA collector, package and artifact checks PASS.

## [0.0.1-dev.10] — 2026-09-04

### No-CRT / zero-import isolation checkpoint
- Inspection of dev.9 proved MSVC CRT/VCRUNTIME startup was still present despite an inert project `DllMain`.
- Added `NoCrtEntry.c` and linked with `/NODEFAULTLIB`, `/ENTRY:VoxDllEntry`, `/GS-`, `/Zl`.
- CI validates PE32+ custom entrypoint, zero Import Directory and zero TLS for this isolation image.
- Exact package commit `a193e307a443e491f13e6576f8ea18896f91945c`, run `33873756374`: Windows, Linux, sanitizers, no-CRT load smoke and packaging PASS.
- ASI SHA-256: `c77d3c2b43081fadf05165155a032f154189f8a3fec8406a81266ee3101fc63b`.
- GTA-ready ZIP SHA-256: `6ba7a17a3c7958cff0224b29895a8408bbf480e3b47dc7e59c7f99a33fcb1d6a`.

## [0.0.1-dev.9] — 2026-09-04

### Crash isolation checkpoint
- Removed explicit project bootstrap/thread/filesystem/config/core logic and reduced project `DllMain` to success.
- Synthetic inert load/residency/unload passed, but the real game still crashed.
- Later PE inspection identified remaining MSVC CRT/VCRUNTIME startup imports, motivating dev.10 rather than another application-level retry.
- Run `33872399873`: Windows/Linux/sanitizers/inert smoke/package PASS.

## [0.0.1-dev.8] — 2026-09-04

### First GTA-ready checkpoint
- Added the first diagnostic `VOXModernOverhaul.asi`, project-local `AGENT.md`, strict development/traceability rules, synthetic runtime smoke and reproducible packaging.
- Bootstrap performed no GTA natives, gameplay hooks, memory patches, save writes or world mutations.
- Windows CI exposed legacy `windows.h` `max` macro pollution; fixed globally with `NOMINMAX`.
- Run `33865763371`: Windows/Linux/sanitizers/ASI smoke/package PASS.
- Real GTA reached `CHECKPOINT_OK` on Enhanced `1.0.1158.13`, then crashed; the free-thread startup path was quarantined.

## [0.0.1-dev.7] — 2026-09-04
- Added explicit-root Enhanced install/PE/architecture probing and Windows file-version reader.

## [0.0.1-dev.6] — 2026-09-04
- Added granular Phase 0 execution checklist and promoted config parser to D3 cross-platform after CI run `33864582553` succeeded.

## [0.0.1-dev.5] — 2026-09-04
- Added strict versioned configuration parsing with mandatory schema, typed reads and fail-closed malformed input handling.

## [0.0.1-dev.4] — 2026-09-04
- Added warnings-as-errors mode, concurrent EventBus validation, sanitizer CI and engineering status tracking.

## [0.0.1-dev.3] — 2026-09-04
- Added resumable `EntityIdGenerator` and fixed pre-runtime EventBus/test defects including use-after-invalidation and token wraparound risks.

## [0.0.1-dev.2] — 2026-09-04
- Added typed native EventBus and Windows/Linux core CI.

## [0.0.1-dev.1] — 2026-09-04
- Established project charter, architecture, TODO, roadmap, story-compatibility contract, data model, C++20 core, logger and initial tests.
