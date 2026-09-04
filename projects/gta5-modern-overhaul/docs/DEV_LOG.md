# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — CI hardening / concurrent EventBus validation

### Build policy
- Added `VOX_WARNINGS_AS_ERRORS` CMake option.
- GNU/Clang-style builds use `-Werror` in validation mode.
- MSVC builds use `/WX` in validation mode.
- Existing warning baselines remain `/W4 /permissive- /EHsc` on MSVC and `-Wall -Wextra -Wpedantic` elsewhere.

### Concurrent EventBus validation
- Added one concurrent subscriber backed by an atomic counter.
- Spawned 4 publishing threads.
- Each thread publishes 1000 events.
- Expected delivered count: 4000.
- Observed locally: 4000.

### Sanitizer validation
- Rebuilt with AddressSanitizer and UndefinedBehaviorSanitizer.
- Warnings treated as errors simultaneously.
- Configure: PASS.
- Compile/link: PASS.
- CTest: 1/1 PASS.
- Sanitizer diagnostics: none observed in the executed test path.

### CI changes
- Windows + Linux build/test matrix remains mandatory.
- Added dedicated Ubuntu ASan + UBSan job.
- CI status is not promoted until the workflow result for the exact commit is observed.

### Traceability
- Added `docs/STATUS.md` to distinguish design, local-test, cross-platform and in-game validation levels.

## 2026-09-04 — Precommit defect catch / ID generator hardening

### Defects caught before in-game integration
- During review of the first EventBus implementation, detected a use-after-invalidation risk: `Unsubscribe` could erase the map entry and then read the referenced vector's size. Fixed by computing the removal result before erasing the owning map entry.
- Detected that the first automated edit intended to add `EntityIdGenerator` tests had only inserted the include/using declarations, not the actual assertions. The test source was inspected directly, corrected, then rebuilt.
- Identified theoretical EventBus subscription-ID wraparound risk. Replaced naïve atomic increment behavior with fail-closed exhaustion semantics so token IDs can never silently wrap and collide.

### ID allocation
- Added `EntityIdGenerator`.
- Zero remains permanently reserved for invalid IDs.
- Generator can resume from a persisted next-ID/high-water value.
- The maximum 64-bit ID is issued at most once; subsequent allocation returns failure rather than wrapping.

### Validation performed
- Clean CMake rebuild.
- GNU C++ 14.2.0 / C++20.
- AddressSanitizer enabled.
- UndefinedBehaviorSanitizer enabled.
- Core test executable built and linked successfully.
- `ctest`: 1/1 PASS, 0 failed.

## 2026-09-04 — Core compile/test checkpoint

### Event system
- Added a typed native `EventBus`.
- Subscriptions return explicit tokens carrying event type and unique ID.
- Publish copies callback handles while holding the mutex, then releases the mutex before invoking callbacks, permitting re-entrant publication.

### Automated build protection
- Added GitHub Actions workflow for Linux and Windows.
- Workflow configures, builds and runs CTest only for the GTA overhaul subproject.

### Local validation performed
- GNU C++ 14.2.0, CMake, C++20.
- configure: PASS.
- compile/link: PASS.
- tests: 1/1 PASS.

### Validation boundary
- No GTA runtime adapter exists yet.
- No claim is made about in-game behavior yet.

## 2026-09-04 — Project initialization / Phase 0 start

### Scope frozen
- Created the project charter, architecture, TODO, roadmap, story-compatibility contract and initial data model.
- Declared visual quality as the first production priority after tooling/audit.
- Declared persistent consequences and procedural systems as architectural requirements.
- Declared vanilla story compatibility as non-negotiable.

### Runtime research
- Confirmed current GTA V Enhanced support exists in ScriptHookV.
- Confirmed official ScriptHookVDotNet does not provide a sufficiently reliable Enhanced foundation for this project.
- Reviewed the Enhanced SHVDN fork and noted its documented threading limitation.
- Decision: use native C++ for the critical runtime; keep GTA-specific calls behind adapters.

### Asset-tool research
- CodeWalker explicitly detects GTA V Enhanced / Gen9 installs.
- Sollumz documents Enhanced asset conversion workflows.
- OpenRPF is the intended non-destructive modified-RPF loader for Enhanced asset overrides.

### Engineering rules introduced
- Core world logic must compile without GTA or ScriptHook SDK dependencies.
- Each persistent entity uses a stable project ID rather than relying on transient GTA handles.
- Every feature receives a validation status: design-only, unit-tested, integration-tested, or in-game validated.
- No feature is marked complete in TODO before its stated validation gate passes.
- Every code/content change updates both this log and `PATCHNOTES.md` when it affects project state.
