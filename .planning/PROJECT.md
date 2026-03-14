# GSDR (GSD Reloaded)

## What This Is

A fork of Get Shit Done (GSD) that prioritizes autonomous execution and smart complexity calibration. GSDR is a meta-prompting and context engineering system for Claude Code that front-loads all human interaction (10-15 minutes of questions), then runs fully autonomously through planning, execution, and self-verification — only returning to the user when the entire build is complete and verified.

## Core Value

After the initial questioning session, the system must run completely autonomously from planning through execution to verification — no human babysitting required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Fork GSD codebase and adapt for Claude Code-only distribution via npm
- [ ] Smart complexity auto-calibration: detect task complexity and scale planning depth accordingly (lightweight plans for simple tasks, full treatment for complex ones)
- [ ] Front-loaded interaction model: all questioning/discussion happens upfront, then fully autonomous execution
- [ ] Aggressive parallelism: plan all phases simultaneously, spawn more agents per stage, intelligently determine safe parallel execution paths
- [ ] Autonomous self-verification: verify results automatically, auto-fix failures and re-verify without human intervention
- [ ] End-of-run human verification: present completed work for user review only after everything is built and self-verified
- [ ] Prevent over-engineering: planner should not turn simple scripts into CLI tools or over-architect straightforward tasks

### Out of Scope

- Multi-runtime support (OpenCode, Gemini CLI, Codex) — Claude Code only
- Enterprise features (sprint ceremonies, story points, stakeholder syncs)
- Interactive per-phase approval gates during execution
- Manual step-by-step verification between phases

## Context

GSDR is a fork of github.com/gsd-build/get-shit-done. The original GSD is an effective spec-driven development system but has three pain points this project addresses:

1. **Over-engineering** — The planning phase sometimes turns simple tasks into overly complex architectures (e.g., wrapping a simple script as a full CLI tool). The planner needs intelligence to match plan complexity to task complexity.

2. **Too much babysitting** — GSD requires human presence at multiple checkpoints: discuss phase, approve plan, approve roadmap, verify each phase. GSDR consolidates all human interaction upfront and runs autonomously after that.

3. **Underutilized parallelism** — GSD runs phases sequentially and only parallelizes plans within a single phase. GSDR should plan all phases in parallel, use more agents within each stage, and build a dependency graph to maximize safe concurrent execution.

The original GSD structure: `agents/`, `bin/`, `commands/`, `hooks/`, `docs/`, `get-shit-done/` (core), `scripts/`, `tests/`. Distributed as npm package `get-shit-done-cc`.

## Constraints

- **Runtime**: Claude Code only — no need for multi-runtime abstraction layers
- **Distribution**: npm package (npx gsdr@latest or similar)
- **Base**: Fork of GSD — preserve what works, modify what doesn't
- **Philosophy**: Complexity belongs in the system, not the user's workflow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork GSD rather than build from scratch | Preserves proven patterns (context engineering, XML plans, atomic commits) while allowing targeted improvements | — Pending |
| Claude Code only | Simplifies codebase by removing multi-runtime abstraction | — Pending |
| Auto-calibrate complexity rather than user-set levels | Users shouldn't need to classify their project — the system should figure it out | — Pending |
| Auto-fix + re-verify on failures | Maximizes autonomous operation — only escalate to human if auto-fix fails | — Pending |
| Front-load all interaction | Users invest 10-15 minutes upfront, then walk away | — Pending |

---
*Last updated: 2026-03-14 after initialization*
