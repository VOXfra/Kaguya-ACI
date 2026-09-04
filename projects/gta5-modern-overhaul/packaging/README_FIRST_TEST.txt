VOX GTA V MODERN OVERHAUL — CHECKPOINT 0E / SCRIPTHOOKV GAME-THREAD
Version: 0.0.1-dev.11

PURPOSE
The no-CRT dev.10 ASI has now loaded successfully in the user's real GTA V Enhanced installation after the earlier intermittent crash sequence. The next checkpoint validates the production lifecycle we actually want: registration with ScriptHookV and execution/resumption inside ScriptHookV's own script scheduler.

THIS BUILD IS STILL NON-INVASIVE
VOXModernOverhaul.asi:
- uses a custom CRT-free PE entrypoint;
- imports only the required Kernel32 API boundary;
- does not directly import ScriptHookV.dll;
- never calls LoadLibrary from the DLL loader callback;
- resolves the already-loaded ScriptHookV scriptRegister/scriptWait exports;
- registers one ScriptMain callback;
- performs no GTA native calls;
- performs no gameplay hooks or memory patches;
- performs no save/world mutation.

WHAT THE SCRIPT DOES
ScriptMain writes a small proof file at:
VOXModernOverhaul\runtime_game_thread.log

Expected sequence:
VOX_SCRIPT_MAIN_ENTER
VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT
VOX_SCRIPT_HEARTBEAT  (five times)

The RESUMED_AFTER_WAIT marker is important: it proves the script yielded through scriptWait(0) and was scheduled again by ScriptHookV instead of merely being called once during DLL loading.
After five heartbeats the script remains loaded but only calls scriptWait(1000) forever.

INSTALL
1. Close GTA V Enhanced.
2. Open the GTA V Enhanced root folder containing GTA5_Enhanced.exe.
3. Replace the previous VOXModernOverhaul.asi with the one in this ZIP.
4. Keep the VOXModernOverhaul folder from the ZIP.
5. Leave your existing ScriptHookV.dll, dinput8.dll, RageOpenV, ScriptHookVDotNet and TrainerV unchanged.
6. Do NOT copy any test ScriptHookV.dll from development tools; the package intentionally contains none.

TEST
1. Delete VOXModernOverhaul\runtime_game_thread.log if an older one exists.
2. Launch GTA V Enhanced normally.
3. Enter Story Mode and remain in-game for at least 10 seconds.
4. Quit normally if the game is stable.
5. Send VOXModernOverhaul\runtime_game_thread.log back to the project conversation.

SUCCESS CRITERIA
- GTA V Enhanced remains stable.
- The log contains VOX_SCRIPT_MAIN_ENTER.
- The log contains VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT.
- The log contains exactly five VOX_SCRIPT_HEARTBEAT lines for this fresh test.

FAILURE HANDLING
- If GTA crashes, do not alter other mods after the crash. Use the existing VOX crash-capture pack immediately.
- If GTA is stable but no runtime_game_thread.log exists, the ASI loaded but ScriptHookV registration/ABI resolution did not complete; send asiloader.log + ScriptHookV.log.
- If ENTER exists but RESUMED_AFTER_WAIT does not, ScriptMain began but did not resume after yielding; that is a scheduler integration failure and no gameplay work will be added on top of it.

ROLLBACK
Replace VOXModernOverhaul.asi with the known dev.10 ASI or delete VOXModernOverhaul.asi entirely.
No third-party loader or mod needs to be removed for rollback.

KNOWN LIMITATIONS
- No visible gameplay feature is active yet.
- No GTA native is called.
- The checkpoint deliberately proves lifecycle correctness before persistence, mission detection or asset work is connected to the live game.
