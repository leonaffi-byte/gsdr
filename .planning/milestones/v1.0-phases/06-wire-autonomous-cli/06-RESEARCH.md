# Phase 6: Wire Autonomous Library to CLI - Research

**Researched:** 2026-03-16
**Domain:** CLI integration / TypeScript module wiring / esbuild bundling
**Confidence:** HIGH

## Summary

Phase 6 is a gap-closure phase that bridges the disconnect between the `autonomous.ts` pure function library (created in Phase 5 Plan 01, with 6 exported functions and 32 tests) and the CLI router (`src/index.ts`). Currently, the execute-phase SKILL.md orchestrator describes autonomous behaviors in prose (auto-fix loops, failure tracking, irreversible action gates, report generation), but these are re-implemented by the LLM at runtime rather than calling deterministic TypeScript functions. The CLI router has zero imports from `autonomous.ts`.

The gap is narrow and well-defined: add CLI commands that expose each autonomous.ts function, import the module in src/index.ts, and update the execute-phase SKILL.md to call the CLI commands instead of re-implementing the logic from prose. The esbuild config already bundles all of `src/` into a single CJS file with no external exclusions, so adding the import is sufficient for bundling.

**Primary recommendation:** Add 6-7 CLI subcommands under a new `autonomous` top-level command (e.g., `autonomous normalize-error`, `autonomous append-failure`, etc.), then update SKILL.md to call these commands where it currently describes the logic in prose.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-05 | Auto-fix failures with up to 3 retry attempts, tracking attempted solutions | CLI commands for `appendFailure`, `updateFailureStatus`, `readFailures`, `normalizeErrorSignature` enable deterministic failure tracking |
| AUTO-06 | Two-strike halt rule: stop auto-fix after 2 consecutive non-improving attempts | CLI command for `isNonImproving` enables deterministic strike detection |
| AUTO-07 | Failure escalation: continue independent tasks, queue failures for end report | CLI commands for `readFailures` and `updateFailureStatus` enable deterministic failure escalation |
| AUTO-08 | End-of-run summary report | CLI command for `generateEndOfRunReport` enables deterministic report generation |
| AUTO-09 | Irreversible action gate: always require human confirmation | CLI command for `checkIrreversibleAction` enables deterministic pattern matching |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.0 | Source language | Already in project |
| esbuild | ^0.24.0 | Bundle to CJS | Already in project, config at esbuild.config.mjs |
| vitest | ^3.0.0 | Test framework | Already in project |

### Supporting
No new libraries needed. This phase only wires existing code into existing infrastructure.

## Architecture Patterns

### Existing CLI Router Pattern (from src/index.ts)

The CLI router uses a `switch` statement on `command` (first arg). Complex commands use subcommands (e.g., `state json`, `state update`, `verify plan-structure`). The pattern is:

```typescript
case 'command-name': {
  const subcommand = args[1];
  if (subcommand === 'sub1') {
    module.cmdSub1(cwd, args[2], raw);
  } else if (subcommand === 'sub2') {
    module.cmdSub2(cwd, args[2], args[3], raw);
  } else {
    error('Unknown subcommand. Available: sub1, sub2');
  }
  break;
}
```

Every `cmd*` function follows the signature pattern: `(cwd: string, ...specificArgs, raw: boolean): void`. They use `output(result, raw, rawValue)` from core.ts for JSON/raw output.

### Recommended: New `autonomous` Command Group

Add a top-level `autonomous` case to the switch with subcommands:

```
autonomous normalize-error "<error_string>"
autonomous append-failure --path <path> --entry <json>
autonomous read-failures --path <path>
autonomous update-status --path <path> --plan-id <id> --status <status> [--attempt <json>]
autonomous is-non-improving --prev <json> --curr <json> --prev-sig <string> --curr-sig <string>
autonomous check-irreversible --content-file <path> --patterns <json> [--overrides <json>]
autonomous generate-report --milestone <name>
```

### How SKILL.md Should Reference CLI Commands

