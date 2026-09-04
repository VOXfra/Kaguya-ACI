# TODO — Phase 0 / Tooling & Core

This checklist is the granular execution list for Phase 0. The high-level feature inventory remains in `TODO.md`.

Legend:
- `[x]` = implemented and validated at the stated gate
- `[ ]` = not yet complete
- `IN PROGRESS` = implementation exists but the required validation gate is still pending

## Core quality / traceability

- [x] C++20 standalone core scaffold — D3 cross-platform
- [x] CMake warnings policy — D3 cross-platform
- [x] warnings-as-errors validation mode — D3 cross-platform
- [x] global MSVC `NOMINMAX` protection — D3 Windows
- [x] GitHub Windows/Linux build+test CI — D3
- [x] Linux ASan + UBSan CI — D3
- [x] project-local `AGENT.md` development contract — active
- [x] project patch notes — active
- [x] precise development log — active
- [x] evidence-based engineering status table — active
- [x] reproducible user-testable artifact build — D3 Windows
- [ ] add formatting/static-analysis gate

## Diagnostics

- [x] thread-safe file logger foundation — D3 cross-platform
- [x] runtime host-callback diagnostics observed through real dev.13 core bridge
- [x] external Windows crash capture tooling — D3 tooling
- [ ] log rotation / bounded size
- [ ] structured subsystem/event fields
- [ ] production crash/exception capture only if needed after stable runtime
- [ ] full runtime dependency/build compatibility report

## Persistent identity

- [x] stable `EntityId` primitive — D3 cross-platform
- [x] resumable `EntityIdGenerator` — D3 cross-platform
- [x] zero reserved as invalid ID
- [x] fail-closed 64-bit exhaustion in generator
- [x] dev.13 first EntityId through isolated live Core — **D4 real GTA PASS**
- [x] `EntityRegistry` create/find/remove/snapshot — D3 cross-platform
- [x] entity kind validation — D3
- [x] restored ID must be valid and strictly below persisted next-ID — D3
- [x] duplicate restored ID rejection — D3
- [x] persisted high-water mark integration — D3 synthetic/runtime
- [x] duplicate/corrupt ID state recovery tests — D3
- [ ] dev.14 real GTA persistent-registry two-launch validation — **CURRENT USER CHECKPOINT**
- [ ] GTA runtime handle ↔ stable EntityId adapter — next identity step
- [ ] entity lifecycle binding rules for streamed-out/streamed-in GTA objects

## World persistence

- [x] world-state schema v1
- [x] strict magic/schema/count/entity parser
- [x] deterministic entity serialization order
- [x] final FNV-1a 64 checksum
- [x] tamper/truncation/unknown-line rejection
- [x] maximum state-file size guard
- [x] temporary-file write
- [x] disk flush before commit
- [x] atomic primary replacement
- [x] previous committed state retained as `.bak`
- [x] corrupt-primary / valid-backup recovery test
- [x] first separate-process synthetic create → second-process restore proof
- [x] CI package rejects generated user state
- [ ] schema migration framework before schema v2 exists
- [ ] larger-scale persistence stress test
- [ ] explicit shutdown/save integration beyond startup checkpoint semantics

## Event / game-thread architecture

- [x] typed EventBus — D3 cross-platform
- [x] subscription tokens / unsubscribe
- [x] re-entrant publication
- [x] concurrent publication test
- [x] subscription-ID fail-closed exhaustion
- [x] bounded `GameThreadQueue` — D3 cross-platform
- [x] concurrent producers — D3
- [x] bounded drain — D3
- [x] tasks enqueued while draining deferred to next tick — D3
- [x] handler exception isolation — D3
- [x] dev.14 synthetic runtime dispatch marker — D3 Windows
- [ ] dev.14 real GTA queue marker — **CURRENT USER CHECKPOINT**
- [ ] explicit event taxonomy / namespaces
- [ ] EventBus → GameThreadQueue adapter API
- [ ] event tracing hooks

## Simulation fidelity

- [x] simulation-tier primitive — D3 cross-platform
- [ ] Spatial Simulation Manager
- [ ] distance/relevance promotion rules
- [ ] deterministic dematerialize/rematerialize contract
- [ ] simulation-budget governor
- [ ] stress test with large abstract population

## Configuration

- [ ] complete versioned config system — IN PROGRESS
  - [x] strict `key=value` parser — D3
  - [x] mandatory numeric `schema_version`
  - [x] duplicate-key rejection
  - [x] typed bool/unsigned readers
  - [x] Windows/Linux/sanitizer validation
  - [ ] typed project runtime schema
  - [ ] config schema migration framework
  - [ ] production malformed-config recovery/default policy

