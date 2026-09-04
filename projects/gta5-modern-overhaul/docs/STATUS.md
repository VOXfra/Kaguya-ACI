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
| Runtime file logger | D3 cross-platform | unit-tested in core CI; production runtime use deferred until stable loader path |
| External crash capture tooling | D3 Windows tooling | WER setup/restore, collector smoke test, reproducible ZIP, run `33875088958` |
| Real GTA crash module/exception capture | D4 standby | not yet captured; keep tooling available if intermittent crash returns |
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
| dev.9 inert project-code ASI | D4 load observed / **D4 stability failed** | real game crashed; MSVC CRT imports later found |
| dev.10 no-CRT zero-import ASI | **D4 provisional** | earlier attempts crashed, but remove/restore cycle produced a successful real-game load; repeatability not yet proven |
| Controlled baseline without VOX ASI | D4 partial/manual | user removed VOX and then restored it; exact baseline duration/result not sufficiently documented to call it a completed controlled comparison |
| ScriptHookV native/game-thread adapter | D0 gated | begin only after repeatable dev.10 stability; free-thread bootstrap remains rejected |
| Mission/story detector | D0 | not implemented |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | tool research only |
| Runtime checkpoint packaging/verification | D3 Windows | dev.10 package built, extracted, verified and uploaded |
| Crash-capture packaging/verification | D3 Windows | final run `33875088958` fully green |
| First stable GTA V Enhanced runtime | **D4 provisional** | one successful dev.10 real-game load observed; multiple launches/sustained runtime required |
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

### dev.10 — failed attempts
- Built with custom no-CRT entrypoint and `/NODEFAULTLIB`.
- Independent inspection: Import Directory = 0, IAT = 0, TLS = 0, Load Configuration = 0; `.text` only contains the tiny success-return path.
- Initial real-game attempts crashed after successful ASI mapping.
- `asiloader(2).log`, `ScriptHookV(2).log` and `RageOpenV(2).log` showed successful loader/framework initialization but no faulting module.

### dev.10 — later successful load
- User manually removed the VOX plugin and then restored/re-added it.
- On the subsequent launch the user reports GTA V Enhanced appears to have loaded successfully.
- `asiloader(3).log` shows `VOXModernOverhaul.asi` mapped successfully and loader enumeration completed.
- `ScriptHookV(3).log` again reports successful `VER_EN_1_0_1158_13` initialization.
- `RageOpenV(3).log` again reports successful initialization.
- This is real D4 execution evidence, but one successful run after previous intermittent failures is not enough to declare the loader path stable.

## Crash-capture tooling evidence

Exact final tooling commit: `226000bb45da0dfe4fc976617731a866b3466b18`.
GitHub Actions run: `33875088958`.

- PowerShell parser validation: PASS.
- Fake-GTA evidence collector smoke test: PASS.
- Reproducible package build: PASS.
- Package extraction/content verification: PASS.
- Artifact upload: PASS.
- User ZIP SHA-256: `30414e69d05283d8f326b289b38c87d372faf1e0d9588ad1604cabd4911ed27a`.

## Current hypothesis boundary

No root cause is declared.

The latest successful load means dev.10 itself is capable of coexisting with the user's current loader/plugin stack in real GTA V Enhanced. That materially weakens any hypothesis that the dev.10 PE image is deterministically incompatible.

Remaining plausible categories include:

- transient loader/plugin coexistence timing/state;
- stale or partially replaced plugin file during earlier runs;
- unrelated host/mod instability correlated with testing;
- another environmental condition not visible in adjacent text logs.

The next discriminator is repeatability, not another architecture rewrite.

## Promotion rule for stable D4

Promote the ASI load path from provisional to stable only after:

1. the exact dev.10 file loads successfully across repeated cold launches without other plugin changes;
2. Story Mode/free roam remains alive for a meaningful sustained interval;
3. at least one clean normal exit/relaunch cycle succeeds;
4. if any crash recurs, WER/minidump evidence is collected before changing code.

Only then proceed to ScriptHookV/game-thread integration and one safe in-game tick.

## Rule

A row only advances when evidence exists. A design document is never reported as runtime functionality, a successful standalone/synthetic test is never reported as real GTA V Enhanced validation, and a parent system is not marked complete merely because one primitive exists.
