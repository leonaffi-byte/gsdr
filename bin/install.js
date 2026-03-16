#!/usr/bin/env node

/**
 * GSDR Install Script
 * Installs GSDR as a Claude Code plugin by copying plugin files
 * and registering in Claude Code's plugin system.
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
const MARKETPLACE_NAME = 'gsdr-marketplace';
const PLUGIN_ID = PLUGIN_NAME + '@' + MARKETPLACE_NAME;
const GITHUB_REPO = 'leonaffi-byte/gsdr';
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const TARGET_DIR = path.join(CLAUDE_DIR, 'plugins', 'local', PLUGIN_NAME);
const SOURCE_DIR = path.join(__dirname, '..');
const INSTALLED_PLUGINS_FILE = path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');

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

After installation, just start Claude Code and run:
  /gsdr:new-project
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

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function getVersion() {
  try {
    const pkg = readJSON(path.join(SOURCE_DIR, 'package.json'));
    return pkg ? pkg.version : '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function registerPlugin() {
  const version = getVersion();
  const now = new Date().toISOString();

  // Register in installed_plugins.json
  const installed = readJSON(INSTALLED_PLUGINS_FILE) || { version: 2, plugins: {} };
  // Clean up old gsdr@local entry if present
  delete installed.plugins['gsdr@local'];
  installed.plugins[PLUGIN_ID] = [
    {
      scope: 'user',
      installPath: TARGET_DIR,
      version: version,
      installedAt: installed.plugins[PLUGIN_ID]?.[0]?.installedAt || now,
      lastUpdated: now,
    },
  ];
  writeJSON(INSTALLED_PLUGINS_FILE, installed);

  // Enable in settings.json and register marketplace
  const settings = readJSON(SETTINGS_FILE) || {};
  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }
  delete settings.enabledPlugins['gsdr@local'];
  settings.enabledPlugins[PLUGIN_ID] = true;

  if (!settings.extraKnownMarketplaces) {
    settings.extraKnownMarketplaces = {};
  }
  settings.extraKnownMarketplaces[MARKETPLACE_NAME] = {
    source: {
      source: 'github',
      repo: GITHUB_REPO,
    },
  };
  writeJSON(SETTINGS_FILE, settings);
}

function unregisterPlugin() {
  // Remove from installed_plugins.json
  const installed = readJSON(INSTALLED_PLUGINS_FILE);
  if (installed && installed.plugins) {
    delete installed.plugins[PLUGIN_ID];
    delete installed.plugins['gsdr@local'];
    writeJSON(INSTALLED_PLUGINS_FILE, installed);
  }

  // Remove from settings.json
  const settings = readJSON(SETTINGS_FILE);
  if (settings) {
    if (settings.enabledPlugins) {
      delete settings.enabledPlugins[PLUGIN_ID];
      delete settings.enabledPlugins['gsdr@local'];
    }
    if (settings.extraKnownMarketplaces) {
      delete settings.extraKnownMarketplaces[MARKETPLACE_NAME];
    }
    writeJSON(SETTINGS_FILE, settings);
  }
}

function install() {
  console.log('Installing GSDR plugin...');
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

  // Register plugin in Claude Code
  try {
    registerPlugin();
    console.log('  Registered in Claude Code');
  } catch (err) {
    console.error(`  Warning: Could not register plugin: ${err.message}`);
    console.error('  You may need to add it manually with: claude --plugin-dir ' + TARGET_DIR);
  }

  console.log('');
  console.log('GSDR installed! Just start Claude Code and run:');
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
    unregisterPlugin();
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
