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
  $taskName = "WISDO Blender Bridge"
  $node = (Get-Command node).Source
  $repo = (Resolve-Path (Get-Location)).Path

  try {
    if (-not (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)) {
      throw "Windows ScheduledTasks PowerShell module is unavailable."
    }

    # Avoid schtasks.exe nested-quote parsing bugs when Node lives under
    # a path such as C:\Program Files\nodejs\node.exe. ScheduledTasks keeps
    # executable, arguments, and working directory as separate fields.
    $action = New-ScheduledTaskAction `
      -Execute $node `
      -Argument "tools\blender\bridge\agent.mjs" `
      -WorkingDirectory $repo
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal `
      -UserId "$env:USERDOMAIN\$env:USERNAME" `
      -LogonType Interactive `
      -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -ExecutionTimeLimit (New-TimeSpan -Days 3650)

    Register-ScheduledTask `
      -TaskName $taskName `
      -Action $action `
      -Trigger $trigger `
      -Principal $principal `
      -Settings $settings `
      -Description "Runs the trusted WISDO Blender Bridge agent at user logon." `
      -Force | Out-Null

    $installed = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    if (-not $installed) { throw "Scheduled task verification failed." }

    Write-Host "Installed startup task: $taskName" -ForegroundColor Green
  } catch {
    Write-Host "Startup task installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "The bridge itself passed its self-check. You can run it manually with:" -ForegroundColor Yellow
    Write-Host "  node tools/blender/bridge/agent.mjs" -ForegroundColor Yellow
    Write-Host "Or rerun this bootstrap with -NoStartupTask to skip auto-start registration." -ForegroundColor Yellow
    throw
  }
}
Write-Host "WISDO Blender Bridge is ready. Blender work can now be queued from GitHub issues." -ForegroundColor Green
