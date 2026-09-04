# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.5] — 2026-09-04

### Added
- Added strict versioned configuration parser with mandatory `schema_version`.
- Added typed boolean and unsigned-integer readers.
- Added fail-closed validation for duplicate keys, missing schema and invalid schema values.

### Hardened
- Removed incorrect `noexcept` declarations from config lookup functions because they may allocate while converting a lookup key; this avoids turning allocation failure into unintended process termination.

### Verified
- Local GNU C++ 14.2.0 / C++20 build passes with warnings-as-errors.
- ASan + UBSan pass.
- Config positive/negative tests pass.
- Previous CI run `33864368881` completed successfully across Windows/Linux plus sanitizers for the prior hardened core state.

### Pending
- Latest config commit must receive its own cross-platform CI result before config status is promoted to D3 cross-platform.
- GTA V Enhanced runtime integration remains unimplemented.

## [0.0.1-dev.4] — 2026-09-04

### Added
- Added warnings-as-errors build mode (`VOX_WARNINGS_AS_ERRORS`).
- Added concurrent EventBus validation: 4 publisher threads × 1000 events.
- Added Linux sanitizer CI job using AddressSanitizer + UndefinedBehaviorSanitizer.
- Added `docs/STATUS.md` with evidence-based D0–D6 validation state per Phase 0 capability.

### Verified locally
- GNU C++ 14.2.0 / C++20.
- `-Wall -Wextra -Wpedantic -Werror` passes.
- ASan + UBSan pass.
- Concurrent EventBus test reaches exactly 4000 delivered events.
- CTest: 1/1 passing, 0 failures.

## [0.0.1-dev.3] — 2026-09-04

### Added
- Added `EntityIdGenerator` with resumable high-water mark, reserved zero ID and fail-closed exhaustion behavior.
- Added explicit tests for ID generation sequence, zero sanitization and maximum-ID exhaustion.

### Fixed before runtime release
- Fixed `EventBus::Unsubscribe` so it never reads a handler-vector reference after erasing its owning map entry.
- Changed EventBus token allocation to fail closed at 64-bit exhaustion instead of wrapping to zero and eventually risking duplicate subscription IDs.
- Corrected the test suite after detecting that the first generator-test injection had not actually inserted its assertions.

### Verified
- Clean rebuild with GNU C++ 14.2.0 and C++20.
- AddressSanitizer + UndefinedBehaviorSanitizer enabled for the validation build.
- `ctest`: 1/1 tests passed, 0 failures.

## [0.0.1-dev.2] — 2026-09-04

### Added
- Added typed native `EventBus` with subscription tokens, unsubscribe support and re-entrant publishing without holding the internal mutex during callbacks.
- Added GitHub Actions core CI matrix for Windows and Linux.
- Extended core tests to validate EventBus dispatch, re-entrant publishing and unsubscribe behavior.

## [0.0.1-dev.1] — 2026-09-04

### Added
- Frozen the V0.1 project charter and high-level feature inventory.
- Added modular architecture for visual, character, persistent society, crime, wildlife, reconstruction, destruction and Online-to-SP systems.
- Added the Story Compatibility Contract: vanilla GTA V campaign compatibility is mandatory.
- Added initial persistent-world data model.
- Added phased roadmap beginning with Enhanced tooling/audit and a visual vertical slice.
- Added project quality gates and permanent development log.
- Added first buildable C++20 core scaffold independent from GTA runtime APIs.
- Added stable `EntityId` type and simulation-fidelity tiers.
- Added thread-safe file logger for early diagnostics.
- Added native unit-test executable for core invariants.
