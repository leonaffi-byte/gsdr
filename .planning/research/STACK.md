# Stack Research

**Domain:** AI coding assistant orchestration / meta-prompting system for Claude Code
**Researched:** 2026-03-14
**Confidence:** HIGH

## Context

GSDR is a fork of GSD v1 (`get-shit-done-cc`). The original GSD is a zero-runtime-dependency system: CJS Node.js scripts, markdown prompts, and shell orchestration. It has only `esbuild` and `c8` as devDependencies. It distributes via npm and installs into `~/.claude/` as custom commands + agents.

Claude Code has since evolved its extension model: **Skills** (replacing legacy commands), **Plugins** (the distribution format), and **Subagents** (for parallel agent orchestration). GSDR should adopt these current formats from the start.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS (22.18+) | Runtime | Active LTS through April 2027. Native TypeScript type-stripping without flags since 22.18.0. Native test runner stable. Claude Code runs on Node; GSDR inherits this constraint. |
| TypeScript | 5.7+ | Language (source) | Write in TS, ship as bundled CJS. Node 22.18+ strips types natively for dev/test with zero config. esbuild handles the production bundle. **Constraint: use erasable-only syntax** (no enums, no parameter properties, no decorators, no namespaces) to stay compatible with Node's type-stripping. |
| esbuild | 0.25.x | Bundler | Bundle all TS source into a single `gsd-tools.cjs` file. Sub-millisecond builds. The original GSD already uses esbuild for this exact pattern -- proven approach. Single CLI invocation or 10-line build script, no config file needed. |

**Why TypeScript over plain JavaScript:**

The original GSD is pure CJS JavaScript. For GSDR, TypeScript is worth the (minimal) overhead because:
- Node 22.18+ eliminates the "build step for every change" argument -- `node src/gsd-tools.ts` just works in development.
- The `gsd-tools` CLI has ~25 subcommands with complex state management. Type safety at function boundaries catches bugs that JSDoc cannot.
- esbuild bundles TS to CJS in <100ms. The build step is effectively invisible.
- The tradeoff is real: contributors must know TS syntax. But GSDR targets developers who use Claude Code, who overwhelmingly know TypeScript.

**Why CJS output (not ESM):**

The bundled `gsd-tools.cjs` is invoked via `node gsd-tools.cjs <command>` from agent prompts. CJS is the most reliable format for this use case -- no `"type": "module"` needed in package.json, no `.mjs` extension confusion, and Claude Code itself uses CJS internally. Source is TS/ESM; esbuild converts to CJS at build time.

**Confidence: HIGH** -- verified against Node.js docs, Claude Code docs, and GSD v1 working codebase.

