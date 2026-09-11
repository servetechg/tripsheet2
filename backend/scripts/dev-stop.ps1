# Stop TripSheet dev listeners (gateway, services, Vite).
# Safe to run before npm run start:dev when you see EADDRINUSE on 3000-3008.
$ErrorActionPreference = 'SilentlyContinue'
$ports = 3000..3008 + 5173
$pids = @()

foreach ($p in $ports) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { $pids += $_.OwningProcess }
}

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'tripsheet' -and $_.CommandLine -match 'concurrently|nest.js|vite' } |
  ForEach-Object { $pids += $_.ProcessId }

$pids = $pids | Sort-Object -Unique
if (-not $pids.Count) {
  Write-Host 'No TripSheet dev processes found.'
  exit 0
}

foreach ($id in $pids) {
  try {
    Stop-Process -Id $id -Force -ErrorAction Stop
    Write-Host "stopped pid $id"
  } catch {
    Write-Host "skip pid $id"
  }
}

Write-Host 'Dev ports cleared.'
