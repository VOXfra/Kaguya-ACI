@echo off
setlocal
title VOX GTA V Enhanced - Install Visual Probe
echo.
echo VOX dev.15.1 - first visible Enhanced asset override proof
echo This will NOT edit Rockstar RPF archives in place.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-And-Install-VisualProbe.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo ERROR: visual probe setup failed with exit code %RC%.
pause
exit /b %RC%
