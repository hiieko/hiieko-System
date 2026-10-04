$ErrorActionPreference = "Continue"
$StateFile = Join-Path (Join-Path $env:LOCALAPPDATA "HIIEKO") "dev-pids.json"

if (-not (Test-Path $StateFile)) {
    Write-Host "No HIIEKO launcher state found."
    exit 0
}

$state = Get-Content -Raw $StateFile | ConvertFrom-Json
$targets = @(
    @{Pid=[int]$state.backendPid; Marker="npm run backend:dev"; Label="Backend terminal"},
    @{Pid=[int]$state.webPid; Marker="npm run web:dev"; Label="Web terminal"}
)

foreach ($t in $targets) {
    if (-not $t.Pid) { continue }
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($t.Pid)" -ErrorAction SilentlyContinue
    if (-not $p) {
        Write-Host "$($t.Label): already stopped."
        continue
    }
    if ($p.Name -eq "powershell.exe" -and [string]$p.CommandLine -like "*$($t.Marker)*") {
        Write-Host "Stopping $($t.Label)..."
        & taskkill.exe /PID $t.Pid /T /F | Out-Null
    } else {
        Write-Warning "PID $($t.Pid) does not match the expected HIIEKO terminal; not terminated."
    }
}

Remove-Item -Force -ErrorAction SilentlyContinue $StateFile
Write-Host "HIIEKO dev launcher state cleared." -ForegroundColor Green
