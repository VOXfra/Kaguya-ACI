$ErrorActionPreference='Stop'
$probe=Join-Path $env:RUNNER_TEMP 'v202-probe.py'
@'
import sys
assert sys.argv[1:] == ["--root","hello world","--out","x"]
print("V202_ARGV_OK")
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
$Py=Get-Command python.exe -ErrorAction SilentlyContinue
if($null-eq$Py){$Py=Get-Command python -ErrorAction Stop}
[string[]]$Forward=@('--root','hello world','--out','x')
& $Py.Source -u -B $probe @Forward 2>&1 | ForEach-Object { Write-Host $_ }
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
python ci\ps5native-v20.2\contract.py
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
Write-Host 'V202_POWERSHELL_PYTHON_OK'
