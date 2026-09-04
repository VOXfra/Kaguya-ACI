VOX GTA V MODERN OVERHAUL — CHECKPOINT 0I.5 / STANDALONE COMPACT RPF RECOVERY
Version: 0.0.1-dev.15.5

WHY DEV.15.5 EXISTS
Dev.15.4 still depended on VOXModernOverhaul\visual_probe\visual_probe_manifest.json from earlier checkpoints. The user's real installation no longer had that manifest, so 08_INSTALL_COMPACT_RPF_IDENTITY.cmd failed before doing any useful work.

That dependency was a packaging/design mistake: a new checkpoint must be able to rebuild the diagnostic state it needs from the user's own GTA installation instead of assuming an old temporary manifest still exists.

DEV.15.5 STRATEGY
08_INSTALL_COMPACT_RPF_IDENTITY.cmd is now standalone.

It does NOT require any previous visual_probe manifest.

The installer:
1. verifies GTA5_Enhanced.exe and RageOpenV.asi;
2. creates/reuses the isolated VOX Python/FiveFury environment;
3. rescans the user's own GTA V Enhanced installation;
4. locates the known retail target prop_roadcone02a at:
   x64f.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr
5. extracts the source YDR again from the user's own game;
6. regenerates the preserved 1.65x diagnostic YDR for the later transformed test;
7. extracts the complete original nested v_construction.rpf as a REAL RPF file;
8. verifies that prop_roadcone02a.ydr inside that original nested RPF exactly matches the freshly extracted source YDR SHA-256;
9. if anything already occupies the target newmods path, moves it intact into VOX recovery storage instead of deleting or guessing ownership;
10. installs the real source-identical v_construction.rpf file;
11. writes a new schema-2 visual_probe manifest containing everything required by the transformed stage and safe rollback.

No Rockstar RPF/YDR is bundled in this package.

FIRST TEST — STANDALONE REAL RPF, VANILLA CONTENT
1. Close GTA V Enhanced completely.
2. Extract dev.15.5 over the existing installation.
3. You do NOT need an old visual_probe_manifest.json.
4. You may keep any existing VOXModernOverhaul\visual_probe directory; dev.15.5 will rebuild missing state as needed.
5. Do NOT run the old 01/04/05/06/07 diagnostic steps.
6. Run:

VOXModernOverhaul\tools\assets\08_INSTALL_COMPACT_RPF_IDENTITY.cmd

Expected markers include:
VOX_COMPACT_RPF_STANDALONE_BOOTSTRAP_OK
VOX_COMPACT_RPF_IDENTITY_INSTALLED
VOX_COMPACT_RPF_PATH=newmods/platform/levels/gta5/props/roadside/v_construction.rpf
VOX_COMPACT_RPF_MEMBERS=<non-zero>

Then launch Story Mode.

There should be NO visual difference. Check only:
- does Story Mode load;
- are FPS back to the normal range.

If it crashes or remains around 5 FPS, do NOT enable the transformed probe. Return the fresh output/logs and the compact-RPF route is rejected.

SECOND TEST — ONLY AFTER IDENTITY IS STABLE AND FAST
Close GTA, then run:

VOXModernOverhaul\tools\assets\09_ENABLE_COMPACT_SCALED_PROBE.cmd

This uses the newly rebuilt manifest/work state and changes only prop_roadcone02a.ydr inside the compact RPF copy. Every other standalone RPF member is required to remain unchanged by path/hash.

Expected marker:
VOX_COMPACT_RPF_TRANSFORMED_INSTALLED

Then launch Story Mode. FPS should remain normal and prop_roadcone02a should be visibly about 1.65x oversized.

ROLLBACK
Run:

VOXModernOverhaul\tools\assets\10_ROLLBACK_COMPACT_RPF_PROBE.cmd

Rollback verifies the active compact RPF SHA-256 before removal. If dev.15.5 had to quarantine an older file/directory already occupying the destination, that previous override is restored only after its preserved file-set/hash snapshot still matches.

SAFETY
- Rockstar archives are never edited in place.
- No Rockstar RPF/YDR is shipped.
- Missing previous manifest is explicitly supported.
- Existing target-path content is quarantined, not deleted.
- Installation is staged before activation.
- Failed activation restores the previous target-path content.
- Rollback is hash-scoped and restores quarantined prior content only after verification.
- world_state.v1 is unrelated; keep it.

REGRESSION ADDED AFTER THE REAL DEV.15.4 FAILURE
CI now executes the exact Install-CompactRpfIdentityProbe.ps1 wrapper in -SelfTest mode after creating the same isolated FiveFury environment used by the package.

That self-test deliberately begins with:
- NO visual_probe_manifest.json;
- an existing directory at the target .rpf path;
- a synthetic complete RPF and Gen9 YDR.

It requires the installer to create fresh manifest state, quarantine the existing directory without deleting it, install the compact RPF, then execute the recovery rollback and restore the original directory byte-for-byte.

A parser-only/syntax-only pass is not accepted for this path.

CURRENT D4 BOUNDARY
The full-directory mirror is rejected for production because of real ~5 FPS performance. Dev.15.5 removes the stale-manifest blocker from the compact real-RPF route. The remaining D4 gate is the user's real GTA: normal Story Mode stability/FPS with identity content, then stable rendering with the transformed target.
