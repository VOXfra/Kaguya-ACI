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
if ($AsiCandidates.Count -ne 1) {
    throw "Expected exactly one VOXModernOverhaul.asi under '$ResolvedBuild', found $($AsiCandidates.Count)."
}

$PackageRoot = Join-Path $OutputDirectory "package"
$DataRoot = Join-Path $PackageRoot "VOXModernOverhaul"
$ConfigRoot = Join-Path $DataRoot "config"
$ZipPath = Join-Path $OutputDirectory "VOX-GTA5-Modern-Overhaul-$Version.zip"

if (Test-Path -LiteralPath $PackageRoot) {
    Remove-Item -LiteralPath $PackageRoot -Recurse -Force
}
if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}

New-Item -ItemType Directory -Path $ConfigRoot -Force | Out-Null

Copy-Item -LiteralPath $AsiCandidates[0].FullName -Destination (Join-Path $PackageRoot "VOXModernOverhaul.asi")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging/config/core.cfg") -Destination (Join-Path $ConfigRoot "core.cfg")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging/README_FIRST_TEST.txt") -Destination (Join-Path $PackageRoot "README_FIRST_TEST.txt")

$AsiHash = (Get-FileHash -LiteralPath (Join-Path $PackageRoot "VOXModernOverhaul.asi") -Algorithm SHA256).Hash.ToLowerInvariant()
$BuildInfo = @(
    "version=$Version",
    "commit=$Commit",
    "asi_sha256=$AsiHash"
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $PackageRoot "BUILD_INFO.txt") -Value $BuildInfo -Encoding utf8NoBOM

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Compress-Archive -Path (Join-Path $PackageRoot "*") -DestinationPath $ZipPath -CompressionLevel Optimal

$ZipHash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "PACKAGE_ZIP=$ZipPath"
Write-Host "PACKAGE_SHA256=$ZipHash"
