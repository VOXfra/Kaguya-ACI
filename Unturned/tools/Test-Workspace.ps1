[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LockPath = Join-Path $Root "upstream.lock.json"
$SdkPath = Join-Path $Root "SDK"

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Error "[VOX] $Message"
    exit 1
}

if (-not (Test-Path $LockPath)) {
    Fail "upstream.lock.json absent."
}

$Lock = Get-Content -Raw -Path $LockPath | ConvertFrom-Json

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git n'est pas installé ou n'est pas dans PATH."
}

if (-not (Test-Path (Join-Path $SdkPath ".git"))) {
    Fail "Le SDK n'a pas été cloné dans Unturned/SDK."
}

$ProjectVersionPath = Join-Path $SdkPath "ProjectSettings\ProjectVersion.txt"
if (-not (Test-Path $ProjectVersionPath)) {
    Fail "ProjectSettings/ProjectVersion.txt est absent du SDK."
}

$ProjectVersion = Get-Content -Raw -Path $ProjectVersionPath
if ($ProjectVersion -notmatch [regex]::Escape("m_EditorVersion: $($Lock.unityVersion)")) {
    Fail "Version Unity inattendue. Attendu : $($Lock.unityVersion)."
}

$StartupScene = Join-Path $SdkPath ($Lock.startupScene -replace "/", "\")
if (-not (Test-Path $StartupScene)) {
    Fail "Scène de démarrage absente : $($Lock.startupScene)"
}

Push-Location $SdkPath
try {
    $CurrentCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        Fail "Impossible de lire le commit courant du SDK."
    }

    if ($CurrentCommit -ne $Lock.commit) {
        Fail "Commit SDK inattendu : $CurrentCommit (attendu $($Lock.commit))."
    }

    & git diff --check
    if ($LASTEXITCODE -ne 0) {
        Fail "git diff --check signale des erreurs dans les modifications VOX."
    }
}
finally {
    Pop-Location
}

Write-Host "[VOX] Validation OK" -ForegroundColor Green
Write-Host "[VOX] Unity : $($Lock.unityVersion)"
Write-Host "[VOX] SDK : $($Lock.commit)"
Write-Host "[VOX] Scene : $($Lock.startupScene)"
exit 0
