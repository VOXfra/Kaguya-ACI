VOX GTA V MODERN OVERHAUL — CHECKPOINT 0F / SCRIPTHOOKV EXPORT FALLBACK
Version: 0.0.1-dev.12

PURPOSE
The user's real GTA V Enhanced successfully loaded dev.11, but ScriptHookV.log did not show VOXModernOverhaul registering and no VOXModernOverhaul\runtime_game_thread.log was created. This means the ASI image loaded but the ScriptHookV registration path did not complete in the real process.

The dev.11 runtime used exact C++-decorated export names for scriptRegister/scriptWait. dev.12 keeps the same no-CRT/no-LoadLibrary architecture but makes export resolution tolerant of harmless C++ decoration changes by scanning the already-loaded ScriptHookV.dll export-name table for the unique semantic identifiers scriptRegister and scriptWait when the historical exact names are absent.

THIS BUILD IS STILL NON-INVASIVE
VOXModernOverhaul.asi:
- uses a custom CRT-free PE entrypoint;
- imports only the required Kernel32 API boundary;
- does not directly import ScriptHookV.dll;
- never calls LoadLibrary from the DLL loader callback;
- first tries the historical exact ScriptHookV SDK export names;
- then accepts an undecorated alias if present;
- finally scans the loaded ScriptHookV PE export names for unique ?scriptRegister@@ / ?scriptWait@@ identifiers;
- registers one ScriptMain callback only when both functions resolve unambiguously;
- performs no GTA native calls;
- performs no gameplay hooks or memory patches;
- performs no save/world mutation.

WHAT THE SCRIPT DOES
ScriptMain writes:
VOXModernOverhaul\runtime_game_thread.log

Expected sequence:
VOX_SCRIPT_MAIN_ENTER
VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT
VOX_SCRIPT_HEARTBEAT  (five times)

INSTALL
1. Close GTA V Enhanced.
2. Open the GTA V Enhanced root folder containing GTA5_Enhanced.exe.
3. Replace only VOXModernOverhaul.asi with the one in this ZIP.
4. Keep the VOXModernOverhaul folder from the ZIP.
5. Leave ScriptHookV.dll, dinput8.dll, RageOpenV, ScriptHookVDotNet and TrainerV unchanged.

TEST
1. Delete VOXModernOverhaul\runtime_game_thread.log if it exists.
2. Launch GTA V Enhanced normally.
3. Enter Story Mode and remain in-game for at least 10 seconds.
4. Quit normally if stable.
5. Send VOXModernOverhaul\runtime_game_thread.log plus ScriptHookV.log if the runtime log is still absent.

SUCCESS CRITERIA
- GTA V Enhanced remains stable.
- ScriptHookV.log contains registration of VOXModernOverhaul.asi.
- runtime_game_thread.log contains VOX_SCRIPT_MAIN_ENTER.
- runtime_game_thread.log contains VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT.
- runtime_game_thread.log contains five VOX_SCRIPT_HEARTBEAT lines.

FAILURE HANDLING
- If GTA crashes, do not alter other mods after the crash; use the existing crash-capture pack.
- If GTA is stable but ScriptHookV.log still does not register VOX and no runtime log exists, the next discriminator is the exact export table of the user's ScriptHookV.dll; do not add gameplay code on top of that state.
- If ENTER exists but RESUMED_AFTER_WAIT does not, the remaining issue is scheduler integration.

ROLLBACK
Replace VOXModernOverhaul.asi with the known dev.10 ASI or delete VOXModernOverhaul.asi entirely.
No third-party loader or mod needs to be removed.

KNOWN LIMITATIONS
- No visible gameplay feature is active yet.
- No GTA native is called.
- This checkpoint exists only to establish a reliable live ScriptHookV game-thread before persistent/runtime systems and visual asset work are connected.
