import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

function countFiles(dir: string, pattern: RegExp): number {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath, pattern);
    } else if (pattern.test(entry.name)) {
      count++;
    }
  }
  return count;
}

function getSubdirFiles(dir: string, filename: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const target = path.join(dir, entry.name, filename);
      if (fs.existsSync(target)) {
        results.push(entry.name);
      }
    }
  }
  return results;
}

describe('FOUND-03: Claude Code Plugin format', () => {
  it('.claude-plugin/plugin.json exists with name "gsdr"', () => {
    const pluginPath = path.join(ROOT, '.claude-plugin', 'plugin.json');
    expect(fs.existsSync(pluginPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
    expect(content.name).toBe('gsdr');
  });

  it('skills/ directory has at least 25 SKILL.md files', () => {
    const skillsDir = path.join(ROOT, 'skills');
    const skills = getSubdirFiles(skillsDir, 'SKILL.md');
    expect(skills.length).toBeGreaterThanOrEqual(25);
  });

  it('agents/ directory has at least 10 gsdr-*.md files', () => {
    const agentsDir = path.join(ROOT, 'agents');
    const entries = fs.readdirSync(agentsDir).filter((f) => f.startsWith('gsdr-') && f.endsWith('.md'));
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  it('hooks/hooks.json exists and is valid JSON', () => {
    const hooksPath = path.join(ROOT, 'hooks', 'hooks.json');
    expect(fs.existsSync(hooksPath)).toBe(true);
    expect(() => JSON.parse(fs.readFileSync(hooksPath, 'utf-8'))).not.toThrow();
  });

  it('templates/ directory has at least 10 .md files', () => {
    const templatesDir = path.join(ROOT, 'templates');
    const mdCount = countFiles(templatesDir, /\.md$/);
    expect(mdCount).toBeGreaterThanOrEqual(10);
  });

  it('references/ directory has at least 5 .md files', () => {
    const refsDir = path.join(ROOT, 'references');
    const mdCount = countFiles(refsDir, /\.md$/);
    expect(mdCount).toBeGreaterThanOrEqual(5);
  });

  it('key skills exist: plan-phase, execute-phase, new-project, research-phase', () => {
    const skillsDir = path.join(ROOT, 'skills');
    const required = ['plan-phase', 'execute-phase', 'new-project', 'research-phase'];
    for (const skill of required) {
      const skillPath = path.join(skillsDir, skill, 'SKILL.md');
      expect(fs.existsSync(skillPath), `Missing skill: ${skill}`).toBe(true);
    }
  });

  it('key agents exist: gsdr-executor, gsdr-planner, gsdr-phase-researcher', () => {
    const agentsDir = path.join(ROOT, 'agents');
    const required = ['gsdr-executor.md', 'gsdr-planner.md', 'gsdr-phase-researcher.md'];
    for (const agent of required) {
      const agentPath = path.join(agentsDir, agent);
      expect(fs.existsSync(agentPath), `Missing agent: ${agent}`).toBe(true);
    }
  });
});
