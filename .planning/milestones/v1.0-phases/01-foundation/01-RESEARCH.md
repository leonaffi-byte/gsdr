# Phase 1: Foundation - Research

**Researched:** 2026-03-15
**Domain:** Claude Code Plugin architecture, TypeScript CLI tooling, npm package distribution
**Confidence:** HIGH

## Summary

Phase 1 transforms the existing GSD system (v1.22.4) from a multi-runtime installer-based tool into a single-runtime Claude Code plugin distributed as an npm package. The existing GSD codebase lives at `~/.claude/` and consists of ~6,000 lines of CJS tooling (`gsd-tools.cjs` + 11 library modules), 12 agent definition files, 33 slash commands, and ~70 workflow/template/reference markdown files. The core architecture is sound: markdown-as-prompt workflows, path-only context passing to sub-agents, XML-structured plan execution, atomic git commits per task, and YAML-frontmatter-based state management. These patterns must be preserved.

The target architecture is a Claude Code plugin: a directory with `.claude-plugin/plugin.json` manifest, `skills/` for slash commands, `agents/` for sub-agent definitions, and `hooks/` for lifecycle events. The plugin format namespaces all skills under the plugin name (e.g., `/gsdr:plan-phase`). The CJS tooling (gsd-tools.cjs) should be ported to TypeScript and bundled with esbuild to a single CJS output file, distributed inside the plugin package. The npm package uses `bin/install.js` as its entry point to handle initial setup and plugin registration.

The key architectural decision is whether to distribute as a marketplace plugin (git-based, installed via `/plugin install`) or an npm package with a postinstall script that registers itself. Given the requirement for `npx gsdr@latest` installation, the npm approach is required, but it should install as a proper plugin (with `.claude-plugin/plugin.json`) to the user's `~/.claude/plugins/` or equivalent directory.

**Primary recommendation:** Create an npm package that, on `npx gsdr@latest`, copies a self-contained Claude Code plugin directory to a known location and registers it, with all TypeScript tooling pre-bundled to CJS via esbuild.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- user skipped discussion. All decisions at Claude's discretion.

### Claude's Discretion
- Fork approach: how much of GSD to keep vs rewrite -- Claude decides based on code quality
- Package name and install experience (gsdr, gsdr-cc, etc.)
- Command naming convention (/gsdr:* vs /gsd:* or other)
- How GSD commands map to Claude Code plugin skills format
- gsd-tools.cjs internals -- keep, port to TS, or redesign as needed
- TypeScript configuration and build pipeline details
- Which GSD commands to port as-is vs redesign for GSDR's autonomous model

User explicitly skipped discussion -- all Foundation decisions are at Claude's discretion. Make sensible defaults that support the downstream phases (Complexity Calibration, Front-Loaded Interaction, Dependency Graph Engine, Autonomous Execution).

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Fork GSD codebase and strip multi-runtime support (keep Claude Code only) | GSD source analyzed: 6K lines CJS tools, 12 agents, 33 commands, ~70 markdown files. Multi-runtime code isolated in install.js runtime adapters. Strip OpenCode/Gemini/Codex/Copilot paths. |
| FOUND-02 | Port GSD tooling to TypeScript with esbuild bundling to CJS | esbuild 0.24+ with `format: "cjs"`, `bundle: true`. 12 CJS modules total. TypeScript strict mode with Node 18+ target. |
| FOUND-03 | Adopt Claude Code Plugin format (skills/ + agents/ structure) | Plugin format documented: `.claude-plugin/plugin.json` manifest, `skills/<name>/SKILL.md`, `agents/<name>.md`, `hooks/hooks.json`. Skills namespaced as `/gsdr:<skill>`. |
| FOUND-04 | Preserve context engineering: fresh 200K token context per sub-agent | Sub-agent isolation via `context: fork` in skills, or agent `Task` spawning from orchestrator. Each sub-agent gets fresh context with only path-based references. |
| FOUND-05 | Preserve XML-structured plan format for agent execution | PLAN.md files use XML tags (`<task>`, `<checkpoint>`, etc.) parsed by gsd-executor agent. Pattern preserved in agent markdown prompts. |
| FOUND-06 | Preserve atomic commits per task with clean git history | Commit logic in `gsd-tools.cjs` `commit` command. Port to TypeScript. Uses `git add --` with specific files + `git commit -m`. |
| FOUND-07 | Preserve state management (STATE.md) across sessions | STATE.md YAML frontmatter + markdown body. ~720 lines of state.cjs handles load/update/patch/advance/metrics. Port to TypeScript. |
| FOUND-08 | Distribute as npm package (npx gsdr@latest) | npm package with `bin` entry pointing to install script. Installs plugin directory structure. Package name: `gsdr`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7+ | Type-safe development of CLI tools | Industry standard for Node.js tooling |
| esbuild | 0.24+ | Bundle TS to single CJS output | Already used by GSD, 100x faster than tsc for bundling |
| Node.js | 18+ | Runtime for CLI tools | LTS, required for modern features (fs.promises, etc.) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 18+ | Node.js type definitions | Development only |
| vitest | 3.x | Test framework | Unit testing the TS tooling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild | tsup | tsup wraps esbuild with more config; overkill for single CJS bundle |
| esbuild | tsc | 100x slower, no bundling -- would need separate bundler |
| vitest | jest | vitest is faster, native TS support, no transform config needed |

