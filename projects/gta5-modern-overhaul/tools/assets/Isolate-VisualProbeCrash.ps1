param(
    [string]$GtaRootOverride = ""
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($GtaRootOverride)) {
    $GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
} else {
    $GtaRoot = [System.IO.Path]::GetFullPath($GtaRootOverride)
}

$ProbeRoot = Join-Path $GtaRoot 'VOXModernOverhaul\visual_probe'
$ManifestPath = Join-Path $ProbeRoot 'visual_probe_manifest.json'
$ReportPath = Join-Path $ProbeRoot 'visual_probe_report.txt'
$PlatformRoot = [System.IO.Path]::GetFullPath((Join-Path $GtaRoot 'newmods\platform'))

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "No visual_probe_manifest.json exists. Run the visual probe first."
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$relative = [string]$manifest.override_relative_path
$model = [string]$manifest.model_name
$sourceHash = ([string]$manifest.source_sha256).ToLowerInvariant()
$generatedHash = ([string]$manifest.generated_sha256).ToLowerInvariant()
$probeModeProperty = $manifest.PSObject.Properties['probe_mode']
$probeMode = if ($null -eq $probeModeProperty) { '' } else { [string]$probeModeProperty.Value }

if ([string]::IsNullOrWhiteSpace($relative) -or -not $relative.Replace('\\','/').StartsWith('newmods/platform/', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Manifest contains an unsafe override path: '$relative'."
}
if ($relative -match '(^|[\\/])\.\.([\\/]|$)') {
    throw "Manifest contains traversal: '$relative'."
}
if ([string]::IsNullOrWhiteSpace($model) -or $model.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
    throw "Manifest contains an invalid model name: '$model'."
}
if ($sourceHash -notmatch '^[0-9a-f]{64}$' -or $generatedHash -notmatch '^[0-9a-f]{64}$') {
    throw 'Manifest contains an invalid SHA-256 value.'
}

$target = [System.IO.Path]::GetFullPath((Join-Path $GtaRoot ($relative.Replace('/', '\\'))))
$platformPrefix = $PlatformRoot.TrimEnd('\\') + '\\'
if (-not $target.StartsWith($platformPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved override is outside newmods/platform: '$target'."
}

$original = Join-Path $ProbeRoot ("work\original\{0}.ydr" -f $model)
if (-not (Test-Path -LiteralPath $original -PathType Leaf)) {
    throw "The exact extracted original YDR is missing: '$original'. Do not redownload or guess a replacement."
}
$actualSourceHash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSourceHash -ne $sourceHash) {
    throw "Extracted original hash mismatch. Expected $sourceHash, got $actualSourceHash."
}

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "The active generated override is missing: '$target'."
}
$activeHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($activeHash -eq $sourceHash -and $probeMode -eq 'IDENTITY_OVERRIDE') {
    Write-Host 'Identity override is already active and hash-identical to the extracted Rockstar source.'
    exit 0
}
if ($activeHash -ne $generatedHash) {
    throw "Active override hash no longer matches the manifest. Expected $generatedHash, got $activeHash. Refusing replacement."
}

$temp = $target + '.vox_identity_tmp'
if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Force
}
Copy-Item -LiteralPath $original -Destination $temp
$tempHash = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
if ($tempHash -ne $sourceHash) {
    Remove-Item -LiteralPath $temp -Force
    throw "Identity-copy hash verification failed. Expected $sourceHash, got $tempHash."
}
Move-Item -LiteralPath $temp -Destination $target -Force
$installedHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($installedHash -ne $sourceHash) {
    throw "Installed identity override hash verification failed. Expected $sourceHash, got $installedHash."
}

if ($null -eq $manifest.PSObject.Properties['transformed_sha256']) {
    $manifest | Add-Member -NotePropertyName transformed_sha256 -NotePropertyValue $generatedHash
} else {
    $manifest.transformed_sha256 = $generatedHash
}
if ($null -eq $manifest.PSObject.Properties['probe_mode']) {
    $manifest | Add-Member -NotePropertyName probe_mode -NotePropertyValue 'IDENTITY_OVERRIDE'
} else {
    $manifest.probe_mode = 'IDENTITY_OVERRIDE'
}
$manifest.generated_sha256 = $sourceHash
if ($null -eq $manifest.PSObject.Properties['identity_override_installed_at']) {
    $manifest | Add-Member -NotePropertyName identity_override_installed_at -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o'))
} else {
    $manifest.identity_override_installed_at = (Get-Date).ToUniversalTime().ToString('o')
}
$manifest | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

@(
    'VOX GTA V Enhanced visual crash isolation'
    'tool_version=0.0.1-dev.15.2'
    'status=IDENTITY_OVERRIDE_INSTALLED'
    "model=$model"
    "override=$relative"
    "source_sha256=$sourceHash"
    "active_sha256=$installedHash"
    "transformed_sha256=$generatedHash"
    'identity_bytes_equal_source=true'
    ''
    'Purpose: isolate RageOpenV/newmods mounting from FiveFury YDR reconstruction.'
    'Launch Story Mode once with this byte-identical override.'
    'If Story Mode still crashes, the mount/path layer is implicated.'
    'If Story Mode loads, the FiveFury-rebuilt YDR is implicated.'
    'After the test, run 03_ROLLBACK_VISUAL_PROBE.cmd.'
) | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15.2 IDENTITY OVERRIDE INSTALLED'
Write-Host '============================================================'
Write-Host "Model: $model"
Write-Host "Override: $relative"
Write-Host "SHA-256: $installedHash"
Write-Host 'The active override is now byte-for-byte identical to the extracted original.'
Write-Host 'Launch Story Mode once. Do not look for a visual difference in this isolation test.'
