---
phase: 1
slug: foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
validated: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts (Wave 0 — needs creation) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsdr:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUND-01 | unit | `npx vitest run tests/no-multi-runtime.test.ts -x` | ✅ | ✅ green (6 tests) |
| 01-01-02 | 01 | 1 | FOUND-02 | integration | `npx vitest run tests/build.test.ts -x` | ✅ | ✅ green (5 tests) |
| 01-01-03 | 01 | 1 | FOUND-03 | unit | `npx vitest run tests/plugin-structure.test.ts -x` | ✅ | ✅ green (10 tests) |
| 01-02-01 | 02 | 1 | FOUND-04 | unit | `npx vitest run tests/context-engineering.test.ts -x` | ✅ | ✅ green (4 tests) |
| 01-02-02 | 02 | 1 | FOUND-05 | unit | `npx vitest run tests/plan-format.test.ts -x` | ✅ | ✅ green (5 tests) |
| 01-02-03 | 02 | 1 | FOUND-06 | unit | `npx vitest run tests/git-commits.test.ts -x` | ✅ | ✅ green (4 tests) |
| 01-03-01 | 03 | 2 | FOUND-07 | unit | `npx vitest run tests/state.test.ts -x` | ✅ | ✅ green (3 tests) |
| 01-03-02 | 03 | 2 | FOUND-08 | unit | `npx vitest run tests/package.test.ts -x` | ✅ | ✅ green (3 tests) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` — test framework configuration
- [x] `tests/no-multi-runtime.test.ts` — FOUND-01 (6 tests, green)
- [x] `tests/build.test.ts` — FOUND-02 (5 tests, green)
- [x] `tests/plugin-structure.test.ts` — FOUND-03 (10 tests, green)
- [x] `tests/context-engineering.test.ts` — FOUND-04 (4 tests, green)
- [x] `tests/plan-format.test.ts` — FOUND-05 (5 tests, green)
- [x] `tests/git-commits.test.ts` — FOUND-06 (4 tests, green)
- [x] `tests/state.test.ts` — FOUND-07 (3 tests, green)
- [x] `tests/package.test.ts` — FOUND-08 (3 tests, green)
- [x] Framework install: vitest 3.x installed and configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx gsdr@latest` installs and registers plugin | FOUND-08 | Requires npm publish + clean environment | 1. Publish to npm 2. Run npx in fresh dir 3. Verify ~/.claude/ plugin files |
| Sub-agents get fresh 200K context | FOUND-04 | Requires Claude Code runtime | 1. Run a plan with sub-agents 2. Verify context window usage in logs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s (measured: ~1.35s for 8 files)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (all already covered) |
| Escalated | 0 |
| Total tests | 40 across 8 files |
| Runtime | 1.35s |

All 8 requirement test files existed and passed before audit. No new tests needed.