**Installation (dev dependencies):**
```bash
npm install -D typescript esbuild @types/node vitest
```

## Architecture Patterns

### Recommended Project Structure
```
gsdr/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name: "gsdr")
├── skills/                       # Claude Code skills (slash commands)
│   ├── new-project/
│   │   └── SKILL.md             # /gsdr:new-project
│   ├── plan-phase/
│   │   └── SKILL.md             # /gsdr:plan-phase
│   ├── execute-phase/
│   │   └── SKILL.md             # /gsdr:execute-phase
│   ├── research-phase/
│   │   └── SKILL.md             # /gsdr:research-phase
│   └── ... (other skills)
├── agents/                       # Sub-agent definitions
│   ├── gsdr-executor.md
│   ├── gsdr-planner.md
│   ├── gsdr-phase-researcher.md
│   └── ... (other agents)
├── hooks/
│   └── hooks.json               # Lifecycle hooks
├── templates/                    # Markdown templates for plan/summary/state
│   ├── state.md
│   ├── roadmap.md
│   ├── plan.md
│   ├── summary.md
│   └── ...
├── references/                   # Reference docs loaded by agents
│   ├── git-integration.md
│   ├── verification-patterns.md
│   └── ...
├── src/                          # TypeScript source for CLI tools
│   ├── index.ts                  # CLI entry point (replaces gsd-tools.cjs)
│   ├── lib/
│   │   ├── core.ts
│   │   ├── state.ts
│   │   ├── phase.ts
│   │   ├── config.ts
│   │   ├── roadmap.ts
│   │   ├── commands.ts
│   │   ├── frontmatter.ts
│   │   ├── init.ts
│   │   ├── template.ts
│   │   ├── milestone.ts
│   │   └── verify.ts
│   └── types.ts                  # Shared type definitions
├── dist/                         # esbuild output (CJS bundle)
│   └── gsdr-tools.cjs
├── bin/
│   └── install.js                # npm bin entry: installs plugin
├── tests/
│   ├── state.test.ts
│   ├── phase.test.ts
│   ├── config.test.ts
│   └── ...
├── package.json
├── tsconfig.json
├── esbuild.config.mjs            # Build configuration
└── README.md
```

### Pattern 1: Plugin Manifest
**What:** The `.claude-plugin/plugin.json` declares the plugin identity and namespace.
**When to use:** Required for any Claude Code plugin.
**Example:**
```json
{
  "name": "gsdr",
  "description": "GSD Reloaded - Autonomous spec-driven development for Claude Code",
  "version": "1.0.0",
  "author": {
    "name": "GSDR"
  }
}
```
Source: https://code.claude.com/docs/en/plugins

