# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.6] — 2026-09-04

### Traceability / validation
- Added the granular `docs/TODO_PHASE0.md` execution checklist so Phase 0 work is tracked below the broad feature TODO.
- Promoted the strict versioned config parser to D3 cross-platform after exact CI run `33864582553` succeeded on Windows/Linux and the sanitizer job.
- Updated engineering status with exact validation evidence.

### No runtime claim
- This patch is a traceability/status update. GTA V Enhanced runtime integration is still not implemented and is not claimed working.

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
