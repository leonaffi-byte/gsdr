---
phase: 7
slug: integration-polish
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
validated: 2026-03-16
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (bundled with project) |
| **Config file** | package.json `scripts.test` |
| **Quick run command** | `npx vitest run tests/integration-polish.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/integration-polish.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | CMPLX-02, CMPLX-03 | integration | `npx vitest run tests/integration-polish.test.ts -t "complexity_tier"` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | AUTO-05, AUTO-08 | unit | `npx vitest run tests/integration-polish.test.ts -t "FAILURES"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/integration-polish.test.ts` — 13 tests covering complexity_tier frontmatter injection and FAILURES.md template alignment

*Existing infrastructure (autonomous-execution tests) validates serialization format.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| complexity_tier in PLAN.md frontmatter | CMPLX-02 | Requires running plan-phase workflow | Run `/gsd:plan-phase` on a test phase, check frontmatter for `complexity_tier` field |
| execute-phase banner shows tier | CMPLX-03 | Requires running execute-phase workflow | Run `/gsd:execute-phase`, verify banner displays actual tier not "not classified" |

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

**Tests added:** `tests/integration-polish.test.ts` (13 tests)
- 7 tests for complexity_tier frontmatter injection (step 9.5, PLANNING COMPLETE guard, backward compat)
- 6 tests for FAILURES.md template heading alignment with serializeEntry()
