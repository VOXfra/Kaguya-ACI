@echo off
setlocal
title VOX GTA V Enhanced - Isolate Visual Crash
echo.
echo VOX dev.15.2 - byte-identical visual override isolation
echo This replaces only the active VOX-generated YDR with the exact extracted original bytes.
echo It does NOT edit Rockstar RPF archives in place.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Isolate-VisualProbeCrash.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo ERROR: visual crash isolation failed with exit code %RC%.
pause
exit /b %RC%
