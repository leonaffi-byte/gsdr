---
name: execute-phase
description: "Execute all plans in a phase, or orchestrate cross-phase milestone execution"
argument-hint: "[phase] [--auto] [--gaps-only] [--milestone] [--all]"
context: fork
agent: gsdr-executor
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Task
disable-model-invocation: true
---

<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean — delegates plan execution to subagents.

Supports two modes:
- **Single-phase mode (default):** Execute one phase at a time with wave-based plan ordering. This is the existing behavior.
- **Cross-phase mode (`--milestone` or `--all`):** Orchestrate multiple phases whose dependencies are satisfied, running independent phases in parallel batches. Uses the dependency graph engine to determine phase ordering and agent budget allocation.
</purpose>

<core_principle>
Orchestrator coordinates, not executes. Each subagent loads the full execute-plan context. Orchestrator: discover plans → analyze deps → group waves → spawn agents → handle checkpoints → collect results.
</core_principle>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="initialize" priority="first">
Load all context in one call:

```bash
INIT=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" init execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`, `milestone_name`.

**Display complexity tier (if available):**

Check if complexity was recorded during planning by reading the first PLAN.md in the phase directory:

```bash
PLAN_FILE=$(ls "${PHASE_DIR}"/*-01-PLAN.md 2>/dev/null | head -1)
if [ -n "$PLAN_FILE" ]; then
  COMPLEXITY_TIER=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" frontmatter get "$PLAN_FILE" --field complexity_tier 2>/dev/null | jq -r '.value // empty')
fi
```

If `COMPLEXITY_TIER` is empty, set to `"not classified"`.

Include in the execution banner (the display section that shows phase name, plan count, etc.):

```
Complexity: {COMPLEXITY_TIER or "not classified"}
```

This is display-only -- execute-phase does not change behavior based on tier. The tier already influenced plan-phase decisions (plan count, research depth) and those decisions are baked into the PLAN.md files.

**If `phase_found` is false:** Error — phase directory not found.
**If `plan_count` is 0:** Error — no plans found in phase.
**If `state_exists` is false but `.planning/` exists:** Offer reconstruct or continue.

When `parallelization` is false, plans within a wave execute sequentially.

**Sync chain flag with intent** — if user invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference). Must happen before any config reads (checkpoint handling also reads auto-advance flags):
```bash
if [[ ! "$ARGUMENTS" =~ --auto ]]; then
  node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
fi
```
</step>

<step name="check_cross_phase_mode">
Check if cross-phase execution mode was requested:

```bash
if [[ "$ARGUMENTS" =~ --milestone ]] || [[ "$ARGUMENTS" =~ --all ]]; then
  CROSS_PHASE_MODE=true
else
  CROSS_PHASE_MODE=false
fi
```

**If `CROSS_PHASE_MODE` is true:** Route to `execute_milestone` step. Skip all single-phase steps (handle_branching through aggregate_results).

**If `CROSS_PHASE_MODE` is false:** Proceed with existing single-phase execution (unchanged). All subsequent steps execute as before.

This is the ONLY branching point — cross-phase mode is entirely additive and does not modify any existing step.
</step>

<step name="execute_milestone">
Cross-phase orchestration mode. Executes multiple phases in dependency-respecting batches.

**Prerequisite:** `CROSS_PHASE_MODE` is true (from `check_cross_phase_mode` step).

**1. Generate dependency graph:**

```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" dependency-graph --cwd "$CWD"
```

Read the generated artifact:
```bash
DEPENDENCY_GRAPH=$(cat .planning/dependency-graph.json)
```

Parse: `batches[]` (each with `batch_number`, `phases[]`, `max_agents`, `file_conflicts[]`), `phases[]` (each with `phase_number`, `status`, `plans[]`).

Display overview:
```
## Cross-Phase Execution Plan

**Milestone mode:** Executing all phases with satisfied dependencies

| Batch | Phases | Max Agents | Conflicts |
|-------|--------|------------|-----------|
| 1 | 01, 02 | 5 | None |
| 2 | 03 | 3 | file.ts (03-01, 03-02) |
```

**2. Process each batch sequentially:**

For each batch in `batches[]`:

