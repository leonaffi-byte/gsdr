---
phase: 4
slug: dependency-graph-engine
status: green
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
updated: 2026-03-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | vitest.config implied (package.json `vitest run`) |
| **Quick run command** | `npx vitest run tests/dependency-graph.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dependency-graph.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PARA-01..06 | unit | `npx vitest run tests/dependency-graph.test.ts` | No (W0) | pending |
| 04-01-02 | 01 | 1 | PARA-01, PARA-03 | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-01"` | No (W0) | pending |
| 04-01-03 | 01 | 1 | PARA-02, PARA-05, PARA-06 | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-0[256]"` | No (W0) | pending |
| 04-01-04 | 01 | 1 | PARA-01 | integration | `npx vitest run tests/dependency-graph.test.ts` | No (W0) | pending |
| 04-02-01 | 02 | 2 | PARA-03 | integration | `npx vitest run tests/cross-phase-routing.test.ts` | Yes | green |
| 04-02-02 | 02 | 2 | PARA-04 | integration | `npx vitest run tests/cross-phase-routing.test.ts` | Yes | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `tests/dependency-graph.test.ts` — stubs for PARA-01 through PARA-06
- [x] `tests/cross-phase-routing.test.ts` — content assertions for PARA-03 and PARA-04 skill wiring
- [x] Test fixtures: mock ROADMAP.md content, mock plan frontmatter with files_modified

*All wave 0 test files exist and pass.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent concurrency limits in Claude Code | PARA-05 | Exact limits vary by environment | Run multi-phase execution and observe agent spawn behavior |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — all 22 cross-phase-routing tests pass, all 04-01 dependency-graph tests pass
