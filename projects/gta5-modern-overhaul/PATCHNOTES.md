# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.10] — 2026-09-04

### No-CRT / zero-import isolation checkpoint
- The user's real GTA V Enhanced still crashed with `dev.9`, even though the project `DllMain` body was intentionally inert.
- Inspection of the exact `dev.9` ASI revealed that the MSVC-generated DLL still imported `VCRUNTIME140.dll` and `api-ms-win-crt-runtime-l1-1-0.dll`, including CRT initialization/termination functions such as `_initterm`, `_initialize_onexit_table` and `_cexit`.
- Therefore `dev.9` did **not** prove that no project-associated startup code executed; the Microsoft CRT remained an unisolated layer.
- Added `NoCrtEntry.c`, a six-instruction-scale custom DLL entry path that ignores loader arguments and returns success.
- The dev.10 ASI is linked with `/NODEFAULTLIB`, `/ENTRY:VoxDllEntry`, `/GS-` and `/Zl` so no default C/C++ runtime is linked.

### Binary regression gate
- CI now parses the generated PE32+ ASI directly before packaging.
- The runtime package is rejected unless the ASI has a non-zero custom entrypoint, Import Directory RVA/size = 0, and TLS Directory RVA/size = 0.
- Independent post-download inspection also confirms Import Directory, IAT, TLS and Load Configuration directories are all zero.

### Verified
- Exact package commit: `a193e307a443e491f13e6576f8ea18896f91945c`.
- GitHub Actions run `33873756374`: SUCCESS.
- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- Linux ASan + UBSan: PASS.
- Windows x64 no-CRT ASI build: PASS.
- PE zero-import / zero-TLS validation: PASS.
- Synthetic no-CRT ASI load/residency/unload: PASS.
- GTA-ready ZIP construction and content verification: PASS.
- Artifact upload: PASS.

### Package identity
- `VOXModernOverhaul.asi` SHA-256: `c77d3c2b43081fadf05165155a032f154189f8a3fec8406a81266ee3101fc63b`.
- GTA-ready ZIP SHA-256: `6ba7a17a3c7958cff0224b29895a8408bbf480e3b47dc7e59c7f99a33fcb1d6a`.
- GitHub Actions outer artifact digest: `sha256:09e7212f37e6ebedca7e7ada9be9e4805984ec352fa7238e7d59c21a47087cb2`.

### Test interpretation
- If `dev.10` is stable in real GTA V Enhanced, the MSVC CRT/default DLL startup layer in `dev.9` becomes the primary compatibility suspect.
- If `dev.10` still crashes, application/bootstrap logic and the CRT are both eliminated; the next investigation must isolate ASI-loader/file-image/plugin-coexistence behavior and capture the actual crash module externally.

## [0.0.1-dev.9] — 2026-09-04

### Crash isolation checkpoint
- Real GTA V Enhanced test of `dev.8` proved that the ASI loader loaded `VOXModernOverhaul.asi` and the bootstrap reached `CHECKPOINT_OK` on Enhanced `1.0.1158.13`, but the game then crashed.
- Added a deliberately inert isolation ASI whose project `DllMain` immediately returns `TRUE` and performs no explicit project work.
- Removed `CreateThread`, logging, filesystem/config access, Enhanced probing, Windows version reads and all project-core dependencies from the test ASI target.

### Regression/isolation harness
- Replaced the synthetic bootstrap smoke host with an inert load/residency/unload harness.
- The harness loads the generated ASI, keeps it resident for two seconds and unloads it cleanly.

### Verified
- Exact implementation commit: `818376c8c3a3a8afaa2499ee44225ab68850b266`.
- GitHub Actions run `33872399873`: SUCCESS.
- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- Linux ASan + UBSan: PASS.
- Windows x64 inert ASI build: PASS.
- Synthetic inert ASI load/residency/unload: PASS.
- GTA-ready ZIP construction: PASS.
- ZIP required-file verification: PASS.
- Artifact upload: PASS.

### Package identity
- `VOXModernOverhaul.asi` SHA-256: `c8d3db56304565da90c6d69dc83c48c09cc771a8fc174f99902e473414a2cde7`.
- GTA-ready ZIP SHA-256: `e50a393791f94d8cd60ba5a6ea84f15449569ba0ff39f5aa5c6c207191d73b44`.

### Real GTA result
- User reports `dev.9` also crashes in real GTA V Enhanced.
- ASI loader again confirms `VOXModernOverhaul.asi` was loaded after RageOpenV, ScriptHookVDotNet and TrainerV; ScriptHookV and RageOpenV initialization logs show success.
- Binary inspection then identified the still-present MSVC CRT imports, motivating `dev.10` rather than repeating the same test.

## [0.0.1-dev.8] — 2026-09-04

### First GTA-ready checkpoint
- Added the first Windows x64 `.asi` diagnostic bootstrap: `VOXModernOverhaul.asi`.
- The bootstrap performs no GTA native calls, gameplay hooks, memory patches, save writes or world mutations.
- It validates that the host process is actually `gta5_enhanced.exe`, validates the Enhanced executable as AMD64 PE, reads its Windows file version and writes a startup diagnostic report.
- Added fail-closed configuration loading from `VOXModernOverhaul/config/core.cfg`.
- Added detection/reporting for `dinput8.dll` and `ScriptHookV.dll` without bundling either third-party binary.

### Development contract
- Added project-local `AGENT.md` containing the permanent project rules: continuous progress until meaningful checkpoints, blocker isolation/root-cause protocol, ask-before-guessing on subjective design choices, mandatory story compatibility, procedural-first architecture, external-asset licensing rules, validation gates, traceability and GTA-ready ZIP packaging rules.

### Automated Windows runtime validation
- Added a purpose-built x64 smoke host compiled as `gta5_enhanced.exe`.
- CI loads the generated `.asi`, exercises the bootstrap path and requires `CHECKPOINT_OK` before packaging.
- This passed synthetic D3 validation but failed later real-game D4 stability.

### Blocker found and permanently corrected
- Windows CI exposed legacy `windows.h` `max` macro pollution.
- Fixed globally by defining `NOMINMAX` for every MSVC target rather than patching individual call sites.

### Verified before real-game test
- GitHub Actions run `33865763371`: Windows, Linux, ASan+UBSan, ASI smoke, package verification and artifact upload all PASS.

### Real GTA result
- User log confirms the ASI loaded in real GTA V Enhanced `1.0.1158.13` and reached `CHECKPOINT_OK`.
- The game subsequently crashed, so D4 stability failed.

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
