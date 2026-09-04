param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$Python = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Probe = Join-Path $ToolDir 'vox_compact_rpf_probe.py'

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) { throw 'VOX asset Python environment is missing. Run 08_INSTALL_COMPACT_RPF_IDENTITY.cmd first.' }
if (-not (Test-Path -LiteralPath $Probe -PathType Leaf)) { throw "Missing compact RPF probe: $Probe" }

Write-Host 'VOX dev.15.4 - enabling transformed YDR inside the real compact RPF.'
& $Python $Probe enable-transformed --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) { throw "Compact RPF transformed enable failed: $LASTEXITCODE" }

Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15.4 COMPACT RPF TRANSFORMED PROBE INSTALLED'
Write-Host '============================================================'
Write-Host 'Launch Story Mode. FPS should remain normal and the selected cone should be oversized.'
