# Engineering Status

Validation levels are defined in `QUALITY_GATES.md`.

## Phase 0

| Capability | Status | Evidence / boundary |
|---|---|---|
| Project architecture | D1 | Architecture/TODO/roadmap/story contract/data model written and reviewed |
| C++20 standalone core scaffold | D3 cross-platform | Windows/Linux CI and sanitizer jobs pass |
| Core warnings policy | D3 cross-platform | warnings-as-errors CI passes |
| Runtime file logger | D3 cross-platform | unit-tested in core CI; crash capture still separate |
| Crash diagnostics | D0 | not implemented |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | not implemented |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | exact commit `58cec3c...`; CI run `33864582553` success |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D3 local / CI pending | PE signature + AMD64 validation passes local ASan/UBSan/Werror tests |
| Windows executable version reader | D1 / CI pending | implementation complete; MSVC + native API test required |
| Epic/Steam/Rockstar auto-discovery | D0 | not implemented |
| Native ScriptHookV runtime adapter | D0 | not implemented |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Automated package/install/rollback | D0 | not implemented |
| GitHub Windows/Linux CI | D3 | config run `33864582553` conclusion: success |
| ASan + UBSan CI | D3 | config run `33864582553` conclusion: success |

## Current validation facts

- GNU C++ 14.2.0 local validation
- C++20
- warnings treated as errors
- AddressSanitizer
- UndefinedBehaviorSanitizer
- 4 concurrent publisher threads × 1000 EventBus publications
- strict versioned-config positive/negative tests
- Enhanced install probe negative/positive PE fixtures
- Windows/MSVC + Linux CI green through exact config commit

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, and a successful standalone test is never reported as GTA V Enhanced validation.
