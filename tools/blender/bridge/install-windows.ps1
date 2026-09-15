param(
  [switch]$SkipBlenderInstall,
  [switch]$NoStartupTask
)
$ErrorActionPreference = "Stop"

function Have($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host "WISDO Blender Bridge bootstrap" -ForegroundColor Cyan

if (-not $SkipBlenderInstall) {
  if (-not (Have "blender")) {
    if (-not (Have "winget")) { throw "winget is required for automatic Blender installation. Install App Installer from Microsoft Store, then rerun." }
    winget install --id BlenderFoundation.Blender -e --accept-package-agreements --accept-source-agreements
  }
}
if (-not (Have "git")) {
  if (-not (Have "winget")) { throw "Git is missing and winget is unavailable." }
  winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
}
if (-not (Have "node")) {
  if (-not (Have "winget")) { throw "Node.js is missing and winget is unavailable." }
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
}
if (-not (Have "gh")) {
  if (Have "winget") { winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements }
}

node tools/blender/detect_blender.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host "Blender may have installed after this shell started. Close this terminal, reopen PowerShell, and rerun this bootstrap." -ForegroundColor Yellow
  exit 2
}

$token = $env:WISDO_BLENDER_GITHUB_TOKEN
if (-not $token -and (Have "gh")) {
  try { $token = (gh auth token 2>$null).Trim() } catch {}
}
if (-not $token) {
  if (-not (Have "gh")) { throw "GitHub CLI is required for one-time bridge authentication." }
  Write-Host "One-time GitHub browser authorization is required so the local Blender agent can create result branches and PRs." -ForegroundColor Yellow
  gh auth login --web --git-protocol https
  if ($LASTEXITCODE -ne 0) { throw "GitHub authentication failed." }
  $token = (gh auth token).Trim()
}
[Environment]::SetEnvironmentVariable("WISDO_BLENDER_GITHUB_TOKEN",$token,"User")
$env:WISDO_BLENDER_GITHUB_TOKEN=$token

node tools/blender/bridge/agent.mjs --once
if ($LASTEXITCODE -ne 0) { throw "Bridge self-check failed." }

if (-not $NoStartupTask) {
  $node=(Get-Command node).Source
  $repo=(Get-Location).Path
  $arg="/c cd /d `"$repo`" && `"$node`" tools\blender\bridge\agent.mjs"
  schtasks /Create /TN "WISDO Blender Bridge" /SC ONLOGON /RL LIMITED /TR "cmd.exe $arg" /F | Out-Null
  Write-Host "Installed startup task: WISDO Blender Bridge" -ForegroundColor Green
}
Write-Host "WISDO Blender Bridge is ready. Blender work can now be queued from GitHub issues." -ForegroundColor Green
