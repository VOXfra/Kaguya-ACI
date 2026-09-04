@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rollback-FullArchiveProbe.ps1"
set "rc=%errorlevel%"
echo.
if not "%rc%"=="0" echo VOX full archive rollback failed with exit code %rc%.
pause
exit /b %rc%
