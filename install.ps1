# GSDR Installer for Windows
# Usage: irm https://raw.githubusercontent.com/leonaffi-byte/gsdr/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Write-Info($msg)  { Write-Host ">>> " -ForegroundColor Cyan -NoNewline; Write-Host $msg }
function Write-Ok($msg)    { Write-Host ">>> " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Fail($msg)  { Write-Host ">>> " -ForegroundColor Red -NoNewline; Write-Host "Well that didn't work."; Write-Host ">>> " -ForegroundColor Red -NoNewline; Write-Host $msg; exit 1 }

Write-Host ""
Write-Host "  ▄▄ ▄▄▄ ▄▄▄ ▄▄▄" -ForegroundColor White
Write-Host "  █▌ ▀▄▄ █▄▀ █▄▀" -ForegroundColor White
Write-Host "  ▀▀ ▄▄▀ ▀ ▀ ▀ ▀" -ForegroundColor White
Write-Host "  Get shit done. Autonomously." -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Fail "Node.js is required but not installed.`nInstall it from https://nodejs.org (v18+) and try again."
}

$nodeVersion = (node -v) -replace 'v', ''
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 18) {
    Write-Fail "Node.js 18+ required. Found: v$nodeVersion`nUpdate from https://nodejs.org"
}

Write-Ok "Node.js v$nodeVersion detected"

# Check npm
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Fail "npm is required but not found. It should come with Node.js."
}

# Install globally
Write-Info "Installing GSDR... (patience, grasshopper)"
npm install -g @leonaffi/gsdr
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }

# Run installer to set up Claude Code plugin
Write-Info "Wiring into Claude Code..."
gsdr
if ($LASTEXITCODE -ne 0) { Write-Fail "Plugin setup failed" }

Write-Host ""
Write-Ok "GSDR is locked and loaded."
Write-Host ""
Write-Host "  Next up:" -ForegroundColor White
Write-Host "  Start Claude Code and run:"
Write-Host ""
Write-Host "    /gsdr:new-project" -ForegroundColor Cyan
Write-Host ""
