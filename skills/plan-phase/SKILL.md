---
name: plan-phase
description: "Create detailed phase plan (PLAN.md) with verification loop, or plan multiple phases in parallel"
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--prd filepath] [--milestone] [--all]"
context: fork
agent: gsdr-planner
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Task
disable-model-invocation: true
---

<purpose>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification. Default flow: Research (if needed) -> Plan -> Verify -> Done. Orchestrates gsdr-phase-researcher, gsdr-planner, and gsdr-plan-checker agents with a revision loop (max 3 iterations).

Supports two modes:
- **Single-phase mode (default):** Plan one phase at a time with the full research-plan-verify pipeline.
- **Multi-phase parallel mode (`--milestone` or `--all`):** Plan multiple phases concurrently when their dependencies are satisfied (PARA-04). Uses the dependency graph engine to determine which phases can be planned in parallel.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@${CLAUDE_SKILL_DIR}/../references/ui-brand.md
</required_reading>

<process>

## 1. Initialize

Load all context in one call (paths only to minimize orchestrator context):

```bash
INIT=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `nyquist_validation_enabled`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `plan_count`, `planning_exists`, `roadmap_exists`, `phase_req_ids`.

**File paths (for <files_to_read> blocks):** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path`. These are null if files don't exist.

**If `planning_exists` is false:** Display error using error box format from @references/ui-brand.md. Pick randomly from error header pool for the header. Description: "No .planning/ directory found." Fix: "Run `/gsdr:new-project` first."

## 1.5. Check Multi-Phase Mode

Check if multi-phase parallel planning was requested:

```bash
if [[ "$ARGUMENTS" =~ --milestone ]] || [[ "$ARGUMENTS" =~ --all ]]; then
  MULTI_PHASE_MODE=true
else
  MULTI_PHASE_MODE=false
fi
```

**If `MULTI_PHASE_MODE` is true:** Route to `parallel_planning` step below. Skip all single-phase steps (2 through 14).

**If `MULTI_PHASE_MODE` is false:** Proceed with existing single-phase planning (unchanged). All subsequent steps execute as before.

<step name="parallel_planning">
Multi-phase parallel planning mode. Plans multiple phases concurrently when their dependencies are satisfied (PARA-04).

**Prerequisite:** `MULTI_PHASE_MODE` is true (from step 1.5).

**1. Generate dependency graph:**

```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" dependency-graph --cwd "$CWD"
```

Read the generated artifact:
```bash
DEPENDENCY_GRAPH=$(cat .planning/dependency-graph.json)
```

Parse: `batches[]` (each with `batch_number`, `phases[]`), `phases[]` (each with `phase_number`, `phase_name`, `status`, `plans[]`).

**2. Identify phases that need planning:**

For each phase in the dependency graph:
- Skip phases with `status: 'complete'` (already fully executed)
- Skip phases that already have PLAN.md files (check `plans[]` array — if non-empty, plans exist)
- Remaining phases need planning

If no phases need planning:
```
All phases are already planned. Nothing to do.
Use /gsdr:execute-phase --milestone to execute.
```

**3. Group plannable phases into batches:**

Use the dependency graph's `batches[]` to determine ordering. For each batch:
- Filter to only phases that need planning (from step 2)
- If no plannable phases in this batch, skip to next

**4. Execute planning batches:**

For each batch with plannable phases:

a. **Check agent budget:**
   - Planning agents are lighter than execution agents
   - Cap at `max_concurrent_agents` from config (default 5)
   - Each planning agent counts as 1 agent regardless of phase size
   - If phases in batch > max agents, split into sub-batches

b. **Display batch overview:**
   ```
   ## Planning Batch {N}

   Phases to plan: {phase_list}
   Agents: {count}/{max}
   ```
   Pick randomly from batch spawning pool in @references/ui-brand.md for the planner batch spawn.

c. **Spawn plan-phase for each phase in batch (single-phase mode):**

   For each phase that needs planning:
   ```
   Task(
     subagent_type="gsdr-planner",
     model="{planner_model}",
     prompt="Plan phase {phase_number}. Single-phase mode (no --milestone flag).
       /gsdr:plan-phase {phase_number}"
   )
   ```

   This reuses the existing single-phase planning pipeline (research, plan, verify) for each phase independently.

d. **Wait for all planning agents in batch to complete.**

e. **Verify batch completion:**
   - For each phase in batch: check that PLAN.md files were created
   - Report results:
   ```
   ## Planning Batch {N} Complete

   | Phase | Plans Created | Status |
   |-------|--------------|--------|
   | 01-foundation | 4 | Planned |
   | 02-complexity | 2 | Planned |
   ```

