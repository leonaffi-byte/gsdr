# Phase 4: Dependency Graph Engine - Research

**Researched:** 2026-03-15
**Domain:** DAG scheduling, file-conflict detection, parallel agent orchestration
**Confidence:** HIGH

## Summary

Phase 4 builds the dependency graph engine that enables cross-phase parallelism in GSDR. The system must parse ROADMAP.md `Depends on` fields to construct a DAG, detect file-level conflicts between plans using `files_modified` frontmatter, compute parallel-safe execution batches, and enforce Claude Code's agent concurrency limits (3-5 per feature area, max 10 total).

The existing codebase already has substantial building blocks: `roadmap.ts:cmdRoadmapAnalyze` already parses `Depends on` fields for every phase, `phase.ts:cmdPhasePlanIndex` already reads `files_modified` and `wave` from plan frontmatter, and `execute-phase/SKILL.md` already implements within-phase wave-based parallel execution using Task agents. The work is primarily about composing these existing primitives into a new scheduling layer and extending the execute-phase orchestrator to handle cross-phase parallelism.

This is fundamentally an internal tooling and orchestration problem -- no external libraries are needed. The DAG is small (5-20 phases typically), conflict detection is string-set intersection, and batching is topological sort with constraints. All logic belongs in the existing TypeScript codebase with pure Node.js stdlib.

**Primary recommendation:** Build a new `src/lib/scheduler.ts` module that exports DAG construction, conflict detection, and batch computation functions. Add a `dependency-graph` CLI command for generating `dependency-graph.json`. Extend `execute-phase` orchestrator to optionally run multiple phases when their dependencies are satisfied.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARA-01 | Cross-phase dependency graph: analyze ROADMAP.md to determine which phases can run concurrently | `cmdRoadmapAnalyze` already parses `Depends on` fields; needs topological sort + concurrency group computation |
| PARA-02 | File-level conflict detection: prevent two parallel agents from editing the same file | `cmdPhasePlanIndex` already reads `files_modified` from frontmatter; needs set-intersection check across plans in a batch |
| PARA-03 | Preserve within-phase wave execution from GSD (independent plans run in parallel) | Already implemented in `execute-phase/SKILL.md`; verify it still works when cross-phase scheduler wraps it |
| PARA-04 | Plan all phases in parallel where possible (not just execute) | Requires extending plan-phase orchestrator or building a new multi-phase orchestrator that spawns plan-phase for multiple phases concurrently |
| PARA-05 | Respect Claude Code agent spawn limits (~5-10 concurrent agents) | Scheduler must cap batch size; configurable `max_concurrent_agents` parameter (default 5, max 10) |
| PARA-06 | File ownership contracts in every agent spawn prompt (explicit files_modified declarations) | Already required in plan frontmatter schema; needs enforcement at scheduler level before spawning |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js stdlib | >=18.0.0 | All DAG/scheduling logic | No external deps needed for small graphs; keeps bundle size minimal |
| TypeScript | ^5.7.0 | Type safety for graph structures | Already in project devDependencies |
| vitest | ^3.0.0 | Testing DAG algorithms | Already in project devDependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| esbuild | ^0.24.0 | Bundle new modules into gsdr-tools.cjs | Already configured in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom DAG | graphlib / dagre | Overkill for <20 node graphs; adds npm dependency for trivial topology |
| Custom scheduler | Bull/BullMQ | These are job queues for distributed systems; GSDR runs locally in one process |

**Installation:**
```bash
# No new dependencies needed -- all built on existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
  scheduler.ts        # NEW: DAG construction, conflict detection, batch computation
  roadmap.ts          # EXTEND: parse depends_on into structured format
  phase.ts            # EXISTING: cmdPhasePlanIndex already reads files_modified
  commands.ts         # EXTEND: add dependency-graph command
  init.ts             # EXTEND: add init for multi-phase orchestration

skills/
  execute-phase/
    SKILL.md          # EXTEND: cross-phase orchestration mode
  plan-phase/
    SKILL.md          # EXTEND: multi-phase parallel planning mode

.planning/
  dependency-graph.json  # OUTPUT: generated DAG artifact
```

