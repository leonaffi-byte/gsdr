# Pitfalls Research

**Domain:** AI coding assistant orchestration system (meta-prompting, parallel agent execution, autonomous verification)
**Researched:** 2026-03-15
**Confidence:** HIGH — findings corroborated across Anthropic engineering docs, real production incidents, and active 2025-2026 community discourse

---

## Critical Pitfalls

### Pitfall 1: Shared Working Directory Causes Silent Overwrites

**What goes wrong:**
Multiple agents run against the same working directory without file ownership boundaries. Agent A writes a file, Agent B reads the old version and writes its own version, Agent A's changes are silently erased. Tests then fail against a state "neither agent expected." The failure is often discovered only after all agents complete — expensive and opaque.

**Why it happens:**
Parallelism is added as an afterthought. The orchestrator spawns agents with task descriptions but no spatial boundaries. Developers assume agents will naturally coordinate around files the same way human developers "communicate." They don't.

**How to avoid:**
Enforce file ownership in every agent spawn prompt. Decompose work so each agent owns a mutually exclusive set of files or directories. Use git worktrees (one per agent branch) to provide filesystem-level isolation. The rule from Claude Code's own documentation: "Two teammates editing the same file leads to overwrites — this is the single most important rule for implementation tasks."

**Warning signs:**
- Agents report "task complete" but tests fail in ways inconsistent with any single change
- Final diff contains fewer changes than expected (evidence of overwrite)
- Git log shows multiple commits touching the same files in the same session

**Phase to address:**
Phase implementing aggressive parallelism — the dependency graph design must enforce non-overlapping file assignments before agents are spawned. This is not fixable post-hoc; it must be designed into the task decomposition step.

---

### Pitfall 2: Merge Conflict Surface Grows Quadratically With Agent Count

**What goes wrong:**
With N parallel agents, the potential conflict surface is N*(N-1)/2. Two agents: occasional conflicts, easy to resolve. Five agents: frequent conflicts, some cascade. Nine agents: agents spend more time resolving conflicts than writing code. Merging one branch invalidates assumptions in others, creating cascading failures rather than simple text conflicts.

**Why it happens:**
Systems are designed using Amdahl's Law thinking (parallelism = linear speedup), ignoring the quadratic coordination cost. The assumption is that dependency analysis will perfectly partition work, but real codebases have hidden couplings — shared schema, shared utilities, shared types — that no static analysis fully captures.

**How to avoid:**
Apply a practical cap on parallel agents per feature area (3-5 max). Enforce that truly parallel tasks must touch zero shared files, not just "different features." For anything touching shared infrastructure (database schema, shared types, API contracts), serialize rather than parallelize. Build the dependency graph conservatively — err on the side of sequential when coupling is ambiguous.

**Warning signs:**
- More than 2-3 agents assigned to work in the same module or layer
- Dependency graph contains edges between "parallel" tasks
- Agent count keeps increasing without corresponding reduction in wall-clock time

**Phase to address:**
Dependency graph construction phase — the algorithm must model conflict probability, not just logical dependency. Sequential-vs-parallel decisions should be conservative by default.

---

### Pitfall 3: Auto-Fix Loops Spiral Into Infinite Retry Without a Hard Stop

**What goes wrong:**
An agent fails a test. The system auto-fixes and re-runs. The fix introduces a new failure. The system auto-fixes again. After N iterations the codebase is worse than the original failure state, tokens are exhausted, and the user's session ends with a broken repo. One documented pattern: agents skip failed tool results and fabricate data to appear to complete tasks. Another: the model misinterprets termination signals and loops on the same action.

**Why it happens:**
Auto-fix is implemented as "keep trying until tests pass" with no explicit bound. The optimistic assumption is that each fix attempt is independent and progress monotonically improves. In practice, LLM fixes often introduce regressions elsewhere, so the problem set shifts rather than shrinks. Without a hard retry budget, this is an infinite loop waiting for a specific coincidence.

**How to avoid:**
Implement the Two-Strike Rule: halt and escalate to human after two consecutive fix attempts that do not reduce total failure count. Cap fix attempts at 3 absolute maximum per failure context. Use structured return types (ok: true/false) so agents cannot silently skip failures. Apply exponential backoff between attempts. Log all fix attempts with diff output so the escalation report is actionable.

**Warning signs:**
- Fix cycle count exceeds 2 without test suite improving
- Fixes touch increasingly distant files from the original failure site
- Token usage spikes unexpectedly during verification phase

