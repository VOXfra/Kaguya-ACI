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
- [x] global MSVC `NOMINMAX` protection against Win32 macro pollution — D3 Windows
- [x] GitHub Windows/Linux build+test CI — D3
- [x] Linux ASan + UBSan CI — D3
- [x] project-local `AGENT.md` development contract — active
- [x] project patch notes — active
- [x] precise development log — active
- [x] evidence-based engineering status table — active
- [ ] add formatting/static-analysis gate (clang-format/clang-tidy or equivalent)
- [x] add first reproducible user-testable artifact build — D3 Windows

## Diagnostics

- [x] thread-safe file logger foundation — D3 cross-platform
- [ ] log rotation / bounded size
- [ ] structured subsystem/event fields
- [ ] crash/exception capture
- [ ] minidump or equivalent Windows crash artifact
- [x] startup environment/build report foundation — D3 Windows smoke
  - [x] process path
  - [x] Enhanced install validation status
  - [x] Windows GTA executable file version
  - [x] ASI loader (`dinput8.dll`) presence
  - [x] ScriptHookV presence
  - [ ] full runtime dependency/build compatibility report

## Persistent identity

- [x] stable `EntityId` primitive — D3 cross-platform
- [x] resumable `EntityIdGenerator` — D3 cross-platform
- [x] zero reserved as invalid ID
- [x] fail-closed 64-bit exhaustion
- [ ] Entity Registry
- [ ] GTA runtime handle ↔ stable EntityId adapter
- [ ] persisted high-water mark integration
- [ ] duplicate/corrupt ID database recovery test

## Event architecture

- [x] typed EventBus — D3 cross-platform
- [x] subscription tokens
- [x] unsubscribe behavior
- [x] re-entrant publication
- [x] concurrent publication test (4 × 1000)
- [x] subscription-ID fail-closed exhaustion
- [ ] explicit event taxonomy / namespaces
- [ ] queued/deferred game-thread dispatch adapter
- [ ] handler failure isolation policy
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
  - [x] strict `key=value` parser — D3 cross-platform
  - [x] mandatory numeric `schema_version` — D3 cross-platform
  - [x] duplicate-key rejection — D3 cross-platform
  - [x] typed bool/unsigned readers — D3 cross-platform
  - [x] ASan/UBSan + warnings-as-errors validation
  - [x] Windows/Linux/sanitizer CI validation
  - [x] checkpoint config packaged and parsed by Windows ASI smoke host
  - [x] malformed/missing runtime config fails closed in bootstrap
  - [ ] typed project runtime schema
  - [ ] schema migration framework
  - [ ] atomic file write / rollback
  - [ ] production malformed-config recovery/default policy

## GTA V Enhanced environment

- [ ] Enhanced install/build detector — IN PROGRESS
  - [x] explicit-root directory probe — D3 cross-platform
  - [x] exact `gta5_enhanced.exe` requirement — D3 cross-platform
  - [x] `MZ` + `PE` signature validation — D3 cross-platform
  - [x] AMD64 machine validation — D3 cross-platform
  - [x] detector Windows/Linux/sanitizer CI — run `33865763371`
  - [x] Windows file-version reader CI validation — D3 Windows
  - [ ] supported-build policy mapping
- [ ] Epic install discovery
- [ ] Steam install discovery
- [ ] Rockstar Launcher install discovery
- [ ] explicit user-path config wiring for external tools
- [ ] tool discovery: CodeWalker
- [ ] tool discovery: OpenRPF
- [ ] tool discovery: Blender/Sollumz
- [ ] OpenIV optional discovery/reference workflow

## Native runtime adapter

- [ ] complete native runtime adapter — IN PROGRESS
  - [x] minimal Windows x64 ASI target — D3 compile/runtime-smoke
  - [x] ASI host-process validation (`gta5_enhanced.exe`)
  - [x] fail-closed exception boundary
  - [x] synthetic x64 Enhanced-named host loads real generated ASI — D3
  - [x] bootstrap thread reaches exact `CHECKPOINT_OK` in smoke harness
  - [x] no gameplay/native/memory/save modifications in checkpoint 0
  - [ ] actual GTA V Enhanced ASI load — D4 pending user test
  - [ ] ScriptHookV SDK acquisition/documented dependency for native calls
  - [ ] ScriptHookV/game-thread registration adapter
  - [ ] one safe in-game tick
  - [ ] supported-build policy + graceful disable
  - [ ] plugin unload/shutdown lifecycle for later stateful systems
- [ ] first GTA V Enhanced D4 validation — **CURRENT USER CHECKPOINT**

## Packaging / rollback

- [x] reproducible PowerShell checkpoint packager — D3 Windows
- [x] package contains only project files; no third-party binaries
- [x] ASI SHA-256 recorded in `BUILD_INFO.txt`
- [x] commit/version recorded in `BUILD_INFO.txt`
- [x] generated ZIP extracted and required files verified in CI
- [x] first-test instructions packaged
- [x] explicit removal/rollback instructions packaged
- [x] GitHub Actions artifact upload — run `33865763371`
- [ ] installer/automatic root detection for later public builds

## Story compatibility foundation

- [ ] mission/story detector research
- [ ] detect mission-active state reliably
- [ ] Story Compatibility Manager skeleton
- [ ] canonical overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

Checkpoint 0 does not mutate GTA world/story state, so no mission override is required for this diagnostic load test.

## Asset pipeline

- [ ] identify on-screen asset → source resource proof
- [ ] asset dependency locator
- [ ] export working copy
- [ ] Enhanced conversion validation
- [ ] non-destructive OpenRPF override package
- [ ] rollback/disable path
- [ ] automated before/after test package
- [ ] first in-game asset replacement D4

## Current checkpoint

**Checkpoint 0 — real GTA V Enhanced ASI load**

Engineering/synthetic validation is complete. The next action requires the real game:

1. Copy the generated `0.0.1-dev.8` ZIP contents into the GTA V Enhanced root.
2. Launch Story Mode.
3. Quit normally after the bootstrap has had time to execute.
4. Return `VOXModernOverhaul/logs/bootstrap.log`.
5. Promote the diagnostic ASI to D4 only if the real log contains the exact `CHECKPOINT_OK` marker and the game remains stable.

After D4 validation, continue Phase 0 with:

1. supported-build policy + ScriptHookV/game-thread adapter;
2. one harmless in-game tick/probe;
3. Entity Registry + persisted high-water mark;
4. typed runtime config/migration skeleton;
5. mission/story detection foundation;
6. first non-destructive asset pipeline proof for the visual vertical slice.
