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
| Runtime file logger | D3 cross-platform | unit-tested in core CI; production runtime logger not connected yet |
| External crash capture tooling | D3 Windows tooling | WER setup/restore, collector smoke test, reproducible ZIP, run `33875088958` |
| Real GTA crash module/exception capture | D4 standby | not needed on latest stable launches; use immediately if instability returns |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | next core subsystem after dev.11 real-game validation |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Queued/deferred game-thread EventBus adapter | D0 | follows Entity Registry / live game-thread proof |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | strict positive/negative tests pass |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D4 execution evidence / D3 regression coverage | real dev.8 log reports `enhanced_probe=valid`; PE/AMD64 tests remain green |
| Windows executable version reader | D4 execution evidence / D3 regression coverage | real dev.8 log reports `1.0.1158.13`; MSVC tests pass |
| Epic/Steam/Rockstar auto-discovery | D0 | not implemented |
| dev.8 diagnostic ASI bootstrap | D4 initialization observed / **D4 stability failed** | free-thread-from-DllMain path permanently quarantined |
| dev.9 inert project-code ASI | D4 load observed / **D4 stability failed** | MSVC CRT startup imports remained |
| dev.10 no-CRT zero-import ASI | **D4 stable load baseline** | after stale/intermittent startup sequence, user reports repeated normal launches with unchanged installation |
| ScriptHookV game-thread ABI boundary | **D3 Windows synthetic** | dev.11 resolves current x64 `scriptRegister`/`scriptWait`; fake ABI + registration + wait/resume + five-heartbeat smoke PASS |
| dev.11 real ScriptHookV game-thread execution | **D4 pending user test** | current checkpoint; no GTA native/world mutation |
| Mission/story detector | D0 | gated until dev.11 real-game validation |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only; first vertical-slice pipeline follows runtime core |
| Runtime checkpoint packaging/verification | D3 Windows | dev.11 packaging path passes synthetic workflow |
| Crash-capture packaging/verification | D3 Windows | run `33875088958` fully green |
| First stable GTA V Enhanced load path | **D4 stable baseline** | dev.10 now launches normally/repeatably per user validation |
| GitHub Windows/Linux CI | D3 | current core jobs pass |
| ASan + UBSan CI | D3 | current sanitizer jobs pass |

## Real-game evidence so far

### dev.8
- ASI loader loaded `VOXModernOverhaul.asi` after RageOpenV, ScriptHookVDotNet and TrainerV.
- ScriptHookV initialized successfully as `VER_EN_1_0_1158_13`.
- VOX bootstrap resolved the real Enhanced executable, validated it, read `1.0.1158.13`, parsed config and wrote `CHECKPOINT_OK`.
- The game then crashed; the free-thread bootstrap was rejected rather than extended.

### dev.9
- Project `DllMain` body was reduced to immediate success and no explicit project logic.
- The game still crashed.
- Exact binary inspection showed remaining MSVC CRT/VCRUNTIME startup imports, so dev.9 did not isolate compiler-runtime startup.

### dev.10
- Built with custom no-CRT entrypoint and `/NODEFAULTLIB`.
- Independent inspection proved Import Directory = 0, IAT = 0, TLS = 0 and no project/game logic.
- Initial attempts crashed after ASI mapping, then a remove/restore cycle produced successful launches.
- User subsequently reports the game now launches normally with the same dev.10 baseline.
- Classification is therefore promoted from provisional to a stable **load baseline**, while the exact cause of the earlier intermittent failures remains unknown.
- External WER capture remains available if the instability returns.

## dev.11 synthetic game-thread evidence

### Runtime design
- Custom CRT-free ASI entrypoint retained.
- ASI directly imports only the required Kernel32 boundary.
- No CRT, C++ runtime, TLS or direct `ScriptHookV.dll` import is accepted by CI.
- `GetModuleHandleW` obtains only an already-loaded ScriptHookV module; the ASI does not call `LoadLibrary` from the loader callback.
- Current ScriptHookV x64 decorated `scriptRegister` and `scriptWait` exports are resolved dynamically.
- Repeated runtime work occurs only from the registered ScriptMain context.

### Scheduler proof
The test-only fake ScriptHookV and host require four independent gates:
1. exact ABI exports exist;
2. loading the ASI actually calls `scriptRegister`;
3. the registered `ScriptMain` executes;
4. execution returns after `scriptWait(0)` and then produces five scheduled heartbeats.

All four gates pass in the latest synthetic checkpoint path.

### Defects caught while building dev.11
- MSVC `/WX` caught duplicate `NOMINMAX` definitions in new test targets; local duplicates were removed and the shared build-level definition remains authoritative.
- The custom PE entrypoint was unnecessarily exported, causing linker warning debt; the export annotation was removed while `/ENTRY:VoxDllEntry` remains authoritative.
- Runtime PE verification initially assumed `dumpbin.exe` was on PATH. It is now resolved through `vswhere` and the actual x64 MSVC toolchain.
- Initial fake ScriptHookV C++ name mangling did not match the real SDK ABI string. The fake now pins explicit linker export aliases, so tests do not depend on compiler-version mangling.
- The staged smoke host was upgraded from a generic heartbeat timeout to explicit failure stages for ABI export, registration, ScriptMain execution, wait/resume and heartbeat count.

## Current promotion rule

`dev.11` becomes the first usable live runtime foundation only when the real GTA test proves:

1. GTA V Enhanced remains stable;
2. `VOXModernOverhaul/runtime_game_thread.log` contains `VOX_SCRIPT_MAIN_ENTER`;
3. it contains `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`;
4. it contains five fresh `VOX_SCRIPT_HEARTBEAT` lines.

No GTA natives, persistence, mission logic or world mutation are attached before this real D4 gate passes.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a successful standalone/synthetic test is never reported as real GTA V Enhanced validation, and a parent system is not marked complete merely because one primitive exists.
