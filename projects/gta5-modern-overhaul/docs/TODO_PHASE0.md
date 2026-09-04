# TODO — Phase 0 / Tooling & Core

This checklist is the granular execution list for Phase 0. The high-level feature inventory remains in `TODO.md`.

Legend:
- `[x]` = implemented and validated at the stated gate
- `[ ]` = not yet complete
- `IN PROGRESS` = implementation exists but the required validation gate is still pending

## Core quality / traceability

- [x] C++20 standalone core scaffold — D3 cross-platform
- [x] warnings-as-errors policy — D3 Windows/Linux
- [x] global MSVC `NOMINMAX` protection
- [x] Windows/Linux build+test CI
- [x] Linux ASan + UBSan CI
- [x] project-local `AGENT.md` development contract
- [x] user-facing installer execution-smoke rule added after dev.15 quoting defect
- [x] PATCHNOTES / DEV_LOG / STATUS evidence tracking
- [x] reproducible GTA-root-ready checkpoint packaging
- [x] legacy duplicate visual workflows retired; consolidated current checkpoint CI
- [ ] formatting/static-analysis gate

## Persistent identity / state

- [x] stable `EntityId` primitive — D3
- [x] resumable fail-closed `EntityIdGenerator` — D3
- [x] `EntityRegistry` create/find/remove/snapshot — D3
- [x] duplicate/invalid/restored high-water validation — D3
- [x] world-state schema v1 / checksum / strict parser — D3
- [x] temp write + disk flush + atomic replacement — D3
- [x] previous-state `.bak` recovery — D3
- [x] separate-process synthetic create→restore proof — D3
- [x] dev.14 first real launch creates system EntityId 1 + next ID 2 — **D4 PASS**
- [x] dev.14 second real launch restores same EntityId/count/high-water — **D4 PASS**
- [x] dev.14 real `world_state.v1` path remains stable — **D4 PASS**
- [ ] GTA runtime handle ↔ stable EntityId adapter
- [ ] streamed-out / streamed-in entity lifecycle binding
- [ ] schema migration framework before schema v2
- [ ] larger persistence stress test
- [ ] explicit shutdown/save lifecycle beyond startup checkpoint

## Event / game-thread architecture

- [x] typed EventBus — D3
- [x] subscription / unsubscribe / re-entry / concurrency / token exhaustion tests
- [x] bounded `GameThreadQueue` — D3
- [x] concurrent producers / bounded drain / deferred re-entry / exception isolation
- [x] dev.14 synthetic queue marker — D3
- [x] dev.14 real `VOX_GAME_THREAD_QUEUE_DISPATCHED=1` — **D4 PASS**
- [ ] explicit event taxonomy / namespaces
- [ ] EventBus → GameThreadQueue adapter API
- [ ] event tracing hooks

## Native runtime

- [x] Enhanced executable/PE/AMD64 probe
- [x] real Enhanced `1.0.1158.13` identified
- [x] dev.8 unsafe free-thread bootstrap rejected and quarantined
- [x] dev.9 hidden CRT startup isolated
- [x] dev.10 no-CRT stable load baseline — D4
- [x] dev.11 exact-export registration failure isolated
- [x] dev.12 tolerant ScriptHook export resolution
- [x] dev.12 real registration / ScriptMain / wait-resume / heartbeats — **D4 PASS**
- [x] dev.13 minimal ASI → normal C++ `VOXModernCore.dll` bridge — **D4 PASS**
- [x] dev.14 persistent Registry + queue in real Core — **D4 PASS**
- [x] latest dev.15 logs still prove runtime reaches Core ready + queue + five ticks before/through visual experiments
- [ ] first safe GTA native read-only call
- [ ] supported-build policy + graceful disable
- [ ] robust plugin/core unload/shutdown lifecycle

### Permanently quarantined

- dev.8 `CreateThread` from `DllMain`.
- dev.9 default CRT-startup ASI pattern as a minimal host.
- World-mutating runtime behavior before its story-compatibility gate.
- dev.15.3 full filesystem-directory mirror as a production RPF strategy — real game ~5 FPS.

## Diagnostics

- [x] file logger foundation
- [x] live host-callback markers
- [x] reversible external WER crash-capture pack
- [x] dev.15.1 crash narrowed to post-runtime visual path by returned logs
- [x] dev.15.2 proves transformed target bytes are not required: source-identical one-file archive still crashes
- [x] dev.15.3 distinguishes structural completeness from performance: full directory archive runs but at ~5 FPS
- [x] dev.15.4 failure isolated before GTA launch: stale `visual_probe_manifest.json` dependency
- [ ] capture WER/minidump only if compact real-RPF identity still crashes
- [ ] log rotation / bounded size
- [ ] structured subsystem fields

## Simulation fidelity

- [x] simulation tier primitive
- [ ] Spatial Simulation Manager
- [ ] relevance/distance promotion rules
- [ ] deterministic dematerialize/rematerialize
- [ ] simulation budget governor
- [ ] large abstract-population stress test

## Configuration

- [x] strict versioned `key=value` parser — D3
- [x] typed bool/unsigned reads + malformed input rejection
- [ ] typed production runtime schema
- [ ] config migration framework
- [ ] production default/recovery policy

## Packaging / rollback

