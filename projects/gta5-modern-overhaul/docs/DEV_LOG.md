# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — dev.15.3 complete directory archive performance failure → dev.15.4 real compact RPF

### Real dev.15.3 outcome
The complete nested `v_construction.rpf` directory mirror changed the real-game behavior materially: the user reached Story Mode instead of the immediate one-file-directory crash, but reports the game running at roughly **5 FPS**.

That establishes two separate facts:
1. the previous one-file `.rpf` directory was structurally incomplete and could not stand in for the original nested archive;
2. mirroring the entire archive as a filesystem directory is far too expensive to use as the production override strategy.

The complete directory approach is therefore retired even though it was a useful differential test. It is recorded as functional enough to load but a **D4 performance failure**.

### Fresh logs after the failed visual experiments
The newest returned log set still shows the known runtime path reaching all expected markers:
- the ASI loader maps RageOpenV, ScriptHookVDotNet, TrainerV and VOX, then finishes plugin loading;
- ScriptHookV identifies Enhanced `VER_EN_1_0_1158_13` and registers VOX;
- VOX enters/resumes ScriptMain, starts the Core, saves persistence, reaches runtime/bridge ready, dispatches the game-thread queue, then produces five Core ticks and five ScriptHook heartbeats;
- RageOpenV's release log still only says `RageOpenV Inited!`.

These logs do not prove why the directory mirror costs so much; they only continue to show that the validated VOX runtime lifecycle itself reaches its expected checkpoints during these tests. No deeper RageOpenV operation is claimed from its sparse release log.

### Why the next strategy is a real RPF file
Re-reading RageOpenV's `OpenArchiveHook` shows its special archive behavior is conditional on the custom-device path having `FILE_ATTRIBUTE_DIRECTORY`. If the path is a **real `.rpf` file**, that directory-mode override is not selected and the archive is left on the normal packfile-open path.

The new strategy is therefore:

`newmods/platform/levels/gta5/props/roadside/v_construction.rpf`

as one actual RPF file, not a directory named `.rpf`.

This keeps the override non-destructive while avoiding thousands of individual filesystem-backed resource lookups.

### dev.15.4 compact RPF implementation
Added `vox_compact_rpf_probe.py` plus:
- `Install-CompactRpfIdentityProbe.ps1`;
- `Enable-CompactRpfTransformedProbe.ps1`;
- `Rollback-CompactRpfProbe.ps1`;
- `08_INSTALL_COMPACT_RPF_IDENTITY.cmd`;
- `09_ENABLE_COMPACT_SCALED_PROBE.cmd`;
- `10_ROLLBACK_COMPACT_RPF_PROBE.cmd`.

The identity path deliberately does **not rebuild** the original nested RPF. It:
1. loads the existing visual-probe manifest and preserves the real dev.15.1 source/transformed YDR hashes;
2. derives outer archive `x64f.rpf`, nested entry `levels/gta5/props/roadside/v_construction.rpf`, target `prop_roadcone02a.ydr`, and final compact destination from the real source logical path;
3. initializes FiveFury's Enhanced `GameFileCache` to obtain the game's crypto context;
4. opens the user's own outer Rockstar `x64f.rpf` and reads the nested RPF as a standalone byte stream;
5. reopens those exact nested bytes as an RPF and verifies the contained target standalone SHA-256 matches the `source_sha256` already recorded by the real dev.15.1 extraction;
6. snapshots all nested member paths and standalone SHA-256 values;
7. verifies ownership of the currently active VOX directory archive before migration — complete dev.15.3 mirrors require exact set + per-file hash equality, older one-file states require their exact owned target;
8. stages the exact original nested RPF as a file and verifies its SHA-256;
9. moves the old VOX directory out of the active path only after staging is complete;
10. swaps the real RPF file into place and restores the previous directory automatically if the final swap fails;
11. records `COMPACT_RPF_IDENTITY`, compact RPF SHA-256 and member count in the manifest.

No Rockstar RPF/YDR is distributed. All bytes are recovered from the user's own installed game.

### Transformed compact RPF integrity design
Only after the user proves the **identity** compact RPF loads at normal performance can the transformed stage run.

The transformed stage starts from the preserved identity RPF and replaces only the target member with the already preserved Gen9 YDR from dev.15.1. Because rebuilding an RPF can legitimately change archive-level byte layout, verification is performed at the meaningful member boundary:
- the rebuilt RPF is reopened;
- member path set must be exactly identical;
- target standalone SHA-256 must equal the preserved transformed YDR SHA-256;
- every non-target standalone member SHA-256 must remain identical to the identity RPF;
- active transformed RPF SHA-256 is recorded for ownership-safe rollback.

The production real path carries the FiveFury Enhanced crypto context through source/rebuild validation. The synthetic self-test uses unencrypted RPFs.

### FiveFury API defect caught before user delivery
During source review, the first compact script imported `RpfFileEntry` from the FiveFury top-level package. Inspection of FiveFury's actual `__init__.py` showed `RpfArchive` is exported but `RpfFileEntry` is not.

The compact script was corrected before delivery to import `RpfArchive` / `RpfFileEntry` from `fivefury.rpf`. This is exactly the type of boundary error that previously escaped the first dev.15 wrapper, so the consolidated CI executes the real installed wheel rather than trusting static assumptions.

### CI consolidation
The project had accumulated a current core workflow and a checkpoint-specific dev.15.3 workflow. Keeping both caused unnecessary duplicate builds and made it easier for stale checkpoint packaging rules to remain active.

