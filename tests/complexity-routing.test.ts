import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the SKILL.md files once for all tests
const PLAN_PHASE_SKILL_PATH = resolve(__dirname, '../skills/plan-phase/SKILL.md');
const EXECUTE_PHASE_SKILL_PATH = resolve(__dirname, '../skills/execute-phase/SKILL.md');

let planPhaseSkill: string;
let executePhaseSkill: string;

beforeAll(() => {
  planPhaseSkill = readFileSync(PLAN_PHASE_SKILL_PATH, 'utf-8');
  executePhaseSkill = readFileSync(EXECUTE_PHASE_SKILL_PATH, 'utf-8');
});

// ---- Task 02-02-01 (CMPLX-02): Adaptive plan depth routing ----

describe('plan-phase SKILL.md — adaptive plan depth routing (CMPLX-02)', () => {
  it('invokes classify-complexity CLI to determine complexity tier', () => {
    // The skill must call the classify-complexity command to auto-detect tier
    expect(planPhaseSkill).toContain('classify-complexity');
  });

  it('stores detected tier in COMPLEXITY_TIER variable', () => {
    // COMPLEXITY_TIER must be stored and referenced throughout the workflow
    expect(planPhaseSkill).toContain('COMPLEXITY_TIER');
  });

  it('planner receives Simple tier constraint: 1 plan with 1-3 tasks', () => {
    // The planner prompt must communicate Simple tier → 1 plan constraint
    expect(planPhaseSkill).toMatch(/Simple.*1 plan|Simple.*Create 1 plan/);
  });

  it('planner receives Medium tier constraint: 2-3 plans', () => {
    // The planner prompt must communicate Medium tier → 2-3 plans constraint
    expect(planPhaseSkill).toMatch(/Medium.*2.3 plan|Medium.*Create 2.3 plan/);
  });

  it('planner receives Complex tier constraint: 3+ plans', () => {
    // The planner prompt must communicate Complex tier → 3+ plans constraint
    expect(planPhaseSkill).toMatch(/Complex.*3\+ plan|Complex.*Create 3\+ plan/);
  });

  it('plan checker is skipped for Simple tier', () => {
    // Simple tasks must skip plan checking entirely
    expect(planPhaseSkill).toMatch(/Skip.*simple|simple.*skip plan check|Simple.*skip plan check/i);
  });

  it('plan checker has limited iterations (max 2) for Medium tier', () => {
    // Medium tier must limit checker to 2 iterations
    expect(planPhaseSkill).toMatch(/Medium.*max 2|max 2.*Medium|Medium.*2.*iter/i);
  });

  it('plan checker has max 3 iterations for Complex tier', () => {
    // Complex tier uses the default 3 checker iterations
    expect(planPhaseSkill).toMatch(/Complex.*max 3|max 3.*Complex|Complex.*3.*iter/i);
  });

  it('--complexity flag is listed in argument parsing (override support)', () => {
    // The --complexity override flag must be parseable from $ARGUMENTS
    expect(planPhaseSkill).toContain('--complexity');
  });

  it('backward compatibility: defaults to complex when classification unavailable', () => {
    // Must preserve existing behavior when no tier is available
    expect(planPhaseSkill).toMatch(/default.*complex|complex.*default|backward compat/i);
  });
});

// ---- Task 02-02-02 (CMPLX-03): Adaptive research depth ----

describe('plan-phase SKILL.md — adaptive research depth routing (CMPLX-03)', () => {
  it('Simple tier skips research entirely', () => {
    // Simple tier must not spawn any researcher
    expect(planPhaseSkill).toMatch(/simple.*skip research|Skipping research.*Simple|Simple tier.*skip/i);
  });

  it('Medium tier uses light research (single researcher with focused prompt)', () => {
    // Medium tier must spawn one researcher with a lighter prompt
    expect(planPhaseSkill).toMatch(/[Mm]edium.*light|[Ll]ight research.*[Mm]edium|[Mm]edium.*[Ss]ingle/);
  });

  it('Complex tier uses full research (unchanged behavior)', () => {
    // Complex tier must preserve full research behavior
    expect(planPhaseSkill).toMatch(/[Cc]omplex.*[Ff]ull research|[Ff]ull research.*[Cc]omplex/);
  });

  it('research routing table covers all three tiers in Step 5', () => {
    // Step 5 must have an explicit routing section addressing all three tiers
    const step5Section = planPhaseSkill.split('## 5. Handle Research')[1] ?? '';
    expect(step5Section).toContain('simple');
    expect(step5Section).toContain('medium');
    expect(step5Section).toContain('complex');
  });

  it('Medium tier light research skips architecture deep-dive and pitfalls', () => {
    // The skill must specify what Medium research omits
    expect(planPhaseSkill).toMatch(/architecture deep.dive|pitfalls|state.of.the.art/i);
  });

  it('Medium tier light research focuses on standard stack and key patterns', () => {
    // The skill must specify the focused scope of Medium research
    expect(planPhaseSkill).toMatch(/standard stack|key patterns/i);
  });
});

// ---- execute-phase SKILL.md — complexity tier display ----

describe('execute-phase SKILL.md — complexity tier display in banner', () => {
  it('displays Complexity field in the execution banner', () => {
    // The banner must include complexity tier information
    expect(executePhaseSkill).toMatch(/Complexity.*COMPLEXITY_TIER|Complexity.*not classified/);
  });

  it('reads complexity_tier from PLAN.md frontmatter', () => {
    // Tier must be sourced from the frontmatter field written during planning
    expect(executePhaseSkill).toContain('complexity_tier');
  });
});
