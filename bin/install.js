#!/usr/bin/env node

/**
 * GSDR Install Script
 * Installs GSDR as a Claude Code plugin by copying plugin files
 * to the user's local plugins directory.
 *
 * Usage:
 *   npx @leonaffi/gsdr@latest          # Install plugin
 *   npx @leonaffi/gsdr@latest --help   # Show usage
 *   npx @leonaffi/gsdr@latest --uninstall  # Remove plugin
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_NAME = 'gsdr';
const TARGET_DIR = path.join(os.homedir(), '.claude', 'plugins', 'local', PLUGIN_NAME);
const SOURCE_DIR = path.join(__dirname, '..');

const DIRS_TO_COPY = [
  '.claude-plugin',
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
  npx @leonaffi/gsdr@latest            Install GSDR plugin
  npx @leonaffi/gsdr@latest --help     Show this help message
  npx @leonaffi/gsdr@latest --uninstall  Remove GSDR plugin

The plugin is installed to:
  ${TARGET_DIR}

After installation, use Claude Code with:
  claude --plugin-dir ${TARGET_DIR}

Or run /gsdr:new-project to begin a new project.
`.trim());
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

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
  console.log(`Installing GSDR plugin...`);
  console.log(`  Source: ${SOURCE_DIR}`);
  console.log(`  Target: ${TARGET_DIR}`);
  console.log('');

  // Verify source directories exist
  const missing = DIRS_TO_COPY.filter(dir => !fs.existsSync(path.join(SOURCE_DIR, dir)));
  if (missing.length > 0) {
    console.error(`Error: Missing source directories: ${missing.join(', ')}`);
    console.error('The package may be corrupted. Try reinstalling.');
    process.exit(1);
  }

  // Create target directory
  try {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  } catch (err) {
    console.error(`Error: Cannot create target directory: ${TARGET_DIR}`);
    console.error(`  ${err.message}`);
    console.error('Check permissions and try again.');
    process.exit(1);
  }

  // Copy each directory
  for (const dir of DIRS_TO_COPY) {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(TARGET_DIR, dir);
    console.log(`  Copying ${dir}/...`);
    try {
      copyDirRecursive(src, dest);
    } catch (err) {
      console.error(`Error copying ${dir}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('');
  console.log(`GSDR plugin installed to ${TARGET_DIR}`);
  console.log('');
  console.log('To use with Claude Code:');
  console.log(`  claude --plugin-dir ${TARGET_DIR}`);
  console.log('');
  console.log('Or add to your Claude Code settings, then run:');
  console.log('  /gsdr:new-project');
}

function uninstall() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.log('GSDR plugin is not installed.');
    return;
  }

  console.log(`Removing GSDR plugin from ${TARGET_DIR}...`);
  try {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
    console.log('GSDR plugin removed successfully.');
  } catch (err) {
    console.error(`Error removing plugin: ${err.message}`);
    process.exit(1);
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
