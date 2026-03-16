# Phase 3: Front-Loaded Interaction - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate all human interaction into one upfront session during new-project, then remove per-phase gates (discuss, approve, verify) so the system runs autonomously from planning through execution to verification. Users invest 10-15 minutes answering questions, then walk away.

</domain>

<decisions>
## Implementation Decisions

### Upfront session design
- Extend `new-project` skill to capture per-phase context during the initial session — after roadmap creation, iterate through each phase and gather CONTEXT.md decisions
- Question depth is complexity-adaptive: Simple phases get 1-2 quick questions, Medium phases get brief discussion, Complex phases get full discuss-phase treatment with gray areas and deep-dives
- `discuss-phase` remains available as a standalone escape hatch for mid-project course corrections — doesn't break autonomy, it's opt-in
- With `--auto @document.md`, the system extracts per-phase context from the provided document and generates CONTEXT.md for each phase automatically — no interactive questions

### Preliminary analysis
- Before asking questions, the system analyzes: codebase (existing patterns, assets, integration points), classifies complexity per phase, and cross-references requirements
- Analysis is visible with progress indicators ("Analyzing codebase... Classifying phases... Preparing questions...")
- Brief summary shown to user before questioning starts ("Found 12 components, 3 API routes, classified as Medium complexity") — details used internally to craft better questions
- For brownfield projects, analysis detects existing capabilities and skips questions about solved problems (e.g., if auth exists, don't ask about auth approach)

### Gate removal strategy
- All three gates (discuss-phase, plan approval, verify-work) are auto-approved after the upfront session — gates exist but don't block
- Auto-advance (`workflow.auto_advance`) becomes DEFAULT ON for new projects — users can toggle off via /gsdr:settings
- Plan-checker rejections trigger automatic planner revision, up to 2 retries — after 2 failed attempts, pause and ask user
- Phase transitions are fully automated: roadmap updated, state advanced, PROJECT.md evolved based on summaries — no approval needed

### Autonomy boundaries
- After upfront session, system ONLY pauses for context window limits — all decision-making is autonomous based on captured context
- On context window limit: auto-resume with handoff file — write .continue-here.md with full state, auto-invoke resume-work to pick up seamlessly
- Progress visibility: stage banners only (GSD > PLANNING PHASE 3, GSD > EXECUTING WAVE 2) — no questions or prompts. User can watch or walk away
- Verification gaps trigger auto gap closure: auto-plan fixes, auto-execute, re-verify. Only stops if gap closure fails twice

### Claude's Discretion
- Internal implementation of the new-project questioning loop (how to iterate through phases)
- How to handle the transition from "preliminary analysis" to "questioning" UX
- Exact format of the analysis summary shown before questioning
- How to handle edge cases where context window limit is hit during the upfront session itself

</decisions>

<specifics>
## Specific Ideas

- The auto-advance chain infrastructure already exists (--auto flag, workflow.auto_advance config, _auto_chain_active ephemeral flag) — this phase makes it the default path rather than opt-in
- The existing discuss-phase skill's gray area identification and AskUserQuestion flow should be reused inside the enhanced new-project skill
- Complexity classifier from Phase 2 directly controls question depth per phase

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/new-project/SKILL.md`: Has --auto mode with document extraction — extend with per-phase context gathering
- `skills/discuss-phase/SKILL.md`: Full gray area identification and questioning flow — reuse inside new-project
- `src/lib/complexity.ts`: classifyComplexity() and COMPLEXITY_TIERS — use to determine question depth per phase
- Auto-advance config: `workflow.auto_advance` and `_auto_chain_active` flags in config.json

### Established Patterns
- AskUserQuestion tool for structured questioning with options
- CONTEXT.md template for capturing decisions per phase
- Auto-advance chain: --auto flag propagates through discuss > plan > execute
- Stage banners (GSD >) for progress visibility

### Integration Points
- `skills/new-project/SKILL.md`: Primary modification target — add post-roadmap questioning loop
- `skills/plan-phase/SKILL.md`: Already has complexity classification (Step 2.5) and auto-advance
- `skills/execute-phase/SKILL.md`: Already has auto-advance chain support
- `.planning/config.json`: workflow.auto_advance default value changes from false to true

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-front-loaded-interaction*
*Context gathered: 2026-03-15*
