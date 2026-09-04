param(
    [double]$Scale = 1.65
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$GtaRoot = (Resolve-Path -LiteralPath (Join-Path $ToolDir '..\..\..')).Path
$Exe = Join-Path $GtaRoot 'GTA5_Enhanced.exe'
$RageOpenV = Join-Path $GtaRoot 'RageOpenV.asi'
$ProbeScript = Join-Path $ToolDir 'vox_visual_probe.py'
$Venv = Join-Path (Split-Path -Parent $ToolDir) '.venv-assets'
$VenvPython = Join-Path $Venv 'Scripts\python.exe'
$LogDir = Join-Path $GtaRoot 'VOXModernOverhaul\visual_probe'
$SetupLog = Join-Path $LogDir 'visual_probe_setup.log'

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-Step([string]$Message) {
    $line = "[$((Get-Date).ToString('s'))] $Message"
    Write-Host $line
    Add-Content -LiteralPath $SetupLog -Value $line -Encoding UTF8
}

function Resolve-PythonLauncher {
    $candidates = @(
        @{ File = 'py.exe'; Prefix = @('-3.11') },
        @{ File = 'py.exe'; Prefix = @('-3') },
        @{ File = 'python.exe'; Prefix = @() }
    )

    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate.File -ErrorAction SilentlyContinue
        if ($null -eq $command) { continue }
        try {
            $args = @($candidate.Prefix) + @('-c', 'import sys; print(sys.version_info.major * 100 + sys.version_info.minor)')
            $versionCodeText = (& $command.Source @args 2>$null | Select-Object -Last 1).Trim()
            $versionCode = 0
            if ([int]::TryParse($versionCodeText, [ref]$versionCode) -and $versionCode -ge 311) {
                return @{ File = $command.Source; Prefix = @($candidate.Prefix) }
            }
        } catch {
            continue
        }
    }
    return $null
}

Write-Step 'VOX dev.15 visual asset pipeline setup started.'
Write-Step "GTA root: $GtaRoot"

if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) {
    throw "GTA5_Enhanced.exe was not found in '$GtaRoot'. Keep the VOXModernOverhaul folder directly inside the GTA V Enhanced root."
}
if (-not (Test-Path -LiteralPath $RageOpenV -PathType Leaf)) {
    throw 'RageOpenV.asi is required and was not found. This checkpoint will not modify GTA archives directly.'
}
if (-not (Test-Path -LiteralPath $ProbeScript -PathType Leaf)) {
    throw "Missing visual probe script: $ProbeScript"
}
if ($Scale -le 1.0 -or $Scale -gt 3.0) {
    throw 'Scale must be > 1.0 and <= 3.0.'
}

if (-not (Test-Path -LiteralPath $VenvPython -PathType Leaf)) {
    $launcher = Resolve-PythonLauncher
    if ($null -eq $launcher) {
        throw 'Python 3.11 or newer was not found. Install Python 3.11+ with the Windows Python launcher, then run this file again.'
    }
    Write-Step "Creating isolated Python environment at $Venv"
    & $launcher.File @($launcher.Prefix) -m venv $Venv
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $VenvPython -PathType Leaf)) {
        throw "Python venv creation failed with exit code $LASTEXITCODE."
    }
}

$venvVersion = (& $VenvPython -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")').Trim()
Write-Step "Asset Python: $venvVersion"

Write-Step 'Installing pinned FiveFury 0.4.21 inside the isolated VOX environment.'
& $VenvPython -m pip install --disable-pip-version-check --no-input 'fivefury==0.4.21'
if ($LASTEXITCODE -ne 0) {
    throw "FiveFury installation failed with exit code $LASTEXITCODE."
}

Write-Step 'Running FiveFury/Gen9 transformer self-test.'
& $VenvPython $ProbeScript self-test
if ($LASTEXITCODE -ne 0) {
    throw "Visual probe self-test failed with exit code $LASTEXITCODE. Nothing was installed into newmods."
}

Write-Step 'Scanning the local Enhanced installation and building one reversible oversized-asset proof.'
& $VenvPython $ProbeScript install --gta-root $GtaRoot --scale $Scale
if ($LASTEXITCODE -ne 0) {
    throw "Visual probe installation failed with exit code $LASTEXITCODE. See VOXModernOverhaul\visual_probe\visual_probe_report.txt and visual_probe_setup.log."
}

$Report = Join-Path $LogDir 'visual_probe_report.txt'
Write-Step 'Visual probe installed successfully.'
Write-Host ''
Write-Host '============================================================'
Write-Host ' VOX DEV.15 VISUAL PROBE INSTALLED'
Write-Host '============================================================'
Write-Host "Report: $Report"
Write-Host 'Launch GTA V Enhanced and enter Story Mode.'
Write-Host 'The selected common prop should now look obviously oversized.'
Write-Host 'This ugly scale change is deliberate: it proves the Gen9 asset pipeline.'
Write-Host 'Run 03_ROLLBACK_VISUAL_PROBE.cmd to remove only the generated override.'
