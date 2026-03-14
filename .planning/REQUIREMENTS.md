# Requirements: GSDR (GSD Reloaded)

**Defined:** 2026-03-15
**Core Value:** After initial questioning, the system runs completely autonomously from planning through execution to verification — no human babysitting required.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Fork GSD codebase and strip multi-runtime support (keep Claude Code only)
- [ ] **FOUND-02**: Port GSD tooling to TypeScript with esbuild bundling to CJS
- [ ] **FOUND-03**: Adopt Claude Code Plugin format (skills/ + agents/ structure)
- [ ] **FOUND-04**: Preserve context engineering: fresh 200K token context per sub-agent
- [ ] **FOUND-05**: Preserve XML-structured plan format for agent execution
- [ ] **FOUND-06**: Preserve atomic commits per task with clean git history
- [ ] **FOUND-07**: Preserve state management (STATE.md) across sessions
- [ ] **FOUND-08**: Distribute as npm package (npx gsdr@latest)

### Complexity Calibration

- [ ] **CMPLX-01**: Auto-detect task complexity into 3 tiers (Simple/Medium/Complex) from task description without user input
- [ ] **CMPLX-02**: Adaptive plan depth: Simple tasks get 1 lightweight plan, Medium get 2-3 plans, Complex get full treatment
- [ ] **CMPLX-03**: Adaptive research: Skip research for Simple tasks, light research for Medium, full 4-agent research for Complex
- [ ] **CMPLX-04**: Provide complexity override escape hatch (--complexity flag) but default to auto-detect

### Autonomous Execution

- [ ] **AUTO-01**: Front-loaded interaction: all user questions asked upfront in a single 10-15 minute session
- [ ] **AUTO-02**: System does preliminary analysis to identify unknowns before questioning
- [ ] **AUTO-03**: Remove per-phase human gates (no discuss/approve/verify stops during execution)
- [ ] **AUTO-04**: Autonomous self-verification after each phase completion
- [ ] **AUTO-05**: Auto-fix failures with up to 3 retry attempts per failure, tracking attempted solutions
- [ ] **AUTO-06**: Two-strike halt rule: stop auto-fix after 2 consecutive non-improving attempts
- [ ] **AUTO-07**: Failure escalation: continue executing independent tasks when one fails, queue failures for end report
- [ ] **AUTO-08**: End-of-run summary report: what was built, verified, auto-fixed, and what needs human attention
- [ ] **AUTO-09**: Irreversible action gate: maintain explicit list of actions that always require human confirmation (database drops, force pushes, etc.)

### Parallelism

- [ ] **PARA-01**: Cross-phase dependency graph: analyze ROADMAP.md to determine which phases can run concurrently
- [ ] **PARA-02**: File-level conflict detection: prevent two parallel agents from editing the same file
- [ ] **PARA-03**: Preserve within-phase wave execution from GSD (independent plans run in parallel)
- [ ] **PARA-04**: Plan all phases in parallel where possible (not just execute)
- [ ] **PARA-05**: Respect Claude Code agent spawn limits (~5-10 concurrent agents)
- [ ] **PARA-06**: File ownership contracts in every agent spawn prompt (explicit files_modified declarations)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Complexity Refinement

- **CMPLX-05**: Expand to 4+ complexity tiers with finer granularity
- **CMPLX-06**: Learn from execution outcomes (was the complexity assessment correct?)
- **CMPLX-07**: Custom complexity profiles per team/codebase

### Intelligence

- **INTL-01**: Intelligent question consolidation that adapts question depth based on detected complexity
- **INTL-02**: Execution analytics: track timing, success rates, common failure patterns
- **INTL-03**: Background execution mode via Claude Code's background agent feature

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-runtime support (OpenCode, Gemini, Codex) | Adds complexity for abstraction layers; Claude Code has best sub-agent capabilities |
| Agent persona role-play (named agents) | Theater without quality improvement; adds maintenance burden |
| Enterprise agile ceremonies (sprint planning, story points) | Scope creep into PM territory; GSDR's value is speed and autonomy |
| Real-time streaming progress updates | Encourages babysitting behavior, opposite of core value |
| Plugin/extension system | Premature abstraction; ship opinionated defaults first |
| Docs-as-source-of-truth philosophy | Working code matters; heavy docs slow autonomous execution |
| User-defined complexity levels as primary input | Users misjudge complexity; system should auto-detect (override available via flag) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | TBD | Pending |
| FOUND-02 | TBD | Pending |
| FOUND-03 | TBD | Pending |
| FOUND-04 | TBD | Pending |
| FOUND-05 | TBD | Pending |
| FOUND-06 | TBD | Pending |
| FOUND-07 | TBD | Pending |
| FOUND-08 | TBD | Pending |
| CMPLX-01 | TBD | Pending |
| CMPLX-02 | TBD | Pending |
| CMPLX-03 | TBD | Pending |
| CMPLX-04 | TBD | Pending |
| AUTO-01 | TBD | Pending |
| AUTO-02 | TBD | Pending |
| AUTO-03 | TBD | Pending |
| AUTO-04 | TBD | Pending |
| AUTO-05 | TBD | Pending |
| AUTO-06 | TBD | Pending |
| AUTO-07 | TBD | Pending |
| AUTO-08 | TBD | Pending |
| AUTO-09 | TBD | Pending |
| PARA-01 | TBD | Pending |
| PARA-02 | TBD | Pending |
| PARA-03 | TBD | Pending |
| PARA-04 | TBD | Pending |
| PARA-05 | TBD | Pending |
| PARA-06 | TBD | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 0
- Unmapped: 27 ⚠️

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after initial definition*
