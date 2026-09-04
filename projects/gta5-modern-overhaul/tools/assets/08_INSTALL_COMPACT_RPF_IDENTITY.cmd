@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-CompactRpfIdentityProbe.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo ERROR: compact RPF identity setup failed with exit code %ERR%.
)
pause
exit /b %ERR%
