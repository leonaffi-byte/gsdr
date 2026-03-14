# Feature Research

**Domain:** AI coding assistant meta-prompting / spec-driven development orchestration
**Researched:** 2026-03-14
**Confidence:** MEDIUM-HIGH (multiple competitors analyzed, ecosystem patterns well-documented)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users of spec-driven development systems assume exist. Missing these means the product feels incomplete or broken compared to GSD, BMAD, Spec Kit, and Taskmaster.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Spec-driven planning (PRD/spec -> tasks) | Every competitor does this. BMAD uses PRDs, GSD uses CONTEXT.md, Spec Kit uses constitutions + specs. Users won't adopt a system that requires manual task creation. | LOW | Fork from GSD already has this via XML plans and CONTEXT.md generation |
| Sub-agent orchestration | GSD, Claude Code native, and BMAD all spawn sub-agents for isolated execution. Fresh context per task is the proven pattern for avoiding context rot. | MEDIUM | GSD already implements this with fresh 200K token windows per sub-agent |
| Wave-based parallel execution | GSD already does this: independent tasks run in parallel waves, dependent tasks wait. Taskmaster has dependency-driven sequencing. Table stakes because GSD has it. | MEDIUM | Already in GSD; GSDR needs to extend this to cross-phase parallelism |
| Atomic commits per task | GSD pioneered this: each task gets its own git commit. Enables git bisect, safe reverts, and progress tracking. Users expect granular version control. | LOW | Directly inherited from GSD |
| Context engineering (scoped context per agent) | The core innovation that separates GSD from BMAD/Spec Kit. Each sub-agent gets only relevant context, not the full codebase. Prevents context rot. | MEDIUM | Inherited from GSD. Critical to preserve. |
| Verification/testing after execution | GSD has goal-backward verification. BMAD has QA agent. Spec Kit has implementation review. Self-checking is expected. | MEDIUM | GSD's "what must be TRUE" approach is strong; extend to autonomous re-verification |
| CLI-based invocation (slash commands or npx) | GSD uses `/gsd:*` commands, BMAD uses workflows, Spec Kit uses `npx spec-kit`. Users expect simple entry points. | LOW | Keep `/gsdr:*` pattern from GSD |
| Research phase before planning | GSD spawns 4 parallel research sub-agents (stack, features, architecture, pitfalls). BMAD uses analyst + architect agents. Users expect informed plans, not blind generation. | MEDIUM | Inherited from GSD. This is the current phase running right now. |
| XML-structured plan format | GSD uses XML plans with explicit tasks, verification criteria, and file references. Structured plans outperform freeform prompts for agent execution. | LOW | Inherited from GSD |
| Progress tracking / state management | Users need to know what's done, what's running, what's next. GSD tracks phase/plan/task state. Taskmaster tracks task completion. | MEDIUM | GSD has this; ensure it works for the autonomous model (user comes back to a status report) |

### Differentiators (Competitive Advantage)

