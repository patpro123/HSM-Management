# server-restart.ps1 — Kill and restart HSM backend (:3000) and frontend (:5173) on Windows

$ErrorActionPreference = 'Stop'

$ProjectDir  = $PSScriptRoot
$BackendLog  = Join-Path $env:TEMP 'hsm-backend.log'
$FrontendLog = Join-Path $env:TEMP 'hsm-frontend.log'

$BackendEntry = Join-Path $ProjectDir 'backend-enroll\index.js'
$FrontendDir  = Join-Path $ProjectDir 'frontend-enroll'

function Get-StalePids {
  # Match by command line: netstat doesn't always list listeners started from another session
  $byCmd = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -and ($_.CommandLine.Contains($BackendEntry) -or $_.CommandLine.Contains($FrontendDir)) } |
    ForEach-Object { $_.ProcessId }
  $byPort = Get-NetTCPConnection -LocalPort 3000, 5173 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { $_.OwningProcess }
  @($byCmd) + @($byPort) | Where-Object { $_ -gt 0 } | Sort-Object -Unique
}

function Test-Url($url) {
  # 127.0.0.1, not localhost: localhost tries IPv6 first and stalls against IPv4-only listeners
  try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2).StatusCode -lt 500 } catch { $false }
}

# ── 1. Kill existing processes ────────────────────────────────────────────────
Write-Host "Stopping existing HSM servers..."
foreach ($procId in Get-StalePids) {
  # /T kills the process tree
  taskkill /F /T /PID $procId 2>$null | Out-Null
}
if (Test-Url 'http://127.0.0.1:3000/api/auth/config') {
  # Backend started with a relative path (e.g. `node index.js`) by hand — can't identify it by command line
  Write-Host "Port 3000 is still in use by an unknown process. Stop it manually, then re-run."
  exit 1
}
Write-Host "Stopped."

# ── 2. Start backend ──────────────────────────────────────────────────────────
Write-Host "Starting backend..."
# Absolute entry path so the next run can find this process by command line
$backend = Start-Process node -ArgumentList "`"$BackendEntry`"" `
  -WorkingDirectory (Join-Path $ProjectDir 'backend-enroll') `
  -RedirectStandardOutput $BackendLog -RedirectStandardError "$BackendLog.err" `
  -WindowStyle Hidden -PassThru

# ── 3. Start frontend ─────────────────────────────────────────────────────────
Write-Host "Starting frontend..."
$frontend = Start-Process cmd -ArgumentList '/c', 'npm run dev -- --host' `
  -WorkingDirectory $FrontendDir `
  -RedirectStandardOutput $FrontendLog -RedirectStandardError "$FrontendLog.err" `
  -WindowStyle Hidden -PassThru

# ── 4. Wait for both to respond ───────────────────────────────────────────────
$backendUp = $false; $frontendUp = $false
for ($i = 0; $i -lt 40 -and -not ($backendUp -and $frontendUp); $i++) {
  Start-Sleep -Milliseconds 500
  if (-not $backendUp)  { $backendUp  = Test-Url 'http://127.0.0.1:3000/api/auth/config' }
  if (-not $frontendUp) { $frontendUp = Test-Url 'http://127.0.0.1:5173/' }
}

# ── 5. Report ─────────────────────────────────────────────────────────────────
$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1).IPAddress
if (-not $LocalIp) { $LocalIp = 'unknown' }

$status = { param($up) if ($up) { 'UP  ' } else { 'DOWN' } }
Write-Host ""
Write-Host "Servers:"
Write-Host "  Backend  $(& $status $backendUp) PID $($backend.Id)  -> http://localhost:3000"
Write-Host "  Frontend $(& $status $frontendUp) PID $($frontend.Id)  -> http://localhost:5173"
Write-Host "  Mobile access                -> http://${LocalIp}:5173"
Write-Host ""
Write-Host "Logs: $BackendLog  |  $FrontendLog  (stderr in *.err)"

if (-not ($backendUp -and $frontendUp)) {
  Write-Host ""
  Write-Host "One or more servers failed to start. Recent log output:"
  if (-not $backendUp)  { Get-Content $BackendLog, "$BackendLog.err" -Tail 15 -ErrorAction SilentlyContinue }
  if (-not $frontendUp) { Get-Content $FrontendLog, "$FrontendLog.err" -Tail 15 -ErrorAction SilentlyContinue }
  exit 1
}
