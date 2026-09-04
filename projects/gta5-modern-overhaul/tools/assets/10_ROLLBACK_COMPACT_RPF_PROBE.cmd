@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rollback-CompactRpfProbe.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo ERROR: compact RPF rollback failed with exit code %ERR%.
)
pause
exit /b %ERR%
