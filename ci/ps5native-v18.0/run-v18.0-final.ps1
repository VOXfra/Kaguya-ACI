$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Build=Join-Path $Root 'build';New-Item -ItemType Directory -Force -Path $Build|Out-Null
$stages=@('01-build-windows','02-canonical-reconciliation','03-big-pass-core','04-real-dakar-frontier','05-package-cleanliness-final')
Write-Host ($stages -join ',')
