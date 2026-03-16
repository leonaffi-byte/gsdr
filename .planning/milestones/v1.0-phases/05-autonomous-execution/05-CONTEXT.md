# Phase 5: Autonomous Execution - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Self-verification after each phase, auto-fix loops for failures, failure escalation that continues independent work, end-of-run summary reporting, and irreversible action gates. This is the capstone phase that makes the full build loop autonomous.

</domain>

<decisions>
## Implementation Decisions

### Auto-fix retry strategy
- On task failure: spawn a debug agent first to diagnose the failure, then re-run with diagnostic context (not blind re-run)
- Non-improving detection uses both signals: same error signature OR no test improvement — either counts as a strike
- Track what was tried across attempts; explicitly instruct the next attempt to NOT repeat previous solutions (leverage existing gsd-debugger pattern)
- After two-strike halt: queue the failed task and continue executing independent tasks — don't stop everything
- Maximum 3 retry attempts per failure (AUTO-05), 2 consecutive non-improving attempts triggers halt (AUTO-06)

### Failure escalation flow
- Dependent tasks that can't run due to upstream failure: defer to end — try them after all independent work completes, since auto-fix might have resolved the upstream by then
- Cross-phase failures and within-wave failures: Claude decides based on failure severity and dependency analysis
- Persistent failure log: write failures to .planning/FAILURES.md as they happen — survives context resets, enables resume after crash (same pattern as STATE.md)
- FAILURES.md should track: task ID, error signature, attempted solutions, strike count, final status

### End-of-run report
- Claude's discretion on format and detail level — should cover: what was built, what was verified, what was auto-fixed, and what needs human attention (AUTO-08)

### Irreversible action gates
- Claude's discretion on list location (hardcoded defaults + config overrides likely best approach)
- Claude's discretion on gate UX (checkpoint pattern is familiar)
- Claude's discretion on pre-approval mechanism
- Claude's discretion on shell command scanning scope
- Core principle: irreversible actions ALWAYS prompt regardless of autonomy mode (AUTO-09)

### Claude's Discretion
- End-of-run report format and structure
- Irreversible action list composition and maintenance approach
- Gate UX pattern (checkpoint box vs blocking confirm)
- Pre-approval strategy for irreversible actions
- Shell command scanning scope (workflow-only vs shell-level detection)
- How to handle same-wave failures when tasks are running in parallel
- Cross-phase failure escalation severity thresholds

</decisions>

<specifics>
## Specific Ideas

- Existing gsd-debugger already tracks attempted solutions with scientific method — reuse for auto-fix diagnosis
- Phase 3 already established: auto-advance default ON, gap closure loop (plan-phase --gaps > execute --gaps-only > re-verify, up to 2 attempts)
- Phase 4's cross-phase mode (--milestone/--all) needs the failure escalation to handle batch failures gracefully
- FAILURES.md pattern should mirror STATE.md — structured YAML frontmatter with human-readable sections

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/execute-phase/SKILL.md`: Has failure handling (retry/continue prompts), spot-checking, cross-phase mode — needs automation of the retry prompts
- `skills/verify-work/SKILL.md`: Already has auto-mode gap closure loop (2 attempts) — extend with auto-fix retry logic
- `src/lib/verify.ts`: Existing verification module
- `src/lib/scheduler.ts`: DAG/batch computation — knows about dependencies and can identify independent tasks
- gsd-debugger agent: Scientific method debugging with persistent state — reuse for diagnose-then-retry

### Established Patterns
- Checkpoint handling in execute-phase (auto-approve for human-verify, present for human-action)
- SUMMARY.md spot-checks (file exists, git commits present, no Self-Check: FAILED)
- Auto-advance chain propagation (--auto flag through discuss > plan > execute)
- STATE.md for cross-session persistence

### Integration Points
- `skills/execute-phase/SKILL.md`: Primary modification — replace manual retry prompts with auto-fix loop
- `skills/verify-work/SKILL.md`: Already has gap closure — needs to integrate with FAILURES.md
- `.planning/FAILURES.md`: New artifact — failure tracking
- End-of-run report: new output after final phase completes or all independent work exhausted

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-autonomous-execution*
*Context gathered: 2026-03-16*
