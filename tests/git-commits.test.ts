import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const DIST_FILE = path.join(ROOT, 'dist', 'gsdr-tools.cjs');
const COMMANDS_SRC = path.join(ROOT, 'src', 'lib', 'commands.ts');

describe('FOUND-06: Atomic git commits', () => {
  it('cmdCommit function exists in source', () => {
    const content = fs.readFileSync(COMMANDS_SRC, 'utf-8');
    expect(content).toContain('cmdCommit');
    expect(content).toMatch(/export\s+function\s+cmdCommit/);
  });

  it('commit implementation stages specific files (not git add -A or git add .)', () => {
    const content = fs.readFileSync(COMMANDS_SRC, 'utf-8');
    // Should use git add with specific files
    expect(content).toContain("'add'");
    // Should NOT use blanket staging
    expect(content).not.toContain("'add', '-A'");
    expect(content).not.toContain("'add', '.'");
  });

  it('commit function in dist/gsdr-tools.cjs is present', () => {
    const content = fs.readFileSync(DIST_FILE, 'utf-8');
    expect(content).toContain('cmdCommit');
  });

  it('commit implementation creates atomic commits with specific file staging', () => {
    const content = fs.readFileSync(COMMANDS_SRC, 'utf-8');
    // Extract the cmdCommit function body
    const funcStart = content.indexOf('export function cmdCommit');
    expect(funcStart).toBeGreaterThan(-1);

    // The function should iterate over files to stage them individually
    const funcBody = content.slice(funcStart, funcStart + 1500);
    expect(funcBody).toContain('filesToStage');
    // It should use git add with each file, not a blanket add
    expect(funcBody).toMatch(/for\s*\(.*file.*of.*filesToStage/);
  });
});
