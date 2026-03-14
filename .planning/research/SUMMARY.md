# Project Research Summary

**Project:** GSDR (Get Shit Done Reloaded)
**Domain:** AI coding assistant meta-prompting / spec-driven development orchestration (Claude Code fork)
**Researched:** 2026-03-14 to 2026-03-15
**Confidence:** HIGH

## Executive Summary

GSDR is a fork of GSD v1 (`get-shit-done-cc`) that targets three core problems with the original: it over-engineers simple tasks (no complexity calibration), requires constant human intervention at every phase boundary, and parallelizes only within a phase rather than across the entire project. Experts building AI orchestration systems in 2026 converge on a consistent architecture: markdown-as-code workflow scripts, isolated fresh-context sub-agents per task, deterministic CLI tooling for file/git operations, and structured state in human-readable files. GSD already follows this architecture correctly — GSDR's job is to extend it with a dependency graph engine, a complexity calibrator, and front-loaded interaction consolidation, not to redesign from scratch.

The recommended approach is to fork GSD, port its CJS tooling to TypeScript (Node 22 LTS with native type-stripping, bundled to CJS via esbuild), adopt the Claude Code Plugin format (Skills + Subagents) from the start, and then layer three new capabilities: (1) automatic complexity classification that selects planning depth without user input, (2) consolidation of all human interaction into a single upfront session, and (3) a dependency graph engine that enables cross-phase parallelism with file-conflict detection. These capabilities compose into the core differentiator: a system where the user spends 10-15 minutes upfront and returns to a completed, verified, committed codebase.

The primary risks are architectural rather than technical. Parallel execution with shared working directories causes silent file overwrites — the single most catastrophic failure mode, documented in multiple production incidents. Auto-fix loops without hard retry caps turn verification failures into runaway token spend and a worse codebase state. Complexity calibration based on surface signals (description length, file count) systematically misfires in both directions. All three risks have clear mitigations: explicit file-ownership contracts per agent spawn, a two-strike halt-and-escalate rule for fix loops, and a multi-signal complexity classifier with a mandatory user override path shown at the end of the front-load session.

## Key Findings

### Recommended Stack

GSDR should be written in TypeScript (source), bundled to a single `gsd-tools.cjs` via esbuild for distribution, and run on Node.js 22 LTS. Node 22.18+ strips TypeScript types natively, eliminating the "build step for every change" objection for development and testing. The only runtime dependency is the `yaml` library for frontmatter parsing — everything else uses Node built-ins. Distribution is via the Claude Code Plugin format (`plugin.json` manifest, `skills/`, `agents/`, `hooks/` directories), delivered through npm as `gsdr` with a postinstall script. Testing uses Node's native test runner (`node:test`) and c8 for coverage — no Vitest, no Jest.

**Core technologies:**
- Node.js 22 LTS (22.18+): Runtime — active LTS through April 2027, native TypeScript type-stripping, stable native test runner
- TypeScript 5.7+ (erasable-only syntax): Source language — type safety across 25+ subcommands; use `as const` objects, never enums or decorators (incompatible with Node type-stripping)
- esbuild 0.25.x: Bundler — sub-100ms CJS bundle from TypeScript source; the exact pattern GSD v1 already uses
- Claude Code Plugin format (CC 1.0.33+): Distribution — Skills replace legacy commands, Subagents replace agent role prompts
- `yaml` 2.x: Only runtime dependency — correct YAML frontmatter parsing for STATE.md, PLAN.md, SUMMARY.md files
- Node `node:test` + c8: Testing — zero external dependencies; avoids Vite overhead of Vitest for a pure CLI tool

### Expected Features

The feature research analyzed GSD, BMAD Method, Spec Kit, and Taskmaster to separate table stakes from differentiators.

**Must have (table stakes) — these are inherited from GSD:**
- Spec-driven planning (PRD/spec to structured task plans)
- Sub-agent orchestration with fresh context per agent (prevents context rot)
- Wave-based parallel execution within a phase
- Atomic git commits per task
- Context-scoped agents (each sub-agent gets only relevant files, not full codebase)
- Verification after execution with explicit success criteria
- Slash command entry points (`/gsdr:*`)
- Research phase before planning (4 parallel sub-agents: stack, features, architecture, pitfalls)
- XML-structured plan format with verification criteria and file references
- Progress tracking via STATE.md

