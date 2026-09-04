param(
    [ValidateSet(1,2)]
    [int]$DumpType = 1
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExeName = 'GTA5_Enhanced.exe'
$BaseDir = Join-Path $env:LOCALAPPDATA 'VOXModernOverhaul\CrashCapture'
$DumpDir = Join-Path $BaseDir 'Dumps'
$BackupPath = Join-Path $BaseDir 'wer-backup.json'
$StatePath = Join-Path $BaseDir 'capture-state.txt'
$RegPath = "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\$ExeName"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Read-RegistryValueState {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return [ordered]@{ Exists = $false; Kind = $null; Value = $null }
    }

    $key = Get-Item -LiteralPath $Path
    try {
        $kind = $key.GetValueKind($Name).ToString()
        $value = $key.GetValue($Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        return [ordered]@{ Exists = $true; Kind = $kind; Value = $value }
    } catch [System.ArgumentException] {
        return [ordered]@{ Exists = $false; Kind = $null; Value = $null }
    }
}

if (-not (Test-IsAdministrator)) {
    throw 'Administrator privileges are required because Windows WER LocalDumps is configured under HKLM.'
}

New-Item -ItemType Directory -Path $BaseDir -Force | Out-Null
New-Item -ItemType Directory -Path $DumpDir -Force | Out-Null

if (-not (Test-Path -LiteralPath $BackupPath)) {
    $backup = [ordered]@{
        CapturedAt = (Get-Date).ToString('o')
        RegistryKeyExisted = (Test-Path -LiteralPath $RegPath)
        DumpFolder = Read-RegistryValueState -Path $RegPath -Name 'DumpFolder'
        DumpCount = Read-RegistryValueState -Path $RegPath -Name 'DumpCount'
        DumpType = Read-RegistryValueState -Path $RegPath -Name 'DumpType'
        CustomDumpFlags = Read-RegistryValueState -Path $RegPath -Name 'CustomDumpFlags'
    }
    $backup | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $BackupPath -Encoding UTF8
}

New-Item -Path $RegPath -Force | Out-Null
New-ItemProperty -Path $RegPath -Name 'DumpFolder' -PropertyType ExpandString -Value $DumpDir -Force | Out-Null
New-ItemProperty -Path $RegPath -Name 'DumpCount' -PropertyType DWord -Value 3 -Force | Out-Null
New-ItemProperty -Path $RegPath -Name 'DumpType' -PropertyType DWord -Value $DumpType -Force | Out-Null

@(
    "enabled_at=$((Get-Date).ToString('o'))"
    "exe=$ExeName"
    "dump_type=$DumpType"
    "dump_folder=$DumpDir"
) | Set-Content -LiteralPath $StatePath -Encoding UTF8

Write-Host ''
Write-Host 'VOX GTA V crash capture is ENABLED.'
Write-Host "Target: $ExeName"
Write-Host "Dump folder: $DumpDir"
Write-Host "Dump type: $DumpType (1=minidump, 2=full dump)"
Write-Host ''
Write-Host 'Next: run 02A_DISABLE_VOX_ASI.cmd for the baseline launch.'