Currently SKILL.md describes logic in prose like "Normalize error signatures" and "Check both signals: Same normalized error signature? Strike." These should become:

```bash
# Instead of LLM re-implementing normalizeErrorSignature logic:
NORMALIZED=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous normalize-error "$ERROR_STRING" --raw)

# Instead of LLM re-implementing isNonImproving logic:
IS_STRIKE=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous is-non-improving --prev-sig "$PREV_SIG" --curr-sig "$CURR_SIG" --curr-result "$CURR_RESULT" --raw)

# Instead of LLM re-implementing checkIrreversibleAction:
GATE_RESULT=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous check-irreversible --content-file "$PLAN_FILE" --raw)

# Instead of LLM re-implementing report generation:
node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous generate-report --milestone "$MILESTONE" --raw > .planning/END-OF-RUN-REPORT.md
```

### esbuild Bundling (No Changes Needed)

The `esbuild.config.mjs` bundles `src/index.ts` as the single entry point with `external: []` (no externals). Since `autonomous.ts` is already in `src/lib/`, adding `import * as autonomous from './lib/autonomous'` to `src/index.ts` is sufficient -- esbuild will tree-shake and bundle it automatically.

```javascript
// esbuild.config.mjs -- no changes needed
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/gsdr-tools.cjs',
  external: [],  // everything bundled
});
```

### Project Structure (Files Modified)

```
src/
  index.ts              # Add import + switch case for 'autonomous' command
  lib/
    autonomous.ts       # Add cmd* wrapper functions (existing pure functions stay)
skills/
  execute-phase/
    SKILL.md            # Update auto_fix_loop, irreversible gate, report generation to use CLI
tests/
  autonomous-execution.test.ts  # Existing 32 tests (no changes needed)
  build.test.ts                 # May need to verify autonomous module is in bundle
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error normalization | LLM regex in SKILL.md prose | `autonomous normalize-error` CLI | Deterministic, tested with 8 test cases |
| Strike detection | LLM if/else in SKILL.md prose | `autonomous is-non-improving` CLI | Two-signal logic already verified by 4 tests |
| Irreversible scanning | LLM pattern matching in SKILL.md | `autonomous check-irreversible` CLI | Comment/string-literal filtering already handles edge cases |
| FAILURES.md CRUD | LLM file manipulation in SKILL.md | `autonomous append-failure` / `update-status` / `read-failures` CLI | Frontmatter recalculation, entry parsing already tested |
| Report generation | LLM assembling markdown in SKILL.md | `autonomous generate-report` CLI | Filesystem scanning, cross-referencing already tested |

**Key insight:** Every function in autonomous.ts was written with TDD (32 tests). Having the LLM re-implement this logic from prose means those tests protect nothing at runtime. Wiring to CLI makes the tests relevant.

## Common Pitfalls

### Pitfall 1: JSON Argument Parsing for Complex Types
**What goes wrong:** FailureEntry and AttemptRecord are complex objects that need to be passed as CLI args.
**Why it happens:** CLI args are strings; nested objects need serialization.
**How to avoid:** Use `--entry '{"plan_id":"03-01",...}'` with `JSON.parse()` in the cmd wrapper. The SKILL.md already uses JSON in other commands (e.g., `frontmatter merge --data '{}'``).
**Warning signs:** Escaped quotes breaking on Windows shells.

### Pitfall 2: SKILL.md Prose Drift
**What goes wrong:** After wiring to CLI, residual prose in SKILL.md still describes the algorithmic logic, causing the LLM to sometimes re-implement instead of calling CLI.
**Why it happens:** Partial update of SKILL.md -- adding CLI calls but leaving the prose descriptions.
**How to avoid:** Replace prose algorithmic descriptions with CLI call instructions. Keep ONLY the conceptual explanation ("what it does") and the CLI invocation ("how to do it"). Remove step-by-step algorithmic instructions.
**Warning signs:** SKILL.md still contains "Normalize error signatures using..." instead of "Call autonomous normalize-error".

