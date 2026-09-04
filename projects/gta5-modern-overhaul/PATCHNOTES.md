# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-debug.1] — 2026-09-04

### dev.10 real-game result
- The user reports GTA V Enhanced still crashes with `0.0.1-dev.10`.
- New `asiloader(2).log` again confirms `VOXModernOverhaul.asi` is successfully mapped after RageOpenV, ScriptHookVDotNet and TrainerV.
- `ScriptHookV(2).log` again reports successful initialization for `VER_EN_1_0_1158_13`.
- `RageOpenV(2).log` again reports successful initialization.
- Because dev.10 has a custom no-CRT entrypoint, zero PE imports, zero IAT, zero TLS and no project/game logic, application logic and compiler-runtime startup are no longer credible primary suspects.
- No further application/runtime feature code will be changed until the crash module/exception is captured externally and a baseline without the VOX ASI is measured.

### External crash-capture tooling
- Added a reversible Windows Error Reporting `LocalDumps` capture pack scoped only to `GTA5_Enhanced.exe`.
- Defaults to `DumpType=1` minidumps to avoid multi-GB full dumps; supports full dumps if explicitly requested.
- Backs up pre-existing per-app WER settings before changing them and refuses blind restore when no backup exists.
- Added controlled baseline launch tooling that renames only `VOXModernOverhaul.asi` to `.disabled` while leaving every other ASI/plugin untouched.
- Added evidence collector for recent Windows Application/WER events, recent dumps, GTA/mod logs, game version/hash and relevant plugin hashes.
- Added reversible restore tooling for both the VOX ASI filename and WER registry state.

### Crash-capture CI / blocker fixes
- First crash-capture CI run `33874964527` failed during evidence ZIP creation because `Compress-Archive -LiteralPath` was incorrectly combined with a wildcard. Root cause isolated from the Windows job log; fixed by using wildcard-capable `-Path`.
- Second run `33875034785` passed the collector smoke test but failed during package staging for the same wildcard/`-LiteralPath` incompatibility in `Copy-Item`. Fixed at the packager source.
- Final run `33875088958`: PowerShell parse validation PASS, fake-GTA evidence collector smoke PASS, crash-capture package build PASS, package extraction/content verification PASS, artifact upload PASS.

### Crash-capture package identity
- Exact tooling commit: `226000bb45da0dfe4fc976617731a866b3466b18`.
- GitHub Actions run: `33875088958`.
- Inner user ZIP SHA-256: `30414e69d05283d8f326b289b38c87d372faf1e0d9588ad1604cabd4911ed27a`.
- GitHub Actions outer artifact digest: `sha256:64297ab4e165f22d8bdebc29be17f196c96776c4f01bb9b97c0ea7a460db091b`.

### Required next evidence
1. Enable external crash capture.
2. Disable only `VOXModernOverhaul.asi` via rename and run the otherwise identical modded game as a baseline.
3. If baseline crashes, collect evidence immediately and do not re-enable VOX yet.
4. If baseline is stable, re-enable the exact dev.10 ASI, reproduce the crash, then collect evidence.
5. Use the resulting WER event/minidump to identify faulting module/exception before changing runtime architecture again.

## [0.0.1-dev.10] — 2026-09-04

### No-CRT / zero-import isolation checkpoint
- The user's real GTA V Enhanced still crashed with `dev.9`, even though the project `DllMain` body was intentionally inert.
- Inspection of the exact `dev.9` ASI revealed that the MSVC-generated DLL still imported `VCRUNTIME140.dll` and `api-ms-win-crt-runtime-l1-1-0.dll`, including CRT initialization/termination functions such as `_initterm`, `_initialize_onexit_table` and `_cexit`.
- Therefore `dev.9` did **not** prove that no project-associated startup code executed; the Microsoft CRT remained an unisolated layer.
- Added `NoCrtEntry.c`, a six-instruction-scale custom DLL entry path that ignores loader arguments and returns success.
- The dev.10 ASI is linked with `/NODEFAULTLIB`, `/ENTRY:VoxDllEntry`, `/GS-` and `/Zl` so no default C/C++ runtime is linked.

### Binary regression gate
- CI parses the generated PE32+ ASI directly before packaging.
- The runtime package is rejected unless the ASI has a non-zero custom entrypoint, Import Directory RVA/size = 0, and TLS Directory RVA/size = 0.
- Independent post-download inspection also confirms Import Directory, IAT, TLS and Load Configuration directories are all zero.

### Verified before real-game test
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

### Real GTA result
- **FAILED D4 stability.** The user reports the game still crashes with dev.10.
- The loader log confirms the ASI was mapped successfully; adjacent ScriptHookV/RageOpenV startup logs show success but still contain no crash module/exception.
- Investigation therefore moved to controlled baseline + external crash capture rather than another speculative runtime build.

## [0.0.1-dev.9] — 2026-09-04

### Crash isolation checkpoint
- Real GTA V Enhanced test of `dev.8` proved that the ASI loader loaded `VOXModernOverhaul.asi` and the bootstrap reached `CHECKPOINT_OK` on Enhanced `1.0.1158.13`, but the game then crashed.
- Added a deliberately inert isolation ASI whose project `DllMain` immediately returns `TRUE` and performs no explicit project work.
- Removed `CreateThread`, logging, filesystem/config access, Enhanced probing, Windows version reads and all project-core dependencies from the test ASI target.

### Verified
- Exact implementation commit: `818376c8c3a3a8afaa2499ee44225ab68850b266`.
- GitHub Actions run `33872399873`: SUCCESS across Windows/Linux, sanitizers, inert ASI smoke and packaging.

### Real GTA result
- User reports `dev.9` also crashes in real GTA V Enhanced.
- Binary inspection then identified the still-present MSVC CRT imports, motivating `dev.10` rather than repeating the same test.

## [0.0.1-dev.8] — 2026-09-04

### First GTA-ready checkpoint
- Added the first Windows x64 `.asi` diagnostic bootstrap: `VOXModernOverhaul.asi`.
- Bootstrap performed no GTA native calls, gameplay hooks, memory patches, save writes or world mutations.
- Added project-local `AGENT.md`, strict development/traceability rules, synthetic runtime smoke test and reproducible packaging.
- Windows CI exposed `windows.h` `max` macro pollution; fixed globally with `NOMINMAX`.
- GitHub Actions run `33865763371`: Windows, Linux, sanitizers, ASI smoke and packaging PASS.

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
