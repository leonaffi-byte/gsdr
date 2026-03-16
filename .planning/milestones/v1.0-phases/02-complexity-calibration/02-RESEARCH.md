# Phase 2: Complexity Calibration - Research

**Researched:** 2026-03-15
**Domain:** Task complexity classification, adaptive planning depth, LLM-based heuristics
**Confidence:** HIGH

## Summary

This phase adds automatic complexity detection to GSDR so the system scales planning depth without user input. The core problem is classifying a task description into Simple/Medium/Complex tiers, then routing to the appropriate workflow depth: Simple skips research and produces 1 lightweight plan, Medium does light research with 2-3 plans, Complex gets the full multi-plan treatment with 4-agent research.

No competitor auto-detects complexity well. BMAD v6 has Scale-Adaptive Intelligence with 3 tracks (Quick Flow, Standard, Enterprise) but track selection is user-driven. Taskmaster AI has an `analyze_project_complexity` tool that scores 1-10 using Perplexity research, but it is manual and post-hoc. GSDR's differentiator is auto-detection without user input, with an override escape hatch.

The implementation is primarily an LLM-based classifier that runs early in the workflow pipeline (before research/planning decisions). Since GSDR already runs on Claude Code, the classifier can leverage the LLM itself for nuanced classification rather than relying on brittle regex heuristics. The classifier should output a tier plus rationale, and the existing `plan-phase`, `new-project`, and workflow routing code must be modified to respect the tier.

**Primary recommendation:** Implement the classifier as a new `src/lib/complexity.ts` module with a lightweight LLM prompt, invoked as a CLI command (`gsdr-tools classify-complexity`). Wire it into the `plan-phase` and `execute-phase` skill workflows. Use a structured prompt with signal extraction (not simple keyword matching) for the classifier, validated against 20 labeled test cases.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMPLX-01 | Auto-detect task complexity into 3 tiers (Simple/Medium/Complex) from task description without user input | Classifier module with LLM-based signal extraction; integration at workflow entry points |
| CMPLX-02 | Adaptive plan depth: Simple tasks get 1 lightweight plan, Medium get 2-3 plans, Complex get full treatment | Workflow routing in plan-phase skill that reads complexity tier and adjusts research/planning spawning |
| CMPLX-03 | Adaptive research: Skip research for Simple tasks, light research for Medium, full 4-agent research for Complex | Modify plan-phase skill's research step to check complexity tier; add "light research" path (single researcher, no synthesizer) |
| CMPLX-04 | Provide complexity override escape hatch (--complexity flag) but default to auto-detect | CLI flag parsing in skill workflows; override takes precedence over auto-detection |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.0 | Implementation language | Already used by GSDR codebase |
| esbuild | ^0.24.0 | CJS bundling | Already used by GSDR build |
| vitest | ^3.0.0 | Test framework | Already configured in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-ins (fs, path) | >= 18 | File operations | Config, signal reading |

No new dependencies are needed. The classifier is implemented as a TypeScript module in the existing codebase. The LLM classification happens through Claude Code's own prompting, not through external API calls.

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
  complexity.ts          # NEW: Classifier logic, signal extraction, tier determination
  init.ts                # MODIFIED: Add classify-complexity init command
  commands.ts            # MODIFIED: Add classify-complexity CLI command

skills/
  plan-phase/SKILL.md    # MODIFIED: Add complexity routing before research
  execute-phase/SKILL.md # MINOR: Display tier in execution banners
  quick/SKILL.md         # MINOR: Quick is effectively "Simple" tier

tests/
  complexity.test.ts     # NEW: 20 labeled test cases for classifier validation
```

### Pattern 1: Signal-Based Complexity Classification

**What:** Extract structured signals from the task description, then map signal combinations to tiers.

**When to use:** Always -- this is the core classification mechanism.

**Design:**

The classifier works in two stages:

**Stage 1: Signal Extraction** -- Parse the task description and project context to extract complexity signals:

| Signal | Weight | How to Extract |
|--------|--------|----------------|
| File scope | HIGH | Count mentioned files, directories, modules. 1-2 files = low, 3-5 = medium, 6+ = high |
| Integration surface | HIGH | Count external systems, APIs, databases mentioned. 0 = low, 1-2 = medium, 3+ = high |
| Domain novelty | MEDIUM | Does the task involve new/unfamiliar technology? Known patterns = low, new library = medium, new paradigm = high |
| Dependency depth | MEDIUM | Does this task depend on other incomplete work? Standalone = low, depends on 1 phase = medium, depends on 2+ = high |
| Ambiguity level | HIGH | How underspecified is the description? Concrete verbs + specific files = low, vague goals = high |
| Cross-cutting concerns | MEDIUM | Auth, security, migrations, backwards compatibility. Each adds weight. |
| Pattern existence | LOW | Is this a common pattern (CRUD, config change) or novel architecture? |

**Stage 2: Tier Determination** -- Map extracted signals to tiers:

```
Simple: file_scope=low AND integration=low AND ambiguity=low
  Examples: "add a loading spinner to the dashboard", "fix typo in README",
            "add eslint rule for no-console", "rename function X to Y"