### Pitfall 3: Content-File vs Inline for Large Content
**What goes wrong:** Passing plan file content as a CLI argument for irreversible action checking hits shell argument length limits.
**Why it happens:** Plan files can be thousands of characters.
**How to avoid:** Use `--content-file <path>` instead of `--content "<string>"`. The cmd wrapper reads the file.
**Warning signs:** "Argument list too long" errors on Linux/macOS.

### Pitfall 4: Forgetting to Rebuild After Changes
**What goes wrong:** CLI changes in src/ don't take effect because dist/gsdr-tools.cjs is stale.
**Why it happens:** No watch mode; manual `npm run build` required.
**How to avoid:** Run `npm run build` after every src/ change. The test suite imports from src/ directly (not dist/), so tests pass even with stale builds.
**Warning signs:** Tests pass but CLI invocations fail.

### Pitfall 5: Output Format Consistency
**What goes wrong:** New cmd functions output differently from existing ones (e.g., missing `--raw` support).
**Why it happens:** Not following the established `output(result, raw, rawValue)` pattern.
**How to avoid:** Every cmd* wrapper must accept `raw: boolean` and use `output()` from core.ts. JSON output for structured data, raw string for `--raw` flag.
**Warning signs:** SKILL.md parsing breaks because output format is inconsistent.

## Code Examples

### Pattern: Adding a cmd* Wrapper to autonomous.ts

```typescript
// Source: Follows pattern from src/lib/commands.ts cmdGenerateSlug
import { output, error } from './core';

export function cmdNormalizeError(errorString: string, raw: boolean): void {
  if (!errorString) {
    error('error string required');
  }
  const normalized = normalizeErrorSignature(errorString);
  output({ normalized }, raw, normalized);
}
```

### Pattern: CLI Router Case for Autonomous Commands

```typescript
// Source: Follows pattern from src/index.ts 'state' case
import * as autonomous from './lib/autonomous';

case 'autonomous': {
  const subcommand = args[1];
  if (subcommand === 'normalize-error') {
    autonomous.cmdNormalizeError(args[2], raw);
  } else if (subcommand === 'check-irreversible') {
    // --content-file reads file, --patterns and --overrides are JSON arrays
    const contentFileIdx = args.indexOf('--content-file');
    const patternsIdx = args.indexOf('--patterns');
    const overridesIdx = args.indexOf('--overrides');
    autonomous.cmdCheckIrreversible(cwd, {
      contentFile: contentFileIdx !== -1 ? args[contentFileIdx + 1] : null,
      patterns: patternsIdx !== -1 ? JSON.parse(args[patternsIdx + 1]) : null,
      overrides: overridesIdx !== -1 ? JSON.parse(args[overridesIdx + 1]) : null,
    }, raw);
  }
  // ... more subcommands
  break;
}
```

### Pattern: SKILL.md CLI Invocation (Replacing Prose)

```bash
# Before (Phase 5 - LLM re-implements logic from prose):
# "Normalize error signatures. Check both signals:
#  Same normalized error signature? Strike.
#  No test improvement? Strike."

# After (Phase 6 - deterministic CLI call):
PREV_SIG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous normalize-error "$PREV_ERROR" --raw)
CURR_SIG=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous normalize-error "$CURR_ERROR" --raw)
IS_STRIKE=$(node "${CLAUDE_SKILL_DIR}/../dist/gsdr-tools.cjs" autonomous is-non-improving \
  --prev-sig "$PREV_SIG" --curr-sig "$CURR_SIG" --curr-result "$CURR_RESULT" --raw)
if [ "$IS_STRIKE" = "true" ]; then
  # increment strike count, check >= 2 for halt
fi
```

## State of the Art

