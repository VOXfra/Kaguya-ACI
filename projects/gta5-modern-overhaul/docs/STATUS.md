# Engineering Status

Validation levels are defined in `QUALITY_GATES.md`.

## Phase 0

| Capability | Status | Evidence / boundary |
|---|---|---|
| Project architecture | D1 | Architecture/TODO/roadmap/story contract/data model written and reviewed |
| Project-local development contract (`AGENT.md`) | D1 active | Continuous-checkpoint, blocker, traceability, packaging and ask-before-guessing rules recorded |
| C++20 standalone core scaffold | D3 cross-platform | Windows/Linux CI and sanitizer jobs pass |
| Core warnings policy | D3 cross-platform | warnings-as-errors CI passes |
| Win32 macro-isolation policy | D3 Windows | `NOMINMAX` globally applied after MSVC regression; exact checkpoint CI passes |
| Runtime file logger | D3 cross-platform | unit-tested in core CI; crash capture still separate |
| Crash diagnostics | D0 | not implemented |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | not implemented |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | strict positive/negative tests; exact checkpoint CI remains green |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D3 cross-platform | PE/AMD64 fixture tests pass on run `33865763371` |
| Windows executable version reader | D3 Windows | MSVC build/test passes; used by synthetic runtime smoke |
| Epic/Steam/Rockstar auto-discovery | D0 | not implemented |
| Diagnostic ASI bootstrap | D3 Windows runtime-smoke | real generated ASI loaded by synthetic x64 `gta5_enhanced.exe` and emitted `CHECKPOINT_OK`; real GTA D4 pending |
| ScriptHookV native/game-thread adapter | D0 | no ScriptHook native calls yet |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Checkpoint ZIP packaging/verification | D3 Windows | reproducible ZIP built, extracted, required files verified and uploaded in run `33865763371` |
| Real GTA V Enhanced bootstrap load | D4 pending user test | requires real-game `bootstrap.log` evidence |
| GitHub Windows/Linux CI | D3 | checkpoint run `33865763371` core jobs PASS |
| ASan + UBSan CI | D3 | checkpoint run `33865763371` sanitizer job PASS |

## Current validation facts

- C++20.
- Warnings treated as errors.
- Windows/MSVC and Linux builds/tests pass for the checkpoint source.
- AddressSanitizer + UndefinedBehaviorSanitizer pass on Linux core.
- 4 concurrent publisher threads × 1000 EventBus publications pass.
- Strict versioned-config positive/negative tests pass.
- Enhanced install probe negative/positive PE fixtures pass.
- Windows version API integration compiles/tests under MSVC.
- Generated `VOXModernOverhaul.asi` loads successfully inside the synthetic x64 Enhanced-named smoke host.
- ASI bootstrap reaches the exact `CHECKPOINT_OK` marker in smoke validation.
- Checkpoint ZIP is generated and structurally verified before artifact upload.

## Current boundary

The next validation gate is physical GTA V Enhanced execution. Until the user's real `gta5_enhanced.exe` loads the ASI and returns the expected bootstrap log, the diagnostic ASI remains D3 rather than D4.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a successful standalone/synthetic test is never reported as real GTA V Enhanced validation, and a parent system is not marked complete merely because one primitive exists.
