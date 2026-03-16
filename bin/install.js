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

const COMPACT_LOGO = `
  ▄▄ ▄▄▄ ▄▄▄ ▄▄▄
  █▌ ▀▄▄ █▄▀ █▄▀
  ▀▀ ▄▄▀ ▀ ▀ ▀ ▀`;

function printHelp() {
  console.log(`${COMPACT_LOGO}
  Autonomous builds that ship while you sleep.

Usage:
  npx @leonaffi/gsdr@latest            Install GSDR
  npx @leonaffi/gsdr@latest --help     Show this help message
  npx @leonaffi/gsdr@latest --uninstall  Remove GSDR

Installs to:
  ${PLUGIN_DIR}     (skills, agents, templates)
  ${COMMANDS_DIR}   (slash commands)

After installation, start Claude Code and run:
  /gsdr:new-project`);
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
  console.log(COMPACT_LOGO);
  console.log('  Get shit done. Autonomously.\n');

  // Verify source
  const missing = PLUGIN_DIRS.filter(dir => !fs.existsSync(path.join(SOURCE_DIR, dir)));
  if (missing.length > 0) {
    console.error(`  Well that didn't work.\n  Missing source directories: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Copy plugin files (skills, agents, templates, etc.)
  fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  for (const dir of PLUGIN_DIRS) {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(PLUGIN_DIR, dir);
    console.log(`  Deploying ${dir}/...`);
    copyDirRecursive(src, dest);
  }

  // Copy commands to ~/.claude/commands/gsdr/ (auto-discovered by Claude Code)
  const commandsSrc = path.join(SOURCE_DIR, 'commands', PLUGIN_NAME);
  if (fs.existsSync(commandsSrc)) {
    console.log('  Arming slash commands...');
    copyDirRecursive(commandsSrc, COMMANDS_DIR);
  }

  console.log('');
  console.log('GSDR is live. You\'re dangerous now.');
  console.log('');
  console.log('  Next up:');
  console.log('  Start Claude Code and run:');
  console.log('    /gsdr:new-project');
  console.log('');
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
    console.log('GSDR removed. We\'ll miss you.');
  } else {
    console.log('GSDR isn\'t here. Nothing to remove.');
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
