# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — dev.9 real crash, binary inspection, dev.10 no-CRT isolation

### User evidence received for dev.9
- User reports GTA V Enhanced still crashes with `0.0.1-dev.9`.
- `asiloader(1).log` shows the Enhanced ASI loader loaded `RageOpenV.asi`, `ScriptHookVDotNet.asi`, `TrainerV.asi`, then `VOXModernOverhaul.asi`, and finished plugin loading.
- `ScriptHookV(1).log` reports successful initialization for `VER_EN_1_0_1158_13` and registration of ScriptHookVDotNet/TrainerV.
- `RageOpenV(1).log` reports successful RageOpenV initialization.
- No VOX log is expected from dev.9 because explicit project logging was removed.
- Available logs still do not include an exception code, crashing module or stack trace.

### Blocker protocol: move below application logic
- dev.9 had already removed `CreateThread`, project logging, filesystem/config access, Enhanced probing, version reads, project-core linkage, ScriptHookV calls, GTA natives, hooks and world/save writes from the ASI's project code.
- Because the real game still crashed, no additional application/runtime feature work was added.
- The exact packaged dev.9 `VOXModernOverhaul.asi` was extracted and its PE headers/import table inspected independently.

### Important dev.9 binary finding
- Despite an intentionally empty project `DllMain`, the MSVC-generated DLL still had a normal CRT startup entrypoint.
- dev.9 imported `VCRUNTIME140.dll` (`__std_type_info_destroy_list`, `__C_specific_handler`, `memcpy`).
- dev.9 imported `api-ms-win-crt-runtime-l1-1-0.dll`, including `_cexit`, `_execute_onexit_table`, `_initialize_onexit_table`, `_initialize_narrow_environment`, `_configure_narrow_argv`, `_seh_filter_dll`, `_initterm_e` and `_initterm`.
- It also imported several KERNEL32 timing/process functions through the runtime startup path.
- Therefore dev.9 did **not** prove that zero non-game code executed during DLL load. It only proved that our explicit application body did no work.
- Root cause is still not declared; CRT startup became the next isolated layer.

### dev.10 design
- Added `src/runtime/windows/NoCrtEntry.c`.
- Entry function accepts the three DLL-loader arguments, intentionally ignores them and returns success.
- ASI target links with `/NODEFAULTLIB` and custom `/ENTRY:VoxDllEntry`.
- ASI compile disables `/GS` security-cookie dependency and omits default-library directives (`/Zl`).
- No project core, STL, CRT, Win32 API, ScriptHookV or GTA code is linked into the dev.10 ASI.

### New binary correctness gate
- GitHub Actions now parses the generated ASI bytes before packaging.
- Requires valid PE32+ format and non-zero custom entrypoint.
- Requires Import Directory RVA = 0 and size = 0.
- Requires TLS Directory RVA = 0 and size = 0.
- Synthetic host still performs Windows `LoadLibraryW` -> residency -> `FreeLibrary` on the exact generated ASI.

### dev.10 automated evidence
- Exact package commit: `a193e307a443e491f13e6576f8ea18896f91945c`.
- GitHub Actions run: `33873756374`.
- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- ASan + UBSan: PASS.
- no-CRT x64 ASI build: PASS.
- PE zero-import/zero-TLS check: PASS.
- synthetic load/residency/unload: PASS.
- package creation/extraction verification: PASS.
- artifact upload: PASS.

### Independent downloaded-package verification
- Inner GTA-ready ZIP SHA-256: `6ba7a17a3c7958cff0224b29895a8408bbf480e3b47dc7e59c7f99a33fcb1d6a`.
- ASI SHA-256: `c77d3c2b43081fadf05165155a032f154189f8a3fec8406a81266ee3101fc63b`.
- `BUILD_INFO.txt` contains the same ASI hash and commit `a193e307a443e491f13e6576f8ea18896f91945c`.
- Independent `objdump -x` inspection shows Import Directory = 0, IAT = 0, TLS = 0, Load Configuration = 0, Delay Import = 0, CLR = 0.
- `.text` is only 6 bytes in the downloaded ASI; no imported DLL/function table exists.

### Decision boundary
- Real GTA test of dev.10 is required next.
- If stable, MSVC CRT/default DLL startup becomes the primary dev.9 compatibility suspect; the production runtime will still use ScriptHookV/game-thread registration rather than returning to the dev.8 free-thread lifecycle.
- If dev.10 still crashes, application code and CRT startup are both eliminated. Further application edits are forbidden until ASI-loader/file-image/plugin-coexistence behavior is isolated and an external crash-module/exception capture path is added.

## 2026-09-04 — Real GTA dev.8 crash + dev.9 inert isolation