Features that set GSDR apart. These are the three pillars from PROJECT.md plus supporting capabilities.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Smart complexity auto-calibration** | No competitor does this well. BMAD v6 has Scale-Adaptive Intelligence (3 tracks: Quick Flow, Standard, Full), but it's user-selected. GSD over-engineers simple tasks. GSDR should auto-detect complexity from the task description and scale planning depth accordingly: a simple script gets a lightweight plan, a full-stack app gets the full treatment. | HIGH | Core differentiator #1. Requires heuristics or LLM-based classification. Must handle edge cases (looks simple but isn't, looks complex but is routine). |
| **Front-loaded interaction model** | GSD requires human presence at discuss, plan approval, roadmap approval, and verify per phase. BMAD requires interaction at each agent handoff. Spec Kit has clarify loops. GSDR consolidates ALL interaction into 10-15 minutes upfront, then runs fully autonomously. No competitor offers true "ask everything, then walk away." | HIGH | Core differentiator #2. Requires careful question design upfront to avoid needing clarification later. The system must ask the RIGHT questions to avoid getting stuck during autonomous execution. |
| **Aggressive cross-phase parallelism** | GSD parallelizes tasks within a phase but runs phases sequentially. GSDR should build a dependency graph across ALL phases and execute everything that can safely run in parallel, even across phase boundaries. Plan Phase 3 while executing Phase 1. | HIGH | Core differentiator #3. Requires dependency graph analysis, conflict detection (file-level and semantic), and safe merge strategies for concurrent work. |
| **Autonomous self-verification with auto-fix** | GSD verifies but requires human sign-off per phase. The Ralph Loop pattern (run agent in loop until criteria met) is trending. GSDR should: verify -> if fail, auto-fix -> re-verify -> only escalate to human if auto-fix fails after N retries. Track attempted solutions to avoid loops. | HIGH | Significant differentiator. Must prevent infinite retry loops (cap at 3 attempts per failure). Must track what was already tried to force novel approaches. |
| **End-of-run summary report** | Since the user walks away, they need a comprehensive report when they return: what was built, what was verified, what (if anything) failed and was auto-fixed, what needs human attention. No competitor produces this because no competitor is fully autonomous. | MEDIUM | Natural consequence of the autonomous model. Must be clear, actionable, and honest about failures. |
| **Complexity-adaptive plan depth** | Related to auto-calibration. For simple tasks: skip research, generate a 1-plan execution, verify, done. For medium tasks: light research, 2-3 plans, verify. For complex tasks: full 4-agent research, multi-phase roadmap, full treatment. The system should have 3-4 complexity tiers, not just "one size fits all." | HIGH | Directly prevents the over-engineering problem from GSD. Must be calibrated so it doesn't under-plan complex tasks. |
| **Intelligent question consolidation** | During the front-loaded interaction phase, the system should ask questions across ALL anticipated phases at once, grouped logically. Not "Phase 1 questions... ok now Phase 2 questions..." but "Here are all my questions about your project, organized by topic." | MEDIUM | Requires the system to do preliminary analysis before questioning. May need a "preview plan" step that identifies unknowns. |
| **Failure escalation protocol** | When autonomous execution hits a problem it can't self-fix: pause that task, continue other independent work, and queue the failure for human review at the end. Don't block the entire pipeline on one failure. | MEDIUM | Critical for the autonomous model. Without this, one edge case blocks everything and the user returns to a half-finished mess. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Interactive per-phase approval gates | Feels safer; users want control at each checkpoint | Defeats the core value proposition. If users have to approve each phase, they're babysitting. GSD already does this and it's the #1 pain point. | Front-load all decisions. Autonomous self-verification replaces human gatekeeping. End-of-run report gives control without interruption. |
| Agent persona role-play (named agents like "Mary the BA") | BMAD does this; feels structured and professional | Adds cognitive overhead without improving output quality. The agent names are theater -- what matters is the prompt engineering behind them, not the persona. Creates maintenance burden for persona definitions. | Use specialized prompts without the persona wrapper. "Research agent" not "Winston the Architect." |
| Multi-runtime support (OpenCode, Gemini CLI, Codex) | Broader market reach | Abstractions for multi-runtime add complexity (GSD has this and it complicates the codebase). Claude Code's Task tool and sub-agent capabilities are the best in class. Targeting one runtime means deeper integration. | Claude Code only. Invest in deeper Claude Code integration instead of breadth. |
| Real-time streaming progress updates | Users want to watch the agent work in real time | Encourages babysitting behavior, which is the opposite of the core value. Adds complexity for websocket/streaming infrastructure. | Write progress to a log file. User can optionally tail it, but the default is "come back when it's done." |
| Enterprise agile ceremony features | Sprint planning, story points, stakeholder syncs | Scope creep into project management territory. BMAD already fills this niche with full Scrum simulation. GSDR's value is speed and autonomy, not process compliance. | Keep it lean. No story points, no sprint ceremonies. Projects have phases, phases have plans, plans have tasks. |
| User-defined complexity levels | Let users manually set "simple/medium/complex" | Users consistently misjudge complexity (either over- or under-estimating). The system should be smarter than the user about this. Also adds a decision point that could be automated. | Auto-detect complexity. Provide an override escape hatch (`--complexity high`) but default to auto. |
| Docs-as-source-of-truth philosophy | BMAD treats docs as the primary artifact, code as derivative | For GSDR's target users, working code is what matters. Heavy documentation slows autonomous execution and creates maintenance burden. Specs are means to an end, not the end. | Generate minimal specs needed to drive execution. Don't maintain living documentation as a primary goal. |
| Plugin/extension system | Let users customize the framework | Premature abstraction. Build the core well first. Plugin systems are engineering sinkholes that delay core feature delivery. | Ship opinionated defaults. Allow configuration via CLAUDE.md overrides (which Claude Code already supports). |

