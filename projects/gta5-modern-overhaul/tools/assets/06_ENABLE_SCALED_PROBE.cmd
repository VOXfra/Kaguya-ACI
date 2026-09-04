@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Enable-FullArchiveTransformedProbe.ps1"
set "rc=%errorlevel%"
echo.
if not "%rc%"=="0" echo VOX scaled probe enable failed with exit code %rc%.
pause
exit /b %rc%
