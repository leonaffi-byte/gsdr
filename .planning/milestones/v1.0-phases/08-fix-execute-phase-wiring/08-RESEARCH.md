# Phase 8: Fix Execute-Phase Wiring - Research

**Researched:** 2026-03-16
**Domain:** Execute-phase skill wiring, plugin root file porting, init JSON parsing
**Confidence:** HIGH

## Summary

Phase 8 addresses three specific integration gaps identified in the v1.0 milestone audit (INT-04, INT-05, INT-06). All three are concrete, well-scoped fixes with clear evidence in the codebase. The issues are:

1. **INT-04 (P0 -- Runtime Error):** `$MILESTONE_NAME` is used in `skills/execute-phase/SKILL.md` line 774 (`autonomous generate-report --milestone "$MILESTONE_NAME"`) but is never parsed from the init JSON. The init JSON already emits `milestone_name` (confirmed in `src/lib/init.ts` line 75), but the SKILL.md initialize step (line 37) omits it from the parse list. This causes `cmdGenerateReport` to call `error()` (non-zero exit), preventing end-of-run report generation.

2. **INT-05 (P1 -- Degraded Quality):** `execute-plan.md` is referenced as `@${CLAUDE_SKILL_DIR}/../execute-plan.md` in `skills/execute-phase/SKILL.md` line 313 and `agents/gsdr-planner.md` line 431, but the file does not exist at the plugin root. The GSD source exists at `~/.claude/get-shit-done/workflows/execute-plan.md` (450 lines). Claude Code silently ignores missing `@file:` references, so this is not a hard failure but degrades executor/planner agent quality since they miss context about execution flow.

3. **INT-06 (P1 -- Broken Chain):** `transition.md` is referenced in `skills/execute-phase/SKILL.md` line 804 and `skills/resume-work/SKILL.md` line 253, but does not exist at the plugin root. The GSD source exists at `~/.claude/get-shit-done/workflows/transition.md` (545 lines). Without this file, the auto-advance chain's phase transition behavior is non-deterministic -- the orchestrator must improvise the transition without instructions.

**Primary recommendation:** Fix all three issues in a single plan: add `milestone_name` to the parse list in SKILL.md, port and adapt both GSD workflow files to the GSDR plugin root.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-03 | Remove per-phase human gates during execution | transition.md port ensures `--auto` flag propagates through phase transitions, maintaining gateless autonomous flow |
| AUTO-04 | Autonomous self-verification after each phase completion | execute-plan.md provides executor agents with full verification context; transition.md advances to next phase after verification |
| AUTO-08 | End-of-run summary report | $MILESTONE_NAME parse fix enables `autonomous generate-report --milestone` to succeed at runtime |
| FOUND-03 | Adopt Claude Code Plugin format (skills/ + agents/ structure) | execute-plan.md and transition.md ported to plugin root complete the plugin format adoption |
| FOUND-04 | Preserve context engineering: fresh 200K token context per sub-agent | execute-plan.md at plugin root ensures executor agents receive full execution context via `@file:` references |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsdr-tools.cjs | Current (bundled) | CLI tooling for init, config, autonomous commands | Already built and wired in all skills |
| vitest | Installed | Test framework | Already configured in vitest.config.ts |

### Supporting
No new libraries needed. This phase modifies only markdown skill files and adds markdown documents at the plugin root.

## Architecture Patterns

### Recommended File Structure
```
gsdr/                          (plugin root)
  execute-plan.md              # NEW - ported from GSD, adapted for GSDR
  transition.md                # NEW - ported from GSD, adapted for GSDR
  skills/
    execute-phase/
      SKILL.md                 # MODIFIED - add milestone_name to parse list
    resume-work/
      SKILL.md                 # Already references ./transition.md (line 253)
  agents/
    gsdr-planner.md            # Already references ../execute-plan.md (line 431)
    gsdr-executor.md           # Already references context from execute-plan.md
```

