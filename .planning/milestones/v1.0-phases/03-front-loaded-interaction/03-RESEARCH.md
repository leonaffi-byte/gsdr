# Phase 3: Front-Loaded Interaction - Research

**Researched:** 2026-03-15
**Domain:** Workflow orchestration, skill modification, autonomous execution pipeline
**Confidence:** HIGH

## Summary

Phase 3 consolidates all human interaction into a single upfront session during `new-project`, then makes the system run autonomously through planning, execution, and verification without pausing for human input. This is primarily a skill-layer refactoring problem -- the underlying TypeScript tooling (config, init, complexity) already supports most of what is needed, and the auto-advance chain infrastructure (`--auto`, `workflow.auto_advance`, `_auto_chain_active`) already exists. The work divides into three clear areas: (1) extending `new-project` to gather per-phase CONTEXT.md decisions after roadmap creation, (2) adding preliminary codebase analysis before questioning, and (3) making auto-advance the default path with gate removal.

The codebase is well-structured for this change. Skills are markdown-based instruction files (SKILL.md) that control orchestration behavior. The TypeScript tooling in `src/lib/` provides CLI commands for config management, complexity classification, and init bootstrapping. Changes span both layers -- skill instructions define the new workflow, and TypeScript tooling may need minor extensions (e.g., default `auto_advance: true` in config creation).

**Primary recommendation:** Implement as three coordinated changes: (1) extend new-project SKILL.md with a post-roadmap questioning loop, (2) add pre-questioning analysis step to new-project, (3) flip auto_advance default to true and ensure all gate skills auto-approve when the flag is set.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extend `new-project` skill to capture per-phase context during the initial session -- after roadmap creation, iterate through each phase and gather CONTEXT.md decisions
- Question depth is complexity-adaptive: Simple phases get 1-2 quick questions, Medium phases get brief discussion, Complex phases get full discuss-phase treatment with gray areas and deep-dives
- `discuss-phase` remains available as a standalone escape hatch for mid-project course corrections -- doesn't break autonomy, it's opt-in
- With `--auto @document.md`, the system extracts per-phase context from the provided document and generates CONTEXT.md for each phase automatically -- no interactive questions
- Before asking questions, the system analyzes: codebase (existing patterns, assets, integration points), classifies complexity per phase, and cross-references requirements
- Analysis is visible with progress indicators ("Analyzing codebase... Classifying phases... Preparing questions...")
- Brief summary shown to user before questioning starts ("Found 12 components, 3 API routes, classified as Medium complexity") -- details used internally to craft better questions
- For brownfield projects, analysis detects existing capabilities and skips questions about solved problems
- All three gates (discuss-phase, plan approval, verify-work) are auto-approved after the upfront session -- gates exist but don't block
- Auto-advance (`workflow.auto_advance`) becomes DEFAULT ON for new projects -- users can toggle off via /gsdr:settings
- Plan-checker rejections trigger automatic planner revision, up to 2 retries -- after 2 failed attempts, pause and ask user
- Phase transitions are fully automated: roadmap updated, state advanced, PROJECT.md evolved based on summaries -- no approval needed
- After upfront session, system ONLY pauses for context window limits -- all decision-making is autonomous based on captured context
- On context window limit: auto-resume with handoff file -- write .continue-here.md with full state, auto-invoke resume-work to pick up seamlessly
- Progress visibility: stage banners only (GSD > PLANNING PHASE 3, GSD > EXECUTING WAVE 2) -- no questions or prompts
- Verification gaps trigger auto gap closure: auto-plan fixes, auto-execute, re-verify. Only stops if gap closure fails twice

### Claude's Discretion
- Internal implementation of the new-project questioning loop (how to iterate through phases)
- How to handle the transition from "preliminary analysis" to "questioning" UX
- Exact format of the analysis summary shown before questioning
- How to handle edge cases where context window limit is hit during the upfront session itself

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | Front-loaded interaction: all user questions asked upfront in a single 10-15 minute session | Extend new-project SKILL.md with post-roadmap per-phase questioning loop; reuse discuss-phase gray area identification within new-project; complexity-adaptive question depth using existing classifyComplexity() |
| AUTO-02 | System does preliminary analysis to identify unknowns before questioning | Add codebase analysis step to new-project before questioning; use existing codebase mapping patterns (map-codebase skill, grep-based scout from discuss-phase); classify complexity per phase using COMPLEXITY_TIERS |
| AUTO-03 | Remove per-phase human gates (no discuss/approve/verify stops during execution) | Change auto_advance default to true in config.ts hardcoded defaults; ensure discuss-phase, plan-phase approval, verify-work all auto-approve when auto_advance is true; plan-checker auto-retries (already exists, max 2-3 iterations) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.0 | Source language for tooling | Already used in project |
| esbuild | ^0.24.0 | Bundle to CJS | Already used in project |
| vitest | ^3.0.0 | Test framework | Already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs/path | built-in | File operations for config, CONTEXT.md writing | All tooling changes |
| child_process | built-in | Git operations via gsdr-tools commit | Committing generated CONTEXT.md files |

