---
phase: 5
slug: autonomous-execution
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
validated: 2026-03-16
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | package.json `scripts.test` -> `vitest run` |
| **Quick run command** | `npx vitest run tests/autonomous-execution.test.ts tests/autonomous-skill-routing.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/autonomous-execution.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | AUTO-04..09 | unit | `npx vitest run tests/autonomous-execution.test.ts` | ✅ | ✅ green |
| 05-01-02 | 01 | 1 | AUTO-04 | unit | `npx vitest run tests/autonomous-execution.test.ts -t "normalizeErrorSignature"` | ✅ | ✅ green |
| 05-01-03 | 01 | 1 | AUTO-05, AUTO-06 | unit | `npx vitest run tests/autonomous-execution.test.ts -t "appendFailure\|isNonImproving"` | ✅ | ✅ green |
| 05-01-04 | 01 | 1 | AUTO-07 | unit | `npx vitest run tests/autonomous-execution.test.ts -t "readFailures"` | ✅ | ✅ green |
| 05-01-05 | 01 | 1 | AUTO-08 | unit | `npx vitest run tests/autonomous-execution.test.ts -t "generateEndOfRunReport"` | ✅ | ✅ green |
| 05-01-06 | 01 | 1 | AUTO-09 | unit | `npx vitest run tests/autonomous-execution.test.ts -t "checkIrreversibleAction"` | ✅ | ✅ green |
| 05-02-01 | 02 | 2 | AUTO-04..07 | integration | `npx vitest run tests/autonomous-skill-routing.test.ts -t "auto-fix loop"` | ✅ | ✅ green |
| 05-02-02 | 02 | 2 | AUTO-08 | integration | `npx vitest run tests/autonomous-skill-routing.test.ts -t "end-of-run report"` | ✅ | ✅ green |
| 05-02-03 | 02 | 2 | AUTO-09 | integration | `npx vitest run tests/autonomous-skill-routing.test.ts -t "irreversible action gate"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/autonomous-execution.test.ts` — 32 tests covering all 6 pure functions (AUTO-04..09)
- [x] `tests/autonomous-skill-routing.test.ts` — 23 tests covering skill wiring (auto-fix loop, end-of-run, irreversible gate)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Irreversible action gate prompts user | AUTO-09 | Requires interactive confirmation | Run execution with irreversible action in plan, verify prompt appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-03-16

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

**Tests added:** `tests/autonomous-skill-routing.test.ts` (23 tests)
- Auto-fix loop wiring in execute-phase SKILL.md (AUTO-04..07)
- End-of-run report wiring (AUTO-08)
- Irreversible action gate (AUTO-09)
