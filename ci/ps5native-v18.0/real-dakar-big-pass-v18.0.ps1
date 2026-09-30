$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build';New-Item -ItemType Directory -Force -Path $Build|Out-Null
$DefaultGame='E:\_Jeux Convertis\PS5 - Dakar\Game\ps5\user\app\PPSA04477'
$GameRoot=$env:DAKAR_GAME_ROOT;if([string]::IsNullOrWhiteSpace($GameRoot)){$GameRoot=$DefaultGame}
$Canonical=Join-Path $Build 'canonical-state-v18.0.json';$Gate=Join-Path $Build 'dakar-ekpfs-gate-v18.0.json';$Final=Join-Path $Build 'dakar-final-integration-v16.0.2.json'
if(-not(Test-Path -LiteralPath (Join-Path $GameRoot 'app.json'))){exit 42}
& python -B (Join-Path $PSScriptRoot 'reconcile-state-v18.0.py') --root $Root --out $Canonical --text-out (Join-Path $Build 'canonical-state-v18.0.txt');if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
$Key=$env:DAKAR_EKPFS_PATH
$ga=@('-B',(Join-Path $PSScriptRoot 'dakar-ekpfs-intake-gate-v13.5.py'),'--input',$GameRoot,'--json-out',$Gate,'--text-out',(Join-Path $Build 'dakar-ekpfs-gate-v18.0.txt'));if(-not[string]::IsNullOrWhiteSpace($Key)){$ga+=@('--ekpfs',$Key)}
& python @ga;if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'dakar-pc-loose-playgo-attempt-v17.4.ps1');$nsRc=$LASTEXITCODE
if($nsRc-ne0 -and $nsRc-ne30){exit $nsRc}
& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'dakar-final-retail-attempt-v16.0.2.ps1');$finalRc=$LASTEXITCODE
if(-not(Test-Path $Final)){exit 43}
exit $finalRc