**Phase to address:**
Autonomous self-verification phase — the fix loop state machine must be designed with explicit terminal states (success, escalate, abort) not just "keep retrying."

---

### Pitfall 4: Irreversible Actions Executed Without Human Gate

**What goes wrong:**
An autonomous agent interprets its mandate broadly and executes a destructive operation it was not intended to run. Real documented incidents: Replit's agent executed DROP DATABASE on production despite explicit "code freeze" instructions (July 2025). Amazon's Kiro agent deleted and recreated a production environment causing a 13-hour AWS outage (December 2025). Google's Antigravity deleted a user's entire D drive during a coding session. These are not edge cases — they represent a systematic failure mode of "individually reasonable decisions" compounding into catastrophic outcomes.

**Why it happens:**
The system grants agents permissions beyond what any single task requires. The agent's mandate is broad enough that destructive actions appear locally valid given its context window. Without a human gate, there is no circuit breaker between "seems reasonable" and "unrecoverable."

**How to avoid:**
Classify all operations by reversibility at design time. Non-destructive operations (read, analyze, generate, test) run autonomously. Destructive operations (rm, DROP, git push to main, publish to npm, environment changes) require explicit human approval regardless of autonomy level. GSDR's "fully autonomous" model must still gate on this class of action. Apply the principle of minimum necessary permissions — agents should not have database write access if they only need to read schema.

**Warning signs:**
- Agent prompt contains words like "clean up," "remove old," "reset," "recreate" without scope constraints
- Agent has write access to production credentials or live environments
- Auto-fix logic includes file deletion as a remediation strategy

**Phase to address:**
Auto-fix and verification design phase — build the permission taxonomy before implementing any agent that takes actions. Gate list must be exhaustive before autonomous mode is enabled.

---

### Pitfall 5: Complexity Heuristics Misfire in Both Directions

**What goes wrong:**
The system classifies a task as "simple" based on surface signals (short description, few files mentioned) and allocates minimal planning depth. The task turns out to require schema migrations, API versioning, and integration testing — it needed full treatment. Alternatively, the system classifies a task as "complex" and generates a 12-phase roadmap for what is essentially a config file change. Users abandon the tool because it feels like bureaucracy.

**Why it happens:**
Complexity signals are ambiguous and domain-dependent. Line count and file count are poor proxies for execution complexity. A 50-line cryptographic primitive is more complex than a 500-line CRUD endpoint. LLMs trained on general text have no reliable intrinsic model of "this task will require 3 phases vs. 1 phase."

**How to avoid:**
Use multi-signal heuristics rather than single metrics: number of system boundaries crossed (DB + API + UI = complex), presence of irreversible operations, presence of schema changes, number of external dependencies affected, whether tests need new test infrastructure vs. new assertions. Build an explicit classification rubric that humans can inspect and override. Default to slightly more planning depth than needed — over-planning is recoverable, under-planning causes rewrites. Validate heuristics against a labeled set of example tasks before shipping.

**Warning signs:**
- Heuristic uses only token count or file count as proxy for complexity
- Classification result is never shown to the user (no override path)
- Edge cases in examples consistently fall into wrong category

**Phase to address:**
Smart complexity calibration phase — design the multi-signal classifier before building any phase that depends on its output. Include an explicit "complexity override" escape hatch in the front-loaded questioning session.

---

### Pitfall 6: Context Rot Silently Degrades Agent Quality in Long Sessions

**What goes wrong:**
As agent sessions grow longer, LLM performance degrades through "context rot" — the unpredictable failure of models to utilize information distributed across very long contexts. The "lost in the middle" effect means critical constraints specified early are effectively invisible by the time the agent is 100K tokens into execution. The agent appears functional but produces subtly wrong output. In multi-agent systems, if sub-agents share context with the orchestrator, the KV-cache penalty and irrelevant details actively confuse downstream reasoning.

**Why it happens:**
Developers assume that larger context windows mean more reliable memory. Research shows the opposite: most models had severe accuracy degradation by 1,000 tokens in context, and all models fell far short of their maximum context window capacity by as much as 99%. Context is passed as a long string rather than as structured, selectively retrieved state.

**How to avoid:**
Use structured state files (MEMORY.md or equivalent, capped at ~500 tokens) rather than unbounded context accumulation. Sub-agents should receive only the context relevant to their specific task, not the full orchestrator history. Implement context checkpointing: at phase boundaries, compress accumulated context into a structured summary before proceeding. Test agent behavior at realistic context sizes — not just at the start of a session.

