import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SKILL_PATH = resolve(__dirname, '../skills/execute-phase/SKILL.md');
const EXECUTE_PLAN_PATH = resolve(__dirname, '../execute-plan.md');
const TRANSITION_PATH = resolve(__dirname, '../transition.md');
const PLANNER_PATH = resolve(__dirname, '../agents/gsdr-planner.md');
const RESUME_WORK_PATH = resolve(__dirname, '../skills/resume-work/SKILL.md');

let skill: string;

beforeAll(() => {
  skill = readFileSync(SKILL_PATH, 'utf-8');
});

// ---- AUTO-08: milestone_name parsed from init JSON ----

describe('execute-phase SKILL.md -- milestone_name parsed (AUTO-08)', () => {
  it('contains milestone_name in the parse list on line 37', () => {
    const lines = skill.split('\n');
    const parseLine = lines.find(l => l.startsWith('Parse JSON for:'));
    expect(parseLine).toBeDefined();
    expect(parseLine).toContain('milestone_name');
  });

  it('parse list contains both phase_req_ids and milestone_name', () => {
    const lines = skill.split('\n');
    const parseLine = lines.find(l => l.startsWith('Parse JSON for:'))!;
    expect(parseLine).toContain('phase_req_ids');
    expect(parseLine).toContain('milestone_name');
    // milestone_name appears after phase_req_ids
    const reqIdx = parseLine.indexOf('phase_req_ids');
    const milIdx = parseLine.indexOf('milestone_name');
    expect(milIdx).toBeGreaterThan(reqIdx);
  });
});

// ---- FOUND-03: execute-plan.md exists at plugin root ----

describe('execute-plan.md -- exists at plugin root (FOUND-03)', () => {
  it('execute-plan.md exists at project root', () => {
    expect(existsSync(EXECUTE_PLAN_PATH)).toBe(true);
  });

  it('contains <purpose> tag (valid workflow structure)', () => {
    const content = readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    expect(content).toContain('<purpose>');
  });

  it('does NOT contain gsd-tools.cjs (fully ported)', () => {
    const content = readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    expect(content).not.toContain('gsd-tools.cjs');
  });

  it('does NOT contain /gsd: (no GSD slash commands, only /gsdr:)', () => {
    const content = readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    expect(content).not.toContain('/gsd:');
  });

  it('references gsdr-tools.cjs (GSDR paths used)', () => {
    const content = readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    expect(content).toContain('gsdr-tools.cjs');
  });
});

// ---- FOUND-04: execute-plan.md context engineering ----

describe('execute-plan.md -- context engineering (FOUND-04)', () => {
  it('agents/gsdr-planner.md contains execute-plan.md reference', () => {
    const planner = readFileSync(PLANNER_PATH, 'utf-8');
    expect(planner).toContain('execute-plan.md');
  });

  it('skills/execute-phase/SKILL.md contains execute-plan.md reference in Task spawn', () => {
    expect(skill).toContain('execute-plan.md');
  });
});

// ---- AUTO-03: transition.md exists at plugin root ----

describe('transition.md -- exists at plugin root (AUTO-03)', () => {
  it('transition.md exists at project root', () => {
    expect(existsSync(TRANSITION_PATH)).toBe(true);
  });

  it('contains <purpose> tag (valid workflow structure)', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    expect(content).toContain('<purpose>');
  });

  it('does NOT contain gsd-tools.cjs (fully ported)', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    expect(content).not.toContain('gsd-tools.cjs');
  });

  it('does NOT contain /gsd: (no GSD slash commands, only /gsdr:)', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    expect(content).not.toContain('/gsd:');
  });

  it('does NOT contain mode="yolo" or mode="interactive"', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    expect(content).not.toContain('mode="yolo"');
    expect(content).not.toContain('mode="interactive"');
  });

  it('contains auto_advance or AUTO_CHAIN or AUTO_CFG pattern', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    const hasAutoAdvance = content.includes('auto_advance') || content.includes('AUTO_CHAIN') || content.includes('AUTO_CFG');
    expect(hasAutoAdvance).toBe(true);
  });

  it('contains gsdr-tools.cjs (GSDR paths used)', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    expect(content).toContain('gsdr-tools.cjs');
  });

  it('contains /gsdr: (GSDR slash commands)', () => {
    const content = readFileSync(TRANSITION_PATH, 'utf-8');
    expect(content).toContain('/gsdr:');
  });
});

// ---- AUTO-03: transition.md reference in resume-work ----

describe('resume-work SKILL.md -- transition.md reference (AUTO-03)', () => {
  it('contains ${CLAUDE_SKILL_DIR}/../transition.md (not ./transition.md)', () => {
    const resumeWork = readFileSync(RESUME_WORK_PATH, 'utf-8');
    expect(resumeWork).toContain('${CLAUDE_SKILL_DIR}/../transition.md');
  });
});
