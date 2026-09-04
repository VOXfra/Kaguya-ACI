VOX GTA V MODERN OVERHAUL — CHECKPOINT 0I.3 / COMPLETE NESTED-RPF MIRROR
Version: 0.0.1-dev.15.3

PURPOSE
Dev.15.2 established a decisive new fact in the user's real GTA V Enhanced installation:
- the active loose prop_roadcone02a.ydr was replaced with a byte-for-byte copy of Rockstar's extracted original;
- the path remained newmods/platform/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr;
- Story Mode still crashed.

Therefore the FiveFury-modified YDR bytes are not required to trigger this crash. The previous one-file RageOpenV directory-archive layout is the primary suspect.

ROOT-CAUSE HYPOTHESIS BEING TESTED
RageOpenV's custom-device hook treats a directory whose name ends in .rpf as the archive itself. The old probe created:

newmods/platform/levels/gta5/props/roadside/v_construction.rpf/
    prop_roadcone02a.ydr

That directory can therefore shadow the complete Rockstar v_construction.rpf instead of overlaying only one member. If GTA requests any other resource from v_construction.rpf, the one-file directory cannot provide it. This explains why even a byte-identical prop_roadcone02a.ydr can still crash Story Mode.

WHAT DEV.15.3 DOES
Dev.15.3 keeps the same proven runtime and visual-tool environment but changes the RageOpenV archive strategy.

05_INSTALL_FULL_ARCHIVE_IDENTITY.cmd:
- requires the existing dev.15.2 identity probe state;
- rescans/reuses the user's local GTA V Enhanced index;
- identifies the complete nested RPF containing the selected model;
- extracts EVERY indexed member below that nested RPF from the user's own installation using standalone archive bytes;
- builds the complete archive as a staging directory;
- verifies the selected target still exactly matches source_sha256;
- refuses to proceed if the current incomplete directory contains any unowned extra file;
- swaps the one-file directory for the complete mirrored archive directory;
- records every mirrored relative path and SHA-256 in the manifest;
- leaves prop_roadcone02a.ydr byte-identical to Rockstar for the first real-game test.

If that identity test loads Story Mode, dev.15.3 also contains:

06_ENABLE_SCALED_PROBE.cmd

This keeps the complete mirrored archive in place and replaces ONLY prop_roadcone02a.ydr with the preserved 1.65x transformed YDR from dev.15.1. The manifest updates the target hash so the full archive remains safely removable.

A dedicated rollback is included:

07_ROLLBACK_FULL_ARCHIVE_PROBE.cmd

Rollback compares the complete file set and SHA-256 of every mirrored member against the manifest before recursively deleting the VOX-owned mirrored archive. Any missing, added or changed file causes rollback to refuse deletion.

INSTALL DEV.15.3
1. Close GTA V Enhanced completely.
2. Extract this ZIP into the GTA V Enhanced root containing GTA5_Enhanced.exe.
3. Replace/merge the included files.
4. KEEP VOXModernOverhaul\visual_probe and its work directory from dev.15.1/dev.15.2.
5. KEEP VOXModernOverhaul\tools\.venv-assets.
6. Do not rerun 01_INSTALL_VISUAL_PROBE.cmd.
7. Do not rerun 04_ISOLATE_VISUAL_CRASH.cmd.

FIRST TEST — COMPLETE ARCHIVE, VANILLA TARGET
Run:
VOXModernOverhaul\tools\assets\05_INSTALL_FULL_ARCHIVE_IDENTITY.cmd

Expected success markers:
VOX_ARCHIVE_MIRROR_SELF_TEST_OK
VOX_FULL_ARCHIVE_IDENTITY_INSTALLED
VOX_FULL_ARCHIVE_FILES=<non-zero count>

The report should say:
status=FULL_ARCHIVE_IDENTITY_INSTALLED

Then launch GTA V Enhanced and enter Story Mode.

There should be NO visual difference yet.

OUTCOME A — STORY MODE LOADS
Close GTA cleanly. This strongly supports the incomplete-directory shadowing hypothesis.

Then run:
VOXModernOverhaul\tools\assets\06_ENABLE_SCALED_PROBE.cmd

Expected marker:
VOX_FULL_ARCHIVE_TRANSFORMED_INSTALLED

Launch Story Mode again. The chosen prop should now be visibly oversized while every other v_construction.rpf member remains available from the complete mirror.

If that works, the RageOpenV mount strategy is validated and the project can finally retire the diagnostic scaling proof and move to meaningful graphics work.

OUTCOME B — STORY MODE STILL CRASHES WITH COMPLETE IDENTITY ARCHIVE
Do not run 06_ENABLE_SCALED_PROBE.cmd.
At that point the problem is deeper than a missing-member archive shadow. The next step is WER/minidump capture around RageOpenV's custom directory-archive mount or abandoning this mount route for another non-destructive override strategy.

ROLLBACK
After either test, when requested, run:
VOXModernOverhaul\tools\assets\07_ROLLBACK_FULL_ARCHIVE_PROBE.cmd

The full mirrored archive is removed only after exact file-set and per-file hash verification.

SAFETY / OWNERSHIP
- No Rockstar RPF is modified in place.
- No Rockstar YDR/RPF is bundled in this package.
- All mirrored resource bytes come from the user's own installed game at test time.
- The current archive destination must contain only the known dev.15.2 identity file before conversion; otherwise installation fails closed.
- Complete mirror creation occurs in staging before the active directory is replaced.
- Rollback refuses recursive deletion if any mirrored member was added, removed or changed.
- The persistent VOX world_state.v1 is unrelated and should be preserved.

NO D4 CLAIM YET
Dev.15.3 is still an isolation checkpoint until the user's real GTA proves either the complete identity mirror or the transformed complete mirror loads successfully.
