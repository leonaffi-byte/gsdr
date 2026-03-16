# Failures Template

Template for `.planning/FAILURES.md` - persistent failure tracking during autonomous execution.

---

## File Template

```markdown
---
created: {timestamp}
updated: {timestamp}
total_failures: 0
resolved: 0
halted: 0
skipped: 0
---

# Failure Log

<!-- Entries appended by execute-phase orchestrator. Never written by executor agents. -->
```

---

## Entry Format

Each failure is tracked as a level-2 heading using the plan ID:

```markdown
## {plan_id}
- status: {active | resolved | halted | skipped_upstream_failure}
- error_signature: "{normalized error signature}"
- attempts:
  - attempt: 1
    timestamp: {ISO timestamp}
    error: "{raw error text}"
    diagnosis: "{root cause from debugger}"
    solution_tried: "{what the retry executor attempted}"
    result: {resolved | same_error | no_improvement | new_error}
- strike_count: {0-2}
- halted_reason: "{reason, if halted}"
- blocked_by: "{upstream plan_id, if skipped_upstream_failure}"
```

## Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `created` | ISO timestamp | When FAILURES.md was first created |
| `updated` | ISO timestamp | Last modification time |
| `total_failures` | number | Total failure entries (all statuses) |
| `resolved` | number | Count of entries with status: resolved |
| `halted` | number | Count of entries with status: halted |
| `skipped` | number | Count of entries with status: skipped_upstream_failure |

## Rules

1. **Orchestrator-only writes:** Only the execute-phase orchestrator writes to FAILURES.md. Executor agents NEVER write to this file directly. This prevents race conditions during parallel execution.
2. **Immediate persistence:** Each failure event writes to disk immediately. No batching. This ensures crash recovery.
3. **Frontmatter sync:** Update frontmatter counts after every entry change.
4. **Entry immutability:** Never delete entries. Update status and append attempts, but preserve full history.
