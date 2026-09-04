# Engineering Status

Validation levels are defined in `QUALITY_GATES.md`.

## Phase 0

| Capability | Status | Evidence / boundary |
|---|---|---|
| Project architecture | D1 | Architecture/TODO/roadmap/story contract/data model written and reviewed |
| Project-local development contract (`AGENT.md`) | D1 active | Continuous-checkpoint, blocker, traceability, packaging and ask-before-guessing rules recorded |
| C++20 standalone core scaffold | D3 cross-platform | Windows/Linux CI and sanitizer jobs pass |
| Core warnings policy | D3 cross-platform | warnings-as-errors CI passes |
| Win32 macro-isolation policy | D3 Windows | `NOMINMAX` globally applied after MSVC regression |
| Runtime file logger | D3 cross-platform | unit-tested in core CI; host callback logging active in dev.13 bridge |
| External crash capture tooling | D3 Windows tooling | WER setup/restore, collector smoke test, reproducible ZIP, run `33875088958` |
| Real GTA crash module/exception capture | D4 standby | use immediately if runtime instability returns |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | next core subsystem after dev.13 real bridge validation |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Queued/deferred game-thread EventBus adapter | D0 | follows Entity Registry + dev.13 bridge validation |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | strict positive/negative tests pass |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D4 execution evidence / D3 regression coverage | real dev.8 log reports `enhanced_probe=valid`; PE/AMD64 tests remain green |
| Windows executable version reader | D4 execution evidence / D3 regression coverage | real dev.8 log reports `1.0.1158.13`; MSVC tests pass |
| Epic/Steam/Rockstar auto-discovery | D0 | not implemented |
| dev.8 diagnostic ASI bootstrap | D4 initialization observed / **D4 stability failed** | free-thread-from-DllMain path permanently quarantined |
| dev.9 inert project-code ASI | D4 load observed / **D4 stability failed** | MSVC CRT startup imports remained |
| dev.10 no-CRT zero-import ASI | **D4 stable load baseline** | repeated normal launches reported after stale/intermittent startup sequence |
| dev.11 ScriptHookV lifecycle | D3 synthetic / D4 registration failed | exact historical export names were too brittle in real process |
| dev.12 ScriptHookV export fallback + game-thread execution | **D4 real GTA PASS** | user log proves registration, ScriptMain entry, `scriptWait(0)` resume and five heartbeats; GTA stable |
| Isolated `VOXModernCore.dll` bridge | **D3 Windows synthetic** | dev.13 loads core only after ScriptMain resume; Start/Tick + first EntityId handshake passes CI |
| dev.13 real core bridge execution | **D4 pending user test** | current checkpoint; still no GTA native/world mutation |
| Mission/story detector | D0 | begins after persistence primitive + dev.13 D4 |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | first vertical-slice pipeline starts in parallel after dev.13 D4 |
| Runtime checkpoint packaging/verification | D3 Windows | dev.13 packaging path includes ASI + Core and rejects fake ScriptHookV |
| Crash-capture packaging/verification | D3 Windows | run `33875088958` fully green |
| GitHub Windows/Linux CI | D3 | current jobs pass |
| ASan + UBSan CI | D3 | current sanitizer jobs pass |

## Real-game evidence so far

### dev.8
- ASI loader mapped VOX and the bootstrap reached exact `CHECKPOINT_OK` on Enhanced `1.0.1158.13`.
- GTA then crashed; the free-thread-from-DllMain design was quarantined.

### dev.9
- Explicit project work was removed, but normal MSVC CRT startup remained and the game still crashed.
- Binary inspection proved dev.9 was not a true zero-runtime baseline.

### dev.10
- Custom no-CRT `/NODEFAULTLIB` entrypoint proved a minimal loadable baseline.
- After the earlier remove/restore instability, repeated normal GTA launches were reported.

### dev.11
- ASI loaded and GTA stayed stable, but real ScriptHookV did not register VOX and no runtime log appeared.
- Root boundary was narrowed to brittle export-name resolution.

### dev.12 — first real active runtime
User-provided evidence proves all live scheduler gates:
- ASI loader maps `VOXModernOverhaul.asi`.
- ScriptHookV `v3889.0/1158.13` registers `VOXModernOverhaul.asi`.
- `VOX_SCRIPT_MAIN_ENTER` observed.
- `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` observed after `scriptWait(0)`.
- exactly five fresh `VOX_SCRIPT_HEARTBEAT` markers observed.
- GTA remains stable.

This promotes the ScriptHookV lifecycle to **D4 real-game validation**.

## dev.13 synthetic core-bridge evidence

### Architecture
- The ASI remains CRT-free and minimal.
- ScriptHookV registration still occurs from the validated ASI boundary.
- Only after ScriptMain enters and resumes does the ASI call `LoadLibraryW` for `VOXModernCore.dll`.
- The core is isolated behind `VoxHostApi` / `VoxCoreStart` / `VoxCoreTick` / `VoxCoreStop` plain-C ABI.
- The normal C++ core can therefore use the tested core library without moving CRT/static initialization back into the ASI loader callback.

### Synthetic proof — CI run `33881321657`
- Windows build/tests: PASS.
- Linux build/tests: PASS.
- ASan + UBSan: PASS.
- ASI PE/CRT boundary: PASS.
- ScriptHook export-drift fallback: PASS.
- ScriptHook registration + wait/resume: PASS.
- `VOXModernCore.dll` load + required exports: PASS.
- `VOX_CORE_START`: PASS.
- `VOX_CORE_ENTITY_ID=1`: PASS.
- `VOX_CORE_BRIDGE_READY`: PASS.
- five core ticks: PASS.
- package creation/content verification: PASS.

## Current promotion rule

`dev.13` becomes the production runtime/core foundation only when the real GTA test proves:

1. GTA V Enhanced remains stable;
2. dev.12 script markers still appear;
3. `VOX_CORE_START` appears;
4. `VOX_CORE_ENTITY_ID=1` appears;
5. `VOX_CORE_BRIDGE_READY` appears;
6. at least five `VOX_CORE_TICK=n` markers appear.

No persistent database, mission logic, GTA native mutation or world mutation is attached before this real D4 gate passes.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a synthetic pass is never reported as real GTA validation, and a parent system is not marked complete merely because one primitive exists.
