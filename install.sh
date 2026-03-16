#!/bin/bash
set -e

# GSDR Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/leonaffi-byte/gsdr/master/install.sh | bash

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}${BOLD}>>>${NC} $1"; }
ok()    { echo -e "${GREEN}${BOLD}>>>${NC} $1"; }
warn()  { echo -e "${YELLOW}${BOLD}>>>${NC} $1"; }
fail()  { echo -e "${RED}${BOLD}>>>${NC} $1"; exit 1; }

echo ""
echo -e "${BOLD}  GSDR — GSD Reloaded${NC}"
echo -e "  Autonomous spec-driven development for Claude Code"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js is required but not installed.
  Install it from https://nodejs.org (v18+) and try again."
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  fail "Node.js 18+ required. Found: $(node -v)
  Update from https://nodejs.org"
fi

ok "Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
  fail "npm is required but not found. It should come with Node.js."
fi

# Install globally
info "Installing gsdr via npm..."
npm install -g gsdr

# Run installer to set up Claude Code plugin
info "Setting up Claude Code plugin..."
gsdr

echo ""
ok "GSDR installed successfully!"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo "  1. Start Claude Code with the plugin:"
echo "     claude --plugin-dir ~/.claude/plugins/local/gsdr"
echo ""
echo "  2. Or add to your Claude Code settings, then run:"
echo "     /gsdr:new-project"
echo ""
