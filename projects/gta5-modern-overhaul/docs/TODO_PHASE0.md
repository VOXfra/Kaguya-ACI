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
- [x] dev.15.1 crash logs still prove runtime reaches Core ready + queue + five ticks before visual crash
- [ ] first safe GTA native read-only call
- [ ] supported-build policy + graceful disable
- [ ] robust plugin/core unload/shutdown lifecycle

### Permanently quarantined

- dev.8 `CreateThread` from `DllMain`.
- dev.9 default CRT-startup ASI pattern as a minimal host.
- World-mutating runtime behavior before its story-compatibility gate.

## Diagnostics

- [x] file logger foundation
- [x] live host-callback markers
- [x] reversible external WER crash-capture pack
- [x] dev.15.1 crash narrowed to post-runtime visual path by returned logs
- [x] dev.15.2 proves transformed target bytes are not required: source-identical one-file archive still crashes
- [ ] capture WER/minidump if the complete nested-RPF identity mirror still crashes
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
- [x] dev.15 user setup failure isolated before any newmods write
- [x] dev.15.1 package version/readme boundary enforced in CI
- [x] dev.15.2 package includes byte-identical visual crash-isolation tools
- [x] dev.15.3 package includes complete nested-RPF mirror + transform + hash-safe full rollback tools
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
- [x] dev.15 PowerShell→Python quoting defect isolated from real user error
- [x] quote-free venv Python compatibility/version probes
- [x] existing venv >=3.11 validation
- [x] executable `-EnvironmentOnly` setup path
- [x] fresh Windows venv → Python version → FiveFury install → Gen9 self-test — **D3 EXECUTED PASS**
- [x] base-game `x64*.rpf` asset-path acceptance / update-DLC rejection
- [x] traversal / drive-style path rejection
- [x] visible-prop candidate selection without overwriting an existing loose override
- [x] real user's Enhanced scan selects a source asset — **D4 PASS: prop_roadcone02a**
- [x] real local extraction from user's own x64f.rpf — **D4 PASS**
- [x] editable Gen9 YDR render-geometry transformation — D3 synthetic
- [x] recompute render bounding box / sphere / LOD distances — D3 synthetic
- [x] preserve source YDR version across rewrite — D3 synthetic
- [x] reopen + FiveFury validation before install — D3 synthetic + real tool path reached
- [x] generated SHA-256 verification before atomic loose-file install
- [x] deterministic `x64*.rpf/...` → `newmods/platform/...` mapping
- [x] manifest records source/generated hashes + exact override path
- [x] initial hash-safe single-file rollback implementation
- [x] synthetic Gen9 v159 transform self-test — **D3 Windows PASS**
- [x] PowerShell wrapper parser checks — **D3 Windows PASS**
- [x] package contains no Rockstar YDR/RPF and no locally installed FiveFury runtime
- [x] real transformed one-file loose override installed — **D4 execution PASS**
- [x] real Story Mode launch with transformed one-file archive — **D4 FAIL: crash**
- [x] byte-identical source override at same one-file archive path — **D4 FAIL: crash**
- [x] conclude transformed YDR bytes are not necessary for crash
- [x] inspect RageOpenV custom-device behavior: `.rpf` directory is treated as archive
- [x] implement complete nested-RPF mirror staging
- [x] enumerate every indexed member below selected nested RPF
- [x] extract standalone bytes for all mirrored members
- [x] require current incomplete destination contain only the owned identity target
- [x] verify selected target equals source hash inside staged complete archive
- [x] record complete mirrored file set + per-file SHA-256
- [x] implement full-archive transformed-target switch
- [x] implement exact set/hash-safe recursive full-archive rollback
- [x] synthetic archive-mirror layout self-test — **D3**
- [ ] real Story Mode launch with complete archive + source-identical target — **CURRENT dev.15.3 D4 TEST**
- [ ] if identity passes, real Story Mode launch with complete archive + transformed target
- [ ] stable rewritten retail YDR proof
- [ ] **first visible in-game asset replacement**
- [ ] real full-archive rollback proof restores vanilla visual
- [ ] replace exaggerated proof with first meaningful visual upgrade
- [ ] first graphical vertical slice

## Current checkpoint

**Checkpoint 0I.3 — complete nested-RPF mirror (`0.0.1-dev.15.3`)**

What dev.15.2 established in the real game:

1. transformed one-file `v_construction.rpf` directory — Story Mode CRASH.
2. same one-file directory with byte-for-byte Rockstar `prop_roadcone02a.ydr` — Story Mode CRASH.
3. therefore transformed target bytes are not necessary for the crash.

Most likely structural defect now under test:

RageOpenV treats a custom `.rpf` directory as the archive itself. A one-file `v_construction.rpf` directory can therefore hide all other members of Rockstar's archive. dev.15.3 builds the complete nested archive before activating the mount.

Required dev.15.3 sequence:

1. keep existing dev.15.2 `visual_probe` state and `.venv-assets`;
2. run `05_INSTALL_FULL_ARCHIVE_IDENTITY.cmd`;
3. require `VOX_FULL_ARCHIVE_IDENTITY_INSTALLED` and a non-zero complete file count;
4. launch Story Mode with no intended visual difference;
5. if it loads, close GTA and run `06_ENABLE_SCALED_PROBE.cmd`;
6. launch again and require the selected prop to be visibly oversized without a crash;
7. run `07_ROLLBACK_FULL_ARCHIVE_PROBE.cmd` and require exact set/hash verification before removal.

If step 4 still crashes, stop using this one-file-vs-complete-file hypothesis and move to WER/minidump or a different non-destructive mount strategy. No visible-pipeline D4 success is claimed until a modified asset reaches a stable frame.
