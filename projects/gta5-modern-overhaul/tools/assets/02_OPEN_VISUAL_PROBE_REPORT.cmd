@echo off
setlocal
set "REPORT=%~dp0..\..\visual_probe\visual_probe_report.txt"
if not exist "%REPORT%" (
    echo Visual probe report not found yet:
    echo %REPORT%
    echo Run 01_INSTALL_VISUAL_PROBE.cmd first.
    pause
    exit /b 1
)
start "" notepad.exe "%REPORT%"
exit /b 0
