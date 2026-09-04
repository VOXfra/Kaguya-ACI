VOX GTA V MODERN OVERHAUL — CHECKPOINT 0I.2 / VISUAL CRASH ISOLATION
Version: 0.0.1-dev.15.2

PURPOSE
Dev.14 remains the known-good runtime/persistence base. Dev.15.1 successfully fixed the Windows installer bootstrap and, on the user's real GTA V Enhanced installation, successfully:
- created/reused the isolated Python environment;
- installed FiveFury 0.4.21;
- passed the Gen9 transformer self-test;
- scanned the real Enhanced archives;
- selected prop_roadcone02a;
- extracted x64f.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr;
- generated a 1.65x YDR;
- installed it under newmods/platform/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr.

However, the user's game then crashes immediately when entering Story Mode. The VOX runtime log reaches Core ready, game-thread queue dispatch and all five Core/ScriptHook ticks before the crash. ASI loader and ScriptHookV initialization also complete normally. Therefore dev.15.1 is NOT a successful visual D4 checkpoint.

WHAT DEV.15.2 CHANGES
Dev.15.2 does not guess at the cause. It adds a differential crash-isolation tool:

VOXModernOverhaul\tools\assets\04_ISOLATE_VISUAL_CRASH.cmd

This tool requires the existing dev.15.1 visual_probe_manifest.json and extracted work/original YDR. It:
- verifies the active generated override still matches its recorded SHA-256;
- verifies the extracted original YDR still matches source_sha256;
- preserves the transformed YDR hash in the manifest for diagnosis;
- replaces ONLY the active loose override with a byte-for-byte copy of the extracted Rockstar original;
- verifies the installed identity override SHA-256 equals the source SHA-256;
- updates the manifest so normal hash-safe rollback remains valid;
- does not modify any Rockstar RPF archive.

WHY THIS TEST IS DECISIVE
The active path stays exactly the same:
newmods/platform/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr

Only its bytes change from our FiveFury-rebuilt YDR to the exact extracted original bytes.

If Story Mode STILL crashes with the identity override:
- the FiveFury geometry rewrite is exonerated for this crash;
- RageOpenV/newmods path or mount behavior becomes the primary suspect.

If Story Mode LOADS with the identity override:
- RageOpenV/newmods can serve that exact source asset at that path;
- the FiveFury-rebuilt retail YDR is the primary suspect even though FiveFury validation accepted it.

INSTALL DEV.15.2
1. Close GTA V Enhanced completely.
2. Extract this ZIP into the GTA V Enhanced root containing GTA5_Enhanced.exe.
3. Replace/merge the included files.
4. Do NOT delete VOXModernOverhaul\visual_probe or its work directory from the dev.15.1 attempt.
5. Do NOT rerun 01_INSTALL_VISUAL_PROBE.cmd before the isolation test.
6. Keep world_state.v1 if present.

RUN THE CRASH ISOLATION
Run:
VOXModernOverhaul\tools\assets\04_ISOLATE_VISUAL_CRASH.cmd

Expected success output includes:
VOX DEV.15.2 IDENTITY OVERRIDE INSTALLED

The report becomes:
VOXModernOverhaul\visual_probe\visual_probe_report.txt
status=IDENTITY_OVERRIDE_INSTALLED
identity_bytes_equal_source=true

REAL-GAME TEST
1. Launch GTA V Enhanced normally.
2. Enter Story Mode once.
3. Do NOT look for an oversized cone; the identity override is intentionally visually identical to vanilla.
4. Report only whether Story Mode loads or crashes.
5. If it crashes, return the fresh loader/ScriptHook/RageOpenV/VOX logs again. A WER/minidump capture may then be used if the mount layer still cannot be isolated from logs.

ROLLBACK AFTER THE TEST
Run:
VOXModernOverhaul\tools\assets\03_ROLLBACK_VISUAL_PROBE.cmd

Because dev.15.2 updates generated_sha256 to the identity-copy hash, the existing rollback remains hash-safe and removes only the VOX-owned loose file.

CI / REGRESSION EXPECTATIONS
Before packaging dev.15.2, Windows CI must execute the isolation script against a synthetic manifest/work/override tree and prove:
- transformed override hash is required before replacement;
- extracted original hash is required;
- installed identity file exactly equals source bytes;
- probe_mode becomes IDENTITY_OVERRIDE;
- transformed_sha256 is preserved;
- generated_sha256 advances to the active source hash so rollback remains safe.

NO D4 CLAIM
Dev.15.2 is a diagnosis checkpoint. The visual pipeline remains D4 FAILED/PENDING until GTA loads a real override and a visible modification can be proven without crashing.