| Old Approach (Phase 5) | New Approach (Phase 6) | Impact |
|-------------------------|------------------------|--------|
| SKILL.md describes algorithmic logic in prose | SKILL.md calls CLI commands that execute deterministic code | Eliminates LLM interpretation variability |
| autonomous.ts tests protect library code only | Tests protect actual runtime behavior via CLI | Test coverage becomes meaningful at runtime |
| LLM must understand normalizeErrorSignature regex chain | CLI returns deterministic result | Consistent behavior regardless of LLM context |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | Implicit (package.json `scripts.test`) |
| Quick run command | `npx vitest run tests/autonomous-execution.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-05 | CLI exposes failure tracking (append, read, update) | integration | `npx vitest run tests/autonomous-execution.test.ts -t "appendFailure"` | Existing (library tests) |
| AUTO-06 | CLI exposes strike detection | integration | `npx vitest run tests/autonomous-execution.test.ts -t "isNonImproving"` | Existing (library tests) |
| AUTO-07 | CLI exposes failure reading for escalation | integration | `npx vitest run tests/autonomous-execution.test.ts -t "readFailures"` | Existing (library tests) |
| AUTO-08 | CLI exposes report generation | integration | `npx vitest run tests/autonomous-execution.test.ts -t "generateEndOfRunReport"` | Existing (library tests) |
| AUTO-09 | CLI exposes irreversible action checking | integration | `npx vitest run tests/autonomous-execution.test.ts -t "checkIrreversibleAction"` | Existing (library tests) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `tests/build.test.ts` -- may need a test verifying autonomous module is included in CJS bundle (check existing build tests first)
- [ ] CLI integration tests for the new `autonomous` subcommands -- optional since pure functions are already thoroughly tested; the cmd wrappers are thin

*(The existing 32 tests in autonomous-execution.test.ts cover all pure function logic. The cmd wrappers are thin JSON-parsing shells that follow the established pattern.)*

## Open Questions

1. **Subcommand naming convention**
   - What we know: Other commands use kebab-case (e.g., `dependency-graph`, `classify-complexity`, `verify-path-exists`)
   - What's unclear: Whether to use `autonomous` as top-level or flatten (e.g., `normalize-error`, `check-irreversible` as top-level commands)
   - Recommendation: Use `autonomous` as a command group with subcommands, matching the `state`, `verify`, `frontmatter` pattern for related operations

2. **How much SKILL.md prose to replace**
   - What we know: The auto_fix_loop, irreversible gate, and report generation steps all describe logic that autonomous.ts implements
   - What's unclear: Whether to replace ALL prose with CLI calls or keep some prose for LLM context
   - Recommendation: Replace algorithmic instructions with CLI calls. Keep conceptual descriptions ("why") but remove implementation details ("how"). The LLM needs to understand intent but should not re-implement tested logic.

3. **Content passing for checkIrreversibleAction**
   - What we know: Plan files can be large; shell arg limits exist
   - What's unclear: Whether to pass content via file path or stdin
   - Recommendation: Use `--content-file <path>` -- the cmd wrapper reads the file. This matches the existing pattern where CLI commands accept file paths rather than content.

## Sources

### Primary (HIGH confidence)
- `src/lib/autonomous.ts` -- all 6 exported functions, their signatures, and behavior
- `src/index.ts` -- CLI router pattern with 20+ existing command groups
- `tests/autonomous-execution.test.ts` -- 32 tests confirming function behavior
- `esbuild.config.mjs` -- bundling config showing all src/ is included
- `skills/execute-phase/SKILL.md` -- 776-line orchestrator with prose descriptions to wire
- `package.json` -- build/test scripts

### Secondary (MEDIUM confidence)
- `.planning/phases/05-autonomous-execution/05-02-SUMMARY.md` -- confirms Phase 5 wired prose only
- `.planning/phases/05-autonomous-execution/05-VERIFICATION.md` -- confirms INT-01 gap exists

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, existing project patterns
- Architecture: HIGH - follows established CLI router pattern exactly
- Pitfalls: HIGH - based on direct codebase analysis
- Validation: HIGH - existing test infrastructure covers all functions

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- internal project wiring, no external dependencies)
