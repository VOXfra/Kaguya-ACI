# TODO — Phase 0 / Tooling & Core

This checklist is the granular execution list for Phase 0. The high-level feature inventory remains in `TODO.md`.

Legend:
- `[x]` = implemented and validated at the stated gate
- `[ ]` = not yet complete
- `IN PROGRESS` = implementation exists but the required validation gate is still pending

## Core quality / traceability

- [x] C++20 standalone core scaffold — D3 cross-platform
- [x] CMake warnings policy — D3 cross-platform
- [x] warnings-as-errors validation mode — D3 cross-platform
- [x] global MSVC `NOMINMAX` protection against Win32 macro pollution — D3 Windows
- [x] GitHub Windows/Linux build+test CI — D3
- [x] Linux ASan + UBSan CI — D3
- [x] project-local `AGENT.md` development contract — active
- [x] project patch notes — active
- [x] precise development log — active
- [x] evidence-based engineering status table — active
- [ ] add formatting/static-analysis gate (clang-format/clang-tidy or equivalent)
- [x] reproducible user-testable artifact build — D3 Windows

## Diagnostics

- [x] thread-safe file logger foundation — D3 cross-platform
- [ ] log rotation / bounded size
- [ ] structured subsystem/event fields
- [ ] crash/exception capture
- [ ] minidump or equivalent Windows crash artifact
- [x] startup environment/build report foundation — dev.8 real execution observed
  - [x] process path
  - [x] Enhanced install validation status
  - [x] Windows GTA executable file version
  - [x] ASI loader (`dinput8.dll`) presence
  - [x] ScriptHookV presence
  - [ ] full runtime dependency/build compatibility report
- [ ] capture Windows crash code/module/stack for future D4 failures instead of relying only on adjacent logs

## Persistent identity

- [x] stable `EntityId` primitive — D3 cross-platform
- [x] resumable `EntityIdGenerator` — D3 cross-platform
- [x] zero reserved as invalid ID
- [x] fail-closed 64-bit exhaustion
- [ ] Entity Registry
- [ ] GTA runtime handle ↔ stable EntityId adapter
- [ ] persisted high-water mark integration
- [ ] duplicate/corrupt ID database recovery test

## Event architecture

- [x] typed EventBus — D3 cross-platform
- [x] subscription tokens
- [x] unsubscribe behavior
- [x] re-entrant publication
- [x] concurrent publication test (4 × 1000)
- [x] subscription-ID fail-closed exhaustion
- [ ] explicit event taxonomy / namespaces
- [ ] queued/deferred game-thread dispatch adapter
- [ ] handler failure isolation policy
- [ ] event tracing hooks

## Simulation fidelity

- [x] simulation-tier primitive — D3 cross-platform
- [ ] Spatial Simulation Manager
- [ ] distance/relevance promotion rules
- [ ] deterministic dematerialize/rematerialize contract
- [ ] simulation-budget governor
- [ ] stress test with large abstract population

## Configuration

- [ ] complete versioned config system — IN PROGRESS
  - [x] strict `key=value` parser — D3 cross-platform
  - [x] mandatory numeric `schema_version` — D3 cross-platform
  - [x] duplicate-key rejection — D3 cross-platform
  - [x] typed bool/unsigned readers — D3 cross-platform
  - [x] ASan/UBSan + warnings-as-errors validation
  - [x] Windows/Linux/sanitizer CI validation
  - [x] dev.8 runtime config packaged and parsed in synthetic + real GTA bootstrap
  - [x] malformed/missing dev.8 runtime config fails closed in bootstrap
  - [ ] typed project runtime schema
  - [ ] schema migration framework
  - [ ] atomic file write / rollback
  - [ ] production malformed-config recovery/default policy

## GTA V Enhanced environment

- [ ] Enhanced install/build detector — IN PROGRESS
  - [x] explicit-root directory probe — D3 cross-platform
  - [x] exact `gta5_enhanced.exe` requirement — D3 cross-platform
  - [x] `MZ` + `PE` signature validation — D3 cross-platform
  - [x] AMD64 machine validation — D3 cross-platform
  - [x] detector Windows/Linux/sanitizer CI
  - [x] Windows file-version reader CI validation — D3 Windows
  - [x] real dev.8 execution confirmed Enhanced probe + version `1.0.1158.13`
  - [ ] supported-build policy mapping