a. **Check file conflicts:**
   - If `batch.file_conflicts` is non-empty: log warning for each conflict
   ```
   Warning: File conflict detected — {file} modified by plans {plans[]}
   Resolution: Running conflicting plans sequentially within their phase (wave ordering handles this)
   ```
   - File conflicts within a phase are already handled by wave ordering in single-phase mode
   - File conflicts ACROSS phases in the same batch: the conflicting phases must run sequentially, not in parallel. Remove the later phase from this batch and defer it to the next batch.

b. **Check agent budget:**
   - Read `batch.max_agents` (already capped by scheduler at config max, default 5, cap 10)
   - Count total plans across all phases in the batch
   - If total plans > max_agents, use the agent budget from dependency-graph.json:
     ```
     Budget: {allocated}/{total} agents for phase {N}
     ```
   - Each phase gets its proportional share of agents via `distributeAgentBudget` (already computed in dependency-graph.json)

c. **Spawn single-phase execute-phase for each phase in batch:**

   For each phase in `batch.phases`:
   - Skip phases with `status: 'complete'` (already have all SUMMARYs)
   - Spawn execute-phase in single-phase mode (reuse existing behavior):
     ```
     Task(
       subagent_type="gsdr-executor",
       model="{executor_model}",
       prompt="Execute phase {phase_number}. Single-phase mode (no --milestone flag).
         Agent budget: {allocated_agents} concurrent agents for this phase.
         /gsdr:execute-phase {phase_number}"
     )
     ```
   - This preserves within-phase wave execution (PARA-03) because each phase uses the existing single-phase mode which already handles wave-based plan ordering

d. **Wait for all phases in batch to complete.**

e. **Verify batch completion:**
   - For each phase in batch: check that all plan SUMMARYs exist
   - Check for `## Self-Check: FAILED` markers in any SUMMARY
   - **If auto_advance is active AND any phase failed:** Route to `auto_fix_loop` logic. The same diagnose-retry-halt flow applies at the cross-phase level: diagnose the failed phase's plan, retry with diagnostic context, halt if non-improving, continue independent phases in subsequent batches.
   - **If auto_advance is NOT active AND any phase failed:** Report which phase failed, offer "Retry?" or "Continue to next batch?"
   ```
   ## Batch {N} Complete

   | Phase | Plans | Status |
   |-------|-------|--------|
   | 01-foundation | 4/4 | Complete |
   | 02-complexity | 2/2 | Complete |
   ```

f. **Proceed to next batch.**

**3. After all batches complete:**

Run overall completion:
```
## Milestone Execution Complete

**Batches:** {N} | **Phases:** {M}/{total} complete

| Batch | Phases | Status |
|-------|--------|--------|
| 1 | 01, 02 | Complete |
| 2 | 03 | Complete |
```

Then proceed to `aggregate_results` step (which collects all phase results) and normal phase completion flow.

**Key constraint:** Within each phase, the existing wave-based execution is PRESERVED. Cross-phase mode determines WHICH phases to run and WHEN, then delegates to single-phase execute-phase for each. This is the two-level scheduling pattern: phase-level batches (cross-phase) then plan-level waves (within-phase).
</step>

<step name="handle_branching">
Check `branching_strategy` from init:

**"none":** Skip, continue on current branch.

**"phase" or "milestone":** Use pre-computed `branch_name` from init:
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

All subsequent commits go to this branch. User handles merging.
</step>

<step name="validate_phase">
From init JSON: `phase_dir`, `plan_count`, `incomplete_count`.

Report: "Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)"
</step>

<step name="discover_and_group_plans">
Load plan inventory with wave grouping in one call:

```bash
PLAN_INDEX=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Parse JSON for: `phase`, `plans[]` (each with `id`, `wave`, `autonomous`, `objective`, `files_modified`, `task_count`, `has_summary`), `waves` (map of wave number → plan IDs), `incomplete`, `has_checkpoints`.

**Filtering:** Skip plans where `has_summary: true`. If `--gaps-only`: also skip non-gap_closure plans. If all filtered: "No matching incomplete plans" → exit.

Report:
```
## Execution Plan

**Phase {X}: {Name}** — {total_plans} plans across {wave_count} waves

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {from plan objectives, 3-8 words} |
| 2 | 01-03 | ... |
```
</step>

<step name="execute_waves">
Execute each wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`, sequential if `false`.

**For each wave:**