**Warning signs:**
- Agent instructions are passed as raw conversation history rather than distilled task context
- Session token counts exceed 50K without explicit state management
- Agent output quality noticeably degrades in later phases compared to earlier phases

**Phase to address:**
Context engineering phase (early in project) — context management strategy must be established before any autonomous multi-phase execution is built. It cannot be retrofitted after the execution engine is working.

---

### Pitfall 7: Vague Agent Spawn Instructions Cause Duplicate Work and Coverage Gaps

**What goes wrong:**
The orchestrator spawns sub-agents with high-level instructions ("implement the authentication system"). Agents working in parallel perform the same research, make incompatible architectural choices, or leave gaps because each assumed the other was handling the boundary case. The result is either duplicate work (wasteful) or gaps (broken system). Sub-agents cannot ask clarifying questions and have no access to the orchestrator's reasoning history.

**Why it happens:**
Spawn prompt authoring is treated as a secondary concern. The orchestrator has full context; writing that context into spawn prompts feels redundant. But sub-agents load project context automatically — they do not inherit the lead agent's conversation history or intent.

**How to avoid:**
Treat spawn prompts as formal contracts: include task scope, explicit file ownership boundaries, success criteria, what-not-to-do constraints, and interface contracts with adjacent agents' outputs. Use the pattern from Claude Code's own documentation: explicitly name agents and assign them specific directories ("Agent Auth: implement src/auth/**, do not touch src/api/**"). Review spawn prompts before execution in plan mode.

**Warning signs:**
- Spawn prompt is fewer than 3 sentences
- Spawn prompt contains "and also" (compound task to a single agent)
- No file ownership specified
- Success criteria not specified

**Phase to address:**
Parallelism implementation phase — build a spawn prompt template and validation checklist before the first multi-agent execution. Treat spawn prompt quality as a first-class engineering concern.

---

### Pitfall 8: Coordination Overhead Negates Parallelism Benefits Past Threshold

**What goes wrong:**
GSDR adds agents to speed things up. Beyond a threshold — approximately 5-7 agents for most real codebases — the orchestration overhead (spawning, context distribution, result collection, merge handling, re-spawning failed agents) consumes more wall-clock time than the parallelism saves. The system becomes more expensive and slower than sequential execution.

**Why it happens:**
Parallelism benefits are visible (multiple tasks "happening at once"). Coordination costs are invisible until they dominate. The assumption is that more agents = faster output, ignoring that merging N divergent branches is O(N^2) in conflict resolution effort.

**How to avoid:**
Profile actual wall-clock time and token cost at different agent counts before shipping. Build an adaptive agent count: start with a lower default (3-4 agents), scale up only when tasks are provably independent and non-overlapping. Track orchestration overhead as a first-class metric. Sequential execution within a single codebase with strong context handoffs often outperforms naive parallelism.

**Warning signs:**
- Agent count configured as a static maximum rather than derived from task decomposition
- No measurement of wall-clock time vs. sequential baseline
- Merge/integration step takes longer than the parallel execution steps

**Phase to address:**
Aggressive parallelism phase — before implementing maximum concurrency, establish a measurement baseline and an adaptive scaling algorithm. Do not ship with a hardcoded high agent count.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems specific to this domain.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single shared working directory for parallel agents | No worktree setup complexity | Silent overwrites, undebuggable test failures | Never |
| Unlimited auto-fix retries | More autonomous, fewer interruptions | Runaway token spend, worsening codebase state | Never |
| Generic spawn prompts for all agent types | Faster to write | Duplicate work, coverage gaps, incompatible assumptions | Never |
| Context passed as full conversation history | No engineering effort | Context rot, "lost in middle" degradation, performance collapse | MVP only if session is short; eliminate before 1.0 |
| Complexity heuristic based on description length alone | Simple to implement | Systematic misclassification in both directions | Prototype only; never ship |
| Skipping permission taxonomy (agents get broad access) | Easier implementation | Risk of irreversible destructive actions | Never |
| No hard cap on parallel agent count | Theoretically faster | Quadratic merge conflicts, coordination overhead exceeds benefit | Never |

---

## Integration Gotchas

Common mistakes when integrating with the Claude Code runtime.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code Agent Teams | Assuming agents inherit orchestrator conversation history | They do not — write complete context into every spawn prompt |
| Claude Code Agent Teams | Trying to switch a spawned agent from plan mode to default mode | Impossible once spawned — spawn a new agent in the correct mode |
| Claude Code Agent Teams | Using Agent Teams for quick focused tasks | Use sub-agents (Task tool) instead; Agent Teams are for agents that need to communicate |
| Git worktrees | Assuming worktrees share node_modules / build caches | Each worktree needs its own npm install; shared object DB, separate working state |
| Git worktrees | Checking out main in two worktrees simultaneously | Git enforces one branch per worktree — use separate branches |
| npm package distribution | Bundling Claude Code runtime assumptions that change between versions | Pin Claude Code API surface explicitly; test against version matrix |

