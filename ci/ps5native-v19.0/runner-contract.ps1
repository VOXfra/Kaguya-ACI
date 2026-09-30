$ErrorActionPreference='Stop'
$Stages=@(
'01-carried-ekpfs-evidence',
'02-real-wrapped-key-profile',
'03-entitlement-rif-census',
'04-dual-schedule-crypto-selftest',
'05-real-dual-schedule-ekpfs-gate',
'06-ekpfs-boundary-conclusion',
'07-package-cleanliness-final'
)
if($Stages.Count -ne 7){throw 'stage count mismatch'}
if($Stages[4] -ne '05-real-dual-schedule-ekpfs-gate'){throw 'gate stage drift'}
Write-Host 'V190_WINDOWS_POWERSHELL51_RUNNER_CONTRACT_OK'
