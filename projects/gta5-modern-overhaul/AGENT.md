# AGENT.md — GTA V Modern World Overhaul

This file defines the permanent engineering rules for this project. Any agent, contributor or automation working under `projects/gta5-modern-overhaul/` must follow them.

## Mission

Modernize GTA V Enhanced while preserving the original GTA V story and map. The target is a game that looks, feels and behaves like a modern Rockstar title, while going further where procedural systems can produce better results.

Visual quality is the first production priority. Persistent world simulation, procedural interaction, improved characters, vehicles, wildlife, crime, emergency services, destruction/reconstruction and story-safe world evolution are long-term pillars.

## User-development contract

The user is not expected to author code, materials, meshes, animations or technical configuration. The project must automate technical work wherever reasonably possible. The user's normal role is to install/drop test packages, launch GTA V Enhanced, reproduce a requested scenario and return logs/screenshots/video or subjective visual feedback.

If a design choice depends on taste, desired behavior or a subjective target that has not already been specified, **ask the user instead of inventing a preference**.

Do not ask about implementation details that can be resolved safely through engineering analysis.

## Continuous-progress rule

Do not stop after an isolated primitive, helper or partially useful tool. Continue until a meaningful checkpoint is reached.

A checkpoint must produce at least one of these:

- a user-testable GTA package;
- a validated reusable tool that unlocks the next production stage;
- a proven vertical slice;
- a technically decisive result that changes the architecture.

At every completed user-testable stage, produce a ZIP intended to be copied into the GTA V Enhanced root, plus exact test instructions and rollback instructions.

## Blocker protocol

Never loop indefinitely on a blocking action.

When something blocks:

1. stop repeating the failing operation;
2. isolate the smallest failing component;
3. collect the exact error/log/state;
4. reproduce it in the smallest possible harness where practical;
5. identify the root cause or explicitly bound what is unknown;
6. change the approach if the current dependency/path is structurally unreliable;
7. add a regression test or validation check for the discovered failure mode;
8. resume only after the blocker is removed or safely bypassed.

A workaround is acceptable only when it is understood, documented and does not silently weaken story compatibility, persistence correctness or data safety.

## Correctness gates

Never describe code as working in GTA merely because it compiles.

Validation levels are defined in `docs/QUALITY_GATES.md` and must remain evidence-based.

Minimum engineering expectations where applicable:

- C++20;
- warnings treated as errors in validation builds;
- Windows/MSVC and Linux CI for portable core code;
- ASan + UBSan on supported Linux test targets;
- deterministic unit/regression tests for core logic;
- explicit negative-path tests;
- fail-closed behavior for unsupported/corrupt state;
- no silent integer wraparound for persistent identifiers;
- no unchecked story-world mutation;
- no owning raw-pointer architecture in persistent systems;
- no claim of D4/in-game validation until an actual GTA V Enhanced test has occurred.

For user-facing installers/bootstrap scripts, syntax or parser validation alone is insufficient whenever the critical setup path can reasonably execute in CI. Execute the real bootstrap path before delivery — including process invocation, argument quoting, environment/venv creation, version probes and dependency/self-test launch as applicable. A parse-only PASS must never be presented as evidence that an installer runs.

When a defect is found before release, document both the defect and the regression protection that prevents recurrence.

## Story compatibility

The original GTA V campaign must remain playable from beginning to end.

Ambient simulation may never permanently corrupt mission-critical state. Systems that alter buildings, population, vehicles, ownership, time, interiors, map variants or destruction must integrate with the Story Compatibility Manager/canonical overlay design before global deployment.

When uncertain whether a change is mission-safe, default to disabled for mission-owned entities/areas until proven safe.

## Persistence contract

Persistent people, animals, vehicles, properties and cases use project-stable IDs. GTA runtime handles are temporary adapters only.

World consequences must not be erased merely because the player leaves the area. Offscreen simulation may become abstract, but identity/state continuity must remain.

## Procedural-first rule

Prefer reusable procedural systems over thousands of bespoke scripted scenes when quality can be maintained or improved.

Examples include:

- hand/foot IK;
- natural handle/door interaction;
- clothing changes;
- body/garment adaptation;
- contextual melee alignment;
- construction jobs;
- household routines;
- wildlife behavior;
- emergency-service handling;
- animation variation.

Procedural does **not** mean low-quality randomization. Constraints, style profiles, physical plausibility and animation quality remain mandatory.

## Asset/tool policy

Use existing tools, GitHub repositories, Hugging Face models and community mods as force multipliers when useful.

Before incorporating external code/assets into distributable builds:

- verify provenance;
- record license/permission;
- avoid redistribution when rights are unclear;
- prefer clean-room reimplementation when only behavior/reference is usable.

Do not use leaked Rockstar source code or redistribute leaked proprietary assets.

## Traceability — mandatory on every meaningful change

Maintain all relevant records in the same development cycle:

- `PATCHNOTES.md` — concise versioned user/engineering changes;
- `docs/DEV_LOG.md` — exact work, reasoning, defects, tests, boundaries;
- `docs/STATUS.md` — evidence-backed validation state;
- `docs/TODO_PHASE0.md` or the active phase checklist — implementation state;
- `docs/TODO.md` when project scope changes.

Never mark a parent TODO complete because one sub-primitive exists.

## Packaging rule

Every completed user-testable stage must have a reproducible package. The preferred ZIP layout is directly mergeable into the GTA V Enhanced root.

Packages must include:

- only files needed for that stage;
- a version identifier;
- first-test instructions;
- expected log/output path;
- rollback/removal instructions;
- known limitations.

Never bundle third-party binaries unless redistribution rights are clear.

## Performance rule

Do not brute-force full-fidelity simulation of the entire map. Preserve continuity with simulation LOD, event-driven updates, spatial relevance, pooling and deterministic rematerialization.

## Quality target

The target is not merely "better than vanilla". User-facing assets and behaviors should ultimately be clearly superior to GTA V Enhanced's original implementation and coherent with the project's modern visual/systemic target.
