# Development Log

This is the precise engineering trace for the project. Patch notes summarize changes; this log records what was done, why, validation performed and what is still unproven.

## 2026-09-04 — Checkpoint 0: GTA-ready diagnostic ASI + reproducible package

### Development contract
- Added project-local `AGENT.md` as the authoritative working contract for this overhaul.
- Recorded the requirement to continue through meaningful checkpoints instead of stopping after isolated helpers.
- Recorded the blocker protocol: stop repetition, isolate the failing component, capture exact evidence, reproduce minimally, fix/root-cause or replace the approach, add regression protection, then resume.
- Recorded the rule to ask the user when a subjective/design decision is genuinely unresolved rather than inventing a preference.
- Recorded mandatory TODO/patchnote/dev-log/status synchronization and a GTA-ready ZIP for every completed user-testable stage.

### Diagnostic ASI implemented
- Added Windows x64 `VOXModernOverhaul.asi` target.
- The bootstrap performs no GTA native calls, gameplay hooks, memory patches, save writes or world changes.
- Resolves the current process executable and refuses to continue unless its filename is `gta5_enhanced.exe` (case-insensitive Win32 ordinal comparison).
- Reuses the Enhanced install probe to validate `MZ`, `PE` and AMD64 architecture.
- Reads/logs the Windows file version of `gta5_enhanced.exe` when available.
- Reports presence/absence of `dinput8.dll` ASI loader and `ScriptHookV.dll` without bundling either dependency.
- Reads `VOXModernOverhaul/config/core.cfg`; missing/malformed/disabled config fails closed.
- Successful bootstrap emits the exact marker:
  `CHECKPOINT_OK: ASI loaded in GTA V Enhanced; no gameplay hooks or memory patches are active.`
- Top-level bootstrap thread catches unexpected exceptions and disables the checkpoint rather than propagating an unhandled C++ exception into the host process.

### Synthetic Windows runtime smoke harness
- Added `tests/runtime/BootstrapSmokeHost.cpp`.
- CMake builds the harness as x64 `gta5_enhanced.exe` so process-name validation follows the same path as the real game.
- Harness `LoadLibraryW`s the generated `.asi`, waits for the bootstrap log and fails unless the exact checkpoint marker appears.
- This validates DLL loading, `DllMain`, bootstrap-thread startup, filesystem paths, Enhanced executable probing, Windows version lookup, config parsing and logging together.
- It remains D3 synthetic validation; only an actual user GTA launch can promote the runtime to D4.

### Packaging
- Added `tools/PackageCheckpoint.ps1`.
- Script requires exactly one generated `VOXModernOverhaul.asi`, creates root-mergeable package structure, copies the versioned config and first-test instructions, records commit + ASI SHA-256 in `BUILD_INFO.txt`, compresses to ZIP and reports ZIP SHA-256.
- CI extracts the finished archive again and checks required files before artifact upload.
- No third-party binary is included in the package.

### Blocker / root-cause analysis
- CI run `33865550459` failed only on Windows while Linux, sanitizers and the ASI build itself succeeded.
- MSVC log showed warning C4003/error C2589 at `std::numeric_limits<EntityId::ValueType>::max()`.
- Root cause: including `windows.h` exposed the legacy function-like `max` macro, which rewrote the standard-library call.
- The failure was not worked around at the individual test line.
- Applied `NOMINMAX` globally to every MSVC target through the common CMake warnings/platform function, preventing recurrence across future Win32 code.
- Added/kept warnings-as-errors so equivalent platform pollution cannot silently pass CI.

### Exact validation evidence
- Source checkpoint commit: `389e5cb5a12de7bd33eecca999479ec86e2822da`.
- GitHub Actions run: `33865763371`.
- `core-build-test (windows-latest)`: SUCCESS.
- `core-build-test (ubuntu-latest)`: SUCCESS.
- `core-sanitizers`: SUCCESS.
- `runtime-package`: SUCCESS.
- Runtime package substeps all succeeded: x64 configure, ASI + smoke-host build, Windows ASI smoke checkpoint, package creation, package extraction/required-file verification and artifact upload.

### Current boundary / next required evidence
- A real GTA V Enhanced process has not yet loaded this exact package.
- D4 requires the user to copy the generated ZIP into the GTA V Enhanced root, launch Story Mode, quit normally, and return `VOXModernOverhaul/logs/bootstrap.log`.
- No gameplay feature will be added on top of an unproven loader path before that real-game checkpoint is resolved.

## 2026-09-04 — GTA V Enhanced install/build probe foundation

### Implemented
- Added explicit-root GTA V Enhanced installation probe.
- Requires `gta5_enhanced.exe` at the supplied root.
- Validates that the root exists and is a directory.
- Validates that the executable exists and is a regular file.
- Parses the DOS `MZ` signature and PE signature.
- Reads the PE COFF machine field and requires AMD64 (`0x8664`).
- Added clear status values for missing path/directory/executable, wrong file type, malformed PE, wrong architecture and filesystem errors.