## Feature Dependencies

```
[Front-loaded Interaction]
    |
    +--requires--> [Intelligent Question Consolidation]
    |                  |
    |                  +--requires--> [Complexity Auto-Calibration]
    |                                     (must know complexity to know what questions to ask)
    |
    +--enables--> [Fully Autonomous Execution]
                      |
                      +--requires--> [Sub-agent Orchestration] (table stakes, from GSD)
                      |
                      +--requires--> [Autonomous Self-Verification with Auto-Fix]
                      |                  |
                      |                  +--requires--> [Verification/Testing] (table stakes, from GSD)
                      |
                      +--requires--> [Failure Escalation Protocol]
                      |
                      +--enables--> [End-of-Run Summary Report]

[Aggressive Cross-Phase Parallelism]
    |
    +--requires--> [Wave-based Parallel Execution] (table stakes, from GSD)
    |
    +--requires--> [Dependency Graph Analysis] (new capability)
    |
    +--requires--> [File-level Conflict Detection] (new capability)

[Complexity Auto-Calibration]
    |
    +--enables--> [Complexity-Adaptive Plan Depth]
    |
    +--enables--> [Intelligent Question Consolidation]

[Complexity-Adaptive Plan Depth]
    |
    +--conflicts--> [One-Size-Fits-All Planning] (GSD's current approach)
```

### Dependency Notes

- **Front-loaded Interaction requires Complexity Auto-Calibration:** The system must assess complexity before it can determine what questions to ask. A simple script needs 2 questions; a full-stack app needs 15.
- **Autonomous Execution requires Self-Verification + Failure Escalation:** Without these, the system will either halt on the first failure (bad UX) or silently produce broken output (worse UX).
- **Cross-Phase Parallelism requires Dependency Graph Analysis:** You can't safely parallelize across phases without knowing which phases depend on which. File-level conflict detection prevents two agents from editing the same file simultaneously.
- **Complexity-Adaptive Plan Depth conflicts with One-Size-Fits-All:** This is an intentional break from GSD's current approach where every project gets the full research -> roadmap -> phase treatment.

## MVP Definition

### Launch With (v1)

Minimum viable fork -- what's needed to validate the three core differentiators.

- [ ] **Complexity auto-calibration (3 tiers)** -- Core differentiator. Without this, GSDR is just GSD with fewer checkpoints. Tiers: Simple (skip research, 1 plan), Medium (light research, 2-3 plans), Complex (full GSD treatment).
- [ ] **Front-loaded interaction consolidation** -- All questions asked upfront in a single session. System does preliminary analysis to identify unknowns before questioning.
- [ ] **Autonomous execution (remove human gates)** -- Remove per-phase discuss/approve/verify gates. Execute the full plan autonomously after user approval of the initial plan.
- [ ] **Self-verification with auto-fix (up to 3 retries)** -- Extend GSD's verify phase to auto-fix failures. Track attempted solutions. Escalate only after retry exhaustion.
- [ ] **End-of-run summary report** -- Generate a clear report of what was built, verified, auto-fixed, and what needs human attention.
- [ ] **Failure escalation (continue on non-blocking failures)** -- When one task fails, continue executing independent tasks. Queue failures for end-of-run report.

### Add After Validation (v1.x)

Features to add once the core autonomous model is proven.

- [ ] **Cross-phase parallelism with dependency graph** -- Full dependency analysis across phases. Execute non-dependent phases concurrently. Trigger: v1 works but users want faster execution.
- [ ] **File-level conflict detection** -- Prevent two parallel agents from editing the same file. Required for safe cross-phase parallelism.
- [ ] **Intelligent question consolidation** -- Smarter upfront questioning that adapts based on detected complexity. Trigger: users report the system asks too many or too few questions.
- [ ] **Complexity calibration refinement (4+ tiers)** -- Add more granularity to complexity detection. Learn from execution outcomes (was this actually simple?). Trigger: auto-calibration makes wrong calls.

### Future Consideration (v2+)

