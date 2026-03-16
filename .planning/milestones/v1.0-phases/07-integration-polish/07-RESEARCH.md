# Phase 7: Integration Polish - Research

**Researched:** 2026-03-16
**Domain:** GSDR internal integration -- frontmatter persistence, template/code alignment
**Confidence:** HIGH

## Summary

Phase 7 closes two minor integration gaps (INT-02 and INT-03) identified in the v1.0 milestone audit. These are narrowly scoped fixes to existing code and documentation -- no new libraries, no architectural changes, no external dependencies. The work involves three precise changes: (1) adding `complexity_tier` to PLAN.md frontmatter during planning, (2) reading that field during execution to display the actual tier, and (3) aligning the FAILURES.md template documentation with the actual code output format.

All three changes touch existing, well-tested infrastructure. The frontmatter system already has `get`, `set`, `merge`, and `validate` CLI commands. The `serializeEntry` function in `autonomous.ts` already defines the canonical output format. The changes are mechanical alignment tasks.

**Primary recommendation:** Three targeted edits -- one to the planner agent instructions, one to the frontmatter validation schema, and one to the template file. No new modules, no new tests beyond verifying the frontmatter field exists after planning.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMPLX-02 | Adaptive plan depth based on complexity tier | Tier must persist in PLAN.md frontmatter so execute-phase can read it. Currently classified in plan-phase step 2.5 but never written to the plan file. |
| CMPLX-03 | Adaptive research depth based on complexity tier | Same as CMPLX-02 -- tier is used during planning but not persisted for downstream consumers. |
| AUTO-05 | Auto-fix with 3 retries, tracking attempted solutions | FAILURES.md template documents `## {plan_id}: {plan_name}` heading format but code writes `## {plan_id}` only. Template must match code. |
| AUTO-08 | End-of-run summary report | Report reads FAILURES.md via `readFailures()` which parses `## heading` sections. Template documentation should match what the parser expects. |
</phase_requirements>

## Standard Stack

No new libraries needed. All work uses existing GSDR infrastructure:

| Module | Path | Purpose | Relevance |
|--------|------|---------|-----------|
| frontmatter.ts | `src/lib/frontmatter.ts` | YAML frontmatter CRUD | Has `cmdFrontmatterSet` for writing `complexity_tier` to PLAN.md |
| autonomous.ts | `src/lib/autonomous.ts` | Failure tracking, FAILURES.md CRUD | `serializeEntry()` at line 61 writes `## ${entry.plan_id}` (no plan_name) |
| complexity.ts | `src/lib/complexity.ts` | Complexity classification | `classifyComplexity()` returns tier; already called in plan-phase step 2.5 |
| gsdr-planner.md | `agents/gsdr-planner.md` | Planner agent instructions | Needs instruction to write `complexity_tier` frontmatter field |
| plan-phase SKILL.md | `skills/plan-phase/SKILL.md` | Plan-phase orchestrator | Already classifies tier in step 2.5, needs to pass tier to planner and/or write it post-planning |
| execute-phase SKILL.md | `skills/execute-phase/SKILL.md` | Execute-phase orchestrator | Already reads `complexity_tier` from frontmatter at lines 44-48 |
| failures.md template | `templates/failures.md` | Documentation of FAILURES.md format | Line 31: `## {plan_id}: {plan_name}` must change to `## {plan_id}` |

## Architecture Patterns

### INT-02 Fix: Persist complexity_tier in PLAN.md Frontmatter

**Current flow:**
1. `plan-phase/SKILL.md` step 2.5 classifies complexity and stores `COMPLEXITY_TIER` variable
2. Step 8 passes `COMPLEXITY_TIER` to the planner agent in the prompt
3. Planner agent (`gsdr-planner.md`) creates PLAN.md files but does NOT write `complexity_tier` to frontmatter
4. `execute-phase/SKILL.md` initialize step reads `complexity_tier` from PLAN.md frontmatter -- finds nothing, falls back to "not classified"

**Fix approach (two options, recommend Option A):**