### Windows build/version reader
- Added a Windows-only adapter around `GetFileVersionInfoSizeW`, `GetFileVersionInfoW` and `VerQueryValueW`.
- Reads the native `VS_FIXEDFILEINFO` file version into four explicit numeric components.
- Validates the fixed-info signature before accepting the version block.
- CMake links the Windows adapter against `Version.lib` only on Windows.

### Correctness review
- `ProbeEnhancedInstall` is intentionally not `noexcept`: filesystem-path copies/construction and stream creation can allocate and may throw. Marking it `noexcept` would create an unnecessary `std::terminate` path on allocation failure.
- Filesystem queries use `std::error_code` for ordinary path/access failures.
- The PE parser is deliberately minimal and bounded: fixed 64-byte DOS header, explicit `e_lfanew`, 6-byte PE signature/machine read. It does not claim to fully validate arbitrary PE integrity.

### Validation
- GNU C++ 14.2.0 / C++20 local validation.
- warnings-as-errors: PASS.
- AddressSanitizer: PASS.
- UndefinedBehaviorSanitizer: PASS.
- Missing directory/executable: PASS.
- malformed/non-PE: PASS.
- x86 PE fixture rejection: PASS.
- AMD64 PE fixture acceptance: PASS.
- Later checkpoint run `33865763371` promoted the detector and Windows version reader to D3 CI-validated status.

## 2026-09-04 — Phase 0 execution checklist + config CI promotion

### Traceability
- Added `TODO_PHASE0.md` to track implementation and validation below the broad feature TODO.
- The checklist distinguishes completed D3 foundations from partially implemented systems such as the full config stack.

### CI evidence
- Exact config commit: `58cec3c98e44da4b7d284cf1ff0743833140b0ed`.
- GitHub Actions run: `33864582553`.
- Result: SUCCESS across Windows/Linux and sanitizer job.

## 2026-09-04 — Versioned configuration parser

### Implemented
- Added `ConfigParseResult` with structured errors, parsed values and explicit schema version.
- Added strict `key=value` parser supporting blank lines, comments, CRLF/LF and trimmed whitespace.
- `schema_version` is mandatory, numeric, non-zero and constrained to `uint32_t` range.
- Duplicate and invalid keys fail closed.
- Typed readers exist for exact lowercase booleans (`true`/`false`) and unsigned integers.

### Correctness review
- Initial lookup methods were declared `noexcept` while constructing a temporary `std::string` for unordered-map lookup could allocate and theoretically throw.
- Removed those `noexcept` declarations before commit so allocation failure is not converted into unintended `std::terminate`.

### Tests / validation
- Valid CRLF config + typed reads: PASS.
- Duplicate schema / missing schema / non-numeric schema failure paths: PASS.
- warnings-as-errors + ASan + UBSan + CTest: PASS.

## 2026-09-04 — CI hardening / concurrent EventBus validation

- Added `VOX_WARNINGS_AS_ERRORS` CMake option.
- GNU/Clang validation uses `-Werror`; MSVC uses `/WX` with `/W4 /permissive- /EHsc`.
- EventBus concurrent validation: 4 publisher threads × 1000 events, expected/observed 4000.
- AddressSanitizer + UndefinedBehaviorSanitizer: PASS.
- Added `docs/STATUS.md` evidence levels.

## 2026-09-04 — Precommit defect catch / ID generator hardening

### Defects caught before in-game integration
- Fixed EventBus use-after-invalidation risk in `Unsubscribe` by computing the result before erasing its owning map entry.
- Detected that an automated test edit had failed to insert generator assertions; inspected source, corrected it and rebuilt.
- Replaced theoretical EventBus token-ID wraparound with fail-closed exhaustion semantics.

### ID allocation
- Added `EntityIdGenerator`.
- Zero permanently reserved for invalid IDs.
- Resume from persisted next-ID/high-water value.
- Maximum 64-bit ID issued at most once, then allocation fails closed.

## 2026-09-04 — Core compile/test checkpoint

- Added typed native EventBus.
- Added GitHub Actions Windows/Linux workflow.
- Core configure/compile/link/test passed.
- No GTA runtime behavior claimed.

## 2026-09-04 — Project initialization / Phase 0 start

### Scope frozen
- Created charter, architecture, TODO, roadmap, story-compatibility contract and initial data model.
- Visual quality is first production priority after tooling/audit.
- Persistence/procedural systems are architectural requirements.
- Vanilla story compatibility is non-negotiable.

### Runtime/tool research
- ScriptHookV supports Enhanced.
- Official ScriptHookVDotNet is not considered a sufficiently reliable Enhanced foundation for the critical runtime.
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