f. **Regenerate dependency graph:**
   Plans now exist with `files_modified` declarations, so the graph can compute file conflicts and accurate agent budgets:
   ```bash
   node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" dependency-graph --cwd "$CWD"
   ```

g. **Proceed to next batch.**

**5. Final dependency graph regeneration:**

After all phases are planned, regenerate one final time so the graph reflects all newly-created plans:
```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" dependency-graph --cwd "$CWD"
```

This ensures dependency-graph.json is up-to-date with all `files_modified` declarations from the new plans, ready for cross-phase execution.

**6. Present completion:**

```
## Multi-Phase Planning Complete

**Phases planned:** {N}/{total}
**Batches:** {batch_count}

| Batch | Phases | Plans Created |
|-------|--------|---------------|
| 1 | 01, 02 | 6 |
| 2 | 03 | 3 |

Dependency graph updated: .planning/dependency-graph.json

Next: /gsdr:execute-phase --milestone
```

**Key constraint:** Each phase uses the existing single-phase planning pipeline (research -> plan -> verify). Multi-phase mode only determines WHICH phases to plan and WHEN, then delegates to single-phase plan-phase for each. Within each phase, the full research-plan-verify cycle runs independently.
</step>

## 2. Parse and Normalize Arguments

Extract from $ARGUMENTS: phase number (integer or decimal like `2.1`), flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--prd <filepath>`, `--complexity <simple|medium|complex>`).

Extract `--prd <filepath>` from $ARGUMENTS. If present, set PRD_FILE to the filepath.

**If no phase number:** Detect next unplanned phase from roadmap.

**If `phase_found` is false:** Validate phase exists in ROADMAP.md. If valid, create the directory using `phase_slug` and `padded_phase` from init:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**Existing artifacts from init:** `has_research`, `has_plans`, `plan_count`.

## 2.5. Classify Complexity

Determine the complexity tier for this phase. The tier controls research depth, plan count, and checker iterations.

**Parse --complexity flag** from $ARGUMENTS: extract `simple|medium|complex` value if present, store as `COMPLEXITY_OVERRIDE`.

**If --complexity override provided:**

```bash
COMPLEXITY_JSON=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" classify-complexity "$PHASE_DESCRIPTION" --override "$COMPLEXITY_OVERRIDE")
COMPLEXITY_TIER="$COMPLEXITY_OVERRIDE"
```

Display: `Complexity: {COMPLEXITY_TIER} (user override)`

**If no override (auto-detect):**

```bash
CLASSIFY_JSON=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" classify-complexity "$PHASE_DESCRIPTION")
```

This returns `{ prompt: string }`. The orchestrator evaluates the prompt inline (it is already an LLM) to produce the classification. Read the prompt, reason about the phase, and output a ComplexityResult JSON with `tier`, `confidence`, `rationale`, and `signals`.

Extract the tier from the result and store as `COMPLEXITY_TIER`.

Display:
```
Complexity: {tier} ({confidence} confidence)
Rationale: {rationale}
```

**Store `COMPLEXITY_TIER`** variable (`simple`, `medium`, or `complex`) for use in subsequent steps.

**Default (backward compatibility):** If complexity classification fails or is unavailable, default to `complex` (which matches current behavior with full research, full plan treatment, and full checker iterations).

## 3. Validate Phase

```bash
PHASE_INFO=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" roadmap get-phase "${PHASE}")
```

**If `found` is false:** Error with available phases. **If `found` is true:** Extract `phase_number`, `phase_name`, `goal` from JSON.

## 3.5. Handle PRD Express Path

**Skip if:** No `--prd` flag in arguments.

**If `--prd <filepath>` provided:**

1. Read the PRD file:
```bash
PRD_CONTENT=$(cat "$PRD_FILE" 2>/dev/null)
if [ -z "$PRD_CONTENT" ]; then
  echo "Error: PRD file not found: $PRD_FILE"
  exit 1
fi
```

2. Display a stage banner. Pick randomly from the PLANNING banner pool in @references/ui-brand.md (PRD express context):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {selected banner text} (PRD EXPRESS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using PRD: {PRD_FILE}
Generating CONTEXT.md from requirements...
```

3. Parse the PRD content and generate CONTEXT.md. The orchestrator should:
   - Extract all requirements, user stories, acceptance criteria, and constraints from the PRD
   - Map each to a locked decision (everything in the PRD is treated as a locked decision)
   - Identify any areas the PRD doesn't cover and mark as "Claude's Discretion"
   - Create CONTEXT.md in the phase directory

