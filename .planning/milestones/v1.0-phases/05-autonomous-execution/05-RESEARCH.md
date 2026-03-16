# Phase 5: Autonomous Execution - Research

**Researched:** 2026-03-16
**Domain:** Autonomous build loop orchestration -- self-verification, auto-fix retry, failure escalation, end-of-run reporting, irreversible action gates
**Confidence:** HIGH

## Summary

Phase 5 is the capstone that makes GSDR's build loop fully autonomous. It adds five capabilities on top of the existing execution pipeline: (1) automatic post-phase verification, (2) auto-fix retries with debugger-informed diagnosis, (3) failure escalation that continues independent work, (4) end-of-run summary reporting, and (5) irreversible action confirmation gates. The primary implementation surface is the `execute-phase` SKILL.md (for the orchestration loop changes) and a new `FAILURES.md` artifact for failure persistence.

All six requirements (AUTO-04 through AUTO-09) are achievable by extending existing patterns. The auto-advance chain already triggers verification after execution (Phase 3). The debugger agent already does scientific-method diagnosis with persistent state (gsdr-debugger.md). The scheduler already knows about task dependencies and independent work (scheduler.ts). The checkpoint pattern already handles human confirmation gates. This phase wires these pieces together into a cohesive autonomous loop.

**Primary recommendation:** Modify `execute-phase/SKILL.md` to add auto-fix retry orchestration between the `execute_waves` and `verify_phase_goal` steps, create FAILURES.md as a new persistent artifact, add an end-of-run report generation step, and inject irreversible action scanning into the checkpoint handling logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- On task failure: spawn a debug agent first to diagnose the failure, then re-run with diagnostic context (not blind re-run)
- Non-improving detection uses both signals: same error signature OR no test improvement -- either counts as a strike
- Track what was tried across attempts; explicitly instruct the next attempt to NOT repeat previous solutions (leverage existing gsd-debugger pattern)
- After two-strike halt: queue the failed task and continue executing independent tasks -- don't stop everything
- Maximum 3 retry attempts per failure (AUTO-05), 2 consecutive non-improving attempts triggers halt (AUTO-06)
- Dependent tasks that can't run due to upstream failure: defer to end -- try them after all independent work completes, since auto-fix might have resolved the upstream by then
- Cross-phase failures and within-wave failures: Claude decides based on failure severity and dependency analysis
- Persistent failure log: write failures to .planning/FAILURES.md as they happen -- survives context resets, enables resume after crash (same pattern as STATE.md)
- FAILURES.md should track: task ID, error signature, attempted solutions, strike count, final status
- End-of-run report format is Claude's discretion -- should cover: what was built, what was verified, what was auto-fixed, and what needs human attention (AUTO-08)
- Irreversible action list location: Claude's discretion (hardcoded defaults + config overrides likely best approach)
- Gate UX: Claude's discretion (checkpoint pattern is familiar)
- Pre-approval mechanism: Claude's discretion
- Shell command scanning scope: Claude's discretion
- Core principle: irreversible actions ALWAYS prompt regardless of autonomy mode (AUTO-09)

### Claude's Discretion
- End-of-run report format and structure
- Irreversible action list composition and maintenance approach
- Gate UX pattern (checkpoint box vs blocking confirm)
- Pre-approval strategy for irreversible actions
- Shell command scanning scope (workflow-only vs shell-level detection)
- How to handle same-wave failures when tasks are running in parallel
- Cross-phase failure escalation severity thresholds

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-04 | Autonomous self-verification after each phase completion | Already partially implemented via auto-advance chain (Phase 3). Needs to be made unconditional -- verification always runs post-execution, not just when auto_advance is active. See `verify_phase_goal` step in execute-phase SKILL.md. |
| AUTO-05 | Auto-fix failures with up to 3 retry attempts per failure, tracking attempted solutions | New auto-fix loop in execute-phase orchestrator. Uses gsdr-debugger for diagnosis, then re-spawns executor with diagnostic context. FAILURES.md tracks attempts. |
| AUTO-06 | Two-strike halt rule: stop auto-fix after 2 consecutive non-improving attempts | Strike detection in orchestrator: compare error signatures and test results between attempts. Two non-improving consecutive attempts halts that fix path, queues task for end report. |
| AUTO-07 | Failure escalation: continue executing independent tasks when one fails, queue failures for end report | Leverages scheduler.ts dependency knowledge. Independent tasks (no `depends_on` relationship to failed task) continue. Failed tasks + their dependents are deferred/queued. |
| AUTO-08 | End-of-run summary report: what was built, verified, auto-fixed, and what needs human attention | New report generation step after all phases/waves complete. Reads FAILURES.md + all SUMMARY.md + VERIFICATION.md files to compose report. |
| AUTO-09 | Irreversible action gate: maintain explicit list of actions requiring human confirmation | Hardcoded defaults list + config override. Injected into checkpoint handling. Scans Bash commands before execution at the skill orchestration level. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.0 | Test framework | Already used project-wide |
| TypeScript | ^5.7.0 | Type system | Already used project-wide |
| esbuild | ^0.24.0 | Bundling | Already used project-wide |

