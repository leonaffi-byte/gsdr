import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PLAN_PHASE_SKILL_PATH = resolve(__dirname, '../skills/plan-phase/SKILL.md');
const FAILURES_TEMPLATE_PATH = resolve(__dirname, '../templates/failures.md');

let planPhaseSkill: string;
let failuresTemplate: string;

beforeAll(() => {
  planPhaseSkill = readFileSync(PLAN_PHASE_SKILL_PATH, 'utf-8');
  failuresTemplate = readFileSync(FAILURES_TEMPLATE_PATH, 'utf-8');
});

// ---- Task 07-01-01 (CMPLX-02, CMPLX-03): complexity_tier frontmatter injection ----

describe('plan-phase SKILL.md — complexity_tier persisted to PLAN.md frontmatter (CMPLX-02, CMPLX-03)', () => {
  it('contains a step 9.5 or equivalent post-planner frontmatter injection step', () => {
    // After PLANNING COMPLETE the skill must persist the tier into PLAN.md files
    expect(planPhaseSkill).toContain('9.5');
  });

  it('uses frontmatter set CLI to write complexity_tier field', () => {
    // The injection must call the frontmatter set CLI subcommand with the field name
    expect(planPhaseSkill).toContain('frontmatter set');
    expect(planPhaseSkill).toContain('complexity_tier');
  });

  it('writes complexity_tier value from COMPLEXITY_TIER variable', () => {
    // The value written must come from the COMPLEXITY_TIER variable, not a hardcoded string
    expect(planPhaseSkill).toMatch(/--value.*\$COMPLEXITY_TIER|\$COMPLEXITY_TIER.*--value/);
  });

  it('iterates over all PLAN.md files in the phase directory', () => {
    // The injection loop must target every *-PLAN.md file created by the planner
    expect(planPhaseSkill).toMatch(/for.*PLAN_FILE.*PLAN\.md|for.*PLAN\.md/);
  });

  it('step 9.5 runs only on PLANNING COMPLETE path, not checkpoint or inconclusive', () => {
    // The PLANNING COMPLETE section must precede and contain (or directly lead to) step 9.5
    const planningCompleteIdx = planPhaseSkill.indexOf('PLANNING COMPLETE');
    const step95Idx = planPhaseSkill.indexOf('9.5');
    // Step 9.5 must appear after the PLANNING COMPLETE handler
    expect(planningCompleteIdx).toBeGreaterThanOrEqual(0);
    expect(step95Idx).toBeGreaterThan(planningCompleteIdx);
  });

  it('guards injection with non-empty COMPLEXITY_TIER check for backward compatibility', () => {
    // Must skip injection when COMPLEXITY_TIER is empty (older invocations without classification)
    expect(planPhaseSkill).toMatch(/-n.*\$COMPLEXITY_TIER|\$COMPLEXITY_TIER.*-n/);
  });

  it('does not add complexity_tier to required frontmatter schema fields', () => {
    // The field is optional; the skill must explicitly call it optional or not list it as required
    expect(planPhaseSkill).toMatch(/optional.*complexity_tier|complexity_tier.*optional/i);
  });
});

// ---- Task 07-01-02 (AUTO-05, AUTO-08): FAILURES.md template heading alignment ----

describe('templates/failures.md — entry heading aligned with serializeEntry() output (AUTO-05, AUTO-08)', () => {
  it('entry heading format is ## {plan_id} (no colon, no plan name appended)', () => {
    // serializeEntry() produces "## {plan_id}" — the template must match this exactly
    expect(failuresTemplate).toContain('## {plan_id}');
  });

  it('entry heading does NOT use ## {plan_id}: {plan_name} format', () => {
    // The old incorrect format with a colon and plan name must not appear in the template
    expect(failuresTemplate).not.toContain('## {plan_id}: {plan_name}');
  });

  it('entry heading does NOT use ## {plan_id} — {plan_name} format', () => {
    // Any dash-separated variant is also incorrect
    expect(failuresTemplate).not.toContain('## {plan_id} — {plan_name}');
    expect(failuresTemplate).not.toContain('## {plan_id} - {plan_name}');
  });

  it('template entry section contains required status field', () => {
    // status field is mandatory in every FAILURES.md entry
    expect(failuresTemplate).toContain('status:');
  });

  it('template entry section contains error_signature field', () => {
    // error_signature is used by autonomous.ts to detect duplicate errors
    expect(failuresTemplate).toContain('error_signature:');
  });

  it('template entry section contains strike_count field', () => {
    // strike_count drives the halt-after-2-strikes logic in autonomous.ts
    expect(failuresTemplate).toContain('strike_count:');
  });
});