Medium: Any signal is medium OR (2+ signals are low-medium with some complexity)
  Examples: "add JWT authentication", "create REST API for user profiles",
            "refactor module X to use new pattern", "add dark mode support"

Complex: Any signal is high OR (3+ signals are medium)
  Examples: "add OAuth2 + RBAC with role hierarchy", "migrate from REST to GraphQL",
            "implement real-time collaboration", "add multi-tenant support"
```

**Stage 3: LLM Judgment** -- The above heuristics are embedded in a structured prompt. The LLM performs the actual classification because:
1. Natural language understanding is needed (e.g., "add auth" could be Simple JWT or Complex OAuth+RBAC)
2. Project context matters (adding auth to a CLI tool vs a multi-tenant SaaS)
3. Edge cases require reasoning, not rules

### Pattern 2: Complexity-Adaptive Workflow Routing

**What:** The plan-phase and new-project workflows read the complexity tier and branch accordingly.

**When to use:** Every time a phase or task is planned.

**Routing table:**

| Tier | Research | Plan Count | Plan Checker | Verifier | Questioning Depth |
|------|----------|------------|--------------|----------|-------------------|
| Simple | Skip | 1 plan, 1-3 tasks | Skip | Lightweight | Minimal |
| Medium | Light (1 researcher, key domain only) | 2-3 plans | Run | Run | Standard |
| Complex | Full (4 parallel researchers + synthesizer) | 3+ plans | Run (3 iterations) | Full | Deep |

**Integration points in existing workflow:**

1. **plan-phase skill** (Step 5 - Handle Research): Before spawning researcher, check complexity tier. If Simple, skip entirely. If Medium, spawn single researcher with focused prompt (no architecture/pitfalls agents).

2. **plan-phase skill** (Step 8 - Spawn Planner): Pass complexity tier to planner agent prompt. Planner uses tier to calibrate plan count and task granularity.

3. **execute-phase skill** (Step - Display): Show detected tier in the execution banner so the user sees classification.

4. **quick skill**: Already operates as a "Simple" tier. Map existing quick behavior to the Simple tier definition for consistency.

### Pattern 3: Override Mechanism

**What:** `--complexity simple|medium|complex` flag overrides auto-detection.

**When to use:** When the user knows the system's classification is wrong.

**Implementation:**
- Parse `--complexity` from `$ARGUMENTS` in skill workflows
- If present, skip classifier, use provided value
- Display: "Complexity: {tier} (user override)" vs "Complexity: {tier} (auto-detected)"

### Anti-Patterns to Avoid

- **Keyword matching only:** "add auth" could be simple or complex depending on context. Never rely on keyword presence alone -- always consider the full task description and project state.
- **Over-engineering the classifier:** The classifier should be fast (< 2 seconds) and use a single LLM call, not multiple rounds of analysis. Speed matters because it runs before every planning session.
- **Hardcoded thresholds:** Don't hardcode "3 files = medium". The LLM prompt should describe the signal framework but let the LLM reason about the specific task.
- **Ignoring project context:** "Add a database" is Simple for a greenfield project (just install SQLite) but Complex for an existing distributed system (migrations, compatibility, etc.). The classifier must read STATE.md and ROADMAP.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NLP-based text classification | Custom NLP pipeline | Claude LLM prompt | LLM understands coding task descriptions better than any regex or NLP model; it already powers the system |
| Test case management | Custom test framework | Vitest with labeled test data | Existing test infrastructure handles this cleanly |
| Workflow branching | Complex conditional in each skill | Centralized complexity config object | Single source of truth avoids divergent behavior |

**Key insight:** The classifier IS an LLM prompt, not a traditional ML model. Since GSDR runs on Claude Code, we leverage the LLM's understanding of software engineering tasks directly. The "model" is the prompt template + signal framework.

## Common Pitfalls

### Pitfall 1: "Looks Simple But Isn't" Misclassification

**What goes wrong:** Tasks like "add auth" get classified as Simple when they should be Complex (e.g., user means OAuth2 + RBAC + session management + token refresh).

**Why it happens:** Short descriptions hide complexity. Ambiguity is itself a complexity signal.

**How to avoid:** The classifier prompt must treat ambiguity as a signal that increases complexity. If the description is vague/short AND touches a known-complex domain (auth, payments, real-time, migrations), classify UP not down.

**Warning signs:** Test cases with short ambiguous descriptions consistently misclassify.

### Pitfall 2: Context-Free Classification

**What goes wrong:** The classifier ignores project state. "Add dark mode" is Simple for a new app with a design system, Complex for an existing app with inconsistent theming.

**Why it happens:** Classifier only reads the task description, not the project context.

**How to avoid:** Feed the classifier: task description + project summary (from STATE.md) + current phase info (from ROADMAP.md). The classifier prompt should explicitly reason about project state.

**Warning signs:** Same task description produces different correct answers depending on project, but classifier gives same answer.

### Pitfall 3: Classification Latency Blocks Workflow

**What goes wrong:** If classification takes 10+ seconds (multiple LLM calls, research, etc.), it defeats the purpose by adding friction.

**Why it happens:** Over-engineering the classifier with multi-step analysis.

**How to avoid:** Single LLM call with a focused prompt. Target < 2 seconds. The classification does NOT need to be perfect -- it needs to be good enough (18/20 test cases) and fast. Override exists for the remaining 2/20.

**Warning signs:** Users consistently override because auto-detect is too slow or they don't trust it.

### Pitfall 4: Tier Boundaries Too Rigid

**What goes wrong:** Medium tier becomes a catch-all where 80% of tasks land, making the tiering useless.

**Why it happens:** Simple criteria too strict, Complex criteria too strict, everything falls to Medium.

**How to avoid:** Calibrate tier boundaries using the 20 test cases. Expect roughly 5-7 Simple, 8-10 Medium, 5-7 Complex in a well-calibrated set. Adjust the prompt's signal weights if distribution is skewed.

**Warning signs:** >60% of test cases classify as Medium.

### Pitfall 5: Divergent Behavior Between Skills

**What goes wrong:** plan-phase handles complexity differently from quick or new-project, leading to inconsistent user experience.

**Why it happens:** Each skill implements its own complexity branching logic.

**How to avoid:** Centralize complexity routing in a shared data structure. Each skill reads the tier and looks up its behavior from a common table, not custom if/else chains.

**Warning signs:** Same tier produces different research/planning behavior depending on which skill invoked it.

## Code Examples

### Classifier CLI Command

```typescript
// src/lib/complexity.ts