- [ ] **Execution analytics / learning** -- Track how long different complexity tiers take, success rates, common failure patterns. Use to improve calibration.
- [ ] **Custom complexity profiles** -- Let teams define what "simple" and "complex" mean for their codebase.
- [ ] **Background execution mode** -- Integration with Claude Code's background agent feature for true fire-and-forget.
- [ ] **Multi-project orchestration** -- Run GSDR across multiple related repos simultaneously.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Complexity auto-calibration (3 tiers) | HIGH | MEDIUM | P1 |
| Front-loaded interaction | HIGH | MEDIUM | P1 |
| Autonomous execution (remove gates) | HIGH | LOW | P1 |
| Self-verification + auto-fix | HIGH | HIGH | P1 |
| End-of-run summary report | HIGH | LOW | P1 |
| Failure escalation protocol | HIGH | MEDIUM | P1 |
| Cross-phase parallelism | MEDIUM | HIGH | P2 |
| File-level conflict detection | MEDIUM | HIGH | P2 |
| Intelligent question consolidation | MEDIUM | MEDIUM | P2 |
| Complexity calibration refinement | LOW | MEDIUM | P3 |
| Execution analytics | LOW | HIGH | P3 |
| Background execution mode | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- validates the core differentiators
- P2: Should have -- enables full vision of aggressive parallelism and smarter interaction
- P3: Nice to have -- optimization and learning features for maturity

## Competitor Feature Analysis

| Feature | GSD | BMAD | Spec Kit | Taskmaster | GSDR Approach |
|---------|-----|------|----------|------------|---------------|
| **Complexity calibration** | None (full treatment always) | v6 has 3 tracks (user-selected) | None | Complexity field per task (manual) | Auto-detect, 3 tiers, no user input needed |
| **Human interaction model** | Per-phase: discuss, approve plan, approve roadmap, verify | Per-agent handoff (sequential) | Clarify loop (interactive) | Manual task management | All upfront in 10-15 min, then autonomous |
| **Parallelism** | Within-phase wave execution | Sequential agent pipeline | Sequential phases | Dependency-aware sequencing | Cross-phase parallelism with dependency graph |
| **Self-verification** | Goal-backward verify (human sign-off) | QA agent persona | Implementation review | Task completion tracking | Auto-verify + auto-fix + retry (3x) |
| **Context management** | Fresh 200K window per sub-agent | Single context (causes rot) | Layered context (constitution + spec) | MCP-based context injection | Inherit GSD's fresh context approach |
| **Plan structure** | XML, max 3 tasks per plan | YAML workflows, full agile artifacts | Constitution + spec + plan docs | JSON task trees with dependencies | XML (from GSD), complexity-adaptive depth |
| **Failure handling** | Stops for human review | Manual intervention | Manual intervention | Retry with solution tracking | Auto-fix, escalate after 3 retries, continue independent tasks |
| **Post-execution report** | Per-phase verification prompt | None (inline review) | PR-based review | Task list status | Comprehensive end-of-run summary |

## Sources

### Competitors Analyzed
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) -- Primary fork source. Fresh context model, wave execution, atomic commits.
- [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) -- Agent personas, YAML workflows, Scale-Adaptive Intelligence in v6.
- [GitHub Spec Kit](https://github.com/github/spec-kit) -- Constitution-based spec-driven development, 4-phase workflow.
- [Taskmaster AI](https://github.com/eyaltoledano/claude-task-master) -- MCP-based task management, dependency tracking, complexity fields.

### Patterns and Ecosystem
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) -- Official orchestration primitives.
- [Ralph Loop Pattern](https://github.com/snarktank/ralph) -- Autonomous retry loop until completion criteria met.
- [Addy Osmani - LLM Coding Workflow](https://addyosmani.com/blog/ai-coding-workflow/) -- Right-sizing tasks, preventing over-engineering.
- [Martin Fowler - Pushing AI Autonomy](https://martinfowler.com/articles/pushing-ai-autonomy.html) -- Autonomy boundaries and practical limits.
- [BMAD v6 Scale-Adaptive Intelligence](https://medium.com/@hieutrantrung.it/from-token-hell-to-90-savings-how-bmad-v6-revolutionized-ai-assisted-development-09c175013085) -- Complexity-tiered workflows.
- [Claude Code Sub-Agent Best Practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) -- Parallel vs sequential agent patterns.
- [Spec-Driven Development Comparison (Martin Fowler)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) -- Kiro, Spec Kit, Tessl compared.

---
*Feature research for: AI coding assistant meta-prompting / spec-driven development orchestration*
*Researched: 2026-03-14*