1. **Describe what's being built (BEFORE spawning):**

   Read each plan's `<objective>`. Extract what's being built and why.

   ```
   ---
   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, technical approach, why it matters}

   Spawning {count} agent(s)...
   ---
   ```

   - Bad: "Executing terrain generation plan"
   - Good: "Procedural terrain generator using Perlin noise — creates height maps, biome zones, and collision meshes. Required before vehicle physics can interact with ground."

2. **Irreversible action gate (before spawning):**

   Before spawning the executor agent for each plan, scan for irreversible actions:

   a. Read plan file content.
   b. Extract all `<action>` blocks to a temporary file.
   c. Run deterministic irreversible action check via CLI:
      ```bash
      # Deterministic irreversible action check (reads plan file, matches patterns)
      GATE_RESULT=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous check-irreversible \
        --content-file "$ACTION_BLOCKS_FILE" --raw)
      # Parse GATE_RESULT JSON: if .matched is true, present gate to user
      ```
   d. Load pre-approved actions from `.planning/config.json` key `pre_approved_actions` (if exists).
   e. Filter out pre-approved matches from GATE_RESULT.
   h. **If ANY non-pre-approved match found:**
      - Present gate to user with matched commands listed, **REGARDLESS of auto_advance setting**.
      - Per user decision: "irreversible actions ALWAYS prompt regardless of autonomy mode (AUTO-09)."
      - Wait for user confirmation before spawning executor.
      - Log pre-approved actions that were bypassed for end-of-run report auditability.
      ```
      +------------------------------------------+
      |  IRREVERSIBLE ACTION DETECTED            |
      |                                          |
      |  Plan {plan_id} contains:               |
      |  - `git push --force` (in action block) |
      |  - `npm publish` (in action block)      |
      |                                          |
      |  These actions cannot be undone.         |
      |  Proceed? [y/N]                          |
      +------------------------------------------+
      ```
   i. If no matches: proceed normally.

3. **Spawn executor agents:**

   Pass paths only — executors read files themselves with their fresh 200k context.
   This keeps orchestrator context lean (~10-15%).

   ```
   Task(
     subagent_type="gsdr-executor",
     model="{executor_model}",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
       </objective>

       <execution_context>
       @${CLAUDE_SKILL_DIR}/../execute-plan.md
       @${CLAUDE_SKILL_DIR}/../templates/summary.md
       @${CLAUDE_SKILL_DIR}/../references/checkpoints.md
       @${CLAUDE_SKILL_DIR}/../references/tdd.md
       </execution_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       - ./CLAUDE.md (Project instructions, if exists — follow project-specific guidelines and coding conventions)
       - .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
       </files_to_read>

       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
       </success_criteria>
     "
   )
   ```

4. **Wait for all agents in wave to complete.**

5. **Report completion — spot-check claims first:**

   For each SUMMARY.md:
   - Verify first 2 files from `key-files.created` exist on disk
   - Check `git log --oneline --all --grep="{phase}-{plan}"` returns ≥1 commit
   - Check for `## Self-Check: FAILED` marker

   If ANY spot-check fails: route to `auto_fix_loop` step (if auto_advance active) or manual failure handler (step 6).

   If pass:
   ```
   ---
   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built — from SUMMARY.md}
   {Notable deviations, if any}

   {If more waves: what this enables for next wave}
   ---
   ```

   - Bad: "Wave 2 complete. Proceeding to Wave 3."
   - Good: "Terrain system complete — 3 biome types, height-based texturing, physics collision meshes. Vehicle physics (Wave 3) can now reference ground surfaces."

6. **Handle failures (manual mode):**

   **Known Claude Code bug (classifyHandoffIfNeeded):** If an agent reports "failed" with error containing `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a GSDR or agent issue. The error fires in the completion handler AFTER all tool calls finish. In this case: run the same spot-checks as step 4 (SUMMARY.md exists, git commits present, no Self-Check: FAILED). If spot-checks PASS → treat as **successful**. If spot-checks FAIL → treat as real failure below.

   For real failures (when auto_advance is NOT active): report which plan failed → ask "Continue?" or "Stop?" → if continue, dependent plans may also fail. If stop, partial completion report.

   When auto_advance IS active: route to `auto_fix_loop` step instead of asking user.

7. **Execute checkpoint plans between waves** — see `<checkpoint_handling>`.

8. **Proceed to next wave.**
</step>

<step name="auto_fix_loop">
**Autonomous failure diagnosis and retry.** Activates when a plan execution fails (spot-check failure or agent crash) AND auto_advance is active. If auto_advance is NOT active, fall through to existing manual failure handling in `execute_waves` step 5.

**Entry condition check:**
```bash
AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

