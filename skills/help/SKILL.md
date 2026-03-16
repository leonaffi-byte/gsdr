---
name: help
description: "Show GSDR command reference"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

<purpose>
Display the complete GSDR command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<reference>
```
▄▄ ▄▄▄ ▄▄▄ ▄▄▄
█▌ ▀▄▄ █▄▀ █▄▀
▀▀ ▄▄▀ ▀ ▀ ▀ ▀
```
(@references/ui-brand.md Section 12 — Logo Compact)

Autonomous build system with chaotic good energy.
Plans it, builds it, ships it — no hand-holding required.
We automate ruthlessly and celebrate loudly.

---

# GSDR Command Reference

## Quick Start

1. `/gsdr:new-project` — From zero to roadmap in one conversation
2. `/gsdr:plan-phase 1` — Turn vibes into actionable plans
3. `/gsdr:execute-phase 1` — Unleash the plan on your codebase

## Staying Updated

GSDR evolves fast. Update periodically:

```bash
npx gsdr@latest
```

## Core Workflow

```
/gsdr:new-project -> /gsdr:plan-phase -> /gsdr:execute-phase -> repeat
```

### Project Initialization

**`/gsdr:new-project`**
From zero to roadmap in one conversation.

One command takes you from idea to ready-for-planning:
- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown and success criteria

Creates all `.planning/` artifacts:
- `PROJECT.md` — vision and requirements
- `config.json` — workflow mode (interactive/yolo)
- `research/` — domain research (if selected)
- `REQUIREMENTS.md` — scoped requirements with REQ-IDs
- `ROADMAP.md` — phases mapped to requirements
- `STATE.md` — project memory

Usage: `/gsdr:new-project`

**`/gsdr:map-codebase`**
Learn your codebase before we touch anything.

- Analyzes codebase with parallel Explore agents
- Creates `.planning/codebase/` with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/gsdr:new-project` on existing codebases

Usage: `/gsdr:map-codebase`

### Phase Planning

**`/gsdr:discuss-phase <number>`**
Talk it out before we build it.

- Captures how you imagine this phase working
- Creates CONTEXT.md with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/gsdr:discuss-phase 2`

**`/gsdr:research-phase <number>`**
Going down the rabbit hole so you don't have to.

- Discovers standard stack, architecture patterns, pitfalls
- Creates RESEARCH.md with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/gsdr:research-phase 3`

**`/gsdr:list-phase-assumptions <number>`**
See what we're thinking before we start scheming.

- Shows Claude's intended approach for a phase
- Lets you course-correct if Claude misunderstood your vision
- No files created - conversational output only

Usage: `/gsdr:list-phase-assumptions 3`

**`/gsdr:plan-phase <number>`**
Turn vibes into actionable plans.

- Generates `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (XX-01, XX-02, etc.)

Usage: `/gsdr:plan-phase 1`
Result: Creates `.planning/phases/01-foundation/01-01-PLAN.md`

**PRD Express Path:** Pass `--prd path/to/requirements.md` to skip discuss-phase entirely. Your PRD becomes locked decisions in CONTEXT.md. Useful when you already have clear acceptance criteria.

### Execution

**`/gsdr:execute-phase <phase-number>`**
Unleash the plan on your codebase.

- Groups plans by wave (from frontmatter), executes waves sequentially
- Plans within each wave run in parallel via Task tool
- Verifies phase goal after all plans complete
- Updates REQUIREMENTS.md, ROADMAP.md, STATE.md

Usage: `/gsdr:execute-phase 5`

### Quick Mode

**`/gsdr:quick`**
Skip the ceremony, ship the thing.

Quick mode uses the same system with a shorter path:
- Spawns planner + executor (skips researcher, checker, verifier)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md tracking (not ROADMAP.md)

Use when you know exactly what to do and the task is small enough to not need research or verification.

Usage: `/gsdr:quick`
Result: Creates `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`

### Roadmap Management

**`/gsdr:add-phase <description>`**
Append a new phase because scope never shrinks.

- Appends to ROADMAP.md
- Uses next sequential number
- Updates phase directory structure

