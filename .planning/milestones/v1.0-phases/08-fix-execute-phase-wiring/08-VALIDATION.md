---
phase: 8
slug: fix-execute-phase-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/execute-phase-wiring.test.ts --reporter verbose` |
| **Full suite command** | `npx vitest run --reporter verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/execute-phase-wiring.test.ts --reporter verbose`
- **After every plan wave:** Run `npx vitest run --reporter verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | AUTO-08 | SKILL.md content check | `npx vitest run tests/execute-phase-wiring.test.ts -t "milestone"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | FOUND-03 | file existence | `npx vitest run tests/execute-phase-wiring.test.ts -t "plugin root"` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | AUTO-04, FOUND-04 | content verification | `npx vitest run tests/execute-phase-wiring.test.ts -t "execute-plan"` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | AUTO-03 | content verification | `npx vitest run tests/execute-phase-wiring.test.ts -t "transition"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/execute-phase-wiring.test.ts` — stubs for AUTO-03, AUTO-04, AUTO-08, FOUND-03, FOUND-04 (file existence, content verification, reference correctness)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-advance chain propagates end-to-end | AUTO-03 | Requires multi-phase execution | Run `/gsd:execute-phase 8 --auto` and verify next phase triggers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
