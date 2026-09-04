$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$VenvPython = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Tool = Join-Path $ToolDir 'vox_archive_mirror_probe.py'

if (-not (Test-Path -LiteralPath $VenvPython -PathType Leaf)) {
    throw 'VOX asset Python environment is missing.'
}

& $VenvPython $Tool enable-transformed --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) {
    throw "Enabling the transformed YDR inside the complete archive mirror failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15.3 SCALED PROBE ENABLED'
Write-Host '============================================================'
Write-Host 'Launch GTA V Enhanced and enter Story Mode.'
Write-Host 'The complete nested archive remains present; only the selected YDR is transformed.'
Write-Host 'Look for the oversized selected model, then use 07_ROLLBACK_FULL_ARCHIVE_PROBE.cmd.'