export interface ComplexityResult {
  tier: 'simple' | 'medium' | 'complex';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  signals: {
    file_scope: 'low' | 'medium' | 'high';
    integration_surface: 'low' | 'medium' | 'high';
    ambiguity: 'low' | 'medium' | 'high';
    domain_novelty: 'low' | 'medium' | 'high';
    cross_cutting: string[];
  };
}

export interface ComplexityConfig {
  tier: 'simple' | 'medium' | 'complex';
  research: 'skip' | 'light' | 'full';
  max_plans: number;
  plan_checker: boolean;
  verifier: boolean;
}

export const COMPLEXITY_TIERS: Record<string, ComplexityConfig> = {
  simple: {
    tier: 'simple',
    research: 'skip',
    max_plans: 1,
    plan_checker: false,
    verifier: false,
  },
  medium: {
    tier: 'medium',
    research: 'light',
    max_plans: 3,
    plan_checker: true,
    verifier: true,
  },
  complex: {
    tier: 'complex',
    research: 'full',
    max_plans: 10,
    plan_checker: true,
    verifier: true,
  },
};
```

### Classifier Prompt Template

```typescript
// The LLM prompt that classifies complexity. This is NOT called as an API --
// it is embedded in the skill workflow as instructions for the orchestrating agent.

export const CLASSIFIER_PROMPT = `
Classify this task's complexity into one of three tiers: Simple, Medium, or Complex.

## Task Description
{task_description}

## Project Context
{project_summary_from_state_md}

## Signal Framework

Evaluate these signals:

1. **File scope**: How many files/modules will be touched?
   - Low: 1-2 files, single module
   - Medium: 3-5 files, 2-3 modules
   - High: 6+ files, cross-module changes

2. **Integration surface**: External systems, APIs, databases involved?
   - Low: No external dependencies
   - Medium: 1-2 external integrations
   - High: 3+ external systems or complex protocol work

3. **Ambiguity**: How well-specified is the task?
   - Low: Concrete files, specific changes described
   - Medium: Goal is clear but implementation details are open
   - High: Vague goal, multiple valid interpretations

4. **Domain novelty**: Is this a well-known pattern or new territory?
   - Low: Standard CRUD, config changes, UI tweaks
   - Medium: Familiar domain with some novel aspects
   - High: New paradigm, unfamiliar technology, architectural shift

5. **Cross-cutting concerns**: Auth, security, migrations, backwards compatibility?
   - List any that apply

## Classification Rules

- **Simple**: All signals low. Task is self-contained, well-specified, touches few files.
  Plan with: 1 lightweight plan, no research, no verification.

- **Medium**: Any signal is medium, or task has moderate scope with clear direction.
  Plan with: 2-3 plans, light research (single agent), standard verification.

- **Complex**: Any signal is high, or 3+ signals are medium.
  Plan with: Full multi-plan treatment, 4-agent research, verification with iteration.

- **Ambiguity rule**: If the description is vague AND touches a known-complex domain
  (auth, payments, real-time, data migration, multi-tenancy), classify UP one tier.

## Output Format

Return JSON:
{
  "tier": "simple|medium|complex",
  "confidence": "high|medium|low",
  "rationale": "2-3 sentences explaining classification",
  "signals": {
    "file_scope": "low|medium|high",
    "integration_surface": "low|medium|high",
    "ambiguity": "low|medium|high",
    "domain_novelty": "low|medium|high",
    "cross_cutting": ["list", "of", "concerns"]
  }
}
`;
```

### Workflow Integration in plan-phase Skill

```markdown
## 2.5. Classify Complexity (NEW STEP)

