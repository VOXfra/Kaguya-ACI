$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$VenvPython = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Tool = Join-Path $ToolDir 'vox_archive_mirror_probe.py'

if (-not (Test-Path -LiteralPath $VenvPython -PathType Leaf)) {
    throw 'VOX asset Python environment is missing. Keep the existing dev.15.1/15.2 VOXModernOverhaul folder and run 01_INSTALL_VISUAL_PROBE.cmd only if the environment itself was removed.'
}
if (-not (Test-Path -LiteralPath $Tool -PathType Leaf)) {
    throw "Missing archive mirror tool: $Tool"
}

& $VenvPython $Tool self-test
if ($LASTEXITCODE -ne 0) {
    throw "Archive mirror self-test failed with exit code $LASTEXITCODE."
}

& $VenvPython $Tool install-full-identity --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) {
    throw "Complete archive identity install failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15.3 FULL ARCHIVE IDENTITY READY'
Write-Host '============================================================'
Write-Host 'Launch GTA V Enhanced and enter Story Mode.'
Write-Host 'There is intentionally no visual difference yet.'
Write-Host 'If Story Mode loads, close GTA and run 06_ENABLE_SCALED_PROBE.cmd.'
Write-Host 'If Story Mode still crashes, stop there and report the crash.'
