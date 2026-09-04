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
| Gen9 YDR transform tooling | **D3 synthetic / real runtime compatibility UNPROVEN** | transformed YDR is not required for the observed crash because dev.15.2 still crashes with source-identical bytes |
| RageOpenV one-file nested-RPF directory probe | **D4 real FAIL** | dev.15.1 transformed target crashes; dev.15.2 source-identical target at same one-file archive path also crashes |
| Complete nested-RPF mirror strategy | **D3 synthetic / D4 pending** | dev.15.3 mirrors every indexed member before target substitution; real Story Mode test pending |
| First visible graphics replacement | **D4 FAILED / blocked on complete-archive test** | no stable visible modified frame yet |
| Byte-identical override isolation | **D4 real FAIL as one-file archive** | source-identical target still crashes, proving modified target bytes are not necessary for crash |
| Runtime checkpoint packaging | D3 Windows | ASI+Core+visual tools required; fake ScriptHook/user state/YDR/RPF assets excluded; package version/readme checked |
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
Real setup output proves Python/FiveFury setup, real Enhanced archive scan, `prop_roadcone02a` selection/extraction, and one-file `newmods/platform/.../v_construction.rpf/prop_roadcone02a.ydr` installation.

The game then crashes entering Story Mode. Returned logs show the VOX runtime and ScriptHookV lifecycle complete through five ticks/heartbeats before the crash.

### dev.15.2 — source-identical target still crashes
The transformed target was replaced at the exact same path with the preserved Rockstar source bytes and hash identity was verified. The user reports Story Mode still crashes.

Conclusion:
- transformed FiveFury YDR bytes are not required to trigger the crash;
- the one-file custom directory-archive layout is now the primary suspect;
- no visible pipeline D4 pass exists yet.

## dev.15.3 current complete-archive checkpoint

### Source-based hypothesis
RageOpenV mounts `newmods/platform/` as `platform:/`. Its custom archive hook checks whether the requested archive path resolves to a custom-device directory and then treats that directory as the archive. A directory named `v_construction.rpf` containing only one YDR can therefore shadow the complete Rockstar nested RPF instead of merging with it.

### dev.15.3 strategy
- enumerate every indexed asset whose logical path is below the selected nested RPF;
- extract standalone bytes for the whole nested archive into staging;
- verify the selected target still equals the original source hash;
- replace the incomplete one-file directory only after the complete mirror is ready;
- record the complete mirrored file set and per-file SHA-256;
- first test with a source-identical target;
- only after that loads, enable the preserved transformed target inside the complete archive;
- rollback only after exact set/hash verification.

### D4 interpretation
- Complete identity mirror loads -> incomplete archive shadowing hypothesis supported; proceed to transformed full archive.
- Complete identity mirror still crashes -> custom directory-archive mount remains incompatible/deeper bug; capture WER/minidump or replace RageOpenV route.
- Transformed full archive loads and visible model changes -> first stable visible asset replacement D4 PASS.

## Rule

A row advances only with evidence. A synthetic pass is never reported as real GTA validation, and one primitive never marks its parent system complete.