Actions taken:
- retired `.github/workflows/gta5-modern-overhaul-core.yml`;
- retired `.github/workflows/gta5-modern-overhaul-dev153.yml`;
- added one `.github/workflows/gta5-modern-overhaul.yml` current workflow.

The consolidated workflow requires:
- Windows and Linux warnings-as-errors core builds/tests;
- Linux ASan + UBSan;
- real FiveFury 0.4.21 install on Windows;
- Python compile + Gen9 visual self-test + legacy mirror self-test + compact-RPF extraction/rebuild self-test;
- PowerShell parsing for every shipped visual wrapper;
- exact user-facing environment bootstrap in a **fresh** venv, then compact-RPF self-test from that installer-created venv;
- runtime x64 ASI/Core build;
- CRT-free/no-TLS ASI dependency boundary;
- two separate synthetic runtime processes proving persistence create→restore;
- dev.15.4 package creation;
- package boundary rejecting any `.ydr`, `.rpf`, user state, local venv or ScriptHookV redistribution.

### Current evidence boundary
The compact-RPF tool is still D3 until a final documentation-aligned CI build is green and the user's real GTA performs the identity test.

D4 sequence is intentionally two-stage:
1. `08_INSTALL_COMPACT_RPF_IDENTITY.cmd`: no intended visual difference; require Story Mode to load and FPS to return to normal;
2. only after that pass, `09_ENABLE_COMPACT_SCALED_PROBE.cmd`: require normal FPS and a visibly oversized `prop_roadcone02a`.

If stage 1 crashes or remains unusably slow, the `newmods/platform` nested-RPF route itself is rejected instead of adding another filesystem workaround. No visible D4 pass is claimed until a modified asset reaches a stable frame at acceptable performance.

## 2026-09-04 — dev.15.2 source-identical crash → dev.15.3 complete nested-RPF mirror

### Real dev.15.2 result
The user confirms GTA V Enhanced still crashes immediately when entering Story Mode after dev.15.2 replaced the transformed `prop_roadcone02a.ydr` with a byte-for-byte copy of the extracted Rockstar original at the exact same loose destination:

`newmods/platform/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr`

The isolation script had already verified the active identity file SHA-256 matched `source_sha256`. Therefore the transformed FiveFury YDR bytes are not necessary to reproduce the crash.

This removes the modified target payload as the primary explanation for the current crash. It does not prove FiveFury retail output is generally correct; it proves only that this crash also occurs without those modified bytes.

### RageOpenV source re-analysis
RageOpenV's custom-device code mounts `newmods/platform/` as `platform:/`. In `OpenArchiveHook`, when the resolved custom-device path has `FILE_ATTRIBUTE_DIRECTORY`, the archive open `type` is changed to directory mode.

Our previous layout was:

`.../v_construction.rpf/prop_roadcone02a.ydr`

with no sibling members from the original `v_construction.rpf`.

The important architectural implication is that the directory named `v_construction.rpf` is not necessarily a per-file overlay. It can become the archive itself. A one-file directory can therefore shadow the complete Rockstar nested RPF and make all its other resources unavailable. That exactly fits the observed behavior: changing the one present file back to source-identical bytes still crashes because the rest of the archive is still absent.

### dev.15.3 implementation
Added `vox_archive_mirror_probe.py` plus:
- `05_INSTALL_FULL_ARCHIVE_IDENTITY.cmd`;
- `06_ENABLE_SCALED_PROBE.cmd`;
- `07_ROLLBACK_FULL_ARCHIVE_PROBE.cmd`;
- PowerShell wrappers for each stage.

The complete identity installer:
1. requires the existing dev.15.2 visual manifest/work state and source-identical active target;
2. derives the containing nested-RPF logical prefix from `source_logical_path`;
3. reuses/rescans the user's Enhanced FiveFury index;
4. enumerates every indexed asset below that nested RPF;
5. writes all members as standalone archive bytes into a staging directory, preserving relative paths;
6. requires no duplicate logical member path;
7. verifies the selected target inside staging still equals the preserved Rockstar `source_sha256`;
8. refuses conversion if the current active directory contains anything except the known owned identity target;
9. renames the incomplete directory out of the active mount, moves the complete staging archive into place, and restores the old directory if the activation move fails;
10. records `FULL_ARCHIVE_IDENTITY`, nested prefix, mirror root, target relative path, file count and per-file SHA-256 values.

The transformed-stage command is deliberately gated behind `FULL_ARCHIVE_IDENTITY`. It replaces only the target with the previously preserved transformed YDR, updates the complete mirror's target hash and records `FULL_ARCHIVE_TRANSFORMED`.

The full rollback verifies both the exact mirrored file set and the SHA-256 of every member. If any file is added, missing or modified, recursive removal fails closed rather than deleting a directory whose ownership is no longer certain.

### Evidence boundary
The structural diagnosis is source-driven and consistent with the real failure, but it is not yet a real-game proof. The next D4 test is specifically:

1. install the complete nested-RPF mirror while leaving `prop_roadcone02a.ydr` source-identical;
2. enter Story Mode;
3. if stable, enable the transformed target inside the same complete archive and test again;
4. if the complete identity archive still crashes, stop iterating on missing sibling resources and capture a WER/minidump or switch away from this RageOpenV directory-archive route.

No visible graphics D4 success is claimed yet.

## 2026-09-04 — dev.15.1 real Story Mode crash → dev.15.2 differential asset isolation