**Skip if:** `--complexity` flag provides explicit override.

Parse `--complexity simple|medium|complex` from $ARGUMENTS.

**If override provided:**
Set `COMPLEXITY_TIER` to override value.
Display: `Complexity: {tier} (user override)`

**If no override:**
Classify the task using the signal framework:

1. Read STATE.md for project context
2. Read ROADMAP.md phase description for task scope
3. Apply classifier prompt (inline, single LLM evaluation)
4. Display result:

```
Complexity: {tier} ({confidence} confidence)
Rationale: {rationale}
```

Store `COMPLEXITY_TIER` for use in subsequent steps.

**Routing effects:**

| Step | Simple | Medium | Complex |
|------|--------|--------|---------|
| Step 5 (Research) | SKIP | Light (1 agent) | Full (4 agents + synthesizer) |
| Step 8 (Planner) | 1 plan, 1-3 tasks | 2-3 plans | Full treatment |
| Step 10 (Checker) | SKIP | Run (2 iterations max) | Run (3 iterations max) |
```

### Test Case Structure

```typescript
// tests/complexity.test.ts

interface TestCase {
  description: string;
  projectContext: string;
  expectedTier: 'simple' | 'medium' | 'complex';
  rationale: string;
}

const LABELED_TEST_CASES: TestCase[] = [
  // --- Simple (5-7 cases) ---
  {
    description: "Fix typo in README.md",
    projectContext: "TypeScript web app, Phase 3 of 5",
    expectedTier: 'simple',
    rationale: "Single file, no integration, fully specified",
  },
  {
    description: "Add eslint rule to disallow console.log in production code",
    projectContext: "React frontend, standard toolchain",
    expectedTier: 'simple',
    rationale: "Config change, 1-2 files, well-known pattern",
  },
  {
    description: "Add loading spinner to the user list page",
    projectContext: "React app with existing component library",
    expectedTier: 'simple',
    rationale: "Single component, existing patterns, well-specified",
  },
  {
    description: "Rename the UserService class to AccountService",
    projectContext: "NestJS backend, 12 modules",
    expectedTier: 'simple',
    rationale: "Mechanical refactor, find-and-replace pattern",
  },
  {
    description: "Update Node.js version from 18 to 20 in CI config",
    projectContext: "GitHub Actions CI pipeline",
    expectedTier: 'simple',
    rationale: "Single config file, well-documented upgrade path",
  },

  // --- Medium (8-10 cases) ---
  {
    description: "Add JWT authentication to the Express API",
    projectContext: "Express.js REST API, no auth currently",
    expectedTier: 'medium',
    rationale: "Well-known pattern but touches multiple files (middleware, routes, config)",
  },
  {
    description: "Create a user profile page with edit functionality",
    projectContext: "React app with existing user model",
    expectedTier: 'medium',
    rationale: "Multiple components, form handling, API integration",
  },
  {
    description: "Add dark mode support",
    projectContext: "React app with Tailwind CSS, no theme system",
    expectedTier: 'medium',
    rationale: "Cross-cutting CSS changes, new theme context, multiple components affected",
  },
  {
    description: "Implement email notifications for new comments",
    projectContext: "Node.js app with existing comment system",
    expectedTier: 'medium',
    rationale: "New external integration (email), queue/async considerations",
  },
  {
    description: "Refactor the data access layer to use repository pattern",
    projectContext: "Express app with direct database calls in routes",
    expectedTier: 'medium',
    rationale: "Architectural refactor touching many files, but well-known pattern",
  },
  {
    description: "Add pagination to all list endpoints",
    projectContext: "REST API with 8 list endpoints",
    expectedTier: 'medium',
    rationale: "Repetitive pattern across multiple files, some query complexity",
  },
  {
    description: "Create admin dashboard with user management",
    projectContext: "SaaS app with existing user model, no admin UI",
    expectedTier: 'medium',
    rationale: "New feature area but uses existing data model and auth",
  },
  {
    description: "Add webhook support for order status changes",
    projectContext: "E-commerce API",
    expectedTier: 'medium',
    rationale: "External integration, retry logic, but focused scope",
  },

  // --- Complex (5-7 cases) ---
  {
    description: "Add OAuth2 with RBAC and role hierarchy",
    projectContext: "Multi-tenant SaaS platform",
    expectedTier: 'complex',
    rationale: "Multiple external providers, role hierarchy design, cross-cutting auth checks",
  },
  {
    description: "Migrate from REST to GraphQL",
    projectContext: "Production API with 30 endpoints and 5 client apps",
    expectedTier: 'complex',
    rationale: "Architectural shift, backwards compatibility, all clients affected",
  },
  {
    description: "Implement real-time collaboration on documents",
    projectContext: "Document editor app",
    expectedTier: 'complex',
    rationale: "CRDT/OT algorithms, WebSocket infrastructure, conflict resolution",
  },
  {
    description: "Add multi-tenant support with data isolation",
    projectContext: "Single-tenant SaaS converting to multi-tenant",
    expectedTier: 'complex',
    rationale: "Database schema changes, tenant isolation at every layer, migration path",
  },
  {
    description: "Build CI/CD pipeline with staging, canary, and production environments",
    projectContext: "Greenfield project, deploying to Kubernetes",
    expectedTier: 'complex',
    rationale: "Multiple environments, deployment strategies, infrastructure as code",
  },

  // --- Edge Cases (ambiguous -- tests the ambiguity-up rule) ---
  {
    description: "Add auth",
    projectContext: "Large enterprise application with existing user directory",
    expectedTier: 'complex',
    rationale: "Ambiguous + enterprise context + known-complex domain = classify UP",
  },
  {
    description: "Add auth",
    projectContext: "Simple CLI tool for personal use",
    expectedTier: 'simple',
    rationale: "Same description but simple context = API key or basic auth",
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| User-selected complexity (BMAD v6) | Auto-detect with LLM classification | GSDR innovation (2026) | No competitor does this; GSDR's core differentiator |
| Manual complexity field (Taskmaster) | Signal-based auto-classification | Taskmaster still manual as of 2025 | Removes a user decision point that users get wrong |
| One-size-fits-all planning (GSD) | Adaptive depth per tier | GSDR Phase 2 | Prevents over-engineering simple tasks, under-planning complex ones |

**Deprecated/outdated:**
- Keyword-based complexity detection: Too brittle for natural language task descriptions
- Fixed plan counts per phase: Should scale with actual complexity

## Open Questions

1. **Light research agent behavior**
   - What we know: Simple = no research, Complex = full 4-agent research
   - What's unclear: Should "light research" (Medium tier) use 1 researcher with a broader prompt, or 2 researchers with focused prompts?
   - Recommendation: Start with 1 researcher using the existing phase-researcher prompt but without architecture/pitfalls dimensions. Iterate based on plan quality.

2. **Classification persistence**
   - What we know: The tier needs to be available throughout the workflow
   - What's unclear: Should tier be stored in config.json, STATE.md, or as a per-phase frontmatter field?
   - Recommendation: Store in the phase directory as frontmatter in a `{padded}-COMPLEXITY.md` or as a field in PLAN.md frontmatter. This makes it inspectable and overridable per phase.

3. **Interaction with existing quick mode**
   - What we know: `/gsdr:quick` already implements a lightweight "simple" path
   - What's unclear: Should quick mode become "Simple tier auto-detected" or remain a separate entry point?
   - Recommendation: Keep quick mode as a separate entry point (ad-hoc tasks outside the roadmap). Complexity calibration applies to roadmap-tracked phases via plan-phase. The two should share the same planning constraints (e.g., Simple tier config matches quick mode defaults).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/complexity.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMPLX-01 | Auto-detect 3 tiers from description | unit | `npx vitest run tests/complexity.test.ts -t "classifies"` | No - Wave 0 |
| CMPLX-01 | Display classification with rationale | unit | `npx vitest run tests/complexity.test.ts -t "rationale"` | No - Wave 0 |
| CMPLX-02 | Simple=1 plan, Complex=full treatment | unit | `npx vitest run tests/complexity.test.ts -t "routing"` | No - Wave 0 |
| CMPLX-03 | Skip research for Simple, full for Complex | unit | `npx vitest run tests/complexity.test.ts -t "research"` | No - Wave 0 |
| CMPLX-04 | --complexity flag overrides auto-detect | unit | `npx vitest run tests/complexity.test.ts -t "override"` | No - Wave 0 |
| CMPLX-01 | 18+ of 20 labeled test cases match | integration | `npx vitest run tests/complexity.test.ts -t "labeled"` | No - Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/complexity.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsdr:verify-work`

### Wave 0 Gaps

- [ ] `tests/complexity.test.ts` -- covers CMPLX-01 through CMPLX-04, includes 20 labeled test cases
- [ ] `src/lib/complexity.ts` -- classifier module with ComplexityResult type, COMPLEXITY_TIERS config, classify function
- [ ] Framework install: Already installed (vitest ^3.0.0 in devDependencies)

## Sources

### Primary (HIGH confidence)

- Existing GSDR codebase (`src/lib/`, `skills/`, `agents/`) -- analyzed workflow integration points, existing patterns, type system
- `.planning/REQUIREMENTS.md` -- CMPLX-01 through CMPLX-04 requirement definitions
- `.planning/ROADMAP.md` -- Phase 2 goal, success criteria, dependency on Phase 1
- `.planning/research/FEATURES.md` -- Competitor analysis, complexity calibration as core differentiator

### Secondary (MEDIUM confidence)

- [BMAD v6 Scale-Adaptive Intelligence](https://medium.com/@hieutrantrung.it/from-token-hell-to-90-savings-how-bmad-v6-revolutionized-ai-assisted-development-09c175013085) -- 3 tracks (Quick Flow, Standard, Enterprise), user-selected routing
- [BMAD Planning Tracks (DeepWiki)](https://deepwiki.com/bmadcode/BMAD-METHOD/4.2-context-engineered-development-(ide)) -- Track selection determines whether solutioning phases execute
- [Taskmaster AI](https://github.com/eyaltoledano/claude-task-master) -- `analyze_project_complexity` tool, complexity scoring 1-10, manual invocation
- [Evaluating LLMs for Source Code Generation](https://www.mdpi.com/2073-431X/15/2/119) -- ML classification of code complexity; structural metrics provide limited discriminative power vs semantic understanding

### Tertiary (LOW confidence)

- LLM-based heuristic research from Cornell/HeuriGym -- LLM-crafted heuristics can match domain-specific optimization, supporting LLM-as-classifier approach
- Addy Osmani's AI Coding Workflow patterns -- right-sizing tasks, preventing over-engineering (referenced in FEATURES.md)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using existing project toolchain, no new dependencies
- Architecture: HIGH -- integration points are well-understood from code analysis; classifier is a thin LLM prompt layer
- Pitfalls: HIGH -- edge cases are well-documented from competitor analysis and requirements (test case requirement catches most)
- Classifier accuracy: MEDIUM -- the 18/20 threshold is achievable with LLM-based classification but needs empirical validation with the actual prompt

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain -- complexity classification patterns unlikely to change)
