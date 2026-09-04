# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — Versioned configuration parser

### Implemented
- Added `ConfigParseResult` with structured errors, parsed values and explicit schema version.
- Added strict `key=value` parser supporting blank lines, comments, CRLF/LF and trimmed whitespace.
- `schema_version` is mandatory, numeric, non-zero and constrained to `uint32_t` range.
- Duplicate keys fail closed.
- Invalid keys fail closed.
- Typed readers exist for exact lowercase booleans (`true`/`false`) and unsigned integers.

### Correctness review
- Initial lookup methods were declared `noexcept` while constructing a temporary `std::string` for unordered-map lookup could allocate and theoretically throw.
- Removed those `noexcept` declarations before commit so allocation failure is not converted into unintended `std::terminate`.

### Tests
- valid CRLF config parses with schema 1
- boolean read succeeds
- unsigned read succeeds
- duplicate schema key invalidates document
- missing schema invalidates document
- non-numeric schema invalidates document

### Local validation
- warnings as errors: PASS
- ASan: PASS
- UBSan: PASS
- CTest: 1/1 PASS

### Existing CI evidence
- Workflow run `33864368881` for commit `610bd41699854a6cc0f3f2ef824005bb85b38a39`: SUCCESS.
- That run validated Windows/Linux build/test plus sanitizer job for the preceding core state.
- Config changes require a new exact-commit run before cross-platform promotion.

## 2026-09-04 — CI hardening / concurrent EventBus validation

### Build policy
- Added `VOX_WARNINGS_AS_ERRORS` CMake option.
- GNU/Clang-style builds use `-Werror` in validation mode.
- MSVC builds use `/WX` in validation mode.
- Existing warning baselines remain `/W4 /permissive- /EHsc` on MSVC and `-Wall -Wextra -Wpedantic` elsewhere.

### Concurrent EventBus validation
- Added one concurrent subscriber backed by an atomic counter.
- Spawned 4 publishing threads × 1000 events.
- Expected and observed delivered count: 4000.

### Sanitizer validation
- AddressSanitizer + UndefinedBehaviorSanitizer: PASS.
- Warnings treated as errors simultaneously: PASS.

### Traceability
- Added `docs/STATUS.md` to distinguish design, local-test, cross-platform and in-game validation levels.

## 2026-09-04 — Precommit defect catch / ID generator hardening

### Defects caught before in-game integration
- Fixed EventBus use-after-invalidation risk in `Unsubscribe` by computing the result before erasing its owning map entry.
- Detected that an automated test edit had failed to insert generator assertions; inspected test source, corrected it and rebuilt.
- Replaced theoretical EventBus token-ID wraparound with fail-closed exhaustion semantics.

### ID allocation
- Added `EntityIdGenerator`.
- Zero permanently reserved for invalid IDs.
- Resume from persisted next-ID/high-water value.
- Maximum 64-bit ID issued at most once, then allocation fails closed.

### Validation
- GNU C++ 14.2.0 / C++20.
- ASan + UBSan.
- CTest 1/1 PASS.

## 2026-09-04 — Core compile/test checkpoint

- Added typed native EventBus.
- Added GitHub Actions Windows/Linux workflow.
- Core configure/compile/link/test passed locally.
- No GTA runtime behavior claimed.

## 2026-09-04 — Project initialization / Phase 0 start

### Scope frozen
- Created charter, architecture, TODO, roadmap, story-compatibility contract and initial data model.
- Visual quality is first production priority after tooling/audit.
- Persistence/procedural systems are architectural requirements.
- Vanilla story compatibility is non-negotiable.

### Runtime/tool research
- ScriptHookV supports current Enhanced builds.
- Official ScriptHookVDotNet is not considered a sufficiently reliable Enhanced foundation for this project's critical runtime.
- Enhanced SHVDN fork threading limitation recorded.
- Decision: native C++ critical runtime with GTA calls isolated behind adapters.
- CodeWalker Enhanced/Gen9 detection confirmed.
- Sollumz Enhanced conversion workflow recorded.
- OpenRPF selected for non-destructive Enhanced asset override loading.

### Engineering rules
- Core logic compiles without GTA/ScriptHook SDK.
- Stable project IDs, never transient GTA handles, represent persistent entities.
- No TODO completion without its validation gate.
- Patch notes and development log track every project-state change.
