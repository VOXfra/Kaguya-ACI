VOX GTA V MODERN OVERHAUL — CRASH CAPTURE PACK 0.0.1

PURPOSE
The no-CRT / zero-import dev.10 ASI still causes a real GTA V Enhanced crash.
This pack stops changing the plugin code and instead captures external Windows evidence
while running a strict baseline-vs-VOX comparison.

IT DOES NOT MODIFY GTA FILES OR GTA SAVES.
The only system-level change is a per-application Windows Error Reporting LocalDumps
configuration for GTA5_Enhanced.exe. It can be restored with 04_DISABLE_CRASH_CAPTURE.cmd.

TEST ORDER

1) Put this entire VOXCrashCapture folder directly inside the GTA V Enhanced root.
   Example:
   E:\Jeux Epic\GTAVEnhanced\VOXCrashCapture\

2) Run:
   01_ENABLE_CRASH_CAPTURE.cmd
   Accept the administrator prompt.

3) Run:
   02A_DISABLE_VOX_ASI.cmd

   This renames:
   VOXModernOverhaul.asi
   to:
   VOXModernOverhaul.asi.disabled

4) Launch GTA V Enhanced normally with every other mod/plugin unchanged.
   Try to reach the same point where the VOX builds crash.

   RESULT A — GTA ALSO CRASHES WITHOUT VOX:
   Do NOT re-enable VOX yet.
   Run 03_COLLECT_EVIDENCE.cmd immediately after the crash.

   RESULT B — GTA IS STABLE WITHOUT VOX:
   Quit GTA normally.
   Run 02B_RESTORE_VOX_ASI.cmd.
   Launch GTA again with dev.10 enabled.
   After the crash, run 03_COLLECT_EVIDENCE.cmd.

5) Upload the generated:
   VOX-Crash-Evidence-YYYYMMDD-HHMMSS.zip

6) When this investigation is finished, run:
   04_DISABLE_CRASH_CAPTURE.cmd
   to restore the previous WER registry state.

NOTES
- Crash capture defaults to DumpType=1 (minidump) to avoid creating a multi-GB full dump.
- No VOX runtime log is expected from dev.10.
- Do not change RageOpenV, ScriptHookVDotNet, TrainerV, ScriptHookV or dinput8 between
  the baseline and VOX launch; otherwise the comparison is no longer controlled.
