import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '..');
const DIST_FILE = path.join(ROOT, 'dist', 'gsdr-tools.cjs');

describe('FOUND-02: TypeScript compiles, esbuild produces CJS', () => {
  it('dist/gsdr-tools.cjs exists and is substantial', () => {
    expect(fs.existsSync(DIST_FILE)).toBe(true);
    const content = fs.readFileSync(DIST_FILE, 'utf-8');
    const lineCount = content.split('\n').length;
    expect(lineCount).toBeGreaterThan(1000);
  });

  it('dist/gsdr-tools.cjs is valid CJS (can be executed)', () => {
    // The CLI exits with error when called without args, but that proves it's valid CJS
    // Use a known command to verify it loads and runs
    const result = execSync(`node "${DIST_FILE}" generate-slug "test" --raw`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    expect(result.length).toBeGreaterThan(0);
  });

  it('generate-slug command produces correct output', () => {
    const result = execSync(`node "${DIST_FILE}" generate-slug "test value" --raw`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    expect(result).toBe('test-value');
  });

  it('autonomous normalize-error command works through bundle', () => {
    const result = execSync(
      `node "${DIST_FILE}" autonomous normalize-error "Error at /foo/bar.ts:42:10" --raw`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    expect(result).toBe('Error at FILE:LINE:COL');
  });

  it('current-timestamp date command outputs YYYY-MM-DD format', () => {
    const result = execSync(`node "${DIST_FILE}" current-timestamp date --raw`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
