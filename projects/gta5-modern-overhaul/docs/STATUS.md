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
| Runtime file logger | D3 cross-platform | unit-tested in core CI; crash capture still separate |
| Crash diagnostics | D0 | no minidump/exception-code capture yet; real dev.8 crash recorded from user logs |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | D0 | not implemented |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | strict positive/negative tests pass |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D4 execution evidence / D3 regression coverage | real dev.8 log reports `enhanced_probe=valid`; PE/AMD64 tests remain green |
| Windows executable version reader | D4 execution evidence / D3 regression coverage | real dev.8 log reports `1.0.1158.13`; MSVC tests pass |
| Epic/Steam/Rockstar auto-discovery | D0 | not implemented |
| dev.8 diagnostic ASI bootstrap | D4 initialization observed / **D4 stability failed** | real game reached `CHECKPOINT_OK`, then crashed; architecture quarantined |
| dev.9 inert ASI isolation | D3 Windows runtime-smoke | run `33872399873`: inert ASI load/residency/unload PASS; real GTA stability pending |
| ScriptHookV native/game-thread adapter | D0 | not implemented; preferred replacement if dev.9 is stable |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Checkpoint ZIP packaging/verification | D3 Windows | dev.9 package built, extracted, verified and uploaded in run `33872399873` |
| Real GTA V Enhanced inert-ASl stability | D4 pending user test | next required evidence |
| GitHub Windows/Linux CI | D3 | dev.9 run `33872399873` PASS |
| ASan + UBSan CI | D3 | dev.9 run `33872399873` PASS |

## dev.8 real-game evidence

User-provided logs from 2026-09-04 show:

- ASI loader loaded `RageOpenV.asi`, `ScriptHookVDotNet.asi`, `TrainerV.asi`, then `VOXModernOverhaul.asi`.
- ScriptHookV initialized successfully and identified `VER_EN_1_0_1158_13`.
- VOX bootstrap resolved `E:\\Jeux Epic\\GTAVEnhanced\\GTA5_Enhanced.exe`.
- Enhanced executable probe returned `valid`.
- File version read returned `1.0.1158.13`.
- `dinput8.dll` and `ScriptHookV.dll` were detected.
- config parsed with `diagnostic_bootstrap_enabled=true`.
- exact `CHECKPOINT_OK` marker was written.
- the user reports the game then crashed.

These logs do **not** contain an exception code, stack trace or crash module, so they prove execution order but not the exact crashing instruction/module.

## dev.9 automated evidence

Exact implementation commit: `818376c8c3a3a8afaa2499ee44225ab68850b266`.
GitHub Actions run: `33872399873`.

- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- Linux ASan + UBSan: PASS.
- inert Windows x64 ASI build: PASS.
- inert ASI synthetic load/residency/unload: PASS.
- GTA-ready ZIP package: PASS.
- package required-file verification: PASS.
- artifact upload: PASS.

## Current hypothesis boundary

The previous `CreateThread`-from-`DllMain` bootstrap is the leading architecture-level suspect because it is the largest difference between dev.8 and the inert dev.9, but this is **not yet proven as root cause**. Real GTA stability of dev.9 is required before rejecting it conclusively.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a successful standalone/synthetic test is never reported as real GTA V Enhanced validation, and a parent system is not marked complete merely because one primitive exists.