### Supporting
No new dependencies needed. All implementation is within existing GSDR skill/agent/lib architecture.

### Alternatives Considered
None -- this phase extends existing infrastructure, no new libraries needed.

## Architecture Patterns

### Recommended Project Structure

Changes are concentrated in these locations:
```
skills/
  execute-phase/
    SKILL.md              # PRIMARY: Add auto-fix loop, failure escalation, irreversible gates
templates/
  failures.md             # NEW: FAILURES.md template
  end-of-run-report.md    # NEW: End-of-run report template
references/
  irreversible-actions.md # NEW: Default irreversible action list
tests/
  autonomous-execution.test.ts  # NEW: Phase 5 tests
```

### Pattern 1: Auto-Fix Retry Loop (in execute-phase SKILL.md)

**What:** After a plan execution fails (spot-check or agent failure), spawn debugger for diagnosis, then re-execute with diagnostic context. Track attempts in FAILURES.md.

**When to use:** Any plan execution failure during wave execution.

**Flow:**
```
Plan fails →
  Write failure entry to FAILURES.md (attempt 1) →
  Spawn gsdr-debugger (goal: find_root_cause_only) →
  Receive ROOT CAUSE FOUND →
  Re-spawn executor with diagnostic context + "Do NOT repeat: [previous solutions]" →
  Check result →
    Success? → Update FAILURES.md status to "resolved", continue
    Same error / no improvement? → Strike 1, retry (attempt 2) →
      Still no improvement? → Strike 2, HALT this fix path →
        Queue task in FAILURES.md as "halted" →
        Continue with independent tasks
```

**Integration point:** Between `execute_waves` step 4 (spot-check) and step 7 (next wave). The failure handler in step 5 currently asks the user -- in auto-advance mode, it should enter the auto-fix loop instead.

### Pattern 2: Failure Escalation with Dependency Awareness

**What:** When a task fails and is halted, identify which other tasks depend on it (using wave ordering and `depends_on` from plan frontmatter) and skip those. Independent tasks continue.

**When to use:** After a task/plan is halted (2-strike halt or max retries exhausted).

**Key insight:** The scheduler already knows about plan dependencies via `files_modified` and `depends_on` frontmatter. The execute-phase orchestrator already groups plans into waves. A failed plan in wave 1 means wave 2 plans that `depends_on` it should be skipped, but wave 2 plans that are independent should still execute.

**Implementation:** After halting a plan, mark it in FAILURES.md. Before spawning each subsequent plan, check if any of its `depends_on` entries are in the halted set. If yes, skip and add to FAILURES.md as "skipped_upstream_failure".

### Pattern 3: FAILURES.md Persistent Artifact

**What:** Structured markdown file that tracks failures across context resets, matching STATE.md's persistence pattern.

**When to use:** Created on first failure, updated throughout execution, consumed by end-of-run report.