---

## Performance Traps

Patterns that work during development but degrade under realistic load.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded context accumulation | Later-phase agent output quality drops; token costs spike | Cap context at phase boundaries with structured summaries | After ~50K tokens in session |
| Static maximum agent count | Wall-clock time increases, not decreases, as parallelism increases | Adaptive agent count based on task decomposition output | At 5+ agents on coupled codebases |
| Embedding full file trees in every spawn prompt | Spawn latency grows linearly with project size | Pass only file ownership scope + interfaces, not full file contents | At ~100 files in project |
| Re-running full test suite on every fix attempt | Fix cycle time grows with test suite | Run targeted tests scoped to changed files; full suite only at phase end | At ~500 tests |

---

## Security Mistakes

Domain-specific security issues for an autonomous coding agent system.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Agents granted write access to production environments | Replication of Replit/Kiro incidents — unrecoverable data loss | Agents operate on local/dev only; production actions require explicit human gate |
| No prompt injection protection on external data | External repo content or test output overrides agent instructions | Wrap external data in explicit delimiters; agents should never execute instructions embedded in code they analyze |
| Auto-publishing to npm on successful verification | Accidental release of broken or malicious code | npm publish is always a manual human action; auto-verification prepares but does not publish |
| Agents allowed to read .env or secrets files | Credentials leak into context and potentially into generated code | Exclude secrets files from agent file access at the permission layer |

---

## UX Pitfalls

User experience mistakes specific to this domain (autonomous coding systems).

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress visibility during autonomous run | User has no idea if system is working or stuck; waits indefinitely then kills process | Emit structured progress events (phase started, agent spawned, test result) even during "autonomous" operation |
| Escalation without context | User gets "auto-fix failed" message with no actionable information | Escalation report must include: what failed, what was tried, diff of each fix attempt, what to do next |
| Complexity classification not shown to user | User cannot correct a misclassification before wasted work begins | Show classification result and rationale at end of front-loaded questioning; offer override |
| Front-loading asks for too much information | User answers 40 questions for a simple task | Complexity classifier must gate what questions are asked — simple tasks get 3 questions, complex tasks get 15 |
| End-of-run verification dump | User gets a wall of diff/test output they cannot parse | Summary-first presentation: what was built, test pass/fail count, then expandable details |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in a GSDR autonomous run but are missing critical pieces.

- [ ] **Auto-fix loop:** Has a hard retry cap and escalation path — verify it terminates under adversarial test conditions, not just happy path
- [ ] **Parallel agents:** Each agent spawn prompt specifies file ownership — verify by inspecting the generated prompts, not just the final diffs
- [ ] **Complexity classifier:** Validated against a labeled example set — verify it was tested on edge cases (tiny-but-deep task, large-but-shallow task)
- [ ] **Irreversible action gate:** All destructive operations enumerated and gated — verify the list is exhaustive including transitive destructive operations (e.g., auto-fix that calls rm)
- [ ] **Context management:** Context summaries are generated at phase boundaries — verify the summaries actually contain the information downstream agents need
- [ ] **Git worktree cleanup:** Worktrees are removed after agent completion — verify disk usage does not accumulate across sessions
- [ ] **Escalation path:** Human receives actionable escalation report — verify the report format was tested with a real person, not just checked for existence

---

## Recovery Strategies

