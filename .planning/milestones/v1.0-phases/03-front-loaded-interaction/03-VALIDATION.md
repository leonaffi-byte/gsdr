---
phase: 03
slug: front-loaded-interaction
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
validated: 2026-03-16
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | vitest inferred from package.json |
| **Quick run command** | `npx vitest run tests/auto-advance.test.ts tests/upfront-session.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | AUTO-03 | unit | `npx vitest run tests/auto-advance.test.ts` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | AUTO-03 | unit | `npx vitest run tests/auto-advance.test.ts` | ✅ | ✅ green |
| 03-02-01 | 02 | 1 | AUTO-01, AUTO-02 | integration | `npx vitest run tests/upfront-session.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/auto-advance.test.ts` — covers AUTO-03: config default, gate auto-approve, plan-checker auto-retry (5 tests)
- [x] `tests/upfront-session.test.ts` — covers AUTO-01, AUTO-02: upfront session, preliminary analysis, auto-resume (11 tests)

*Existing infrastructure covers test framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upfront session UX flow | AUTO-01 | Interactive AskUserQuestion flow | Run /gsd:new-project, verify all phase questions asked in sequence |
| Preliminary analysis visibility | AUTO-02 | Visual progress indicators | Run new-project on brownfield project, verify analysis summary shown |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-03-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All tasks already had automated test coverage from execution.
