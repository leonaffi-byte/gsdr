import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

const ROOT = path.join(__dirname, '..');
const DIST_FILE = path.join(ROOT, 'dist', 'gsdr-tools.cjs');

describe('FOUND-07: State management', () => {
  let tmpDir: string;

  beforeAll(() => {
    // Create a temporary directory with a .planning/STATE.md
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsdr-state-test-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Write a minimal STATE.md
    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: test
status: executing
stopped_at: test
last_updated: "2026-01-01T00:00:00Z"
last_activity: "2026-01-01 -- test"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 1 of 3
Plan: 1 of 2 in current phase
Status: Executing

Progress: [.........] 0%
`
    );

    // Write a minimal config.json
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ mode: 'yolo', commit_docs: true }, null, 2)
    );

    // Initialize a git repo so state commands work
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "init" --allow-empty', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterAll(() => {
    // Clean up
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('can read state from a directory using --cwd flag', () => {
    const result = execSync(`node "${DIST_FILE}" state json --cwd "${tmpDir}" --raw`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    expect(result.length).toBeGreaterThan(0);
  });

  it('state json output parses as valid JSON', () => {
    const result = execSync(`node "${DIST_FILE}" state json --cwd "${tmpDir}" --raw`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
    expect(parsed.milestone).toBe('v1.0');
  });

  it('state get retrieves content', () => {
    const result = execSync(`node "${DIST_FILE}" state get --cwd "${tmpDir}" --raw`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Project State');
  });
});