**Structure:**
```markdown
---
created: 2026-03-16T10:00:00Z
updated: 2026-03-16T10:30:00Z
total_failures: 3
resolved: 1
halted: 1
skipped: 1
---

# Failure Log

## 03-02: API Route Implementation
- status: resolved
- error_signature: "TypeError: Cannot read property 'create' of undefined"
- attempts:
  - attempt: 1
    timestamp: 2026-03-16T10:05:00Z
    error: "TypeError: Cannot read property 'create' of undefined"
    diagnosis: "Prisma client not initialized in route handler"
    solution_tried: "Added prisma client import and initialization"
    result: resolved
- strike_count: 0

## 04-01: Dashboard Layout
- status: halted
- error_signature: "Module not found: @/components/Chart"
- attempts:
  - attempt: 1
    timestamp: 2026-03-16T10:10:00Z
    error: "Module not found: @/components/Chart"
    diagnosis: "Chart component referenced but never created"
    solution_tried: "Created stub Chart component"
    result: same_error
  - attempt: 2
    timestamp: 2026-03-16T10:15:00Z
    error: "Module not found: @/components/Chart"
    diagnosis: "Import path uses @ alias but tsconfig paths not configured"
    solution_tried: "Updated tsconfig.json paths"
    result: no_improvement
- strike_count: 2
- halted_reason: "2 consecutive non-improving attempts"

## 04-02: Dashboard Data Fetching
- status: skipped_upstream_failure
- blocked_by: 04-01
- reason: "Depends on 04-01 which is halted"
```

### Pattern 4: Irreversible Action Gate

**What:** Before executing certain Bash commands, check against a list of irreversible actions. If matched, always prompt for human confirmation regardless of autonomy mode.

**When to use:** Injected into the checkpoint handling logic in execute-phase, and documented as a reference for executor agents.

**Default irreversible actions list:**
```
# Database operations
DROP DATABASE, DROP TABLE, TRUNCATE, DELETE FROM (without WHERE)

# Git destructive operations
git push --force, git push -f, git reset --hard, git clean -f, git branch -D

# Package publishing
npm publish, yarn publish, pnpm publish

# Infrastructure
rm -rf /, rm -rf /*, docker system prune, kubectl delete

# Deployment
deploy, push to production
```

**Implementation approach:**
1. Hardcode defaults in a new `references/irreversible-actions.md`
2. Allow config override via `.planning/config.json` key `irreversible_actions: string[]`
3. In execute-phase, when auto-advance is active and an executor agent's plan contains tasks with Bash commands matching the pattern list, treat the plan as `autonomous: false` -- it requires checkpoint confirmation
4. The gate fires at the PLAN level (before spawning the executor), not at the individual Bash command level within the executor. This is simpler and avoids trying to intercept arbitrary shell commands mid-execution.

### Pattern 5: End-of-Run Report

**What:** After all phases complete (or all independent work is exhausted), generate a comprehensive summary.

**When to use:** At the end of cross-phase execution (--milestone/--all mode), or after the final phase in single-phase auto-advance chain.

**Structure:**
```markdown
# GSDR End-of-Run Report

**Generated:** {timestamp}
**Milestone:** {version}
**Duration:** {total time}

## Summary

| Metric | Value |
|--------|-------|
| Phases completed | 4/5 |
| Plans executed | 18/20 |
| Auto-fixes applied | 3 |
| Tasks needing attention | 2 |

## What Was Built

### Phase 1: Foundation
- [from SUMMARY.md files]

### Phase 2: Complexity Calibration
- [from SUMMARY.md files]

## What Was Verified
- [from VERIFICATION.md files -- pass/fail status per phase]

## What Was Auto-Fixed
- [from FAILURES.md -- resolved entries with diagnosis and fix]

## What Needs Human Attention
- [from FAILURES.md -- halted and skipped entries]
- [from VERIFICATION.md -- human_needed items]
```

### Anti-Patterns to Avoid

- **Blind retry:** Never re-run a failed task without diagnosis first. The user explicitly locked this decision: "spawn a debug agent first to diagnose the failure, then re-run with diagnostic context."
- **Stop-the-world on failure:** Never halt ALL execution when one task fails. Independent tasks must continue. Only dependent tasks are deferred.
- **Irreversible gate bypass:** Never allow any mode flag, config setting, or auto-advance state to skip irreversible action confirmation. The gate is absolute.
- **Losing failure context:** Never rely on in-memory state for failure tracking. FAILURES.md must be written to disk immediately on each failure event, surviving context resets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debug diagnosis | Custom error parsing | gsdr-debugger agent (goal: find_root_cause_only) | Already has scientific method, hypothesis tracking, persistent state |
| Dependency analysis | Manual dep traversal | scheduler.ts `computeBatches` + plan frontmatter `depends_on` | Already handles DAG construction and conflict detection |
| Persistent state | Custom file format | STATE.md pattern (YAML frontmatter + markdown body) | Proven pattern in GSDR for cross-session persistence |
| Human confirmation gates | New confirmation system | Checkpoint pattern (human-action type) | Already handles blocking confirmation in execute-phase |
| Error signature comparison | Exact string matching | Normalize error signatures (strip line numbers, paths, timestamps) before comparison | Exact matching would miss equivalent errors with different stack traces |