Usage: `/gsdr:add-phase "Add admin dashboard"`

**`/gsdr:insert-phase <after> <description>`**
Squeeze in urgent work between existing phases.

- Creates intermediate phase (e.g., 7.1 between 7 and 8)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: `/gsdr:insert-phase 7 "Fix critical auth bug"`
Result: Creates Phase 7.1

**`/gsdr:remove-phase <number>`**
Cut a phase loose and close the gap.

- Deletes phase directory and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: `/gsdr:remove-phase 17`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`/gsdr:new-milestone <name>`**
Same energy as new-project, but for the next chapter.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with phase breakdown

Mirrors `/gsdr:new-project` flow for brownfield projects (existing PROJECT.md).

Usage: `/gsdr:new-milestone "v2.0 Features"`

**`/gsdr:complete-milestone <version>`**
Pop the champagne (digitally).

- Creates MILESTONES.md entry with stats
- Archives full details to milestones/ directory
- Creates git tag for the release
- Prepares workspace for next version

Usage: `/gsdr:complete-milestone 1.0.0`

### Progress Tracking

**`/gsdr:progress`**
See how far you've come (and how far you have to go).

- Shows visual progress bar and completion percentage
- Summarizes recent work from SUMMARY files
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: `/gsdr:progress`

### Session Management

**`/gsdr:resume-work`**
Pick up right where you left off.

- Reads STATE.md for project context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: `/gsdr:resume-work`

**`/gsdr:pause-work`**
Save your place — we'll remember everything.

- Creates .continue-here file with current state
- Updates STATE.md session continuity section
- Captures in-progress work context

Usage: `/gsdr:pause-work`

### Debugging

**`/gsdr:debug [issue description]`**
Hunt bugs with the tenacity of a caffeinated raccoon.

- Gathers symptoms through adaptive questioning
- Creates `.planning/debug/[slug].md` to track investigation
- Investigates using scientific method (evidence -> hypothesis -> test)
- Survives `/clear` — run `/gsdr:debug` with no args to resume
- Archives resolved issues to `.planning/debug/resolved/`

Usage: `/gsdr:debug "login button doesn't work"`
Usage: `/gsdr:debug` (resume active session)

### Todo Management

**`/gsdr:add-todo [description]`**
Capture that thought before it escapes.

- Extracts context from conversation (or uses provided description)
- Creates structured todo file in `.planning/todos/pending/`
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates STATE.md todo count

Usage: `/gsdr:add-todo` (infers from conversation)
Usage: `/gsdr:add-todo Add auth token refresh`

**`/gsdr:check-todos [area]`**
Review the backlog and pick a fight.

