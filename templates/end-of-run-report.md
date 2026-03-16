# End-of-Run Report Template

Template for `.planning/END-OF-RUN-REPORT.md` - generated when an auto-advance chain or cross-phase milestone completes.

---

## File Template

```markdown
# GSDR End-of-Run Report

**Generated:** {timestamp}
**Milestone:** {milestone}
**Duration:** {duration}

## Summary

| Metric | Value |
|--------|-------|
| Phases completed | {phases_completed}/{phases_total} |
| Plans executed | {plans_executed}/{plans_total} |
| Auto-fixes applied | {auto_fixes} |
| Tasks needing attention | {needs_attention} |

## What Was Built

{built_sections}

## What Was Verified

{verified_sections}

## What Was Auto-Fixed

{auto_fixed_sections}

## What Needs Human Attention

{needs_attention_sections}
```

---

## Section Details

### What Was Built

Generated from SUMMARY.md files across all executed phases. For each phase, list the one-liner from each plan SUMMARY.md.

```markdown
### Phase {N}: {Name}
- **{plan_id}:** {one-liner from SUMMARY.md}
- **{plan_id}:** {one-liner from SUMMARY.md}
```

### What Was Verified

Generated from VERIFICATION.md files. For each phase, report verification status.

```markdown
### Phase {N}: {Name}
- **Status:** {passed | gaps_found | human_needed}
- **Score:** {N}/{M} must-haves verified
- **Human items:** {count, if any}
```

### What Was Auto-Fixed

Generated from FAILURES.md entries with `status: resolved`. For each resolved failure, show the diagnosis and fix.

```markdown
### {plan_id}: {plan_name}
- **Error:** {error_signature}
- **Root cause:** {diagnosis from final successful attempt}
- **Fix:** {solution_tried from final successful attempt}
- **Attempts:** {count}
```

If no auto-fixes occurred: "No failures required auto-fix intervention."

### What Needs Human Attention

Generated from FAILURES.md entries with `status: halted` or `status: skipped_upstream_failure`, plus VERIFICATION.md items with `human_needed` status.

```markdown
### Halted Failures
- **{plan_id}:** {halted_reason} (after {attempt_count} attempts)

### Skipped (Upstream Dependency)
- **{plan_id}:** Blocked by {blocked_by} which is {status}

### Human Verification Needed
- {items from VERIFICATION.md human_verification section}
```

If nothing needs attention: "All tasks completed successfully. No human intervention needed."

## Generation Rules

1. **When to generate:** Only when auto-advance chain completes final phase OR cross-phase mode (--milestone/--all) finishes all batches. NOT for single manual phase execution.
2. **Pre-approved irreversible actions:** If any pre-approved irreversible actions were bypassed during execution, list them in an "Audit Log" section for transparency.
3. **Commit:** The report is committed as part of the final execution artifacts.
