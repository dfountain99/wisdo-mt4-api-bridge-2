param(
  [Parameter(Mandatory=$true)][string]$Image,
  [Parameter(Mandatory=$true)][string]$Id,
  [ValidateSet('character','prop','building','vehicle','vegetation')][string]$Type='prop',
  [string]$Target='',
  [double]$Height=0,
  [string]$Endpoint=''
)
$ErrorActionPreference='Stop'
$argsList=@('tools/image3d/wisdo-image3d.mjs','--image',$Image,'--id',$Id,'--type',$Type)
if($Target){$argsList+=@('--target',$Target)}
if($Height -gt 0){$argsList+=@('--height',"$Height")}
if($Endpoint){$argsList+=@('--endpoint',$Endpoint)}
Write-Host "WISDO Image3D Factory -> $Id" -ForegroundColor Cyan
& node @argsList
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
Write-Host 'Generation complete. Inspect the GLB/report and git diff before commit/deploy.' -ForegroundColor Green
