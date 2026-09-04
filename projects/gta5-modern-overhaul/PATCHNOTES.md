# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.7] — 2026-09-04

### Added
- Added portable GTA V Enhanced install probing from an explicit root path.
- Probe now requires `gta5_enhanced.exe` to exist as a regular file, contain a valid `MZ`/`PE` signature and declare AMD64 (`0x8664`) architecture.
- Added Windows file-version reader using the executable's native `VS_FIXEDFILEINFO` resource.
- Added Windows CI test path that reads a real system DLL version and verifies clear failure for a missing file.

### Correctness / validation
- The install probe intentionally is **not** declared `noexcept`: copying/constructing filesystem paths and opening streams can allocate and may throw. This avoids accidental `std::terminate` on allocation failure.
- Portable install probe validated locally with GNU C++ 14.2.0, warnings-as-errors, ASan and UBSan.
- Negative tests cover missing directory, missing executable, malformed PE and non-AMD64 PE; positive fixture covers AMD64 PE.

### Pending
- Windows/MSVC compile and native file-version test for this exact commit must pass in CI before Windows build/version detection is promoted.
- Epic/Steam/Rockstar automatic install discovery is not implemented yet.
- No GTA V Enhanced runtime hook is claimed working.

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
