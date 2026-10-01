$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build';New-Item -ItemType Directory -Force -Path $Build|Out-Null
$Stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$Diag=Join-Path $Build ('diag-ekpfs-v19.1-'+$Stamp);New-Item -ItemType Directory -Force -Path $Diag|Out-Null
$Zip=Join-Path $Root ('UPLOAD-ME-EKPFS-v19.1-'+$Stamp+'.zip');$env:PYTHONDONTWRITEBYTECODE='1';$env:PYTHONUNBUFFERED='1'
$Game=$env:DAKAR_GAME_ROOT;if([string]::IsNullOrWhiteSpace($Game)){$Game='E:\_Jeux Convertis\PS5 - Dakar\Game\ps5\user\app\PPSA04477'}
$Key=$env:DAKAR_EKPFS_PATH;$script:HadFail=$false;$script:HadPending=$false;$script:Steps=@()
Write-Host 'V191_RIF_BRIDGE_RUNNER_START' -ForegroundColor Green
Write-Host ('Project: '+$Root);Write-Host ('Game:    '+$Game)
$PyCmd=Get-Command python.exe -ErrorAction SilentlyContinue
if(-not $PyCmd){$PyCmd=Get-Command python -ErrorAction SilentlyContinue}
if(-not $PyCmd){exit 2}
$Python=$PyCmd.Source;Write-Host ('Python:  '+$Python);& $Python --version
if($LASTEXITCODE-ne0){exit 2}
function AddStep([string]$Name,[string]$Status,[int]$Rc,[string]$Log){
 if($Status-eq'FAIL'){$script:HadFail=$true}elseif($Status-eq'PENDING'){$script:HadPending=$true}
 $script:Steps+=[pscustomobject]@{Name=$Name;Status=$Status;ExitCode=$Rc;Log=$Log};Write-Host "[$Status] $Name"
}
function RunPy([string]$Name,[string[]]$PyArgs,[int[]]$PendingCodes=@()){
 $log=Join-Path $Diag ($Name+'.log');Write-Host "`n[RUN] $Name" -ForegroundColor Cyan
 $prev=$ErrorActionPreference;$ErrorActionPreference='Continue'
 try{& $Python -u -B @PyArgs 2>&1|Tee-Object -FilePath $log|ForEach-Object{Write-Host $_};$rc=$LASTEXITCODE}finally{$ErrorActionPreference=$prev}
 $status=if($rc-eq0){'PASS'}elseif($PendingCodes -contains $rc){'PENDING'}else{'FAIL'}
 AddStep $Name $status $rc ([IO.Path]::GetFileName($log));return $rc
}
Write-Host "`n[RUN] 01-carried-ekpfs-evidence" -ForegroundColor Cyan
$CarSrc=Join-Path $Root 'evidence/ps5/ekpfs-carried-state-v19.0.1.txt'
if(Test-Path $CarSrc){Get-Content $CarSrc|ForEach-Object{Write-Host $_};AddStep '01-carried-ekpfs-evidence' 'PASS' 0 'precomputed'}else{AddStep '01-carried-ekpfs-evidence' 'FAIL' 41 'missing'}
$Rif=Join-Path $Build 'ekpfs-rif-bridge-v19.1.json';$RifTxt=Join-Path $Build 'ekpfs-rif-bridge-v19.1.txt'
[void](RunPy '02-real-rif-entitlement-bridge' @((Join-Path $PSScriptRoot 'ekpfs-rif-bridge-v19.1.py'),'--input',$Game,'--out',$Rif,'--text-out',$RifTxt))
$Gate=Join-Path $Build 'ekpfs-dual-schedule-gate-v19.1.json';$GateTxt=Join-Path $Build 'ekpfs-dual-schedule-gate-v19.1.txt'
$ga=@((Join-Path $PSScriptRoot 'dakar-ekpfs-intake-gate-v19.0.py'),'--input',$Game,'--out',$Gate,'--text-out',$GateTxt)
if(-not[string]::IsNullOrWhiteSpace($Key)){$ga+=@('--ekpfs',$Key)}
[void](RunPy '03-real-dual-schedule-ekpfs-gate' $ga @(30,31))
$Audit=Join-Path $Build 'package-cleanliness-audit-v19.1.json';$AuditTxt=Join-Path $Build 'package-cleanliness-audit-v19.1.txt'
[void](RunPy '04-package-cleanliness-final' @((Join-Path $PSScriptRoot 'package-cleanliness-audit-v19.1.py'),'--root',$Root,'--json-out',$Audit,'--text-out',$AuditTxt))
if($HadFail){exit 1};if($HadPending){exit 30};exit 0
