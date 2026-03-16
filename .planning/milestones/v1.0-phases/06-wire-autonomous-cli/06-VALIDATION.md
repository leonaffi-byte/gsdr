---
phase: 6
slug: wire-autonomous-cli
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
validated: 2026-03-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | package.json `scripts.test` |
| **Quick run command** | `npx vitest run tests/autonomous-execution.test.ts tests/autonomous-cli-wiring.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AUTO-05 | integration | `npx vitest run tests/autonomous-execution.test.ts -t "appendFailure"` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | AUTO-06 | integration | `npx vitest run tests/autonomous-execution.test.ts -t "isNonImproving"` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | AUTO-07 | integration | `npx vitest run tests/autonomous-execution.test.ts -t "readFailures"` | ✅ | ✅ green |
| 06-01-04 | 01 | 1 | AUTO-08 | integration | `npx vitest run tests/autonomous-execution.test.ts -t "generateEndOfRunReport"` | ✅ | ✅ green |
| 06-01-05 | 01 | 1 | AUTO-09 | integration | `npx vitest run tests/autonomous-execution.test.ts -t "checkIrreversibleAction"` | ✅ | ✅ green |
| 06-01-* | 01 | 1 | AUTO-05..09 | integration | `npx vitest run tests/autonomous-cli-wiring.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/autonomous-execution.test.ts` — 32 tests covering pure function logic
- [x] `tests/build.test.ts` — verifies autonomous module included in CJS bundle
- [x] `tests/autonomous-cli-wiring.test.ts` — 13 tests verifying all 7 CLI subcommands invoked in execute-phase SKILL.md

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| execute-phase uses CLI commands instead of prose re-implementation | AUTO-05..09 | Requires inspecting SKILL.md content | Review execute-phase SKILL.md for `autonomous` CLI invocations |

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
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Tests added:** `tests/autonomous-cli-wiring.test.ts` (13 tests)
- All 7 autonomous CLI subcommands referenced in execute-phase SKILL.md
- Correct placement in auto_fix_loop, irreversible gate, and offer_next steps
