# GSDR (GSD Reloaded)

## What This Is

A fork of Get Shit Done (GSD) that prioritizes autonomous execution and smart complexity calibration. GSDR is a meta-prompting and context engineering system distributed as a Claude Code plugin (npm package). It front-loads all human interaction (10-15 minutes of questions), then runs fully autonomously through planning, execution, and self-verification — only returning to the user when the entire build is complete and verified.

## Core Value

After the initial questioning session, the system must run completely autonomously from planning through execution to verification — no human babysitting required.

## Requirements

### Validated

- ✓ Fork GSD codebase and adapt for Claude Code-only distribution via npm — v1.0
- ✓ Smart complexity auto-calibration: detect task complexity and scale planning depth accordingly — v1.0
- ✓ Front-loaded interaction model: all questioning/discussion happens upfront, then fully autonomous execution — v1.0
- ✓ Aggressive parallelism: DAG-based cross-phase scheduling with file-conflict detection — v1.0
- ✓ Autonomous self-verification: verify results automatically, auto-fix failures and re-verify — v1.0
- ✓ End-of-run reporting: summary of what was built, verified, auto-fixed, and what needs attention — v1.0
- ✓ Prevent over-engineering: complexity-scaled planning prevents simple tasks from being over-architected — v1.0

### Active

(None yet — define with `/gsd:new-milestone`)

### Out of Scope

- Multi-runtime support (OpenCode, Gemini CLI, Codex) — Claude Code only, best sub-agent capabilities
- Enterprise features (sprint ceremonies, story points, stakeholder syncs) — scope creep into PM territory
- Interactive per-phase approval gates during execution — opposite of core value
- Real-time streaming progress updates — encourages babysitting behavior
- Plugin/extension system — premature abstraction; ship opinionated defaults first

## Context

Shipped v1.0 with ~55,800 LOC TypeScript across 209 files.
Tech stack: TypeScript, esbuild (CJS bundle), vitest (134 tests), Claude Code Plugin format.
Distributed as npm package with 31 skills, 12 agents, 35 templates, 13 references.
8 phases completed in 2 days with 105 commits.

Known tech debt: 8 items across 4 phases (orphaned exports, deferred live validation tests).
All 27 v1 requirements satisfied. 3 integration gaps found by audit were closed by gap closure phases 6-8.

## Constraints

- **Runtime**: Claude Code only — no need for multi-runtime abstraction layers
- **Distribution**: npm package (npx gsdr@latest or similar)
- **Base**: Fork of GSD — preserve what works, modify what doesn't
- **Philosophy**: Complexity belongs in the system, not the user's workflow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork GSD rather than build from scratch | Preserves proven patterns (context engineering, XML plans, atomic commits) | ✓ Good — 31 skills ported successfully |
| Claude Code only | Simplifies codebase by removing multi-runtime abstraction | ✓ Good — zero abstraction overhead |
| Auto-calibrate complexity rather than user-set levels | Users shouldn't need to classify their project | ✓ Good — 3-tier system working |
| Auto-fix + re-verify on failures | Maximizes autonomous operation | ✓ Good — 3-retry with 2-strike halt |
| Front-load all interaction | Users invest 10-15 minutes upfront, then walk away | ✓ Good — auto_advance default true |
| Signal-based complexity classifier | 5-dimension LLM prompt with override mechanism | ✓ Good — implemented in Phase 2 |
| Tier routing (Simple/Medium/Complex) | Skip research for simple, light for medium, full for complex | ✓ Good — wired into plan-phase |
| Prompt-as-data pattern for classifier | Export prompt as constant for skill workflows to embed and evaluate | ✓ Good — CLASSIFIER_PROMPT exported |
| Pure functions for DAG/scheduling | No side effects except cmdDependencyGraph | ✓ Good — testable, deterministic |
| Plans with empty files_modified forced sequential | Fail-safe for unknown file conflicts | ✓ Good — prevents race conditions |
| Deterministic CLI wiring over prose | autonomous.ts functions exposed via CLI, replacing algorithmic prose in skills | ✓ Good — 13 CLI invocations in execute-phase |
| YAML frontmatter for FAILURES.md | Structured data matching STATE.md pattern | ✓ Good — parseable by CLI tools |
| Irreversible gate at plan level | Scan before spawning executor, not at individual command level | ✓ Good — catches issues early |

---
*Last updated: 2026-03-16 after v1.0 milestone*
