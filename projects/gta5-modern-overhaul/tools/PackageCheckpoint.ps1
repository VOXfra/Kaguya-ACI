param(
    [Parameter(Mandatory = $true)]
    [string]$BuildDirectory,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [Parameter(Mandatory = $true)]
    [string]$Version,

    [string]$Commit = "unknown"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ResolvedBuild = (Resolve-Path -LiteralPath $BuildDirectory).Path

$AsiCandidates = @(Get-ChildItem -LiteralPath $ResolvedBuild -Filter "VOXModernOverhaul.asi" -File -Recurse)
if ($AsiCandidates.Count -ne 1) { throw "Expected exactly one VOXModernOverhaul.asi under '$ResolvedBuild', found $($AsiCandidates.Count)." }
$CoreCandidates = @(Get-ChildItem -LiteralPath $ResolvedBuild -Filter "VOXModernCore.dll" -File -Recurse)
if ($CoreCandidates.Count -ne 1) { throw "Expected exactly one VOXModernCore.dll under '$ResolvedBuild', found $($CoreCandidates.Count)." }

$PackageRoot = Join-Path $OutputDirectory "package"
$DataRoot = Join-Path $PackageRoot "VOXModernOverhaul"
$ConfigRoot = Join-Path $DataRoot "config"
$AssetToolSource = Join-Path $ProjectRoot "tools/assets"
$AssetToolRoot = Join-Path $DataRoot "tools/assets"
$ZipPath = Join-Path $OutputDirectory "VOX-GTA5-Modern-Overhaul-$Version.zip"

if (Test-Path -LiteralPath $PackageRoot) { Remove-Item -LiteralPath $PackageRoot -Recurse -Force }
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
New-Item -ItemType Directory -Path $ConfigRoot -Force | Out-Null
New-Item -ItemType Directory -Path $AssetToolRoot -Force | Out-Null

Copy-Item -LiteralPath $AsiCandidates[0].FullName -Destination (Join-Path $PackageRoot "VOXModernOverhaul.asi")
Copy-Item -LiteralPath $CoreCandidates[0].FullName -Destination (Join-Path $PackageRoot "VOXModernCore.dll")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging/config/core.cfg") -Destination (Join-Path $ConfigRoot "core.cfg")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging/README_FIRST_TEST.txt") -Destination (Join-Path $PackageRoot "README_FIRST_TEST.txt")

if (-not (Test-Path -LiteralPath $AssetToolSource -PathType Container)) { throw "Visual asset tool source directory is missing: $AssetToolSource" }
$RequiredAssetTools = @(
    "vox_visual_probe.py",
    "vox_archive_mirror_probe.py",
    "vox_compact_rpf_probe.py",
    "vox_compact_rpf_recovery.py",
    "Setup-And-Install-VisualProbe.ps1",
    "Rollback-VisualProbe.ps1",
    "Isolate-VisualProbeCrash.ps1",
    "Install-FullArchiveIdentityProbe.ps1",
    "Enable-FullArchiveTransformedProbe.ps1",
    "Rollback-FullArchiveProbe.ps1",
    "Install-CompactRpfIdentityProbe.ps1",
    "Enable-CompactRpfTransformedProbe.ps1",
    "Rollback-CompactRpfProbe.ps1",
    "01_INSTALL_VISUAL_PROBE.cmd",
    "02_OPEN_VISUAL_PROBE_REPORT.cmd",
    "03_ROLLBACK_VISUAL_PROBE.cmd",
    "04_ISOLATE_VISUAL_CRASH.cmd",
    "05_INSTALL_FULL_ARCHIVE_IDENTITY.cmd",
    "06_ENABLE_SCALED_PROBE.cmd",
    "07_ROLLBACK_FULL_ARCHIVE_PROBE.cmd",
    "08_INSTALL_COMPACT_RPF_IDENTITY.cmd",
    "09_ENABLE_COMPACT_SCALED_PROBE.cmd",
    "10_ROLLBACK_COMPACT_RPF_PROBE.cmd"
)
foreach ($Name in $RequiredAssetTools) {
    $Source = Join-Path $AssetToolSource $Name
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "Required visual asset tool is missing: $Source" }
    Copy-Item -LiteralPath $Source -Destination (Join-Path $AssetToolRoot $Name)
}

$AsiHash = (Get-FileHash -LiteralPath (Join-Path $PackageRoot "VOXModernOverhaul.asi") -Algorithm SHA256).Hash.ToLowerInvariant()
$CoreHash = (Get-FileHash -LiteralPath (Join-Path $PackageRoot "VOXModernCore.dll") -Algorithm SHA256).Hash.ToLowerInvariant()
$VisualToolHash = (Get-FileHash -LiteralPath (Join-Path $AssetToolRoot "vox_visual_probe.py") -Algorithm SHA256).Hash.ToLowerInvariant()
$ArchiveMirrorHash = (Get-FileHash -LiteralPath (Join-Path $AssetToolRoot "vox_archive_mirror_probe.py") -Algorithm SHA256).Hash.ToLowerInvariant()
$CompactRpfHash = (Get-FileHash -LiteralPath (Join-Path $AssetToolRoot "vox_compact_rpf_probe.py") -Algorithm SHA256).Hash.ToLowerInvariant()
$CompactRecoveryHash = (Get-FileHash -LiteralPath (Join-Path $AssetToolRoot "vox_compact_rpf_recovery.py") -Algorithm SHA256).Hash.ToLowerInvariant()
$BuildInfo = @(
    "version=$Version",
    "commit=$Commit",
    "asi_sha256=$AsiHash",
    "core_sha256=$CoreHash",
    "visual_probe_sha256=$VisualToolHash",
    "archive_mirror_probe_sha256=$ArchiveMirrorHash",
    "compact_rpf_probe_sha256=$CompactRpfHash",
    "compact_rpf_recovery_sha256=$CompactRecoveryHash",
    "visual_probe_fivefury=0.4.21"
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $PackageRoot "BUILD_INFO.txt") -Value $BuildInfo -Encoding utf8NoBOM

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Compress-Archive -Path (Join-Path $PackageRoot "*") -DestinationPath $ZipPath -CompressionLevel Optimal
$ZipHash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "PACKAGE_ZIP=$ZipPath"
Write-Host "PACKAGE_SHA256=$ZipHash"
