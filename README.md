<div align="center">

```
 ██████╗ ███████╗██████╗ ██████╗
██╔════╝ ██╔════╝██╔══██╗██╔══██╗
██║  ███╗███████╗██║  ██║██████╔╝
██║   ██║╚════██║██║  ██║██╔══██╗
╚██████╔╝███████║██████╔╝██║  ██║
 ╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝
       GET SHIT DONE. REBRANDABLE.
```

**Answer questions for 10 minutes. Walk away. Come back to working code.**

<a href="https://www.npmjs.com/package/@leonaffi/gsdr"><img src="https://img.shields.io/npm/v/@leonaffi/gsdr?style=flat-square&color=cb3837" alt="npm version"></a>
<a href="https://github.com/leonaffi-byte/gsdr/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license"></a>
<a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="node version"></a>

</div>

---

## What is GSDR?

GSDR is a Claude Code plugin that builds your entire project while you do literally anything else. Tell it what you want, answer a few questions, and walk away. It handles research, planning, execution, verification, and auto-fixing — no babysitting required.

### The Problem

AI coding assistants need babysitting. You approve plans, review steps, verify results, fix breakage. You're not developing — you're a glorified supervisor.

### The Solution

GSDR front-loads everything into 10 minutes of questions, then runs fully autonomous:

```
You (10 min)          GSDR (autonomous)                    You (review)
    |                      |                                    |
    |-- Answer questions ->|                                    |
    |                      |-- Research (parallel agents) -->   |
    |                      |-- Plan (complexity-scaled) ---->   |
    |                      |-- Execute (parallel waves) ---->   |
    |                      |-- Verify (auto-check) ----------> |
    |                      |-- Fix failures (3 retries) ----->  |
    |                      |-- Report results ---------------> |
    |                      |                                    |
    |                      |<-- Here's what I built ------------|
```

## Install

### npm (recommended)

```bash
npx @leonaffi/gsdr
```

### Homebrew (macOS/Linux)

```bash
brew tap leonaffi-byte/gsdr
brew install gsdr
```

### Scoop (Windows)

```powershell
scoop bucket add gsdr https://github.com/leonaffi-byte/scoop-gsdr
scoop install gsdr
```

### curl (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/leonaffi-byte/gsdr/master/install.sh | bash
```

### PowerShell (Windows)

```powershell
irm https://raw.githubusercontent.com/leonaffi-byte/gsdr/master/install.ps1 | iex
```

> **Requires:** Node.js 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

## Quick Start

```bash
# 1. Install the plugin
npx @leonaffi/gsdr

# 2. Start Claude Code with the plugin
claude --plugin-dir ~/.claude/plugins/local/gsdr

