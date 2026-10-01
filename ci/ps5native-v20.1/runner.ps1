$ErrorActionPreference='Stop'
$probe=Join-Path $env:RUNNER_TEMP 'v201-probe.py'
@'
import sys
assert sys.argv[1:] == ["--deep","hello world","--paths","x"]
print("V201_ARGV_OK")
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
$Py=Get-Command python.exe -ErrorAction SilentlyContinue
if($null -eq $Py){$Py=Get-Command python -ErrorAction Stop}
[string[]]$Forward=@('--deep','hello world','--paths','x')
& $Py.Source -u -B $probe @Forward 2>&1 | ForEach-Object { Write-Host $_ }
if($LASTEXITCODE-ne0){exit $LASTEXITCODE}
Write-Host 'V201_POWERSHELL_PYTHON_OK'