### Real dev.15.1 setup/install evidence
The user ran the corrected package in the real GTA V Enhanced root. The environment/bootstrap path completed successfully with Python 3.11.4, FiveFury 0.4.21 and `VOX_VISUAL_PROBE_SELF_TEST_OK`.

The retail scan then completed and selected:
- model: `prop_roadcone02a`;
- source: `x64f.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr`;
- loose destination: `newmods/platform/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr`;
- requested render scale: `1.65`.

The tool reported `VOX_VISUAL_PROBE_INSTALLED` and completed without an installation error.

### Real game outcome — FAIL
The game crashes immediately when entering Story Mode with the transformed loose YDR active. No stable in-game frame showing the oversized asset was reached. dev.15.1 is therefore **not** a D4 visual success.

Returned logs show before the crash:
- ASI loader maps RageOpenV, ScriptHookVDotNet, TrainerV and `VOXModernOverhaul.asi`, then reports `LOADER: Finished loading *.asi plugins`;
- ScriptHookV identifies Enhanced `VER_EN_1_0_1158_13` and registers VOX;
- VOX logs `VOX_SCRIPT_MAIN_ENTER`, resume after wait, `VOX_CORE_START`, persistence save, Core ready, bridge ready, game-thread queue dispatch, five Core ticks and five ScriptHook heartbeats;
- RageOpenV release log reports only `RageOpenV Inited!` and does not expose the open/archive operation at crash time.

Interpretation: the known runtime path finishes its proof markers before the crash. The only newly introduced runtime input relative to the dev.14 stable state is the visual override path. However, the logs alone cannot distinguish:
1. RageOpenV/newmods mount/path behavior; from
2. a retail YDR produced by FiveFury that passes FiveFury validation but is rejected by RAGE Enhanced.

No exact exception/module is claimed from these logs.

### Differential isolation design
Instead of changing several variables at once, dev.15.2 keeps the exact same override path and changes only the file bytes.

Added:
- `Isolate-VisualProbeCrash.ps1`;
- `04_ISOLATE_VISUAL_CRASH.cmd`.

The script:
1. loads the existing dev.15.1 manifest;
2. verifies the active transformed override still matches `generated_sha256`;
3. locates the already extracted `work/original/<model>.ydr`;
4. verifies that file matches `source_sha256`;
5. copies it through a temporary file to the exact active `newmods/platform` destination;
6. requires the installed SHA-256 to equal the source SHA-256;
7. preserves the old transformed hash as `transformed_sha256`;
8. sets `probe_mode=IDENTITY_OVERRIDE`;
9. advances manifest `generated_sha256` to the source hash so the existing rollback remains ownership-safe.

Expected interpretation in the real game:
- **crash persists with byte-identical source bytes** → transformed YDR is not required to reproduce the crash; investigate RageOpenV/newmods mount/path next;
- **Story Mode loads** → the same mount can serve the exact original, so the FiveFury retail YDR reconstruction becomes the primary suspect.

### Regression protection
Windows CI now creates a synthetic visual-probe tree containing different source/transformed byte sequences, executes the same PowerShell isolation script, and requires:
- transformed ownership hash before replacement;
- exact source hash after replacement;
- `probe_mode=IDENTITY_OVERRIDE`;
- preservation of the old transformed hash;
- active/rollback hash updated to the source hash.

A strict-mode compatibility defect was caught during source review before delivery: the original isolation draft accessed a missing `probe_mode` property directly on a dev.15.1 manifest. Under `Set-StrictMode -Version Latest`, that could fail before the script had a chance to add the field. The code now queries `PSObject.Properties['probe_mode']` safely first. The regression uses a legacy-style manifest without that property.

### Evidence boundary
No claim is made yet that RageOpenV's mount is faulty or that FiveFury's writer is faulty. dev.15.2 exists specifically to separate those hypotheses with one real Story Mode launch.

## 2026-09-04 — dev.15 real setup failure → dev.15.1 executable installer regression

### User failure evidence
The user ran the packaged `01_INSTALL_VISUAL_PROBE.cmd` from the real GTA V Enhanced root. The wrapper reached `Setup-And-Install-VisualProbe.ps1`, correctly identified:
- GTA root `E:\Jeux Epic\GTAVEnhanced`;
- the visual setup path;
- the isolated venv destination `VOXModernOverhaul\tools\.venv-assets`.

The venv was actually created. Immediately after creation, setup failed on the version query with Python syntax output equivalent to:

`print(f{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro})`

followed by PowerShell attempting `.Trim()` on null and aborting with exit code 1.

No FiveFury install, GTA archive scan, generated YDR or `newmods` override had happened yet. This isolates the defect to the environment bootstrap boundary rather than FiveFury, Gen9 rewriting or RageOpenV.

### Root cause
The packaged line used a single-quoted PowerShell argument containing Python `f\"...\"`. Backslash is not PowerShell's escape character for a quote in this context. The literal/command-line conversion therefore did not preserve the intended Python source across `powershell.exe -> python.exe -c`.

The previous CI only parsed the PowerShell source and separately ran Python/Gen9 tests. That proved syntax and the transformer, but **did not execute the packaged installer process boundary that failed for the user**. This was an insufficient regression gate.

### dev.15.1 correction
The version bootstrap now avoids nested quotes entirely:
- numeric compatibility query: `import sys; print(sys.version_info.major * 100 + sys.version_info.minor)`;
- display query: `import sys; print(sys.version.split()[0])`.

