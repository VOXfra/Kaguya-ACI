# GTA V Modern World Overhaul — Patch Notes

All user-visible, architectural and tooling changes are recorded here.

## [0.0.1-dev.15] — 2026-09-04

### dev.14 promoted to real D4 persistent-world foundation
- The first real GTA launch created `world_state.v1` and reported `VOX_PERSISTENCE_STATUS=NEW`, system EntityId `1`, entity count `1`, next EntityId `2`, `VOX_PERSISTENCE_SAVE_OK`, the game-thread queue marker and five healthy core/ScriptHook ticks.
- A second real GTA process, without deleting VOX state, reported `VOX_PERSISTENCE_STATUS=LOADED` with the exact same EntityId/count/high-water values and the same queue/tick health.
- GTA remained stable on both launches.
- Persistent Entity Registry, real create→reload high-water restoration and the live bounded game-thread queue path are therefore promoted to **D4 real GTA PASS**.

### First visible Enhanced asset pipeline checkpoint
- Added `tools/assets/vox_visual_probe.py` and one-click Windows wrappers for a real GTA V Enhanced asset round-trip proof.
- The tool indexes the user's own Enhanced installation through FiveFury, selects one common static base-game YDR, extracts it locally, rewrites render geometry at `1.65x` scale, recalculates render bounds/LOD distances, saves it back as Gen9, reopens it and requires validation before install.
- Only base `x64*.rpf/.../*.ydr` candidates are accepted for this first proof. Update/DLC paths, traversal and drive/URI-style paths fail closed.
- Candidate selection skips an already occupied loose destination instead of overwriting another mod.
- The generated loose override is mirrored into RageOpenV's `newmods/platform` mount; Rockstar archives are never modified in place.
- No Rockstar YDR is shipped. Extraction happens locally from the user's own installation.

### Reversible visual proof
- Added `visual_probe_manifest.json` containing source logical/archive path, source hash, generated hash, exact loose destination, selected model and geometry statistics.
- Added `visual_probe_report.txt` for user-visible diagnostics and D4 evidence.
- Added manifest/hash-scoped rollback: only the exact generated file below `newmods/platform` can be removed; rollback refuses deletion if its SHA-256 no longer matches, preventing accidental deletion of another mod/user edit.
- Render collision is intentionally not scaled in the proof. The exaggerated model scale is diagnostic, not final art direction.

### Tooling provenance / dependency boundary
- Pinned FiveFury `0.4.21`, Python `>=3.11`, license The Unlicense/public domain.
- FiveFury is installed into a VOX-local virtual environment at user test time and is **not bundled** in the GTA-ready ZIP.
- User's existing `RageOpenV.asi` is required and is not redistributed.
- Current package verification rejects any shipped `.ydr`, local FiveFury venv, visual-probe user state, fake ScriptHookV or persistent user world state.

### Defect caught before delivery
- The first visual-probe implementation attempted to import a package-level FiveFury `__version__` symbol without first proving that API was exported.
- This was caught during source review before user delivery.
- The initial probe file was deleted/replaced; production code now uses `importlib.metadata.version("fivefury")`, while CI still pins exactly `0.4.21`.
- This prevents a local setup failure caused purely by an unverified package metadata assumption.

### Automated validation
- Core Windows build/tests: PASS.
- Core Linux build/tests: PASS.
- ASan + UBSan: PASS.
- FiveFury 0.4.21 install on Windows CI: PASS.
- Python syntax compilation: PASS.
- Synthetic Gen9 YDR version 159 create → scale → save → reopen: PASS.
- Source YDR version preservation: PASS.
- Vertex scale verification after binary round trip: PASS.
- FiveFury YDR validation after rewrite: PASS.
- RageOpenV `x64*.rpf` → `newmods/platform` path mapping regression: PASS.
- Unsafe update/DLC/traversal/drive-path rejection: PASS.
- Visual PowerShell parser checks: PASS.
- Existing ASI/Core PE boundary and two-process persistence smoke: PASS.
- Package no-YDR/no-venv/no-user-state boundary: PASS.
- Initial dev.15 implementation CI run `33890491053`: fully green before final documentation rebuild.

### Current D4 gate
- Run the one-click visual probe in the real user's Enhanced installation.
- Require `status=INSTALLED`, an exact base `x64*.rpf` source and a generated `newmods/platform` destination.
- GTA must remain stable and a real streamed instance of the chosen model must be visibly oversized.
- Then run hash-safe rollback and confirm vanilla appearance returns.
- After that proof, remove the exaggerated diagnostic change and move directly to a meaningful foliage/material/road visual upgrade and the graphical vertical slice.

## [0.0.1-dev.14] — 2026-09-04

### dev.13 promoted to real D4 core bridge
- Real GTA V Enhanced evidence confirms the validated ScriptHookV lifecycle still enters and resumes correctly with the split runtime architecture.
- `VOXModernCore.dll` starts successfully in the real game, the ASI/Core bridge reaches `VOX_CORE_BRIDGE_READY`, and five core ticks execute while GTA remains stable.
- The isolated C++ core bridge is therefore promoted from synthetic D3 to **real D4**.

