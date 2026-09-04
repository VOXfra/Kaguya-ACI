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
- [ ] add production crash/exception capture only after stable live core bridge exists
- [x] startup environment/build report foundation — dev.8 real execution observed
- [ ] full runtime dependency/build compatibility report

## Persistent identity

- [x] stable `EntityId` primitive — D3 cross-platform
- [x] resumable `EntityIdGenerator` — D3 cross-platform
- [x] zero reserved as invalid ID
- [x] fail-closed 64-bit exhaustion
- [x] first `EntityId` allocation through isolated live-core API path — D3 synthetic dev.13
- [ ] Entity Registry — **NEXT AFTER DEV.13 D4**
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
- [ ] queued/deferred game-thread dispatch adapter — follows Entity Registry + dev.13 real bridge
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
  - [x] dev.10 repeated normal launches reported — **D4 stable load baseline**
  - [x] reject free-thread-from-DllMain architecture permanently
  - [x] dev.11 custom-entry no-CRT ScriptHookV lifecycle attempt
  - [x] dev.11 synthetic registration/ScriptMain/wait-resume/five-heartbeat proof
  - [ ] dev.11 real registration — **FAILED: ASI loaded, ScriptHookV registration absent**
  - [x] dev.12 export-name fallback: exact → undecorated → unique PE export-stem scan
  - [x] dev.12 ambiguity fails closed
  - [x] dev.12 synthetic fallback regression forces drifted export names
  - [x] dev.12 real ScriptHookV registration — **D4 PASS**
  - [x] dev.12 real ScriptMain entry — **D4 PASS**
  - [x] dev.12 real `scriptWait(0)` resume — **D4 PASS**
  - [x] dev.12 real five heartbeats — **D4 PASS**
  - [x] dev.12 real GTA stability during checkpoint — **D4 PASS**
  - [x] dev.13 split minimal ASI host from normal C++ `VOXModernCore.dll`
  - [x] dev.13 plain-C versioned ASI↔Core ABI
  - [x] dev.13 loads C++ core only after ScriptMain has resumed
  - [x] dev.13 synthetic core `Start` / first EntityId / `Tick` handshake — D3 Windows
  - [ ] dev.13 real GTA isolated C++ core bridge — **CURRENT USER CHECKPOINT**
  - [ ] first safe GTA native read-only call
  - [ ] supported-build policy + graceful disable
  - [ ] plugin/core unload/shutdown lifecycle
- [x] first stable GTA V Enhanced **active** runtime validation — dev.12 D4

### Runtime implementation defects / blockers caught

- [x] dev.8 free thread from loader callback rejected after real crash
- [x] dev.9 hidden CRT startup identified by PE inspection
- [x] Windows `max` macro contamination fixed globally with `NOMINMAX`
- [x] duplicate `NOMINMAX` caught by `/WX` and removed from local test targets
- [x] unnecessary custom-entrypoint export removed
- [x] CI `dumpbin` PATH assumption removed; resolved through `vswhere`
- [x] fake ScriptHookV compiler-mangling dependency replaced with explicit export aliases
- [x] dev.11 real export-resolution incompatibility isolated through absence of ScriptHookV registration
- [x] dev.12 fallback tested with deliberately drifted export names
- [x] dev.13 initial package detected with stale dev.12 README before user delivery; instructions corrected and final documented artifact rebuild required

### Quarantined paths

- dev.8 `CreateThread`-from-`DllMain` bootstrap: permanently quarantined; never use as production lifecycle.
- dev.9 default MSVC CRT startup pattern: not accepted as a zero-work baseline.
- No GTA world mutation is allowed until dev.13 proves the isolated C++ core boundary in the real game.

## Packaging / rollback

- [x] reproducible PowerShell runtime checkpoint packager — D3 Windows
- [x] package contains only project files; no third-party binaries
- [x] ASI SHA-256 recorded in `BUILD_INFO.txt`
- [x] Core DLL SHA-256 recorded in `BUILD_INFO.txt` from dev.13 onward
- [x] commit/version recorded in `BUILD_INFO.txt`
- [x] generated runtime ZIP extracted and required files verified in CI
- [x] first-test instructions packaged
- [x] explicit removal/rollback instructions packaged
- [x] dev.8 artifact upload
- [x] dev.9 artifact upload — run `33872399873`
- [x] dev.10 artifact upload — run `33873756374`
- [x] crash-capture tooling package — run `33875088958`
- [x] dev.11/dev.12 package rejects accidental test `ScriptHookV.dll` redistribution
- [x] dev.13 package requires `VOXModernCore.dll`
- [x] dev.13 synthetic artifact run `33881321657` fully green
- [ ] final dev.13 documented artifact rebuild with corrected README — IN PROGRESS
- [ ] installer/automatic root detection for later public builds

## Story compatibility foundation

- [ ] mission/story detector research — begins after dev.13 + persistence primitive
- [ ] detect mission-active state reliably
- [ ] Story Compatibility Manager skeleton
- [ ] canonical overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

Runtime checkpoints intentionally do not mutate story/world state.

## Asset pipeline

- [ ] identify on-screen asset → source resource proof — starts after dev.13 D4
- [ ] asset dependency locator
- [ ] export working copy
- [ ] Enhanced conversion validation
- [ ] non-destructive OpenRPF override package
- [ ] rollback/disable path
- [ ] automated before/after test package
- [ ] first in-game asset replacement D4

## Current checkpoint

**Checkpoint 0G — real GTA V Enhanced isolated C++ core bridge (`0.0.1-dev.13`)**

Already proven:

1. dev.12 real GTA ScriptHookV registration — PASS.
2. dev.12 real ScriptMain execution — PASS.
3. dev.12 real `scriptWait(0)` resume — PASS.
4. dev.12 real five heartbeats — PASS.
5. GTA stability during dev.12 checkpoint — PASS.
6. Windows/Linux core builds — PASS.
7. ASan + UBSan — PASS.
8. CRT-free minimal ASI boundary — PASS.
9. ScriptHook export-drift fallback regression — PASS.
10. `VOXModernCore.dll` build — PASS.
11. core DLL loaded only after ScriptMain resume in synthetic host — PASS.
12. `VOX_CORE_START` — PASS synthetic.
13. `VOX_CORE_ENTITY_ID=1` — PASS synthetic.
14. `VOX_CORE_BRIDGE_READY` — PASS synthetic.
15. five `VOX_CORE_TICK=n` markers — PASS synthetic.
16. ASI + Core package verification — PASS.
17. fake ScriptHookV excluded from package — PASS.

Required real dev.13 markers:
- `VOX_SCRIPT_MAIN_ENTER`
- `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`
- `VOX_CORE_START`
- `VOX_CORE_ENTITY_ID=1`
- `VOX_CORE_BRIDGE_READY`
- at least five `VOX_CORE_TICK=n`
- at least five `VOX_SCRIPT_HEARTBEAT`

Decision:
- **PASS:** implement Persistent Entity Registry + queued game-thread EventBus + first atomic state; begin asset locator/override tooling in parallel.
- **CRASH:** do not alter other plugins; collect WER evidence immediately.
- **CORE_LOAD_FAILED:** verify exact ASI/Core pair and core location before changing architecture.
