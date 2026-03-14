# Phase 1: Foundation - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Fork GSD codebase, strip multi-runtime support (keep Claude Code only), port tooling to TypeScript with esbuild bundling, adopt Claude Code Plugin format (skills/ + agents/), preserve proven patterns (context engineering, XML plans, atomic commits, state management), and distribute as npm package.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Fork approach: how much of GSD to keep vs rewrite — Claude decides based on code quality
- Package name and install experience (gsdr, gsdr-cc, etc.)
- Command naming convention (/gsdr:* vs /gsd:* or other)
- How GSD commands map to Claude Code plugin skills format
- gsd-tools.cjs internals — keep, port to TS, or redesign as needed
- TypeScript configuration and build pipeline details
- Which GSD commands to port as-is vs redesign for GSDR's autonomous model

User explicitly skipped discussion — all Foundation decisions are at Claude's discretion. Make sensible defaults that support the downstream phases (Complexity Calibration, Front-Loaded Interaction, Dependency Graph Engine, Autonomous Execution).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants this phase to "just work" as infrastructure for the differentiating features in phases 2-5.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- GSD source at github.com/gsd-build/get-shit-done — fork base
- Existing agents/, bin/, commands/, hooks/, get-shit-done/, scripts/, tests/ structure

### Established Patterns
- gsd-tools.cjs handles deterministic operations (commits, config, state)
- Markdown-as-code workflows with path-only context passing
- Orchestrator/worker agent separation

### Integration Points
- npm package distribution (currently get-shit-done-cc)
- Claude Code ~/.claude/ directory structure for plugin installation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-15*
