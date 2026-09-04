# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — Core compile/test checkpoint

### Event system
- Added a typed native `EventBus`.
- Subscriptions return explicit tokens carrying event type and unique ID.
- Unsubscribe is idempotent from the caller's perspective: first valid removal succeeds, repeated removal reports failure rather than silently claiming success.
- Publish copies callback handles while holding the mutex, then releases the mutex before invoking callbacks.
- This permits re-entrant publication and avoids a simple deadlock class where a handler publishes another event.

### Automated build protection
- Added GitHub Actions workflow for Linux and Windows.
- Workflow configures, builds and runs CTest only for the GTA overhaul subproject.
- Changes outside this project do not needlessly trigger this CI job.

### Local validation performed
Environment:
- GNU C++ 14.2.0
- CMake
- C++20
- warnings: `-Wall -Wextra -Wpedantic`

Result:
- configure: PASS
- compile: PASS
- link: PASS
- tests: 1/1 PASS
- failed tests: 0

Tested invariants:
- invalid `EntityId` is always invalid
- non-zero IDs are valid and ordered correctly
- simulation tier fidelity ordering
- logger creates and writes its file
- EventBus returns valid tokens
- multiple subscribers receive events
- nested/re-entrant publish works
- unsubscribe removes only the selected subscription
- repeated unsubscribe does not report a false success

### Validation boundary
- The isolated core is validated on Linux/GCC for these exact tests.
- Windows/MSVC is pending CI observation.
- No GTA runtime adapter exists yet.
- No claim is made about in-game behavior yet.

### Next checkpoint
1. Observe Windows/Linux CI.
2. Add versioned configuration with strict parsing and safe defaults.
3. Add persistent ID allocation/registry rather than only the `EntityId` primitive.
4. Add Windows GTA V Enhanced install/build detection.
5. Audit and integrate the minimal native ScriptHookV adapter.

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

### Code created
- C++20 project scaffold.
- `EntityId` primitive with explicit invalid state.
- `SimulationTier` primitive for physical/local/regional/dormant simulation.
- Thread-safe diagnostic file logger.
- Unit-test executable covering core invariants.

### Validation performed
- Manual static review of ownership/lifetime: no raw owning pointers in the initial core.
- Core types use standard-library-only dependencies.
- Invalid entity ID is represented by zero and cannot be confused with a valid generated ID by design.
- Logger serializes concurrent writes with a mutex and creates parent directories before opening the file.

### Not yet validated
- No GTA V Enhanced runtime hook has been compiled or launched yet.
- No asset has been replaced in-game yet.
- No claim is made that ScriptHookV SDK integration code works until it is built against the actual SDK and tested in Enhanced.

### Next engineering checkpoint
1. Compile the standalone core and tests.
2. Fix every compiler/test failure before proceeding.
3. Add deterministic EventBus and config schema.
4. Add Windows Enhanced install/build detector.
5. Add the minimal GTA adapter and a single diagnostic in-game tick/log proof.
