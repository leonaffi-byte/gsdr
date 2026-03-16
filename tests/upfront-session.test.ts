import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SKILL_PATH = join(__dirname, '..', 'skills', 'new-project', 'SKILL.md');

function readSkill(): string {
  return readFileSync(SKILL_PATH, 'utf-8');
}

describe('AUTO-01: Upfront phase context gathering in new-project', () => {
  it('Test 1: new-project SKILL.md contains "## 8.5" step heading', () => {
    const content = readSkill();
    expect(content).toMatch(/## 8\.5/);
  });

  it('Test 2: Step 8.5 references classify-complexity for per-phase classification', () => {
    const content = readSkill();
    // Extract the 8.5 section
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    expect(step85).toContain('classify-complexity');
  });

  it('Test 3: Step 8.5 contains Simple/Medium/Complex tier routing with different question depths', () => {
    const content = readSkill();
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    // Must have all three tiers
    expect(step85).toMatch(/Simple/i);
    expect(step85).toMatch(/Medium/i);
    expect(step85).toMatch(/Complex/i);
    // Must have different question depths
    expect(step85).toMatch(/1-2/);
    expect(step85).toMatch(/3-4/);
  });

  it('Test 4: Step 8.5 contains CONTEXT.md generation and commit per phase', () => {
    const content = readSkill();
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    expect(step85).toContain('CONTEXT.md');
    // Must reference committing
    expect(step85).toMatch(/commit/i);
    // Must reference per-phase generation pattern
    expect(step85).toMatch(/phase/i);
  });

  it('Test 5: Step 8.5 auto mode section generates CONTEXT.md from document without interactive questions', () => {
    const content = readSkill();
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    // Must have auto mode branch
    expect(step85).toMatch(/auto mode/i);
    // Must reference document extraction
    expect(step85).toMatch(/document|provided/i);
    // Must generate CONTEXT.md
    expect(step85).toContain('CONTEXT.md');
  });

  it('Test 6: Step 8.5 contains preliminary analysis section with codebase analysis for brownfield projects', () => {
    const content = readSkill();
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    // Must have preliminary analysis section
    expect(step85).toMatch(/preliminary analysis/i);
    // Must reference brownfield
    expect(step85).toMatch(/brownfield/i);
    // Must reference codebase analysis
    expect(step85).toMatch(/codebase/i);
  });

  it('Test 7: Step 8.5 contains analysis summary display before questioning', () => {
    const content = readSkill();
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    // Must have analysis summary/display
    expect(step85).toMatch(/analysis summary|summary.*display|display.*summary/i);
    // Must contain a table format for phase complexity
    expect(step85).toMatch(/Phase.*Complexity|Complexity.*Phase/i);
  });

  it('Test 8: Step 8.5 contains auto-resume with .continue-here.md on context window limit (not interactive offer)', () => {
    const content = readSkill();
    const step85Match = content.match(/## 8\.5[\s\S]*?(?=## 9\.)/);
    expect(step85Match).not.toBeNull();
    const step85 = step85Match![0];
    // Must write .continue-here.md automatically
    expect(step85).toContain('.continue-here.md');
    // Must auto-invoke resume-work
    expect(step85).toContain('resume-work');
    // Must NOT contain "offer" or "warn" in context of continue-here (it should be automatic)
    // Check that the auto-resume section doesn't use "offer" or "warning" language
    const continueSection = step85.substring(step85.indexOf('.continue-here.md') - 500);
    expect(continueSection).not.toMatch(/\boffer\b.*continue-here|warn.*continue-here/i);
  });
});

describe('AUTO-01: Step 9 routes to plan-phase instead of discuss-phase', () => {
  it('Step 9 auto mode routes to plan-phase (not discuss-phase)', () => {
    const content = readSkill();
    const step9Match = content.match(/## 9\. Done[\s\S]*$/);
    expect(step9Match).not.toBeNull();
    const step9 = step9Match![0];
    // Auto mode should advance to plan-phase
    expect(step9).toMatch(/plan-phase.*--auto|plan-phase 1 --auto/i);
  });

  it('Step 9 interactive mode suggests plan-phase as primary next step', () => {
    const content = readSkill();
    const step9Match = content.match(/## 9\. Done[\s\S]*$/);
    expect(step9Match).not.toBeNull();
    const step9 = step9Match![0];
    // Interactive mode should suggest plan-phase as the main next step
    expect(step9).toMatch(/plan-phase 1/);
  });

  it('Step 9 keeps discuss-phase available as "Also available" option', () => {
    const content = readSkill();
    const step9Match = content.match(/## 9\. Done[\s\S]*$/);
    expect(step9Match).not.toBeNull();
    const step9 = step9Match![0];
    // discuss-phase should be available but not primary
    expect(step9).toMatch(/discuss-phase/);
    expect(step9).toMatch(/also available/i);
  });
});
