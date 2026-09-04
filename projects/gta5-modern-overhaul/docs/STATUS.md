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
| Persistent EntityId high-water restoration | **D4 real GTA PASS** | dev.14 two-launch test restored EntityId 1/count 1/next ID 2; later intentional deletion simply created a new empty early-state file |
| EventBus | D3 cross-platform | normal/re-entrant/unsubscribe/concurrent tests pass |
| Bounded game-thread dispatch queue | **D4 real GTA PASS / D3 regression** | real dev.14/dev.15.1 logs `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`; concurrency/bounds/failure isolation tested |
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
| isolated `VOXModernCore.dll` bridge | **D4 real GTA PASS** | dev.13/dev.14/dev.15.1 real logs prove core start/bridge/ticks |
| dev.14 persistent runtime | **D4 real GTA PASS** | real first launch NEW+SAVE_OK; second launch LOADED with same persistent identity; queue marker healthy |
| Mission/story detector | D0 | read-only work queued in parallel with visual track |
| Story Compatibility runtime | D0 | contract only |
| Visual installer environment/bootstrap | **D4 real setup PASS / D3 Windows regression** | dev.15.1 real machine completes venv/FiveFury/self-test/retail scan; CI executes exact bootstrap path |
| Enhanced retail asset locator/extraction | **D4 real PASS** | dev.15.1 real scan selected and extracted `prop_roadcone02a` from base `x64f.rpf` |
| Gen9 YDR transform tooling | **D3 synthetic / real runtime compatibility FAILED OR UNPROVEN** | FiveFury synthetic rewrite validates, but the first real transformed YDR is associated with Story Mode crash and is not trusted |
| RageOpenV `newmods/platform` mount integration | **D4 crash-isolation pending** | real loose override exists at expected path, but Story Mode crashes; source-identical override test is now required to separate mount from YDR writer |
| First visible graphics replacement | **D4 FAILED / blocked on isolation** | dev.15.1 never reached a stable visible frame; Story Mode crashes immediately after transformed override installation |
| Byte-identical override isolation | **D3 Windows synthetic / D4 pending** | dev.15.2 replaces active transformed file with exact source bytes at same path using manifest/hash ownership |
| Runtime checkpoint packaging | D3 Windows | ASI+Core+visual tools required; fake ScriptHook/user state/YDR assets excluded; package version/readme checked |
| GitHub Windows/Linux CI | D3 | current jobs pass when final checkpoint CI is green |
| ASan + UBSan CI | D3 | current sanitizer jobs pass |

## Real-game evidence

### dev.12 — first active runtime
Real GTA evidence proves ScriptHookV registration, ScriptMain entry, resume after `scriptWait(0)`, five heartbeats and stable launch.

### dev.13 — isolated C++ core bridge
Real GTA evidence proves `VOXModernCore.dll` start, bridge ready, five core ticks and continued scheduler health.

### dev.14 — first persistent world substrate
Two user-provided real-game logs prove the complete create/reload sequence. Persistent Entity Registry, high-water restoration and live queue path are D4.

### dev.15.1 — installer/scan pass, visual runtime crash
Real setup output proves:
- Python 3.11.4 environment runs;
- FiveFury 0.4.21 installs;
- `VOX_VISUAL_PROBE_SELF_TEST_OK`;
- real Enhanced archive scan completes;
- selected model is `prop_roadcone02a`;
- source is `x64f.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr`;
- loose override is installed at `newmods/platform/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr`.

The subsequent game attempt crashes immediately entering Story Mode.

The returned logs prove before crash:
- ASI loader finishes loading RageOpenV, SHVDN, TrainerV and VOX;
- ScriptHookV identifies `VER_EN_1_0_1158_13` and registers VOX;
- VOX reaches `VOX_PERSISTENCE_SAVE_OK`, `VOX_CORE_RUNTIME_READY`, `VOX_CORE_BRIDGE_READY`, `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`, five Core ticks and five ScriptHook heartbeats;
- RageOpenV release log only reports successful initialization.

Conclusion: the visual checkpoint is a **real D4 failure**. Existing evidence does not prove whether the crash is caused by RageOpenV/newmods routing or by the FiveFury-rebuilt retail YDR.

## dev.15.2 current crash-isolation checkpoint

### Goal
Keep the exact same loose override path but replace its transformed bytes with the exact extracted source bytes.

### Interpretation
- Story Mode still crashes -> mount/path layer is implicated; transformed geometry is not necessary for the crash.
- Story Mode loads -> mount/path layer can serve the exact original; FiveFury retail YDR reconstruction is implicated despite synthetic validation.

### D4 rule
No visual pipeline component is promoted from this test beyond what the evidence supports. A visible graphics replacement remains blocked until GTA can load a non-vanilla asset stably.

## Rule

A row advances only with evidence. A synthetic pass is never reported as real GTA validation, and one primitive never marks its parent system complete.
