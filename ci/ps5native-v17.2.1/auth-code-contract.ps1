param(
  [Parameter(Mandatory=$true)][AllowEmptyString()][string]$InputValue
)
$ErrorActionPreference='Stop'
$code=$null
$t=$InputValue.Trim()
if($t.StartsWith('{')){
  $obj=$t|ConvertFrom-Json
  $code=[string]$obj.authorizationCode
}else{
  $m=[regex]::Match($t,'(?:authorizationCode["''=:\s]+|[?&]code=)(?<c>[A-Za-z0-9._~-]{8,512})',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if($m.Success){$code=$m.Groups['c'].Value}else{$code=$t.Trim('"').Trim("'")}
}
if([string]::IsNullOrWhiteSpace($code) -or $code.Length-lt8 -or $code.Length-gt512){exit 31}
Write-Output ('PARSED_LENGTH='+$code.Length)
$code=$null
exit 0
