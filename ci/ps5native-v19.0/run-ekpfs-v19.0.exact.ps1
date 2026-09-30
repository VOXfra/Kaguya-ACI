$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build';New-Item -ItemType Directory -Force -Path $Build|Out-Null
$Stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$Diag=Join-Path $Build ('diag-ekpfs-v19.0-'+$Stamp);New-Item -ItemType Directory -Force -Path $Diag|Out-Null
$Zip=Join-Path $Root ('UPLOAD-ME-EKPFS-v19.0-'+$Stamp+'.zip');$env:PYTHONDONTWRITEBYTECODE='1'
$Game=$env:DAKAR_GAME_ROOT;if([string]::IsNullOrWhiteSpace($Game)){$Game='E:\_Jeux Convertis\PS5 - Dakar\Game\ps5\user\app\PPSA04477'}
$Key=$env:DAKAR_EKPFS_PATH
$script:HadFail=$false;$script:HadPending=$false;$script:Steps=@()
function RunPy([string]$Name,[string[]]$Args,[int[]]$PendingCodes=@()){
  $log=Join-Path $Diag ($Name+'.log');Write-Host "`n[RUN] $Name" -ForegroundColor Cyan
  $prev=$ErrorActionPreference;$ErrorActionPreference='Continue';try{$out=& python -B @Args 2>&1;$rc=$LASTEXITCODE;@($out)|ForEach-Object{$_.ToString()}|Tee-Object -FilePath $log|ForEach-Object{Write-Host $_}}finally{$ErrorActionPreference=$prev}
  $status=if($rc-eq0){'PASS'}elseif($PendingCodes -contains $rc){'PENDING'}else{'FAIL'}
  if($status-eq'FAIL'){$script:HadFail=$true}elseif($status-eq'PENDING'){$script:HadPending=$true}
  $script:Steps+=[pscustomobject]@{Name=$Name;Status=$status;ExitCode=$rc;Log=[IO.Path]::GetFileName($log)};Write-Host "[$status] $Name"
  return $rc
}
$Car=Join-Path $Build 'ekpfs-carried-v19.0.json';$CarTxt=Join-Path $Build 'ekpfs-carried-v19.0.txt'
[void](RunPy '01-carried-ekpfs-evidence' @((Join-Path $PSScriptRoot 'reconcile-ekpfs-boundary-v19.0.py'),'--root',$Root,'--out',$Car,'--text-out',$CarTxt))
$Prof=Join-Path $Build 'ekpfs-wrapped-profile-v19.0.json';$ProfTxt=Join-Path $Build 'ekpfs-wrapped-profile-v19.0.txt'
if(Test-Path -LiteralPath (Join-Path $Game 'app.json')){[void](RunPy '02-real-wrapped-key-profile' @((Join-Path $PSScriptRoot 'ekpfs-wrapped-profile-v19.0.py'),'--input',$Game,'--out',$Prof,'--text-out',$ProfTxt,'--carried',(Join-Path $Root 'evidence/ps5/user/dakar-retail-wrapped-key-boundary-v9.0.json')))}else{$HadFail=$true;$Steps+=[pscustomobject]@{Name='02-real-wrapped-key-profile';Status='FAIL';ExitCode=42;Log='missing-game-root'};Write-Host '[FAIL] 02-real-wrapped-key-profile: game root not found'}
$Ent=Join-Path $Build 'ekpfs-entitlement-census-v19.0.json';$EntTxt=Join-Path $Build 'ekpfs-entitlement-census-v19.0.txt'
[void](RunPy '03-entitlement-rif-census' @((Join-Path $PSScriptRoot 'ekpfs-entitlement-census-v19.0.py'),'--input',$Game,'--out',$Ent,'--text-out',$EntTxt))
[void](RunPy '04-dual-schedule-crypto-selftest' @((Join-Path $PSScriptRoot 'ps5_ekpfs_boundary_v19.py'),'--selftest'))
$Gate=Join-Path $Build 'ekpfs-dual-schedule-gate-v19.0.json';$GateTxt=Join-Path $Build 'ekpfs-dual-schedule-gate-v19.0.txt';$ga=@((Join-Path $PSScriptRoot 'dakar-ekpfs-intake-gate-v19.0.py'),'--input',$Game,'--out',$Gate,'--text-out',$GateTxt);if(-not[string]::IsNullOrWhiteSpace($Key)){$ga+=@('--ekpfs',$Key)}
[void](RunPy '05-real-dual-schedule-ekpfs-gate' $ga @(30,31))
$Conc=Join-Path $Build 'ekpfs-boundary-conclusion-v19.0.json';$ConcTxt=Join-Path $Build 'ekpfs-boundary-conclusion-v19.0.txt';$ca=@((Join-Path $PSScriptRoot 'ekpfs-boundary-conclusion-v19.0.py'),'--carried',$Car,'--research',(Join-Path $Root 'evidence/ps5/public-ekpfs-research-v19.0.json'),'--out',$Conc,'--text-out',$ConcTxt);if(Test-Path $Prof){$ca+=@('--profile',$Prof)};if(Test-Path $Ent){$ca+=@('--entitlement',$Ent)};if(Test-Path $Gate){$ca+=@('--gate',$Gate)}
[void](RunPy '06-ekpfs-boundary-conclusion' $ca @(30))
$Audit=Join-Path $Build 'package-cleanliness-audit-v19.0.json';$AuditTxt=Join-Path $Build 'package-cleanliness-audit-v19.0.txt'
[void](RunPy '07-package-cleanliness-final' @((Join-Path $PSScriptRoot 'package-cleanliness-audit-v19.0.py'),'--root',$Root,'--json-out',$Audit,'--text-out',$AuditTxt))
foreach($p in @($Car,$CarTxt,$Prof,$ProfTxt,$Ent,$EntTxt,$Gate,$GateTxt,$Conc,$ConcTxt,$Audit,$AuditTxt)){if(Test-Path $p){Copy-Item $p $Diag -Force}}
Copy-Item (Join-Path $Root 'evidence/ps5/public-ekpfs-research-v19.0.json') $Diag -Force
$Steps|ConvertTo-Json -Depth 4|Set-Content (Join-Path $Diag 'summary.json') -Encoding UTF8
@('PS5NativeCore v19.0 EKPFS BOUNDARY LAB','',"Overall: $(if($HadFail){'FAIL'}elseif($HadPending){'PENDING'}else{'PASS'})",'Validated PS5-rehost baseline: 86.0%','Only EKPFS-frontier evidence is in scope. No roadmap credit is awarded unless the real 4/4 gate is crossed.','')+($Steps|ForEach-Object{"$($_.Name): $($_.Status) exit=$($_.ExitCode)"})|Set-Content (Join-Path $Diag 'SUMMARY.txt') -Encoding UTF8
Get-ChildItem $Diag -Recurse -File|Sort-Object FullName|ForEach-Object{$h=Get-FileHash $_.FullName -Algorithm SHA256;"$($h.Hash)  $($_.FullName.Substring($Diag.Length).TrimStart('\'))"}|Set-Content (Join-Path $Diag 'SHA256SUMS.txt') -Encoding ASCII
if(Test-Path $Zip){Remove-Item $Zip -Force};Compress-Archive -Path (Join-Path $Diag '*') -DestinationPath $Zip -CompressionLevel Optimal -Force
Write-Host "`n============================================================";Write-Host 'v19.0 EKPFS BOUNDARY DIAGNOSTIC ZIP READY' -ForegroundColor Cyan;Write-Host 'UPLOAD THIS FILE:' -ForegroundColor Yellow;Write-Host $Zip -ForegroundColor Yellow;Write-Host '============================================================'
if($HadFail){exit 1};if($HadPending){exit 30};exit 0