**Key insight:** This phase is primarily orchestration glue -- connecting existing capabilities (debugger, scheduler, checkpoints, state persistence) into the autonomous loop. Very little new library code is needed.

## Common Pitfalls

### Pitfall 1: Context Overflow in Auto-Fix Loop
**What goes wrong:** The orchestrator accumulates diagnostic context across multiple retry attempts, filling its own context window.
**Why it happens:** Each debugger diagnosis returns evidence, root cause analysis, and attempted solutions. Three retries can be substantial.
**How to avoid:** Keep diagnostic context in FAILURES.md (on disk), not in orchestrator memory. When re-spawning an executor, reference the FAILURES.md file path rather than inlining all diagnostic content. The executor reads it fresh with its own 200K context.
**Warning signs:** Orchestrator context usage climbing past 30% during retry loops.

### Pitfall 2: False Strike Detection
**What goes wrong:** A genuinely different error gets classified as "same error signature" because normalization is too aggressive, triggering premature halt.
**Why it happens:** Error signature comparison is hard -- the same root cause can produce different stack traces, and different root causes can produce similar error text.
**How to avoid:** Use a multi-signal approach as the user specified: same error signature OR no test improvement. Both must be checked. If the error signature is different but tests still don't improve, that's still a strike. If the error signature looks similar but tests DO improve, that's NOT a strike.
**Warning signs:** Tasks being halted after 2 attempts when the errors are actually different bugs.

### Pitfall 3: Infinite Deferral Loop
**What goes wrong:** Deferred tasks (those depending on failed upstream) are retried at the end, but the upstream was never fixed, so they fail too, creating more deferred tasks.
**Why it happens:** The CONTEXT.md says "defer to end -- try them after all independent work completes, since auto-fix might have resolved the upstream by then." But if auto-fix didn't resolve the upstream, deferred tasks will fail immediately.
**How to avoid:** Before retrying deferred tasks at end-of-run, check if their upstream dependency was resolved in FAILURES.md. If upstream is still "halted", skip the deferred task without attempting it -- just mark it "skipped_upstream_failure" in the report.
**Warning signs:** End-of-run taking much longer than expected because deferred tasks are being executed against still-broken upstreams.

### Pitfall 4: Irreversible Gate False Positives
**What goes wrong:** The gate fires on non-dangerous commands that happen to match patterns (e.g., a comment containing "DROP TABLE" or a test file with "git push --force" in a string literal).
**Why it happens:** Naive pattern matching on plan content or Bash commands.
**How to avoid:** Only match patterns in actual `<action>` blocks within plans, specifically within Bash command invocations. Don't scan comments, strings in test files, or documentation content. Use targeted regex that matches command-position patterns.
**Warning signs:** Frequent unnecessary confirmation prompts during automated execution.

### Pitfall 5: Race Condition in FAILURES.md Writes
**What goes wrong:** Two parallel agents in the same wave both fail and try to write to FAILURES.md simultaneously, corrupting the file.
**Why it happens:** Parallel wave execution means multiple agents can fail concurrently.
**How to avoid:** Only the orchestrator writes to FAILURES.md, never the executor agents. The orchestrator is single-threaded (processes agent returns sequentially even if agents run in parallel). Executor agents return failure information to the orchestrator, which then writes it to FAILURES.md.
**Warning signs:** Garbled FAILURES.md content or missing entries after parallel failures.

## Code Examples

### Auto-Fix Retry Orchestration (execute-phase SKILL.md pseudo-flow)