# 3. Create a new project
/gsdr:new-project
```

That's it. GSDR walks you through a questioning session, builds a roadmap, and starts executing autonomously.

## Key Features

### Complexity Calibration

GSDR auto-detects how complex your task is and scales its approach:

| Tier | Research | Plans | Verification |
|------|----------|-------|-------------|
| **Simple** | Skipped | 1 lightweight | Basic |
| **Medium** | Light | 2-3 plans | Standard |
| **Complex** | Full 4-agent | 3+ plans | Rigorous |

No more over-engineering a config change. No more under-planning a database migration.

### Front-Loaded Interaction

All human interaction happens upfront:

1. GSDR analyzes your codebase and task
2. Asks complexity-scaled questions (1-2 for simple, full treatment for complex)
3. You answer for 10-15 minutes
4. GSDR runs autonomously from there

Zero mid-execution prompts. Zero "approve this plan?" gates.

### Parallel Execution

GSDR builds a dependency graph from your roadmap and runs everything it safely can in parallel:

- Independent phases plan and execute concurrently
- File-conflict detection prevents race conditions
- Within each phase, independent plans run in parallel waves
- Respects Claude Code agent limits (5-10 concurrent)

### Autonomous Self-Verification

After each phase, GSDR automatically:

1. Runs verification against success criteria
2. If something fails, attempts up to **3 auto-fix retries**
3. Uses **2-strike halt** — stops if 2 consecutive attempts don't improve things
4. Independent tasks continue even when one fails
5. Produces an **end-of-run report** with everything that was built, fixed, or needs attention

### Irreversible Action Gate

Dangerous operations always require human confirmation, regardless of autonomy mode:

- Database drops and destructive migrations
- Force pushes and branch deletions
- Package publishing
- Production deployments

## Commands

GSDR provides 31 slash commands as Claude Code skills:

### Project Lifecycle

| Command | Description |
|---------|-------------|
| `/gsdr:new-project` | Initialize a new project with deep context gathering |
| `/gsdr:new-milestone` | Start a new milestone cycle |
| `/gsdr:progress` | Check project progress and route to next action |
| `/gsdr:complete-milestone` | Archive completed milestone and prepare for next |

### Planning & Execution

| Command | Description |
|---------|-------------|
| `/gsdr:plan-phase` | Create detailed phase plan with verification loop |
| `/gsdr:execute-phase` | Execute plans with wave-based parallelization |
| `/gsdr:quick` | Execute a quick task with GSDR guarantees |
| `/gsdr:research-phase` | Research how to implement a phase |

### Verification & Debugging

| Command | Description |
|---------|-------------|
| `/gsdr:verify-work` | Validate built features through UAT |
| `/gsdr:audit-milestone` | Audit milestone completion against requirements |
| `/gsdr:validate-phase` | Retroactively audit validation gaps |
| `/gsdr:debug` | Systematic debugging with persistent state |

### Roadmap Management

| Command | Description |
|---------|-------------|
| `/gsdr:add-phase` | Add phase to end of current milestone |
| `/gsdr:insert-phase` | Insert urgent work between existing phases |
| `/gsdr:remove-phase` | Remove a future phase from roadmap |
| `/gsdr:map-codebase` | Analyze codebase with parallel mapper agents |

### Session Management

| Command | Description |
|---------|-------------|
| `/gsdr:pause-work` | Create context handoff when pausing |
| `/gsdr:resume-work` | Resume with full context restoration |
| `/gsdr:settings` | Configure workflow toggles and model profile |
| `/gsdr:help` | Show available commands and usage guide |

## Architecture

GSDR is built around **context engineering** — every sub-agent spawns with a fresh 200K token context and receives only the references it needs, never bloated conversation history.

```
gsdr/
├── skills/          # 31 slash commands (Claude Code skills)
├── agents/          # 12 specialized sub-agents
├── templates/       # Plan, summary, and report templates
├── references/      # Patterns and conventions
├── src/             # TypeScript library modules
│   ├── lib/
│   │   ├── complexity.ts    # Complexity classifier
│   │   ├── scheduler.ts     # DAG dependency engine
│   │   └── autonomous.ts    # Self-verification & auto-fix
│   └── index.ts             # CLI router (40+ commands)
├── dist/            # CJS bundle (esbuild)
└── bin/install.js   # Plugin installer
```

### Sub-Agents

| Agent | Role |
|-------|------|
| `gsdr-planner` | Creates XML-structured execution plans |
| `gsdr-executor` | Executes plans with atomic commits |
| `gsdr-verifier` | Verifies phase goals are achieved |
| `gsdr-debugger` | Scientific debugging with checkpoints |
| `gsdr-phase-researcher` | Researches implementation approaches |
| `gsdr-plan-checker` | Validates plan quality before execution |
| `gsdr-project-researcher` | Deep domain research (4 parallel agents) |
| `gsdr-roadmapper` | Creates phased roadmaps from requirements |
| `gsdr-integration-checker` | Verifies cross-phase E2E flows |
| `gsdr-nyquist-auditor` | Fills test coverage gaps |
| `gsdr-codebase-mapper` | Produces structured codebase analysis |
| `gsdr-research-synthesizer` | Merges parallel research outputs |

## How It Works

```
/gsdr:new-project
       |
       v
  Questioning Session (10-15 min)
  - Codebase analysis (if brownfield)
  - Complexity classification per phase
  - Adaptive questioning depth
       |
       v
  Research (parallel agents)
  - 4 researchers: stack, architecture, features, pitfalls
  - Synthesized into project context
       |
       v
  Requirements & Roadmap
  - Requirements with traceability
  - Phased roadmap with dependency graph
       |
       v
  Autonomous Execution Loop
  ┌─────────────────────────────┐
  │  For each phase:            │
  │  1. Plan (complexity-scaled)│
  │  2. Execute (parallel waves)│
  │  3. Verify (auto-check)     │
  │  4. Auto-fix if needed      │
  │  5. Next phase              │
  └─────────────────────────────┘
       |
       v
  End-of-Run Report
  - What was built
  - What was verified
  - What was auto-fixed
  - What needs human attention
```

## Configuration

GSDR stores config in `.planning/config.json`:

```json
{
  "mode": "yolo",
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true
  },
  "git": {
    "branching_strategy": "milestone"
  }
}
```

Use `/gsdr:settings` to configure interactively.

### Model Profiles

| Profile | Execution | Research | Planning |
|---------|-----------|----------|----------|
| **quality** | Opus | Sonnet | Sonnet |
| **balanced** | Sonnet | Sonnet | Haiku |
| **budget** | Sonnet | Haiku | Haiku |

## Uninstall

```bash
# npm
npx @leonaffi/gsdr --uninstall
npm uninstall -g @leonaffi/gsdr

# Homebrew
brew uninstall gsdr && brew untap leonaffi-byte/gsdr

# Scoop
scoop uninstall gsdr && scoop bucket rm gsdr
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built autonomously with GSDR itself. Evolved from <a href="https://github.com/gsd-build/get-shit-done">Get Shit Done</a>.</sub>
</p>
