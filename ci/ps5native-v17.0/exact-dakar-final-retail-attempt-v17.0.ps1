$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build';New-Item -ItemType Directory -Force -Path $Build|Out-Null
$DefaultGame='E:\_Jeux Convertis\PS5 - Dakar\Game\ps5\user\app\PPSA04477'
$GameRoot=$env:DAKAR_GAME_ROOT;if([string]::IsNullOrWhiteSpace($GameRoot)){$GameRoot=$DefaultGame}
$ReportJson=Join-Path $Build 'dakar-final-integration-v17.0.json';$ReportTxt=Join-Path $Build 'dakar-final-integration-v17.0.txt'
$UnlockJson=Join-Path $Build 'dakar-pc-only-unlock-v17.0.json';$UnlockTxt=Join-Path $Build 'dakar-pc-only-unlock-v17.0.txt';$PrivateKey=Join-Path $Build 'private-v17.0\dakar_ekpfs.bin'
$PcDiscovery=Join-Path $Build 'dakar-official-pc-discovery-v17.0.json'
$ModuleSet=Join-Path $Build 'dakar-module-set-v15.0.json';$Extract=Join-Path $Build 'post-ekpfs-v15.0';$FinalExe=Join-Path $Build 'apps\dakar_final_integration\Release\DakarFinalIntegration.exe'
function Write-Report([string]$Status,[string]$Blocker,[int]$ExitCode,[string[]]$Details){$o=[ordered]@{schema='ps5native.dakar-final-integration.v17.0';status=$Status;blocker=$Blocker;exit_code=$ExitCode;validated_baseline_percent=86.0;target_percent=100.0;menu_gameplay_required_for_100=$true;pc_only_unlock_attempted=$true;details=@($Details)};$o|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $ReportJson -Encoding UTF8;@('PS5NativeCore v17.0 PC-ONLY UNWRAP/BOOT attempt',('Status: '+$Status),('Blocker: '+$Blocker),('Exit code: '+$ExitCode),'Validated baseline: 86.0%','Frozen target: 100.0%','100% still requires visible interactive Dakar menu + interactive gameplay.','')+@($Details)|Set-Content -LiteralPath $ReportTxt -Encoding UTF8}
if(-not(Test-Path -LiteralPath (Join-Path $GameRoot 'app.json'))){Write-Report 'BLOCKED' 'GAME_SPLIT_BACKUP_NOT_FOUND' 42 @('Expected app.json under: '+$GameRoot);exit 42}
$Explicit=$env:DAKAR_EKPFS_PATH;if([string]::IsNullOrWhiteSpace($Explicit)){foreach($c in @((Join-Path $Root 'keys\dakar_ekpfs.bin'),(Join-Path $Root 'keys\dakar_ekpfs.hex'))){if(Test-Path -LiteralPath $c){$Explicit=$c;break}}}
$Args=@('-B',(Join-Path $PSScriptRoot 'dakar-pc-only-unlock-v17.0.py'),'--root',$Root,'--input',$GameRoot,'--out',$UnlockJson,'--text-out',$UnlockTxt,'--private-key-out',$PrivateKey)
if(-not[string]::IsNullOrWhiteSpace($Explicit)){$Args+=@('--supplied-ekpfs',$Explicit)}
Write-Host '--- v17 PC-only deterministic retail unlock attempt ---' -ForegroundColor Cyan
$prev=$ErrorActionPreference;$ErrorActionPreference='Continue';try{& python @Args;$unlockRc=$LASTEXITCODE}finally{$ErrorActionPreference=$prev}
if($unlockRc-eq30){
  Write-Host '--- Optional local official-PC build census (no download, no ownership bypass) ---' -ForegroundColor Cyan
  $prev=$ErrorActionPreference;$ErrorActionPreference='Continue';try{& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'find-official-dakar-pc-v17.0.ps1') -OutJson $PcDiscovery;$pcRc=$LASTEXITCODE}finally{$ErrorActionPreference=$prev}
  $pcNote=if($pcRc-eq0){'An official Dakar PC installation is locally available as a future cross-build oracle; v17 did not substitute it for PS5 retail execution.'}else{'No official Dakar PC installation is present locally; no download was attempted.'}
  Write-Host 'FINAL_STATUS=PENDING RETAIL_UNWRAP_REQUIRED' -ForegroundColor Yellow
  Write-Report 'PENDING' 'RETAIL_UNWRAP_REQUIRED' 30 @('Public/default deterministic package-key candidates did not validate against Dakar imagedigs.',$pcNote,'No brute force or key scraping was attempted. Runtime remains ready; the blocker precedes eboot execution.')
  exit 30
}
if($unlockRc-ne0){Write-Report 'BLOCKED' 'PC_ONLY_UNLOCK_PROBE_FAILED' $unlockRc @();exit $unlockRc}
if(-not(Test-Path -LiteralPath $PrivateKey)){Write-Report 'BLOCKED' 'UNLOCK_READY_WITHOUT_PRIVATE_KEY' 43 @();exit 43}
$env:DAKAR_EKPFS_PATH=$PrivateKey
Write-Host '--- v17 candidate VALIDATED; entering real post-EKPFS pipeline ---' -ForegroundColor Green
$prev=$ErrorActionPreference;$ErrorActionPreference='Continue';try{$pipeOut=& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'dakar-post-ekpfs-pipeline-v15.0.ps1') 2>&1;$pipeRc=$LASTEXITCODE}finally{$ErrorActionPreference=$prev};@($pipeOut)|ForEach-Object{Write-Host $_.ToString()}
if($pipeRc-ne0){Write-Report 'BLOCKED' 'POST_EKPFS_PIPELINE_FAILED' $pipeRc @($pipeOut|ForEach-Object{$_.ToString()});exit $pipeRc}
if(-not(Test-Path $ModuleSet)){Write-Report 'BLOCKED' 'MODULE_SET_MISSING' 31 @();exit 31}
$M=Get-Content -LiteralPath $ModuleSet -Raw|ConvertFrom-Json
if($M.status-ne'READY'){Write-Report 'BLOCKED' ('MODULE_SET_'+[string]$M.status) 31 @($M.blockers|ForEach-Object{[string]$_});exit 31}
& python -B (Join-Path $PSScriptRoot 'dakar-module-set-v15.0.py') validate --manifest $ModuleSet --artifact-root $Extract;if($LASTEXITCODE-ne0){Write-Report 'BLOCKED' 'MODULE_SET_VALIDATION_FAILED' $LASTEXITCODE @();exit $LASTEXITCODE}
$ById=@{};foreach($rec in @($M.modules)){$ById[[string]$rec.identity]=$rec};$ModulePaths=@();foreach($id in @($M.startup_order)){$rec=$ById[[string]$id];if($null-eq$rec){Write-Report 'BLOCKED' 'MODULE_ORDER_RECORD_MISSING' 32 @([string]$id);exit 32};$ModulePaths+=Join-Path $Extract ([string]$rec.relative_path)};$RootIdentity=[string]$M.root.identity
Write-Host '--- Retail CPU/unwind preflight ---' -ForegroundColor Cyan
& python -B (Join-Path $PSScriptRoot 'cpu-compat-scan-v16.0.py') @ModulePaths --out (Join-Path $Build 'dakar-cpu-compat-v17.0.json');if($LASTEXITCODE-ne0){Write-Report 'BLOCKED' 'CPU_STATIC_SCAN_FAILED' $LASTEXITCODE @();exit $LASTEXITCODE}
& python -B (Join-Path $PSScriptRoot 'cxx-unwind-preflight-v16.0.py') @ModulePaths --out (Join-Path $Build 'dakar-cxx-unwind-v17.0.json');if($LASTEXITCODE-ne0){Write-Report 'BLOCKED' 'CXX_UNWIND_PREFLIGHT_FAILED' $LASTEXITCODE @();exit $LASTEXITCODE}
Write-Host '--- REAL DAKAR ENTRY ATTEMPT ---' -ForegroundColor Green
$prev=$ErrorActionPreference;$ErrorActionPreference='Continue';try{$runOut=& $FinalExe $GameRoot $RootIdentity @ModulePaths 2>&1;$runRc=$LASTEXITCODE}finally{$ErrorActionPreference=$prev};@($runOut)|ForEach-Object{Write-Host $_.ToString()};$lines=@($runOut|ForEach-Object{$_.ToString()});$blocker='NONE';foreach($line in $lines){if($line -like 'FINAL_BLOCKER=*'){$blocker=$line.Substring('FINAL_BLOCKER='.Length);break}}
if($runRc-ne0){if($blocker-eq'NONE'){$blocker='FINAL_EXECUTION_FAILED'};Write-Report 'BLOCKED' $blocker $runRc $lines;exit $runRc}
Write-Report 'ROOT_RETURNED' 'AWAITING_REAL_MENU_GAMEPLAY_PROOF' 0 $lines
Write-Host 'V170_RETAIL_EXECUTION_PATH_COMPLETED';Write-Host '100% is not automatic: upload the diagnostic after checking menu + gameplay.';exit 0