### Alternatives Considered
No new libraries needed. This phase modifies existing skill instructions (markdown) and makes minor changes to existing TypeScript tooling. The architecture is already in place.

## Architecture Patterns

### Modification Map

The changes span two layers with clear boundaries:

```
skills/
  new-project/SKILL.md     # PRIMARY: Add post-roadmap questioning loop + preliminary analysis
  discuss-phase/SKILL.md    # MINOR: Ensure auto-approve path works when auto_advance=true
  plan-phase/SKILL.md       # MINOR: Plan-checker auto-retry already exists; verify auto-approve
  execute-phase/SKILL.md    # MINOR: Verify auto-approve path for verification gates
  verify-work/SKILL.md      # MINOR: Add auto-approve path for UAT when auto_advance=true
  settings/SKILL.md         # MINOR: Update auto-advance default display (was "No (Recommended)", flip to "Yes")

src/lib/
  config.ts                 # Add auto_advance: true to hardcoded workflow defaults
  init.ts                   # cmdInitNewProject may need to expose phase list for questioning loop
  complexity.ts             # Already exports classifyComplexity() and COMPLEXITY_TIERS -- no changes needed
```

### Pattern 1: Post-Roadmap Questioning Loop in new-project

**What:** After roadmap creation (Step 8), iterate through each phase from ROADMAP.md, classify its complexity, and gather CONTEXT.md decisions per phase.

**When to use:** Always during interactive new-project (not auto mode). Auto mode with `--auto @document.md` extracts context from the document instead.

**Implementation approach:**

```markdown
## 8.5. Upfront Phase Context Gathering (NEW STEP)

**If auto mode:** Extract per-phase context from provided document for ALL phases.
Generate CONTEXT.md for each phase by mapping document sections to phase decisions.
Skip interactive questioning entirely.

**If interactive mode:**

Display banner:
GSDR > GATHERING PHASE CONTEXT

**Step 1: Preliminary Analysis**
- If brownfield (needs_codebase_map or has_codebase_map): read codebase maps or run targeted grep
- For each phase in ROADMAP.md:
  - Classify complexity using classifyComplexity()
  - Cross-reference requirements against existing codebase capabilities
- Display summary: "Found N components, M API routes. Phase complexity: [table]"

**Step 2: Per-Phase Questioning**
For each phase (in order):
  - Read phase goal and requirements from ROADMAP.md
  - Route by complexity tier:
    - Simple: 1-2 AskUserQuestion calls covering key decisions only
    - Medium: Brief gray area identification + 3-4 questions
    - Complex: Full discuss-phase treatment (gray area identification, multi-round discussion)
  - Write CONTEXT.md to phase directory
  - Commit CONTEXT.md

**Step 3: Set Auto-Advance**
- Set workflow.auto_advance = true (default for new projects)
- Set workflow._auto_chain_active = true
```

### Pattern 2: Reusing discuss-phase Logic Inside new-project

**What:** The gray area identification and AskUserQuestion flow from discuss-phase SKILL.md should be reused, not duplicated, inside new-project's questioning loop.

**When to use:** For Complex-tier phases during the upfront session.