If neither `AUTO_CHAIN` nor `AUTO_CFG` is `"true"`: skip this step, use existing manual failure handler (step 5).

**1. FAILURES.md initialization:**

On first failure, initialize the failure entry via CLI (creates FAILURES.md if it does not exist):
```bash
# Normalize the raw error for the initial signature
ERROR_SIG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous normalize-error "$RAW_ERROR" --raw)

# Initialize failure entry (creates FAILURES.md if needed)
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous append-failure \
  --path ".planning/FAILURES.md" \
  --entry '{"plan_id":"'"$PLAN_ID"'","status":"active","error_signature":"'"$ERROR_SIG"'","attempts":[],"strike_count":0}'
```

**2. Retry loop (max 3 attempts per failure):**

Track: `halted_plans` set (plans that exhausted retries or hit 2-strike halt).

For attempt = 1 to 3:

a. **Write/update failure entry in FAILURES.md** (orchestrator writes, NEVER agents -- prevents race conditions during parallel execution):
   ```bash
   # Normalize error for comparison
   ERROR_SIG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous normalize-error "$RAW_ERROR" --raw)

   # Append or update failure entry
   node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous append-failure \
     --path ".planning/FAILURES.md" \
     --entry '{"plan_id":"'"$PLAN_ID"'","status":"active","error_signature":"'"$ERROR_SIG"'","attempts":[],"strike_count":0}'
   ```

