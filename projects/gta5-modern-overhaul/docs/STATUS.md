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
| Crash diagnostics | D0 | no minidump/exception-code capture yet; dev.8/dev.9 real crashes recorded from adjacent logs only |
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
| dev.8 diagnostic ASI bootstrap | D4 initialization observed / **D4 stability failed** | real game reached `CHECKPOINT_OK`, then crashed |
| dev.9 inert project-code ASI | D4 load observed / **D4 stability failed** | real game still crashed; later binary inspection found MSVC CRT imports remained |
| dev.10 no-CRT zero-import ASI | D3 Windows binary/runtime-smoke | run `33873756374`: zero Import/TLS directories + synthetic load PASS; real GTA stability pending |
| ScriptHookV native/game-thread adapter | D0 | not implemented; bootstrap-via-free-thread path remains rejected/quarantined |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Checkpoint ZIP packaging/verification | D3 Windows | dev.10 package built, extracted, verified and uploaded |
| First stable GTA V Enhanced runtime | D4 pending | dev.10 is current real-game isolation checkpoint |
| GitHub Windows/Linux CI | D3 | dev.10 run `33873756374` PASS |
| ASan + UBSan CI | D3 | dev.10 run `33873756374` PASS |

## Real-game evidence so far

### dev.8
- ASI loader loaded `VOXModernOverhaul.asi` after RageOpenV, ScriptHookVDotNet and TrainerV.
- ScriptHookV initialized successfully as `VER_EN_1_0_1158_13`.
- VOX bootstrap resolved the real Enhanced executable, validated it, read `1.0.1158.13`, parsed config and wrote `CHECKPOINT_OK`.
- User reports the game then crashed.

### dev.9
- Project `DllMain` body was reduced to an immediate success return and no explicit project logic.
- User reports the game still crashed.
- ASI loader again confirms `VOXModernOverhaul.asi` was loaded; ScriptHookV and RageOpenV startup logs show success.
- Exact `dev.9` binary inspection shows imports from `VCRUNTIME140.dll` and `api-ms-win-crt-runtime-l1-1-0.dll`, including CRT initialization/termination functions.
- Therefore `dev.9` eliminated project application logic but did **not** eliminate compiler/runtime startup.

## dev.10 automated evidence

Exact package commit: `a193e307a443e491f13e6576f8ea18896f91945c`.
GitHub Actions run: `33873756374`.

- Windows/MSVC core build + tests: PASS.
- Linux core build + tests: PASS.
- Linux ASan + UBSan: PASS.
- no-CRT Windows x64 ASI build: PASS.
- PE32+ custom entrypoint: PASS.
- Import Directory RVA/size = 0: PASS.
- TLS Directory RVA/size = 0: PASS.
- synthetic no-CRT ASI load/residency/unload: PASS.
- GTA-ready ZIP package + required-file verification: PASS.
- independent downloaded-binary inspection also shows Import Directory, IAT, TLS and Load Configuration directories all zero.

Package hashes:
- ASI: `c77d3c2b43081fadf05165155a032f154189f8a3fec8406a81266ee3101fc63b`
- inner GTA-ready ZIP: `6ba7a17a3c7958cff0224b29895a8408bbf480e3b47dc7e59c7f99a33fcb1d6a`
- outer Actions artifact digest: `sha256:09e7212f37e6ebedca7e7ada9be9e4805984ec352fa7238e7d59c21a47087cb2`

## Current hypothesis boundary

No root cause is declared yet.

`dev.8` eliminated gameplay/native/memory mutation as a prerequisite for the crash.
`dev.9` eliminated the project's explicit bootstrap/application logic, but not MSVC CRT startup.
`dev.10` eliminates default-library/CRT imports as well.

If dev.10 still crashes in the real game, the investigation must move below application and CRT startup into ASI image/loader/plugin-coexistence behavior and external crash capture. Do not keep changing application logic at that point.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a successful standalone/synthetic test is never reported as real GTA V Enhanced validation, and a parent system is not marked complete merely because one primitive exists.
