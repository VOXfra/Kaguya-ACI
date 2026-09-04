$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExeName = 'GTA5_Enhanced.exe'
$BaseDir = Join-Path $env:LOCALAPPDATA 'VOXModernOverhaul\CrashCapture'
$BackupPath = Join-Path $BaseDir 'wer-backup.json'
$StatePath = Join-Path $BaseDir 'capture-state.txt'
$RegPath = "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\$ExeName"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Set-RegistryValueFromBackup {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)]$State
    )

    if (-not $State.Exists) {
        Remove-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction SilentlyContinue
        return
    }

    $kind = [string]$State.Kind
    switch ($kind) {
        'String'       { $propertyType = 'String' }
        'ExpandString' { $propertyType = 'ExpandString' }
        'Binary'       { $propertyType = 'Binary' }
        'DWord'        { $propertyType = 'DWord' }
        'MultiString'  { $propertyType = 'MultiString' }
        'QWord'        { $propertyType = 'QWord' }
        default { throw "Unsupported registry value kind in backup: $kind" }
    }

    New-ItemProperty -Path $Path -Name $Name -PropertyType $propertyType -Value $State.Value -Force | Out-Null
}

if (-not (Test-IsAdministrator)) {
    throw 'Administrator privileges are required to restore Windows WER LocalDumps settings.'
}

if (-not (Test-Path -LiteralPath $BackupPath)) {
    throw "No VOX WER backup was found at '$BackupPath'. Refusing to modify registry settings blindly."
}

$backup = Get-Content -LiteralPath $BackupPath -Raw | ConvertFrom-Json

if (-not $backup.RegistryKeyExisted) {
    Remove-Item -LiteralPath $RegPath -Recurse -Force -ErrorAction SilentlyContinue
} else {
    New-Item -Path $RegPath -Force | Out-Null
    Set-RegistryValueFromBackup -Path $RegPath -Name 'DumpFolder' -State $backup.DumpFolder
    Set-RegistryValueFromBackup -Path $RegPath -Name 'DumpCount' -State $backup.DumpCount
    Set-RegistryValueFromBackup -Path $RegPath -Name 'DumpType' -State $backup.DumpType
    Set-RegistryValueFromBackup -Path $RegPath -Name 'CustomDumpFlags' -State $backup.CustomDumpFlags
}

Remove-Item -LiteralPath $BackupPath -Force
Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'VOX GTA V crash capture settings were restored to their previous state.'
Write-Host 'Existing dump files were NOT deleted.'
