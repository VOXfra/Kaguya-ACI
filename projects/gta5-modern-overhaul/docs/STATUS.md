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
| Runtime file logger | D3 cross-platform | unit-tested in core CI; runtime use remains blocked by loader isolation |
| External crash capture tooling | D3 Windows tooling | WER setup/restore, collector smoke test, reproducible ZIP, run `33875088958` |
| Real GTA crash module/exception capture | D4 pending | current checkpoint; no real minidump/event diagnosis received yet |
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
| dev.9 inert project-code ASI | D4 load observed / **D4 stability failed** | real game still crashed; MSVC CRT imports later found |
| dev.10 no-CRT zero-import ASI | D4 load observed / **D4 stability failed** | real game still crashes despite zero import/IAT/TLS and no project/game logic |
| Controlled baseline without VOX ASI | D4 pending | exact other plugin set must remain unchanged |
| ScriptHookV native/game-thread adapter | D0 blocked | do not implement until loader/crash layer is identified |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Runtime checkpoint packaging/verification | D3 Windows | dev.10 package built, extracted, verified and uploaded |
| Crash-capture packaging/verification | D3 Windows | final run `33875088958` fully green |
| First stable GTA V Enhanced runtime | D4 blocked | baseline + crash evidence required first |
| GitHub Windows/Linux CI | D3 | current core jobs continue to pass |
| ASan + UBSan CI | D3 | current sanitizer jobs continue to pass |

## Real-game evidence so far

### dev.8
- ASI loader loaded `VOXModernOverhaul.asi` after RageOpenV, ScriptHookVDotNet and TrainerV.
- ScriptHookV initialized successfully as `VER_EN_1_0_1158_13`.
- VOX bootstrap resolved the real Enhanced executable, validated it, read `1.0.1158.13`, parsed config and wrote `CHECKPOINT_OK`.
- User reports the game then crashed.

### dev.9
- Project `DllMain` body was reduced to immediate success and no explicit project logic.
- User reports the game still crashed.
- Exact binary inspection showed remaining MSVC CRT/VCRUNTIME startup imports, so dev.9 did not isolate compiler-runtime startup.

### dev.10
- Built with custom no-CRT entrypoint and `/NODEFAULTLIB`.
- Independent inspection: Import Directory = 0, IAT = 0, TLS = 0, Load Configuration = 0; `.text` only contains the tiny success-return path.
- User reports the game still crashes.
- `asiloader(2).log` confirms `VOXModernOverhaul.asi` was mapped successfully after the same other ASIs.
- `ScriptHookV(2).log` reports successful initialization for `VER_EN_1_0_1158_13`.
- `RageOpenV(2).log` reports successful initialization.
- These logs still do not identify the faulting module or exception.

## Crash-capture tooling evidence

Exact final tooling commit: `226000bb45da0dfe4fc976617731a866b3466b18`.
GitHub Actions run: `33875088958`.

- PowerShell parser validation: PASS.
- Fake-GTA evidence collector smoke test: PASS.
- Reproducible package build: PASS.
- Package extraction/content verification: PASS.
- Artifact upload: PASS.
- User ZIP SHA-256: `30414e69d05283d8f326b289b38c87d372faf1e0d9588ad1604cabd4911ed27a`.

Two tooling defects were caught before delivery:

1. `Compress-Archive -LiteralPath` was incorrectly used with a wildcard; fixed to wildcard-capable `-Path`.
2. `Copy-Item -LiteralPath` was incorrectly used with a wildcard in the packager; fixed to `-Path`.

Both fixes are now exercised by CI smoke tests.

## Current hypothesis boundary

No root cause is declared yet.

- dev.8 eliminated gameplay/native/memory mutation as a prerequisite.
- dev.9 eliminated explicit project application logic, but not CRT startup.
- dev.10 eliminated CRT/default-library imports as well and still crashes.

Therefore the next discriminator is **not another runtime build**. It is:

1. run an otherwise identical modded GTA V Enhanced baseline with only `VOXModernOverhaul.asi` renamed/disabled;
2. capture WER event/minidump evidence on failure;
3. if baseline is stable, restore exact dev.10 and capture its crash;
4. identify faulting module/exception/offset before changing architecture again.

Potential layers still open include ASI image/loader behavior, plugin coexistence, unrelated mod/environment instability, or host-side interaction that adjacent text logs cannot reveal.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a successful standalone/synthetic test is never reported as real GTA V Enhanced validation, and a parent system is not marked complete merely because one primitive exists.