### Pattern 1: DAG as JSON Artifact
**What:** Generate `dependency-graph.json` from ROADMAP.md as a build step, then consume it during execution.
**When to use:** Before planning or executing phases.
**Example:**
```typescript
// dependency-graph.json structure
interface DependencyGraph {
  generated: string;                    // ISO timestamp
  phases: PhaseNode[];
  edges: DependencyEdge[];
  batches: ExecutionBatch[];
}

interface PhaseNode {
  phase_number: string;
  phase_name: string;
  depends_on: string[];                 // parsed from ROADMAP.md
  status: 'complete' | 'planned' | 'pending';
  plans: PlanSummary[];
}

interface PlanSummary {
  id: string;
  wave: number;
  files_modified: string[];
  autonomous: boolean;
}

interface DependencyEdge {
  from: string;                         // phase_number (dependency)
  to: string;                           // phase_number (dependent)
}

interface ExecutionBatch {
  batch_number: number;
  phases: string[];                     // phase_numbers that can run concurrently
  max_agents: number;                   // calculated from plan counts in batch
  file_conflicts: FileConflict[];       // detected conflicts within batch
}

interface FileConflict {
  file: string;
  plans: string[];                      // plan IDs that modify this file
  resolution: 'sequential';             // plans must run in different waves
}
```

### Pattern 2: Topological Sort with Batch Grouping
**What:** Kahn's algorithm for topological ordering, then group into concurrency-safe batches.
**When to use:** Computing which phases can run in parallel.
**Example:**
```typescript
function computeBatches(graph: DependencyGraph, maxAgents: number): ExecutionBatch[] {
  // 1. Build in-degree map
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const phase of graph.phases) {
    inDegree.set(phase.phase_number, 0);
    adjacency.set(phase.phase_number, []);
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // 2. BFS-based batching (Kahn's algorithm)
  const batches: ExecutionBatch[] = [];
  let ready = [...inDegree.entries()]
    .filter(([_, deg]) => deg === 0)
    .map(([phase]) => phase);

  let batchNum = 0;
  while (ready.length > 0) {
    batchNum++;
    // Filter out already-complete phases
    const pending = ready.filter(p =>
      graph.phases.find(ph => ph.phase_number === p)?.status !== 'complete'
    );

    // Check file conflicts within this batch
    const conflicts = detectFileConflicts(graph, pending);

    // Respect agent limits
    const totalAgents = pending.reduce((sum, p) => {
      const phase = graph.phases.find(ph => ph.phase_number === p)!;
      return sum + phase.plans.length;
    }, 0);

    batches.push({
      batch_number: batchNum,
      phases: pending,
      max_agents: Math.min(totalAgents, maxAgents),
      file_conflicts: conflicts,
    });

    // Advance: reduce in-degree for dependents
    const nextReady: string[] = [];
    for (const phase of ready) {
      for (const dependent of adjacency.get(phase) || []) {
        const newDeg = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, newDeg);
        if (newDeg === 0) nextReady.push(dependent);
      }
    }
    ready = nextReady;
  }

  return batches;
}
```

### Pattern 3: File Conflict Detection via Set Intersection
**What:** Compare `files_modified` arrays across all plans in a concurrent batch.
**When to use:** Before scheduling plans to run in parallel.
**Example:**
```typescript
function detectFileConflicts(
  graph: DependencyGraph,
  batchPhases: string[]
): FileConflict[] {
  // Collect all files_modified from all plans in all batch phases
  const fileOwners = new Map<string, string[]>(); // file -> [planId, ...]

  for (const phaseNum of batchPhases) {
    const phase = graph.phases.find(p => p.phase_number === phaseNum)!;
    for (const plan of phase.plans) {
      for (const file of plan.files_modified) {
        // Normalize path (glob patterns need expansion, but exact paths suffice)
        const normalized = file.replace(/\\/g, '/');
        if (!fileOwners.has(normalized)) fileOwners.set(normalized, []);
        fileOwners.get(normalized)!.push(plan.id);
      }
    }
  }

  // Find conflicts (2+ plans modifying same file)
  const conflicts: FileConflict[] = [];
  for (const [file, plans] of fileOwners) {
    if (plans.length > 1) {
      conflicts.push({ file, plans, resolution: 'sequential' });
    }
  }

  return conflicts;
}
```