b. **Spawn gsdr-debugger for diagnosis** using `find_root_cause_only` goal:
   ```
   Task(
     prompt="<objective>Diagnose failure in plan {plan_id}</objective>
       <symptoms>
       expected: Plan executes successfully
       actual: {error_output_last_50_lines}
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
   Per user decision: "spawn a debug agent first to diagnose the failure, then re-run with diagnostic context (not blind re-run)".

c. **Re-spawn executor with diagnostic context:**
   ```
   Task(
     prompt="Execute plan {plan_id}. PREVIOUS FAILURE CONTEXT:
       Root cause: {diagnosis.root_cause}
       Previous solutions that DID NOT WORK: {list from FAILURES.md}
       DO NOT repeat these approaches.
       Read: .planning/FAILURES.md for full attempt history.
       [full executor prompt from execute_waves step 2]",
     subagent_type="gsdr-executor",
     model="{executor_model}"
   )
   ```
   Per user decision: "track what was tried across attempts; explicitly instruct the next attempt to NOT repeat previous solutions".

d. **Check result:**
   - **Success (spot-check passes)?** Update status to "resolved" and break loop:
     ```bash
     node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous update-status \
       --path ".planning/FAILURES.md" --plan-id "$PLAN_ID" --status "resolved" \
       --attempt '{"attempt":'"$ATTEMPT_NUM"',"timestamp":"'"$NOW"'","error":"'"$CURR_ERROR"'","diagnosis":"'"$DIAG"'","solution_tried":"'"$SOL"'","result":"resolved"}'
     ```
   - **Compare with previous attempt using CLI:**
     ```bash
     # Normalize current error
     CURR_SIG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous normalize-error "$CURR_ERROR" --raw)

     # Check if this attempt is non-improving (strike detection)
     IS_STRIKE=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous is-non-improving \
       --prev '{"attempt":'"$PREV_ATTEMPT_NUM"',"timestamp":"'"$PREV_TS"'","error":"'"$PREV_ERROR"'","diagnosis":"'"$PREV_DIAG"'","solution_tried":"'"$PREV_SOL"'","result":"'"$PREV_RESULT"'"}' \
       --curr '{"attempt":'"$ATTEMPT_NUM"',"timestamp":"'"$NOW"'","error":"'"$CURR_ERROR"'","diagnosis":"'"$DIAG"'","solution_tried":"'"$SOL"'","result":"'"$RESULT"'"}' \
       --prev-sig "$PREV_SIG" --curr-sig "$CURR_SIG" --raw)

     if [ "$IS_STRIKE" = "true" ]; then
       # Increment strike_count. If >= 2, halt this fix path.
     fi
     ```
     Per user decision: "same error signature OR no test improvement -- either counts as a strike"
   - **If strike_count >= 2:** Halt this fix path. Update status to "halted":
     ```bash
     node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous update-status \
       --path ".planning/FAILURES.md" --plan-id "$PLAN_ID" --status "halted" \
       --attempt '{"attempt":'"$ATTEMPT_NUM"',"timestamp":"'"$NOW"'","error":"'"$CURR_ERROR"'","diagnosis":"'"$DIAG"'","solution_tried":"'"$SOL"'","result":"'"$RESULT"'"}'
     ```
     Break loop.
   - **Otherwise:** Update FAILURES.md with new attempt record and continue loop:
     ```bash
     node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous update-status \
       --path ".planning/FAILURES.md" --plan-id "$PLAN_ID" --status "active" \
       --attempt '{"attempt":'"$ATTEMPT_NUM"',"timestamp":"'"$NOW"'","error":"'"$CURR_ERROR"'","diagnosis":"'"$DIAG"'","solution_tried":"'"$SOL"'","result":"'"$RESULT"'"}'
     ```

**3. After loop exits (resolved or halted):**

- **If resolved:** Continue to next wave normally.
- **If halted:** Add plan to `halted_plans` set. Before spawning each subsequent plan, check if any of its `depends_on` entries are in the `halted_plans` set:
  - **If yes:** Skip plan. Write "skipped_upstream_failure" entry via CLI:
    ```bash
    node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous append-failure \
      --path ".planning/FAILURES.md" \
      --entry '{"plan_id":"'"$DEPENDENT_PLAN_ID"'","status":"skipped_upstream_failure","error_signature":"","attempts":[],"strike_count":0,"blocked_by":"'"$HALTED_PLAN_ID"'"}'
    ```
  - **If no:** Execute normally.
  - Per user decision: "After two-strike halt: queue the failed task and continue executing independent tasks -- don't stop everything."

**4. Deferred task handling at end-of-run:**

After all waves complete, read all failures to check dependency status:
```bash
# Read all failures to check dependency status
FAILURES=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous read-failures --path ".planning/FAILURES.md" --raw)
# Parse JSON to check if depends_on plans are in halted status
```

For each entry with `status: skipped_upstream_failure`:
- Check if their `blocked_by` plan was resolved during execution (status is "resolved" in the parsed JSON).
- **If upstream resolved:** Attempt execution (one try, no retry loop). If it succeeds, update status to "resolved". If it fails, update status to "halted" (both via `autonomous update-status`).
- **If upstream still halted:** Leave as "skipped_upstream_failure". Do NOT attempt execution against still-broken upstreams.
- Per research pitfall 3: "Before retrying deferred tasks at end-of-run, check if their upstream dependency was resolved in FAILURES.md."

**5. Context management:**

Keep diagnostic context in FAILURES.md (on disk), not in orchestrator memory. When re-spawning an executor, reference the FAILURES.md file path rather than inlining all diagnostic content. The executor reads it fresh with its own 200K context. Per research pitfall 1: "Keep diagnostic context in FAILURES.md (on disk), not in orchestrator memory."
</step>

<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Auto-mode checkpoint handling:**

Read auto-advance config (chain flag + user preference):
```bash
AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

When executor returns a checkpoint AND (`AUTO_CHAIN` is `"true"` OR `AUTO_CFG` is `"true"`):
- **human-verify** → Auto-spawn continuation agent with `{user_response}` = `"approved"`. Log `⚡ Auto-approved checkpoint`.
- **decision** → Auto-spawn continuation agent with `{user_response}` = first option from checkpoint details. Log `⚡ Auto-selected: [option]`.
- **human-action** → Present to user (existing behavior below). Auth gates cannot be automated.

**Standard flow (not auto-mode, or human-action type):**

1. Spawn agent for checkpoint plan
2. Agent runs until checkpoint task or auth gate → returns structured state
3. Agent return includes: completed tasks table, current task + blocker, checkpoint type/details, what's awaited
4. **Present to user:**
   ```
   ## Checkpoint: [Type]

   **Plan:** 03-03 Dashboard Layout
   **Progress:** 2/3 tasks complete

   [Checkpoint Details from agent return]
   [Awaiting section from agent return]
   ```
