# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

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
