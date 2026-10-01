$ErrorActionPreference='Stop'
python ci\ps5native-v20.0\contract.py
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
Write-Host 'V200_WINDOWS_POWERSHELL51_RUNNER_OK'
