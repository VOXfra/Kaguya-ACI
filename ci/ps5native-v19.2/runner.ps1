$ErrorActionPreference='Stop'
$Stages=@('01-carried-ekpfs-evidence','02-real-ps5-rsa3072-map','03-real-dual-schedule-ekpfs-gate','04-package-cleanliness-final')
if($Stages.Count-ne4){throw 'stage count mismatch'}
$env:PYTHONUNBUFFERED='1'
Write-Host 'V192_WINDOWS_POWERSHELL51_RUNNER_OK'