Additional hardening:
- venv output is wrapped into arrays before last-line indexing, preventing PowerShell scalar unrolling from turning a one-line result into character indexing;
- existing venv Python is explicitly required to be >=3.11;
- venv launcher arguments are assembled and splatted explicitly;
- failed Python queries preserve output and fail with an explicit stage error;
- `-EnvironmentOnly` runs the exact environment path and stops before retail GTA root/archive work.

### Executable regression evidence — CI run 33893214202
Run `33893214202`, commit `30de815cfeebe33e6361a6c3639396909819f37b`, used Windows Server 2025 / Python 3.11.9 and executed the real setup script with `-EnvironmentOnly` after deleting the CI venv.

Observed log sequence:
- `Creating isolated Python environment ...`;
- `Asset Python: 3.11.9`;
- pinned `fivefury==0.4.21` installed into that new venv;
- packaged Gen9 transformer self-test printed `VOX_VISUAL_PROBE_SELF_TEST_OK`;
- setup printed `VOX_VISUAL_ENVIRONMENT_SMOKE_OK`;
- CI printed `PASS: real PowerShell -> venv -> version query -> FiveFury -> Gen9 self-test bootstrap executed.`

The same run then retained all prior gates:
- Windows/Linux core tests PASS;
- ASan + UBSan PASS;
- ASI PE/CRT boundary PASS;
- two-process persistence create/restore PASS;
- package version/readme boundary PASS;
- artifact upload PASS.

This is the regression type that would have caught the user's dev.15 failure before shipment.

### Permanent process change
`AGENT.md` now states that parser/syntax validation is insufficient evidence for user-facing installer/bootstrap scripts when the critical path can run in CI. Process invocation, quoting, venv/environment creation, version checks and dependency/self-test launch must be executed where applicable.

### Persistence note from the same user turn
The user reported deleting `world_state.v1` after dev.14 and then relaunching GTA, which recreated it. At the current stage this only resets the single proof `EntityKind::System` record, so there is no meaningful persistent world data to recover. This behavior must not become normal once real NPC/property/world state exists; future packages should preserve the VOX state unless an explicit reset/migration is intended.

### Remaining D4 boundary
The corrected environment/bootstrap path is D3 Windows executed. The actual retail path remains unproven until the user's installation performs:
1. FiveFury scan of the local Enhanced archives;
2. candidate extraction;
3. Gen9 rewrite/validation;
4. `newmods/platform` install;
5. GTA launch with a visibly oversized streamed instance;
6. hash-scoped rollback and return to vanilla appearance.

## 2026-09-04 — dev.14 real D4 persistence + dev.15 first visible Enhanced asset pipeline

### Real dev.14 evidence received
The user returned two successive real-game runtime logs from GTA V Enhanced.

First clean dev.14 launch:
- `VOX_SCRIPT_MAIN_ENTER` and `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` remain healthy.
- `VOX_CORE_START` / runtime ready / bridge ready are observed.
- `VOX_PERSISTENCE_STATUS=NEW`.
- system EntityId is exactly `1`.
- entity count is exactly `1`.
- next EntityId/high-water is exactly `2`.
- `VOX_PERSISTENCE_SAVE_OK` proves the real startup save path committed successfully.
- `VOX_GAME_THREAD_QUEUE_DISPATCHED=1` proves the bounded queue reaches the live ScriptHookV game-thread/Core path.
- five Core ticks and five ScriptHook heartbeats remain healthy.

Second launch, without deleting VOX state:
- `VOX_PERSISTENCE_STATUS=LOADED`.
- system EntityId remains `1`.
- entity count remains `1`.
- next EntityId remains `2`.
- the game-thread queue marker remains healthy.
- five Core ticks and five ScriptHook heartbeats remain healthy.
- user reports GTA stable.

Conclusion: dev.14 is promoted to **D4 real GTA persistence**. The project now has a real persistent identity substrate, a real create→reload high-water path and a validated game-thread dispatch bridge. No claim is made yet that GTA runtime handles are bound to persistent IDs; that is a later adapter.

### Visual-track decision after dev.14
The user explicitly wants the project to leave long stretches of invisible plumbing and reach visible improvements quickly. With ScriptHookV lifecycle, C++ Core, persistence and the game-thread queue now D4, the next major parallel track is therefore the Enhanced asset pipeline rather than completing the entire society/world simulation first.

The first visual checkpoint is intentionally a pipeline proof, not final art. A common static world prop is made obviously oversized (`1.65x`) so a screenshot can unambiguously prove that GTA is serving our generated Enhanced asset. After the proof, the scale override is rolled back and the exact same extraction/rebuild/override chain is retained for meaningful materials/foliage/road work.

### Tool research / selected architecture
Three current Enhanced-capable paths were reviewed:
- CodeWalker remains useful for interactive Gen9 inspection and source-resource identification, but its normal program entry is UI-oriented and is not the most convenient first headless automation layer.
- Sollumz remains valuable for Blender-based production art later, but first-pipeline automation should not force the user into manual Blender work.
- FiveFury provides a Python API for GTA V asset cache/indexing, RPF reads, YDR read/edit/write/validation and explicit `GameTarget.GTA5_ENHANCED` handling.

FiveFury `0.4.21` was selected for the automated first proof:
- Python >=3.11;
- license The Unlicense/public domain;
- installed from PyPI into a VOX-local virtual environment at user test time;
- never bundled into the GTA-ready ZIP.

RageOpenV is the non-destructive runtime mount. Its implementation exposes `newmods/platform/` as `platform:/` and treats `.rpf`-named directories as virtual archive paths. Therefore a base logical asset such as:

`x64i.rpf/levels/gta5/.../nested.rpf/model.ydr`