### Pattern 2: Skill-as-Command with Agent Delegation
**What:** Each GSD command becomes a skill that optionally delegates to a sub-agent via `context: fork` + `agent` field.
**When to use:** When the command needs fresh context (planners, executors, researchers).
**Example:**
```yaml
---
name: plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: "[phase] [--auto] [--research] [--skip-research]"
context: fork
agent: gsdr-planner
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, WebFetch
disable-model-invocation: true
---

<objective>
Create executable phase plans for a roadmap phase with integrated research.
</objective>

<execution_context>
Phase number: $ARGUMENTS
</execution_context>

<files_to_read>
- ${CLAUDE_SKILL_DIR}/../references/verification-patterns.md
</files_to_read>

<process>
... workflow instructions ...
</process>
```
Source: https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/sub-agents

### Pattern 3: Path-Based Context Engineering
**What:** Sub-agents receive only file paths, never file contents, in their spawn prompts. They use the Read tool to load what they need.
**When to use:** Always. This preserves the 200K token budget for actual work.
**Example:**
```markdown
<files_to_read>
- .planning/STATE.md
- .planning/ROADMAP.md
- .planning/phases/01-foundation/01-CONTEXT.md
- .planning/phases/01-foundation/01-RESEARCH.md
</files_to_read>
```
Source: Existing GSD pattern, verified in gsd-executor.md and gsd-planner.md agents.

