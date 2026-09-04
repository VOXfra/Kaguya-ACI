# Engineering Status

Validation levels are defined in `QUALITY_GATES.md`.

## Phase 0

| Capability | Status | Evidence / boundary |
|---|---|---|
| Project architecture | D1 | Architecture/TODO/roadmap/story contract/data model written and reviewed |
| Project-local development contract (`AGENT.md`) | D1 active | Continuous-checkpoint, blocker, traceability, packaging, ask-before-guessing and executable-installer-smoke rules recorded |
| C++20 standalone core scaffold | D3 cross-platform | Windows/Linux CI and sanitizer jobs pass |
| Core warnings policy | D3 cross-platform | warnings-as-errors CI passes |
| Win32 macro-isolation policy | D3 Windows | `NOMINMAX` globally applied after MSVC regression |
| Runtime host-callback diagnostics | D4 path / D3 subsystem | observed through real dev.13/dev.14 core execution |
| External crash capture tooling | D3 Windows tooling | WER setup/restore and evidence packaging validated; standby |
| `EntityId` / resumable generator | D3 cross-platform | validity/resume/exhaustion tests pass |
| Persistent Entity Registry | **D4 real GTA PASS / D3 regression** | dev.14 first launch creates system ID 1; second fresh launch restores same ID/count/high-water state |
| World-state schema v1 | **D4 real path / D3 regression** | real `world_state.v1` create→load path observed; strict round-trip/checksum tests pass |
| Atomic VOX world-state save | **D4 real path / D3 regression** | first real dev.14 launch reports `VOX_PERSISTENCE_SAVE_OK`; temp/flush/replace tested |
| Previous-state backup recovery | D3 cross-platform | corrupt primary recovers valid `.bak` in tests; real recovery event not forced |
| Persistent EntityId high-water restoration | **D4 real GTA PASS** | both dev.14 launches report EntityId 1, count 1, next ID 2 |
| EventBus | D3 cross-platform | normal/re-entrant/unsubscribe/concurrent tests pass |
| Bounded game-thread dispatch queue | **D4 real GTA PASS / D3 regression** | real dev.14 logs `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`; concurrency/bounds/failure isolation tested |
| GTA runtime handle ↔ EntityId adapter | D0 | next identity/runtime integration step |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | strict positive/negative tests pass |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D4 execution / D3 regression | real Enhanced `1.0.1158.13` identified |
| dev.8 bootstrap | D4 initialization / **stability failed** | free-thread-from-DllMain permanently quarantined |
| dev.9 inert project-code ASI | D4 load / **stability failed** | hidden CRT startup remained |
| dev.10 no-CRT ASI | **D4 stable load baseline** | repeated normal launches reported |
| dev.11 ScriptHookV lifecycle | D3 synthetic / **real registration failed** | exact decorated exports were brittle |
| dev.12 ScriptHookV game-thread execution | **D4 real GTA PASS** | registration, ScriptMain, wait/resume, five heartbeats |
| isolated `VOXModernCore.dll` bridge | **D4 real GTA PASS** | dev.13/dev.14 real logs prove core start/bridge/ticks |
| dev.14 persistent runtime | **D4 real GTA PASS** | real first launch NEW+SAVE_OK; second launch LOADED with same persistent identity; queue marker healthy |
| Mission/story detector | D0 | read-only work queued in parallel with visual track |
| Story Compatibility runtime | D0 | contract only |
| Visual installer environment/bootstrap | **D3 Windows executed PASS** | dev.15.1 CI run `33893214202` creates a fresh venv, queries Python 3.11.9, installs FiveFury 0.4.21 and runs Gen9 self-test through the actual packaged setup script |
| Enhanced asset locator / transform tooling | **D3 Windows synthetic IN PROGRESS** | FiveFury 0.4.21 Gen9 YDR rewrite + path-safety self-test passes; retail GTA archive scan/extract still D4 pending |
| RageOpenV loose override integration | **D2 implementation / D4 pending** | dev.15.1 maps base `x64*.rpf/...` to `newmods/platform/...`; real mount visibility pending |
| First visible graphics replacement | **D4 pending user test** | dev.15.1 current checkpoint; intentionally oversized common static prop |
| Runtime checkpoint packaging | D3 Windows | ASI+Core+visual tools required; fake ScriptHook/user state/YDR assets excluded; package version/readme checked |
| GitHub Windows/Linux CI | D3 | current jobs pass |
| ASan + UBSan CI | D3 | current sanitizer jobs pass |

## Real-game evidence

### dev.12 — first active runtime
Real GTA evidence proves ScriptHookV registration, ScriptMain entry, resume after `scriptWait(0)`, five heartbeats and stable launch.

### dev.13 — isolated C++ core bridge
Real GTA evidence proves `VOXModernCore.dll` start, bridge ready, five core ticks and continued scheduler health.

### dev.14 — first persistent world substrate
Two user-provided real-game logs prove the complete create/reload sequence.

First clean launch:
- `VOX_PERSISTENCE_STATUS=NEW`;
- `VOX_PERSISTENCE_SYSTEM_ENTITY_ID=1`;
- `VOX_PERSISTENCE_ENTITY_COUNT=1`;
- `VOX_PERSISTENCE_NEXT_ENTITY_ID=2`;
- `VOX_PERSISTENCE_SAVE_OK`;
- `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`;
- five core ticks + five ScriptHook heartbeats.

Second launch without deleting state:
- `VOX_PERSISTENCE_STATUS=LOADED`;
- the same system EntityId 1;
- the same entity count 1;
- the same next EntityId 2;
- game-thread queue marker remains healthy;
- core/ScriptHook ticks remain healthy;
- GTA remains stable.

This promotes the persistent Entity Registry, high-water restoration and live queue path to **D4 real-game validation**.

## dev.15.1 current visual checkpoint

### dev.15 real setup outcome
The first real dev.15 installer attempt failed after successfully creating `.venv-assets` but before dependency install/GTA scan. The failure was a PowerShell→Python quoting defect in the venv version query. It did **not** test or disprove the FiveFury retail scan, Gen9 transform or RageOpenV mount because execution never reached those stages.

### Corrected setup evidence
CI run `33893214202` executes the actual setup script's new `-EnvironmentOnly` path on Windows rather than only parsing it. A fresh venv is created; the script reports Python 3.11.9, installs FiveFury 0.4.21, runs `VOX_VISUAL_PROBE_SELF_TEST_OK` and exits with `VOX_VISUAL_ENVIRONMENT_SMOKE_OK`.

### Goal
Prove the first non-destructive Enhanced asset round trip in the user's actual installation:

`base x64*.rpf asset -> FiveFury index/extract -> Gen9 YDR render transform -> validate -> newmods/platform mirror -> RageOpenV -> visible GTA instance`.

### D4 promotion rule
`dev.15.1` becomes the first visible graphics-pipeline foundation only when the real GTA test proves:
1. corrected setup environment path completes;
2. setup report says `status=INSTALLED`;
3. source is a supported base `x64*.rpf` path;
4. generated file is installed under `newmods/platform`;
5. GTA remains stable;
6. a real streamed instance of the selected model visibly reflects the exaggerated geometry change;
7. rollback removes only the generated override and returns the model to vanilla appearance.

## Rule

A row advances only with evidence. A synthetic pass is never reported as real GTA validation, and one primitive never marks its parent system complete.
