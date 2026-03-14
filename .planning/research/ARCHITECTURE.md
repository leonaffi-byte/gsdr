# Architecture Research

**Domain:** AI coding assistant meta-prompting/orchestration system (GSD fork)
**Researched:** 2026-03-14
**Confidence:** HIGH (based on direct source code analysis of GSD + ecosystem research)

## GSD's Existing Architecture (As-Is)

### System Overview

```
+---------------------------------------------------------------------+
|                       User Interface Layer                           |
|  Slash commands (/gsd:new-project, /gsd:plan-phase, /gsd:execute)   |
+---------------------------------------------------------------------+
         |
         v
+---------------------------------------------------------------------+
|                    Workflow Orchestration Layer                       |
|  workflows/*.md — Markdown-as-code prompt scripts                   |
|  (new-project, discuss-phase, plan-phase, execute-phase, transition) |
+---------------------------------------------------------------------+
         |                          |                         |
         v                          v                         v
+-------------------+  +---------------------+  +---------------------+
| Agent Roles       |  | CLI Tooling         |  | State Management    |
| (prompt-defined)  |  | bin/gsd-tools.cjs   |  | .planning/ dir      |
|                   |  |                     |  |                     |
| gsd-planner       |  | bin/lib/core.cjs    |  | STATE.md            |
| gsd-executor      |  | bin/lib/state.cjs   |  | ROADMAP.md          |
| gsd-researcher    |  | bin/lib/phase.cjs   |  | REQUIREMENTS.md     |
| gsd-verifier      |  | bin/lib/init.cjs    |  | PROJECT.md          |
| gsd-plan-checker  |  | bin/lib/roadmap.cjs |  | config.json         |
| gsd-roadmapper    |  | bin/lib/commands.cjs|  | phases/XX-name/     |
| gsd-codebase-map  |  | bin/lib/milestone   |  |   *-PLAN.md         |
|                   |  | bin/lib/verify.cjs  |  |   *-SUMMARY.md      |
+-------------------+  +---------------------+  |   *-CONTEXT.md      |
                                                 |   *-RESEARCH.md     |
                                                 |   *-VERIFICATION.md |
                                                 +---------------------+
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Slash Commands** | Entry points for user interaction | Claude Code custom slash commands invoking workflow .md files |
| **Workflow Scripts** | Orchestration logic as structured markdown prompts | `workflows/*.md` — XML-structured process steps with bash snippets |
| **Agent Roles** | Specialized LLM personas for different tasks | Defined by system prompts in workflow files; model selection via profiles |
| **CLI Tooling (gsd-tools.cjs)** | Deterministic operations (file I/O, state parsing, git) | Node.js CJS modules; single entry point dispatches to lib/ modules |
| **State Layer (.planning/)** | Persistent project memory across sessions | Markdown files with YAML frontmatter; directory-based phase structure |
| **Templates** | Standardized output formats for agents | `templates/*.md` — structural templates for plans, summaries, reports |
| **References** | Behavioral guidance injected into agent prompts | `references/*.md` — rules for git, checkpoints, verification, etc. |

### Key Architectural Insight: Markdown-as-Code

GSD's core innovation is that **workflow orchestration is encoded in markdown files**, not traditional code. The `workflows/*.md` files are prompt scripts that Claude Code's orchestrator LLM interprets and executes. They contain:

- XML-structured `<step>` blocks with ordering
- Bash snippets for deterministic operations (via gsd-tools.cjs)
- `Task()` calls to spawn subagents with specific roles/models
- Conditional logic via `<if mode="yolo">` blocks
- Context passing via `<files_to_read>` blocks

This means the "code" is really a set of instructions for an LLM to follow — the LLM IS the runtime.

## GSD's Current Execution Model (Sequential Pipeline)

```
User invokes /gsd:new-project
    |
    v
Questioning (interactive) -----> PROJECT.md
    |
    v
Research (4 parallel agents) --> research/*.md
    |
    v
Requirements (interactive) ----> REQUIREMENTS.md
    |
    v
Roadmap (1 agent) -------------> ROADMAP.md + STATE.md
    |
    v
For each phase (SEQUENTIAL):
    |
    +---> /gsd:discuss-phase --> CONTEXT.md (interactive)
    |
    +---> /gsd:plan-phase
    |       |
    |       +---> Research agent --> RESEARCH.md
    |       +---> Planner agent --> PLAN.md files
    |       +---> Checker agent --> revision loop (max 3)
    |
    +---> /gsd:execute-phase
    |       |
    |       +---> For each wave (SEQUENTIAL between waves):
    |       |       +---> Plans in wave (PARALLEL within wave)
    |       |       +---> Spot-check results
    |       |       +---> Handle checkpoints
    |       |
    |       +---> Verifier agent --> VERIFICATION.md
    |       +---> Gap closure if needed
    |
    +---> /gsd:transition --> Update state, advance to next phase
```

### Where Parallelism Exists Today

| Stage | Parallelism | Constraint |
|-------|-------------|-----------|
| Project research | 4 agents in parallel | Wait-all before synthesis |
| Phase planning | Sequential (research -> plan -> check) | Check depends on plan output |
| Phase execution (within wave) | Plans in same wave run parallel | Wave N+1 waits for wave N |
| Phase execution (across waves) | Sequential | Dependency chain |
| Cross-phase | Fully sequential | Each phase waits for prior completion |

### Where Human Interaction Occurs Today

| Stage | Interaction Type | Blocking? |
|-------|-----------------|-----------|
| Questioning | Free-form conversation | Yes — multi-round |
| Discuss-phase | Gray area decisions | Yes — per-phase |
| Config | Settings selection | Yes — one-time |
| Requirements | Feature scoping | Yes — multi-round |
| Roadmap | Approval | Yes — gate |
| Checkpoints | Verify/decision/action | Yes — per-checkpoint |
| Transition | Approval (interactive mode) | Yes — gate |
| Verification | Human testing items | Sometimes |

## Recommended GSDR Architecture (To-Be)

### System Overview

```
+---------------------------------------------------------------------+
|                     Front-Loaded Interaction                         |
|  Single upfront session: questioning + config + scope + approval     |
|  (10-15 minutes, then fully autonomous)                             |
+---------------------------------------------------------------------+
         |
         v
+---------------------------------------------------------------------+
|                     Complexity Calibrator                            |
|  Analyzes project scope -> determines planning depth                |
|  Lightweight (script) vs Standard vs Complex (full treatment)       |
+---------------------------------------------------------------------+
         |
         v
+---------------------------------------------------------------------+
|                 Dependency Graph Engine                               |
|  Builds DAG of all phases + plans                                   |
|  Identifies safe parallel paths                                     |
|  Manages execution ordering constraints                             |
+---------------------------------------------------------------------+
         |                          |                         |
         v                          v                         v
+-------------------+  +---------------------+  +---------------------+
| Parallel Planner  |  | Parallel Executor   |  | Autonomous Verifier |
|                   |  |                     |  |                     |
| Plans N phases    |  | Executes plans via  |  | Auto-verify results |
| simultaneously    |  | dependency graph    |  | Auto-fix failures   |
| when deps allow   |  | Max safe parallel   |  | Re-verify after fix |
|                   |  | execution           |  | Escalate only if    |
|                   |  |                     |  | auto-fix fails      |
+-------------------+  +---------------------+  +---------------------+
         |                          |                         |
         v                          v                         v
+---------------------------------------------------------------------+
|                    State & Artifact Layer                             |
|  Same .planning/ structure (proven, keep it)                        |
|  + dependency-graph.json (new)                                      |
|  + execution-log.json (new)                                         |
+---------------------------------------------------------------------+
         |
         v
+---------------------------------------------------------------------+
|                 End-of-Run Human Verification                        |
|  Present completed work for review                                  |
|  All verification already done, user confirms                       |
+---------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | New vs Existing |
|-----------|---------------|-------------------|-----------------|
| **Front-Loaded Interaction** | All human Q&A upfront | Complexity Calibrator, State Layer | Modified (consolidates questioning + discuss + config + requirements + roadmap approval) |
| **Complexity Calibrator** | Detect task complexity, scale planning depth | Dependency Graph, Planner | NEW |
| **Dependency Graph Engine** | Build DAG, determine parallel-safe paths | Planner, Executor | NEW |
| **Parallel Planner** | Plan multiple phases concurrently | Dependency Graph, State Layer | Modified (was sequential) |
| **Parallel Executor** | Execute plans respecting graph ordering | Dependency Graph, Verifier, State | Modified (was wave-only parallel) |
| **Autonomous Verifier** | Verify + auto-fix + re-verify loop | Executor, State Layer | Modified (was human-gated) |
| **CLI Tooling** | Deterministic ops (keep gsd-tools.cjs pattern) | All components | Existing (extend) |
| **State Layer** | Persistent memory (.planning/) | All components | Existing (extend) |
| **End-of-Run Reporter** | Present final results to human | State Layer | NEW |

## Recommended Project Structure

```
src/
├── cli/                    # Entry point and command dispatch
│   ├── index.ts            # npx gsdr entry point
│   └── commands/           # Command handlers
│       ├── init.ts         # gsdr init
│       ├── run.ts          # gsdr run (autonomous pipeline)
│       └── status.ts       # gsdr status
├── workflows/              # Markdown-as-code prompt scripts (from GSD)
│   ├── front-load.md       # Consolidated interaction workflow
│   ├── plan-phase.md       # Phase planning (adapted from GSD)
│   ├── execute-phase.md    # Phase execution (adapted from GSD)
│   ├── execute-plan.md     # Plan execution (adapted from GSD)
│   ├── verify-phase.md     # Phase verification (adapted from GSD)
│   └── auto-fix.md         # NEW: autonomous fix + re-verify
├── engine/                 # Core orchestration logic (NEW)
│   ├── calibrator.ts       # Complexity detection
│   ├── graph.ts            # Dependency DAG builder + scheduler
│   ├── scheduler.ts        # Parallel execution scheduler
│   └── runner.ts           # Autonomous execution loop
├── tools/                  # CLI tooling (evolved from bin/lib/)
│   ├── core.ts             # Shared utilities
│   ├── state.ts            # STATE.md operations
│   ├── phase.ts            # Phase CRUD
│   ├── roadmap.ts          # ROADMAP.md operations
│   ├── init.ts             # Compound init commands
│   ├── graph.ts            # Dependency graph operations
│   └── commands.ts         # Standalone utilities
├── agents/                 # Agent role definitions
│   ├── profiles.ts         # Model profiles (from core.cjs MODEL_PROFILES)
│   └── prompts/            # Agent system prompts (extracted from workflows)
├── templates/              # Output templates (from GSD)
│   ├── plan.md
│   ├── summary.md
│   ├── verification.md
│   └── ...
└── references/             # Behavioral references (from GSD)
    ├── checkpoints.md
    ├── git-integration.md
    └── ...
```

### Structure Rationale

- **workflows/:** Keep markdown-as-code pattern because it works -- LLM interprets structured markdown naturally. Remove human interaction gates, add autonomous continuation logic.
- **engine/:** NEW TypeScript code for the three new capabilities (calibration, dependency graph, autonomous execution). These need actual code because they involve graph algorithms, scheduling logic, and loop control that are too complex for markdown prompts.
- **tools/:** Port from CJS to TypeScript, maintain the same gsd-tools.cjs interface pattern. Add graph operations.
- **agents/:** Extract agent role definitions from inline workflow prompts into reusable files.

## Architectural Patterns

### Pattern 1: Dependency Graph-Based Scheduling

**What:** Build a directed acyclic graph (DAG) of all phases and plans, then execute in topological order with maximum parallelism at each level.

**When to use:** Always -- this replaces the current sequential phase + wave-parallel model.

**Trade-offs:** More complex scheduling logic, but dramatically better throughput. Requires explicit dependency declarations in plans/roadmap.

**Example:**
```typescript
interface DependencyNode {
  id: string;          // "phase-03" or "phase-03-plan-02"
  type: 'phase' | 'plan';
  dependsOn: string[]; // IDs this node depends on
  status: 'pending' | 'ready' | 'running' | 'complete' | 'failed';
  files: string[];     // Files this node modifies (for conflict detection)
}

interface ExecutionGraph {
  nodes: Map<string, DependencyNode>;

  // Returns all nodes whose dependencies are satisfied
  getReady(): DependencyNode[];

  // Returns nodes that can run in parallel (no file conflicts)
  getParallelSafe(ready: DependencyNode[]): DependencyNode[][];

  // Mark node complete, update dependents
  complete(id: string): DependencyNode[];
}

// Scheduler pulls from graph, spawns agents, handles results
async function executeGraph(graph: ExecutionGraph): Promise<void> {
  while (graph.hasIncomplete()) {
    const batch = graph.getParallelSafe(graph.getReady());
    for (const group of batch) {
      await Promise.all(group.map(node => spawnAgent(node)));
    }
  }
}
```

### Pattern 2: Complexity Auto-Calibration

**What:** Analyze the project description and requirements to automatically determine the appropriate planning depth, preventing over-engineering of simple tasks.

**When to use:** At project initialization, after requirements are gathered.

**Trade-offs:** Risk of under-planning complex projects. Mitigate with user override and escalation triggers during execution.

**Calibration heuristics:**
```
LIGHTWEIGHT (script/tool):
  - Single concern (one file type, one operation)
  - No external dependencies or APIs
  - Clear input->output transformation
  - Estimate: 1-3 files modified
  Result: Skip research, 1 phase, 1-2 plans, minimal verification

STANDARD (feature/module):
  - 2-5 concerns (multiple files, some integration)
  - Known tech stack, established patterns
  - Some external dependencies
  - Estimate: 5-20 files modified
  Result: Optional research, 3-5 phases, standard verification

COMPLEX (system/product):
  - 5+ concerns (architecture decisions needed)
  - Unknown tech or novel integration
  - Multiple external services
  - Estimate: 20+ files modified
  Result: Full research, 5-12 phases, deep verification, gap closure
```

### Pattern 3: Autonomous Execution Loop with Self-Repair

**What:** After verification finds gaps, automatically generate fix plans, execute them, and re-verify -- without human intervention. Only escalate to human if auto-fix fails after N attempts.

**When to use:** After every phase verification. Replaces the current manual gap-closure cycle.

**Trade-offs:** Risk of infinite fix loops. Mitigate with attempt limit (max 3) and escalation threshold.

```
Execute Phase
    |
    v
Verify Phase -----> PASSED -----> Continue to next
    |
    | GAPS FOUND
    v
Auto-Generate Fix Plans (from VERIFICATION.md gaps)
    |
    v
Execute Fix Plans
    |
    v
Re-Verify -----> PASSED -----> Continue
    |
    | STILL GAPS (attempt < 3)
    v
Loop back to Auto-Generate Fix Plans
    |
    | STILL GAPS (attempt >= 3)
    v
Escalate to Human (end-of-run report)
```

### Pattern 4: Front-Loaded Interaction Consolidation

**What:** Merge all human interaction into a single upfront session. Currently GSD has 6+ interaction points spread across the lifecycle. GSDR consolidates them.

**When to use:** Always -- this is the core UX change.

**Current GSD flow (6+ stops):**
1. Questioning (new-project)
2. Config (new-project)
3. Requirements scoping (new-project)
4. Roadmap approval (new-project)
5. Discuss-phase (per phase -- N phases = N stops)
6. Checkpoints (during execution)
7. Verification (per phase)

**GSDR flow (1 stop):**
1. Consolidated upfront session:
   - What are you building? (questioning)
   - Here's my understanding, correct? (PROJECT.md confirmation)
   - For each identified gray area: how do you want this? (discuss-all-phases)
   - Here's the plan. Go? (roadmap approval)
2. Everything after is autonomous.

## Data Flow

### Primary Execution Flow

```
[User Input]
    |
    v
[Front-Load Session] --> PROJECT.md, REQUIREMENTS.md, ROADMAP.md
    |                     config.json, per-phase CONTEXT.md
    v
[Complexity Calibrator] --> calibration metadata in config.json
    |
    v
[Dependency Graph Builder] --> dependency-graph.json
    |
    v
[Scheduler Loop]
    |
    +---> [Get Ready Nodes from Graph]
    |         |
    |         v
    |     [For each ready node:]
    |         |
    |         +---> If plan node: [Planner Agent] --> PLAN.md
    |         |         |
    |         |         v
    |         |     [Checker Agent] --> revision loop
    |         |
    |         +---> If execute node: [Executor Agent] --> code + SUMMARY.md
    |         |         |
    |         |         v
    |         |     [Verify] --> VERIFICATION.md
    |         |         |
    |         |         v
    |         |     [Auto-fix loop if needed]
    |         |
    |         v
    |     [Mark complete in graph]
    |     [Update STATE.md]
    |
    +---> [Check: all complete?]
              |
              v
          [End-of-Run Report to User]
```

### State Management

```
.planning/
├── config.json               # Settings + calibration level
├── PROJECT.md                # What we're building (set once upfront)
├── REQUIREMENTS.md           # What must be delivered
├── ROADMAP.md                # Phase structure with dependencies
├── STATE.md                  # Current position (with YAML frontmatter)
├── dependency-graph.json     # NEW: DAG of all phases/plans
├── execution-log.json        # NEW: What ran, when, results
├── research/                 # Project-level research
├── phases/
│   └── XX-name/
│       ├── XX-CONTEXT.md     # User decisions (gathered upfront)
│       ├── XX-RESEARCH.md    # Phase-specific research
│       ├── XX-YY-PLAN.md     # Execution plans
│       ├── XX-YY-SUMMARY.md  # Execution results
│       └── XX-VERIFICATION.md # Verification report
└── codebase/                 # Codebase mapping (brownfield)
```

### Key Data Flows

1. **Dependency resolution:** ROADMAP.md `Depends on:` fields + PLAN.md `depends_on:` frontmatter + `files_modified:` conflict detection --> dependency-graph.json
2. **Progress tracking:** SUMMARY.md creation triggers graph node completion --> STATE.md update --> progress recalculation
3. **Verification cascade:** VERIFICATION.md `gaps_found` --> auto-generate fix PLAN.md --> execute --> re-verify (loop)
4. **Calibration input:** PROJECT.md requirements count + REQUIREMENTS.md complexity + codebase size --> calibration level --> controls phase count, research depth, plan granularity

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Simple script (1-3 files) | Calibrator skips research + verification. 1 phase, 1 plan, direct execution. |
| Medium feature (5-20 files) | Standard flow with 3-5 phases. Parallel planning where deps allow. |
| Large system (20+ files) | Full treatment with research, verification, gap closure. Maximum parallelism via graph. |

### Scaling Priorities

1. **First bottleneck: Context window exhaustion.** Orchestrator context fills up managing many parallel agents. Prevention: Keep orchestrator lean (paths only, not content). GSD already does this well -- orchestrator uses ~10-15% context.
2. **Second bottleneck: Agent spawn limits.** Claude Code caps parallel Task() calls. Prevention: Graph scheduler batches to respect limits (observed ~10 concurrent).
3. **Third bottleneck: File conflicts.** Parallel agents modifying same files. Prevention: `files_modified` frontmatter in plans enables conflict detection before scheduling.

## Anti-Patterns

### Anti-Pattern 1: Orchestrator as Worker

**What people do:** Have the orchestrator LLM read plan files, understand code, and make decisions about execution order.
**Why it's wrong:** Fills orchestrator context window. GSD's approach of "orchestrator coordinates, agents execute" is correct.
**Do this instead:** Orchestrator passes paths only. Agents read files themselves with fresh context. Keep orchestrator at 10-15% context usage.

### Anti-Pattern 2: Implicit Dependencies

**What people do:** Assume sequential phase order means phase N depends on phase N-1. Run everything sequentially "to be safe."
**Why it's wrong:** Wastes time. Many phases have independent concerns (e.g., "Auth" and "Database schema" and "UI layout" can often be parallel).
**Do this instead:** Require explicit `depends_on` declarations. Build DAG. Only enforce actual dependencies.

### Anti-Pattern 3: Over-Engineering Simple Tasks

**What people do:** Run the full pipeline (research, multi-phase roadmap, verification, gap closure) for a task that's a single file change.
**Why it's wrong:** Turns a 5-minute task into 30 minutes of overhead. GSD's current pain point.
**Do this instead:** Complexity calibrator detects lightweight tasks and bypasses unnecessary stages. Already partially addressed by GSD's `/gsd:quick` command, but GSDR makes it automatic.

### Anti-Pattern 4: Human in the Loop During Execution

**What people do:** Pause execution for human approval at every phase boundary, checkpoint, and verification.
**Why it's wrong:** Defeats the purpose of autonomous execution. User has to babysit.
**Do this instead:** Front-load all decisions. Auto-approve checkpoints. Auto-fix verification gaps. Only present to human at the end, or if auto-fix fails after max attempts.

### Anti-Pattern 5: State in Agent Memory

**What people do:** Rely on the LLM "remembering" what happened in previous phases.
**Why it's wrong:** Context compaction loses details. New agents have no memory of previous sessions.
**Do this instead:** GSD's approach is correct -- all state persisted to .planning/ files. GSDR adds dependency-graph.json and execution-log.json for graph state.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Code CLI | Primary runtime -- Task() for subagents, Bash() for tools | GSDR runs as a Claude Code extension (slash commands + CLAUDE.md) |
| Git | Atomic commits per task, branch strategies | Keep GSD's git integration (gsd-tools commit) |
| npm registry | Distribution as `gsdr` package | Install populates ~/.claude/ with workflows, templates, tools |
| MCP servers | Optional external tool access (web search, etc.) | Context7 for docs, Brave for search |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Workflows <-> CLI tools | Bash commands invoking gsd-tools.cjs | JSON output parsed by LLM orchestrator. Keep this pattern -- it's deterministic and debuggable. |
| Orchestrator <-> Agents | Task() calls with prompt + file paths | Agents read their own context. Return structured markdown. |
| Engine <-> State | File reads/writes via tools module | dependency-graph.json is the shared coordination state |
| Calibrator <-> Workflows | Config.json `calibration_level` field | Workflows check level and skip/include stages accordingly |
| Graph scheduler <-> Executor | Ready-node batches | Scheduler determines what can run. Executor spawns agents. |

## Build Order Implications

The dependency structure between GSDR components determines build order:

```
Phase 1: Foundation (no deps)
├── Fork GSD codebase
├── Remove multi-runtime abstractions (Claude Code only)
├── Port bin/lib/*.cjs to TypeScript
└── npm package structure (npx gsdr)

Phase 2: Complexity Calibrator (depends on: Phase 1)
├── Calibration heuristics
├── Config integration (calibration_level in config.json)
└── Workflow conditional logic (skip stages per level)

Phase 3: Front-Loaded Interaction (depends on: Phase 1)
├── Consolidate questioning + discuss into single session
├── All-phases context gathering upfront
├── Remove per-phase interaction gates
└── Auto-approve checkpoints

Phase 4: Dependency Graph Engine (depends on: Phase 1)
├── DAG builder from ROADMAP.md + PLAN.md metadata
├── File conflict detection
├── Parallel-safe batch computation
└── dependency-graph.json persistence

Phase 5: Autonomous Execution (depends on: Phase 3, Phase 4)
├── Graph-based scheduler (replaces sequential phase loop)
├── Parallel planning across phases
├── Auto-verify + auto-fix loop
└── End-of-run reporting

Phase 6: Integration & Polish (depends on: all above)
├── End-to-end testing
├── Calibrator accuracy tuning
├── Documentation
└── npm publish
```

**Critical path:** Phase 1 -> Phase 4 -> Phase 5. The dependency graph engine is the most novel and highest-risk component. Phase 2 and Phase 3 can be built in parallel with Phase 4.

**Phase ordering rationale:**
- Phase 1 first because everything depends on a working fork with TypeScript tooling
- Phase 2 and 3 are independent of each other and of Phase 4 -- build in parallel
- Phase 4 before Phase 5 because the scheduler needs the graph engine
- Phase 5 is the capstone -- combines all new capabilities into the autonomous loop
- Phase 6 is polish after the core architecture works

## What to Preserve from GSD

GSD has several architectural decisions that are **correct and should be kept:**

1. **Markdown-as-code workflows** -- LLM-native orchestration format
2. **Orchestrator/worker separation** -- orchestrator coordinates, agents execute
3. **Path-only context passing** -- keeps orchestrator lean
4. **gsd-tools.cjs CLI pattern** -- deterministic operations in JS, not in LLM
5. **STATE.md with YAML frontmatter** -- machine-readable + human-readable state
6. **Wave-based parallelism** -- extend it, don't replace it
7. **Atomic commits per task** -- proven git integration
8. **Verification-driven gap closure** -- the feedback loop works, just needs automation
9. **Agent role specialization** -- different models for different tasks
10. **Template-driven output** -- consistent artifacts

## What to Change

1. **Remove sequential phase gates** -- replace with dependency graph ordering
2. **Remove per-phase human interaction** -- front-load everything
3. **Add complexity calibration** -- prevent over-engineering
4. **Add dependency graph engine** -- enable cross-phase parallelism
5. **Automate verification loop** -- auto-fix + re-verify without human
6. **Simplify to Claude Code only** -- remove multi-runtime abstraction layers
7. **Add execution logging** -- execution-log.json for debugging and reporting

## Sources

- Direct source analysis of GSD codebase at `~/.claude/get-shit-done/` (HIGH confidence)
- [AI Coding Agents in 2026: Coherence Through Orchestration](https://mikemason.ca/writing/ai-coding-agents-jan-2026/)
- [The State of AI Coding Agents (2026)](https://medium.com/@dave-patten/the-state-of-ai-coding-agents-2026-from-pair-programming-to-autonomous-ai-teams-b11f2b39232a)
- [LangGraph Multi-Agent Orchestration Architecture Guide](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-ai-framework-2025-complete-architecture-guide-multi-agent-orchestration-analysis)
- [Claude Code Sub-Agents: Parallel vs Sequential Patterns](https://claudefa.st/blog/guide/agents/sub-agent-best-practices)
- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Multi-Agent Orchestration: Running 10+ Claude Instances in Parallel](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)
- [2026 Agentic Coding Trends Report - Anthropic](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf?hsLang=en)
- [Spec-Driven Development with Claude Code in Action](https://alexop.dev/posts/spec-driven-development-claude-code-in-action/)

---
*Architecture research for: AI coding assistant meta-prompting/orchestration system*
*Researched: 2026-03-14*