4. Write CONTEXT.md:
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** PRD Express Path ({PRD_FILE})

<domain>
## Phase Boundary

[Extracted from PRD — what this phase delivers]

</domain>

<decisions>
## Implementation Decisions

{For each requirement/story/criterion in the PRD:}
### [Category derived from content]
- [Requirement as locked decision]

### Claude's Discretion
[Areas not covered by PRD — implementation details, technical choices]

</decisions>

<specifics>
## Specific Ideas

[Any specific references, examples, or concrete requirements from PRD]

</specifics>

<deferred>
## Deferred Ideas

[Items in PRD explicitly marked as future/v2/out-of-scope]
[If none: "None — PRD covers phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date] via PRD Express Path*
```

5. Commit:
```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" commit "docs(${padded_phase}): generate context from PRD" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

6. Set `context_content` to the generated CONTEXT.md content and continue to step 5 (Handle Research).

**Effect:** This completely bypasses step 4 (Load CONTEXT.md) since we just created it. The rest of the workflow (research, planning, verification) proceeds normally with the PRD-derived context.

## 4. Load CONTEXT.md

**Skip if:** PRD express path was used (CONTEXT.md already created in step 3.5).

Check `context_path` from init JSON.

If `context_path` is not null, display: `Using phase context from: ${context_path}`

**If `context_path` is null (no CONTEXT.md exists):**

Use AskUserQuestion:
- header: "No context"
- question: "No CONTEXT.md found for Phase {X}. Plans will use research and requirements only — your design preferences won't be included. Continue or capture context first?"
- options:
  - "Continue without context" — Plan using research + requirements only
  - "Run discuss-phase first" — Capture design decisions before planning

If "Continue without context": Proceed to step 5.
If "Run discuss-phase first": Display `/gsdr:discuss-phase {X}` and exit workflow.

## 5. Handle Research

**Complexity routing for research:**
- If `COMPLEXITY_TIER` is `simple`: SKIP research entirely (set `has_research=true` to prevent re-prompting, but do not spawn researcher). Display: `Skipping research (Simple tier)`
- If `COMPLEXITY_TIER` is `medium`: Spawn a SINGLE researcher with a focused prompt (light research -- see below). Display: `Light research (Medium tier)`
- If `COMPLEXITY_TIER` is `complex`: Full research (current behavior, unchanged). Display: `Full research (Complex tier)`

**Skip if:** `--gaps` flag, `--skip-research` flag, `research_enabled` is false (from init) without `--research` override, OR `COMPLEXITY_TIER` is `simple` (Simple tier skips research).

**If `has_research` is true (from init) AND no `--research` flag:** Use existing, skip to step 6.

**If RESEARCH.md missing OR `--research` flag:**

Display a stage banner. Pick randomly from the RESEARCHING banner pool in @references/ui-brand.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {selected banner text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Pick randomly from single spawning pool in @references/ui-brand.md for the researcher spawn.
```

### Spawn gsdr-phase-researcher

```bash
PHASE_DESC=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" roadmap get-phase "${PHASE}" | jq -r '.section')
```

**Medium tier light research:** If `COMPLEXITY_TIER` is `medium`, modify the research prompt to request focused research only: standard stack, key patterns, and don't-hand-roll guidance. Skip architecture deep-dive, common pitfalls, and state-of-the-art sections. This produces a lighter, faster RESEARCH.md that's sufficient for medium-complexity phases.

Research prompt:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}
Answer: "What do I need to know to PLAN this phase well?"
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /gsdr:discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

<additional_context>
**Phase description:** {phase_description}
**Phase requirement IDs (MUST address):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, research should account for project skill patterns
</additional_context>

<output>
Write to: {phase_dir}/{phase_num}-RESEARCH.md
</output>
```

```
Task(
  prompt=research_prompt,
  subagent_type="gsdr-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

### Handle Researcher Return

- **`## RESEARCH COMPLETE`:** Display confirmation, continue to step 6
- **`## RESEARCH BLOCKED`:** Display blocker, offer: 1) Provide context, 2) Skip research, 3) Abort

## 5.5. Create Validation Strategy

