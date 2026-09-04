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
| Runtime file logger / host callback | D4 path / D3 subsystem | host callback logging observed through dev.13 real core bridge; standalone logger tests pass |
| External crash capture tooling | D3 Windows tooling | WER setup/restore and evidence packaging validated; use if instability returns |
| `EntityId` primitive | D3 cross-platform | validity/order tests pass |
| `EntityIdGenerator` | D3 cross-platform | resume, zero reservation, max-ID and exhaustion tests pass |
| Persistent Entity Registry | **D3 cross-platform / D4 pending** | create/restore/duplicate/high-water tests pass; dev.14 real GTA validation pending |
| World-state schema v1 | **D3 cross-platform** | strict round-trip/validation/checksum tests pass |
| Atomic VOX world-state save | **D3 cross-platform** | temp+flush+atomic replace path tested on Windows/Linux |
| Previous-state backup recovery | **D3 cross-platform** | corrupt primary recovers valid `.bak` in tests |
| Persistent EntityId high-water restoration | **D3 cross-platform / D4 pending** | fresh-process synthetic runtime restores `next_entity_id=2`; real GTA pending |
| EventBus | D3 cross-platform | normal, re-entrant, unsubscribe and concurrent publish tests pass |
| Bounded game-thread dispatch queue | **D3 cross-platform / D4 pending** | concurrent producers, bounded drain, exception isolation, deferred re-entrant tasks pass; runtime marker synthetic PASS |
| GTA runtime handle ↔ EntityId adapter | D0 | next persistent-identity adapter after dev.14 real validation |
| Simulation tier primitive | D3 cross-platform | ordering invariant tested |
| Spatial Simulation Manager | D0 | not implemented |
| Versioned config parser | D3 cross-platform | strict positive/negative tests pass |
| Config migrations / typed runtime schema | D0 | not implemented |
| Enhanced explicit-root install probe | D4 execution / D3 regression | real dev.8 execution identified Enhanced `1.0.1158.13`; tests remain green |
| dev.8 diagnostic ASI bootstrap | D4 initialization / **stability failed** | free-thread-from-DllMain path permanently quarantined |
| dev.9 inert project-code ASI | D4 load / **stability failed** | hidden CRT startup remained |
| dev.10 no-CRT ASI | **D4 stable load baseline** | repeated normal launches reported |
| dev.11 ScriptHookV lifecycle | D3 synthetic / **real registration failed** | exact decorated export names too brittle |
| dev.12 ScriptHookV game-thread execution | **D4 real GTA PASS** | registration, ScriptMain, wait/resume and five heartbeats observed |
| isolated `VOXModernCore.dll` bridge | **D4 real GTA PASS** | dev.13 real log proves core start, bridge ready and five ticks |
| dev.14 persistent runtime | **D3 full synthetic / D4 pending** | two separate synthetic processes create then restore same persisted system entity/high-water state |
| Mission/story detector | D0 | read-only work begins in parallel after persistence checkpoint |
| Story Compatibility runtime | D0 | contract only |
| Asset locator / override pipeline | D0 | next major parallel track toward first visible graphics replacement |
| Runtime checkpoint packaging | D3 Windows | ASI+Core required, fake ScriptHook excluded, CI-generated state excluded |
| GitHub Windows/Linux CI | D3 | current jobs pass |
| ASan + UBSan CI | D3 | current sanitizer jobs pass |

## Real-game evidence

### dev.12 — first active runtime
Real GTA evidence proves:
- ScriptHookV registers `VOXModernOverhaul.asi`;
- `VOX_SCRIPT_MAIN_ENTER`;
- resume after `scriptWait(0)`;
- five ScriptHookV heartbeats;
- stable launch.

### dev.13 — first isolated C++ core bridge
Real GTA evidence proves:
- dev.12 scheduler markers remain healthy;
- `VOX_CORE_START`;
- `VOX_CORE_ENTITY_ID=1`;
- `VOX_CORE_BRIDGE_READY`;
- five `VOX_CORE_TICK=n` markers;
- GTA remains stable.

This promotes the split `minimal ASI -> ScriptHookV -> VOXModernCore.dll` architecture to **D4 real-game validation**.

## dev.14 synthetic persistence evidence

The current CI checkpoint validates the next layer without changing GTA gameplay:

1. core builds/tests on Windows and Linux;
2. ASan + UBSan;
3. registry create/restore/duplicate/high-water invariants;
4. strict world-state parse/serialize/checksum validation;
5. atomic save and previous-state `.bak` recovery;
6. concurrent/bounded/failure-isolated game-thread queue;
7. CRT-free ASI boundary retained;
8. first synthetic GTA process creates `world_state.v1` with system entity `1`, count `1`, next ID `2`;
9. second separate process restores the same ID/count/high-water values instead of recreating them;
10. package rejects generated user state.

Run `33885665383` passed all of the above before the documentation-only final rebuild.

## Current promotion rule

`dev.14` becomes the real persistent-world foundation only when the user's GTA test proves, across two launches:

1. GTA remains stable;
2. first clean launch reports `VOX_PERSISTENCE_STATUS=NEW` and `VOX_PERSISTENCE_SAVE_OK`;
3. `VOXModernOverhaul/state/world_state.v1` is created;
4. first launch reports system EntityId `1`, entity count `1`, next EntityId `2`;
5. second launch, without deleting state, reports `VOX_PERSISTENCE_STATUS=LOADED`;
6. second launch reports the same ID/count/high-water values;
7. `VOX_GAME_THREAD_QUEUE_DISPATCHED=1` appears;
8. the already validated core/ScriptHookV tick markers remain healthy.

No persistent NPC binding, mission mutation, GTA native mutation or world mutation is claimed until its own gate passes.

## Rule

A row advances only with evidence. A synthetic pass is never reported as real GTA validation, and one primitive never marks its parent system complete.