```markdown
## Auto-Fix Loop (inserted into execute_waves failure handler)

When a plan execution fails AND auto_advance is active:

1. Write initial failure entry to FAILURES.md:
   ```bash
   # Append failure entry (orchestrator writes, never agents)
   ```

2. For attempt = 1 to 3:
   a. Spawn debugger for diagnosis:
      ```
      Task(
        prompt="<objective>Diagnose failure in plan {plan_id}</objective>
          <symptoms>
          expected: Plan executes successfully
          actual: {error_output}
          errors: {error_signature}
          </symptoms>
          <mode>
          symptoms_prefilled: true
          goal: find_root_cause_only
          </mode>",
        subagent_type="gsdr-debugger",
        model="{executor_model}"
      )
      ```

   b. Re-spawn executor with diagnostic context:
      ```
      Task(
        prompt="Execute plan {plan_id}. PREVIOUS FAILURE CONTEXT:
          Root cause: {diagnosis.root_cause}
          Previous solutions that DID NOT WORK: {from FAILURES.md}
          DO NOT repeat these approaches.
          Read: .planning/FAILURES.md for full attempt history.",
        subagent_type="gsdr-executor",
        model="{executor_model}"
      )
      ```

   c. Check result:
      - Success? Update FAILURES.md status to "resolved", break loop
      - Compare error signature (normalized) with previous attempt
      - Compare test results (if applicable) with previous attempt
      - If same error OR no test improvement: increment strike_count
      - If strike_count >= 2: halt, break loop
      - Otherwise: update FAILURES.md with new attempt, continue loop

3. After loop:
   - If resolved: continue to next wave
   - If halted: add to halted set, mark dependents as skipped, continue with independent plans
```

### Error Signature Normalization

```typescript
// Normalize error signatures for comparison
// Strip variable parts: line numbers, file paths, timestamps, memory addresses
function normalizeErrorSignature(error: string): string {
  return error
    .replace(/:\d+:\d+/g, ':LINE:COL')       // line:col numbers
    .replace(/at .+\(.+\)/g, 'at STACK')      // stack trace frames
    .replace(/\/[\w/.-]+\.\w+/g, 'FILE')      // file paths
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, 'TIMESTAMP')
    .replace(/0x[0-9a-f]+/gi, 'ADDR')         // memory addresses
    .trim();
}
```

### FAILURES.md Write Pattern

```typescript
// Orchestrator-only write pattern (mirrors STATE.md pattern)
// Uses YAML frontmatter + structured markdown body
function appendFailure(cwd: string, entry: FailureEntry): void {
  const failuresPath = path.join(cwd, '.planning', 'FAILURES.md');
  let content = '';

  if (fs.existsSync(failuresPath)) {
    content = fs.readFileSync(failuresPath, 'utf-8');
  } else {
    content = `---\ncreated: ${new Date().toISOString()}\nupdated: ${new Date().toISOString()}\ntotal_failures: 0\nresolved: 0\nhalted: 0\nskipped: 0\n---\n\n# Failure Log\n`;
  }

  // Append new entry, update frontmatter counts
  // ... (implementation details)
}
```

### Irreversible Action Scanning

```markdown
## Irreversible Action Check (in execute-phase, before spawning executor)

Before spawning an executor agent for a plan:

1. Read plan file
2. Extract all <action> blocks
3. For each action block, check for Bash commands matching irreversible patterns:
   - Pattern list from references/irreversible-actions.md
   - Override/extend via config.json `irreversible_actions` array
4. If ANY match found:
   - Set plan autonomous: false (force checkpoint)
   - Present gate with matched commands listed:
     ```
     IRREVERSIBLE ACTION DETECTED

     Plan {plan_id} contains potentially irreversible commands:
     - `git push --force` (line 23)
     - `npm publish` (line 45)

     These actions cannot be undone. Proceed? [y/N]
     ```
   - This gate fires REGARDLESS of auto_advance setting
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual retry on failure | Ask user "Retry?" | Phase 1-4 (current) | Human must babysit failures |
| Manual verification | gsdr-verifier runs automatically when auto_advance is on | Phase 3 | But only when auto_advance is active |
| No failure persistence | (none) | Current gap | Context reset loses all failure context |
| No end-of-run summary | (none) | Current gap | User must piece together results manually |

**What Phase 5 changes:**
- Manual retry -> Automated diagnose-then-retry with 3-attempt cap and 2-strike halt
- Conditional verification -> Always-on verification after phase execution
- No persistence -> FAILURES.md for crash-safe failure tracking
- No summary -> End-of-run report aggregating all outcomes

## Open Questions