### Distribution Format

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Plugin format | current (CC 1.0.33+) | Distribution unit | The official packaging format. Contains `.claude-plugin/plugin.json` manifest, `skills/`, `agents/`, `hooks/` directories. Skills get namespaced (`/gsdr:new-project`). This is how Claude Code expects extensions to be distributed. |
| Claude Code Skills | current | Slash commands | The current standard, replacing legacy `.claude/commands/`. Skills use `SKILL.md` with YAML frontmatter (`context: fork`, `agent`, `allowed-tools`, `model`, `disable-model-invocation`). Support supporting files, dynamic context injection (`!`backtick\`\`), and `$ARGUMENTS` substitution. |
| Claude Code Agents | current | Subagent definitions | `.claude/agents/<name>.md` with YAML frontmatter. Fields: `name`, `description`, `tools`, `disallowedTools`, `model` (sonnet/opus/haiku/inherit), `permissionMode`, `skills` (preloaded), `memory` (user/project/local), `background`, `isolation` (worktree), `maxTurns`, `hooks`. Subagents cannot spawn subagents. |
| npm | 10+ | Package registry | `npx gsdr@latest` for install. Package runs a postinstall/bin script that installs the plugin into `~/.claude/`. |

**Key distribution insight:** The original GSD uses the legacy `.claude/commands/gsd/` directory. GSDR should use the plugin format from the start. Plugins contain skills, agents, and hooks in a structured way. The npm package is the delivery mechanism; the plugin format is what Claude Code consumes.

**Confidence: HIGH** -- verified against official Claude Code documentation at code.claude.com.

### Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js native test runner (`node:test`) | built-in (Node 22) | Unit and integration tests | Zero dependencies. Stable since Node 20, mature in 22. Supports `describe`/`it`/`test`, `before`/`after` hooks, subtests, `--test-reporter` for output format, `--test-rerun-failures`, snapshot testing, mocking via `node:mock`. For a CLI tool with no browser/Vite concerns, the native runner eliminates one more dev dependency. |
| `node:assert` | built-in | Assertions | Built-in strict assertions. Covers all common assertion patterns. |
| c8 | 10.x | Code coverage | Istanbul-compatible coverage for Node's native test runner. Lightweight. The original GSD uses c8 -- proven pattern. |

**Why native test runner over Vitest:** Vitest 4.x is excellent but pulls in Vite as a peer dependency. For a CLI tool that never touches browsers, Vite adds weight with no benefit. The native runner runs `.test.ts` files directly via Node 22 type-stripping -- zero compile step, zero external dependencies for testing.

**Confidence: HIGH** -- verified Node.js test runner docs and capabilities.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `yaml` | 2.x | YAML frontmatter parsing | Parse YAML frontmatter from PLAN.md, SUMMARY.md, STATE.md. The original GSD hand-rolls this with regex; a proper parser handles multiline values, special characters, and nested structures. Small enough to bundle into gsd-tools.cjs via esbuild. **Only runtime dependency.** |

**Zero-dependency alternatives for everything else:**

| Need | Approach | Rationale |
|------|----------|-----------|
| Terminal colors | Not needed | CLI output goes to Claude Code agents, not human terminals |
| File globbing | Not needed | Agents use Claude Code's built-in Glob tool; `fs.readdirSync` suffices for the CLI |
| CLI argument parsing | `process.argv.slice(2)` | The CLI is called by agents with known argument patterns, not human users |
| HTTP requests | Not needed | GSDR orchestrates via Claude Code subagents, not API calls |

**Confidence: HIGH** -- GSD v1 proves zero-dep works at scale. Only adding `yaml` for correctness.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript compiler (`tsc`) | Type checking only | `tsc --noEmit` for CI validation. Never use tsc for compilation -- esbuild handles that. |
| `@types/node` | Node.js type definitions | Pin to `@types/node@22` to match LTS target. |
| ESLint + `@typescript-eslint` | Linting (optional) | Standard for TS projects. Flat config (eslint.config.js). Not critical for launch -- add when multiple contributors join. |
| Prettier | Formatting (optional) | Consistent style. Can add later. |

## Installation

```bash
# Runtime dependency (bundled into gsd-tools.cjs via esbuild)
npm install yaml

# Dev dependencies
npm install -D esbuild typescript @types/node c8

# Optional dev tools (add when needed)
npm install -D @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint prettier
```

## Build Pipeline

```bash
# Type check
npx tsc --noEmit

# Bundle for distribution
npx esbuild src/gsd-tools.ts --bundle --platform=node --target=node22 --format=cjs --outfile=bin/gsd-tools.cjs

# Test (Node 22 type-strips .ts files natively)
node --test src/**/*.test.ts

# Coverage
npx c8 node --test src/**/*.test.ts
```

## Project Structure

```
gsdr/
  .claude-plugin/
    plugin.json                # Plugin manifest: {name, version, description, author}
  skills/
    new-project/
      SKILL.md                 # /gsdr:new-project (was commands/gsd/new-project.md)
      supporting-docs.md       # Referenced from SKILL.md
    execute-phase/
      SKILL.md                 # /gsdr:execute-phase
    plan-phase/
      SKILL.md
    quick/
      SKILL.md
    ...
  agents/
    gsdr-executor.md           # Subagent: plan execution
    gsdr-planner.md            # Subagent: phase planning
    gsdr-verifier.md           # Subagent: verification
    gsdr-project-researcher.md # Subagent: project research
    ...
  hooks/
    hooks.json                 # Lifecycle hooks configuration
  bin/
    gsd-tools.cjs              # Bundled CLI (built from src/ via esbuild)
    install.js                 # npm postinstall script (copies plugin to ~/.claude/)
  src/
    gsd-tools.ts               # CLI entry point
    lib/
      core.ts                  # Shared utilities, path helpers
      state.ts                 # STATE.md management
      phase.ts                 # Phase CRUD operations
      roadmap.ts               # Roadmap parsing and updates
      frontmatter.ts           # YAML frontmatter read/write
      verify.ts                # Verification suite
      config.ts                # Config management
      ...
    __tests__/
      core.test.ts
      state.test.ts
      frontmatter.test.ts
      ...
  templates/
    plan.md                    # PLAN.md template
    summary.md                 # SUMMARY.md template
    ...
  references/
    ...                        # Reference docs loaded by agents
  package.json
  tsconfig.json
  .npmignore
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TypeScript (source) | JavaScript (ESM) with JSDoc | If team has non-TS contributors, or if the tooling CLI stays under ~500 LOC. GSD v1 proves JS works, but GSDR's complexity (25+ subcommands, state management, verification suite) benefits from types. |
| Node native test runner | Vitest 4.x | If you need browser-environment testing, HMR-driven test feedback, or advanced snapshot diffing. None of these apply to a Node CLI tool. |
| Node native test runner | Jest | Never for this project. Slow startup, painful ESM/TS configuration, losing ecosystem momentum to Vitest and native runner. |
| esbuild (CJS bundle) | tsup / tsdown | If you need multiple output formats (ESM + CJS + .d.ts declarations). GSDR only needs a single CJS bundle. tsup is in maintenance mode; tsdown is emerging. |
| esbuild (CJS bundle) | Rollup | If you need tree shaking or code splitting for a library. GSDR is an application bundle. esbuild is 10-100x faster. |
| Plugin format | Legacy commands format | Only if targeting very old Claude Code versions. Skills/Plugins are the current standard. Legacy commands still work as fallback -- Claude Code explicitly documents backward compatibility. |
| `yaml` library | Hand-rolled regex parser | If you want absolute zero runtime dependencies. Start with regex, add yaml when multiline frontmatter values cause bugs. The original GSD hand-rolls it; it works but has edge cases. |
| CJS output | ESM output | When the Node.js ecosystem fully drops CJS. As of 2026, CJS is still safer for CLI tools invoked via `node script.cjs`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| ts-node / tsx | Slow startup, fragile ESM interop, unnecessary dependency | Node 22.18+ native type-stripping (`node file.ts` just works) |
| Jest | Slow startup, complex TS/ESM configuration, declining adoption | `node:test` (built-in, zero dependencies) |
| Webpack | Massive config overhead designed for browser bundles | esbuild (designed for Node, near-instant) |
| Commander.js / yargs | CLI is invoked by agents, not humans. Adds dependency for simple argument parsing. | Hand-rolled `process.argv` parsing (proven in GSD v1) |
| chalk / picocolors / ink | Output goes to Claude Code agents, not human terminals | Plain text output |
| Anthropic SDK / AI SDKs | GSDR orchestrates via Claude Code's subagent system, not direct API calls. Adding SDKs couples to API versions. | Claude Code's native Agent tool / subagent spawning |
| Bun / Deno | Claude Code runs on Node.js. Alternative runtimes add untested surface area. | Node.js 22 LTS |
| TypeScript enums | Incompatible with Node 22 native type-stripping (requires `--experimental-transform-types`) | `as const` objects or string union types |
| TypeScript decorators | Incompatible with Node 22 native type-stripping | Plain functions, composition patterns |
| TypeScript namespaces | Incompatible with Node 22 native type-stripping | ES module imports |
| Any database (SQLite, etc.) | State must be in markdown files readable by Claude Code. Databases are opaque to the context window. | Markdown + YAML frontmatter state management |
| Monorepo / workspaces | GSDR is a single package. Workspaces add tooling complexity. | Single package.json |

## Stack Patterns by Variant

**For the installer (`bin/install.js`):**
- Keep as CommonJS. This runs via `npx` and needs maximum compatibility.
- Use only Node.js built-ins: `fs`, `path`, `os`, `child_process`.
- Copy the plugin directory to `~/.claude/` (or invoke `claude plugin install`).
- Must handle both fresh install and upgrade paths.

**For CLI tooling (`src/gsd-tools.ts` -> `bin/gsd-tools.cjs`):**
- TypeScript source, bundled to CJS via esbuild.
- Subcommand routing via switch/if-else on `process.argv[2]`.
- All file operations synchronous (short-lived CLI invocations, not servers).
- Exit codes matter: agents parse exit code 0 vs non-zero.
- Output goes to stdout (consumed by agents). Errors to stderr.

**For skills (`.md` files in `skills/`):**
- Pure markdown with YAML frontmatter.
- Reference `gsd-tools.cjs` via `node "$HOME/.claude/gsdr/bin/gsd-tools.cjs" <command>`.
- Use `$ARGUMENTS` for user input, `${CLAUDE_SKILL_DIR}` for file references.
- Use `!`backtick\`\` for dynamic context injection (runs shell command, injects output).
- Set `context: fork` + `agent: <name>` for skills that should run in a subagent.

**For agents (`.md` files in `agents/`):**
- Markdown with YAML frontmatter: `name`, `description`, `tools`, `model`.
- Can preload skills via `skills:` field.
- Can use `memory: user` for persistent cross-session learning.
- Can run in `background: true` or `isolation: worktree` mode.
- **Cannot spawn other subagents** (Claude Code limitation).

**If bundled `gsd-tools.cjs` grows beyond ~50KB:**
- Split into multiple CJS files via esbuild multiple entry points.
- Follow original GSD pattern: `bin/gsd-tools.cjs` + `bin/lib/*.cjs`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Node.js 22 LTS (22.18+) | TypeScript 5.5+ | Type-stripping requires erasable-only syntax. TS 5.7+ recommended. |
| Node.js 22.18+ | `node:test` stable | No experimental flags needed. |
| Node.js 22.18+ | Native `.ts` execution | No `--experimental-strip-types` flag needed. |
| esbuild 0.25.x | Node.js 22, TypeScript 5.7+ | `--target=node22` ensures compatible JS output. |
| Claude Code Skills | Claude Code 1.0.33+ | Plugin format requires 1.0.33+. Legacy commands work on older versions. |
| `yaml` 2.x | esbuild | Pure JS, bundles cleanly into CJS. No native addons. |
| c8 10.x | `node:test` | Works with any Node test runner that produces V8 coverage data. |

## Sources

- [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) -- Skills format, SKILL.md structure, frontmatter fields, dynamic context injection, supporting files (HIGH confidence, verified via WebFetch)
- [Claude Code Subagents documentation](https://code.claude.com/docs/en/sub-agents) -- Agent format, all frontmatter fields, parallel execution, memory, isolation, hooks (HIGH confidence, verified via WebFetch)
- [Claude Code Plugins documentation](https://code.claude.com/docs/en/plugins) -- Plugin manifest schema, directory structure, distribution, marketplace (HIGH confidence, verified via WebFetch)
- [Node.js TypeScript docs](https://nodejs.org/en/learn/typescript/run-natively) -- Type-stripping stable since v22.18.0, no flags needed (HIGH confidence)
- [Node.js test runner docs](https://nodejs.org/api/test.html) -- Native test runner stable API (HIGH confidence)
- [esbuild documentation](https://esbuild.github.io/) -- CJS bundling for Node platform (HIGH confidence)
- [get-shit-done-cc on npm](https://www.npmjs.com/package/get-shit-done-cc) -- Original GSD v1.22.4 package structure (HIGH confidence)
- Original GSD source at `~/.claude/get-shit-done/` -- Direct inspection: CJS, esbuild, agents, commands structure (HIGH confidence)
- [Vitest 4.1.0](https://www.npmjs.com/package/vitest) -- Current version verified, used for comparison (MEDIUM confidence)

---
*Stack research for: AI coding assistant orchestration / meta-prompting system (GSDR)*
*Researched: 2026-03-14*
