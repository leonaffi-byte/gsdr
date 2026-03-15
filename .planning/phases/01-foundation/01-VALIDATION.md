---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
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
| 01-01-01 | 01 | 1 | FOUND-01 | unit | `npx vitest run tests/no-multi-runtime.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUND-02 | integration | `npx vitest run tests/build.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | FOUND-03 | unit | `npx vitest run tests/plugin-structure.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUND-04 | unit | `npx vitest run tests/context-engineering.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | FOUND-05 | unit | `npx vitest run tests/plan-format.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | FOUND-06 | unit | `npx vitest run tests/git-commits.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | FOUND-07 | unit | `npx vitest run tests/state.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | FOUND-08 | unit | `npx vitest run tests/package.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework configuration
- [ ] `tests/no-multi-runtime.test.ts` — stubs for FOUND-01
- [ ] `tests/build.test.ts` — stubs for FOUND-02
- [ ] `tests/plugin-structure.test.ts` — stubs for FOUND-03
- [ ] `tests/context-engineering.test.ts` — stubs for FOUND-04
- [ ] `tests/plan-format.test.ts` — stubs for FOUND-05
- [ ] `tests/git-commits.test.ts` — stubs for FOUND-06
- [ ] `tests/state.test.ts` — stubs for FOUND-07
- [ ] `tests/package.test.ts` — stubs for FOUND-08
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx gsdr@latest` installs and registers plugin | FOUND-08 | Requires npm publish + clean environment | 1. Publish to npm 2. Run npx in fresh dir 3. Verify ~/.claude/ plugin files |
| Sub-agents get fresh 200K context | FOUND-04 | Requires Claude Code runtime | 1. Run a plan with sub-agents 2. Verify context window usage in logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