### Pattern 4: CLI Tools Referenced by Absolute Path
**What:** Skills and agents reference the bundled CLI tool using `${CLAUDE_SKILL_DIR}` to construct absolute paths to the dist/ output.
**When to use:** Every time an agent or skill needs to call gsdr-tools.
**Example:**
```bash
INIT=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" init execute-phase "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Source: GSD gsd-executor.md, adapted for plugin directory structure.

### Pattern 5: npm Package with Plugin Installation
**What:** `npx gsdr@latest` runs `bin/install.js` which copies the plugin to the appropriate location.
**When to use:** Distribution and updates.
**Example package.json:**
```json
{
  "name": "gsdr",
  "version": "1.0.0",
  "bin": {
    "gsdr": "bin/install.js"
  },
  "files": [
    "bin",
    ".claude-plugin",
    "skills",
    "agents",
    "hooks",
    "templates",
    "references",
    "dist"
  ],
  "scripts": {
    "build": "node esbuild.config.mjs",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  }
}
```

### Anti-Patterns to Avoid
- **Inlining file contents in spawn prompts:** Wastes sub-agent context tokens. Always use path references.
- **Single monolithic agent file:** Keep agent definitions focused. Each agent role gets its own file.
- **Runtime-conditional code:** No if-OpenCode/if-Gemini branching. Claude Code only.
- **Putting skills inside .claude-plugin/:** Only `plugin.json` goes in `.claude-plugin/`. Skills, agents, hooks at plugin root.
- **Hardcoding `~/.claude/` paths:** Use `${CLAUDE_SKILL_DIR}` for plugin-relative paths. Hardcoded paths break local/project installs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | Existing `frontmatter.cjs` logic (port to TS) | Edge cases with multiline values, nested objects |
| Git commit with staging | Raw exec commands | Dedicated commit module (port from GSD) | Handles staging, message formatting, error recovery |
| State file updates | Direct string manipulation | YAML-aware state module (port from GSD) | Preserves frontmatter structure, handles concurrent access |
| Config loading with defaults | Ad-hoc JSON reads | Config module with schema validation (port from GSD) | Default merging, migration of deprecated keys |
| esbuild bundling | Custom build scripts | esbuild API with config file | Well-tested, handles Node externals properly |

**Key insight:** The existing GSD CJS modules are battle-tested across hundreds of projects. Port them to TypeScript rather than rewriting from scratch. The logic is sound; only the types are missing.

## Common Pitfalls

### Pitfall 1: Plugin Path Resolution
**What goes wrong:** Skills/agents reference files using relative paths that break when the plugin is installed to different locations.
**Why it happens:** Plugin install location varies (marketplace cache, --plugin-dir, etc.)
**How to avoid:** Always use `${CLAUDE_SKILL_DIR}` variable in skill content to get absolute path to the skill's directory. For agents (which don't have this variable), reference paths relative to `.planning/` which is always in the project working directory.
**Warning signs:** "File not found" errors when running skills from installed plugin.

### Pitfall 2: CJS vs ESM in Plugin Context
**What goes wrong:** Bundled tools fail with module format errors.
**Why it happens:** Claude Code's Bash tool runs in the user's shell where Node may default to ESM.
**How to avoid:** Bundle as `.cjs` extension (explicit CommonJS). Set `"type": "commonjs"` in a package.json adjacent to the dist output if needed. esbuild with `format: "cjs"` handles this.
**Warning signs:** "Cannot use require in ES module" or "ERR_REQUIRE_ESM" errors.

### Pitfall 3: Namespace Collision with Existing GSD
**What goes wrong:** GSDR skills conflict with existing GSD commands in `~/.claude/commands/gsd/`.
**Why it happens:** User has GSD installed globally alongside GSDR plugin.
**How to avoid:** Use `gsdr` as plugin name (skills become `/gsdr:*`), distinct from GSD's `/gsd:*` commands. Document that both can coexist.
**Warning signs:** Wrong version of command executing.

### Pitfall 4: Large Bash Output Exceeding Buffer
**What goes wrong:** CLI tool output truncated by Claude Code's ~50KB Bash tool buffer.
**Why it happens:** JSON output from init commands or state snapshots can be large.
**How to avoid:** Preserve the `@file:` tmpfile pattern from GSD: when output exceeds threshold, write to temp file and return `@file:/path`. All callers must check for this prefix. This pattern is already in GSD's core.cjs `output()` function.
**Warning signs:** JSON parse errors, truncated state data.

### Pitfall 5: Windows Path Handling
**What goes wrong:** Path separators cause file-not-found errors on Windows.
**Why it happens:** Node.js uses OS-native separators; markdown files may hardcode forward slashes.
**How to avoid:** Port the `toPosixPath()` helper from GSD core.cjs. Normalize all paths to forward slashes in tool output. Use `path.join()` for filesystem operations, `toPosixPath()` for display/markdown references.
**Warning signs:** Path errors only on Windows, works fine on macOS/Linux.

### Pitfall 6: Skill Description Budget Overflow
**What goes wrong:** Claude doesn't see all GSDR skills because descriptions exceed the 2% context window budget.
**Why it happens:** 30+ skills each with descriptions consume significant context.
**How to avoid:** Keep skill descriptions concise (1-2 sentences). Use `disable-model-invocation: true` for workflow skills that should only be invoked manually. Only orchestrator-level skills need Claude auto-discovery.
**Warning signs:** Skills missing from `/help` output, Claude unable to find commands.

## Code Examples

### esbuild Configuration
```typescript
// esbuild.config.mjs
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/gsdr-tools.cjs',
  external: [],  // Bundle everything - no external deps
  minify: false,  // Keep readable for debugging
  sourcemap: true,
});
```
Source: https://esbuild.github.io/getting-started/

### TypeScript Config
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationDir": "dist/types",
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### State Module Type Definitions (example)
```typescript
// src/types.ts
export interface GsdrConfig {
  mode: 'yolo' | 'interactive' | 'custom';
  granularity: 'coarse' | 'standard' | 'fine';
  parallelization: boolean;
  commit_docs: boolean;
  model_profile: 'quality' | 'balanced' | 'budget';
  workflow: {
    research: boolean;
    plan_check: boolean;
    verifier: boolean;
    nyquist_validation: boolean;
    auto_advance: boolean;
  };
  git: {
    branching_strategy: 'none' | 'phase' | 'milestone';
  };
}

export interface StateFrontmatter {
  gsd_state_version: string;
  milestone: string;
  milestone_name: string;
  status: string;
  stopped_at: string;
  last_updated: string;
  last_activity: string;
  progress: {
    total_phases: number;
    completed_phases: number;
    total_plans: number;
    completed_plans: number;
    percent: number;
  };
}

export interface PhaseInfo {
  directory: string;
  phase_number: string;
  phase_name: string;
  phase_slug: string;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
}

