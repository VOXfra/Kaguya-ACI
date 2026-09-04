# Quality Gates

A feature is never marked complete because it merely exists in code.

## Validation levels

### D0 — Design only
Architecture/specification exists. No executable claim.

### D1 — Static validation
- code reviewed for control-flow and state invariants
- dependencies and ownership understood
- failure paths identified
- no known undefined behavior by inspection

### D2 — Build validation
- clean build from documented toolchain
- no compile/link errors
- warnings reviewed
- test executable builds

### D3 — Automated validation
- unit/integration tests pass
- deterministic tests for state transitions where possible
- serialization migration tests where relevant

### D4 — Enhanced runtime validation
- installed non-destructively
- GTA V Enhanced launches
- feature initializes without crash
- expected behavior observed in controlled scenario
- logs contain no new errors

### D5 — Story regression validation
- representative vanilla missions tested
- no permanent corruption of mission-critical world state
- save/load and disable/rollback tested

### D6 — Production-ready
- performance budget acceptable
- failure recovery works
- compatibility notes written
- patch notes and TODO updated
- repeatable install/build process exists

## Mandatory rules

1. **No false completion.** TODO items remain unchecked until their required gate passes.
2. **No destructive installs.** Development assets are overrides; original GTA files are not edited as the source of truth.
3. **No hidden state.** Persistent state must be versioned and diagnosable.
4. **No transient-handle persistence.** GTA handles are adapters, never permanent IDs.
5. **No silent corruption.** Database writes and migrations must be transactional or recoverable.
6. **No uncontrolled cross-system calls.** Prefer structured events and explicit interfaces.
7. **No mission assumptions.** Any ambient system changing world state must cooperate with Story Compatibility Manager.
8. **No magical entities.** Objects/weapons/vehicles/people used by simulation must have a plausible source/location unless explicitly classified as mission-canonical content.
9. **No scale before proof.** A subsystem must pass a vertical-slice test before map-wide rollout.
10. **Trace every change.** Update `DEV_LOG.md`; update `PATCHNOTES.md`; update `TODO.md` whenever status/scope changes.

## Code review checklist

Before every runtime-facing commit:

- bounds/null/invalid-handle checks
- lifetime/ownership review
- threading assumptions documented
- game-build assumptions isolated
- deterministic fallback on missing data
- logging on failure paths
- no blocking I/O in game tick
- no unbounded per-frame iteration
- save schema backwards compatibility considered
- story compatibility impact classified

## Performance budgets

Initial budgets are provisional and will be measured during Phase 0.

- persistent/background systems: event-driven, never full-map per-frame scans
- game-thread work: bounded and profiled
- file/database writes: buffered/off critical tick path
- high-fidelity AI/physics: spatially limited
- asset quality: LODs mandatory before map-wide deployment

## Evidence rule

For every feature we maintain:

- intended behavior
- implementation commit
- tests performed
- game build tested
- observed result
- known limitations

If one of these is unknown, it is written as unknown rather than guessed.
