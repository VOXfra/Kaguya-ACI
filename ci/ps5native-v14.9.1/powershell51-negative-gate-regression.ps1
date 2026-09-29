param(
  [Parameter(Mandatory=$true)][string]$Tool
)
$ErrorActionPreference='Stop'
$Work=Join-Path $env:RUNNER_TEMP 'v1491-ps51'
if(Test-Path $Work){Remove-Item -Recurse -Force $Work}
New-Item -ItemType Directory -Force -Path $Work|Out-Null
$Artifacts=Join-Path $Work 'artifacts'
New-Item -ItemType Directory -Force -Path $Artifacts|Out-Null
$Artifact=Join-Path $Artifacts 'artifact.bin'
[IO.File]::WriteAllBytes($Artifact,[Text.Encoding]::ASCII.GetBytes('v14.9.1-ps51-regression'))
$Hash=(Get-FileHash -LiteralPath $Artifact -Algorithm SHA256).Hash.ToLowerInvariant()
$Size=(Get-Item -LiteralPath $Artifact).Length
$Base=[ordered]@{
  schema='ps5native.dakar-retail-handoff.v14.9'
  status='READY'
  source_kind='integration_fixture'
  security=[ordered]@{
    ekpfs_supplied=$false
    ekpfs_validated=$false
    network_access=$false
    key_search_performed=$false
    bruteforce_performed=$false
  }
  artifact=[ordered]@{
    relative_path='artifact.bin'
    size=$Size
    sha256=$Hash
    module_parse_ok=$true
    container_kind='REGRESSION'
    structured_import_count=0
    relocation_count=0
  }
  runtime_gate=[ordered]@{
    startup_authorized=$false
    required_modes=@('inspect-only','entry-preflight')
  }
  pending_reason=$null
}
$BasePath=Join-Path $Work 'base.json'
$Base|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $BasePath -Encoding UTF8

function Write-Variant([string]$Name,[scriptblock]$Mutate){
  $Obj=Get-Content -LiteralPath $BasePath -Raw|ConvertFrom-Json
  & $Mutate $Obj
  $Path=Join-Path $Work ($Name+'.json')
  $Obj|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $Path -Encoding UTF8
  return $Path
}
function Expect-Reject([string]$Name,[string]$Path,[int]$Expected,[string]$Needle){
  $prev=$ErrorActionPreference
  try{
    $ErrorActionPreference='Continue'
    $o=& python -B $Tool run --manifest $Path --artifact-root $Artifacts --validate-only --allow-integration-fixture 2>&1
    $r=$LASTEXITCODE
  }finally{
    $ErrorActionPreference=$prev
  }
  $lines=@($o|ForEach-Object{$_.ToString()})
  $text=[string]::Join([Environment]::NewLine,$lines)
  $lines|ForEach-Object{Write-Host "[$Name] $_"}
  if($ErrorActionPreference-ne'Stop'){throw "$Name failed to restore ErrorActionPreference"}
  if($r-ne$Expected){throw "$Name expected exit $Expected got $r"}
  if($text-notlike("*$Needle*")){throw "$Name missing rejection marker: $Needle"}
}

$Pending=Write-Variant 'negative-pending' {param($o) $o.status='PENDING'; $o.pending_reason='WAITING_FOR_VALIDATED_EKPFS'}
Expect-Reject 'pending' $Pending 20 'handoff is not READY'
$BadHash=Write-Variant 'negative-hash' {param($o) $o.artifact.sha256=('0'*64)}
Expect-Reject 'hash' $BadHash 24 'SHA-256 mismatch'
$Traversal=Write-Variant 'negative-traversal' {param($o) $o.artifact.relative_path='../artifact.bin'}
Expect-Reject 'traversal' $Traversal 23 'safe relative path'
$Retail=Write-Variant 'negative-retail-unvalidated' {param($o) $o.source_kind='retail_post_ekpfs'; $o.security.ekpfs_validated=$false}
Expect-Reject 'retail-unvalidated' $Retail 22 'requires independently validated EKPFS'
Write-Host 'Windows PowerShell 5.1 expected-native-stderr capture: PASS'
Write-Host 'V1491_POWERSHELL51_NEGATIVE_GATES_OK'
exit 0
