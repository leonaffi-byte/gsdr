/**
 * Tests for the autonomous execution library (autonomous.ts)
 * Covers AUTO-05 through AUTO-09
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  normalizeErrorSignature,
  appendFailure,
  readFailures,
  updateFailureStatus,
  isNonImproving,
  checkIrreversibleAction,
  generateEndOfRunReport,
  type FailureEntry,
  type AttemptRecord,
} from '../src/lib/autonomous';

// ---- Test Helpers ----

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsdr-auto-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---- AUTO-05: Error Signature Normalization ----

describe('normalizeErrorSignature', () => {
  it('strips line:col numbers', () => {
    const input = 'Error at file.ts:42:10';
    const normalized = normalizeErrorSignature(input);
    expect(normalized).toContain(':LINE:COL');
    expect(normalized).not.toMatch(/:\d+:\d+/);
  });

  it('strips stack trace frames', () => {
    const input = 'at myFunction (/Users/dev/project/src/file.ts:10:5)';
    const normalized = normalizeErrorSignature(input);
    expect(normalized).toContain('at STACK');
    expect(normalized).not.toContain('myFunction');
  });

  it('strips file paths', () => {
    const input = 'Error in /Users/foo/project/src/bar.ts';
    const normalized = normalizeErrorSignature(input);
    expect(normalized).toContain('FILE');
    expect(normalized).not.toContain('/Users/foo');
  });

  it('strips ISO timestamps', () => {
    const input = 'Error occurred at 2026-03-16T10:30:00Z';
    const normalized = normalizeErrorSignature(input);
    expect(normalized).toContain('TIMESTAMP');
    expect(normalized).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('strips hex addresses', () => {
    const input = 'Segfault at 0x1a2b3c4d';
    const normalized = normalizeErrorSignature(input);
    expect(normalized).toContain('ADDR');
    expect(normalized).not.toMatch(/0x[0-9a-f]+/i);
  });

  it('trims whitespace', () => {
    const input = '  some error  ';
    const normalized = normalizeErrorSignature(input);
    expect(normalized).toBe('some error');
  });

  it('produces identical signatures for same root cause with different line numbers', () => {
    const error1 = "TypeError: Cannot read property 'foo' of undefined at /Users/dev/app/src/handler.ts:42:10";
    const error2 = "TypeError: Cannot read property 'foo' of undefined at /Users/dev/app/src/handler.ts:99:3";
    expect(normalizeErrorSignature(error1)).toBe(normalizeErrorSignature(error2));
  });

  it('produces different signatures for genuinely different errors', () => {
    const error1 = 'TypeError: Cannot read property of undefined';
    const error2 = 'ReferenceError: x is not defined';
    expect(normalizeErrorSignature(error1)).not.toBe(normalizeErrorSignature(error2));
  });
});

// ---- AUTO-05: FAILURES.md CRUD ----

describe('appendFailure', () => {
  it('creates FAILURES.md with YAML frontmatter on first failure', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    const entry: FailureEntry = {
      plan_id: '03-01',
      status: 'active',
      error_signature: 'TypeError: Cannot read property of undefined',
      attempts: [{
        attempt: 1,
        timestamp: '2026-03-16T10:00:00Z',
        error: 'TypeError: Cannot read property of undefined',
        diagnosis: 'Missing null check',
        solution_tried: 'Added null guard',
        result: 'same_error',
      }],
      strike_count: 0,
    };
    appendFailure(failuresPath, entry);

    const content = fs.readFileSync(failuresPath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('total_failures: 1');
    expect(content).toContain('## 03-01');
    expect(content).toContain('status: active');
  });

  it('appends to existing FAILURES.md and updates counts', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    const entry1: FailureEntry = {
      plan_id: '03-01',
      status: 'active',
      error_signature: 'Error A',
      attempts: [],
      strike_count: 0,
    };
    const entry2: FailureEntry = {
      plan_id: '03-02',
      status: 'active',
      error_signature: 'Error B',
      attempts: [],
      strike_count: 0,
    };
    appendFailure(failuresPath, entry1);
    appendFailure(failuresPath, entry2);

    const content = fs.readFileSync(failuresPath, 'utf-8');
    expect(content).toContain('total_failures: 2');
    expect(content).toContain('## 03-01');
    expect(content).toContain('## 03-02');
  });
});

describe('readFailures', () => {
  it('returns empty entries when file does not exist', () => {
    const failuresPath = path.join(tmpDir, 'nonexistent.md');
    const result = readFailures(failuresPath);
    expect(result.entries).toEqual([]);
    expect(result.frontmatter).toBeDefined();
  });

  it('parses FAILURES.md frontmatter and entries', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    const entry: FailureEntry = {
      plan_id: '04-01',
      status: 'halted',
      error_signature: 'Module not found',
      attempts: [{
        attempt: 1,
        timestamp: '2026-03-16T10:00:00Z',
        error: 'Module not found: @/components/Chart',
        diagnosis: 'Component never created',
        solution_tried: 'Created stub',
        result: 'same_error',
      }],
      strike_count: 2,
      halted_reason: '2 consecutive non-improving attempts',
    };
    appendFailure(failuresPath, entry);

    const result = readFailures(failuresPath);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].plan_id).toBe('04-01');
    expect(result.entries[0].status).toBe('halted');
    expect(result.entries[0].strike_count).toBe(2);
  });

  it('handles malformed entries gracefully', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    fs.writeFileSync(failuresPath, `---
created: 2026-03-16T10:00:00Z
total_failures: 1
---

# Failure Log

## malformed-entry
this is not valid yaml-like content
just some random text
`, 'utf-8');

    // Should not throw
    const result = readFailures(failuresPath);
    expect(result.frontmatter).toBeDefined();
    // Malformed entry is skipped or partially parsed, not crashing
  });
});

describe('updateFailureStatus', () => {
  it('updates status of an existing entry', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    const entry: FailureEntry = {
      plan_id: '03-01',
      status: 'active',
      error_signature: 'Error A',
      attempts: [],
      strike_count: 0,
    };
    appendFailure(failuresPath, entry);
    updateFailureStatus(failuresPath, '03-01', 'resolved');

    const result = readFailures(failuresPath);
    expect(result.entries[0].status).toBe('resolved');
  });

  it('appends attempt record when provided', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    const entry: FailureEntry = {
      plan_id: '03-01',
      status: 'active',
      error_signature: 'Error A',
      attempts: [],
      strike_count: 0,
    };
    appendFailure(failuresPath, entry);

    const attempt: AttemptRecord = {
      attempt: 1,
      timestamp: '2026-03-16T10:05:00Z',
      error: 'Error A',
      diagnosis: 'Found root cause',
      solution_tried: 'Applied fix',
      result: 'resolved',
    };
    updateFailureStatus(failuresPath, '03-01', 'resolved', attempt);

    const result = readFailures(failuresPath);
    expect(result.entries[0].attempts).toHaveLength(1);
    expect(result.entries[0].attempts[0].result).toBe('resolved');
  });

  it('recalculates frontmatter counts after status update', () => {
    const failuresPath = path.join(tmpDir, 'FAILURES.md');
    appendFailure(failuresPath, {
      plan_id: '03-01',
      status: 'active',
      error_signature: 'Error A',
      attempts: [],
      strike_count: 0,
    });
    appendFailure(failuresPath, {
      plan_id: '03-02',
      status: 'active',
      error_signature: 'Error B',
      attempts: [],
      strike_count: 0,
    });
    updateFailureStatus(failuresPath, '03-01', 'resolved');

    const content = fs.readFileSync(failuresPath, 'utf-8');
    expect(content).toContain('resolved: 1');
  });
});

// ---- AUTO-06: Strike Detection ----

describe('isNonImproving', () => {
  const basePrev: AttemptRecord = {
    attempt: 1,
    timestamp: '2026-03-16T10:00:00Z',
    error: 'Error A',
    diagnosis: 'Cause A',
    solution_tried: 'Fix A',
    result: 'same_error',
  };

  it('returns true when normalized error signatures match (same_error)', () => {
    const curr: AttemptRecord = { ...basePrev, attempt: 2, result: 'same_error' };
    expect(isNonImproving(basePrev, curr, 'normalized_sig', 'normalized_sig')).toBe(true);
  });

  it('returns true when result is no_improvement even with different signature', () => {
    const curr: AttemptRecord = { ...basePrev, attempt: 2, result: 'no_improvement' };
    expect(isNonImproving(basePrev, curr, 'sig_a', 'sig_b')).toBe(true);
  });

  it('returns false when error signature changed AND result indicates improvement', () => {
    const curr: AttemptRecord = { ...basePrev, attempt: 2, result: 'new_error' };
    expect(isNonImproving(basePrev, curr, 'sig_a', 'sig_b')).toBe(false);
  });

  it('returns false when result is resolved', () => {
    const curr: AttemptRecord = { ...basePrev, attempt: 2, result: 'resolved' };
    expect(isNonImproving(basePrev, curr, 'sig_a', 'sig_b')).toBe(false);
  });
});

// ---- AUTO-09: Irreversible Action Detection ----

describe('checkIrreversibleAction', () => {
  const defaultPatterns = [
    'git push --force',
    'git push -f',
    'git reset --hard',
    'npm publish',
    'DROP TABLE',
    'rm -rf /',
    'git clean -f',
    'git branch -D',
    'docker system prune',
    'kubectl delete',
  ];

  it('matches git push --force', () => {
    const result = checkIrreversibleAction('git push --force origin main', defaultPatterns);
    expect(result.matched).toBe(true);
    expect(result.matches).toContain('git push --force');
  });

  it('matches git push -f', () => {
    const result = checkIrreversibleAction('git push -f origin main', defaultPatterns);
    expect(result.matched).toBe(true);
  });

  it('matches npm publish', () => {
    const result = checkIrreversibleAction('npm publish --access public', defaultPatterns);
    expect(result.matched).toBe(true);
  });

  it('matches DROP TABLE case-insensitively', () => {
    const result = checkIrreversibleAction('drop table users;', defaultPatterns);
    expect(result.matched).toBe(true);
  });

  it('does NOT match patterns inside code comments', () => {
    const result = checkIrreversibleAction('// git push --force is dangerous', defaultPatterns);
    expect(result.matched).toBe(false);
  });

  it('does NOT match patterns inside string literals in test assertions', () => {
    const result = checkIrreversibleAction("expect(cmd).toBe('git push --force')", defaultPatterns);
    expect(result.matched).toBe(false);
  });

  it('merges configOverrides with defaults (extends, not replaces)', () => {
    const overrides = ['terraform destroy'];
    const result = checkIrreversibleAction('terraform destroy -auto-approve', defaultPatterns, overrides);
    expect(result.matched).toBe(true);
    expect(result.matches).toContain('terraform destroy');
  });

  it('returns matched: false for safe commands', () => {
    const result = checkIrreversibleAction('git push origin main', defaultPatterns);
    expect(result.matched).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it('matches multiple patterns in same content', () => {
    const result = checkIrreversibleAction('git push --force origin main\nnpm publish', defaultPatterns);
    expect(result.matched).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ---- AUTO-08: End-of-Run Report ----

describe('generateEndOfRunReport', () => {
  it('produces markdown report with all required sections', () => {
    // Set up a mock .planning structure
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    const phase1Dir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phase1Dir, { recursive: true });

    // Create a SUMMARY.md
    fs.writeFileSync(path.join(phase1Dir, '01-01-SUMMARY.md'), `---
phase: 01
plan: 01
subsystem: foundation
tags: [core]
completed: 2026-03-16
---

# Phase 01 Plan 01: Foundation Summary

Built the core module.
`, 'utf-8');

    // Create a PLAN.md so phase counts work
    fs.writeFileSync(path.join(phase1Dir, '01-01-PLAN.md'), `---
phase: 01
plan: 01
---
`, 'utf-8');

    const report = generateEndOfRunReport(tmpDir, 'v1.0');
    expect(report).toContain('# GSDR End-of-Run Report');
    expect(report).toContain('v1.0');
    expect(report).toContain('What Was Built');
    expect(report).toContain('What Was Verified');
    expect(report).toContain('What Was Auto-Fixed');
    expect(report).toContain('What Needs Human Attention');
    expect(report).toContain('Summary');
  });

  it('includes auto-fixed items from resolved FAILURES.md entries', () => {
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    const failuresPath = path.join(planningDir, 'FAILURES.md');
    appendFailure(failuresPath, {
      plan_id: '03-01',
      status: 'resolved',
      error_signature: 'TypeError fix',
      attempts: [{
        attempt: 1,
        timestamp: '2026-03-16T10:00:00Z',
        error: 'TypeError',
        diagnosis: 'Missing import',
        solution_tried: 'Added import',
        result: 'resolved',
      }],
      strike_count: 0,
    });

    const report = generateEndOfRunReport(tmpDir, 'v1.0');
    expect(report).toContain('03-01');
    expect(report).toContain('resolved');
  });

  it('includes halted/skipped items in needs-attention section', () => {
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    const failuresPath = path.join(planningDir, 'FAILURES.md');
    appendFailure(failuresPath, {
      plan_id: '04-01',
      status: 'halted',
      error_signature: 'Module not found',
      attempts: [],
      strike_count: 2,
      halted_reason: '2 consecutive non-improving attempts',
    });
    appendFailure(failuresPath, {
      plan_id: '04-02',
      status: 'skipped_upstream_failure',
      error_signature: '',
      attempts: [],
      strike_count: 0,
      blocked_by: '04-01',
    });

    const report = generateEndOfRunReport(tmpDir, 'v1.0');
    expect(report).toContain('04-01');
    expect(report).toContain('halted');
    expect(report).toContain('04-02');
    expect(report).toContain('skipped');
  });
});