1. **Error signature extraction from agent output**
   - What we know: Agents return structured results (SUMMARY.md, Self-Check sections). Failed agents may crash or return unstructured errors.
   - What's unclear: How reliably can we extract a consistent error signature from varied failure modes (agent crash vs. Self-Check: FAILED vs. build error vs. test failure)?
   - Recommendation: Use a tiered approach: (1) check Self-Check section in SUMMARY.md if it exists, (2) capture the last 50 lines of agent output as fallback, (3) use the full agent error message for crashes. The debugger agent will do the real analysis -- the signature is just for strike comparison.

2. **End-of-run report location and trigger**
   - What we know: In cross-phase mode (--milestone/--all), there's a clear "all batches complete" point. In single-phase auto-advance chains, the "end" is when the last phase in the chain completes.
   - What's unclear: Should the report be generated for single-phase execution too, or only for multi-phase runs?
   - Recommendation: Generate report when auto_advance chain completes (last phase verified) or when --milestone/--all finishes. Single manual phase execution does not generate a report (the phase completion output is sufficient). Write to `.planning/END-OF-RUN-REPORT.md`.

3. **Pre-approval for known irreversible actions**
   - What we know: The user listed this as Claude's discretion.
   - What's unclear: Should users be able to pre-approve specific irreversible actions in config.json to avoid repeated prompts?
   - Recommendation: Support a `pre_approved_actions: string[]` config key for specific commands the user has blessed (e.g., `"npm publish"` for a library project). But still log pre-approved actions in the end-of-run report for auditability.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | package.json `scripts.test` -> `vitest run` |
| Quick run command | `npx vitest run tests/autonomous-execution.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-04 | Verification runs automatically after phase execution (not just when auto_advance active) | unit | `npx vitest run tests/autonomous-execution.test.ts -t "AUTO-04"` | No - Wave 0 |
| AUTO-05 | Auto-fix retry loop with max 3 attempts, debugger diagnosis before each retry | unit | `npx vitest run tests/autonomous-execution.test.ts -t "AUTO-05"` | No - Wave 0 |
| AUTO-06 | Two-strike halt: 2 consecutive non-improving attempts triggers halt | unit | `npx vitest run tests/autonomous-execution.test.ts -t "AUTO-06"` | No - Wave 0 |
| AUTO-07 | Independent tasks continue when one fails; failed+dependents queued | unit | `npx vitest run tests/autonomous-execution.test.ts -t "AUTO-07"` | No - Wave 0 |
| AUTO-08 | End-of-run report covers built/verified/auto-fixed/needs-attention | unit | `npx vitest run tests/autonomous-execution.test.ts -t "AUTO-08"` | No - Wave 0 |
| AUTO-09 | Irreversible actions always prompt regardless of autonomy mode | unit | `npx vitest run tests/autonomous-execution.test.ts -t "AUTO-09"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/autonomous-execution.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/autonomous-execution.test.ts` -- covers AUTO-04 through AUTO-09
- [ ] Framework install: None needed -- vitest already installed

## Sources

### Primary (HIGH confidence)
- `skills/execute-phase/SKILL.md` -- Full orchestration flow, checkpoint handling, wave execution, cross-phase mode
- `skills/verify-work/SKILL.md` -- Verification flow, auto-advance gap closure pattern
- `agents/gsdr-debugger.md` -- Scientific method debugging, persistent state, diagnose-only mode
- `src/lib/scheduler.ts` -- DAG construction, batch computation, dependency detection
- `src/lib/verify.ts` -- Summary verification, plan structure verification, phase completeness
- `src/lib/state.ts` -- STATE.md read/write patterns, frontmatter sync
- `templates/verification-report.md` -- VERIFICATION.md structure and gap tracking
- `templates/debug-subagent-prompt.md` -- Debug agent spawning pattern
- `.planning/config.json` -- Configuration structure including auto_advance settings

### Secondary (MEDIUM confidence)
- `tests/auto-advance.test.ts` -- Test pattern for skill behavior verification (file content assertions)
- `tests/dependency-graph.test.ts` -- Test pattern for library function unit tests

### Tertiary (LOW confidence)
None -- all findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all existing infrastructure
- Architecture: HIGH -- All patterns derived from existing codebase patterns (STATE.md persistence, checkpoint handling, debugger agent spawning)
- Pitfalls: HIGH -- Derived from understanding actual code flow and parallel execution behavior

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- internal architecture, no external dependency volatility)
