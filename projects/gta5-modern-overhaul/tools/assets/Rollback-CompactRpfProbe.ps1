param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$Python = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets\Scripts\python.exe'
$Probe = Join-Path $ToolDir 'vox_compact_rpf_recovery.py'

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) { throw 'VOX asset Python environment is missing.' }
if (-not (Test-Path -LiteralPath $Probe -PathType Leaf)) { throw "Missing standalone compact RPF recovery probe: $Probe" }

Write-Host 'VOX dev.15.5 - hash-safe compact RPF rollback with pre-existing override restoration.'
& $Python $Probe rollback --gta-root $GtaRoot
if ($LASTEXITCODE -ne 0) { throw "Compact RPF recovery rollback failed: $LASTEXITCODE" }
Write-Host 'VOX compact RPF override removed. Any quarantined pre-existing override was restored only after hash verification.'