### Persistent Entity Registry
- Added `EntityRegistry` as the first persistent identity container for future pedestrians, vehicles, properties, animals and project-system records.
- IDs remain stable `uint64_t` values with zero reserved as invalid.
- Restored records are rejected if their ID is invalid, duplicated, has an invalid entity kind, or is not strictly below the persisted next-ID high-water mark.
- Deterministic snapshots are produced in ascending EntityId order.

### Versioned atomic world state
- Added world-state schema v1 with strict text parsing and a fixed magic header.
- State contains `next_entity_id`, entity count and persistent entity records.
- Added FNV-1a 64-bit checksum over the committed body; tampered, truncated, partially written or structurally invalid states fail closed.
- State files larger than 256 MiB are rejected before allocation/read.
- Saves use a `.tmp` file, disk flush and atomic replacement.
- The previous committed state is retained as `.bak`; an invalid primary can recover from a valid backup.
- Runtime does not touch GTA V's vanilla save files; VOX state lives under `VOXModernOverhaul/state/`.

### Runtime persistence proof
- On a clean first launch the core creates one `EntityKind::System` record with persistent `EntityId=1`, persists `next_entity_id=2`, and reports `VOX_PERSISTENCE_STATUS=NEW`.
- On the next launch the same state is restored rather than recreated and reports `VOX_PERSISTENCE_STATUS=LOADED`.
- Backup recovery reports `VOX_PERSISTENCE_STATUS=RECOVERED_FROM_BACKUP`; unrecoverable state reports `INVALID` and disables core startup rather than inventing data.

### Controlled game-thread dispatch
- Added `GameThreadQueue`, a bounded drain queue intended as the only bridge for future work that must execute from the validated GTA/ScriptHookV game thread.
- Producers may enqueue concurrently.
- Tasks queued during a drain are deferred to a later tick.
- One handler throwing does not prevent later queued work from running; failures are counted and reported.
- dev.14 queues one harmless marker task and proves it executes from a Core tick with `VOX_GAME_THREAD_QUEUE_DISPATCHED=1`.

### Regression coverage
- Added dedicated persistence tests for registry invariants, serialization round-trip, checksum tampering, duplicate IDs, atomic save, high-water restoration and `.bak` recovery.
- Added bounded/re-entrant/concurrent game-thread queue tests.
- Runtime smoke now launches two separate synthetic `gta5_enhanced.exe` processes: process one creates the state; process two must restore the exact same EntityId/high-water state.
- Package verification rejects accidentally shipping CI-generated user state.
- Windows core tests: PASS.
- Linux core tests: PASS.
- ASan + UBSan: PASS.
- PE/CRT ASI boundary: PASS.
- double-process persistence restore: PASS.
- package verification/upload: PASS.
- CI run `33885665383`: fully green before documentation-only final rebuild.

### No gameplay mutation yet
- dev.14 still performs no GTA native calls, no memory patches, no mission changes and no ped/vehicle/world mutation.
- This checkpoint establishes the persistent world substrate needed before persistent NPCs, properties, wildlife, investigations and destruction state can safely exist.

### Next gate
- Real GTA two-launch persistence validation.
- In parallel, begin the Enhanced asset locator/override pipeline and read-only mission/story detection so the next major checkpoints can move toward the first visible graphics replacement without sacrificing story compatibility.

## [0.0.1-dev.13] — 2026-09-04

### dev.12 promoted to real D4 active runtime
- Real GTA V Enhanced evidence now confirms `VOXModernOverhaul.asi` is registered by ScriptHookV on Enhanced `1.0.1158.13`.
- `runtime_game_thread.log` contains `VOX_SCRIPT_MAIN_ENTER`, `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` and five fresh `VOX_SCRIPT_HEARTBEAT` markers.
- GTA remains stable in the validated launch.
- The ScriptHookV lifecycle gate is therefore promoted from synthetic D3 to **real D4 active runtime**.

### Isolated C++ core bridge
- Added `VOXModernCore.dll` as the normal C++20 project runtime behind a small plain-C versioned ABI.
- The validated CRT-free ASI remains the minimal ScriptHookV host.
- `VOXModernCore.dll` is loaded only after `ScriptMain` has entered and resumed through `scriptWait(0)`; it is never loaded from the ASI loader callback.
- Added `VoxCoreStart`, `VoxCoreTick` and `VoxCoreStop` exports plus a versioned `VoxHostApi` callback contract.
- The core allocates the first test EntityId through the existing `EntityIdGenerator` and logs `VOX_CORE_ENTITY_ID=1`.
- The host/core handshake logs `VOX_CORE_START`, `VOX_CORE_BRIDGE_READY` and five `VOX_CORE_TICK=n` markers.
- No GTA natives, hooks, memory patches, save writes or world mutations are active yet.