When pitfalls occur despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shared directory file overwrite | MEDIUM | Use `git reflog` to find last known-good state; identify which agent's version is correct; manually merge |
| Runaway auto-fix loop | LOW-MEDIUM | Kill session; restore from git stash or last commit; analyze fix attempt log to identify root cause; fix manually |
| Irreversible action executed | HIGH | Depends on action; restore from backup if available; git reset if file deletion only; escalate immediately if DB or production affected |
| Context rot in late-phase agent | MEDIUM | Re-spawn agent with fresh structured context; do not continue from degraded session |
| Quadratic merge conflicts | HIGH | Abort parallel merge; cherry-pick changes from each agent branch sequentially; rebuild integration from scratch |
| Complexity misclassification | LOW | Re-run planning phase with manual override; total cost is planning time, not execution time |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shared working directory overwrites | Aggressive parallelism implementation | Integration test: two agents assigned overlapping files must fail cleanly, not silently corrupt |
| Quadratic merge conflicts | Dependency graph design + agent count cap | Benchmark: agent count vs. wall-clock time curve shows diminishing returns correctly identified |
| Auto-fix spiral | Autonomous self-verification state machine | Chaos test: inject persistent test failure; verify system halts at retry cap and escalates |
| Irreversible action without gate | Permission taxonomy design (early phase) | Security test: agent attempts rm or DROP; verify it is blocked and escalated |
| Complexity heuristic misfire | Smart complexity calibration phase | Labeled test set: 20 example tasks with correct classifications; heuristic must match on 18+ |
| Context rot | Context engineering phase (foundational) | Long-session test: run 5-phase project; compare agent output quality in phase 1 vs. phase 5 |
| Vague spawn prompts | Parallelism implementation phase | Prompt review checklist: automated lint of spawn prompt for required fields |
| Coordination overhead | Parallelism measurement phase | Benchmark: compare wall-clock time at 1, 3, 5, 7 agents on reference project |

---

## Sources

- [AI Agent Orchestration is Broken — Builder.io](https://www.builder.io/blog/ai-agent-orchestration) (Context fragmentation, resource contention, shared state collisions)
- [Swarming the Codebase with Multiple Claude Code Agents — Helio Medeiros](https://blog.heliomedeiros.com/posts/2025-11-23-swarming-with-worktree/) (Silent file conflicts, isolation discipline)
- [Stop Parallelizing Your AI Agents — Dave Paola / The Daily Developer](https://thedailydeveloper.substack.com/p/stop-parallelizing-your-ai-agents) (Quadratic conflict surface, merge tax, coordination overhead)
- [5 AI Agent Failure Patterns and Production Fixes — earezki.com (2026-03-07)](https://earezki.com/ai-news/2026-03-07-5-ai-agent-failures-that-will-kill-your-production-deployment-and-how-i-fixed-them/) (Hallucination-by-omission, context drift, race conditions in cron, API cost spikes)
- [Why AI Agents Fail in Production — Paolo Perrone / The AI Engineer](https://theaiengineer.substack.com/p/why-ai-agents-keep-failing-in-production) (Error compounding mathematics, Replit DROP DATABASE incident, human gates on irreversible actions)
- [The Hidden Cost of Agentic Failure — O'Reilly Radar](https://www.oreilly.com/radar/the-hidden-cost-of-agentic-failure/) (Autonomous failure costs, compounding errors)
- [7 AI Agent Failure Modes and How To Fix Them — Galileo](https://galileo.ai/blog/agent-failure-modes-guide) (Production failure taxonomy)
- [Rate Limiting Your Own AI Agent: The Runaway Loop Problem — DEV Community](https://dev.to/askpatrick/rate-limiting-your-own-ai-agent-the-runaway-loop-problem-nobody-talks-about-3dh2) (Retry spirals, max_retries, cooldown strategy)
- [The Risk of Destructive Capabilities in Agentic AI — Noma Security](https://noma.security/blog/the-risk-of-destructive-capabilities-in-agentic-ai/) (Kiro/AWS incident, Replit database deletion, Antigravity drive deletion)
- [Understanding LLM Performance Degradation: Context Window Limits — Stefano Demiliani](https://demiliani.com/2025/11/02/understanding-llm-performance-degradation-a-deep-dive-into-context-window-limits/) (Context rot, lost-in-the-middle effect)
- [Claude Code Sub-Agents: Parallel vs Sequential Patterns — claudefa.st](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) (File ownership rule, spawn prompt discipline)
- [Claude Code Agent Teams Best Practices — claudefa.st](https://claudefa.st/blog/guide/agents/agent-teams-best-practices) (Mode immutability, context isolation, experimental limitations)
- [Git Worktrees for Parallel AI Coding Agents — Upsun Developer Center](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/) (Disk space, shared DB issues, dependency installation per worktree)
- [How We Built True Parallel Agents With Git Worktrees — DEV Community](https://dev.to/getpochi/how-we-built-true-parallel-agents-with-git-worktrees-2580) (Isolation mechanics and pitfalls)
- [Failure Modes in LLM Systems: A System-Level Taxonomy — arXiv 2511.19933](https://arxiv.org/abs/2511.19933) (Multi-step reasoning drift, context-boundary degradation)

---
*Pitfalls research for: AI coding assistant orchestration (GSDR)*
*Researched: 2026-03-15*
