# Roadmap: GSDR (GSD Reloaded)

## Overview

GSDR transforms GSD from a human-supervised build system into a fully autonomous one. The journey starts with forking and modernizing the codebase (Foundation), then builds the intelligence layer that right-sizes planning effort (Complexity Calibration), consolidates all human interaction into one upfront session (Front-Loaded Interaction), enables parallel execution across phase boundaries (Dependency Graph Engine), and culminates in the autonomous execution loop that ties everything together (Autonomous Execution). After Foundation, phases 2-4 are partially parallelizable; Phase 5 depends on both phases 3 and 4.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Fork GSD, port to TypeScript, adopt Claude Code Plugin format, preserve proven patterns
- [ ] **Phase 2: Complexity Calibration** - Auto-detect task complexity and scale planning depth accordingly
- [ ] **Phase 3: Front-Loaded Interaction** - Consolidate all human interaction into one upfront session, remove per-phase gates
- [ ] **Phase 4: Dependency Graph Engine** - Build DAG scheduler for cross-phase parallelism with file-conflict detection
- [ ] **Phase 5: Autonomous Execution** - Self-verification, auto-fix loops, failure escalation, and end-of-run reporting

## Phase Details

### Phase 1: Foundation
**Goal**: A working GSDR npm package that installs as a Claude Code plugin, with all proven GSD patterns preserved and multi-runtime cruft removed
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08
**Success Criteria** (what must be TRUE):
  1. Running `npx gsdr@latest` installs the package and registers Claude Code plugin skills and agents
  2. Sub-agents spawn with fresh 200K token context and receive only path-based references (not file contents)
  3. Executing a plan produces atomic git commits with clean history (one commit per task)
  4. STATE.md persists across sessions and correctly tracks phase/plan position
  5. XML-structured plan format is parsed and executed by agent workflows
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md -- Scaffold project structure and port foundational TypeScript modules
- [ ] 01-02-PLAN.md -- Port remaining lib modules, CLI router, and build CJS bundle
- [ ] 01-03-PLAN.md -- Port GSD commands to plugin skills and agents with markdown assets
- [ ] 01-04-PLAN.md -- npm install script and validation test suite

### Phase 2: Complexity Calibration
**Goal**: The system automatically detects task complexity and scales planning depth, research inclusion, and verification rigor without user input
**Depends on**: Phase 1
**Requirements**: CMPLX-01, CMPLX-02, CMPLX-03, CMPLX-04
**Success Criteria** (what must be TRUE):
  1. Given a task description, the system classifies it into Simple/Medium/Complex without user input and displays the classification with rationale
  2. Simple tasks produce 1 lightweight plan with no research phase; Complex tasks produce full multi-plan treatment with 4-agent research
  3. User can override auto-detected complexity via --complexity flag and the system respects the override
  4. Classification matches expected tier on 18+ of 20 labeled test cases
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Front-Loaded Interaction
**Goal**: Users invest 10-15 minutes answering questions upfront, then the system runs without any human interaction until completion
**Depends on**: Phase 1, Phase 2
**Requirements**: AUTO-01, AUTO-02, AUTO-03
**Success Criteria** (what must be TRUE):
  1. All user questions are asked in a single upfront session (no mid-execution prompts for information)
  2. The system performs preliminary analysis to identify unknowns before asking questions (questions are informed, not generic)
  3. No per-phase discuss, approve, or verify gates interrupt execution after the upfront session ends
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Dependency Graph Engine
**Goal**: The system builds a dependency graph from roadmap and plan metadata, detects file conflicts, and computes parallel-safe execution batches
**Depends on**: Phase 1
**Requirements**: PARA-01, PARA-02, PARA-03, PARA-04, PARA-05, PARA-06
**Success Criteria** (what must be TRUE):
  1. Given a ROADMAP.md with Depends on fields, the system produces a dependency-graph.json DAG identifying which phases can run concurrently
  2. Two agents that declare overlapping files_modified are never scheduled in the same parallel batch
  3. Within a phase, independent plans execute in parallel waves (preserved from GSD)
  4. Planning for multiple phases runs concurrently when their dependencies are satisfied
  5. Concurrent agent count stays within Claude Code limits (3-5 per feature area, no more than 10 total)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Autonomous Execution
**Goal**: The system executes the full build autonomously -- verifying, auto-fixing, escalating failures, and producing a comprehensive end-of-run report
**Depends on**: Phase 3, Phase 4
**Requirements**: AUTO-04, AUTO-05, AUTO-06, AUTO-07, AUTO-08, AUTO-09
**Success Criteria** (what must be TRUE):
  1. After each phase completes, the system automatically runs verification and reports pass/fail without human prompting
  2. When verification fails, the system attempts up to 3 auto-fix retries; after 2 consecutive non-improving attempts it halts that fix path
  3. When one task fails, independent tasks continue executing; failed tasks are queued for the end-of-run report
  4. At completion, the system produces a summary report showing what was built, what was verified, what was auto-fixed, and what needs human attention
  5. Irreversible actions (database drops, force pushes, npm publish) always prompt for human confirmation regardless of autonomy mode
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3/4 (parallelizable) -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/4 | Not started | - |
| 2. Complexity Calibration | 0/2 | Not started | - |
| 3. Front-Loaded Interaction | 0/2 | Not started | - |
| 4. Dependency Graph Engine | 0/3 | Not started | - |
| 5. Autonomous Execution | 0/3 | Not started | - |
