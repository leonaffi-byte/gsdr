import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

describe('FOUND-05: XML plan format preserved', () => {
  it('executor agent contains <task tags', () => {
    const executorPath = path.join(ROOT, 'agents', 'gsdr-executor.md');
    const content = fs.readFileSync(executorPath, 'utf-8');
    expect(content).toContain('<task');
  });

  it('planner agent contains <verify> tags for plan format', () => {
    const plannerPath = path.join(ROOT, 'agents', 'gsdr-planner.md');
    const content = fs.readFileSync(plannerPath, 'utf-8');
    expect(content).toContain('<verify>');
  });

  it('executor agent contains checkpoint patterns', () => {
    const executorPath = path.join(ROOT, 'agents', 'gsdr-executor.md');
    const content = fs.readFileSync(executorPath, 'utf-8');
    const hasCheckpoint =
      content.includes('checkpoint:human-verify') ||
      content.includes('checkpoint:decision') ||
      content.includes('checkpoint:human-action') ||
      content.includes('type="checkpoint');
    expect(hasCheckpoint, 'Executor should reference checkpoint patterns').toBe(true);
  });

  it('planner agent references XML plan structure', () => {
    const plannerPath = path.join(ROOT, 'agents', 'gsdr-planner.md');
    const content = fs.readFileSync(plannerPath, 'utf-8');
    // Planner should describe how to create plans with XML task format
    const hasTaskRef = content.includes('<task') || content.includes('task type=');
    expect(hasTaskRef, 'Planner should reference XML task structure').toBe(true);
  });
});