MANDATORY unless `nyquist_validation_enabled` is false.

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**If found:**
1. Read template: `${CLAUDE_SKILL_DIR}/../templates/VALIDATION.md`
2. Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md` (use Write tool)
3. Fill frontmatter: `{N}` → phase number, `{phase-slug}` → slug, `{date}` → current date
4. Verify:
```bash
test -f "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md" && echo "VALIDATION_CREATED=true" || echo "VALIDATION_CREATED=false"
```
5. If `VALIDATION_CREATED=false`: STOP — do not proceed to Step 6
6. If `commit_docs`: `commit-docs "docs(phase-${PHASE}): add validation strategy"`

**If not found:** Warn and continue — plans may fail Dimension 8.

## 6. Check Existing Plans

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

**If exists:** Offer: 1) Add more plans, 2) View existing, 3) Replan from scratch.

## 7. Use Context Paths from INIT

Extract from INIT JSON:

```bash
STATE_PATH=$(printf '%s\n' "$INIT" | jq -r '.state_path // empty')
ROADMAP_PATH=$(printf '%s\n' "$INIT" | jq -r '.roadmap_path // empty')
REQUIREMENTS_PATH=$(printf '%s\n' "$INIT" | jq -r '.requirements_path // empty')
RESEARCH_PATH=$(printf '%s\n' "$INIT" | jq -r '.research_path // empty')
VERIFICATION_PATH=$(printf '%s\n' "$INIT" | jq -r '.verification_path // empty')
UAT_PATH=$(printf '%s\n' "$INIT" | jq -r '.uat_path // empty')
CONTEXT_PATH=$(printf '%s\n' "$INIT" | jq -r '.context_path // empty')
```

## 7.5. Verify Nyquist Artifacts

Skip if `nyquist_validation_enabled` is false.

```bash
VALIDATION_EXISTS=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
```

If missing and Nyquist enabled — ask user:
1. Re-run: `/gsdr:plan-phase {PHASE} --research`
2. Disable Nyquist in config
3. Continue anyway (plans fail Dimension 8)

Proceed to Step 8 only if user selects 2 or 3.

## 8. Spawn gsdr-planner Agent

Display a stage banner. Pick randomly from the PLANNING banner pool in @references/ui-brand.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {selected banner text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Pick randomly from single spawning pool in @references/ui-brand.md for the planner spawn.
```

Planner prompt:

```markdown
<planning_context>
**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsdr:discuss-phase)
- {research_path} (Technical Research)
- {verification_path} (Verification Gaps - if --gaps)
- {uat_path} (UAT Gaps - if --gaps)
</files_to_read>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Complexity tier:** {COMPLEXITY_TIER} (auto-detected | user override)
**Planning constraints from tier:**
- Simple: Create 1 plan with 1-3 tasks, no checkpoint tasks
- Medium: Create 2-3 plans (standard treatment)
- Complex: Create 3+ plans (full treatment, may include TDD plans)

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, plans should account for project skill rules
</planning_context>

<downstream_consumer>
Output consumed by /gsdr:execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsdr-planner",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

## 9. Handle Planner Return

- **`## PLANNING COMPLETE`:** Display plan count. If `--skip-verify` or `plan_checker_enabled` is false (from init): skip to step 13. Otherwise: step 10.
- **`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation (step 12)
- **`## PLANNING INCONCLUSIVE`:** Show attempts, offer: Add context / Retry / Manual

## 9.5. Persist Complexity Tier in Plan Frontmatter

After the planner returns successfully (step 9 yields `## PLANNING COMPLETE`), write the `complexity_tier` field into every created PLAN.md file. This ensures execute-phase can read the actual tier instead of falling back to "not classified".

**Skip if:** `COMPLEXITY_TIER` is empty or unset (backward compatibility -- older invocations without classification).

```bash
if [ -n "$COMPLEXITY_TIER" ]; then
  PLAN_COUNT=0
  for PLAN_FILE in "${PHASE_DIR}"/*-PLAN.md; do
    node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" frontmatter set "$PLAN_FILE" \
      --field complexity_tier --value "$COMPLEXITY_TIER"
    PLAN_COUNT=$((PLAN_COUNT + 1))
  done
  echo "Persisted complexity_tier: ${COMPLEXITY_TIER} to ${PLAN_COUNT} plan(s)"
fi
```

**Important:** This step executes ONLY on the `## PLANNING COMPLETE` path in step 9, not on CHECKPOINT REACHED or PLANNING INCONCLUSIVE paths. The `complexity_tier` field is optional in frontmatter schema -- do NOT add it to required fields in `src/lib/frontmatter.ts` FRONTMATTER_SCHEMAS.plan.

## 10. Spawn gsdr-plan-checker Agent

**Skip if:** `COMPLEXITY_TIER` is `simple` (Simple tasks skip plan checking). Display: `Skipping plan checker (Simple tier)`

