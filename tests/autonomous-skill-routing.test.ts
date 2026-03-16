/**
 * Tests for autonomous execution wiring in execute-phase SKILL.md
 * Covers Task 05-02-01 (AUTO-04, AUTO-05, AUTO-06, AUTO-07),
 *         Task 05-02-02 (AUTO-08),
 *         Task 05-02-03 (AUTO-09)
 *
 * Pattern: content-based assertions on SKILL.md (same as complexity-routing.test.ts)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const EXECUTE_PHASE_SKILL_PATH = resolve(__dirname, '../skills/execute-phase/SKILL.md');

let skill: string;

beforeAll(() => {
  skill = readFileSync(EXECUTE_PHASE_SKILL_PATH, 'utf-8');
});

// ---- Task 05-02-01 (AUTO-04, AUTO-05, AUTO-06, AUTO-07): Auto-fix loop wiring ----

describe('execute-phase SKILL.md — auto_fix_loop step (AUTO-04, AUTO-05, AUTO-06, AUTO-07)', () => {
  it('contains an auto_fix_loop step section', () => {
    // AUTO-05: the skill must contain a named auto_fix_loop step/section
    expect(skill).toContain('auto_fix_loop');
  });

  it('auto_fix_loop step definition is positioned after execute_waves step and before checkpoint_handling step', () => {
    // Verify structural ordering by finding the <step name="..."> definitions
    const executeWavesStep = skill.indexOf('<step name="execute_waves">');
    const autoFixStep = skill.indexOf('<step name="auto_fix_loop">');
    const checkpointStep = skill.indexOf('<step name="checkpoint_handling">');
    expect(executeWavesStep).toBeGreaterThan(-1);
    expect(autoFixStep).toBeGreaterThan(executeWavesStep);
    expect(checkpointStep).toBeGreaterThan(autoFixStep);
  });

  it('spawns gsdr-debugger before retrying — no blind re-run (AUTO-05)', () => {
    // The skill must reference the debugger agent for diagnosis before executor retry
    expect(skill).toContain('gsdr-debugger');
  });

  it('debugger is spawned with find_root_cause_only goal (AUTO-05)', () => {
    // The debugger goal must be explicit — find root cause only, not full fix
    expect(skill).toContain('find_root_cause_only');
  });

  it('retry loop is capped at 3 attempts (AUTO-05)', () => {
    // Must document a maximum of 3 retry attempts per failure
    expect(skill).toMatch(/3 attempt|max 3|attempt = 1 to 3|For attempt = 1 to 3/i);
  });

  it('uses is-non-improving or equivalent for strike detection (AUTO-06)', () => {
    // AUTO-06: 2-strike halt — skill must reference the non-improving check
    expect(skill).toMatch(/is-non-improving|isNonImproving|IS_STRIKE/);
  });

  it('halts after 2 consecutive non-improving attempts — 2-strike rule (AUTO-06)', () => {
    // Must document the 2-strike halt condition explicitly
    expect(skill).toMatch(/strike_count >= 2|2.strike|two.strike|2 consecutive/i);
  });

  it('writes failure entries to FAILURES.md via append-failure or equivalent (AUTO-07)', () => {
    // AUTO-07: FAILURES.md must be written by the orchestrator
    expect(skill).toContain('FAILURES.md');
    expect(skill).toMatch(/append-failure|appendFailure/);
  });

  it('independent tasks continue executing after a halt — do not stop everything (AUTO-07)', () => {
    // After 2-strike halt, independent (non-dependent) tasks must continue
    expect(skill).toMatch(/independent task|halted_plans|continue executing independent/i);
  });

  it('dependent tasks are skipped when upstream is halted (AUTO-07)', () => {
    // Dependents of a halted plan must be skipped with skipped_upstream_failure
    expect(skill).toContain('skipped_upstream_failure');
  });

  it('routes to auto_fix_loop when auto_advance is active and a plan fails (AUTO-04)', () => {
    // AUTO-04: the routing decision point must reference auto_advance
    expect(skill).toMatch(/auto_fix_loop.*auto_advance|auto_advance.*auto_fix_loop|route.*auto_fix_loop/i);
  });

  it('verification is unconditional — not gated by auto_advance (AUTO-04)', () => {
    // AUTO-04: explicit note that verification always runs regardless of auto_advance
    expect(skill).toMatch(/ALWAYS runs|unconditional|not gated by auto_advance/i);
  });
});

// ---- Task 05-02-02 (AUTO-08): End-of-run report wiring ----

describe('execute-phase SKILL.md — end-of-run report generation (AUTO-08)', () => {
  it('contains end-of-run report generation logic', () => {
    // AUTO-08: the skill must generate an end-of-run report
    expect(skill).toMatch(/END-OF-RUN-REPORT|end-of-run report/i);
  });

  it('invokes generate-report CLI command or equivalent', () => {
    // Must call the CLI to produce the report deterministically
    expect(skill).toMatch(/generate-report|generateEndOfRunReport/);
  });

  it('report is written to .planning/END-OF-RUN-REPORT.md', () => {
    // The output path must be explicitly specified
    expect(skill).toContain('END-OF-RUN-REPORT.md');
  });

  it('report is only generated at chain/milestone completion — not single manual phase (AUTO-08)', () => {
    // Must explicitly document the trigger condition
    expect(skill).toMatch(/is_last_phase|last phase|milestone.*complet|--milestone.*all batches/i);
  });

  it('single manual phase execution does NOT trigger the report', () => {
    // Must explicitly exclude single manual phase runs
    expect(skill).toMatch(/NOT for single manual|single manual phase.*sufficient/i);
  });
});

// ---- Task 05-02-03 (AUTO-09): Irreversible action gate wiring ----

describe('execute-phase SKILL.md — irreversible action gate (AUTO-09)', () => {
  it('scans for irreversible actions before spawning the executor', () => {
    // AUTO-09: the gate must fire before the executor agent is spawned
    expect(skill).toMatch(/irreversible.*before spawning|before spawning.*executor|Irreversible action gate \(before spawning\)/i);
  });

  it('invokes check-irreversible CLI or equivalent', () => {
    // The check must be deterministic via CLI
    expect(skill).toMatch(/check-irreversible|checkIrreversibleAction/);
  });

  it('gate prompts user regardless of auto_advance setting (AUTO-09)', () => {
    // Must be explicit that auto_advance does NOT bypass this gate
    expect(skill).toMatch(/REGARDLESS of auto_advance|regardless of auto_advance|regardless of autonomy mode/i);
  });

  it('gate is absolute — no bypass path exists', () => {
    // The gate must document that it cannot be bypassed by any flag or config
    expect(skill).toMatch(/ALWAYS prompt|always prompt|no.*bypass|absolute/i);
  });

  it('uses the check-irreversible CLI which provides default patterns (no inline pattern list needed)', () => {
    // Patterns are encapsulated in the CLI tool — the skill delegates to check-irreversible,
    // which reads the default reference patterns internally
    expect(skill).toMatch(/check-irreversible|autonomous check-irreversible/);
  });

  it('supports pre_approved_actions from config to filter known safe actions', () => {
    // Must support a pre-approval bypass for known safe irreversible commands
    expect(skill).toContain('pre_approved_actions');
  });
});
