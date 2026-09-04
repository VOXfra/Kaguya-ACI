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
- [ ] add production crash/exception capture only after stable live runtime exists
- [x] startup environment/build report foundation — dev.8 real execution observed
- [ ] full runtime dependency/build compatibility report

## Persistent identity

- [x] stable `EntityId` primitive — D3 cross-platform
- [x] resumable `EntityIdGenerator` — D3 cross-platform
- [x] zero reserved as invalid ID
- [x] fail-closed 64-bit exhaustion
- [ ] Entity Registry — **NEXT AFTER DEV.11 D4**
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
- [ ] queued/deferred game-thread dispatch adapter — follows Entity Registry
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

- [ ] complete native runtime adapter — IN PROGRESS
  - [x] minimal Windows x64 ASI binary target — D3
  - [x] dev.8 real GTA process loads ASI and reaches exact `CHECKPOINT_OK`
  - [ ] dev.8 real GTA stability — **FAILED / PATH QUARANTINED**
  - [x] dev.9 removes explicit project bootstrap/thread/filesystem/config/core logic
  - [x] dev.9 inert synthetic load/residency/unload — D3
  - [ ] dev.9 real GTA stability — **FAILED**
  - [x] inspect exact dev.9 PE imports
  - [x] identify remaining MSVC CRT/VCRUNTIME startup layer in dev.9
  - [x] dev.10 custom no-CRT entrypoint source
  - [x] dev.10 `/NODEFAULTLIB` + custom `/ENTRY` build
  - [x] dev.10 PE zero-import/TLS validation + independent inspection
  - [x] dev.10 synthetic load/residency/unload — D3, run `33873756374`
  - [x] dev.10 initial real GTA crash sequence observed
  - [x] external crash capture + controlled baseline tooling created
  - [x] dev.10 later remove/restore load succeeds
  - [x] dev.10 repeated normal launches now reported by user — **D4 stable load baseline**
  - [x] reject free-thread-from-DllMain architecture permanently
  - [x] current ScriptHookV x64 `scriptRegister`/`scriptWait` ABI boundary documented
  - [x] dev.11 custom-entry no-CRT runtime dynamically resolves already-loaded ScriptHookV
  - [x] dev.11 does not call `LoadLibrary` from loader callback
  - [x] dev.11 registers one `ScriptMain` callback
  - [x] dev.11 CI PE boundary: only intended Kernel32 API, no CRT/TLS/direct ScriptHookV import
  - [x] dev.11 fake ScriptHookV with explicit ABI export aliases
  - [x] dev.11 smoke gate: exact ABI exports found
  - [x] dev.11 smoke gate: `scriptRegister` actually called
  - [x] dev.11 smoke gate: ScriptMain executed
  - [x] dev.11 smoke gate: `scriptWait(0)` resumed
  - [x] dev.11 smoke gate: five scheduled heartbeats observed
  - [ ] dev.11 real GTA stability + game-thread markers — **CURRENT USER CHECKPOINT**
  - [ ] first safe GTA native read-only call
  - [ ] supported-build policy + graceful disable
  - [ ] plugin unload/shutdown lifecycle
- [ ] first stable GTA V Enhanced **active** runtime validation

### dev.11 implementation defects caught before delivery

- [x] duplicate `NOMINMAX` in test targets caused MSVC C4005 under `/WX`; removed local duplicates and kept one shared build definition
- [x] unnecessary exported custom PE entrypoint created linker warning debt; entrypoint made private while `/ENTRY:VoxDllEntry` stays authoritative
- [x] CI incorrectly assumed `dumpbin.exe` was in PATH; now resolved via `vswhere` + actual x64 MSVC toolchain
- [x] fake ScriptHookV compiler-generated mangling differed from pinned real ABI; replaced by explicit linker export aliases
- [x] smoke test upgraded to isolate ABI export / registration / ScriptMain / wait-resume / heartbeat failures separately

### Quarantined paths

- dev.8 `CreateThread`-from-`DllMain` bootstrap: permanently quarantined; never use as production lifecycle.
- dev.9 default MSVC CRT startup pattern: not accepted as a zero-work baseline.
- No GTA world mutation is allowed until dev.11 is proven in the real game.

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
- [x] dev.11 packaging path rejects accidental test `ScriptHookV.dll` redistribution
- [ ] installer/automatic root detection for later public builds

## Story compatibility foundation

- [ ] mission/story detector research — begins after dev.11 + persistence primitive
- [ ] detect mission-active state reliably
- [ ] Story Compatibility Manager skeleton
- [ ] canonical overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

Runtime checkpoints intentionally do not mutate story/world state.

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

**Checkpoint 0E — real GTA V Enhanced ScriptHookV game-thread validation (`0.0.1-dev.11`)**

Synthetic proof already complete:

1. Windows/Linux core builds — PASS.
2. ASan + UBSan — PASS.
3. custom-entry ASI build — PASS.
4. intended Kernel32-only runtime boundary — PASS.
5. CRT/C++ runtime/TLS/direct ScriptHookV import rejection — PASS.
6. exact ScriptHookV ABI export lookup — PASS.
7. `scriptRegister` callback registration — PASS.
8. ScriptMain execution — PASS.
9. `scriptWait(0)` yield/resume proof — PASS.
10. five scheduled heartbeat markers — PASS.
11. user package excludes fake ScriptHookV.dll — PASS.

Real-game test:

1. Replace dev.10 `VOXModernOverhaul.asi` with dev.11.
2. Delete any old `VOXModernOverhaul/runtime_game_thread.log`.
3. Leave ScriptHookV/dinput8/RageOpenV/SHVDN/TrainerV unchanged.
4. Launch Story Mode and stay in-game at least 10 seconds.
5. Quit normally if stable.
6. Return `VOXModernOverhaul/runtime_game_thread.log`.

Required real markers:
- `VOX_SCRIPT_MAIN_ENTER`
- `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`
- exactly five fresh `VOX_SCRIPT_HEARTBEAT` lines

Decision:
- **PASS:** begin Entity Registry + queued game-thread EventBus + first atomic persistent state.
- **CRASH:** do not alter other plugins; collect WER evidence immediately using the existing crash-capture pack.
- **NO LOG:** inspect real ScriptHookV ABI/module resolution without adding gameplay code.
