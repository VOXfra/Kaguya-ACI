# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

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
