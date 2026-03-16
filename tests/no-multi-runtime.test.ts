import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const DIST_FILE = path.join(ROOT, 'dist', 'gsdr-tools.cjs');

describe('FOUND-01: No multi-runtime code', () => {
  const distContent = fs.readFileSync(DIST_FILE, 'utf-8');

  it('dist/gsdr-tools.cjs does not contain "OpenCode"', () => {
    expect(distContent).not.toContain('OpenCode');
  });

  it('dist/gsdr-tools.cjs does not contain runtime reference to "Gemini"', () => {
    // Check for Gemini as a runtime/tool reference, not as general English word
    const lines = distContent.split('\n');
    const geminiRuntimeLines = lines.filter(
      (line) => line.includes('Gemini') && (line.includes('runtime') || line.includes('config') || line.includes('model') || line.includes('profile'))
    );
    expect(geminiRuntimeLines).toHaveLength(0);
  });

  it('dist/gsdr-tools.cjs does not contain runtime reference to "Codex"', () => {
    const lines = distContent.split('\n');
    const codexRuntimeLines = lines.filter(
      (line) => line.includes('Codex') && (line.includes('runtime') || line.includes('config') || line.includes('model') || line.includes('profile'))
    );
    expect(codexRuntimeLines).toHaveLength(0);
  });

  it('dist/gsdr-tools.cjs does not contain runtime reference to "Copilot"', () => {
    const lines = distContent.split('\n');
    const copilotRuntimeLines = lines.filter(
      (line) => line.includes('Copilot') && (line.includes('runtime') || line.includes('config') || line.includes('model') || line.includes('profile'))
    );
    expect(copilotRuntimeLines).toHaveLength(0);
  });

  it('source files do not contain multi-runtime references', () => {
    const srcDir = path.join(ROOT, 'src');
    const tsFiles = getAllFiles(srcDir, '.ts');

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(ROOT, file);
      expect(content, `${relPath} contains "OpenCode"`).not.toContain('OpenCode');
    }
  });

  it('MODEL_PROFILES only contains gsdr-* prefixed agent names', () => {
    // Extract MODEL_PROFILES keys from the built output
    const profileMatch = distContent.match(/MODEL_PROFILES\s*=\s*\{([^}]+)\}/s);
    expect(profileMatch, 'MODEL_PROFILES not found in dist').toBeTruthy();

    const profileBlock = profileMatch![1];
    // Match quoted keys like 'gsdr-planner' or "gsdr-planner"
    const keyMatches = profileBlock.match(/['"]([^'"]+)['"]\s*:/g) || [];
    const keys = keyMatches.map((k) => k.replace(/['":\s]/g, ''));

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key, `MODEL_PROFILES key "${key}" should start with gsdr-`).toMatch(/^gsdr-/);
    }
  });
});

function getAllFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}
