param(
  [string]$BaseUrl = "https://wisdo-mt4-api-bridge.onrender.com",
  [string]$OutputCsv = "$env:USERPROFILE\Downloads\wisdo-safe-link-test-results.csv",
  [int]$TimeoutSeconds = 30,
  [int]$MaxUrls = 75,
  [int]$DelayMs = 350,
  [switch]$CrawlDiscoveredLinks
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BaseUrl = $BaseUrl.TrimEnd('/')
$baseUri = [Uri]$BaseUrl

$seedPaths = @(
  '/', '/health', '/health/mt4', '/health/performance', '/health/discord',
  '/features', '/pricing', '/copier', '/academy', '/education', '/webinar', '/affiliate',
  '/about', '/faq', '/contact', '/support', '/login', '/signup', '/terms', '/privacy', '/risk-disclosure',
  '/robots.txt', '/sitemap.xml', '/service-worker.js',
  '/app', '/app/dashboard', '/app/accounts', '/app/connect-account', '/app/advanced-link',
  '/app/community-reporters', '/app/discord-copier', '/app/copier-engine', '/app/copier-logs',
  '/app/account-trades', '/app/performance', '/app/account-configuration', '/app/wisdo-command-center',
  '/app/reporter', '/app/notifications', '/app/subscriptions', '/app/profile', '/app/education',
  '/app/seminars', '/app/lane-audit', '/app/lane-intelligence', '/app/compound-tracker', '/app/trades',
  '/app/analyzer', '/app/alerts', '/app/affiliate', '/app/settings', '/app/nexus', '/app/missions',
  '/app/workspaces', '/app/timeline', '/app/automation', '/app/culture-score', '/app/ai-memory',
  '/app/devices', '/app/ecosystem-map', '/app/presence', '/app/culture-lanes', '/app/symbol-routing',
  '/app/harvest', '/app/daily-briefing',
  '/admin', '/admin/health', '/admin/users', '/admin/subscriptions', '/admin/copier-access',
  '/admin/reporter-settings', '/admin/notifications', '/admin/support-tickets', '/admin/ecosystem'
)

$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('WISDO-Safe-Link-Audit/7.0.3')
$client.DefaultRequestHeaders.Accept.ParseAdd('text/html,application/json;q=0.9,*/*;q=0.8')

$queue = [System.Collections.Generic.Queue[string]]::new()
$known = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$results = [System.Collections.Generic.List[object]]::new()
$pressureStopped = $false

function Add-InternalUrl([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return }
  if ($value.StartsWith('#') -or $value.StartsWith('mailto:') -or $value.StartsWith('tel:') -or $value.StartsWith('javascript:') -or $value.StartsWith('data:')) { return }
  try {
    $uri = if ([Uri]::IsWellFormedUriString($value, [UriKind]::Absolute)) { [Uri]$value } else { [Uri]::new($baseUri, $value) }
    if ($uri.Scheme -notin @('http','https') -or $uri.Host -ne $baseUri.Host) { return }
    $normalized = $uri.GetLeftPart([UriPartial]::Path)
    if ($uri.Query) { $normalized += $uri.Query }
    if ($known.Add($normalized)) { $queue.Enqueue($normalized) }
  } catch { }
}

foreach ($path in $seedPaths) { Add-InternalUrl $path }

Write-Host ""
Write-Host "WISDO v7.0.3 SAFE LIVE LINK AUDIT" -ForegroundColor Cyan
Write-Host "Base: $BaseUrl"
Write-Host "Maximum URLs: $MaxUrls | Delay: ${DelayMs}ms | Crawl discovered: $CrawlDiscoveredLinks"
Write-Host "The audit stops immediately if WISDO reports memory-pressure shedding."
Write-Host ""

while ($queue.Count -gt 0 -and $results.Count -lt $MaxUrls) {
  $url = $queue.Dequeue()
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $status = 0; $location = ''; $contentType = ''; $body = ''; $errorText = ''

  try {
    $response = $client.GetAsync($url).GetAwaiter().GetResult()
    $sw.Stop()
    $status = [int]$response.StatusCode
    if ($response.Headers.Location) { $location = $response.Headers.Location.ToString() }
    if ($response.Content.Headers.ContentType) { $contentType = $response.Content.Headers.ContentType.MediaType }
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if ($status -eq 503 -and $body -match 'WISDO_MEMORY_PRESSURE_SHED') {
      $pressureStopped = $true
    }

    if ($CrawlDiscoveredLinks -and $status -eq 200 -and $contentType -like 'text/html*') {
      $pattern = '(?i)(?:href|src|action)\s*=\s*["'']([^"'']+)["'']'
      foreach ($match in [regex]::Matches($body, $pattern)) { Add-InternalUrl $match.Groups[1].Value }
    }
  } catch {
    $sw.Stop()
    $errorText = $_.Exception.GetBaseException().Message
  }

  $classification = if ($pressureStopped) {
    'STOP-PRESSURE'
  } elseif ($errorText) {
    'FAIL-NETWORK'
  } elseif ($status -ge 200 -and $status -lt 400) {
    'PASS'
  } elseif ($status -in @(401,403)) {
    'PASS-GUARDED'
  } elseif ($status -in @(429,502,503,504)) {
    'WARN-SERVICE'
  } else {
    'FAIL'
  }

  $pathShown = ([Uri]$url).PathAndQuery
  $speed = if ($sw.ElapsedMilliseconds -gt 2500) { 'SLOW' } else { 'OK' }
  $statusShown = if ($status) { $status } else { 'ERR' }
  $color = if ($classification -like 'FAIL*' -or $classification -eq 'STOP-PRESSURE') { 'Red' } elseif ($speed -eq 'SLOW' -or $classification -like 'WARN*') { 'Yellow' } elseif ($classification -eq 'PASS-GUARDED') { 'DarkCyan' } else { 'Green' }
  Write-Host ("{0,-14} {1,-4} {2,6}ms {3}" -f $classification,$statusShown,$sw.ElapsedMilliseconds,$pathShown) -ForegroundColor $color

  $results.Add([pscustomobject]@{
    Classification = $classification; Status = $statusShown; Speed = $speed
    ResponseMs = $sw.ElapsedMilliseconds; Path = $pathShown; Url = $url
    Redirect = $location; ContentType = $contentType; Error = $errorText
  })

  if ($pressureStopped) {
    Write-Host "Server reported memory pressure. Audit stopped before additional load was sent." -ForegroundColor Red
    break
  }
  Start-Sleep -Milliseconds ([Math]::Max(100, $DelayMs))
}

$results | Sort-Object Path | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $OutputCsv
$failed = @($results | Where-Object { $_.Classification -like 'FAIL*' })
$slow = @($results | Where-Object { $_.Speed -eq 'SLOW' })
Write-Host ""
Write-Host "Tested: $($results.Count) | Failures: $($failed.Count) | Slow: $($slow.Count) | Pressure stop: $pressureStopped" -ForegroundColor Cyan
Write-Host "CSV: $OutputCsv"

$client.Dispose(); $handler.Dispose()
if ($pressureStopped) { exit 3 }
if ($failed.Count) { exit 2 }
exit 0
