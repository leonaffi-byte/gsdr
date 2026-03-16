# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-16
**Phases:** 8 | **Plans:** 15 | **Commits:** 105

### What Was Built
- Complete TypeScript npm package with Claude Code plugin format (31 skills, 12 agents)
- Signal-based complexity classifier with 3-tier adaptive planning depth
- Front-loaded interaction model removing all per-phase human gates
- DAG-based dependency graph engine with file-conflict detection for cross-phase parallelism
- Autonomous execution library with auto-fix loops, 2-strike halt, and failure escalation
- Deterministic CLI wiring (13 commands) replacing prose-based LLM re-implementation

### What Worked
- GSD fork approach preserved proven patterns while allowing targeted improvements — 31 skills ported successfully
- TDD for core libraries (complexity, scheduler, autonomous) produced reliable pure functions with 134 tests
- Gap closure phases (6-8) effectively addressed integration issues found by milestone audit
- Phase parallelization: phases 3/4 ran concurrently after phase 2, saving wall-clock time
- Yolo mode with auto_advance eliminated per-phase human bottlenecks during execution

### What Was Inefficient
- Milestone audit was run before all phases completed, then gap closure phases were added — could have integrated verification earlier
- Some live validation tests deferred (8 tech debt items) — unit tests validated structure but not runtime behavior
- Orphaned exports (COMPLEXITY_TIERS, getComplexityConfig) shipped — routing logic duplicated as prose in plan-phase

### Patterns Established
- YAML frontmatter + markdown body pattern (STATE.md, FAILURES.md, SUMMARY.md) for structured-yet-readable files
- Pure functions for algorithmic logic, CLI commands for deterministic wiring into skills
- Prompt-as-data pattern: export LLM prompts as constants for skill workflows to embed
- Plugin-root-relative paths via `${CLAUDE_SKILL_DIR}/../` for portable resolution

### Key Lessons
1. Integration gaps are invisible until you trace E2E flows — milestone audit caught 3 wiring issues that individual phase verification missed
2. Prose-based instructions get re-implemented differently by LLMs each time — deterministic CLI commands produce consistent behavior
3. Complexity calibration pays off immediately — simple tasks that would have been over-planned got 1 lightweight plan instead
4. Auto-advance mode is essential for autonomous operation but requires automated verification to replace human gates

### Cost Observations
- Model mix: quality profile (opus for execution, sonnet for research/planning)
- Timeline: ~2 days wall-clock, ~0.43 hours tracked execution time
- Notable: 15 plans averaged 3.5 min each — sub-agent fresh context kept execution fast

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 105 | 8 | Initial build — established all core patterns |

### Cumulative Quality

| Milestone | Tests | LOC | Tech Debt |
|-----------|-------|-----|-----------|
| v1.0 | 134 | ~55,800 | 8 items |

### Top Lessons (Verified Across Milestones)

1. (First milestone — lessons above will be cross-validated in v1.1+)
