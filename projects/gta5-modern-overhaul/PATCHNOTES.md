# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.9] — 2026-09-04

### Crash isolation checkpoint
- Real GTA V Enhanced test of `dev.8` proved that the ASI loader loaded `VOXModernOverhaul.asi` and the bootstrap reached `CHECKPOINT_OK` on Enhanced `1.0.1158.13`, but the game then crashed.
- The real-game runtime is therefore **not** promoted to D4; `dev.8` is classified as a failed D4 stability attempt.
- Added a deliberately inert isolation ASI whose `DllMain` immediately returns `TRUE` and performs no other work.
- Removed `CreateThread`, logging, filesystem/config access, Enhanced probing, Windows version reads and all project-core dependencies from the test ASI target.
- This isolates simple ASI load/residency from the previous asynchronous bootstrap logic.

### Regression/isolation harness
- Replaced the synthetic bootstrap smoke host with an inert load/residency/unload harness.
- The harness loads the generated ASI, keeps it resident for two seconds and unloads it cleanly.
- Packaging remains reproducible and root-mergeable.

### Test interpretation
- If `dev.9` remains stable in real GTA V Enhanced, the previous `CreateThread`/bootstrap path is rejected and the next runtime will use a proper ScriptHookV/game-thread lifecycle.
- If `dev.9` still crashes, the investigation moves below bootstrap logic to ASI binary/load interaction or loader/toolchain compatibility rather than retrying the same architecture.

### Pending
- Windows/Linux/sanitizer CI and Windows inert-ASI smoke/package validation for this exact commit.
- Real GTA V Enhanced stability result for `dev.9`.

## [0.0.1-dev.8] — 2026-09-04

### First GTA-ready checkpoint
- Added the first Windows x64 `.asi` diagnostic bootstrap: `VOXModernOverhaul.asi`.
- The bootstrap is deliberately non-invasive: it performs no GTA native calls, gameplay hooks, memory patches, save writes or world mutations.
- It validates that the host process is actually `gta5_enhanced.exe`, validates the Enhanced executable as AMD64 PE, reads its Windows file version and writes a startup diagnostic report.
- Added fail-closed configuration loading from `VOXModernOverhaul/config/core.cfg`.
- Missing, malformed or disabled configuration stops the checkpoint cleanly instead of continuing in an ambiguous state.
- Added detection/reporting for `dinput8.dll` and `ScriptHookV.dll` without bundling either third-party binary.

### Development contract
- Added project-local `AGENT.md` containing the permanent project rules: continuous progress until meaningful checkpoints, blocker isolation/root-cause protocol, ask-before-guessing on subjective design choices, mandatory story compatibility, procedural-first architecture, external-asset licensing rules, validation gates, traceability and GTA-ready ZIP packaging rules.

### Automated Windows runtime validation
- Added a purpose-built x64 smoke host compiled as `gta5_enhanced.exe`.
- CI now loads the real generated `.asi` with `LoadLibraryW`, exercises `DllMain` + bootstrap thread + path/config/version logic and requires the exact `CHECKPOINT_OK` marker before packaging.
- This is a D3 Windows runtime-smoke result, not a D4 real-GTA claim.

### Packaging
- Added reproducible `PackageCheckpoint.ps1` packaging.
- Checkpoint ZIP layout is directly mergeable into the GTA V Enhanced root.
- Package contains the ASI, versioned config, first-test/rollback instructions and `BUILD_INFO.txt` with commit plus ASI SHA-256.
- CI extracts the generated ZIP and verifies every required file before uploading the artifact.

### Blocker found and permanently corrected
- Windows CI exposed legacy `windows.h` `max` macro pollution, which broke `std::numeric_limits<T>::max()` in the existing EntityId regression test.
- Root cause was isolated from the MSVC build log; Linux and sanitizer jobs were already green and the ASI itself had compiled.
- Fixed globally by defining `NOMINMAX` for every MSVC target in the project rather than patching individual call sites.
- This is now a permanent build-level regression guard for all future Win32 code.

### Verified
- Exact checkpoint commit tested by GitHub Actions run `33865763371`.
- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- Linux ASan + UBSan: PASS.
- Windows x64 ASI build: PASS.
- Windows synthetic `gta5_enhanced.exe` ASI load/smoke checkpoint: PASS.
- GTA-ready ZIP construction: PASS.
- ZIP required-file verification: PASS.
- Artifact upload: PASS.

### Real GTA result
- User log confirms the ASI loaded in real GTA V Enhanced `1.0.1158.13` and reached `CHECKPOINT_OK`.
- The game subsequently crashed, so real-game D4 stability **failed** and the bootstrap architecture is under isolation in `dev.9`.

## [0.0.1-dev.7] — 2026-09-04
- Added explicit-root Enhanced install/PE/architecture probing and the Windows file-version reader.

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
