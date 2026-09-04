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
$DirectorySeparator = [System.IO.Path]::DirectorySeparatorChar.ToString()

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    Write-Host 'No VOX visual-probe manifest exists. Nothing to remove.'
    exit 0
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$relative = [string]$manifest.override_relative_path
$expectedHash = ([string]$manifest.generated_sha256).ToLowerInvariant()

if ([string]::IsNullOrWhiteSpace($relative) -or -not $relative.Replace('\','/').StartsWith('newmods/platform/', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Manifest contains an unsafe override path: '$relative'. Refusing deletion."
}
if ($relative -match '(^|[\\/])\.\.([\\/]|$)') {
    throw "Manifest contains traversal: '$relative'. Refusing deletion."
}

$target = [System.IO.Path]::GetFullPath((Join-Path $GtaRoot ($relative.Replace('/', $DirectorySeparator))))
$platformPrefix = $PlatformRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + $DirectorySeparator
if (-not $target.StartsWith($platformPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved override is outside newmods/platform: '$target'. Refusing deletion."
}

if (Test-Path -LiteralPath $target -PathType Leaf) {
    $actualHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        throw "Generated override no longer matches the manifest SHA-256. Refusing to delete a file that may have been changed by the user or another mod."
    }
    Remove-Item -LiteralPath $target -Force
    Write-Host "Removed VOX generated override: $target"
} else {
    Write-Host 'The generated override is already absent; continuing manifest cleanup.'
}

# Remove only empty directories created below newmods/platform. Never delete the mount root.
$current = Split-Path -Parent $target
while ($current.StartsWith($platformPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    if (-not (Test-Path -LiteralPath $current -PathType Container)) { break }
    $items = @(Get-ChildItem -LiteralPath $current -Force)
    if ($items.Count -ne 0) { break }
    Remove-Item -LiteralPath $current -Force
    $current = Split-Path -Parent $current
}

$work = Join-Path $ProbeRoot 'work'
if (Test-Path -LiteralPath $work -PathType Container) {
    Remove-Item -LiteralPath $work -Recurse -Force
}
Remove-Item -LiteralPath $ManifestPath -Force

@(
    'VOX GTA V Enhanced visual probe'
    'status=ROLLED_BACK'
    "rolled_back_at=$((Get-Date).ToString('o'))"
    "previous_model=$([string]$manifest.model_name)"
    "previous_override=$relative"
    'The generated override was removed without modifying any GTA archive.'
) | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host ''
Write-Host 'VOX visual probe rollback complete.'
Write-Host 'No GTA archive or vanilla save was modified.'
