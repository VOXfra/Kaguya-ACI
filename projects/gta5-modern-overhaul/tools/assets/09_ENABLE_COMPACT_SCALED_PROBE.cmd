@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Enable-CompactRpfTransformedProbe.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo ERROR: compact RPF transformed probe failed with exit code %ERR%.
)
pause
exit /b %ERR%
