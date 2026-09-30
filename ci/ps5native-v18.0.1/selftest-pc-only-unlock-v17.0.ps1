$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build\v17-unlock-selftest';if(Test-Path $Build){Remove-Item -Recurse -Force $Build};New-Item -ItemType Directory -Force -Path $Build|Out-Null
$Fix=Join-Path $Build 'positive'
$PrivateRoot=Join-Path ([IO.Path]::GetTempPath()) ('ps5native-v17-unlock-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $PrivateRoot|Out-Null
$Rep=Join-Path $Build 'positive.json';$Txt=Join-Path $Build 'positive.txt';$Key=Join-Path $PrivateRoot 'positive\dakar_ekpfs.bin'
$NRep=Join-Path $Build 'negative.json';$NTxt=Join-Path $Build 'negative.txt';$NKey=Join-Path $PrivateRoot 'negative\dakar_ekpfs.bin'
if(Test-Path -LiteralPath $PrivateRoot){Remove-Item -Recurse -Force -LiteralPath $PrivateRoot}
Write-Host 'V170_PC_ONLY_UNLOCK_SYNTHETIC_KEY_CLEANUP_OK'
