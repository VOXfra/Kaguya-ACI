VOX GTA V MODERN OVERHAUL — CHECKPOINT 0I.4 / REAL COMPACT RPF
Version: 0.0.1-dev.15.4

WHY DEV.15.3 IS RETIRED
The complete directory mirror fixed the missing-member crash mechanism enough to let Story Mode run, but the user's real game dropped to roughly 5 FPS. That makes the directory-as-RPF approach technically informative but unusable.

The returned loader/runtime logs from the later attempts still show the normal VOX lifecycle completing: ASI loading, ScriptHookV registration, Core start, persistence save, game-thread queue dispatch and five Core/ScriptHook ticks. RageOpenV's release log still exposes only its initialization line, so the logs do not identify a deeper runtime exception.

DEV.15.4 STRATEGY
RageOpenV only forces archive type 2 when the .rpf path resolves to a DIRECTORY. A real .rpf FILE is left on the normal archive-open path.

Dev.15.4 therefore removes the expensive virtual-directory archive and installs a real compact nested RPF file at:

newmods/platform/levels/gta5/props/roadside/v_construction.rpf

The identity file is extracted directly from the user's own x64f.rpf. It is not rebuilt for the first test. The selected prop_roadcone02a.ydr inside it is cross-checked against the source SHA-256 already recorded by dev.15.1.

No Rockstar RPF/YDR is bundled in this package.

FIRST TEST — REAL RPF, COMPLETELY VANILLA CONTENT
1. Close GTA V Enhanced completely.
2. Extract dev.15.4 over the existing installation.
3. KEEP VOXModernOverhaul\visual_probe and VOXModernOverhaul\tools\.venv-assets.
4. Do NOT run 01, 04, 05, 06 or 07.
5. Run:

VOXModernOverhaul\tools\assets\08_INSTALL_COMPACT_RPF_IDENTITY.cmd

The installer validates ownership of the previous VOX virtual archive, extracts the original nested v_construction.rpf from the user's x64f.rpf, verifies that its prop_roadcone02a.ydr matches the preserved source hash, stages the exact RPF bytes, then atomically replaces the directory-form archive with the real RPF file.

Expected markers:
VOX_COMPACT_RPF_IDENTITY_INSTALLED
VOX_COMPACT_RPF_PATH=newmods/platform/levels/gta5/props/roadside/v_construction.rpf
VOX_COMPACT_RPF_MEMBERS=<non-zero>
VOX_COMPACT_RPF_SHA256=<sha256>

Then launch Story Mode.

There should be NO visual difference. Check only:
- does Story Mode load;
- are FPS back to the normal range.

If it crashes or remains around 5 FPS, do NOT enable the transformed probe. Return the fresh logs/report and the compact-RPF route is rejected.

SECOND TEST — ONLY AFTER IDENTITY IS STABLE AND FAST
Close GTA, then run:

VOXModernOverhaul\tools\assets\09_ENABLE_COMPACT_SCALED_PROBE.cmd

This rebuilds the compact copy from the preserved identity RPF and changes only prop_roadcone02a.ydr at the standalone-member level. CI requires every other RPF member path and standalone SHA-256 to remain unchanged.

Expected marker:
VOX_COMPACT_RPF_TRANSFORMED_INSTALLED

Then launch Story Mode. FPS should remain normal and prop_roadcone02a should be visibly about 1.65x oversized.

ROLLBACK
Run:

VOXModernOverhaul\tools\assets\10_ROLLBACK_COMPACT_RPF_PROBE.cmd

The real RPF file is removed only if its active SHA-256 still matches the manifest. Local source/generated working data is kept so diagnosis does not force another full extraction pass.

SAFETY
- Rockstar archives are never edited in place.
- No Rockstar RPF/YDR is shipped.
- dev.15.3 directory members are hash-verified before automatic migration.
- Migration builds and validates the real RPF before swapping the active path.
- If the final swap fails, the previous virtual archive is restored.
- The transformed compact RPF is reopened and checked for the same member path set.
- Every non-target standalone member hash must remain identical during rebuild.
- world_state.v1 is unrelated; keep it.

CURRENT D4 BOUNDARY
The directory-mirror route is rejected for production because of real ~5 FPS performance. The compact real-RPF route is D3 tooling until the user's real GTA proves normal performance/stability with identity content, then stable rendering with the transformed target.
