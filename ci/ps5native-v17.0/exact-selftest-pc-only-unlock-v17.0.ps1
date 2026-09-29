$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build\v17-unlock-selftest';if(Test-Path $Build){Remove-Item -Recurse -Force $Build};New-Item -ItemType Directory -Force -Path $Build|Out-Null
$Fix=Join-Path $Build 'positive'
& python -B (Join-Path $PSScriptRoot 'make-pc-only-unlock-fixture-v17.0.py') --root $Root --out $Fix
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
$Rep=Join-Path $Build 'positive.json';$Txt=Join-Path $Build 'positive.txt';$Key=Join-Path $Build 'private\dakar_ekpfs.bin'
& python -B (Join-Path $PSScriptRoot 'dakar-pc-only-unlock-v17.0.py') --root $Root --input $Fix --out $Rep --text-out $Txt --private-key-out $Key
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
$D=Get-Content -LiteralPath $Rep -Raw|ConvertFrom-Json
if($D.status-ne'READY' -or [int]$D.candidate_count-lt2 -or -not(Test-Path $Key)){throw 'v17 positive unlock fixture failed'}
$Expected=(Get-Content -LiteralPath (Join-Path $Fix 'EXPECTED-EKPFS-SHA256.txt') -Raw).Trim();$Actual=(Get-FileHash -LiteralPath $Key -Algorithm SHA256).Hash.ToLowerInvariant();if($Expected-ne$Actual){throw 'v17 positive key mismatch'}
Write-Host 'V170_PC_ONLY_UNLOCK_POSITIVE_OK'

$Neg=Join-Path $Build 'negative';Copy-Item -Recurse -Force $Fix $Neg
$Sc=Join-Path $Neg 'app_sc.pkg'
$Py=@'
from pathlib import Path
p=Path(r"__SC__")
b=bytearray(p.read_bytes())
cid=b"EP0000-PPSA00001_00-V17FIXTURE000000"
assert len(cid)==36
b[0x40:0x40+36]=cid
p.write_bytes(b)
'@
$Py.Replace('__SC__',$Sc.Replace('\','\\')) | python -
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
$NRep=Join-Path $Build 'negative.json';$NTxt=Join-Path $Build 'negative.txt';$NKey=Join-Path $Build 'private-neg\dakar_ekpfs.bin'
$prev=$ErrorActionPreference;$ErrorActionPreference='Continue';try{& python -B (Join-Path $PSScriptRoot 'dakar-pc-only-unlock-v17.0.py') --root $Root --input $Neg --out $NRep --text-out $NTxt --private-key-out $NKey;$rc=$LASTEXITCODE}finally{$ErrorActionPreference=$prev}
if($rc-ne30){throw ('v17 negative fixture expected exit 30, got '+$rc)}
$ND=Get-Content -LiteralPath $NRep -Raw|ConvertFrom-Json
if($ND.status-ne'RETAIL_UNWRAP_REQUIRED' -or $ND.blocker-ne'NO_PUBLIC_DETERMINISTIC_EKPFS_VALIDATED' -or (Test-Path $NKey)){throw 'v17 negative boundary fixture failed'}
Write-Host 'V170_PC_ONLY_UNLOCK_NEGATIVE_BOUNDARY_OK'
Write-Host 'V170_PC_ONLY_UNLOCK_SELFTEST_OK'
exit 0
