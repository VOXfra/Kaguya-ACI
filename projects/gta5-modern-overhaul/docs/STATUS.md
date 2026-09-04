# Engineering Status

Validation levels are defined in `QUALITY_GATES.md`.

## Phase 0

| Capability | Status | Evidence / boundary |
|---|---|---|
| Project architecture | D1 | Architecture/TODO/roadmap/story contract/data model written and reviewed |
| C++20 standalone core scaffold | D3 cross-platform | GitHub CI run 33864368881 succeeded on Windows/Linux plus sanitizer job |
| Core warnings policy | D3 cross-platform | warnings-as-errors CI succeeded |
| Runtime file logger | D3 cross-platform | unit-tested in core CI; crash capture still separate |
| Crash diagnostics | D0 | not implemented |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | not implemented |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 Linux / CI pending latest commit | strict schema/duplicate/type failure tests pass locally with sanitizers |
| Config migrations / typed runtime schema | D0 | not implemented |
| GTA V Enhanced install/build detector | D0 | not implemented |
| Native ScriptHookV runtime adapter | D0 | not implemented |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Automated package/install/rollback | D0 | not implemented |
| GitHub Windows/Linux CI | D3 | run 33864368881 conclusion: success |
| ASan + UBSan CI | D3 | run 33864368881 conclusion: success |

## Current local validation facts

- GNU C++ 14.2.0
- C++20
- warnings treated as errors
- AddressSanitizer
- UndefinedBehaviorSanitizer
- 4 concurrent publisher threads × 1000 EventBus publications
- strict versioned-config negative tests
- CTest: 1/1 passing

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, and a successful standalone test is never reported as GTA V Enhanced validation.
