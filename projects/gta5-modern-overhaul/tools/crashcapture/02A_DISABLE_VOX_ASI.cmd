@echo off
setlocal
set "GAME_ROOT=%~dp0.."
if exist "%GAME_ROOT%\VOXModernOverhaul.asi.disabled" (
    echo VOXModernOverhaul.asi is already disabled.
    pause
    exit /b 0
)
if not exist "%GAME_ROOT%\VOXModernOverhaul.asi" (
    echo ERROR: VOXModernOverhaul.asi was not found in:
    echo %GAME_ROOT%
    pause
    exit /b 1
)
ren "%GAME_ROOT%\VOXModernOverhaul.asi" "VOXModernOverhaul.asi.disabled"
if errorlevel 1 (
    echo ERROR: Failed to disable VOXModernOverhaul.asi
    pause
    exit /b 1
)
echo VOXModernOverhaul.asi disabled for baseline test.
pause
