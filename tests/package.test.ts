import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

describe('FOUND-08: npm package distribution', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  it('package.json exists with name "gsdr"', () => {
    expect(fs.existsSync(pkgPath)).toBe(true);
    expect(pkg.name).toBe('gsdr');
  });

  it('package.json has bin.gsdr pointing to "bin/install.js"', () => {
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin.gsdr).toBe('bin/install.js');
  });

  it('bin/install.js exists and has shebang', () => {
    const installPath = path.join(ROOT, 'bin', 'install.js');
    expect(fs.existsSync(installPath)).toBe(true);
    const content = fs.readFileSync(installPath, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('package.json files array includes required directories', () => {
    expect(pkg.files).toBeDefined();
    const required = ['bin', '.claude-plugin', 'skills', 'agents', 'hooks', 'templates', 'references', 'dist'];
    for (const dir of required) {
      expect(pkg.files, `Missing "${dir}" in files array`).toContain(dir);
    }
  });

  it('package.json scripts.build exists', () => {
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
  });

  it('all directories listed in files array exist on disk', () => {
    for (const dir of pkg.files) {
      const dirPath = path.join(ROOT, dir);
      expect(fs.existsSync(dirPath), `Directory "${dir}" does not exist`).toBe(true);
    }
  });
});