**Iteration limits by tier:**
- Medium: max 2 checker iterations
- Complex: max 3 checker iterations (current default)

Display a stage banner. Pick randomly from the VERIFYING banner pool in @references/ui-brand.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {selected banner text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Pick randomly from single spawning pool in @references/ui-brand.md for the checker spawn.
```

Checker prompt:

```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Plans to verify)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsdr:discuss-phase)
- {research_path} (Technical Research — includes Validation Architecture)
</files_to_read>

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — verify plans honor project guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — verify plans account for project skill rules
</verification_context>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsdr-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

## 11. Handle Checker Return

- **`## VERIFICATION PASSED`:** Display confirmation, proceed to step 13.
- **`## ISSUES FOUND`:** Display issues, check iteration count, proceed to step 12.

## 12. Revision Loop (Max Iterations by Tier)

Track `iteration_count` (starts at 1 after initial plan + check).

**Max iterations:** 2 for Medium tier, 3 for Complex tier (Simple tier skips checker entirely -- see Step 10).

**Auto-advance mode (plan-checker auto-retry per user decision):**

Check auto_advance:
```bash
AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

**If auto_advance is active (either flag is "true"):**
- Cap max_iterations at 2 (regardless of complexity tier) to enforce "auto-retry up to 2 retries" locked decision
- If iteration_count < 2: auto-retry silently (send back to planner without user prompt)
- If iteration_count >= 2: pause and ask user -- display remaining issues and offer: 1) Force proceed, 2) Provide guidance and retry, 3) Abandon
- Display: `Auto-retry {N}/2: revising plans...` on each auto-retry

**If auto_advance is NOT active:** Use existing behavior (tier-based max iterations with interactive prompt at limit).

**If iteration_count < max_iterations:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Revision prompt:

```markdown
<revision_context>
**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Existing plans)
- {context_path} (USER DECISIONS from /gsdr:discuss-phase)
</files_to_read>

**Checker issues:** {structured_issues_from_checker}
</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="gsdr-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

After planner returns -> spawn checker again (step 10), increment iteration_count.

**If iteration_count >= max_iterations:**

Display: `Max iterations reached. {N} issues remain:` + issue list

Offer: 1) Force proceed, 2) Provide guidance and retry, 3) Abandon

## 13. Present Final Status

Route to `<offer_next>` OR `auto_advance` depending on flags/config.

## 14. Auto-Advance Check

Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. **Sync chain flag with intent** — if user invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Read both the chain flag and user preference:
   ```bash
   AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true:**

Display a stage banner. Pick randomly from the EXECUTING banner pool in @references/ui-brand.md (auto-advance context):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDR > AUTO-ADVANCING — {selected executing text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans ready. Launching execute-phase...
```

Launch execute-phase using the Skill tool to avoid nested Task sessions (which cause runtime freezes due to deep agent nesting):
```
Skill(skill="gsdr:execute-phase", args="${PHASE} --auto --no-transition")
```

The `--no-transition` flag tells execute-phase to return status after verification instead of chaining further. This keeps the auto-advance chain flat — each phase runs at the same nesting level rather than spawning deeper Task agents.

**Handle execute-phase return:**
- **PHASE COMPLETE** → Display final summary:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSDR ► PHASE ${PHASE} COMPLETE ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /gsdr:discuss-phase ${NEXT_PHASE} --auto
  ```
- **GAPS FOUND / VERIFICATION FAILED** → Display result, stop chain:
  ```
  Auto-advance stopped: Execution needs review.

  Review the output above and continue manually:
  /gsdr:execute-phase ${PHASE}
  ```

**If neither `--auto` nor config enabled:**
Route to `<offer_next>` (existing behavior).

</process>

<offer_next>
Output this markdown directly (not as a code block):

Display a stage banner. Pick randomly from the PHASE COMPLETE banner pool in @references/ui-brand.md (planning context):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {selected banner text} (PLANNED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase {X}** — run all {N} plans

/gsdr:execute-phase {X}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — review plans
- /gsdr:plan-phase {X} --research — re-research first

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] Phase directory created if needed
- [ ] CONTEXT.md loaded early (step 4) and passed to ALL agents
- [ ] Research completed (unless --skip-research or --gaps or exists)
- [ ] gsdr-phase-researcher spawned with CONTEXT.md
- [ ] Existing plans checked
- [ ] gsdr-planner spawned with CONTEXT.md + RESEARCH.md
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] gsdr-plan-checker spawned with CONTEXT.md
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] User sees status between agent spawns
- [ ] User knows next steps
</success_criteria>
