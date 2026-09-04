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
- [ ] add formatting/static-analysis gate
- [x] reproducible user-testable artifact build — D3 Windows

## Diagnostics

- [x] thread-safe file logger foundation — D3 cross-platform
- [ ] log rotation / bounded size
- [ ] structured subsystem/event fields
- [x] external Windows crash capture tooling — D3 tooling
  - [x] per-app WER `LocalDumps` configuration for `GTA5_Enhanced.exe`
  - [x] default minidump (`DumpType=1`) capture
  - [x] pre-existing WER value backup
  - [x] reversible WER restore
  - [x] recent Application/WER event collection
  - [x] recent dump collection
  - [x] plugin/game hash inventory
  - [x] relevant GTA/mod log collection
  - [x] evidence ZIP generation
  - [x] PowerShell parser CI
  - [x] fake-GTA evidence collector smoke test
  - [x] reproducible crash-capture package + artifact
- [ ] obtain real GTA crash minidump/exception/module if instability recurs
- [ ] analyze real dump and identify faulting module/offset if captured
- [ ] add production crash/exception capture to runtime only after stable loader path exists
- [x] startup environment/build report foundation — dev.8 real execution observed
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
  - [x] dev.8 runtime config packaged and parsed in synthetic + real GTA bootstrap
  - [x] malformed/missing dev.8 runtime config fails closed in bootstrap
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
  - [x] detector Windows/Linux/sanitizer CI
  - [x] Windows file-version reader CI validation — D3 Windows
  - [x] real dev.8 execution confirmed Enhanced probe + version `1.0.1158.13`
  - [ ] supported-build policy mapping
- [ ] Epic install discovery
- [ ] Steam install discovery
- [ ] Rockstar Launcher install discovery
- [ ] external-tool path wiring
- [ ] tool discovery: CodeWalker
- [ ] tool discovery: OpenRPF
- [ ] tool discovery: Blender/Sollumz
- [ ] OpenIV optional discovery/reference workflow

## Native runtime adapter

- [ ] complete native runtime adapter — GATED ON REPEATABLE D4 LOAD
  - [x] minimal Windows x64 ASI binary target — D3
  - [x] dev.8 real GTA process loads ASI and reaches exact `CHECKPOINT_OK`
  - [ ] dev.8 real GTA stability — **FAILED**
  - [x] dev.9 removes explicit project bootstrap/thread/filesystem/config/core logic
  - [x] dev.9 inert synthetic load/residency/unload — D3
  - [ ] dev.9 real GTA stability — **FAILED**
  - [x] inspect exact dev.9 PE imports
  - [x] identify remaining MSVC CRT/VCRUNTIME startup layer in dev.9
  - [x] dev.10 custom no-CRT entrypoint source
  - [x] dev.10 `/NODEFAULTLIB` + custom `/ENTRY` build
  - [x] dev.10 CI gate: PE32+ non-zero entrypoint
  - [x] dev.10 CI gate: Import Directory = 0
  - [x] dev.10 CI gate: TLS Directory = 0
  - [x] dev.10 independent downloaded-binary inspection: Import/IAT/TLS/LoadConfig all zero
  - [x] dev.10 synthetic load/residency/unload — D3, run `33873756374`
  - [x] dev.10 initial real GTA crash observed
  - [x] stop speculative application/runtime changes after initial dev.10 failure
  - [x] add controlled baseline tool that disables only VOX ASI by rename
  - [x] add external crash-module/minidump capture tooling
  - [x] dev.10 later real GTA load succeeds after user remove/restore cycle — **D4 provisional**
  - [ ] repeat exact dev.10 successful cold launch at least twice without changing other plugins — **CURRENT USER CHECKPOINT**
  - [ ] sustain Story Mode/free-roam for a meaningful interval with dev.10
  - [ ] complete at least one clean normal exit + relaunch cycle
  - [ ] if crash recurs: collect WER/minidump before any further runtime code change
  - [ ] determine whether earlier failures were stale file state, intermittent loader coexistence or unrelated host instability
  - [ ] ScriptHookV SDK acquisition/documented dependency for native calls
  - [ ] ScriptHookV/game-thread registration adapter
  - [ ] one safe in-game tick
  - [ ] supported-build policy + graceful disable
  - [ ] plugin unload/shutdown lifecycle
- [ ] first stable GTA V Enhanced D4 runtime validation

### Quarantined paths

- dev.8 `CreateThread`-from-`DllMain` bootstrap: quarantined; do not reuse as production lifecycle.
- dev.9 default MSVC CRT startup pattern: not accepted as a zero-work isolation baseline because CRT startup imports remained.
- Do not add gameplay/native functionality until dev.10 repeatability is proven.

## Packaging / rollback

- [x] reproducible PowerShell runtime checkpoint packager — D3 Windows
- [x] package contains only project files; no third-party binaries
- [x] ASI SHA-256 recorded in `BUILD_INFO.txt`
- [x] commit/version recorded in `BUILD_INFO.txt`
- [x] generated runtime ZIP extracted and required files verified in CI
- [x] first-test instructions packaged
- [x] explicit removal/rollback instructions packaged
- [x] dev.8 artifact upload
- [x] dev.9 artifact upload — run `33872399873`
- [x] dev.10 artifact upload — run `33873756374`
- [x] crash-capture tooling package — run `33875088958`
- [ ] installer/automatic root detection for later public builds

## Story compatibility foundation

- [ ] mission/story detector research
- [ ] detect mission-active state reliably
- [ ] Story Compatibility Manager skeleton
- [ ] canonical overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

Runtime isolation checkpoints intentionally do not mutate story/world state. Story compatibility work resumes only after a stable D4 runtime exists.

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

**Checkpoint 0E — repeatable real GTA V Enhanced dev.10 stability**

Known evidence:

1. dev.10 binary/toolchain validation — PASS.
2. initial real-game attempts — CRASHED after successful ASI mapping.
3. user later removed VOX, restored/re-added it, and GTA then appeared to load successfully.
4. latest loader log confirms `VOXModernOverhaul.asi` maps successfully and plugin loading completes.
5. latest ScriptHookV/RageOpenV logs show normal initialization.

Required promotion test:

1. Leave every file/plugin exactly as it is now.
2. Stay in Story Mode/free roam for roughly 10 minutes.
3. Quit GTA normally.
4. Launch GTA again without touching the mod folder.
5. Reach Story Mode again and remain loaded for several minutes.
6. Ideally perform one additional cold launch later with the same files.
7. If any crash occurs, run the already prepared crash-evidence collector before replacing/removing anything.

Decision:

- **Repeatably stable:** promote loader path to stable D4 and immediately begin proper ScriptHookV/game-thread registration + one safe tick.
- **Crash recurs:** keep architecture frozen, collect WER/minidump and identify the actual failing module/exception.