- [x] ASI/Core hashes + commit/version in `BUILD_INFO.txt`
- [x] package excludes fake ScriptHookV and generated persistent state
- [x] dev.13 delivered + D4 tested
- [x] dev.14 delivered + two-launch D4 tested
- [x] dev.15 introduced source-only visual tool scripts
- [x] dev.15.1 executable installer regression
- [x] dev.15.2 byte-identical visual crash-isolation tools
- [x] dev.15.3 complete nested-RPF directory mirror tools
- [x] dev.15.4 compact real-RPF identity/transform/rollback tools implemented
- [x] dev.15.5 standalone compact recovery package removes prior-manifest dependency
- [x] dev.15.5 rollback can restore a quarantined pre-existing target path after hash/set verification
- [x] package rejects bundled `.ydr`, `.rpf`, FiveFury environment and visual-probe user state
- [ ] general installer/root discovery for later public builds

## Story compatibility foundation

- [ ] read-only mission/story detector research — parallel track
- [ ] reliable mission-active state
- [ ] Story Compatibility Manager skeleton
- [ ] canonical world overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

## Asset pipeline — visual priority

- [x] choose non-destructive Enhanced override path using existing RageOpenV `newmods/platform` mount — implementation boundary
- [x] pin local authoring dependency FiveFury 0.4.21 (not bundled)
- [x] Python 3.11+ isolated-venv installer
- [x] executable `-EnvironmentOnly` setup path and real Windows venv smoke
- [x] base-game `x64*.rpf` source acceptance / unsafe path rejection
- [x] real user's Enhanced scan selects `prop_roadcone02a` — **D4 PASS**
- [x] real local source extraction from `x64f.rpf` — **D4 PASS**
- [x] editable Gen9 YDR render transformation — D3 synthetic
- [x] YDR bounds/LOD/version/validation checks — D3 synthetic
- [x] one-file nested-RPF directory transformed test — **D4 FAIL: crash**
- [x] same one-file directory with source-identical YDR — **D4 FAIL: crash**
- [x] inspect RageOpenV behavior: custom `.rpf` directory is treated as archive
- [x] complete nested-RPF filesystem mirror — D3 tooling
- [x] real complete directory archive test — **D4 FUNCTIONAL / PERFORMANCE FAIL: ~5 FPS**
- [x] reject directory-as-RPF strategy for production
- [x] implement compact archive path mapping to a real `.rpf` file
- [x] extract original nested RPF bytes from outer Rockstar archive using user's own install
- [x] build transformed compact RPF from preserved identity copy
- [x] require identical RPF member path set after rebuild
- [x] require every non-target standalone member SHA-256 unchanged
- [x] require transformed target SHA-256 match preserved generated YDR
- [x] dev.15.4 user test exposed missing-manifest dependency before compact activation — **D4 TOOLING FAIL**
- [x] remove old-manifest requirement from compact identity install
- [x] fresh retail rescan/re-extraction path for dev.15.5
- [x] regenerate source + transformed diagnostic YDR work state when manifest is absent
- [x] quarantine any pre-existing target-path file/directory instead of deleting it
- [x] write fresh schema-2 compact manifest from scratch
- [x] recovery rollback restores quarantined prior target only after exact hash/file-set verification
- [x] synthetic no-manifest + pre-existing-directory install/rollback self-test
- [x] exact `Install-CompactRpfIdentityProbe.ps1 -SelfTest` executed in installer-created Windows venv — **D3 EXECUTED PASS**
- [ ] final documented dev.15.5 CI fully green
- [ ] real Story Mode with exact original compact `v_construction.rpf` file at normal FPS — **CURRENT D4 TEST**
- [ ] if identity passes, real Story Mode with transformed compact RPF at normal FPS
- [ ] stable rewritten retail YDR proof
- [ ] **first visible in-game asset replacement at acceptable performance**
- [ ] real compact-RPF rollback proof restores vanilla behavior
- [ ] replace exaggerated proof with first meaningful visual upgrade
- [ ] first graphical vertical slice

## Current checkpoint

**Checkpoint 0I.5 — standalone compact nested RPF (`0.0.1-dev.15.5`)**

Real evidence leading here:

1. one-file `.rpf` directory + transformed cone → CRASH.
2. same one-file directory + byte-identical Rockstar cone → CRASH.
3. complete `.rpf` directory with all sibling resources → Story Mode runs, but roughly **5 FPS**.
4. dev.15.4 compact installer never reached GTA because it required an old `visual_probe_manifest.json` that was absent.

That fourth point is now treated as a regression requirement rather than a user prerequisite.

Dev.15.5 must work even when `VOXModernOverhaul\visual_probe\visual_probe_manifest.json` does not exist. It rescans the installed game, rebuilds source/generated work state, extracts the original nested real RPF, quarantines any currently active old target-path content, then creates a fresh compact manifest.

Required sequence:

1. install final dev.15.5 package over the GTA root;
2. no old visual-probe manifest is required;
3. run `08_INSTALL_COMPACT_RPF_IDENTITY.cmd`;
4. require `VOX_COMPACT_RPF_STANDALONE_BOOTSTRAP_OK` and `VOX_COMPACT_RPF_IDENTITY_INSTALLED`;
5. launch Story Mode and check only stability + normal FPS; no visual change expected;
6. only if step 5 is good, close GTA and run `09_ENABLE_COMPACT_SCALED_PROBE.cmd`;
7. launch again and require normal FPS plus visibly oversized `prop_roadcone02a`;
8. use `10_ROLLBACK_COMPACT_RPF_PROBE.cmd` for hash-safe removal/restoration.

If step 5 crashes or remains unusably slow, reject the RageOpenV platform-RPF route instead of iterating another directory workaround. No visual-pipeline D4 success is claimed until a modified asset reaches a stable frame at acceptable performance.
