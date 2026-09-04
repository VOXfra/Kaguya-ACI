VOX GTA V MODERN OVERHAUL — CHECKPOINT 0C / NO-CRT ASI ISOLATION
Version: 0.0.1-dev.10

PURPOSE
The real GTA V Enhanced process still crashed with dev.9 even though its DllMain body did no work.
Binary inspection then showed that dev.9 still imported the Microsoft C/C++ runtime (VCRUNTIME140.dll and api-ms-win-crt-runtime-l1-1-0.dll), so CRT initialization could still run before/around our empty DllMain.

THIS BUILD IS LOWER-LEVEL THAN DEV.9
VOXModernOverhaul.asi is linked with a custom PE DLL entrypoint and /NODEFAULTLIB.
The CI rejects the package unless the ASI has:
- PE32+ x64 format;
- a non-zero custom entrypoint;
- Import Directory RVA = 0 and size = 0;
- TLS Directory RVA = 0 and size = 0.

The ASI entrypoint only ignores its three loader arguments and returns success.
It contains no project code, CRT/STL calls, Win32 calls, ScriptHookV calls, GTA native calls, hooks, memory writes or save/world changes.

INSTALL
1. Close GTA V Enhanced.
2. Open the GTA V Enhanced root folder containing gta5_enhanced.exe.
3. Replace the previous VOXModernOverhaul.asi with the one in this ZIP.
4. The VOXModernOverhaul folder may remain; dev.10 does not read it.
5. Leave ScriptHookV, dinput8, RageOpenV, TrainerV and ScriptHookVDotNet unchanged.

TEST
1. Launch GTA V Enhanced normally.
2. Enter Story Mode if possible.
3. Remain/play for at least 2–5 minutes or beyond the usual crash point.
4. Report whether GTA remains stable or crashes, and approximately when/where.

IMPORTANT
No VOX log is expected from dev.10. Logging would defeat the purpose of the zero-import isolation test.

INTERPRETATION
- Stable: the Microsoft CRT/default DLL startup layer in dev.9 becomes the primary compatibility suspect. Future runtime integration will avoid that startup pattern and move to a controlled ScriptHookV/game-thread lifecycle.
- Still crashes: even a zero-import bare ASI image triggers the failure. The next isolation step must then test ASI-loader/file-image interaction and plugin coexistence, not application logic.

ROLLBACK
Delete VOXModernOverhaul.asi. The VOXModernOverhaul folder can also be removed if desired.
Do not remove third-party loaders/mods as part of VOX rollback.

KNOWN LIMITATIONS
- No gameplay feature is active.
- No diagnostics are emitted by the ASI itself.
- This package exists only to isolate the real-game crash before runtime development resumes.
