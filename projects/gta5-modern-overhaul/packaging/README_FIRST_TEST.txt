VOX GTA V MODERN OVERHAUL — CHECKPOINT 0H / PERSISTENT ENTITY REGISTRY
Version: 0.0.1-dev.14

PURPOSE
The real GTA V Enhanced dev.13 test is successful: ScriptHookV enters/resumes the VOX script, VOXModernCore.dll starts from that validated context, the ASI/Core bridge becomes ready and five core ticks execute in-game.

Checkpoint dev.14 turns that bridge into the first persistent world foundation. The core now owns a stable Entity Registry, a versioned checksummed world-state file, atomic replacement with previous-state backup, strict corruption rejection/recovery, persistent EntityId high-water restoration and a bounded game-thread dispatch queue.

THIS BUILD STILL DOES NOT ALTER GTA GAMEPLAY
- no GTA native calls;
- no memory patches;
- no mission changes;
- no ped/vehicle/world mutation;
- no vanilla save modification.

WHAT DEV.14 DOES
On first successful launch:
- creates VOXModernOverhaul\state\world_state.v1;
- creates one EntityKind::System record with persistent EntityId 1;
- records next_entity_id=2;
- writes the state through a temporary file and atomic replace path;
- includes a checksum so partial/manual corruption fails closed;
- queues one harmless callback through the game-thread queue and executes it on a later Core tick.

On following launches:
- reloads world_state.v1;
- restores EntityId 1;
- restores next_entity_id=2;
- does NOT create another system entity;
- can recover the previous committed state from world_state.v1.bak if the primary state is invalid and a valid backup exists.

EXPECTED LOG — FIRST LAUNCH
Delete any old:
VOXModernOverhaul\runtime_game_thread.log

Expected markers include:
VOX_SCRIPT_MAIN_ENTER
VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT
VOX_CORE_START
VOX_PERSISTENCE_STATUS=NEW
VOX_PERSISTENCE_SYSTEM_ENTITY_ID=1
VOX_PERSISTENCE_ENTITY_COUNT=1
VOX_PERSISTENCE_NEXT_ENTITY_ID=2
VOX_PERSISTENCE_SAVE_OK
VOX_CORE_RUNTIME_READY
VOX_CORE_BRIDGE_READY
VOX_GAME_THREAD_QUEUE_DISPATCHED=1
VOX_CORE_TICK=1 ... VOX_CORE_TICK=5
VOX_SCRIPT_HEARTBEAT  (five times)

EXPECTED LOG — SECOND LAUNCH
Without deleting VOXModernOverhaul\state\world_state.v1, delete only runtime_game_thread.log and launch again.
Expected persistence markers:
VOX_PERSISTENCE_STATUS=LOADED
VOX_PERSISTENCE_SYSTEM_ENTITY_ID=1
VOX_PERSISTENCE_ENTITY_COUNT=1
VOX_PERSISTENCE_NEXT_ENTITY_ID=2

INSTALL
1. Close GTA V Enhanced completely.
2. Open the GTA V Enhanced root folder containing GTA5_Enhanced.exe.
3. Replace VOXModernOverhaul.asi with the one from this ZIP.
4. Replace/copy VOXModernCore.dll beside GTA5_Enhanced.exe.
5. Merge the VOXModernOverhaul folder from the ZIP.
6. Leave ScriptHookV.dll, dinput8.dll, RageOpenV, ScriptHookVDotNet and TrainerV unchanged.

TEST
1. Delete VOXModernOverhaul\runtime_game_thread.log if it exists.
2. For the clean persistence test only, delete VOXModernOverhaul\state if it already exists from a previous dev.14 attempt. Do NOT delete vanilla GTA saves.
3. Launch Story Mode and remain in-game for at least 10 seconds.
4. Quit normally.
5. Confirm VOXModernOverhaul\state\world_state.v1 now exists.
6. Delete only runtime_game_thread.log, NOT world_state.v1.
7. Launch Story Mode a second time for at least 10 seconds, then quit normally.
8. Send the second runtime_game_thread.log if any expected marker differs.

SUCCESS CRITERIA
- both GTA launches remain stable;
- first launch reports PERSISTENCE_STATUS=NEW and SAVE_OK;
- world_state.v1 exists after first launch;
- second launch reports PERSISTENCE_STATUS=LOADED;
- both launches report SYSTEM_ENTITY_ID=1, ENTITY_COUNT=1 and NEXT_ENTITY_ID=2;
- GAME_THREAD_QUEUE_DISPATCHED=1 appears;
- Core bridge/ticks and ScriptHookV heartbeats remain healthy.

FAILURE HANDLING
- PERSISTENCE_STATUS=INVALID: do not edit the state file; send runtime_game_thread.log plus world_state.v1 and .bak if present.
- PERSISTENCE_SAVE_FAILED: send the log; the following VOX_PERSISTENCE_ERROR marker identifies the failed atomic-write stage.
- PERSISTENCE_STATUS=RECOVERED_FROM_BACKUP: recovery worked; send the log so the event can be recorded.
- CORE_LOAD/EXPORT/START failures: do not mix ASI/Core files from different checkpoints.
- GTA crash: leave other plugins untouched and use the existing crash-capture pack.

ROLLBACK
Remove VOXModernOverhaul.asi and VOXModernCore.dll, or restore the previous known-good checkpoint pair. VOXModernOverhaul\state belongs only to this mod and may be archived or deleted when intentionally resetting VOX world persistence. No vanilla GTA save is touched.

KNOWN LIMITATIONS
- This is infrastructure, not yet a visible graphics/gameplay change.
- The registry currently persists only one VOX system record as an end-to-end proof.
- Runtime GTA handle ↔ EntityId binding is the next registry adapter step.
- The next development checkpoint begins the Enhanced asset locator/override pipeline in parallel with mission/story compatibility work, which is the path to the first visible graphics replacement.
