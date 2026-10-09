# HIIEKO OpenCode launcher
$ErrorActionPreference = "Stop"

$Project = "C:\Users\Lenovo\Desktop\hiieko-System-main"
$LogDir  = Join-Path $HOME ".local\share\opencode\log"

if (-not (Test-Path -LiteralPath $Project)) {
    Write-Host "HIIEKO project not found: $Project" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# UTF-8 console so Romanian/OpenCode characters are not mangled.
try {
    [Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}
$env:PYTHONIOENCODING = "utf-8"
try { chcp 65001 | Out-Null } catch {}

Set-Location -LiteralPath $Project

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " HIIEKO OpenCode Agent" -ForegroundColor Cyan
Write-Host " Project : $Project" -ForegroundColor Gray
Write-Host " Agent   : build" -ForegroundColor Gray
Write-Host " Auto    : enabled" -ForegroundColor Yellow
Write-Host " Logs    : $LogDir" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OpenCode is starting. Paste the audit/implementation prompt." -ForegroundColor Green
Write-Host "Inside OpenCode, use /details to show tool execution details." -ForegroundColor Green
Write-Host "Avoid git push/rebase/reset unless you explicitly want those actions." -ForegroundColor Yellow
Write-Host ""

$args = @("--agent", "build", "--auto", "--log-level", "INFO", "--print-logs")
if ($env:OPENCODE_MODEL) {
    $args += @("--model", $env:OPENCODE_MODEL)
    Write-Host "Model   : $env:OPENCODE_MODEL" -ForegroundColor Gray
} else {
    Write-Host "Model   : OpenCode configured/default model" -ForegroundColor Gray
}

& opencode @args
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "OpenCode exited with code $exitCode" -ForegroundColor Yellow
Write-Host "Persistent logs: $LogDir" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close"
exit $exitCode