### Pattern 4: Agent Budget Distribution
**What:** Distribute the max_concurrent_agents budget across parallel phases.
**When to use:** When a batch has more plans than the agent limit allows.
**Example:**
```typescript
interface AgentBudget {
  phase: string;
  allocated_agents: number;
  total_plans: number;
}

function distributeAgentBudget(
  batch: ExecutionBatch,
  graph: DependencyGraph,
  maxAgents: number
): AgentBudget[] {
  const phases = batch.phases.map(p => ({
    phase: p,
    plans: graph.phases.find(ph => ph.phase_number === p)!.plans.length,
  }));

  const totalPlans = phases.reduce((s, p) => s + p.plans, 0);

  if (totalPlans <= maxAgents) {
    // Everyone gets what they need
    return phases.map(p => ({
      phase: p.phase,
      allocated_agents: p.plans,
      total_plans: p.plans,
    }));
  }

  // Proportional allocation with minimum 1
  const allocations = phases.map(p => ({
    phase: p.phase,
    allocated_agents: Math.max(1, Math.round((p.plans / totalPlans) * maxAgents)),
    total_plans: p.plans,
  }));

  // Adjust to not exceed budget
  let total = allocations.reduce((s, a) => s + a.allocated_agents, 0);
  while (total > maxAgents) {
    const largest = allocations.reduce((max, a) =>
      a.allocated_agents > max.allocated_agents ? a : max
    );
    largest.allocated_agents--;
    total--;
  }

  return allocations;
}
```

### Anti-Patterns to Avoid
- **Parsing ROADMAP.md every time an agent spawns:** Parse once, write to `dependency-graph.json`, consume the JSON. Reparsing is slow and risks inconsistent state.
- **Glob patterns in files_modified:** Exact file paths only. Glob patterns (like `src/**/*.ts`) create false positives and make conflict detection unreliable.
- **Implicit file ownership:** Every plan MUST declare `files_modified` in frontmatter. Plans without this field must be treated as conflicting with everything (fail-safe default).
- **Spawning agents without checking budget:** Always check remaining agent budget before spawning. Claude Code will reject or degrade if too many agents run concurrently.
- **Modifying execute-phase to always do cross-phase:** Keep the existing single-phase mode as default. Cross-phase mode should be opt-in via a new command or flag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topological sort | Custom recursive traversal | Kahn's algorithm (BFS-based) | Kahn's naturally produces batches, detects cycles, and is iterative (no stack overflow for large graphs) |
| YAML frontmatter parsing | New parser | Existing `extractFrontmatter()` in `frontmatter.ts` | Already handles arrays and nested objects; proven in production |
| Phase discovery | Manual directory scanning | Existing `cmdRoadmapAnalyze()` + `cmdPhasePlanIndex()` | Already parse depends_on, files_modified, waves correctly |
| Agent spawning | New task runner | Existing Task() agent protocol in `execute-phase/SKILL.md` | Proven pattern with error handling, spot-checks, and checkpoint support |

**Key insight:** Nearly all the parsing infrastructure already exists. The work is composing existing parsers into a scheduler and extending the orchestrator skills. Do not rewrite parsers.

## Common Pitfalls

### Pitfall 1: Circular Dependencies
**What goes wrong:** Phase A depends on Phase B which depends on Phase A, causing infinite loop in scheduler.
**Why it happens:** Manual ROADMAP.md editing can introduce cycles.
**How to avoid:** Kahn's algorithm naturally detects cycles -- if any nodes remain after processing, there is a cycle. Report the cycle and halt.
**Warning signs:** `computeBatches` returns fewer phases than expected; remaining in-degree > 0 for some nodes.

### Pitfall 2: Missing files_modified Declarations
**What goes wrong:** Two agents edit the same file concurrently, causing merge conflicts or data loss.
**Why it happens:** Plan authors forget to declare all files they will modify.
**How to avoid:** Enforce `files_modified` as required frontmatter (already in schema). Add a pre-execution validation step that warns if any plan has empty `files_modified`. Treat plans with empty `files_modified` as unsafe for parallel execution (must run sequentially).
**Warning signs:** Empty `files_modified: []` in plan frontmatter; merge conflicts after parallel execution.