### User evidence received
- `bootstrap.log` shows the dev.8 ASI executed inside the user's real GTA V Enhanced process at `2026-09-04 14:02:29`.
- Process path resolved as `E:\\Jeux Epic\\GTAVEnhanced\\GTA5_Enhanced.exe`.
- Enhanced probe returned `valid`.
- Windows file version returned `1.0.1158.13`.
- ASI loader and ScriptHookV were detected as present.
- Packaged config parsed with `diagnostic_bootstrap_enabled=true`.
- Exact final marker was written: `CHECKPOINT_OK: ASI loaded in GTA V Enhanced; no gameplay hooks or memory patches are active.`
- `asiloader.log` independently confirms load order including `RageOpenV.asi`, `ScriptHookVDotNet.asi`, `TrainerV.asi`, then `VOXModernOverhaul.asi`.
- `ScriptHookV.log` reports successful initialization for `VER_EN_1_0_1158_13`.
- `RageOpenV.log` reports successful initialization.
- User reports the game then crashed.

### Classification
- dev.8 proved real-game ASI loading and successful bootstrap execution, but **failed D4 stability**.
- The available logs contain no exception code, crash module or stack trace.
- The asynchronous bootstrap created a Win32 thread from `DllMain` and immediately performed C++/filesystem/logging work outside the normal ScriptHookV game-thread lifecycle; this path was quarantined rather than extended.

### Blocker protocol applied
- Stopped building additional systems on top of dev.8.
- Reduced explicit project runtime work to dev.9 `DllMain` immediate success.
- Removed project-core linkage, logger, filesystem access, config access, Enhanced probing, version reading, ScriptHookV calls, native calls, hooks, memory writes and save/world changes from dev.9 project logic.

### dev.9 automated isolation harness
- Added `InertSmokeHost.cpp`.
- Synthetic host loads the exact generated ASI, holds it resident for two seconds, verifies module residency and unloads it with `FreeLibrary`.
- Exact implementation commit: `818376c8c3a3a8afaa2499ee44225ab68850b266`.
- GitHub Actions run: `33872399873`.
- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- ASan + UBSan: PASS.
- Windows x64 inert ASI build: PASS.
- inert ASI load/residency/unload smoke: PASS.
- package creation/extraction verification/artifact upload: PASS.

### dev.9 package identity
- ASI SHA-256: `c8d3db56304565da90c6d69dc83c48c09cc771a8fc174f99902e473414a2cde7`.
- Inner GTA-ready ZIP SHA-256: `e50a393791f94d8cd60ba5a6ea84f15449569ba0ff39f5aa5c6c207191d73b44`.
- GitHub Actions outer artifact digest: `sha256:23e3152fbdf50f5e2f5ebe29bfa29398441938bd2a919b4e735289f1d2062ec1`.

## 2026-09-04 — Checkpoint 0: GTA-ready diagnostic ASI + reproducible package

### Development contract
- Added project-local `AGENT.md` as the authoritative working contract.
- Recorded continuous-checkpoint, blocker/root-cause, ask-before-guessing, mandatory traceability and GTA-ready packaging rules.

### Diagnostic ASI implemented
- Added Windows x64 `VOXModernOverhaul.asi` target.
- Bootstrap performed no GTA native calls, gameplay hooks, memory patches, save writes or world changes.
- Validated Enhanced process/install/build, config and dependencies and wrote exact `CHECKPOINT_OK` marker.

### Synthetic Windows runtime smoke harness
- Added a synthetic x64 `gta5_enhanced.exe` host that `LoadLibraryW`s the generated ASI and requires the expected checkpoint marker.

### Packaging
- Added reproducible `PackageCheckpoint.ps1`.
- Package records commit + ASI SHA-256 and is extracted/revalidated in CI before artifact upload.

### Build blocker / correction
- Windows CI exposed legacy `windows.h` `max` macro pollution at `std::numeric_limits<...>::max()`.
- Root cause was fixed globally with `NOMINMAX` for every MSVC target rather than patching individual call sites.

### Exact validation evidence
- Source checkpoint commit: `389e5cb5a12de7bd33eecca999479ec86e2822da`.
- GitHub Actions run: `33865763371`.
- Windows, Linux, ASan+UBSan, ASI smoke, packaging and artifact upload: PASS.
- Later real-game test reached `CHECKPOINT_OK` but crashed, so D4 stability failed.

## 2026-09-04 — GTA V Enhanced install/build probe foundation

- Added explicit-root Enhanced installation probe requiring `gta5_enhanced.exe`.
- Validates root, executable, MZ/PE signature and AMD64 machine.
- Added Windows file-version reader with `VS_FIXEDFILEINFO` validation.
- Portable probe positive/negative fixtures and Windows version tests pass.

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
