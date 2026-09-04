# Engineering Status

Validation levels are defined in `QUALITY_GATES.md`.

Last manually validated source state before this status update: `fcdf31acb94f70a95fba4e8948fe871a7f742245` plus the pending CI-hardening changes described below.

## Phase 0

| Capability | Status | Evidence / boundary |
|---|---|---|
| Project architecture | D1 | Architecture/TODO/roadmap/story contract/data model written and reviewed |
| C++20 standalone core scaffold | D3 Linux | GCC 14.2 configure/build/link/CTest pass |
| Core warnings policy | D3 Linux | `-Wall -Wextra -Wpedantic -Werror` validation passes locally |
| Runtime file logger | D3 Linux | creates parent path, opens, writes and test verifies output |
| Crash diagnostics | D0 | not implemented |
| `EntityId` primitive | D3 Linux | validity/order tests pass |
| `EntityIdGenerator` | D3 Linux | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | not implemented |
| EventBus | D3 Linux | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Simulation tier primitive | D3 Linux | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config | D0 | not implemented |
| GTA V Enhanced install/build detector | D0 | not implemented |
| Native ScriptHookV runtime adapter | D0 | not implemented |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Automated package/install/rollback | D0 | not implemented |
| GitHub Windows/Linux CI | D1/D2 pending | workflow exists; successful final run must still be observed |
| ASan + UBSan CI | D1/D2 pending | workflow job added; successful final run must still be observed |

## Current validation facts

Local isolated test environment:

- GNU C++ 14.2.0
- C++20
- warnings treated as errors
- AddressSanitizer
- UndefinedBehaviorSanitizer
- 4 concurrent publisher threads × 1000 EventBus publications
- CTest: 1/1 passing

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, and a successful standalone test is never reported as GTA V Enhanced validation.