export interface InitResult {
  commit_docs: boolean;
  phase_found: boolean;
  phase_dir: string | null;
  phase_number: string | null;
  phase_name: string | null;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
  state_path: string;
  config_path: string;
}
```

### Plugin Installation Script
```javascript
#!/usr/bin/env node
// bin/install.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_NAME = 'gsdr';
const SOURCE_DIR = path.join(__dirname, '..');
const TARGET_DIR = path.join(os.homedir(), '.claude', 'plugins', 'local', PLUGIN_NAME);

// Copy plugin directory to Claude Code plugins location
function install() {
  console.log(`Installing GSDR plugin to ${TARGET_DIR}...`);

  // Ensure target parent exists
  fs.mkdirSync(path.dirname(TARGET_DIR), { recursive: true });

  // Copy plugin files
  const dirs = ['.claude-plugin', 'skills', 'agents', 'hooks', 'templates', 'references', 'dist'];
  for (const dir of dirs) {
    const src = path.join(SOURCE_DIR, dir);
    if (fs.existsSync(src)) {
      copyRecursive(src, path.join(TARGET_DIR, dir));
    }
  }

  console.log('GSDR plugin installed. Restart Claude Code and run /gsdr:new-project to begin.');
}

install();
```

## State of the Art

| Old Approach (GSD) | New Approach (GSDR) | Impact |
|---------------------|---------------------|--------|
| Multi-runtime installer (bin/install.js) | Single-runtime plugin package | Eliminates ~60% of install.js complexity |
| Commands in `~/.claude/commands/gsd/` | Skills in `plugin/skills/` | Namespaced as `/gsdr:*`, plugin-managed lifecycle |
| Agents in `~/.claude/agents/gsd-*.md` | Agents in `plugin/agents/` | Plugin-scoped, no global namespace pollution |
| Workflows in `get-shit-done/workflows/` | Inline in skills or agent preloaded skills | Simpler loading, no separate workflow directory |
| CJS tooling (gsd-tools.cjs) | TypeScript source, esbuild CJS bundle | Type safety, better maintainability |
| Path references via `$HOME/.claude/get-shit-done/` | `${CLAUDE_SKILL_DIR}` relative paths | Portable across install locations |
| Manual hook registration in settings.json | `hooks/hooks.json` in plugin | Managed by plugin system |

**Deprecated/outdated:**
- Multi-runtime support (OpenCode, Gemini, Codex, Copilot): Removed entirely per FOUND-01
- `~/.claude/commands/` directory: Still works but `skills/` is recommended and supports more features
- Global `~/.claude/agents/`: Plugin agents are scoped to plugin, cleaner separation

## Open Questions

1. **Plugin Installation Path**
   - What we know: Marketplace plugins go to `~/.claude/plugins/cache/`. Local dev uses `--plugin-dir`.
   - What's unclear: The exact mechanism for npm-installed plugins to register with Claude Code. Marketplace plugins are git-based. npm packages may need to use `--plugin-dir` approach or a symlink-based registration.
   - Recommendation: Install to a known directory (e.g., `~/.claude/plugins/local/gsdr/`) and document that users run `claude --plugin-dir ~/.claude/plugins/local/gsdr` or add it to their settings. Alternatively, investigate if Claude Code supports a plugins directory that auto-discovers local plugins. The simplest approach may be to install to `~/.claude/` directly (like GSD does) but using the skills/agents/plugin.json structure so it's a proper plugin.

2. **Skill Namespacing vs Direct Commands**
   - What we know: Plugin skills are namespaced (`/gsdr:plan-phase`). Standalone skills in `~/.claude/skills/` are direct (`/plan-phase`).
   - What's unclear: Whether users will accept the longer `/gsdr:` prefix.
   - Recommendation: Install as plugin for clean separation. The namespace prefix is standard plugin behavior and prevents conflicts. Users who want shorter names can create personal skill aliases.

3. **Agent Preloaded Skills vs Workflow Files**
   - What we know: GSD agents reference `skills: [gsd-executor-workflow]` but these don't exist as actual skill directories. The actual workflow content is loaded via `@path` references in command files.
   - What's unclear: Whether to port workflows as preloaded skills (using the `skills` field in agent frontmatter) or keep them inline in agent definitions.
   - Recommendation: Keep workflow content inline in agent markdown files. The agents are already large (~15-40KB). Splitting into separate skills adds indirection without benefit. The agent file IS the workflow prompt.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | vitest.config.ts (Wave 0 -- needs creation) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | No multi-runtime code in output | unit | `npx vitest run tests/no-multi-runtime.test.ts -x` | Wave 0 |
| FOUND-02 | TypeScript compiles, esbuild produces CJS | integration | `npx vitest run tests/build.test.ts -x` | Wave 0 |
| FOUND-03 | Plugin structure valid (plugin.json, skills/, agents/) | unit | `npx vitest run tests/plugin-structure.test.ts -x` | Wave 0 |
| FOUND-04 | Sub-agent spawn uses path-only references | unit | `npx vitest run tests/context-engineering.test.ts -x` | Wave 0 |
| FOUND-05 | XML plan format parseable from agent definitions | unit | `npx vitest run tests/plan-format.test.ts -x` | Wave 0 |
| FOUND-06 | Commit function produces atomic commits | unit | `npx vitest run tests/git-commits.test.ts -x` | Wave 0 |
| FOUND-07 | STATE.md read/write/update cycle | unit | `npx vitest run tests/state.test.ts -x` | Wave 0 |
| FOUND-08 | package.json valid, bin entry works | unit | `npx vitest run tests/package.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsdr:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- test framework configuration
- [ ] `tests/state.test.ts` -- covers FOUND-07
- [ ] `tests/build.test.ts` -- covers FOUND-02
- [ ] `tests/plugin-structure.test.ts` -- covers FOUND-03
- [ ] `tests/context-engineering.test.ts` -- covers FOUND-04
- [ ] `tests/plan-format.test.ts` -- covers FOUND-05
- [ ] `tests/git-commits.test.ts` -- covers FOUND-06
- [ ] `tests/package.test.ts` -- covers FOUND-08
- [ ] `tests/no-multi-runtime.test.ts` -- covers FOUND-01
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8`

## Sources

### Primary (HIGH confidence)
- Claude Code Skills documentation: https://code.claude.com/docs/en/skills -- full skill format, frontmatter fields, `${CLAUDE_SKILL_DIR}`, supporting files, invocation control
- Claude Code Plugins documentation: https://code.claude.com/docs/en/plugins -- plugin.json format, directory structure, skills/agents/hooks in plugins, distribution
- Claude Code Sub-agents documentation: https://code.claude.com/docs/en/sub-agents -- agent frontmatter, model selection, tool permissions, preloaded skills, `context: fork`
- GSD source code (local): `~/.claude/get-shit-done/bin/` -- 6,013 lines CJS across 12 modules, verified version 1.22.4
- GSD agents (local): `~/.claude/agents/gsd-*.md` -- 12 agent definitions, verified frontmatter format
- GSD commands (local): `~/.claude/commands/gsd/*.md` -- 33 command files, verified skill-compatible frontmatter
- Installed plugin example (local): `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.2/` -- verified plugin directory structure

### Secondary (MEDIUM confidence)
- esbuild documentation: https://esbuild.github.io/getting-started/ -- build configuration for CJS output
- npm get-shit-done-cc package: https://www.npmjs.com/package/get-shit-done-cc -- current distribution approach
- GSD GitHub repository: https://github.com/gsd-build/get-shit-done -- package.json, install.js structure

### Tertiary (LOW confidence)
- Plugin installation path for npm-distributed plugins: Exact registration mechanism for non-marketplace plugins needs runtime testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TypeScript + esbuild already used by GSD, well-documented
- Architecture: HIGH - Plugin format thoroughly documented by Anthropic, existing GSD patterns verified locally
- Pitfalls: HIGH - Verified against real plugin installs and GSD source code
- Distribution: MEDIUM - npm-to-plugin registration path needs runtime validation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, 30-day validity)
