$ErrorActionPreference='Stop'
$script:AllPass=$true;$script:HadFail=$false;$script:HadPending=$false;$script:Steps=@()
function Classify([int]$rc){
  $status=if($rc-eq0){'PASS'}elseif($rc-eq30 -or $rc-eq31){'PENDING'}else{'FAIL'}
  if($status-eq'FAIL'){$script:AllPass=$false;$script:HadFail=$true}elseif($status-eq'PENDING'){$script:AllPass=$false;$script:HadPending=$true}
  return $status
}
$null=Classify 0
$null=Classify 30
if($HadFail){exit 1};if($HadPending){exit 30};exit 0