**Option A -- Plan-phase orchestrator writes tier after planner returns:**
After the planner agent finishes (step 9), the plan-phase orchestrator uses the existing `frontmatter set` CLI command to inject `complexity_tier` into each created PLAN.md:

```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" frontmatter set "$PLAN_PATH" --field complexity_tier --value "$COMPLEXITY_TIER"
```

This is deterministic -- the orchestrator already knows the tier and already has the plan paths. No LLM interpretation needed.

**Option B -- Planner agent writes tier itself:**
Add instruction to `gsdr-planner.md` to include `complexity_tier` in frontmatter. This is less reliable because the planner is an LLM that might forget or misformat the field.

**Recommendation:** Option A. The orchestrator (plan-phase SKILL.md) already owns the tier classification and plan paths. Adding a 3-line bash loop after step 9 is simpler and deterministic.

**Frontmatter schema update:**
The `FRONTMATTER_SCHEMAS.plan` in `frontmatter.ts` line 221 currently requires: `phase, plan, type, wave, depends_on, files_modified, autonomous, must_haves`. The `complexity_tier` field should NOT be added to `required` because older plans and simple-tier plans should still validate. It is an optional informational field.

### INT-03 Fix: Align FAILURES.md Template with Code

**Current mismatch:**
- Template (`templates/failures.md` line 31): `## {plan_id}: {plan_name}`
- Code (`src/lib/autonomous.ts` line 61): `## ${entry.plan_id}`
- Parser (`readFailures()` line 172): `const entryPattern = /^## (.+)$/gm` -- captures full heading text

**The code is the source of truth.** The template is documentation only -- it tells LLM agents and developers what format to expect. The code writes `## {plan_id}` and the parser reads `## (.+)`. Both are internally consistent.

**Fix:** Change template line 31 from `## {plan_id}: {plan_name}` to `## {plan_id}`.

The `FailureEntry` type in `autonomous.ts` has no `plan_name` field (line 22-30), confirming that plan_name was never part of the data model.

### Execute-phase Banner (Already Wired)

The execute-phase SKILL.md already has the correct reading logic at lines 44-51:
```bash
COMPLEXITY_TIER=$(node ... frontmatter get "$PLAN_FILE" --field complexity_tier ...)
```
And the fallback: `If COMPLEXITY_TIER is empty, set to "not classified".`

Once INT-02 is fixed and the field exists in the plan file, the execute-phase banner will automatically display the correct tier. No changes needed in execute-phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Writing frontmatter | Manual file editing | `frontmatter set` CLI command | Already handles YAML parsing, quoting, splicing |
| Validating frontmatter | Custom validation | `frontmatter validate --schema plan` CLI | Already validates required fields |

## Common Pitfalls

### Pitfall 1: Adding complexity_tier to Required Schema Fields
**What goes wrong:** If `complexity_tier` is added to `FRONTMATTER_SCHEMAS.plan.required`, all existing PLAN.md files from phases 1-6 will fail validation.
**How to avoid:** Keep it as an optional field. The execute-phase already handles the "not classified" fallback gracefully.

### Pitfall 2: Modifying the autonomous.ts serializeEntry Function
**What goes wrong:** Changing the code to add `: {plan_name}` to match the old template would break the parser and all 32 existing tests.
**How to avoid:** The template is wrong, not the code. Fix the template to match the code.

### Pitfall 3: Forgetting to Loop Over All Plans
**What goes wrong:** If plan-phase only writes `complexity_tier` to the first PLAN.md, execute-phase may read a different plan file and still show "not classified".
**How to avoid:** Loop over all created PLAN.md files in the phase directory when setting the frontmatter field.

### Pitfall 4: Race Condition with Planner Agent
**What goes wrong:** If the orchestrator tries to write frontmatter before the planner agent finishes creating files, the files won't exist yet.
**How to avoid:** Write `complexity_tier` AFTER the planner agent returns (step 9 handler), not during step 8 (spawn).

## Code Examples