### Pitfall 3: Over-Parallelization Causing Agent Failures
**What goes wrong:** Spawning too many agents causes Claude Code to degrade or reject spawns.
**Why it happens:** Not tracking active agent count across the batch.
**How to avoid:** Hard cap at `max_concurrent_agents` (default 5, configurable up to 10). Track active agents and only spawn when slots are available.
**Warning signs:** Agent spawn errors, timeouts, or degraded quality in parallel runs.

### Pitfall 4: Stale dependency-graph.json
**What goes wrong:** Graph was generated before plans were created, so `files_modified` data is missing or outdated.
**Why it happens:** Plans are created after the graph is generated but before execution.
**How to avoid:** Regenerate the graph immediately before execution (not during planning). Include a staleness check that compares plan file mtimes to graph generation time.
**Warning signs:** `dependency-graph.json` timestamp predates newest PLAN.md.

### Pitfall 5: Conflating Phase Dependencies with Plan Dependencies
**What goes wrong:** Cross-phase scheduling ignores within-phase wave dependencies.
**Why it happens:** The scheduler handles phase-level batching but forgets that plans within a phase have their own wave ordering.
**How to avoid:** Two-level scheduling: Phase-level batches (cross-phase) then plan-level waves (within-phase, already handled by execute-phase). Never flatten these into one level.
**Warning signs:** Within-phase plans running out of order.

### Pitfall 6: Depends On Parsing Edge Cases
**What goes wrong:** "Depends on: Phase 1" vs "Depends on: Phase 1, Phase 2" vs "Depends on: Nothing (first phase)" parsed inconsistently.
**Why it happens:** Free-text field with no strict format.
**How to avoid:** `cmdRoadmapAnalyze` already parses this field. Reuse that parser. Normalize: "Nothing" -> empty array, "Phase 1" -> ["1"], "Phase 1, Phase 2" -> ["1", "2"], "Phases 1 and 3" -> ["1", "3"].
**Warning signs:** Phases with dependencies showing as independent.

## Code Examples

### Existing: Roadmap Dependency Parsing (Already in codebase)
```typescript
// Source: src/lib/roadmap.ts lines 128-129
const dependsMatch = section.match(/\*\*Depends on:\*\*\s*([^\n]+)/i);
const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
```

### Existing: Plan files_modified Reading (Already in codebase)
```typescript
// Source: src/lib/phase.ts lines 269-271
const fmFiles = fm['files_modified'] || fm['files-modified'];
if (fmFiles) {
  filesModified = Array.isArray(fmFiles) ? fmFiles as string[] : [fmFiles as string];
}
```

### Existing: Wave Grouping (Already in codebase)
```typescript
// Source: src/lib/phase.ts lines 291-295
const waveKey = String(wave);
if (!waves[waveKey]) {
  waves[waveKey] = [];
}
waves[waveKey].push(planId);
```

### New: Depends On String to Phase Number Array
```typescript
function parseDependsOn(dependsOnStr: string | null): string[] {
  if (!dependsOnStr) return [];
  const normalized = dependsOnStr.toLowerCase().trim();
  if (normalized === 'nothing' || normalized.includes('first phase') || normalized === 'none') {
    return [];
  }
  // Extract all phase numbers: "Phase 1", "Phase 1, Phase 2", "Phases 1 and 3"
  const matches = dependsOnStr.match(/\d+(?:\.\d+)*/g);
  return matches ? [...new Set(matches)] : [];
}
```