5. User responds: "approved"/"done" | issue description | decision selection
6. **Spawn continuation agent (NOT resume)** using continuation-prompt.md template:
   - `{completed_tasks_table}`: From checkpoint return
   - `{resume_task_number}` + `{resume_task_name}`: Current task
   - `{user_response}`: What user provided
   - `{resume_instructions}`: Based on checkpoint type
7. Continuation agent verifies previous commits, continues from resume point
8. Repeat until plan completes or user stops

**Why fresh agent, not resume:** Resume relies on internal serialization that breaks with parallel tool calls. Fresh agents with explicit state are more reliable.

**Checkpoints in parallel waves:** Agent pauses and returns while other parallel agents may complete. Present checkpoint, spawn continuation, wait for all before next wave.
</step>

<step name="aggregate_results">
After all waves:

```markdown
## Phase {X}: {Name} Execution Complete

**Waves:** {N} | **Plans:** {M}/{total} complete

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ Complete |
| CP | plan-03 | ✓ Verified |
| 2 | plan-04 | ✓ Complete |

### Plan Details
1. **03-01**: [one-liner from SUMMARY.md]
2. **03-02**: [one-liner from SUMMARY.md]

### Issues Encountered
[Aggregate from SUMMARYs, or "None"]
```
</step>

<step name="close_parent_artifacts">
**For decimal/polish phases only (X.Y pattern):** Close the feedback loop by resolving parent UAT and debug artifacts.

**Skip if** phase number has no decimal (e.g., `3`, `04`) — only applies to gap-closure phases like `4.1`, `03.1`.

**1. Detect decimal phase and derive parent:**
```bash
# Check if phase_number contains a decimal
if [[ "$PHASE_NUMBER" == *.* ]]; then
  PARENT_PHASE="${PHASE_NUMBER%%.*}"
fi
```

**2. Find parent UAT file:**
```bash
PARENT_INFO=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" find-phase "${PARENT_PHASE}" --raw)
# Extract directory from PARENT_INFO JSON, then find UAT file in that directory
```

**If no parent UAT found:** Skip this step (gap-closure may have been triggered by VERIFICATION.md instead).

**3. Update UAT gap statuses:**

Read the parent UAT file's `## Gaps` section. For each gap entry with `status: failed`:
- Update to `status: resolved`

**4. Update UAT frontmatter:**

If all gaps now have `status: resolved`:
- Update frontmatter `status: diagnosed` → `status: resolved`
- Update frontmatter `updated:` timestamp

**5. Resolve referenced debug sessions:**

For each gap that has a `debug_session:` field:
- Read the debug session file
- Update frontmatter `status:` → `resolved`
- Update frontmatter `updated:` timestamp
- Move to resolved directory:
```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/{slug}.md .planning/debug/resolved/
```

**6. Commit updated artifacts:**
```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" --files .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="verify_phase_goal">
**This step ALWAYS runs** — verification is unconditional, not gated by auto_advance. Whether the user ran manually, via --auto flag, or via auto_advance config, verification executes after every phase completion. This prevents regressions where someone disables auto_advance and assumes verification is also disabled.

Verify phase achieved its GOAL, not just completed tasks.

```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Create VERIFICATION.md.",
  subagent_type="gsdr-verifier",
  model="{verifier_model}"
)
```

Read status:
```bash
grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' '
```

| Status | Action |
|--------|--------|
| `passed` | → update_roadmap |
| `human_needed` | Present items for human testing, get approval or feedback |
| `gaps_found` | Present gap summary, offer `/gsdr:plan-phase {phase} --gaps` |

**If human_needed:**
```
## ✓ Phase {X}: {Name} — Human Verification Required

All automated checks passed. {N} items need human testing:

{From VERIFICATION.md human_verification section}

"approved" → continue | Report issues → gap closure
```

**If gaps_found:**
```
## ⚠ Phase {X}: {Name} — Gaps Found

**Score:** {N}/{M} must-haves verified
**Report:** {phase_dir}/{phase_num}-VERIFICATION.md

### What's Missing
{Gap summaries from VERIFICATION.md}

---
## ▶ Next Up

`/gsdr:plan-phase {X} --gaps`

<sub>`/clear` first → fresh context window</sub>

