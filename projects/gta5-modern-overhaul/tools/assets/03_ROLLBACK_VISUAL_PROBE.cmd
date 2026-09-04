@echo off
setlocal
title VOX GTA V Enhanced - Rollback Visual Probe
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rollback-VisualProbe.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo ERROR: rollback stopped safely with exit code %RC%.
pause
exit /b %RC%
