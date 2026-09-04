param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$Python = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Setup = Join-Path $ToolDir 'Setup-And-Install-VisualProbe.ps1'
$Probe = Join-Path $ToolDir 'vox_compact_rpf_recovery.py'

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    Write-Host 'VOX asset environment is missing; bootstrapping it first.'
    & $Setup -EnvironmentOnly
    if ($LASTEXITCODE -ne 0) { throw "Asset environment bootstrap failed: $LASTEXITCODE" }
}
if (-not (Test-Path -LiteralPath $Probe -PathType Leaf)) { throw "Missing standalone compact RPF recovery probe: $Probe" }

if ($SelfTest) {
    Write-Host 'VOX dev.15.5 - executing no-manifest compact RPF recovery self-test.'
    & $Python $Probe self-test
    if ($LASTEXITCODE -ne 0) { throw "Compact RPF recovery self-test failed: $LASTEXITCODE" }
    Write-Host 'VOX_COMPACT_RPF_RECOVERY_WRAPPER_SELF_TEST_OK'
    exit 0
}

Write-Host 'VOX dev.15.5 - standalone compact RPF identity install.'
Write-Host 'A prior visual_probe_manifest.json is NOT required.'
Write-Host 'Any existing override at the target path is moved intact into VOX recovery storage before activation.'
& $Python $Probe install-identity --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) { throw "Standalone compact RPF identity install failed: $LASTEXITCODE" }

Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15.5 COMPACT RPF IDENTITY INSTALLED'
Write-Host '============================================================'
Write-Host 'Launch Story Mode and check both stability and normal FPS.'
Write-Host 'There should be NO visual change yet.'