### Pattern 1: Init JSON Field Parsing
**What:** SKILL.md files parse specific fields from init JSON output. The `cmdInitExecutePhase` function already emits `milestone_name` (init.ts line 75) but the SKILL.md initialize step does not list it.
**When to use:** When a SKILL.md needs data from init JSON.
**Fix:**
```markdown
# In skills/execute-phase/SKILL.md, line 37, add milestone_name to parse list:
Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`,
`branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`,
`phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`,
`incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`,
`milestone_name`.
```
**Confidence:** HIGH -- verified that init.ts line 75 emits `milestone_name` and SKILL.md line 774 uses `$MILESTONE_NAME`.

### Pattern 2: GSD-to-GSDR Porting
**What:** GSD workflows reference `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` and use `gsd-*` naming. GSDR uses `${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs` and `gsdr-*` naming.
**When to use:** Every GSD file ported to GSDR.
**Required adaptations:**
```
# Path replacement
$HOME/.claude/get-shit-done/bin/gsd-tools.cjs  -->  ${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs

# Agent name replacement
gsd-executor  -->  gsdr-executor
gsd-planner   -->  gsdr-planner
/gsd:         -->  /gsdr:

# Skill command replacement
SlashCommand("/gsd:...)  -->  /gsdr:...
```
**Confidence:** HIGH -- this is the same pattern used in Phase 1 (01-03-PLAN.md) for all 31 skills.

### Pattern 3: Auto-Advance Chain Flag Propagation
**What:** transition.md must propagate `--auto` flag to ensure the autonomous execution chain continues. The GSD version uses yolo/interactive mode checks; GSDR uses `--auto` flag + `workflow._auto_chain_active` + `workflow.auto_advance` config.
**When to use:** In the ported transition.md.
**Key adaptation:** GSD's `<if mode="yolo">` blocks become GSDR's auto-advance detection pattern:
```bash
AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```
**Confidence:** HIGH -- this exact pattern is used in execute-phase SKILL.md lines 384-386 and 760-762.

### Anti-Patterns to Avoid
- **Leaving GSD paths in ported files:** Every `$HOME/.claude/get-shit-done/` path must be replaced with `${CLAUDE_SKILL_DIR}/../` equivalents. Incomplete porting breaks runtime.
- **Adding execute-plan.md content to the executor agent:** The executor agent (gsdr-executor.md) already has comprehensive execution instructions. execute-plan.md is supplemental context loaded via `@file:` reference, not a replacement. Do not merge them.
- **Duplicating transition logic in execute-phase:** Execute-phase SKILL.md line 804 says "Read and follow transition.md" -- the transition logic lives in transition.md, not inline in execute-phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transition workflow | Custom transition logic | Port GSD's transition.md | GSD's version handles edge cases: incomplete plans, evolve_project, cleanup_handoffs, milestone completion detection |
| Execute-plan context | Recreate from scratch | Port GSD's execute-plan.md | GSD's version has 450 lines of battle-tested execution context |
| Milestone name resolution | Parse STATE.md manually | Use init JSON `milestone_name` field | Already computed by `getMilestoneInfo()` in init.ts |

## Common Pitfalls

### Pitfall 1: Forgetting mode="yolo" to auto-advance adaptation
**What goes wrong:** GSD transition.md uses `<if mode="yolo">` for auto-routing. If ported verbatim, GSDR won't recognize this since GSDR uses `--auto` flag and config-based auto-advance.
**Why it happens:** Direct copy-paste without understanding GSDR's auto-advance mechanism.
**How to avoid:** Replace every `<if mode="yolo">` block with the auto-advance detection pattern from execute-phase SKILL.md (lines 760-762). Replace `<if mode="interactive">` with the non-auto path.
**Warning signs:** transition.md still contains `mode="yolo"` or `mode="interactive"` after porting.

### Pitfall 2: GSD command references left in ported files
**What goes wrong:** Ported files reference `gsd-tools.cjs` or `/gsd:` commands, causing command-not-found errors.
**Why it happens:** Incomplete search-and-replace.
**How to avoid:** After porting, grep both files for `gsd-` and `/gsd:` to confirm zero matches. All should be `gsdr-` and `/gsdr:`.
**Warning signs:** `grep -r "gsd-tools\|/gsd:" execute-plan.md transition.md` returns results.

### Pitfall 3: transition.md invoking SlashCommand
**What goes wrong:** GSD transition.md uses `SlashCommand("/gsd:plan-phase...")` and `SlashCommand("/gsd:discuss-phase...")`. GSDR execute-phase invokes transition.md inline (line 802-804: "Execute the transition workflow inline, do NOT use Task"). The transition should guide the orchestrator to invoke the next skill, not try to invoke it as a SlashCommand.
**Why it happens:** GSD transition.md was designed as a standalone workflow; GSDR runs it inline within execute-phase.
**How to avoid:** In the offer_next_phase step, replace `SlashCommand(...)` with instructions for the orchestrator to invoke the next skill directly, or output instructions for the user if not in auto mode.

### Pitfall 4: execute-plan.md redundancy with gsdr-executor.md
**What goes wrong:** The ported execute-plan.md overlaps heavily with gsdr-executor.md agent instructions, leading to conflicting guidance.
**Why it happens:** GSD's execute-plan.md was the primary execution context. GSDR split this into the executor agent (gsdr-executor.md) plus supplemental execute-plan.md. The agent already contains deviation rules, checkpoint protocol, TDD execution, commit protocol, and summary creation.
**How to avoid:** Port execute-plan.md as supplemental context that adds value beyond what gsdr-executor.md already provides. Focus on: plan identification flow, segment execution patterns (Pattern A/B/C routing), verification failure gates, and codebase map updates -- areas NOT covered by the executor agent.
**Warning signs:** Duplicated deviation rules or checkpoint protocol in both files.

## Code Examples

### Fix 1: Add milestone_name to SKILL.md parse list (INT-04)

Current SKILL.md line 37:
```markdown
Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`.
```

Fixed:
```markdown
Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`, `milestone_name`.
```

This ensures `$MILESTONE_NAME` is available at line 774 when `autonomous generate-report --milestone "$MILESTONE_NAME"` is called.

### Fix 2: Key adaptations for transition.md porting

GSD path:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete "${current_phase}"
```

GSDR path:
```bash
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" phase complete "${PHASE_NUMBER}"
```

GSD auto-route:
```markdown
<if mode="yolo">
Exit skill and invoke SlashCommand("/gsd:plan-phase [X+1] --auto")
</if>
```

GSDR auto-route:
```markdown
If auto-advance active (`--auto` flag, `AUTO_CHAIN`, or `AUTO_CFG`):
  Invoke /gsdr:discuss-phase ${NEXT_PHASE} --auto (if no CONTEXT.md)
  Invoke /gsdr:plan-phase ${NEXT_PHASE} --auto (if CONTEXT.md exists)
```

### Fix 3: Key adaptations for execute-plan.md porting

The executor agent already contains the core execution logic. Focus execute-plan.md on supplemental context:
- Plan identification and routing (Pattern A/B/C)
- Segment execution for checkpointed plans
- Codebase map update protocol
- Previous phase check (blocker review)
- User setup generation

Remove from ported execute-plan.md (already in gsdr-executor.md):
- Deviation rules (complete copy in executor agent lines 110-181)
- Authentication gates (executor agent lines 193-206)
- Checkpoint protocol (executor agent lines 219-285)
- TDD execution (executor agent lines 297-309)
- Task commit protocol (executor agent lines 311-342)
- State updates (executor agent lines 397-449)

## State of the Art

| Old Approach (GSD) | Current Approach (GSDR) | Impact |
|---------------------|-------------------------|--------|
| `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` | `${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs` | All CLI paths must be adapted |
| `mode="yolo"` / `mode="interactive"` | `--auto` flag + config auto_advance | Transition routing logic must change |
| `gsd-executor` agent name | `gsdr-executor` agent name | All agent references must change |
| `/gsd:` skill prefix | `/gsdr:` skill prefix | All slash commands must change |
| `SlashCommand(...)` in transition | Inline execution within orchestrator | transition.md must guide orchestrator, not invoke slash commands |

## Open Questions

1. **How much of execute-plan.md to port?**
   - What we know: gsdr-executor.md already contains 490 lines covering all core execution logic (deviation rules, checkpoints, TDD, commits, summaries, state updates).
   - What's unclear: Whether the full 450-line GSD execute-plan.md adds enough value as supplemental context to justify its size, or whether a reduced version (focused on plan routing, segment execution, codebase map updates) would be better.
   - Recommendation: Port a reduced version. Include only content NOT already in gsdr-executor.md. This means primarily: plan identification (Pattern A/B/C routing), segment execution, previous phase check, codebase map updates, and user setup generation. Estimate ~200-250 lines.

2. **resume-work SKILL.md transition.md reference**
   - What we know: `skills/resume-work/SKILL.md` line 253 references `./transition.md` (relative path, not `${CLAUDE_SKILL_DIR}/../transition.md`).
   - What's unclear: Whether this relative path resolves correctly from the resume-work skill context.
   - Recommendation: Verify the reference path. If the skill's working directory is `skills/resume-work/`, then `./transition.md` would look for `skills/resume-work/transition.md` which is wrong. It should be `${CLAUDE_SKILL_DIR}/../transition.md` to resolve to the plugin root. Fix this path during porting.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (installed) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter verbose` |
| Full suite command | `npx vitest run --reporter verbose` |

### Phase Requirements --> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-03 | transition.md propagates --auto flag | content verification | `npx vitest run tests/execute-phase-wiring.test.ts -t "transition"` | Wave 0 |
| AUTO-04 | execute-plan.md provides executor context | content verification | `npx vitest run tests/execute-phase-wiring.test.ts -t "execute-plan"` | Wave 0 |
| AUTO-08 | milestone_name parsed from init JSON | SKILL.md content check | `npx vitest run tests/execute-phase-wiring.test.ts -t "milestone"` | Wave 0 |
| FOUND-03 | execute-plan.md exists at plugin root | file existence | `npx vitest run tests/execute-phase-wiring.test.ts -t "plugin root"` | Wave 0 |
| FOUND-04 | execute-plan.md referenced correctly by agents | content grep | `npx vitest run tests/execute-phase-wiring.test.ts -t "context"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/execute-phase-wiring.test.ts --reporter verbose`
- **Per wave merge:** `npx vitest run --reporter verbose`
- **Phase gate:** Full suite green before `/gsdr:verify-work`

### Wave 0 Gaps
- [ ] `tests/execute-phase-wiring.test.ts` -- covers all phase requirements (file existence, content verification, reference correctness)

## Sources

### Primary (HIGH confidence)
- `src/lib/init.ts` lines 24-87 -- cmdInitExecutePhase emits milestone_name at line 75
- `skills/execute-phase/SKILL.md` -- full execute-phase orchestrator (830 lines)
- `agents/gsdr-executor.md` -- full executor agent (490 lines)
- `~/.claude/get-shit-done/workflows/execute-plan.md` -- GSD source (450 lines)
- `~/.claude/get-shit-done/workflows/transition.md` -- GSD source (545 lines)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- audit identifying INT-04, INT-05, INT-06

### Secondary (MEDIUM confidence)
- `agents/gsdr-planner.md` line 431 -- confirms execute-plan.md reference
- `skills/resume-work/SKILL.md` line 253 -- confirms transition.md reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing tooling
- Architecture: HIGH -- three well-defined fixes with clear evidence in codebase
- Pitfalls: HIGH -- all pitfalls derived from direct code comparison between GSD and GSDR

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- these are wiring fixes, not fast-moving technology)
