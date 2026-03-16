import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('AUTO-03: Auto-advance defaults and gate behavior', () => {
  // Test 1: config.ts hardcoded workflow defaults include auto_advance: true
  it('config.ts hardcoded workflow defaults include auto_advance: true', () => {
    const configSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'config.ts'),
      'utf-8'
    );
    // Find the workflow object in hardcoded defaults
    const workflowMatch = configSrc.match(/workflow:\s*\{([^}]+)\}/s);
    expect(workflowMatch).not.toBeNull();
    const workflowBlock = workflowMatch![1];
    expect(workflowBlock).toContain('auto_advance: true');
  });

  // Test 2: settings SKILL.md auto-advance option shows "Yes (Recommended)" as first option
  it('settings SKILL.md shows "Yes (Recommended)" before "No" for auto-advance', () => {
    const settingsSrc = fs.readFileSync(
      path.join(__dirname, '..', 'skills', 'settings', 'SKILL.md'),
      'utf-8'
    );
    // Find the auto-advance question block
    const autoAdvanceMatch = settingsSrc.match(
      /Auto-advance pipeline\?.*?\]/s
    );
    expect(autoAdvanceMatch).not.toBeNull();
    const block = autoAdvanceMatch![0];
    const yesPos = block.indexOf('Yes (Recommended)');
    const noPos = block.indexOf('"No"');
    expect(yesPos).toBeGreaterThan(-1);
    expect(noPos).toBeGreaterThan(-1);
    expect(yesPos).toBeLessThan(noPos);
  });

  // Test 3: settings SKILL.md auto-advance "No" option is not marked as Recommended
  it('settings SKILL.md "No" option for auto-advance does NOT contain "(Recommended)"', () => {
    const settingsSrc = fs.readFileSync(
      path.join(__dirname, '..', 'skills', 'settings', 'SKILL.md'),
      'utf-8'
    );
    // Find the auto-advance question block
    const autoAdvanceMatch = settingsSrc.match(
      /Auto-advance pipeline\?.*?\]\s*\}/s
    );
    expect(autoAdvanceMatch).not.toBeNull();
    const block = autoAdvanceMatch![0];
    // "No (Recommended)" should NOT appear
    expect(block).not.toContain('No (Recommended)');
  });

  // Test 4: plan-phase SKILL.md Step 12 auto-retries capped at 2 when auto_advance is active
  it('plan-phase SKILL.md Step 12 has auto_advance check with auto-retry capped at 2', () => {
    const planPhaseSrc = fs.readFileSync(
      path.join(__dirname, '..', 'skills', 'plan-phase', 'SKILL.md'),
      'utf-8'
    );
    // Step 12 should contain auto_advance reference
    expect(planPhaseSrc).toContain('auto_advance');
    // Should contain the config-get check for auto_advance
    expect(planPhaseSrc).toContain('config-get workflow.auto_advance');
    // Should reference max 2 retries in auto-advance context
    const step12Match = planPhaseSrc.match(/## 12\. Revision Loop[\s\S]*?(?=## 13\.|$)/);
    expect(step12Match).not.toBeNull();
    const step12 = step12Match![0];
    // Auto-advance should cap at 2
    expect(step12).toMatch(/auto.advance/i);
    expect(step12).toMatch(/(?:cap|max|limit).*2|2.*(?:cap|max|limit|retries|iterations)/i);
  });

  // Test 5: plan-phase SKILL.md Step 12 still offers interactive options when auto_advance is false
  it('plan-phase SKILL.md Step 12 has interactive options for non-auto-advance mode', () => {
    const planPhaseSrc = fs.readFileSync(
      path.join(__dirname, '..', 'skills', 'plan-phase', 'SKILL.md'),
      'utf-8'
    );
    const step12Match = planPhaseSrc.match(/## 12\. Revision Loop[\s\S]*?(?=## 13\.|$)/);
    expect(step12Match).not.toBeNull();
    const step12 = step12Match![0];
    // Should still offer interactive options
    expect(step12).toContain('Force proceed');
    expect(step12).toContain('Provide guidance');
    expect(step12).toContain('Abandon');
  });
});
