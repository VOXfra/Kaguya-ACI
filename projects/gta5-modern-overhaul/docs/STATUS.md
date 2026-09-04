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
| Bounded game-thread dispatch queue | **D4 real GTA PASS / D3 regression** | real dev.14/dev.15 logs `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`; concurrency/bounds/failure isolation tested |
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
| isolated `VOXModernCore.dll` bridge | **D4 real GTA PASS** | dev.13+ real logs prove core start/bridge/ticks |
| dev.14 persistent runtime | **D4 real GTA PASS** | real first launch NEW+SAVE_OK; second launch LOADED with same persistent identity; queue marker healthy |
| Mission/story detector | D0 | read-only work queued in parallel with visual track |
| Story Compatibility runtime | D0 | contract only |
| Visual installer environment/bootstrap | **D4 real setup PASS / D3 Windows regression** | dev.15.1 real machine completes venv/FiveFury/self-test/retail scan; CI executes exact bootstrap path |
| Enhanced retail asset locator/extraction | **D4 real PASS** | dev.15.1 real scan selected and extracted `prop_roadcone02a` from base `x64f.rpf` |
| Gen9 YDR transform tooling | **D3 synthetic / real runtime compatibility UNPROVEN** | transformed YDR is not required for the original crash because dev.15.2 also crashes with source-identical target bytes |
| RageOpenV one-file nested-RPF directory probe | **D4 real FAIL** | dev.15.1 transformed target crashes; dev.15.2 source-identical target at same one-file archive path also crashes |
| Complete nested-RPF directory mirror | **D4 functional / PERFORMANCE FAIL** | dev.15.3 lets Story Mode run but user reports roughly 5 FPS; directory-as-RPF strategy rejected for production |
| Real compact nested-RPF file strategy | **D3 tooling / D4 pending** | dev.15.5 rebuilds all required diagnostic state from the user's GTA and installs a real nested RPF file without depending on an old manifest |
| Missing-manifest recovery path | **D3 executed Windows PASS / D4 retail pending** | CI starts with no manifest + existing target directory, quarantines it, installs compact identity RPF, rolls back and restores the directory byte-for-byte |
| First visible graphics replacement | **D4 FAILED / pending compact-RPF proof** | no stable modified frame at acceptable performance yet |
| Byte-identical override isolation | **D4 real FAIL as one-file directory** | source-identical target still crashes, proving modified target bytes are not necessary for that crash |
| Runtime checkpoint packaging | D3 Windows | ASI+Core+visual tools required; fake ScriptHook/user state/YDR/RPF assets excluded; package version/readme checked |
| GitHub Windows/Linux CI | D3 | consolidated current workflow must be green before delivery |
| ASan + UBSan CI | D3 | sanitizer job retained in consolidated workflow |

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
- the one-file custom directory-archive layout is the primary suspect for that failure;
- no visible pipeline D4 pass exists yet.

### dev.15.3 — complete directory archive runs but collapses performance
The complete `v_construction.rpf` member set was mirrored as a directory so RageOpenV could satisfy sibling resource requests. The user reached Story Mode, but reports the game running at about **5 FPS**.

That result is useful but not acceptable:
- missing-member shadowing was a real problem with the one-file directory;
- a full directory-backed RPF avoids the immediate missing-member failure;
- the directory-backed archive path is far too slow for a production graphics pipeline and is permanently rejected as the runtime strategy.

Fresh user logs from the subsequent attempts still show:
- ASI loader finishing plugin loading;
- ScriptHookV Enhanced `1.0.1158.13` initialization and VOX registration;
- VOX Core start, persistence save, bridge ready, game-thread queue dispatch and five ticks/heartbeats;
- RageOpenV release log only reporting initialization.

Those logs do not expose the performance cause or a later archive operation, but they continue to show that the known VOX runtime path itself reaches its expected markers.

### dev.15.4 — real compact-RPF installer blocked by stale-manifest dependency
The user ran `08_INSTALL_COMPACT_RPF_IDENTITY.cmd` and the installer aborted immediately because `VOXModernOverhaul/visual_probe/visual_probe_manifest.json` was missing.

That is a tooling/design failure in dev.15.4, not a GTA runtime result. The real compact RPF route was never activated, so dev.15.4 provides no D4 evidence for compact-RPF stability or performance.

The failure proves a checkpoint dependency that should not have existed: dev.15.4 assumed temporary diagnostic state from earlier builds would still be present on the user's machine.

## dev.15.5 current standalone compact-RPF checkpoint

### Strategy
The compact identity installer now reconstructs its own required state from the user's installed GTA V Enhanced:
- rescan the base game with FiveFury `0.4.21`;
- locate the known retail `prop_roadcone02a` source;
- extract that source YDR again;
- regenerate the 1.65x transformed diagnostic YDR for the later stage;
- extract the original nested `v_construction.rpf` as a real RPF byte stream;
- verify the target inside the nested archive matches the freshly extracted source hash;
- if a file/directory already occupies the `newmods/platform/.../v_construction.rpf` destination, snapshot and move it intact into VOX recovery storage rather than deleting it;
- activate the exact original nested RPF as a real file;
- write a new schema-2 manifest with compact-RPF and recovery metadata.

### Missing-manifest regression
The current Windows CI does not merely parse the wrapper. It executes `Install-CompactRpfIdentityProbe.ps1 -SelfTest` inside the freshly created installer venv.

That test begins with:
- no `visual_probe_manifest.json`;
- an existing directory at the target `.rpf` path;
- synthetic Gen9 source/transformed YDRs and a complete synthetic RPF.

It must:
- create fresh manifest state;
- quarantine the pre-existing directory without deleting it;
- install the identity compact RPF;
- execute rollback;
- restore the original directory with exact file-set and SHA-256 verification.

### D4 interpretation
- Identity compact RPF loads at normal FPS -> real-file RageOpenV archive path is viable; proceed to transformed compact RPF.
- Identity compact RPF crashes or remains unusably slow -> reject this RageOpenV platform-RPF route and switch strategy rather than adding another directory workaround.
- Transformed compact RPF loads at normal FPS and shows the oversized cone -> first stable visible asset replacement D4 PASS.

## Rule

A row advances only with evidence. A synthetic pass is never reported as real GTA validation, and one primitive never marks its parent system complete.
