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
- [ ] log rotation / bounded size
- [ ] structured subsystem fields
- [ ] production crash capture only if needed

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
- [x] package rejects bundled `.ydr`, FiveFury environment and visual-probe user state
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
- [x] pin local authoring dependency FiveFury 0.4.21 (Unlicense; not bundled)
- [x] Python 3.11+ isolated-venv installer
- [x] dev.15 PowerShell→Python quoting defect isolated from real user error
- [x] quote-free venv Python compatibility/version probes
- [x] existing venv >=3.11 validation
- [x] executable `-EnvironmentOnly` setup path
- [x] fresh Windows venv → Python version → FiveFury install → Gen9 self-test — **D3 EXECUTED PASS, run 33893214202**
- [x] base-game `x64*.rpf` asset-path acceptance / update-DLC rejection
- [x] traversal / drive-style path rejection
- [x] visible-prop candidate selection without overwriting an existing loose override
- [x] local asset extraction from user's own installation — implementation; retail execution pending
- [x] editable Gen9 YDR render-geometry transformation
- [x] recompute render bounding box / sphere / LOD distances
- [x] preserve source YDR version across rewrite
- [x] reopen + FiveFury validation before install
- [x] generated SHA-256 verification before atomic loose-file install
- [x] deterministic `x64*.rpf/...` → `newmods/platform/...` mapping
- [x] manifest records source/generated hashes + exact override path
- [x] hash-safe rollback implementation
- [x] synthetic Gen9 v159 transform self-test — **D3 Windows PASS**
- [x] PowerShell wrapper parser checks — **D3 Windows PASS**
- [x] package contains no Rockstar YDR and no locally installed FiveFury runtime
- [ ] real user's Enhanced scan selects a compatible source asset — **CURRENT D4 TEST**
- [ ] real RageOpenV mount serves generated YDR — **CURRENT D4 TEST**
- [ ] **first visible in-game asset replacement — CURRENT D4 TEST**
- [ ] real rollback proof restores vanilla visual
- [ ] replace exaggerated proof with first meaningful visual upgrade
- [ ] first graphical vertical slice

## Current checkpoint

**Checkpoint 0I — corrected first visible GTA V Enhanced asset override (`0.0.1-dev.15.1`)**

Real dev.15 outcome:

1. packaged CMD/PowerShell launched from the user's actual GTA root — PASS.
2. isolated `.venv-assets` creation — PASS.
3. original Python version query — **FAIL** due malformed `-c` source caused by PowerShell/backslash quote handling.
4. failure occurred before FiveFury install, GTA archive scan, asset generation or `newmods` installation.

Regression now proven before corrected delivery:

1. dev.14 persistent-world two-launch real test — PASS.
2. current C++ runtime Windows/Linux/ASan+UBSan regressions — PASS.
3. FiveFury 0.4.21 installs in Windows CI — PASS.
4. visual Python compiles — PASS.
5. synthetic Enhanced/Gen9 YDR version 159 creation/rewrite/reopen — PASS.
6. expected vertex scale survives binary round trip — PASS.
7. YDR validation after rewrite — PASS.
8. base-RPF → RageOpenV platform mirror mapping — PASS.
9. update/DLC/traversal/drive path refusal — PASS.
10. PowerShell parser validation — PASS.
11. **actual packaged setup script creates a fresh Windows venv and executes both corrected version queries — PASS.**
12. same setup script installs FiveFury 0.4.21 into that venv and executes Gen9 self-test — PASS.
13. `VOX_VISUAL_ENVIRONMENT_SMOKE_OK` — PASS, run `33893214202`.
14. runtime ASI/Core synthetic persistence regressions remain PASS.
15. package boundary excludes YDR assets, user state, fake ScriptHookV and FiveFury venv — PASS.

Required real dev.15.1 proof:

- install corrected dev.15.1 over the current files; existing valid `.venv-assets` may remain;
- run `VOXModernOverhaul/tools/assets/01_INSTALL_VISUAL_PROBE.cmd`;
- environment bootstrap and Gen9 self-test complete;
- report becomes `status=INSTALLED`;
- report identifies the selected common model and exact base `x64*.rpf` source;
- generated override exists only in the reported `newmods/platform` path;
- GTA remains stable;
- selected model is visibly ~1.65× normal size in Story Mode;
- screenshot + `visual_probe_report.txt` provide D4 evidence;
- then run rollback and confirm vanilla appearance returns before moving to real art.

Decision after PASS:
- remove the deliberately exaggerated proof;
- keep the validated locator/extract/rebuild/override/rollback pipeline;
- immediately build the first meaningful materials/foliage/road visual improvement;
- continue toward the graphical vertical slice while read-only mission/story work proceeds in parallel.