can be mirrored as:

`newmods/platform/levels/gta5/.../nested.rpf/model.ydr`

without writing into Rockstar's original archive. dev.15 deliberately accepts only base `x64*.rpf` sources for the first proof; update/DLC mount semantics are deferred until the base pipeline is D4.

### dev.15 visual-probe implementation
Added `tools/assets/vox_visual_probe.py` plus one-click install/report/rollback wrappers.

The install path:
1. verifies `GTA5_Enhanced.exe` and existing `RageOpenV.asi`;
2. creates/uses an isolated VOX Python venv;
3. installs exactly FiveFury `0.4.21`;
4. runs a deterministic synthetic Gen9 self-test;
5. scans the user's own Enhanced installation;
6. searches a priority list of common static props (traffic lights, street lights, bin/cone, then vegetation fallbacks);
7. accepts only exact `.ydr` matches whose logical path starts at a base `x64*.rpf`;
8. refuses a candidate if its loose destination already exists;
9. extracts the user's source YDR to VOX working storage;
10. scales every render vertex by `1.65`;
11. recomputes drawable render bounds and extends positive LOD distances;
12. writes the asset back, reopens it, requires the original YDR version to be preserved and FiveFury validation to contain no errors;
13. verifies the transformed vertex numerically after the binary round trip;
14. requires generated SHA-256 to differ from source;
15. copies through a temporary file, verifies SHA-256, then atomically places the generated override under `newmods/platform`;
16. writes a manifest/report with source path, archive path, source/generated hashes, selected model, exact destination and transform stats.

Collision is intentionally not scaled. This avoids pretending the diagnostic proof is production-ready gameplay geometry. It is a visible streaming/asset-authoring proof only.

### Safety / conflict policy
- No Rockstar YDR is included in the repository package or user ZIP.
- Source extraction happens locally from the user's installed game.
- Update/DLC sources are rejected for this first proof.
- `..`, drive/URI-style and non-YDR paths fail closed.
- An occupied loose destination is skipped rather than overwritten.
- Final install is only performed after rebuild validation and SHA-256 verification.
- Rollback reads the manifest and will delete only a path that resolves under `newmods/platform` and still matches the recorded generated SHA-256.
- If another tool/user edits the generated override, rollback refuses deletion instead of guessing ownership.

### Defect caught before shipment — unverified FiveFury metadata API
The first `vox_visual_probe.py` revision attempted:
`from fivefury import __version__`
without first proving that the top-level package exported that name.

This assumption was caught during source review before user delivery. Per blocker policy, the first file was removed and replaced instead of adding a fallback around an unproven API. Runtime version verification now uses Python's standard `importlib.metadata.version("fivefury")`, while the setup and CI both pin exactly `0.4.21`.

Regression protection: the dev.15 Windows CI installs the real pinned wheel, compiles the actual Python script and executes its self-test before packaging.

### dev.15 CI evidence — run 33890491053
At implementation commit `17c89e7ee0ef0dcca28d6a4b8203d7254daad532`, all jobs/steps passed:
- core Windows build/tests;
- core Linux build/tests;
- ASan + UBSan;
- Python 3.11 setup;
- `fivefury==0.4.21` installation;
- Python syntax compilation;
- synthetic Gen9 YDR v159 create → transform → save → reopen;
- preservation of v159 edition/version;
- post-write vertex-scale verification;
- FiveFury validation;
- deterministic RageOpenV base-RPF → `newmods/platform` mapping;
- unsafe path rejection self-test;
- PowerShell installer/rollback parser validation;
- existing ASI PE/CRT boundary;
- existing two-process persistent Core smoke;
- dev.15 packaging;
- package boundary checks;
- artifact upload.

The package verifier additionally rejects:
- any `.ydr` file in the distributed ZIP;
- `ScriptHookV.dll`;
- CI-generated persistent user state;
- a bundled `.venv-assets`/FiveFury environment;
- generated/extracted visual-probe user state.

This is **D3 synthetic/tooling evidence only** for the new asset pipeline. The crucial real-game mount/visual result remains D4 pending.

### Current D4 visual gate
A final documented dev.15 artifact must still be rebuilt from the documentation-aligned branch head. The user will then:
1. install dev.15 over dev.14 without deleting `world_state.v1`;
2. run `VOXModernOverhaul/tools/assets/01_INSTALL_VISUAL_PROBE.cmd`;
3. return `visual_probe_report.txt` if setup differs from expected;
4. launch Story Mode and find the selected common prop;
5. provide a screenshot showing the ~1.65x streamed model;
6. run `03_ROLLBACK_VISUAL_PROBE.cmd` and confirm vanilla visual returns.

Only after those real observations is the visual locator/extract/rebuild/RageOpenV chain promoted to D4. After PASS, the exaggerated diagnostic asset is retired immediately and the next visual checkpoint becomes a meaningful art upgrade rather than another infrastructure proof.

## 2026-09-04 — dev.12 real D4 pass + dev.13 isolated C++ core bridge

### Real dev.12 evidence received
The user returned four files from the real GTA V Enhanced installation:
- `runtime_game_thread.log`
- `asiloader(5).log`
- `RageOpenV(5).log`
- `ScriptHookV(5).log`

Observed facts:
- ASI loader maps `VOXModernOverhaul.asi` and completes plugin enumeration.
- RageOpenV reports successful initialization.
- ScriptHookV reports build `v3889.0/1158.13`, identifies `VER_EN_1_0_1158_13` and explicitly registers `VOXModernOverhaul.asi`.
- `runtime_game_thread.log` contains `VOX_SCRIPT_MAIN_ENTER`.
- The same log contains `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`, proving the ScriptHookV script yielded and resumed rather than only executing during load.
- Exactly five fresh `VOX_SCRIPT_HEARTBEAT` markers were returned.
- User reports the game launches and remains stable.

