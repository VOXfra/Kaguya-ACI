param(
    [int]$LookbackMinutes = 30
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GameRoot = Split-Path -Parent $ToolDir
$BaseDir = Join-Path $env:LOCALAPPDATA 'VOXModernOverhaul\CrashCapture'
$DumpDir = Join-Path $BaseDir 'Dumps'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$WorkDir = Join-Path $BaseDir "Evidence-$Timestamp"
$ZipPath = Join-Path $ToolDir "VOX-Crash-Evidence-$Timestamp.zip"

if (Test-Path -LiteralPath $WorkDir) {
    Remove-Item -LiteralPath $WorkDir -Recurse -Force
}
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null

$StartTime = (Get-Date).AddMinutes(-1 * [Math]::Abs($LookbackMinutes))

$envLines = [System.Collections.Generic.List[string]]::new()
$envLines.Add("collected_at=$((Get-Date).ToString('o'))")
$envLines.Add("lookback_minutes=$LookbackMinutes")
$envLines.Add("game_root=$GameRoot")
$envLines.Add("windows=$([Environment]::OSVersion.VersionString)")
$envLines.Add("powershell=$($PSVersionTable.PSVersion)")
$gameExe = Join-Path $GameRoot 'GTA5_Enhanced.exe'
if (Test-Path -LiteralPath $gameExe -PathType Leaf) {
    $file = Get-Item -LiteralPath $gameExe
    $envLines.Add("gta_file_version=$($file.VersionInfo.FileVersion)")
    $envLines.Add("gta_product_version=$($file.VersionInfo.ProductVersion)")
    $envLines.Add("gta_sha256=$((Get-FileHash -LiteralPath $gameExe -Algorithm SHA256).Hash.ToLowerInvariant())")
} else {
    $envLines.Add('gta_executable=missing')
}
$envLines | Set-Content -LiteralPath (Join-Path $WorkDir 'environment.txt') -Encoding UTF8

try {
    $events = Get-WinEvent -FilterHashtable @{ LogName='Application'; StartTime=$StartTime } -ErrorAction Stop |
        Where-Object {
            $_.ProviderName -in @('Application Error','Windows Error Reporting') -or
            ($_.Message -match '(?i)GTA5_Enhanced\.exe|gta5_enhanced\.exe')
        } |
        Sort-Object TimeCreated

    if ($events) {
        $events |
            Select-Object TimeCreated, Id, LevelDisplayName, ProviderName, Message |
            Format-List |
            Out-String -Width 4096 |
            Set-Content -LiteralPath (Join-Path $WorkDir 'windows-application-events.txt') -Encoding UTF8
    } else {
        'No matching Application log events were found in the requested time window.' |
            Set-Content -LiteralPath (Join-Path $WorkDir 'windows-application-events.txt') -Encoding UTF8
    }
} catch {
    "Failed to query Application event log: $($_.Exception.Message)" |
        Set-Content -LiteralPath (Join-Path $WorkDir 'windows-application-events.txt') -Encoding UTF8
}

$logNames = @(
    'asiloader.log',
    'ScriptHookV.log',
    'RageOpenV.log',
    'ScriptHookVDotNet.log'
)
foreach ($name in $logNames) {
    $source = Join-Path $GameRoot $name
    if (Test-Path -LiteralPath $source -PathType Leaf) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $WorkDir $name) -Force
    }
}

$inventoryNames = @(
    'VOXModernOverhaul.asi',
    'VOXModernOverhaul.asi.disabled',
    'RageOpenV.asi',
    'ScriptHookVDotNet.asi',
    'TrainerV.asi',
    'ScriptHookV.dll',
    'dinput8.dll'
)
$inventory = foreach ($name in $inventoryNames) {
    $path = Join-Path $GameRoot $name
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $item = Get-Item -LiteralPath $path
        [PSCustomObject]@{
            Name = $name
            Size = $item.Length
            LastWriteTime = $item.LastWriteTime.ToString('o')
            SHA256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
}
if ($inventory) {
    $inventory | Format-Table -AutoSize | Out-String -Width 4096 |
        Set-Content -LiteralPath (Join-Path $WorkDir 'plugin-inventory.txt') -Encoding UTF8
}

if (Test-Path -LiteralPath $DumpDir) {
    Get-ChildItem -LiteralPath $DumpDir -File -Filter '*.dmp' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $StartTime } |
        ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $WorkDir $_.Name) -Force
        }
}

$RegPath = 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\GTA5_Enhanced.exe'
if (Test-Path -LiteralPath $RegPath) {
    Get-ItemProperty -LiteralPath $RegPath |
        Format-List * |
        Out-String -Width 4096 |
        Set-Content -LiteralPath (Join-Path $WorkDir 'wer-registry-state.txt') -Encoding UTF8
}

if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path (Join-Path $WorkDir '*') -DestinationPath $ZipPath -CompressionLevel Optimal

Write-Host ''
Write-Host 'Evidence collection complete.'
Write-Host "ZIP: $ZipPath"
Write-Host ''
Write-Host 'Upload that ZIP in the ChatGPT project conversation.'