**Implementation approach:** The new-project skill should reference the same patterns (gray area analysis, scope guardrail, question design rules) but inline them as a condensed version rather than spawning discuss-phase as a sub-skill. This avoids nesting depth issues (see #686 in codebase -- deep agent nesting causes runtime freezes).

Key elements to reuse from discuss-phase:
- `<gray_area_identification>`: Phase-specific gray area generation based on domain type
- `<discuss_areas>`: 4-question-then-check pattern
- `<write_context>`: CONTEXT.md template structure
- `<scope_guardrail>`: Prevent scope creep during questioning

### Pattern 3: Auto-Approve Gate Pattern

**What:** Each gate skill (discuss-phase, plan-phase approval, verify-work) checks auto_advance config and auto-approves when enabled.

**When to use:** After the upfront session completes, all subsequent skill invocations should flow through without human blocking.

**Existing auto-advance infrastructure:**
- `--auto` flag on skill arguments
- `workflow.auto_advance` in config.json (persistent user preference)
- `workflow._auto_chain_active` in config.json (ephemeral chain flag)
- All three skills already have `<step name="auto_advance">` sections
- discuss-phase already auto-advances to plan-phase when auto is active
- plan-phase already auto-advances to execute-phase when auto is active
- execute-phase already auto-advances via transition.md when auto is active

**What needs to change:**
- Default value of `auto_advance` flips from `false` to `true` for new projects
- Settings skill flips recommended option from "No" to "Yes" for auto-advance
- verify-work needs auto-approve path (currently always interactive)
- Plan-checker already has auto-retry loop (max 2-3 iterations) -- verify it works with auto_advance

### Pattern 4: Preliminary Analysis Before Questioning

**What:** Before asking any phase questions, analyze the codebase and classify each phase to make questions informed.

**When to use:** At the start of Step 8.5 in new-project, before the per-phase questioning loop.

**Implementation approach:**

For brownfield projects:
1. Check if codebase maps exist (`.planning/codebase/`)
2. If yes, read ARCHITECTURE.md, CONVENTIONS.md, STACK.md
3. If no, run targeted grep/glob to identify key patterns
4. For each phase, identify what existing code already handles

For all projects:
1. For each phase in ROADMAP.md, run complexity classification
2. Build a phase-complexity table
3. Present summary to user

### Anti-Patterns to Avoid
- **Spawning discuss-phase as a sub-skill from new-project:** This creates deep agent nesting that causes runtime freezes (issue #686). Instead, inline the questioning logic.
- **Re-implementing complexity classification:** Use the existing `classifyComplexity()` from `src/lib/complexity.ts`. Don't build a separate classifier.
- **Asking users about implementation details during upfront session:** Keep questions at the vision/decision level. Technical choices are for research and planning phases.
- **Removing gates entirely:** Gates should still exist for manual invocations. Only auto-approve when `auto_advance` is active.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Complexity classification | Custom phase complexity logic | `classifyComplexity()` from complexity.ts | Already has signal framework, tier configs, LLM prompt template |
| Config management | Custom config read/write | `config-set` and `config-get` CLI commands | Handles nested dot-notation, type parsing, file I/O |
| Phase discovery | Custom ROADMAP.md parsing | `roadmap get-phase` CLI command | Already extracts phase info, requirements, goals |
| Gray area identification | New questioning framework | Reuse discuss-phase patterns | Battle-tested question design, scope guardrails |
| Auto-advance chain | New workflow chaining | Existing `--auto` + `_auto_chain_active` + `auto_advance` flags | Already handles chain propagation, flag syncing |
| CONTEXT.md generation | Custom template | Reuse CONTEXT.md template from discuss-phase | Consistent format that downstream agents expect |
| Codebase analysis | New analysis engine | Reuse scout_codebase pattern from discuss-phase + map-codebase skill | Already identifies assets, patterns, integration points |

**Key insight:** Almost all the infrastructure exists. This phase is about wiring existing components together in a new flow (post-roadmap questioning) and flipping a default (auto_advance = true).

## Common Pitfalls

### Pitfall 1: Context Window Exhaustion During Upfront Session
**What goes wrong:** The upfront questioning session iterates through many phases, consuming context window budget with each phase's analysis and questions.
**Why it happens:** Each phase requires reading ROADMAP.md section, analyzing codebase, classifying complexity, and conducting multi-round questioning.
**How to avoid:** Keep the questioning loop lightweight. Simple phases should take 1-2 tool calls max. Medium phases 3-4. Only Complex phases get full treatment. Estimated context per phase: Simple ~500 tokens, Medium ~2K tokens, Complex ~8K tokens. For 5-8 phases, total is ~15-30K tokens which is well within 200K budget.
**Warning signs:** If the skill is reading large files repeatedly or spawning sub-agents, context usage will spike.

### Pitfall 2: Deep Agent Nesting Causing Freezes
**What goes wrong:** Spawning discuss-phase as a sub-skill from new-project, or spawning plan-phase from discuss-phase from new-project, creates deeply nested agent chains that freeze the runtime.
**Why it happens:** Known Claude Code issue (#686) with deep Task nesting.
**How to avoid:** Inline questioning logic in new-project rather than delegating to discuss-phase. Use Skill() instead of Task() for flat chaining (as existing auto-advance already does). Keep nesting to max 2 levels.
**Warning signs:** Runtime hangs after spawning a sub-agent that itself spawns sub-agents.

### Pitfall 3: Auto-Mode Document Extraction Missing Phase Context
**What goes wrong:** When `--auto @document.md` is used, the system generates CONTEXT.md files for each phase but misses important decisions because the document doesn't map cleanly to phases.
**Why it happens:** Documents are organized by topic/feature, not by implementation phase. The roadmap-to-document mapping is lossy.
**How to avoid:** After roadmap creation, iterate through each phase and extract relevant sections from the document by matching requirement IDs, feature names, and keywords from the phase goal. Mark ambiguous areas as "Claude's Discretion" rather than guessing.
**Warning signs:** Generated CONTEXT.md files have very few locked decisions and excessive "Claude's Discretion" sections.

### Pitfall 4: Verify-Work Still Blocking in Auto Mode
**What goes wrong:** After execution completes, verify-work presents interactive UAT tests that block the autonomous pipeline.
**Why it happens:** verify-work currently has no auto-approve path. It always presents tests one-at-a-time and waits for user response.
**How to avoid:** When auto_advance is active, verify-work should use the automated verifier (gsdr-verifier) path from execute-phase's `verify_phase_goal` step instead of interactive UAT. The automated verifier already produces VERIFICATION.md with pass/gaps_found status. Only fall back to interactive UAT when auto_advance is false.
**Warning signs:** The auto-advance chain stalls at verify-work waiting for user input.

### Pitfall 5: Config Default Change Breaking Existing Projects
**What goes wrong:** Changing the hardcoded default for `auto_advance` to `true` in config.ts could affect existing projects that don't have the key set.
**Why it happens:** `config-ensure-section` only creates config.json if it doesn't exist. Existing projects keep their existing config.json which may not have `auto_advance` set.
**How to avoid:** The `auto_advance` default only applies to NEW projects (when config.json is first created). Existing projects already have config.json and won't be affected. The `cmdConfigGet` for `auto_advance` already returns the stored value if present; if absent, the skill-level code defaults to `false` (`|| echo "false"`). This is safe -- only new-project will get the new default.
**Warning signs:** None expected, but verify by checking how existing config.json files are read.

## Code Examples

### Example 1: Post-Roadmap Questioning Loop (new-project Step 8.5)

```markdown
## 8.5. Upfront Phase Context Gathering

**If auto mode:** For each phase in the roadmap, extract relevant decisions from the
provided document and generate CONTEXT.md. Match by requirement IDs and phase goal keywords.
Mark unaddressed areas as "Claude's Discretion". Commit all CONTEXT.md files.

**If interactive mode:**

Display banner:
GSDR > PHASE CONTEXT GATHERING

### Preliminary Analysis

Read ROADMAP.md and extract all phases with their goals and requirements.

For each phase:
  1. Classify complexity:
     CLASSIFY_JSON=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" classify-complexity "$PHASE_GOAL")
     Evaluate the returned prompt to get tier.
  2. If brownfield: cross-reference phase requirements against codebase maps/grep results
     to identify already-solved problems.

Display analysis summary:
  Phase Complexity Analysis:
  | Phase | Complexity | Key Areas |
  |-------|-----------|-----------|
  | 1. Foundation | Simple | Project scaffold |
  | 2. Auth System | Complex | OAuth, RBAC, sessions |

  Brownfield: Found existing Express server, 12 routes, JWT middleware
  Skipping: Auth middleware questions (already implemented)

### Per-Phase Questioning

For each phase (ordered by phase number):

  **Simple tier:**
  Display: "Phase N: [Name] (Simple)"
  Ask 1-2 key decisions via AskUserQuestion.
  Generate CONTEXT.md with decisions + "Claude's Discretion" for everything else.

  **Medium tier:**
  Display: "Phase N: [Name] (Medium)"
  Identify 2-3 gray areas (using discuss-phase gray area identification pattern).
  Ask 3-4 questions via AskUserQuestion.
  Generate CONTEXT.md.

  **Complex tier:**
  Display: "Phase N: [Name] (Complex)"
  Run full gray area identification (using discuss-phase pattern).
  Present gray areas for user to select.
  Discuss selected areas with 4-question-then-check loop.
  Generate CONTEXT.md.

  Commit each CONTEXT.md:
  node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" commit \
    "docs(${PADDED}): capture phase context" \
    --files ".planning/phases/${PADDED}-${SLUG}/${PADDED}-CONTEXT.md"
```

### Example 2: Config Default Change (config.ts)

```typescript
// In cmdConfigEnsureSection, update hardcoded defaults:
const hardcoded: Record<string, unknown> = {
  model_profile: 'balanced',
  commit_docs: true,
  search_gitignored: false,
  branching_strategy: 'none',
  phase_branch_template: 'gsdr/phase-{phase}-{slug}',
  milestone_branch_template: 'gsdr/{milestone}-{slug}',
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
    nyquist_validation: true,
    auto_advance: true,  // NEW: default ON for new projects
  },
  parallelization: true,
  brave_search: hasBraveSearch,
};
```

### Example 3: Settings Skill Auto-Advance Default Flip

```markdown
# In settings/SKILL.md, update auto-advance question:
  {
    question: "Auto-advance pipeline? (discuss > plan > execute automatically)",
    header: "Auto",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Chain stages automatically after upfront session" },
      { label: "No", description: "Manual /clear + paste between stages" }
    ]
  },
```

### Example 4: Auto-Approve for verify-work

```markdown
# In verify-work/SKILL.md or execute-phase/SKILL.md verify_phase_goal step:

# When auto_advance is active, skip interactive UAT and use automated verification:
AUTO_CHAIN=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")

# If auto mode: rely on gsdr-verifier (already spawned in execute-phase verify_phase_goal)
# The verifier produces VERIFICATION.md with status: passed | gaps_found | human_needed
# If passed: auto-advance to next phase
# If gaps_found: auto-plan fixes, auto-execute, re-verify (up to 2 attempts)
# If human_needed: pause and present (irreducible human requirement)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-phase discuss-phase (manual) | Upfront session gathers all context | This phase | Eliminates N manual sessions |
| auto_advance defaults to false | auto_advance defaults to true | This phase | New projects run autonomously by default |
| Interactive verify-work UAT | Automated verification with gsdr-verifier | This phase | Removes human blocking during auto-advance |
| Generic questions (no analysis) | Preliminary codebase analysis informs questions | This phase | Smarter, fewer, more relevant questions |

## Open Questions

1. **Context window budget during upfront session**
   - What we know: Simple ~500 tokens, Medium ~2K, Complex ~8K per phase. 5-8 phases = 15-30K tokens.
   - What's unclear: Whether the full new-project flow (questioning + research + requirements + roadmap + phase context) fits in one 200K context window for large projects.
   - Recommendation: If the session approaches 150K tokens, emit a warning and offer to complete remaining phases in a follow-up session. The .continue-here.md pattern can handle this.

2. **Phase ordering during questioning**
   - What we know: Phases are numbered and have dependencies. Early phases inform later phases.
   - What's unclear: Whether questioning should follow dependency order or allow user to skip around.
   - Recommendation: Question in phase order (1, 2, 3...) since earlier phase decisions may inform later questions. Allow "skip" option for phases where user has no strong preferences.

3. **Brownfield capability detection accuracy**
   - What we know: Codebase maps provide good structural info. Grep-based scout finds file patterns.
   - What's unclear: How accurately the system can determine "this phase's requirements are already implemented."
   - Recommendation: Be conservative -- flag as "partially implemented" rather than "skip entirely." Let the user confirm during questioning.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | vitest inferred from package.json |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | new-project gathers per-phase context in upfront session | integration | `npx vitest run tests/upfront-session.test.ts -t "upfront session"` | Wave 0 |
| AUTO-02 | preliminary analysis identifies unknowns before questioning | integration | `npx vitest run tests/preliminary-analysis.test.ts -t "preliminary analysis"` | Wave 0 |
| AUTO-03 | auto_advance default is true; gates auto-approve | unit | `npx vitest run tests/auto-advance.test.ts -t "auto advance"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/auto-advance.test.ts` -- covers AUTO-03: verify config.ts hardcoded default has auto_advance: true; verify settings SKILL.md recommends Yes
- [ ] `tests/upfront-session.test.ts` -- covers AUTO-01: verify new-project SKILL.md contains Step 8.5 with per-phase questioning loop; verify CONTEXT.md generation
- [ ] `tests/preliminary-analysis.test.ts` -- covers AUTO-02: verify new-project SKILL.md contains preliminary analysis step; verify complexity classification per phase

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all skill SKILL.md files (new-project, discuss-phase, plan-phase, execute-phase, verify-work, settings, resume-work)
- Direct codebase analysis of src/lib/ TypeScript modules (config.ts, init.ts, complexity.ts)
- Direct analysis of .planning/config.json structure and existing auto-advance infrastructure
- Direct analysis of CONTEXT.md template and existing CONTEXT.md files

### Secondary (MEDIUM confidence)
- Questioning flow patterns from references/questioning.md
- Agent nesting issue (#686) referenced in discuss-phase SKILL.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; all changes use existing codebase
- Architecture: HIGH - Modification targets are clearly identified; existing patterns cover all needs
- Pitfalls: HIGH - Based on direct codebase analysis and known issues (#686 nesting)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- this is internal tooling, not external dependency)