### Validation and packaging
- Windows core build/tests: PASS.
- Linux core build/tests: PASS.
- ASan + UBSan: PASS.
- CRT-free ASI PE boundary: PASS.
- ScriptHookV export-drift fallback: PASS.
- ScriptHook registration + wait/resume smoke: PASS.
- C++ core DLL load/export/start/tick handshake: PASS.
- First EntityId allocation marker: PASS.
- Package contains both `VOXModernOverhaul.asi` and `VOXModernCore.dll`: PASS.
- Package excludes fake test `ScriptHookV.dll`: PASS.
- CI run `33881321657`: fully green.

### Traceability fix before delivery
- The first dev.13 artifact inherited the old dev.12 `README_FIRST_TEST.txt` because packaging instructions had not yet been advanced with the new core-bridge checkpoint.
- That artifact is not delivered as final.
- Packaged test instructions were updated to dev.13 and a new documented build was produced before delivery.

### Real-game outcome
- PASS: `VOX_SCRIPT_MAIN_ENTER` and `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` remain healthy.
- PASS: `VOX_CORE_START` observed.
- PASS: `VOX_CORE_ENTITY_ID=1` observed.
- PASS: `VOX_CORE_BRIDGE_READY` observed.
- PASS: five `VOX_CORE_TICK=n` markers observed alongside five ScriptHookV heartbeats.
- dev.13 is the first **real D4 isolated C++ core bridge**.

## [0.0.1-dev.12] — 2026-09-04

### Real dev.11 result
- GTA V Enhanced remained stable with dev.11 installed, but `VOXModernOverhaul/runtime_game_thread.log` was not created.
- ASI-loader evidence confirmed `VOXModernOverhaul.asi` was mapped and plugin enumeration completed.
- ScriptHookV initialized Enhanced `1.0.1158.13` but did not register VOXModernOverhaul.
- dev.11 therefore passed ASI loading but failed the real ScriptHookV registration gate before ScriptMain executed.

### dev.12 compatibility fix
- Keeps the no-CRT custom-entrypoint architecture and restricted Kernel32 import boundary.
- Export resolution uses historical exact name, undecorated alias, then PE export-name scan for unique semantic `scriptRegister` / `scriptWait` identifiers.
- Ambiguous matches fail closed.
- Fake ScriptHookV deliberately exposes drifted names to force the fallback path in regression testing.

### Real-game outcome
- PASS: ScriptHookV registers `VOXModernOverhaul.asi`.
- PASS: `VOX_SCRIPT_MAIN_ENTER` observed.
- PASS: `VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT` observed.
- PASS: five `VOX_SCRIPT_HEARTBEAT` markers observed.
- PASS: GTA remains stable.
- dev.12 is the first **real D4 active runtime** foundation.

## [0.0.1-dev.11] — 2026-09-04
- Added the proper ScriptHookV lifecycle checkpoint while retaining a CRT-free ASI host.
- Synthetic registration, ScriptMain execution, wait/resume and heartbeat tests passed.
- Real GTA proved the ASI loaded but did not register because exact decorated export resolution was too brittle.

## [0.0.1-debug.2] — 2026-09-04
- dev.10 began launching successfully after the earlier remove/restore cycle and was later promoted to the stable no-CRT load baseline.

## [0.0.1-debug.1] — 2026-09-04
- Added reversible WER LocalDumps crash-capture tooling after dev.10 initially still crashed.
- Final crash-capture run `33875088958`: parser, fake-GTA collector, package and artifact checks PASS.

## [0.0.1-dev.10] — 2026-09-04
- Added custom no-CRT entrypoint with `/NODEFAULTLIB`, zero-import/TLS isolation and independent PE verification.
- Exact package commit `a193e307a443e491f13e6576f8ea18896f91945c`, run `33873756374`.

## [0.0.1-dev.9] — 2026-09-04
- Removed explicit project bootstrap logic; later PE inspection showed default MSVC CRT/VCRUNTIME startup remained.

## [0.0.1-dev.8] — 2026-09-04
- Added first diagnostic ASI, project-local `AGENT.md`, synthetic runtime smoke and reproducible packaging.
- Real GTA reached `CHECKPOINT_OK` then crashed; free-thread-from-`DllMain` path was permanently quarantined.

## [0.0.1-dev.7] — 2026-09-04
- Added explicit-root Enhanced install/PE/architecture probing and Windows file-version reader.

## [0.0.1-dev.6] — 2026-09-04
- Added granular Phase 0 execution checklist and promoted config parser to D3 cross-platform.

## [0.0.1-dev.5] — 2026-09-04
- Added strict versioned configuration parsing with mandatory schema and typed readers.

## [0.0.1-dev.4] — 2026-09-04
- Added warnings-as-errors mode, concurrent EventBus validation, sanitizer CI and engineering status tracking.

## [0.0.1-dev.3] — 2026-09-04
- Added resumable `EntityIdGenerator` and hardened EventBus/token exhaustion behavior.

## [0.0.1-dev.2] — 2026-09-04
- Added typed native EventBus and Windows/Linux core CI.

## [0.0.1-dev.1] — 2026-09-04
- Established project charter, architecture, TODO, roadmap, story-compatibility contract, data model, C++20 core, logger and initial tests.
