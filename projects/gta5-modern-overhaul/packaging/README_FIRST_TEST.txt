VOX GTA V MODERN OVERHAUL — CHECKPOINT 0I / FIRST VISIBLE ENHANCED ASSET OVERRIDE
Version: 0.0.1-dev.15

PURPOSE
The real dev.14 two-launch test is successful. GTA V Enhanced loads the VOX ScriptHookV runtime and isolated C++ core, creates world_state.v1 on the first launch, reloads the same persistent EntityId/high-water state on the second launch, and executes the bounded game-thread queue marker while remaining stable.

Checkpoint dev.15 keeps that validated runtime foundation and adds the first user-side Enhanced/Gen9 asset pipeline proof.

WHAT DEV.15 DOES
The included one-click visual tool:
- verifies it is inside a GTA V Enhanced root;
- requires the already-installed RageOpenV.asi instead of editing Rockstar archives directly;
- creates an isolated Python environment under VOXModernOverhaul\tools\.venv-assets;
- installs the pinned public-domain FiveFury 0.4.21 tooling dependency locally from PyPI;
- indexes the user's own GTA V Enhanced installation;
- selects one common BASE-GAME static YDR that is not already overridden by another loose mod;
- extracts that asset locally from the user's installation;
- rewrites its Gen9 render geometry at 1.65x scale;
- rebuilds render bounds and LOD distances;
- reopens and validates the generated YDR before installation;
- mirrors only the generated file into RageOpenV's newmods/platform mount;
- records exact source/generated hashes and paths in a manifest;
- never redistributes or packages the original Rockstar asset.

THIS VISUAL CHANGE IS INTENTIONALLY UGLY
The selected prop becomes obviously oversized. That is NOT the target art direction. It is a deliberately unmistakable D4 proof that this chain works in the real game:

GTA Enhanced asset -> locate -> extract -> modify -> Gen9 rebuild -> validate -> non-destructive RageOpenV override -> visible in GTA.

Once this succeeds, the same pipeline is used for actual visual upgrades instead of exaggerated scaling.

INSTALL DEV.15
1. Close GTA V Enhanced completely.
2. Extract this ZIP into the GTA V Enhanced root containing GTA5_Enhanced.exe.
3. Replace/merge the included VOXModernOverhaul.asi, VOXModernCore.dll and VOXModernOverhaul folder.
4. Leave ScriptHookV.dll, dinput8.dll, RageOpenV.asi, ScriptHookVDotNet and TrainerV unchanged.
5. Do NOT delete VOXModernOverhaul\state\world_state.v1; dev.14 persistence is now the known-good base.

INSTALL THE FIRST VISUAL PROBE
Run:
VOXModernOverhaul\tools\assets\01_INSTALL_VISUAL_PROBE.cmd

The first run may take a while because the tool creates a private Python environment and indexes the local GTA archives. It does not require administrator rights and does not modify GTA archives in place.

When complete it writes:
VOXModernOverhaul\visual_probe\visual_probe_report.txt
VOXModernOverhaul\visual_probe\visual_probe_manifest.json

The report tells you exactly which model was selected and which newmods/platform path was generated.

REAL-GAME TEST
1. After the installer says VOX DEV.15 VISUAL PROBE INSTALLED, launch GTA V Enhanced normally.
2. Enter Story Mode and drive around Los Santos for a few minutes.
3. Look for the selected model described in visual_probe_report.txt. Traffic lights/street lights are preferred because they are common; bins/cones/palms/trees are fallbacks.
4. The chosen model should be visibly around 1.65x its normal size.
5. Take a screenshot when you see it and send that plus visual_probe_report.txt.

SUCCESS CRITERIA
- installer completes without an error;
- visual_probe_report.txt says status=INSTALLED;
- manifest contains a base x64*.rpf source and a newmods/platform destination;
- generated YDR has a different SHA-256 from the source and passes FiveFury validation;
- GTA launches normally with the override installed;
- at least one real instance of the selected model is visibly oversized.

SAFE FAILURE BEHAVIOR
- If Python 3.11+ is missing, setup stops before touching newmods.
- If RageOpenV.asi is missing, setup stops before touching newmods.
- If no supported base-game candidate is found, nothing is installed.
- Existing loose overrides are never overwritten.
- Update/DLC paths and traversal/drive paths are rejected by the first proof.
- If rebuilding/validation/hash verification fails, no final override is installed.
- The original Rockstar RPF is never modified.

ROLLBACK THE VISUAL PROBE
Run:
VOXModernOverhaul\tools\assets\03_ROLLBACK_VISUAL_PROBE.cmd

Rollback reads the manifest, resolves the generated file only inside newmods/platform, verifies its SHA-256 still matches what VOX generated, deletes only that file, removes only empty directories created below the mount, and refuses deletion if the file was changed by another tool/user.

The runtime itself can still be rolled back by removing VOXModernOverhaul.asi and VOXModernCore.dll or restoring the previous known-good pair. No vanilla GTA save is touched.

DEPENDENCY / PROVENANCE
- FiveFury 0.4.21: installed locally at test time, not bundled. License: The Unlicense/public domain.
- RageOpenV: required from the user's existing installation, not redistributed by VOX.
- No Rockstar asset is shipped in this package; all source extraction happens locally from the user's legally installed game.

KNOWN LIMITATIONS OF THE PROOF
- Render geometry and render bounds are scaled, but collision is intentionally NOT scaled.
- The original YTYP archetype extents are not rewritten in this first proof, so extreme camera/culling cases may still use original world metadata.
- This is one model-family override, not the graphical vertical slice yet.
- After D4 visual confirmation, the exaggerated scale proof is removed and the pipeline moves directly to meaningful materials/foliage/road/lighting work.
