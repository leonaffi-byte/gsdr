---
phase: 2
slug: complexity-calibration
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
validated: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | vitest.config.ts (exists from Phase 1) |
| **Quick run command** | `npx vitest run tests/complexity.test.ts tests/complexity-routing.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/complexity.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsdr:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CMPLX-01 | unit | `npx vitest run tests/complexity.test.ts -t "COMPLEXITY_TIERS"` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | CMPLX-01 | unit | `npx vitest run tests/complexity.test.ts -t "CLASSIFIER_PROMPT"` | ✅ | ✅ green |
| 02-01-03 | 01 | 1 | CMPLX-04 | unit | `npx vitest run tests/complexity.test.ts -t "override"` | ✅ | ✅ green |
| 02-02-01 | 02 | 2 | CMPLX-02 | unit | `npx vitest run tests/complexity-routing.test.ts -t "adaptive plan depth routing"` | ✅ | ✅ green |
| 02-02-02 | 02 | 2 | CMPLX-03 | unit | `npx vitest run tests/complexity-routing.test.ts -t "adaptive research depth routing"` | ✅ | ✅ green |
| 02-02-03 | 02 | 2 | CMPLX-01 | integration | `npx vitest run tests/complexity.test.ts -t "LABELED_TEST_CASES"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/complexity.test.ts` — covers CMPLX-01 through CMPLX-04, includes 20 labeled test cases (29 tests)
- [x] `tests/complexity-routing.test.ts` — covers CMPLX-02 and CMPLX-03 skill workflow routing (18 tests)
- [x] `src/lib/complexity.ts` — classifier module with ComplexityResult type, COMPLEXITY_TIERS config, classify function

*Framework already installed from Phase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Classification quality on real projects | CMPLX-01 | LLM output varies; labeled test cases are deterministic proxies | Run classifier on 5 real project descriptions, verify tier feels right |

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
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Tests added:** `tests/complexity-routing.test.ts` (18 tests)
- 10 tests for CMPLX-02 (plan depth routing in plan-phase SKILL.md)
- 6 tests for CMPLX-03 (research depth routing in plan-phase SKILL.md)
- 2 tests for execute-phase complexity tier display