Conclusion: dev.12 is promoted to the first **D4 real active runtime**. The dev.11 real failure was not a scheduler failure; the export-resolution fallback in dev.12 fixed the registration boundary sufficiently for the user's current ScriptHookV build.

### Why dev.13 splits the runtime
Keeping the full long-lived project in the tiny no-CRT ASI would make normal C++ features unnecessarily difficult and would tempt future code back into the loader callback. The selected production architecture is therefore:

1. `VOXModernOverhaul.asi` stays deliberately tiny and CRT-free.
2. It owns only ASI load safety, ScriptHookV discovery/registration, scheduler entry and host callbacks.
3. `VoxScriptMain` yields through `scriptWait(0)` and only after that resume loads `VOXModernCore.dll`.
4. `VOXModernCore.dll` is a normal C++20 DLL using the tested `vox_core` library.
5. ASI↔Core communication uses a small versioned plain-C ABI so implementation details do not leak across the boundary.

This preserves the safety lesson from dev.8/dev.9 while giving the actual project a normal C++ environment for persistence, entity systems, events and future GTA adapters.

### Core API added
Added `CoreApi.h` with:
- `VOX_CORE_API_VERSION`
- `VoxHostApi`
- host log callback
- `VoxCoreStart`
- `VoxCoreTick`
- `VoxCoreStop`

`VoxCoreStart` validates struct size, API version and callback presence. It refuses a second start, then allocates one test ID through `EntityIdGenerator`. Expected proof markers:
- `VOX_CORE_START`
- `VOX_CORE_ENTITY_ID=1`

The ASI resolves all required core exports and only declares the bridge ready after successful `VoxCoreStart`:
- `VOX_CORE_BRIDGE_READY`

`VoxCoreTick` records the first five core ticks:
- `VOX_CORE_TICK=1` through `VOX_CORE_TICK=5`

No persistent registry/database or GTA native call is present yet; the ID allocation is strictly a bridge proof.

### Loader-context boundary
- `VOXModernCore.dll` is **not** loaded from `VoxDllEntry` / the ASI loader callback.
- The ASI remains CRT-free.
- `LoadLibraryW(VOXModernCore.dll)` occurs only from `VoxScriptMain` after the real ScriptHookV scheduling boundary has already been crossed and resumed.
- Core export failure, API rejection or missing DLL fails closed and writes explicit markers instead of continuing in an ambiguous state.

### Synthetic checkpoint changes
The Windows smoke host now requires:
- core DLL physically present;
- ScriptHook export-drift fallback still working;
- ASI registration;
- ScriptMain entry;
- wait/resume;
- `VOX_CORE_START`;
- `VOX_CORE_ENTITY_ID=1`;
- `VOX_CORE_BRIDGE_READY`;
- at least five core ticks;
- at least five ScriptHook heartbeats.

CI run `33881321657` passed:
- Windows core build/tests;
- Linux core build/tests;
- ASan + UBSan;
- ASI custom PE/CRT boundary;
- fallback ABI path;
- ScriptHook registration and scheduler proof;
- core DLL load/export/start/tick handshake;
- first EntityId marker;
- package creation and content verification.

### Packaging trace issue caught before delivery
The first `dev.13` artifact from run `33881321657` was structurally correct and contained:
- `VOXModernOverhaul.asi`
- `VOXModernCore.dll`
- config
- `BUILD_INFO.txt`
- `README_FIRST_TEST.txt`

Hashes in that artifact matched `BUILD_INFO.txt`, and CI package validation passed. However, manual inspection before user delivery found that `README_FIRST_TEST.txt` still described dev.12. This was a trace/documentation defect, not a binary defect.

Action:
- do **not** deliver that first dev.13 artifact as the final user checkpoint;
- update packaged instructions to Checkpoint 0G/dev.13;
- update PATCHNOTES, STATUS and TODO_PHASE0;
- rebuild from the documented branch head so package commit/hash and instructions describe the same state.

### Current gate
The next user checkpoint is dev.13 real D4 core bridge validation. Required runtime markers:
- `VOX_SCRIPT_MAIN_ENTER`
- `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`
- `VOX_CORE_START`
- `VOX_CORE_ENTITY_ID=1`
- `VOX_CORE_BRIDGE_READY`
- five core tick markers
- five ScriptHook heartbeat markers

No world mutation is attached until this passes.

### Work immediately after dev.13 D4
1. Persistent Entity Registry.
2. Queued/deferred game-thread EventBus adapter.
3. First atomic/versioned persistent-state file including ID high-water mark.
4. Read-only mission-active detector and Story Compatibility skeleton.
5. In parallel, start the Enhanced asset locator/override pipeline so the next major checkpoint can begin producing visible graphical changes rather than remaining runtime-only.

## 2026-09-04 — dev.11 ScriptHookV game-thread lifecycle checkpoint

### Trigger / user validation
- User reports the dev.10 no-CRT baseline now launches GTA V Enhanced normally/repeatably after the earlier remove/restore cycle.
- dev.10 is therefore promoted from provisional to the stable ASI **load baseline**.
- Earlier intermittent crash root cause remains unknown; WER capture tooling remains available instead of inventing a cause after the fact.

