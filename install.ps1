# GSDR Installer for Windows
# Usage: irm https://raw.githubusercontent.com/leonaffi-byte/gsdr/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Write-Info($msg)  { Write-Host ">>> " -ForegroundColor Cyan -NoNewline; Write-Host $msg }
function Write-Ok($msg)    { Write-Host ">>> " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Fail($msg)  { Write-Host ">>> " -ForegroundColor Red -NoNewline; Write-Host $msg; exit 1 }

Write-Host ""
Write-Host "  GSDR - GSD Reloaded" -ForegroundColor White
Write-Host "  Autonomous spec-driven development for Claude Code"
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
Write-Info "Installing gsdr via npm..."
npm install -g gsdr
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }

# Run installer to set up Claude Code plugin
Write-Info "Setting up Claude Code plugin..."
gsdr
if ($LASTEXITCODE -ne 0) { Write-Fail "Plugin setup failed" }

Write-Host ""
Write-Ok "GSDR installed successfully!"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Start Claude Code with the plugin:"
Write-Host "     claude --plugin-dir $env:USERPROFILE\.claude\plugins\local\gsdr"
Write-Host ""
Write-Host "  2. Or add to your Claude Code settings, then run:"
Write-Host "     /gsdr:new-project"
Write-Host ""