- Lists all pending todos with title, area, age
- Optional area filter (e.g., `/gsdr:check-todos api`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done/ when work begins

Usage: `/gsdr:check-todos`
Usage: `/gsdr:check-todos api`

### User Acceptance Testing

**`/gsdr:verify-work [phase]`**
Trust but verify — the GSDR way.

- Extracts testable deliverables from SUMMARY.md files
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: `/gsdr:verify-work 3`

### Milestone Auditing

**`/gsdr:audit-milestone [version]`**
Grade our own homework before shipping.

- Reads all phase VERIFICATION.md files
- Checks requirements coverage
- Spawns integration checker for cross-phase wiring
- Creates MILESTONE-AUDIT.md with gaps and tech debt

Usage: `/gsdr:audit-milestone`

**`/gsdr:plan-milestone-gaps`**
Turn audit findings into actionable fix plans.

- Reads MILESTONE-AUDIT.md and groups gaps into phases
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure phases to ROADMAP.md
- Ready for `/gsdr:plan-phase` on new phases

Usage: `/gsdr:plan-milestone-gaps`

### Configuration

**`/gsdr:settings`**
Tweak the knobs.

- Toggle researcher, plan checker, verifier agents
- Select model profile (quality/balanced/budget)
- Updates `.planning/config.json`

Usage: `/gsdr:settings`

**`/gsdr:set-profile <profile>`**
Switch how much horsepower we throw at the problem.

- `quality` — Opus everywhere except verification
- `balanced` — Opus for planning, Sonnet for execution (default)
- `budget` — Sonnet for writing, Haiku for research/verification

Usage: `/gsdr:set-profile budget`

### Utility Commands

**`/gsdr:cleanup`**
Tidy up the mess from milestones past.

- Identifies phases from completed milestones still in `.planning/phases/`
- Shows dry-run summary before moving anything
- Moves phase dirs to `.planning/milestones/v{X.Y}-phases/`
- Use after multiple milestones to reduce `.planning/phases/` clutter

Usage: `/gsdr:cleanup`

**`/gsdr:help`**
You're looking at it.

**`/gsdr:update`**
Stay current without the guesswork.

- Shows installed vs latest version comparison
- Displays changelog entries for versions you've missed
- Highlights breaking changes
- Confirms before running install
- Better than raw `npx gsdr`

Usage: `/gsdr:update`

**`/gsdr:join-discord`**
Find your people.

- Get help, share what you're building, stay updated
- Connect with other GSDR users

Usage: `/gsdr:join-discord`

## Files & Structure

```
.planning/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── RETROSPECTIVE.md      # Living retrospective (updated per milestone)
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── milestones/
│   ├── v1.0-ROADMAP.md       # Archived roadmap snapshot
│   ├── v1.0-REQUIREMENTS.md  # Archived requirements
│   └── v1.0-phases/          # Archived phase dirs (via /gsdr:cleanup or --archive-phases)
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Workflow Modes

Set during `/gsdr:new-project`:

**Interactive Mode**
For the cautious builder. Confirms each major decision, pauses at checkpoints for approval, more guidance throughout.

**YOLO Mode**
Auto-approves most decisions. Executes plans without confirmation. Only stops for critical checkpoints. For people who trust the process.

Change anytime by editing `.planning/config.json`

## Planning Configuration

Configure how planning artifacts are managed in `.planning/config.json`:

**`planning.commit_docs`** (default: `true`)
- `true`: Planning artifacts committed to git (standard workflow)
- `false`: Planning artifacts kept local-only, not committed

When `commit_docs: false`:
- Add `.planning/` to your `.gitignore`
- Useful for OSS contributions, client projects, or keeping planning private
- All planning files still work normally, just not tracked in git

**`planning.search_gitignored`** (default: `false`)
- `true`: Add `--no-ignore` to broad ripgrep searches
- Only needed when `.planning/` is gitignored and you want project-wide searches to include it

Example config:
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## Common Workflows

**Starting a new project:**

```
/gsdr:new-project        # The full interrogation -> research -> requirements -> roadmap pipeline
/clear
/gsdr:plan-phase 1       # Scheme up the first phase
/clear
/gsdr:execute-phase 1    # Let it rip
```

**Resuming work after a break:**

```
/gsdr:progress  # See where you left off and get back in the game
```

**Adding urgent mid-milestone work:**

```
/gsdr:insert-phase 5 "Critical security fix"
/gsdr:plan-phase 5.1
/gsdr:execute-phase 5.1
```

**Completing a milestone:**

```
/gsdr:complete-milestone 1.0.0
/clear
/gsdr:new-milestone  # Start the next chapter
```

**Capturing ideas during work:**

```
/gsdr:add-todo                    # Capture from conversation context
/gsdr:add-todo Fix modal z-index  # Capture with explicit description
/gsdr:check-todos                 # Review and pick a fight
/gsdr:check-todos api             # Filter by area
```

**Debugging an issue:**

```
/gsdr:debug "form submission fails silently"  # Start the hunt
# ... investigation happens, context fills up ...
/clear
/gsdr:debug                                    # Resume from where you left off
```

## Getting Help

Lost? Start here.

- Read `.planning/PROJECT.md` for project vision
- Read `.planning/STATE.md` for current context
- Check `.planning/ROADMAP.md` for phase status
- Run `/gsdr:progress` to check where you're up to
- Run `/gsdr:join-discord` to find your people
</reference>
