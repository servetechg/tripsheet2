# Copy .env.example → .env for every Nest app (skips if .env already exists)
$targets = @(
  'gateway',
  'services\auth-service',
  'services\company-service',
  'services\driver-service',
  'services\fleet-service',
  'services\manifest-service',
  'services\tripsheet-service'
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($rel in $targets) {
  $dir = Join-Path $root $rel
  $src = Join-Path $dir '.env.example'
  $dst = Join-Path $dir '.env'
  if (-not (Test-Path $src)) {
    Write-Warning "Missing $src"
    continue
  }
  if (Test-Path $dst) {
    Write-Host "skip  $rel\.env (already exists)"
  } else {
    Copy-Item $src $dst
    Write-Host "ok    $rel\.env"
  }
}