### Production lifecycle decision
- The dev.8 `CreateThread`-from-`DllMain` design remains permanently quarantined.
- dev.11 follows the ScriptHookV script lifecycle instead of creating a free-running bootstrap thread.
- The ASI retains a custom CRT-free entrypoint and `/NODEFAULTLIB`.
- ScriptHookV is not directly linked/imported and is not loaded from inside the loader callback.
- On `DLL_PROCESS_ATTACH`, the runtime calls `GetModuleHandleW(L"ScriptHookV.dll")`, then dynamically resolves the pinned x64 `scriptRegister` and `scriptWait` exports.
- If ScriptHookV or either export is absent, the checkpoint fails closed and returns success to the host without scheduling any runtime work.
- When both exports exist, the ASI stores `scriptWait` and calls `scriptRegister(module, VoxScriptMain)`.

### ScriptMain proof design
- `VoxScriptMain` is the only repeated runtime execution path.
- It writes `VOX_SCRIPT_MAIN_ENTER`.
- It calls `scriptWait(0)`.
- Only after that call returns does it write `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT`.
- It then performs five `scriptWait(1000)` cycles and writes one `VOX_SCRIPT_HEARTBEAT` after each resume.
- After five heartbeats it remains resident but inert, calling only `scriptWait(1000)` forever.
- No GTA native, memory patch, gameplay hook, save mutation or world mutation exists in dev.11.

### Runtime binary boundary
- The dev.11 ASI imports only the required Kernel32 APIs for module/export lookup and bounded diagnostic file output.
- CI rejects CRT/C++ runtime imports, TLS and any direct `ScriptHookV.dll` import.
- CI verifies the custom non-zero PE entrypoint and the intended Kernel32 API list.
- `dumpbin.exe` is resolved through Visual Studio `vswhere` and the actual x64 MSVC toolchain rather than assuming PATH configuration.

### Synthetic scheduler harness
Added a test-only fake `ScriptHookV.dll` and `gta5_enhanced.exe` host.

The harness proves these stages separately:
1. fake DLL exposes the exact ScriptHookV x64 ABI export names expected by production runtime;
2. ASI loading actually invokes `scriptRegister`;
3. registered ScriptMain executes;
4. ScriptMain resumes after `scriptWait(0)`;
5. five heartbeat resumes occur.

The fake ScriptHookV is never included in the GTA user package; package verification fails if a `ScriptHookV.dll` is present.

### Blocker 1 — duplicate NOMINMAX under /WX
- First Windows build of the new test targets failed with MSVC C4005 because `NOMINMAX` was defined both by the common CMake platform policy and locally in two new C++ test files.
- Linux and sanitizer paths were unaffected.
- Fix: removed the local macro definitions; the shared CMake definition is the single authority.
- Regression protection: `/WX` remains enabled, so future macro redefinition debt cannot silently ship.

### Blocker 2 — unnecessary PE entrypoint export
- Linker diagnostics showed the custom PE entry function did not need to be exported.
- Fix: removed `__declspec(dllexport)` from `VoxDllEntry` while keeping `/ENTRY:VoxDllEntry`.
- This removes warning debt without changing the runtime entry mechanism.

### Blocker 3 — dumpbin PATH assumption
- Runtime PE verification initially failed despite a successful ASI build because the Windows 2025 / Visual Studio 2026 Actions environment did not expose `dumpbin.exe` on PATH.
- This was a CI tooling failure, not a binary failure.
- Fix: resolve Visual Studio using `vswhere.exe`, locate the installed Hostx64/x64 `dumpbin.exe`, then run import verification with its absolute path.
- The same step subsequently passed and proved the intended dependency boundary.

### Blocker 4 — fake ScriptHookV ABI mismatch
- First scheduler smoke test produced no runtime marker.
- The smoke host was upgraded to fail at explicit stages rather than a generic heartbeat timeout.
- The next run failed specifically at `ABI_EXPORT_SCRIPT_REGISTER`, proving the fake DLL did not expose the exact pinned production export name.
- Cause: relying on compiler-generated C++ mangling in the fake test DLL made the test ABI compiler-version-dependent.
- Production runtime ABI strings were not changed simply to satisfy the fake.
- Fix: fake implementation uses plain internal C functions plus explicit linker `/EXPORT:` aliases for the exact production ABI names.
- Result: exact ABI lookup, registration, ScriptMain execution, wait/resume and five-heartbeat smoke all pass.

### Latest synthetic validation
- Windows core build/tests: PASS.
- Linux core build/tests: PASS.
- ASan + UBSan: PASS.
- dev.11 ASI build: PASS.
- custom PE / intended Kernel32 boundary: PASS.
- no CRT/C++ runtime/TLS/direct ScriptHookV import: PASS.
- exact fake ScriptHookV ABI exports: PASS.
- `scriptRegister` invoked by ASI: PASS.
- ScriptMain execution: PASS.
- `scriptWait(0)` resume: PASS.
- five heartbeat resumes: PASS.
- GTA-ready package creation and required-content verification: PASS.
- fake ScriptHookV redistribution guard: PASS.

### Current evidence boundary
- At dev.11 this lifecycle was D3 synthetic only; the later real dev.11 test failed at registration and dev.12 subsequently fixed it.

## 2026-09-04 — dev.10 intermittent behavior: successful load after remove/restore