### New: CLI Command for Dependency Graph Generation
```typescript
// Add to src/lib/commands.ts
export function cmdDependencyGraph(cwd: string, raw: boolean): void {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  // 1. Parse ROADMAP.md for all phases + dependencies (reuse cmdRoadmapAnalyze logic)
  // 2. For each phase, load plan index (reuse cmdPhasePlanIndex logic)
  // 3. Build DAG structure
  // 4. Compute batches with conflict detection
  // 5. Write dependency-graph.json
  // 6. Output summary
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential phases only | Wave-based parallelism within phase | GSD original (pre-fork) | Plans in same wave run in parallel |
| Manual phase ordering | Phase `Depends on` field in ROADMAP.md | GSDR Phase 1 (2026-03-15) | Dependency data exists but unused |
| No file conflict detection | `files_modified` in plan frontmatter | GSD original (pre-fork) | Data collected but not enforced |

**Current gap:** All the data for cross-phase parallelism already exists in the project metadata (depends_on, files_modified, wave assignments). What's missing is the scheduling logic that consumes this data.

## Open Questions

1. **How should cross-phase execution be triggered?**
   - What we know: `execute-phase` currently handles one phase at a time. A new orchestrator or mode is needed.
   - What's unclear: Should this be a new skill (`gsdr:execute-parallel`) or a flag on `execute-phase` (`--parallel`)?
   - Recommendation: New skill `gsdr:execute-milestone` that wraps execute-phase calls based on the dependency graph. Keeps execute-phase simple and backward-compatible.

2. **Should dependency-graph.json be committed to git?**
   - What we know: It's a derived artifact (generated from ROADMAP.md + plan frontmatter).
   - What's unclear: Stale artifacts in git can mislead. But having it in git provides audit trail.
   - Recommendation: Generate on-the-fly before execution. Optionally write to `.planning/dependency-graph.json` and commit if `commit_docs` is true.

3. **How to handle partial phase completion in cross-phase mode?**
   - What we know: A phase might be partially complete (some plans done, some pending).
   - What's unclear: Should the scheduler treat partially-complete phases as "satisfied" for dependent phases?
   - Recommendation: A phase's dependency is satisfied only when ALL plans in that phase have SUMMARYs. Partial completion does not unblock dependents.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | vitest.config implied (package.json `vitest run`) |
| Quick run command | `npx vitest run tests/dependency-graph.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARA-01 | Parse ROADMAP.md Depends on -> DAG; compute concurrent batches | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-01"` | No -- Wave 0 |
| PARA-02 | Two plans with overlapping files_modified never in same parallel batch | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-02"` | No -- Wave 0 |
| PARA-03 | Within-phase wave execution preserved | integration | `npx vitest run tests/dependency-graph.test.ts -t "PARA-03"` | No -- Wave 0 |
| PARA-04 | Multiple phases planned concurrently when deps satisfied | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-04"` | No -- Wave 0 |
| PARA-05 | Agent count capped at configurable limit (default 5, max 10) | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-05"` | No -- Wave 0 |
| PARA-06 | Plans without files_modified treated as unsafe for parallel exec | unit | `npx vitest run tests/dependency-graph.test.ts -t "PARA-06"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dependency-graph.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsdr:verify-work`

### Wave 0 Gaps
- [ ] `tests/dependency-graph.test.ts` -- covers PARA-01 through PARA-06
- [ ] Test fixtures: mock ROADMAP.md, mock plan frontmatter with files_modified

*(Existing test infrastructure (vitest) covers framework needs. Only test files and fixtures are missing.)*

## Sources

### Primary (HIGH confidence)
- **Existing codebase:** `src/lib/roadmap.ts` -- already parses `Depends on` fields (lines 128-129)
- **Existing codebase:** `src/lib/phase.ts` -- already reads `files_modified` from plan frontmatter (lines 269-271), wave grouping (lines 291-295)
- **Existing codebase:** `src/lib/frontmatter.ts` -- plan schema requires `files_modified`, `wave`, `depends_on` (line 221)
- **Existing codebase:** `skills/execute-phase/SKILL.md` -- wave-based parallel execution pattern with Task agents
- **Existing codebase:** `skills/plan-phase/SKILL.md` -- planning orchestration with research/plan/check loop
- **ROADMAP.md:** Phase structure with `Depends on` fields and plan placeholders
- **REQUIREMENTS.md:** PARA-01 through PARA-06 requirement definitions

### Secondary (MEDIUM confidence)
- Kahn's algorithm for topological sort is well-established computer science (textbook algorithm, not library-specific)

### Tertiary (LOW confidence)
- Claude Code concurrent agent limits (3-5 per feature area, max 10 total) -- from REQUIREMENTS.md, may need empirical validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing project tooling
- Architecture: HIGH -- building blocks already exist in codebase; patterns are straightforward DAG algorithms
- Pitfalls: HIGH -- derived from analyzing existing codebase patterns and the specific ROADMAP.md format
- Agent limits: MEDIUM -- stated in requirements but exact Claude Code limits may vary by plan/account

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- internal tooling, no external dependency volatility)
