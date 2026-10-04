[CmdletBinding()]
param([switch]$OpenFirewall)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$StateRoot = Join-Path $env:LOCALAPPDATA "HIIEKO"
$StateFile = Join-Path $StateRoot "dev-pids.json"
$LinksFile = Join-Path $StateRoot "dev-links.txt"

New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
Set-Location -LiteralPath $RepoRoot

function Get-Version([string]$name) {
    $v = & $name --version 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $v) { throw "$name is not available in PATH." }
    $m = [regex]::Match(($v | Select-Object -First 1), '\d+(\.\d+){1,3}')
    if (-not $m.Success) { throw "Could not parse $name version." }
    return [version]$m.Value
}

Write-Host "HIIEKO LOCAL DEVELOPMENT" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

if (Test-Path $StateFile) {
    try {
        $old = Get-Content -Raw $StateFile | ConvertFrom-Json
        $alive = @($old.backendPid,$old.webPid) | Where-Object { $_ -and (Get-Process -Id ([int]$_) -ErrorAction SilentlyContinue) }
        if ($alive.Count -gt 0) {
            Write-Warning "HIIEKO terminals already appear to be running. Use Stop-HIIEKO.ps1 first."
            exit 1
        }
    } catch {}
    Remove-Item -Force -ErrorAction SilentlyContinue $StateFile
}

$node = Get-Version "node"
$npm  = Get-Version "npm"
if ($node -lt [version]"18.17.0") { throw "Node.js 18.17+ required. Detected $node" }
if ($npm -lt [version]"9.0.0") { throw "npm 9+ required. Detected $npm" }
Write-Host "Node $node | npm $npm" -ForegroundColor Green

foreach ($f in @("backend\.env","web\.env.local")) {
    if (-not (Test-Path (Join-Path $RepoRoot $f))) {
        Write-Warning "Missing $f"
    }
}

if (Test-NetConnection 127.0.0.1 -Port 5434 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    Write-Host "PostgreSQL 5434 reachable" -ForegroundColor Green
} else {
    Write-Warning "PostgreSQL 5434 is not reachable."
}

$lanIps = @(
    Get-NetIPConfiguration -ErrorAction SilentlyContinue |
      Where-Object { $_.NetAdapter.Status -eq "Up" -and $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address } |
      ForEach-Object { $_.IPv4Address.IPAddress } |
      Where-Object { $_ -and $_ -ne "127.0.0.1" -and $_ -notmatch '^169\.254\.' } |
      Select-Object -Unique
)

if ($OpenFirewall) {
    $rule = Get-NetFirewallRule -DisplayName "HIIEKO dev (3000, 4000)" -ErrorAction SilentlyContinue
    if (-not $rule) {
        New-NetFirewallRule -DisplayName "HIIEKO dev (3000, 4000)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,4000 -Profile Private | Out-Null
        Write-Host "Firewall rule created for Private networks." -ForegroundColor Green
    }
}

$backendCommand = 'Write-Host "HIIEKO BACKEND :4000" -ForegroundColor Cyan; npm run backend:dev'
$webCommand     = 'Write-Host "HIIEKO WEB :3000" -ForegroundColor Cyan; npm run web:dev'

$backendProc = Start-Process powershell.exe -WorkingDirectory $RepoRoot -ArgumentList @("-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command",$backendCommand) -PassThru
Start-Sleep -Seconds 1
$webProc = Start-Process powershell.exe -WorkingDirectory $RepoRoot -ArgumentList @("-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command",$webCommand) -PassThru

@{
    startedAt=(Get-Date).ToString("o")
    repoRoot=$RepoRoot
    backendPid=$backendProc.Id
    webPid=$webProc.Id
} | ConvertTo-Json | Set-Content -Encoding UTF8 $StateFile

$backendReady=$false; $webReady=$false
for ($i=0; $i -lt 60; $i++) {
    $backendReady = Test-NetConnection 127.0.0.1 -Port 4000 -InformationLevel Quiet -WarningAction SilentlyContinue
    $webReady = Test-NetConnection 127.0.0.1 -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($backendReady -and $webReady) { break }
    Start-Sleep 1
}

Write-Host ""
Write-Host "HIIEKO DEV URLS" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend : http://localhost:4000"
Write-Host "Swagger : http://localhost:4000/api/docs"

if ($lanIps.Count -gt 0) {
    Write-Host ""
    Write-Host "PHONE / TABLET (same Wi-Fi)" -ForegroundColor Yellow
    foreach ($ip in $lanIps) {
        Write-Host "Frontend: http://${ip}:3000" -ForegroundColor Green
        Write-Host "Swagger : http://${ip}:4000/api/docs" -ForegroundColor Green
        Write-Host "API     : http://${ip}:4000" -ForegroundColor Green
    }
}

@(
    "HIIEKO Local Development URLs"
    ""
    "Frontend: http://localhost:3000"
    "Backend : http://localhost:4000"
    "Swagger : http://localhost:4000/api/docs"
    ""
    "LAN / PHONE / TABLET"
    ($lanIps | ForEach-Object { "Frontend: http://${_}:3000"; "Swagger : http://${_}:4000/api/docs"; "API     : http://${_}:4000"; "" })
) | Set-Content -Encoding UTF8 $LinksFile

Write-Host ""
Write-Host "To stop: .\Stop-HIIEKO.ps1" -ForegroundColor Yellow
Write-Host "Links saved: $LinksFile" -ForegroundColor DarkGray
