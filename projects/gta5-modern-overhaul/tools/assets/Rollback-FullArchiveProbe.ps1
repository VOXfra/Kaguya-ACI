$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$VenvPython = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Tool = Join-Path $ToolDir 'vox_archive_mirror_probe.py'

if (-not (Test-Path -LiteralPath $VenvPython -PathType Leaf)) {
    throw 'VOX asset Python environment is missing.'
}

& $VenvPython $Tool rollback --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) {
    throw "Full archive rollback failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host 'VOX full archive visual probe rollback complete.'
Write-Host 'Every mirrored member was hash-verified before deletion.'
