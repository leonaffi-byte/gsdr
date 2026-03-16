import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read execute-phase SKILL.md once for all tests (same pattern as complexity-routing.test.ts)
const EXECUTE_PHASE_SKILL_PATH = resolve(__dirname, '../skills/execute-phase/SKILL.md');

let skill: string;

beforeAll(() => {
  skill = readFileSync(EXECUTE_PHASE_SKILL_PATH, 'utf-8');
});

// ---- Task 06-01-* (AUTO-05..09): autonomous CLI wiring in execute-phase SKILL.md ----

describe('execute-phase SKILL.md — autonomous CLI wiring (AUTO-05..09)', () => {

  // AUTO-05: Error normalization
  it('execute-phase invokes autonomous normalize-error to produce stable error signatures', () => {
    expect(skill).toContain('autonomous normalize-error');
  });

  // AUTO-05: FAILURES.md tracking via append-failure
  it('execute-phase invokes autonomous append-failure to record failures', () => {
    expect(skill).toContain('autonomous append-failure');
  });

  // AUTO-07: Reading failure state via read-failures
  it('execute-phase invokes autonomous read-failures to load FAILURES.md entries', () => {
    expect(skill).toContain('autonomous read-failures');
  });

  // AUTO-05/06: Updating failure status entries
  it('execute-phase invokes autonomous update-status to persist attempt results', () => {
    expect(skill).toContain('autonomous update-status');
  });

  // AUTO-06: Strike detection
  it('execute-phase invokes autonomous is-non-improving for strike detection', () => {
    expect(skill).toContain('autonomous is-non-improving');
  });

  // AUTO-09: Irreversible action gate
  it('execute-phase invokes autonomous check-irreversible before spawning executor agents', () => {
    expect(skill).toContain('autonomous check-irreversible');
  });

  // AUTO-08: End-of-run report generation
  it('execute-phase invokes autonomous generate-report to produce the end-of-run report', () => {
    expect(skill).toContain('autonomous generate-report');
  });

  // Volume check: SUMMARY says 13 invocations total
  it('execute-phase SKILL.md contains at least 10 autonomous CLI invocations total', () => {
    const matches = skill.match(/autonomous\s+(normalize-error|append-failure|read-failures|update-status|is-non-improving|check-irreversible|generate-report)/g);
    expect(matches).not.toBeNull();
    expect((matches ?? []).length).toBeGreaterThanOrEqual(10);
  });

  // Structural check: all 7 subcommands appear at least once
  it('all 7 autonomous subcommands appear in the skill', () => {
    const subcommands = [
      'normalize-error',
      'append-failure',
      'read-failures',
      'update-status',
      'is-non-improving',
      'check-irreversible',
      'generate-report',
    ];
    for (const cmd of subcommands) {
      expect(skill, `expected autonomous ${cmd} to appear in SKILL.md`).toContain(cmd);
    }
  });

  // Placement check: normalize-error appears in auto_fix_loop context (not just docs)
  it('normalize-error is invoked inside the auto_fix_loop step', () => {
    const fixLoopSection = skill.split('<step name="auto_fix_loop">')[1] ?? '';
    expect(fixLoopSection).toContain('autonomous normalize-error');
  });

  // Placement check: check-irreversible appears in execute_waves step
  it('check-irreversible is invoked inside the execute_waves step', () => {
    const wavesSection = skill.split('execute_waves')[1] ?? '';
    expect(wavesSection).toContain('autonomous check-irreversible');
  });

  // Placement check: generate-report appears in offer_next (end-of-auto-advance) step
  it('generate-report is invoked in the end-of-run report section', () => {
    const offerNextSection = skill.split('offer_next')[1] ?? '';
    expect(offerNextSection).toContain('autonomous generate-report');
  });

  // Placement check: read-failures appears in deferred task handling at end of auto_fix_loop
  it('read-failures is invoked for deferred task handling after all waves complete', () => {
    const fixLoopSection = skill.split('<step name="auto_fix_loop">')[1] ?? '';
    expect(fixLoopSection).toContain('autonomous read-failures');
  });
});
