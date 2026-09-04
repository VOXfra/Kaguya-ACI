VOX GTA V MODERN OVERHAUL — CHECKPOINT 0 / DIAGNOSTIC BOOTSTRAP
Version: 0.0.1-dev.8

PURPOSE
This package validates the first real GTA V Enhanced integration checkpoint.
It does NOT change gameplay, missions, memory, graphics or saves.
It only loads as an ASI, verifies the Enhanced installation/process, reads the game file version, validates the packaged config and writes a diagnostic log.

INSTALL
1. Close GTA V Enhanced.
2. Open the GTA V Enhanced root folder — the folder containing gta5_enhanced.exe.
3. Copy every file/folder from this ZIP into that root folder.
4. ScriptHookV's ASI loader must already be installed. This package does not redistribute third-party binaries.

FIRST TEST
1. Launch GTA V Enhanced normally.
2. Enter Story Mode and remain in-game for about 10 seconds.
3. Quit the game normally.
4. Open:
   VOXModernOverhaul\logs\bootstrap.log
5. The expected final line is:
   CHECKPOINT_OK: ASI loaded in GTA V Enhanced; no gameplay hooks or memory patches are active.
6. Send the complete bootstrap.log back for the next integration step.

EXPECTED SAFETY BEHAVIOR
- Wrong/non-Enhanced process: runtime disables itself.
- Missing/invalid config: runtime disables gameplay systems and logs the exact reason.
- This checkpoint never writes to GTA save data and never patches game memory.

ROLLBACK
Delete:
- VOXModernOverhaul.asi
- VOXModernOverhaul\

Do NOT delete ScriptHookV/dinput8 as part of this rollback; they are third-party dependencies and may be used by other mods.

KNOWN LIMITATIONS
- No gameplay feature is active yet.
- No ScriptHookV native API calls are made yet; only the ASI loading path is tested.
- No mission compatibility claim is needed yet because this checkpoint does not alter world state.