- [ ] Epic install discovery
- [ ] Steam install discovery
- [ ] Rockstar Launcher install discovery
- [ ] explicit user-path config wiring for external tools
- [ ] tool discovery: CodeWalker
- [ ] tool discovery: OpenRPF
- [ ] tool discovery: Blender/Sollumz
- [ ] OpenIV optional discovery/reference workflow

## Native runtime adapter

- [ ] complete native runtime adapter — IN PROGRESS / crash isolation active
  - [x] minimal Windows x64 ASI binary target — D3
  - [x] dev.8 host-process validation (`gta5_enhanced.exe`)
  - [x] dev.8 fail-closed exception boundary
  - [x] dev.8 synthetic x64 Enhanced-named host loads generated ASI — D3
  - [x] dev.8 synthetic bootstrap reaches exact `CHECKPOINT_OK`
  - [x] dev.8 real GTA process loads ASI and reaches exact `CHECKPOINT_OK`
  - [ ] dev.8 real GTA runtime stability — **FAILED; game crashed after checkpoint**
  - [x] isolate previous runtime by removing `CreateThread`, logging, filesystem/config, probing and project-core dependencies — dev.9
  - [x] dev.9 inert ASI synthetic load/residency/unload — D3, run `33872399873`
  - [ ] dev.9 inert ASI real GTA stability — **CURRENT USER CHECKPOINT**
  - [ ] determine whether dev.8 asynchronous `DllMain` bootstrap is the actual crash root cause
  - [ ] ScriptHookV SDK acquisition/documented dependency for native calls
  - [ ] ScriptHookV/game-thread registration adapter
  - [ ] one safe in-game tick
  - [ ] supported-build policy + graceful disable
  - [ ] plugin unload/shutdown lifecycle for later stateful systems
- [ ] first stable GTA V Enhanced D4 runtime validation

### Quarantined path

The dev.8 `CreateThread`-from-`DllMain` bootstrap is **quarantined**. Do not build new runtime systems on top of it. It may only return if later evidence proves it unrelated to the crash; otherwise replace it permanently with the ScriptHookV/game-thread lifecycle.

## Packaging / rollback

- [x] reproducible PowerShell checkpoint packager — D3 Windows
- [x] package contains only project files; no third-party binaries
- [x] ASI SHA-256 recorded in `BUILD_INFO.txt`
- [x] commit/version recorded in `BUILD_INFO.txt`
- [x] generated ZIP extracted and required files verified in CI
- [x] first-test instructions packaged
- [x] explicit removal/rollback instructions packaged
- [x] dev.8 GitHub Actions artifact upload
- [x] dev.9 GitHub Actions artifact upload — run `33872399873`
- [ ] installer/automatic root detection for later public builds

## Story compatibility foundation

- [ ] mission/story detector research
- [ ] detect mission-active state reliably
- [ ] Story Compatibility Manager skeleton
- [ ] canonical overlay interface
- [ ] ambient-system pause/resume interface
- [ ] first harmless mission regression test

Checkpoints dev.8/dev.9 do not intentionally mutate GTA world/story state. Story compatibility work resumes only after a stable D4 runtime exists.

## Asset pipeline

- [ ] identify on-screen asset → source resource proof
- [ ] asset dependency locator
- [ ] export working copy
- [ ] Enhanced conversion validation
- [ ] non-destructive OpenRPF override package
- [ ] rollback/disable path
- [ ] automated before/after test package
- [ ] first in-game asset replacement D4

## Current checkpoint

**Checkpoint 0B — real GTA V Enhanced inert ASI stability (`0.0.1-dev.9`)**

Automated validation is complete:

1. Windows/MSVC core build + tests — PASS.
2. Linux core build + tests — PASS.
3. ASan + UBSan — PASS.
4. Windows inert x64 ASI build — PASS.
5. synthetic inert ASI load/residency/unload — PASS.
6. package generation + extraction/verification — PASS.
7. artifact upload — PASS.
8. exact GitHub Actions run: `33872399873`.

User test:

1. Replace the previous `VOXModernOverhaul.asi` with `dev.9`.
2. Launch GTA V Enhanced normally.
3. Enter Story Mode if possible and remain loaded for at least 2–5 minutes / past the dev.8 failure point.
4. Report whether the game remains stable or crashes, plus approximate timing/context.
5. No new VOX `bootstrap.log` is expected; dev.9 intentionally performs no logging.

Decision after result:

- **Stable:** reject the old asynchronous bootstrap and implement proper ScriptHookV/game-thread registration.
- **Still crashes:** move one layer lower and isolate ASI binary/load/toolchain/loader interaction; do not retry bootstrap logic.