## GTA V Enhanced environment / native runtime

- [x] explicit-root Enhanced probe — D3 regression / real execution observed
- [x] `gta5_enhanced.exe` MZ/PE/AMD64 validation
- [x] Windows file-version reader
- [x] real Enhanced `1.0.1158.13` identified
- [x] dev.8 unsafe free-thread bootstrap rejected after real crash
- [x] dev.9 hidden CRT startup isolated
- [x] dev.10 no-CRT stable ASI load baseline — D4
- [x] dev.11 real ScriptHook registration failure isolated
- [x] dev.12 tolerant ScriptHook export resolution
- [x] dev.12 real ScriptHook registration / ScriptMain / wait-resume / heartbeats — **D4 PASS**
- [x] dev.13 split minimal ASI from normal `VOXModernCore.dll`
- [x] dev.13 plain-C versioned ASI↔Core boundary
- [x] dev.13 Core loaded only after ScriptMain resume
- [x] dev.13 real Core start/bridge/ticks — **D4 PASS**
- [x] dev.14 persistence and queue wired into Core — D3 full synthetic
- [ ] dev.14 real persistence/queue validation — **CURRENT**
- [ ] first safe GTA native read-only call
- [ ] supported-build policy + graceful disable
- [ ] robust plugin/core unload/shutdown lifecycle

### Quarantined paths

- dev.8 `CreateThread` from `DllMain`: permanently forbidden.
- dev.9 default CRT-startup ASI pattern: not accepted as minimal host.
- World-mutating GTA behavior remains gated behind story compatibility and its own regression tests.

## Packaging / rollback

- [x] reproducible runtime checkpoint packager
- [x] project binaries only; no third-party redistribution
- [x] ASI/Core SHA-256 + commit/version in `BUILD_INFO.txt`
- [x] generated ZIP extraction/content validation
- [x] package excludes fake `ScriptHookV.dll`
- [x] package excludes CI-generated `VOXModernOverhaul/state/world_state.v1`
- [x] packaged install/test/rollback instructions
- [x] dev.13 final package delivered and real-tested
- [x] dev.14 synthetic package path green in run `33885665383`
- [ ] dev.14 final documented artifact rebuild — IN PROGRESS
- [ ] installer/automatic GTA-root detection for later public builds

## Story compatibility foundation

- [ ] read-only mission/story detector research — next parallel track
- [ ] reliable mission-active state
- [ ] Story Compatibility Manager skeleton
- [ ] canonical world overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

## Asset pipeline — visual priority

- [ ] identify visible in-game asset → exact Enhanced source resource proof — **NEXT MAJOR PARALLEL TRACK**
- [ ] asset dependency locator
- [ ] export working copy
- [ ] Enhanced/Gen9 conversion validation
- [ ] non-destructive OpenRPF override package
- [ ] rollback/disable path
- [ ] automated before/after package
- [ ] **first visible in-game asset replacement D4**
- [ ] first graphical vertical slice

## Current checkpoint

**Checkpoint 0H — persistent Entity Registry / two-launch state validation (`0.0.1-dev.14`)**

Already proven before user delivery:

1. dev.13 real GTA isolated Core bridge — PASS.
2. Windows core build/tests — PASS.
3. Linux core build/tests — PASS.
4. ASan + UBSan — PASS.
5. Registry invariants — PASS.
6. strict checksummed world-state round-trip/tamper rejection — PASS.
7. atomic save + backup recovery — PASS.
8. high-water restore — PASS.
9. bounded/concurrent/failure-isolated game-thread queue — PASS.
10. first synthetic process creates system EntityId 1 / next ID 2 — PASS.
11. second separate process restores same state — PASS.
12. ASI PE/CRT safety boundary retained — PASS.
13. package excludes fake ScriptHook and generated state — PASS.

Required real dev.14 proof:

- first clean launch: `VOX_PERSISTENCE_STATUS=NEW`
- `VOX_PERSISTENCE_SYSTEM_ENTITY_ID=1`
- `VOX_PERSISTENCE_ENTITY_COUNT=1`
- `VOX_PERSISTENCE_NEXT_ENTITY_ID=2`
- `VOX_PERSISTENCE_SAVE_OK`
- `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`
- second launch without deleting state: `VOX_PERSISTENCE_STATUS=LOADED`
- same EntityId/count/next-ID values
- existing Core ticks and ScriptHook heartbeats remain healthy
- GTA stable on both launches

Decision after PASS:
- bind persistent IDs to read-only GTA runtime handles;
- start read-only mission detection;
- **start Enhanced asset locator/override tooling immediately in parallel, targeting the first visible graphics replacement.**
