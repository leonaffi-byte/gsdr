
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { output, error } from './core';

export function cmdConfigEnsureSection(cwd: string, raw: boolean): void {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');

  // Ensure .planning directory exists
  try {
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }
  } catch (err: unknown) {
    error('Failed to create .planning directory: ' + (err as Error).message);
  }

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    const result = { created: false, reason: 'already_exists' };
    output(result, raw, 'exists');
    return;
  }

  // Detect Brave Search API key availability
  const homedir = os.homedir();
  const braveKeyFile = path.join(homedir, '.gsdr', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Load user-level defaults from ~/.gsdr/defaults.json if available
  const globalDefaultsPath = path.join(homedir, '.gsdr', 'defaults.json');
  let userDefaults: Record<string, unknown> = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
      // Migrate deprecated "depth" key to "granularity"
      if ('depth' in userDefaults && !('granularity' in userDefaults)) {
        const depthToGranularity: Record<string, string> = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
        userDefaults.granularity = depthToGranularity[userDefaults.depth as string] || userDefaults.depth;
        delete userDefaults.depth;
        try { fs.writeFileSync(globalDefaultsPath, JSON.stringify(userDefaults, null, 2), 'utf-8'); } catch { /* ignore */ }
      }
    }
  } catch {
    // Ignore malformed global defaults, fall back to hardcoded
  }

  // Create default config
  const hardcoded: Record<string, unknown> = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsdr/phase-{phase}-{slug}',
    milestone_branch_template: 'gsdr/{milestone}-{slug}',
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      auto_advance: true,
    },
    parallelization: true,
    brave_search: hasBraveSearch,
  };
  const defaults = {
    ...hardcoded,
    ...userDefaults,
    workflow: {
      ...(hardcoded.workflow as Record<string, unknown>),
      ...((userDefaults.workflow as Record<string, unknown>) || {}),
    },
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    const result = { created: true, path: '.planning/config.json' };
    output(result, raw, 'created');
  } catch (err: unknown) {
    error('Failed to create config.json: ' + (err as Error).message);
  }
}

export function cmdConfigSet(cwd: string, keyPath: string, value: string, raw: boolean): void {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-set <key.path> <value>');
  }

  // Parse value (handle booleans and numbers)
  let parsedValue: unknown = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);

  // Load existing config or start with empty object
  let config: Record<string, unknown> = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err: unknown) {
    error('Failed to read config.json: ' + (err as Error).message);
  }

  // Set nested value using dot notation (e.g., "workflow.research")
  const keys = keyPath.split('.');
  let current: Record<string, unknown> = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = parsedValue;

  // Write back
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    const result = { updated: true, key: keyPath, value: parsedValue };
    output(result, raw, `${keyPath}=${parsedValue}`);
  } catch (err: unknown) {
    error('Failed to write config.json: ' + (err as Error).message);
  }
}

export function cmdConfigGet(cwd: string, keyPath: string, raw: boolean): void {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-get <key.path>');
  }

  let config: Record<string, unknown> = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      error('No config.json found at ' + configPath);
    }
  } catch (err: unknown) {
    if ((err as Error).message.startsWith('No config.json')) throw err;
    error('Failed to read config.json: ' + (err as Error).message);
  }

  // Traverse dot-notation path
  const keys = keyPath.split('.');
  let current: unknown = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      error(`Key not found: ${keyPath}`);
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (current === undefined) {
    error(`Key not found: ${keyPath}`);
  }

  output(current, raw, String(current));
}