### New user evidence
- After prior dev.10 crashes, the user reports manually removing the VOX plugin, putting it back, and then successfully reaching a loaded GTA V Enhanced state.
- `asiloader(3).log` shows the same plugin order as previous attempts: RageOpenV, ScriptHookVDotNet, TrainerV, then `VOXModernOverhaul.asi`, followed by `LOADER: Finished loading *.asi plugins`.
- `ScriptHookV(3).log` reports `INIT: Success, game version is VER_EN_1_0_1158_13` and registers ScriptHookVDotNet/TrainerV normally.
- `RageOpenV(3).log` reports successful initialization.
- dev.10 itself remains intentionally silent because it has no imports, CRT, logging, GTA calls or ScriptHookV calls.

### Interpretation
- This proves the exact dev.10 loading concept is not deterministically incompatible with the current GTA V Enhanced + plugin environment.
- At the time of this entry it was kept provisional; the later user report of normal repeatable launches promoted it to the stable load baseline used for dev.11.
- The exact earlier crash cause remains unresolved.

## 2026-09-04 — dev.9 real crash, binary inspection, dev.10 no-CRT isolation

### User evidence received for dev.9
- User reported GTA V Enhanced still crashed with `0.0.1-dev.9`.
- ASI loader showed RageOpenV, ScriptHookVDotNet, TrainerV and VOX all loaded; adjacent framework logs showed successful initialization.
- No VOX log was expected because explicit project logging had been removed.

### Important dev.9 binary finding
- Despite inert project code, the MSVC-generated DLL still used normal CRT startup.
- Imports included `VCRUNTIME140.dll` and `api-ms-win-crt-runtime-l1-1-0.dll` initialization/termination routines.
- Therefore dev.9 did not prove zero associated startup execution.

### dev.10 design and proof
- Added `NoCrtEntry.c` with `/NODEFAULTLIB`, `/ENTRY:VoxDllEntry`, `/GS-`, `/Zl`.
- No project core, STL, CRT, Win32 API, ScriptHookV or GTA code linked into dev.10.
- PE gates required custom entrypoint, zero import directory and zero TLS.
- Run `33873756374`: Windows/Linux/sanitizers/no-CRT load smoke/package PASS.
- Independent downloaded-package inspection confirmed zero Import/IAT/TLS/LoadConfig/DelayImport/CLR and a tiny `.text` path.

## 2026-09-04 — Real GTA dev.8 crash + dev.9 inert isolation

- dev.8 real log proved Enhanced `1.0.1158.13`, config/dependency detection and exact `CHECKPOINT_OK`, then the game crashed.
- The free thread created from `DllMain` was quarantined rather than extended.
- dev.9 removed project core/logger/filesystem/config/probing/ScriptHook/natives/hooks/memory/save/world work and reduced project logic to immediate success.
- Synthetic inert load passed, but real game still crashed; later CRT inspection motivated dev.10.

## 2026-09-04 — Checkpoint 0: GTA-ready diagnostic ASI + reproducible package

- Added project-local `AGENT.md` as authoritative development contract.
- Added Windows x64 diagnostic ASI and synthetic host.
- Added reproducible `PackageCheckpoint.ps1` with commit and ASI hash in `BUILD_INFO.txt`.
- Windows CI exposed `windows.h` `max` macro pollution; fixed globally with `NOMINMAX`.
- Run `33865763371`: Windows/Linux/sanitizers/ASI smoke/package PASS before real-game test.

## 2026-09-04 — GTA V Enhanced install/build probe foundation

- Added explicit-root Enhanced installation probe requiring `gta5_enhanced.exe`.
- Validates root, executable, MZ/PE signature and AMD64 machine.
- Added Windows file-version reader with `VS_FIXEDFILEINFO` validation.

## 2026-09-04 — Phase 0 execution checklist + config CI promotion

- Added `TODO_PHASE0.md` granular execution tracking.
- Exact config commit `58cec3c98e44da4b7d284cf1ff0743833140b0ed`, CI run `33864582553`: SUCCESS.

## 2026-09-04 — Versioned configuration parser

- Added strict `key=value` parser with mandatory non-zero numeric `schema_version`.
- Duplicate/invalid keys fail closed.
- Typed exact boolean and unsigned readers added.
- Removed incorrect `noexcept` lookup declarations that could have converted allocation failure into `std::terminate`.
- Warnings-as-errors + ASan + UBSan + CTest: PASS.

## 2026-09-04 — CI hardening / concurrent EventBus validation

- Added warnings-as-errors validation mode (`-Werror` / `/WX`).
- EventBus concurrent validation: 4 publisher threads × 1000 events, expected/observed 4000.
- Added `docs/STATUS.md` evidence levels.

## 2026-09-04 — Precommit defect catch / ID generator hardening

- Fixed EventBus use-after-invalidation risk in `Unsubscribe`.
- Corrected a test-edit failure that had omitted generator assertions before commit.
- Added fail-closed EventBus subscription token exhaustion.
- Added resumable `EntityIdGenerator`, reserves zero and fails closed after maximum 64-bit ID.

## 2026-09-04 — Core compile/test checkpoint

- Added typed native EventBus and GitHub Actions Windows/Linux workflow.
- Core configure/compile/link/test passed; no GTA runtime behavior claimed.

## 2026-09-04 — Project initialization / Phase 0 start

- Created charter, architecture, TODO, roadmap, story compatibility contract and data model.
- Visual quality first; persistence/procedural systems mandatory; vanilla story compatibility non-negotiable.
- Critical runtime direction: native C++ with GTA calls isolated behind adapters.
- CodeWalker Enhanced/Gen9, Sollumz Enhanced conversion and OpenRPF non-destructive override paths recorded.
- Stable project IDs, validation gates, patch notes and development log are mandatory.
