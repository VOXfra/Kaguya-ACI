# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

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
- Generator assertions are now confirmed present in the executable test source.

### Validation boundary
- These are standalone-core results only. GTA V Enhanced integration is still not claimed working until an actual runtime adapter is built and tested in-game.

## [0.0.1-dev.2] — 2026-09-04

### Added
- Added typed native `EventBus` with subscription tokens, unsubscribe support and re-entrant publishing without holding the internal mutex during callbacks.
- Added GitHub Actions core CI matrix for Windows and Linux.
- Extended core tests to validate EventBus dispatch, re-entrant publishing and unsubscribe behavior.

### Verified
- Reproduced the exact committed core sources in an isolated local build environment.
- CMake configuration succeeded with GNU C++ 14.2.0.
- C++20 compilation and linking succeeded with `-Wall -Wextra -Wpedantic`.
- `ctest`: 1/1 tests passed, 0 failures.

### Validation boundary
- Linux/GCC standalone core is validated at D3 for the tested primitives.
- Windows/MSVC validation is delegated to the newly added CI job and remains pending until a successful workflow run is observed.
- GTA V Enhanced runtime integration remains unimplemented and therefore unvalidated.

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

### Technical decisions
- Critical runtime foundation will target native C++ rather than depending on official SHVDN Enhanced support.
- GTA-specific integration is isolated behind adapters so world logic remains testable without launching GTA.
- Modified game assets must be deployed non-destructively; original game files are never the canonical development copy.

### Validation status
- Source-level logic reviewed for invalid-ID, comparison and simulation-tier invariants.
- Core scaffold is designed to compile without ScriptHookV SDK or GTA files.
- GTA V Enhanced runtime integration is **not yet implemented or claimed working**.

### Known next steps
- Compile core scaffold in CI/local toolchain.
- Add deterministic event bus and versioned configuration.
- Add Windows GTA V Enhanced install/build detector.
- Add ScriptHookV adapter only after SDK/API audit.
- Build automated package/install/rollback workflow.