**Should have (competitive differentiators — the three core GSDR innovations):**
- Smart complexity auto-calibration (3 tiers: Lightweight / Standard / Complex) — auto-detects from project signals, no user input required; BMAD v6 has 3 tracks but user-selected
- Front-loaded interaction consolidation — all human Q&A in one 10-15 minute session, then fully autonomous; no competitor achieves true walk-away execution
- Aggressive cross-phase parallelism with dependency graph — plan Phase 3 while executing Phase 1; no competitor parallelizes across phase boundaries
- Autonomous self-verification with auto-fix loop — verify, auto-fix failures (max 3 retries), escalate only on retry exhaustion
- End-of-run summary report — what was built, what was verified, what (if anything) needs human attention
- Failure escalation that continues independent work — one failed task does not block the entire pipeline

**Defer to v2+:**
- Cross-phase parallelism with file-level conflict detection (builds on v1 dependency graph; complexity warrants phased rollout)
- Intelligent question consolidation (adaptive questioning per complexity tier — optimize after v1 baseline)
- Execution analytics and learning (complexity calibration refinement from outcomes)
- Background execution mode (Claude Code background agent integration)
- Multi-project orchestration

**Anti-features to explicitly avoid:**
- Per-phase human approval gates (defeats the autonomous model)
- Agent persona role-play ("Mary the BA") — adds theater, not quality
- Multi-runtime support (OpenCode, Gemini CLI) — depth over breadth; Claude Code only
- Enterprise agile ceremony features (story points, sprint planning)
- Plugin/extension system — premature abstraction; ship opinionated defaults first

### Architecture Approach

GSDR preserves GSD's proven architectural core (markdown-as-code workflows, orchestrator/worker separation, path-only context passing, gsd-tools.cjs CLI pattern, YAML frontmatter state in `.planning/`) and adds three new components: a Complexity Calibrator, a Dependency Graph Engine, and an Autonomous Verifier. The orchestrator remains lean (10-15% context usage) by passing file paths, not file contents, to sub-agents. The critical design constraint: sub-agents cannot spawn sub-agents, so the orchestrator must explicitly spawn all agents and collect their results.

**Major components:**
1. Front-Loaded Interaction — consolidates questioning + config + requirements + roadmap approval into one session; removes all per-phase gates
2. Complexity Calibrator — multi-signal classifier (system boundaries crossed, schema changes, external dependencies, irreversible operations) that selects planning depth; shows result + override to user at end of front-load session
3. Dependency Graph Engine (NEW, highest complexity) — builds DAG from ROADMAP.md `Depends on:` fields and PLAN.md `depends_on:` frontmatter; detects file conflicts via `files_modified:` declarations; outputs `dependency-graph.json`
4. Parallel Planner — plans multiple phases concurrently when deps allow (was sequential in GSD)
5. Parallel Executor — executes via dependency graph ordering; caps at 3-5 agents per feature area to avoid quadratic merge conflict surface
6. Autonomous Verifier — auto-verify, auto-fix (max 3 retries, two-strike halt rule), re-verify loop; escalate to end-of-run report only on exhaustion
7. CLI Tooling (`gsd-tools.cjs`) — extend GSD's existing pattern; add graph operations (`graph.ts`), execution logging (`execution-log.json`)
8. End-of-Run Reporter (NEW) — summary-first presentation of results, failures, and required human actions
9. State Layer (`.planning/`) — extend with `dependency-graph.json` and `execution-log.json`; all other files preserved from GSD

### Critical Pitfalls

The pitfalls research (confidence: HIGH, corroborated against documented production incidents) identifies eight pitfalls. The top five with direct roadmap implications:

1. **Shared working directory causes silent overwrites** — Parallel agents without file ownership boundaries silently erase each other's work. Prevention: enforce explicit `files_modified:` declarations in every PLAN.md; graph scheduler detects conflicts before spawning; use git worktrees for filesystem-level isolation. Must be designed into task decomposition — cannot be retrofitted.