### Writing complexity_tier to PLAN.md (plan-phase orchestrator)

```bash
# After planner returns successfully (step 9), inject complexity_tier into all plans
for PLAN_FILE in "${PHASE_DIR}"/*-PLAN.md; do
  node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" frontmatter set "$PLAN_FILE" \
    --field complexity_tier --value "$COMPLEXITY_TIER"
done
```

Source: Existing `frontmatter set` CLI at `src/lib/frontmatter.ts` line 241-253.

### Expected PLAN.md Frontmatter After Fix

```yaml
---
phase: 07-integration-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - skills/plan-phase/SKILL.md
  - templates/failures.md
autonomous: true
requirements: [CMPLX-02, CMPLX-03, AUTO-05, AUTO-08]
complexity_tier: simple
must_haves:
  truths:
    - "..."
---
```

### Fixed FAILURES.md Template Entry Format

```markdown
## {plan_id}
- status: {active | resolved | halted | skipped_upstream_failure}
- error_signature: "{normalized error signature}"
- strike_count: {0-2}
```

Source: `src/lib/autonomous.ts` `serializeEntry()` lines 59-83.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (bundled with project) |
| Config file | `vitest.config.ts` (or inline in package.json) |
| Quick run command | `npx vitest run tests/build.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMPLX-02 | complexity_tier field exists in PLAN.md frontmatter after planning | integration | Manual verification after plan-phase run | N/A -- SKILL.md change, tested by running plan-phase |
| CMPLX-03 | Same as CMPLX-02 (tier persisted enables downstream research routing verification) | integration | Same as above | N/A |
| AUTO-05 | FAILURES.md template matches code output format | unit | `npx vitest run tests/autonomous-execution.test.ts -t "serialize"` | Existing tests cover serialization |
| AUTO-08 | End-of-run report reads FAILURES.md correctly | unit | `npx vitest run tests/autonomous-execution.test.ts -t "report"` | Existing tests cover report generation |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/autonomous-execution.test.ts tests/build.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. The autonomous-execution tests (32 tests) already validate serialization format and FAILURES.md CRUD. The build test validates frontmatter operations. Template alignment is a documentation fix that does not require new tests.

## Specific File Changes Required

### File 1: `skills/plan-phase/SKILL.md`
**Location:** Between steps 9 and 10 (after planner returns, before checker)
**Change:** Add a loop that writes `complexity_tier` to each created PLAN.md using `frontmatter set`
**Lines affected:** Insert ~8 lines after the "Handle Planner Return" section

### File 2: `templates/failures.md`
**Location:** Line 31
**Change:** `## {plan_id}: {plan_name}` to `## {plan_id}`
**Lines affected:** 1 line

### File 3: `agents/gsdr-planner.md` (optional, low priority)
**Location:** In the frontmatter field documentation section
**Change:** Add `complexity_tier` as an optional field in the documented plan frontmatter (for awareness, not enforcement)
**Lines affected:** 1-2 lines

## Sources

### Primary (HIGH confidence)
- `src/lib/autonomous.ts` lines 59-83 -- serializeEntry implementation (direct code inspection)
- `src/lib/frontmatter.ts` lines 220-224 -- FRONTMATTER_SCHEMAS (direct code inspection)
- `templates/failures.md` lines 30-31 -- template entry format (direct file inspection)
- `skills/plan-phase/SKILL.md` steps 2.5, 8, 9 -- complexity flow (direct file inspection)
- `skills/execute-phase/SKILL.md` initialize step lines 44-51 -- tier reading logic (direct file inspection)
- `.planning/v1.0-MILESTONE-AUDIT.md` INT-02, INT-03 -- gap definitions (direct file inspection)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code inspected directly, no external dependencies
- Architecture: HIGH -- changes are mechanical edits to existing files with existing patterns
- Pitfalls: HIGH -- based on direct analysis of code flow and data model

**Research date:** 2026-03-16
**Valid until:** Indefinite -- internal codebase changes only, no external dependency drift risk
