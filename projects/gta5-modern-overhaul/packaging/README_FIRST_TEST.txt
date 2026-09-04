VOX GTA V MODERN OVERHAUL — CHECKPOINT 0G / ISOLATED C++ CORE BRIDGE
Version: 0.0.1-dev.13

PURPOSE
The real GTA V Enhanced dev.12 test is now successful: ScriptHookV registers VOXModernOverhaul.asi, ScriptMain executes, scriptWait(0) resumes correctly and the five expected heartbeats are observed.

Checkpoint dev.13 keeps the validated minimal CRT-free ASI host, then loads a separate normal C++ core DLL only after ScriptMain has entered and resumed under ScriptHookV. This creates the production boundary needed for the real project: the tiny ASI owns only safe loader/scheduler integration, while VOXModernCore.dll owns C++ systems such as persistent IDs, EventBus, configuration, persistence and future GTA adapters.

THIS BUILD IS STILL NON-INVASIVE
VOXModernOverhaul.asi:
- keeps the custom CRT-free PE entrypoint;
- resolves ScriptHookV through the already-loaded module;
- does not directly import ScriptHookV.dll;
- does not load VOXModernCore.dll from the ASI loader callback;
- enters ScriptMain, yields through scriptWait(0), then loads VOXModernCore.dll from the validated ScriptHookV script context;
- performs no GTA native calls, memory patches or world/save mutations.

VOXModernCore.dll:
- is a normal C++20 DLL isolated behind a plain-C versioned API;
- exposes VoxCoreStart, VoxCoreTick and VoxCoreStop;
- receives logging through a host callback instead of depending on the ASI implementation;
- starts one EntityIdGenerator and allocates the first test ID;
- performs five observable core ticks for this checkpoint;
- performs no GTA native calls, hooks or persistence writes yet.

EXPECTED LOG
Delete any old:
VOXModernOverhaul\runtime_game_thread.log

A successful launch should contain at least:
VOX_SCRIPT_MAIN_ENTER
VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT
VOX_CORE_START
VOX_CORE_ENTITY_ID=1
VOX_CORE_BRIDGE_READY
VOX_CORE_TICK=1
VOX_CORE_TICK=2
VOX_CORE_TICK=3
VOX_CORE_TICK=4
VOX_CORE_TICK=5
VOX_SCRIPT_HEARTBEAT  (five times)

INSTALL
1. Close GTA V Enhanced completely.
2. Open the GTA V Enhanced root folder containing GTA5_Enhanced.exe.
3. Replace VOXModernOverhaul.asi with the one from this ZIP.
4. Copy VOXModernCore.dll to the SAME GTA root folder as VOXModernOverhaul.asi.
5. Merge/keep the VOXModernOverhaul folder from this ZIP.
6. Leave ScriptHookV.dll, dinput8.dll, RageOpenV, ScriptHookVDotNet and TrainerV unchanged.

TEST
1. Delete VOXModernOverhaul\runtime_game_thread.log if it exists.
2. Launch GTA V Enhanced normally.
3. Enter Story Mode and remain in-game for at least 10 seconds.
4. Move around briefly if desired; this build does not alter gameplay.
5. Quit normally if stable.
6. Send VOXModernOverhaul\runtime_game_thread.log back to the project conversation.

SUCCESS CRITERIA
- GTA V Enhanced remains stable.
- ScriptHookV.log registers VOXModernOverhaul.asi.
- runtime_game_thread.log contains SCRIPT_MAIN_ENTER and SCRIPT_MAIN_RESUMED_AFTER_WAIT.
- runtime_game_thread.log contains VOX_CORE_START.
- runtime_game_thread.log contains VOX_CORE_ENTITY_ID=1.
- runtime_game_thread.log contains VOX_CORE_BRIDGE_READY.
- runtime_game_thread.log contains at least five VOX_CORE_TICK markers and five VOX_SCRIPT_HEARTBEAT markers.

FAILURE HANDLING
- If GTA crashes, do not change other plugins after the crash; use the existing VOX crash-capture pack immediately.
- If the script markers exist but VOX_CORE_LOAD_FAILED appears, verify VOXModernCore.dll is in the GTA root and send the log.
- If VOX_CORE_EXPORTS_FAILED appears, the packaged ASI/Core ABI pair is inconsistent; do not mix binaries from different checkpoints.
- If VOX_CORE_START_FAILED appears, send the log; the core rejected its startup contract and no further systems should be layered on it.

ROLLBACK
Replace VOXModernOverhaul.asi with the known-good dev.12 ASI and remove VOXModernCore.dll, or remove both VOX project binaries entirely. No third-party loader/mod needs to be removed.

KNOWN LIMITATIONS
- No visible gameplay or graphics change is active yet.
- No GTA native is called yet.
- The first EntityId is a runtime bridge proof only; no persistent Entity Registry/database exists yet.
- After this real-game bridge gate passes, the next core work is Entity Registry + queued game-thread events + atomic persistent state, while the Enhanced asset locator/override pipeline begins in parallel toward the first visible graphics checkpoint.