2. **Auto-fix loops spiral without a hard stop** — "Keep trying until tests pass" becomes runaway token spend and a worse codebase. Prevention: Two-Strike Rule (halt after two consecutive fix attempts that don't reduce failure count); absolute cap of 3 fix attempts per failure; log all fix attempts with diffs for the escalation report.

3. **Irreversible actions without a human gate** — Documented incidents include Replit's agent executing DROP DATABASE on production (July 2025) and Amazon's Kiro deleting a production environment (13-hour AWS outage, December 2025). Prevention: classify all operations by reversibility at design time; destructive operations (rm, DROP, git push to main, npm publish) always require human gate regardless of autonomy level; agents get minimum necessary permissions.

4. **Complexity heuristic misfires in both directions** — Single-metric classifiers (description length, file count) are poor proxies. Prevention: multi-signal classifier (system boundary count, schema changes, external dependencies, reversibility profile, estimated file count); default to slightly more depth than needed; show classification result with rationale to user; always provide override escape hatch.

5. **Context rot silently degrades agent quality** — "Lost in the middle" effect degrades agent output across long sessions; GSD already mitigates this with fresh context per sub-agent. Prevention: preserve GSD's path-only context passing; add context checkpointing at phase boundaries (compress to ~500-token structured summaries); test agent output quality in phase 5 vs. phase 1 before shipping.

Additional pitfalls of note: vague agent spawn prompts causing duplicate work and coverage gaps (treat spawn prompts as formal contracts with file ownership, success criteria, and what-not-to-do constraints); coordination overhead negating parallelism benefits past 5-7 agents (cap at 3-5, measure wall-clock vs. sequential baseline before shipping maximum concurrency).

## Implications for Roadmap

The architecture research directly prescribes build order based on component dependencies. The critical path is: Foundation -> Dependency Graph Engine -> Autonomous Execution. Complexity Calibrator and Front-Loaded Interaction can be built in parallel with the Dependency Graph Engine. The dependency graph is the most novel component and highest-risk — it must be proven before the autonomous execution loop is built on top of it.

### Phase 1: Foundation — Fork, TypeScript Port, Plugin Format

**Rationale:** Everything depends on a working fork with correct tooling. Remove multi-runtime abstractions (Claude Code only). Port `bin/lib/*.cjs` to TypeScript. Establish the npm package and Plugin format structure. No novel functionality — just correct plumbing.
**Delivers:** Working `gsdr` npm package that installs the plugin, `gsd-tools.cjs` CLI in TypeScript, `skills/` and `agents/` directory structure, all GSD table-stakes behavior preserved.
**Addresses:** Sub-agent orchestration, atomic commits, context-scoped agents, slash command entry points (all inherited from GSD)
**Avoids:** Multi-runtime abstraction complexity that GSD carries as technical debt; TypeScript enum pitfall (use `as const` objects)
**Stack elements:** Node.js 22 LTS, TypeScript 5.7+ (erasable-only), esbuild 0.25.x, Claude Code Plugin format
**Research flag:** Standard patterns — no phase research needed; GSD source is the reference implementation

### Phase 2: Complexity Calibrator

**Rationale:** The calibrator gates everything else. Front-loaded questioning depth, research phase inclusion, plan granularity, and verification depth all depend on the calibration tier. Must be built and validated before the interaction model or autonomous loop.
**Delivers:** Multi-signal complexity classifier (Lightweight / Standard / Complex tiers), integration with `config.json` (`calibration_level` field), workflow conditional logic to skip/include stages per tier, user-facing classification display with override escape hatch.
**Implements:** Complexity Calibrator component; `engine/calibrator.ts`
**Features:** Smart complexity auto-calibration (core differentiator #1), complexity-adaptive plan depth
**Avoids:** Complexity heuristic misfire pitfall — validate against a labeled set of 20+ example tasks (heuristic must match 18+); never ship single-metric classifier
**Research flag:** Needs phase research — complexity classification heuristics are domain-specific; validate rubric against real examples before coding

### Phase 3: Front-Loaded Interaction Consolidation

**Rationale:** Independent of the dependency graph engine; can be built in parallel with Phase 4. Removes the 6+ human interaction stops from GSD, consolidating into one upfront session. Required before the autonomous execution loop (Phase 5) because it produces the per-phase CONTEXT.md files that autonomous phases need to run without human input.
**Delivers:** Consolidated questioning + config + requirements + all-phases context gathering in one session; roadmap approval at session end; removal of per-phase discuss/approve/verify gates; auto-checkpoint approval during execution.
**Implements:** Front-Loaded Interaction component; modified `workflows/front-load.md`
**Features:** Front-loaded interaction model (core differentiator #2), intelligent question consolidation
**Avoids:** Per-phase human approval gate anti-pattern; complexity-gated questioning (simple tasks get 3 questions, complex tasks get 15 — enforced by calibration tier from Phase 2)
**Research flag:** Standard patterns — the consolidation logic is straightforward prompt engineering; no phase research needed

### Phase 4: Dependency Graph Engine

**Rationale:** The most novel and highest-risk component. Must be proven in isolation before Phase 5 builds an autonomous execution loop on top of it. Phases 2 and 3 can proceed in parallel with this phase. The graph engine enables both cross-phase parallelism and file-conflict detection — the two capabilities that prevent the silent overwrite pitfall.
**Delivers:** DAG builder from ROADMAP.md and PLAN.md metadata, file-conflict detection via `files_modified:` frontmatter, parallel-safe batch computation, `dependency-graph.json` persistence, graph-aware CLI commands in `gsd-tools.cjs`.
**Implements:** Dependency Graph Engine; `engine/graph.ts`, `engine/scheduler.ts`, `tools/graph.ts`
**Features:** Cross-phase parallelism foundation (core differentiator #3 foundation)
**Avoids:** Shared working directory overwrite pitfall (graph enforces non-overlapping file assignments before spawn); implicit dependency anti-pattern (require explicit `depends_on` declarations, build DAG, only enforce actual dependencies); conservative defaults (serialize when coupling is ambiguous)
**Research flag:** Needs phase research — DAG scheduling for file-conflict-aware parallel agent spawning has nuances; research existing implementations before coding the scheduler

### Phase 5: Autonomous Execution Loop

**Rationale:** Capstone phase — combines all previous capabilities into the full autonomous model. Depends on Phase 3 (front-loaded interaction produces the context autonomous phases consume) and Phase 4 (scheduler needs the dependency graph). Cannot be built until both are complete.
**Delivers:** Graph-based scheduler replacing sequential phase loop, parallel planning across phases, autonomous verify-fix-reverify loop (max 3 retries, two-strike halt rule), failure escalation that continues independent work, end-of-run summary report.
**Implements:** Parallel Planner, Parallel Executor, Autonomous Verifier, End-of-Run Reporter; `engine/runner.ts`, `workflows/auto-fix.md`, `workflows/verify-phase.md` (modified)
**Features:** Autonomous execution (removes gates), self-verification with auto-fix, end-of-run summary report, failure escalation protocol (all core differentiators)
**Avoids:** Auto-fix spiral pitfall (two-strike halt + 3-attempt cap + diff-logged escalation report); irreversible action pitfall (destructive operation gate list must be exhaustive before this phase ships); coordination overhead pitfall (cap 3-5 parallel agents, measure vs. sequential baseline)
**Research flag:** Needs phase research — autonomous execution loop state machine design (particularly terminal state enumeration and escalation report format) benefits from reviewing Ralph Loop pattern implementations and production failure taxonomies

### Phase 6: Integration, Validation, and Polish

**Rationale:** End-to-end validation after all components are integrated. Calibrator accuracy tuning requires real execution data. Documentation and npm publish.
**Delivers:** End-to-end test suite (including chaos tests for auto-fix loop, security tests for irreversible action gates, long-session context quality tests), calibrator tuning against labeled example set, developer documentation, npm publish.
**Avoids:** "Looks done but isn't" failures — runs the full verification checklist from PITFALLS.md against all seven critical items
**Research flag:** Standard patterns — integration testing and npm publishing are well-documented; no phase research needed

### Phase Ordering Rationale

- Phase 1 is the prerequisite for everything; no other phase can start without a working fork and TypeScript tooling
- Phases 2 and 3 are independent of Phase 4 and of each other — the roadmapper can schedule these in parallel with Phase 4
- Phase 4 (Dependency Graph Engine) must complete before Phase 5 because the autonomous scheduler is built on the graph
- Phase 3 (Front-Loaded Interaction) must complete before Phase 5 because autonomous phases consume the per-phase CONTEXT.md files produced upfront
- Phase 5 is the riskiest integration — build it last so failures can be isolated from the components that feed it
- Phase 6 is a gate before npm publish — no publish without chaos tests passing on the auto-fix loop

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- Phase 2 (Complexity Calibrator): Complexity classification heuristics are domain-specific; need to validate multi-signal rubric against labeled examples and review BMAD v6 Scale-Adaptive Intelligence implementation before writing the classifier
- Phase 4 (Dependency Graph Engine): File-conflict-aware parallel agent scheduling with DAG; review existing graph scheduler implementations and Claude Code's observed agent count limits before designing the scheduler
- Phase 5 (Autonomous Execution Loop): State machine design for the verify-fix-reverify loop; review Ralph Loop pattern implementations and production failure taxonomies before coding terminal state enumeration

**Standard patterns (skip research-phase):**
- Phase 1 (Foundation): GSD source code is the reference implementation; TypeScript port patterns are well-established
- Phase 3 (Front-Loaded Interaction): Prompt engineering consolidation; well-understood problem domain given GSD's existing workflows
- Phase 6 (Integration and Polish): Standard testing and npm publishing patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official Claude Code docs, Node.js docs, esbuild docs, and GSD v1 source. No speculation — every choice has a working precedent. |
| Features | HIGH | Four competitors analyzed with direct source access. Feature dependency tree is well-reasoned. MVP definition is opinionated and justified. One gap: complexity calibration tier thresholds need empirical validation. |
| Architecture | HIGH | Based on direct source analysis of GSD codebase. Build order derived from component dependency graph. Component boundaries are clear. One gap: dependency graph engine scheduling algorithm needs deeper design work. |
| Pitfalls | HIGH | Corroborated against documented production incidents (Replit DROP DATABASE, Kiro AWS outage, Antigravity drive deletion) and peer-reviewed failure taxonomy research. Highly actionable with specific prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Complexity calibration thresholds:** The Lightweight/Standard/Complex tier boundaries (1-3 files / 5-20 files / 20+ files) are informed heuristics, not empirically validated. During Phase 2 planning, build a labeled test set of 20+ real projects before writing the classifier.
- **Dependency graph scheduling algorithm:** The DAG scheduler design (specifically how it handles partial failures and re-queuing) needs deeper design work during Phase 4 planning. The `DependencyNode` and `ExecutionGraph` interfaces in ARCHITECTURE.md are a starting point, not a complete design.
- **Claude Code agent spawn concurrency limits:** The architecture notes an observed limit of ~10 concurrent Task() calls, but this is not officially documented. During Phase 4 planning, validate the actual cap and design the scheduler's batch size conservatively around it.
- **Auto-fix loop escalation report format:** The end-of-run report format (what information it contains, how it's structured for human readability) is described in concept but not designed. Validate the format with a real user before Phase 5 ships — PITFALLS.md notes this explicitly.
- **npm publish scope and credentials:** Distribution as `gsdr` on npm requires package name availability and publishing setup. Verify during Phase 6 planning.

## Sources

### Primary (HIGH confidence)
- Claude Code Skills documentation (code.claude.com/docs/en/skills) — Skills format, SKILL.md structure, frontmatter fields
- Claude Code Subagents documentation (code.claude.com/docs/en/sub-agents) — Agent format, all frontmatter fields, parallel execution
- Claude Code Plugins documentation (code.claude.com/docs/en/plugins) — Plugin manifest schema, directory structure
- Node.js TypeScript docs (nodejs.org/en/learn/typescript/run-natively) — Type-stripping stable since v22.18.0
- GSD v1 source at `~/.claude/get-shit-done/` — Direct inspection; reference implementation for all preserved patterns
- GSD v1 npm package (npmjs.com/package/get-shit-done-cc v1.22.4) — Package structure reference

### Secondary (MEDIUM-HIGH confidence)
- BMAD Method source (github.com/bmad-code-org/BMAD-METHOD) — Competitor analysis; Scale-Adaptive Intelligence in v6
- GitHub Spec Kit (github.com/github/spec-kit) — Competitor analysis; constitution-based spec-driven development
- Taskmaster AI (github.com/eyaltoledano/claude-task-master) — Competitor analysis; dependency tracking patterns
- AI Agent Orchestration failure research (builder.io, earezki.com, theaiengineer.substack.com, oreilly.com/radar) — Production incident documentation; failure taxonomy
- Noma Security — Kiro/AWS incident, Replit database deletion, Antigravity drive deletion (documented destructive action failures)
- Claude Code Sub-Agent Best Practices (claudefa.st) — File ownership rule, spawn prompt discipline, mode immutability

### Tertiary (MEDIUM confidence)
- LangGraph multi-agent orchestration research — Parallel agent coordination patterns (not directly applicable but informs graph design)
- Ralph Loop pattern (github.com/snarktank/ralph) — Autonomous retry loop; basis for auto-fix loop design
- BMAD v6 Scale-Adaptive Intelligence (Medium article) — Complexity tier implementation reference

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
