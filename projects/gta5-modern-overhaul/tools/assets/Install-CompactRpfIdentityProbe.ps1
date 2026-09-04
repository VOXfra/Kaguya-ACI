param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$Python = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Setup = Join-Path $ToolDir 'Setup-And-Install-VisualProbe.ps1'
$Probe = Join-Path $ToolDir 'vox_compact_rpf_probe.py'

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    Write-Host 'VOX asset environment is missing; bootstrapping it first.'
    & $Setup -EnvironmentOnly
    if ($LASTEXITCODE -ne 0) { throw "Asset environment bootstrap failed: $LASTEXITCODE" }
}
if (-not (Test-Path -LiteralPath $Probe -PathType Leaf)) { throw "Missing compact RPF probe: $Probe" }

Write-Host 'VOX dev.15.4 - migrating the virtual .rpf directory to a real compact RPF file.'
& $Python $Probe install-identity --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) { throw "Compact RPF identity install failed: $LASTEXITCODE" }

Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15.4 COMPACT RPF IDENTITY INSTALLED'
Write-Host '============================================================'
Write-Host 'Launch Story Mode and check both stability and normal FPS.'
Write-Host 'There should be NO visual change yet.'
