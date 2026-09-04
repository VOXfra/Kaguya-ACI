@echo off
setlocal
set "GAME_ROOT=%~dp0.."
if exist "%GAME_ROOT%\VOXModernOverhaul.asi" (
    echo VOXModernOverhaul.asi is already enabled.
    pause
    exit /b 0
)
if not exist "%GAME_ROOT%\VOXModernOverhaul.asi.disabled" (
    echo ERROR: VOXModernOverhaul.asi.disabled was not found in:
    echo %GAME_ROOT%
    pause
    exit /b 1
)
ren "%GAME_ROOT%\VOXModernOverhaul.asi.disabled" "VOXModernOverhaul.asi"
if errorlevel 1 (
    echo ERROR: Failed to restore VOXModernOverhaul.asi
    pause
    exit /b 1
)
echo VOXModernOverhaul.asi restored.
pause
