$ErrorActionPreference='Stop'
$work=Join-Path $env:RUNNER_TEMP 'v2001-argv'
New-Item -ItemType Directory -Force -Path $work|Out-Null
$probe=Join-Path $work 'argv_probe.py'
$out=Join-Path $work 'argv.json'
@'
import json, pathlib, sys
if len(sys.argv) != 6:
    raise SystemExit(f"ARGC_MISMATCH:{len(sys.argv)}:{sys.argv!r}")
pathlib.Path(sys.argv[1]).write_text(json.dumps(sys.argv[2:]), encoding="utf-8")
print("V2001_PYTHON_ARGV_PROBE_OK")
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
function Invoke-Probe {
 param([Parameter(Mandatory=$true)][string]$ScriptPath,[Parameter(Mandatory=$true)][string[]]$ScriptArguments)
 if(-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)){throw "missing script"}
 if([IO.Path]::GetExtension($ScriptPath) -ine '.py'){throw "not py"}
 $Py=Get-Command python.exe -ErrorAction SilentlyContinue
 if($null -eq $Py){$Py=Get-Command python -ErrorAction Stop}
 $Resolved=(Resolve-Path -LiteralPath $ScriptPath).Path
 [string[]]$Forward=@($ScriptArguments)
 & $Py.Source -u -B $Resolved @Forward 2>&1 | ForEach-Object { Write-Host $_ }
 $code=$LASTEXITCODE
 return [int]$code
}
$rc=Invoke-Probe -ScriptPath $probe -ScriptArguments @($out,'--alpha','hello world','--beta','42')
if($rc-ne0){throw "probe rc=$rc"}
$j=Get-Content -LiteralPath $out -Raw|ConvertFrom-Json
if(@($j).Count-ne4){throw "count mismatch"}
if([string]$j[0]-ne'--alpha' -or [string]$j[1]-ne'hello world' -or [string]$j[2]-ne'--beta' -or [string]$j[3]-ne'42'){throw "argv mismatch"}
Write-Host 'V2001_POWERSHELL_TO_PYTHON_ARGV_OK'