Also: `cat {phase_dir}/{phase_num}-VERIFICATION.md` — full report
Also: `/gsdr:verify-work {X}` — manual testing first
```

Gap closure cycle: `/gsdr:plan-phase {X} --gaps` reads VERIFICATION.md → creates gap plans with `gap_closure: true` → user runs `/gsdr:execute-phase {X} --gaps-only` → verifier re-runs.
</step>

<step name="update_roadmap">
**Mark phase complete and update all tracking files:**

```bash
COMPLETION=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" phase complete "${PHASE_NUMBER}")
```

The CLI handles:
- Marking phase checkbox `[x]` with completion date
- Updating Progress table (Status → Complete, date)
- Updating plan count to final
- Advancing STATE.md to next phase
- Updating REQUIREMENTS.md traceability

Extract from result: `next_phase`, `next_phase_name`, `is_last_phase`.

```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="offer_next">

**Exception:** If `gaps_found`, the `verify_phase_goal` step already presents the gap-closure path (`/gsdr:plan-phase {X} --gaps`). No additional routing needed — skip auto-advance.

**No-transition check (spawned by auto-advance chain):**

Parse `--no-transition` flag from $ARGUMENTS.

**If `--no-transition` flag present:**

Execute-phase was spawned by plan-phase's auto-advance. Do NOT run transition.md.
After verification passes and roadmap is updated, return completion status to parent:

```
## PHASE COMPLETE

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Plans: ${completed_count}/${total_count}
Verification: {Passed | Gaps Found}

[Include aggregate_results output]
```

STOP. Do not proceed to auto-advance or transition.

**If `--no-transition` flag is NOT present:**

**Auto-advance detection:**

1. Parse `--auto` flag from $ARGUMENTS
2. Read both the chain flag and user preference (chain flag already synced in init step):
   ```bash
   AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true (AND verification passed with no gaps):**

**End-of-run report generation (AUTO-08):**

If `is_last_phase` is true (this is the final phase in the auto-advance chain) OR cross-phase mode (--milestone/--all) has completed all batches:

1. Generate deterministic end-of-run report via CLI:
   ```bash
   # Generate deterministic end-of-run report
   node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous generate-report \
     --milestone "$MILESTONE_NAME" --raw > .planning/END-OF-RUN-REPORT.md
   ```
3. Display summary to user:
   ```
   ╔══════════════════════════════════════════╗
   ║  END-OF-RUN REPORT GENERATED            ║
   ║  See: .planning/END-OF-RUN-REPORT.md    ║
   ╚══════════════════════════════════════════╝
   ```
4. Commit the report:
   ```bash
   node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" commit "docs: generate end-of-run report" --files .planning/END-OF-RUN-REPORT.md
   ```

Only generate report when:
- Auto-advance chain reaches last phase, OR
- Cross-phase --milestone/--all completes all batches
NOT for single manual phase execution (phase completion output is sufficient).

**If NOT last phase (more phases to execute):**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → TRANSITION             ║
║  Phase {X} verified, continuing chain    ║
╚══════════════════════════════════════════╝
```

Execute the transition workflow inline (do NOT use Task — orchestrator context is ~10-15%, transition needs phase completion data already in context):

Read and follow `${CLAUDE_SKILL_DIR}/../transition.md`, passing through the `--auto` flag so it propagates to the next phase invocation.

**If neither `--auto` nor `AUTO_CFG` is true:**

The workflow ends. The user runs `/gsdr:progress` or invokes the transition workflow manually.
</step>

</process>

<context_efficiency>
Orchestrator: ~10-15% context. Subagents: fresh 200k each. No polling (Task blocks). No context bleed.
</context_efficiency>

<failure_handling>
- **classifyHandoffIfNeeded false failure:** Agent reports "failed" but error is `classifyHandoffIfNeeded is not defined` → Claude Code bug, not GSD. Spot-check (SUMMARY exists, commits present) → if pass, treat as success
- **Agent fails mid-plan:** Missing SUMMARY.md → report, ask user how to proceed
- **Dependency chain breaks:** Wave 1 fails → Wave 2 dependents likely fail → user chooses attempt or skip
- **All agents in wave fail:** Systemic issue → stop, report for investigation
- **Checkpoint unresolvable:** "Skip this plan?" or "Abort phase execution?" → record partial progress in STATE.md
</failure_handling>

<resumption>
Re-run `/gsdr:execute-phase {phase}` → discover_plans finds completed SUMMARYs → skips them → resumes from first incomplete plan → continues wave execution.

STATE.md tracks: last completed plan, current wave, pending checkpoints.
</resumption>
