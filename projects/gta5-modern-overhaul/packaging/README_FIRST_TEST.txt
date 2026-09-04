VOX GTA V MODERN OVERHAUL — CHECKPOINT 0B / INERT ASI ISOLATION
Version: 0.0.1-dev.9

PURPOSE
The previous diagnostic build reached CHECKPOINT_OK in the user's real GTA V Enhanced process, then the game crashed.
This package isolates whether the crash is caused by the previous bootstrap/thread logic or by merely loading VOXModernOverhaul.asi.

THIS BUILD IS INTENTIONALLY INERT
VOXModernOverhaul.asi performs no work at all after Windows loads it:
- no CreateThread;
- no logging;
- no filesystem/config access;
- no ScriptHookV calls;
- no GTA native calls;
- no hooks;
- no memory writes;
- no save/world changes.
DllMain immediately returns TRUE for every notification.

INSTALL
1. Close GTA V Enhanced.
2. Open the GTA V Enhanced root folder containing gta5_enhanced.exe.
3. Replace the previous VOXModernOverhaul.asi with the one in this ZIP.
4. Copy the remaining packaged files normally. They are inert in this checkpoint.
5. Leave your existing ScriptHookV/ASI loader installation unchanged.

TEST
1. Launch GTA V Enhanced normally.
2. Enter Story Mode if possible.
3. Play/remain loaded for at least 2–5 minutes, preferably long enough to cover the point where dev.8 crashed.
4. Report only whether GTA remained stable or crashed, and approximately when/where it happened.

IMPORTANT
No VOX bootstrap.log is expected from dev.9. Absence of a new log is correct because logging itself has been removed from this isolation build.

INTERPRETATION
- If dev.9 is stable: the previous asynchronous bootstrap path becomes the primary root-cause candidate and will be permanently replaced by a proper ScriptHookV/game-thread lifecycle.
- If dev.9 still crashes: the issue is below the bootstrap logic (binary/load interaction, loader combination, runtime/toolchain compatibility, or another interaction) and the next isolation step will remove/alter that layer rather than reusing the failed path.

ROLLBACK
Delete:
- VOXModernOverhaul.asi
- VOXModernOverhaul\

Do NOT delete ScriptHookV, dinput8, RageOpenV, TrainerV or ScriptHookVDotNet as part of this rollback; they are separate third-party components.

KNOWN LIMITATIONS
- This build intentionally proves no gameplay feature.
- It intentionally produces no VOX log.
- It exists only to isolate the real-game crash before further runtime work continues.
