[CmdletBinding()]
param(
    [switch]$Refresh,
    [switch]$SkipApply
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LockPath = Join-Path $Root "upstream.lock.json"
$SdkPath = Join-Path $Root "SDK"
$OverlayPath = Join-Path $Root "overlay"
$PatchesPath = Join-Path $Root "patches"
$TestScript = Join-Path $Root "tools\Test-Workspace.ps1"

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "La commande Git a échoué : git $($Arguments -join ' ')"
    }
}

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Commande requise introuvable : $Name"
    }
}

if (-not (Test-Path $LockPath)) {
    throw "Fichier de verrouillage introuvable : $LockPath"
}

Assert-Command -Name "git"
$Lock = Get-Content -Raw -Path $LockPath | ConvertFrom-Json

Write-Host "[VOX] Workspace Unturned" -ForegroundColor Cyan
Write-Host "[VOX] SDK : $($Lock.repository)"
Write-Host "[VOX] Commit verrouillé : $($Lock.commit)"
Write-Host "[VOX] Unity attendu : $($Lock.unityVersion)"

if (-not (Test-Path (Join-Path $SdkPath ".git"))) {
    Write-Host "[VOX] Clonage du SDK officiel..." -ForegroundColor Yellow
    Invoke-Git -Arguments @("clone", "--filter=blob:none", "--no-checkout", $Lock.repository, $SdkPath)

    Push-Location $SdkPath
    try {
        Invoke-Git -Arguments @("fetch", "origin", $Lock.commit, "--depth=1")
        Invoke-Git -Arguments @("checkout", "--detach", $Lock.commit)
    }
    finally {
        Pop-Location
    }
}
elseif ($Refresh) {
    Write-Host "[VOX] Réinitialisation du SDK sur la baseline verrouillée..." -ForegroundColor Yellow
    Push-Location $SdkPath
    try {
        Invoke-Git -Arguments @("fetch", "origin", $Lock.commit, "--depth=1")
        Invoke-Git -Arguments @("reset", "--hard", $Lock.commit)
        Invoke-Git -Arguments @("clean", "-fd")
    }
    finally {
        Pop-Location
    }
}

Push-Location $SdkPath
try {
    $CurrentCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Impossible de lire le commit courant du SDK."
    }

    if ($CurrentCommit -ne $Lock.commit) {
        throw "Le SDK est sur $CurrentCommit au lieu de $($Lock.commit). Relance bootstrap.ps1 avec -Refresh."
    }
}
finally {
    Pop-Location
}

if (-not $SkipApply) {
    if (Test-Path $OverlayPath) {
        Write-Host "[VOX] Application de l'overlay VOX..." -ForegroundColor Yellow
        $OverlayItems = Get-ChildItem -Path $OverlayPath -Force -ErrorAction SilentlyContinue
        if ($OverlayItems.Count -gt 0) {
            & robocopy $OverlayPath $SdkPath /E /NFL /NDL /NJH /NJS /NP | Out-Null
            if ($LASTEXITCODE -ge 8) {
                throw "Robocopy a échoué avec le code $LASTEXITCODE."
            }
        }
    }

    if (Test-Path $PatchesPath) {
        $PatchFiles = Get-ChildItem -Path $PatchesPath -Filter "*.patch" -File | Sort-Object Name
        foreach ($PatchFile in $PatchFiles) {
            Write-Host "[VOX] Patch : $($PatchFile.Name)"
            Push-Location $SdkPath
            try {
                & git apply --check $PatchFile.FullName 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Invoke-Git -Arguments @("apply", "--whitespace=fix", $PatchFile.FullName)
                    continue
                }

                & git apply --reverse --check $PatchFile.FullName 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[VOX] Patch déjà appliqué : $($PatchFile.Name)" -ForegroundColor DarkGray
                    continue
                }

                throw "Le patch ne peut être ni appliqué ni reconnu comme déjà présent : $($PatchFile.Name)"
            }
            finally {
                Pop-Location
            }
        }
    }
}

if (Test-Path $TestScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TestScript
    if ($LASTEXITCODE -ne 0) {
        throw "La validation du workspace a échoué."
    }
}

Write-Host "[VOX] Workspace prêt." -ForegroundColor Green
Write-Host "[VOX] Ouvre le dossier SDK dans Unity $($Lock.unityVersion), puis Assets/GameStartup.unity."
