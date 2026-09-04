param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$Version = '0.0.1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SourceDir = Join-Path $ProjectRoot 'tools\crashcapture'
if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    throw "Crash-capture source directory not found: $SourceDir"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$StagingRoot = Join-Path $OutputDirectory 'crashcapture-package'
$StagingDir = Join-Path $StagingRoot 'VOXCrashCapture'
$ZipPath = Join-Path $OutputDirectory "VOX-GTA5-Crash-Capture-$Version.zip"

if (Test-Path -LiteralPath $StagingRoot) {
    Remove-Item -LiteralPath $StagingRoot -Recurse -Force
}
if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}

New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
Copy-Item -Path (Join-Path $SourceDir '*') -Destination $StagingDir -Recurse -Force

$required = @(
    '01_ENABLE_CRASH_CAPTURE.cmd',
    '02A_DISABLE_VOX_ASI.cmd',
    '02B_RESTORE_VOX_ASI.cmd',
    '03_COLLECT_EVIDENCE.cmd',
    '04_DISABLE_CRASH_CAPTURE.cmd',
    'Enable-CrashCapture.ps1',
    'Disable-CrashCapture.ps1',
    'Collect-CrashEvidence.ps1',
    'README_CRASH_CAPTURE.txt',
    'VERSION.txt'
)
foreach ($name in $required) {
    $path = Join-Path $StagingDir $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Crash-capture package missing required file: $name"
    }
}

Compress-Archive -LiteralPath $StagingDir -DestinationPath $ZipPath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "CRASH_CAPTURE_ZIP=$ZipPath"
Write-Host "CRASH_CAPTURE_SHA256=$hash"
