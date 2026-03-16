#!/usr/bin/env node

/**
 * GSDR Install Script
 * Installs GSDR into ~/.claude/ so commands are auto-discovered.
 *
 * Usage:
 *   npx @leonaffi/gsdr@latest          # Install
 *   npx @leonaffi/gsdr@latest --help   # Show usage
 *   npx @leonaffi/gsdr@latest --uninstall  # Remove
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_NAME = 'gsdr';
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PLUGIN_DIR = path.join(CLAUDE_DIR, 'plugins', 'local', PLUGIN_NAME);
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands', PLUGIN_NAME);
const SOURCE_DIR = path.join(__dirname, '..');

// Directories copied to ~/.claude/plugins/local/gsdr/
const PLUGIN_DIRS = [
  'skills',
  'agents',
  'hooks',
  'templates',
  'references',
  'dist',
];

function printHelp() {
  console.log(`
GSDR - GSD Reloaded: Autonomous spec-driven development for Claude Code

Usage:
  npx @leonaffi/gsdr@latest            Install GSDR
  npx @leonaffi/gsdr@latest --help     Show this help message
  npx @leonaffi/gsdr@latest --uninstall  Remove GSDR

Installs to:
  ${PLUGIN_DIR}     (skills, agents, templates)
  ${COMMANDS_DIR}   (slash commands)

After installation, just start Claude Code and run:
  /gsdr:new-project
`.trim());
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function install() {
  console.log('Installing GSDR...');

  // Verify source
  const missing = PLUGIN_DIRS.filter(dir => !fs.existsSync(path.join(SOURCE_DIR, dir)));
  if (missing.length > 0) {
    console.error(`Error: Missing source directories: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Copy plugin files (skills, agents, templates, etc.)
  fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  for (const dir of PLUGIN_DIRS) {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(PLUGIN_DIR, dir);
    console.log(`  Copying ${dir}/...`);
    copyDirRecursive(src, dest);
  }

  // Copy commands to ~/.claude/commands/gsdr/ (auto-discovered by Claude Code)
  const commandsSrc = path.join(SOURCE_DIR, 'commands', PLUGIN_NAME);
  if (fs.existsSync(commandsSrc)) {
    console.log('  Installing slash commands...');
    copyDirRecursive(commandsSrc, COMMANDS_DIR);
  }

  console.log('');
  console.log('GSDR installed! Start Claude Code and run:');
  console.log('  /gsdr:new-project');
}

function uninstall() {
  let removed = false;

  if (fs.existsSync(PLUGIN_DIR)) {
    fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
    console.log(`Removed ${PLUGIN_DIR}`);
    removed = true;
  }

  if (fs.existsSync(COMMANDS_DIR)) {
    fs.rmSync(COMMANDS_DIR, { recursive: true, force: true });
    console.log(`Removed ${COMMANDS_DIR}`);
    removed = true;
  }

  if (removed) {
    console.log('GSDR uninstalled.');
  } else {
    console.log('GSDR is not installed.');
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--uninstall')) {
  uninstall();
  process.exit(0);
}

install();
