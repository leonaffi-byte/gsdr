# Irreversible Actions Reference

Default list of irreversible action patterns that the execute-phase orchestrator scans for before spawning executor agents. These actions **ALWAYS** require human confirmation regardless of `auto_advance`, `_auto_chain_active`, or any other autonomy setting.

## Gate Principle

Irreversible actions prompt for confirmation unconditionally. No configuration flag, automation mode, or override can bypass this gate. The only way to skip a specific pattern is to add it to the `pre_approved_actions` list in `.planning/config.json`, which is an explicit user decision logged for auditability.

## Default Patterns

### Database Operations

| Pattern | Description |
|---------|-------------|
| `DROP DATABASE` | Destroys entire database |
| `DROP TABLE` | Destroys table and all data |
| `TRUNCATE` | Removes all rows from table without logging |
| `DELETE FROM` (without WHERE) | Removes all rows from table |

**Note:** `DELETE FROM ... WHERE ...` (with a WHERE clause) is NOT matched -- only unqualified DELETE FROM.

### Git Destructive Operations

| Pattern | Description |
|---------|-------------|
| `git push --force` | Overwrites remote history |
| `git push -f` | Short form of force push |
| `git reset --hard` | Discards all uncommitted changes |
| `git clean -f` | Deletes untracked files permanently |
| `git branch -D` | Force-deletes branch without merge check |

### Package Publishing

| Pattern | Description |
|---------|-------------|
| `npm publish` | Publishes package to npm registry |
| `yarn publish` | Publishes package to npm registry |
| `pnpm publish` | Publishes package to npm registry |

### Infrastructure

| Pattern | Description |
|---------|-------------|
| `rm -rf /` | Deletes entire filesystem |
| `rm -rf /*` | Deletes all top-level directories |
| `docker system prune` | Removes all unused Docker resources |
| `kubectl delete` | Deletes Kubernetes resources |

### Deployment

| Pattern | Description |
|---------|-------------|
| `deploy --prod` | Explicit production deployment |
| `push to production` | Production push command |
| `--production` (in deploy context) | Production-targeted deployment |

## Configuration

### Extending the Default List

Add custom irreversible action patterns via `.planning/config.json`:

```json
{
  "irreversible_actions": [
    "terraform destroy",
    "aws s3 rb --force",
    "heroku pg:reset"
  ]
}
```

Custom patterns are **added to** the defaults, not replacing them.

### Pre-Approving Actions

To bypass the gate for specific patterns (e.g., `npm publish` for a library project):

```json
{
  "pre_approved_actions": [
    "npm publish"
  ]
}
```

Pre-approved actions:
- Skip the confirmation prompt during execution
- Are logged in the end-of-run report for auditability
- Can be removed at any time to re-enable the gate

### Pattern Matching Rules

1. **Scan scope:** Only `<action>` blocks within PLAN.md files are scanned
2. **Comment filtering:** Lines starting with `#` or `//` are excluded from matching
3. **String literal filtering:** Content inside test assertion strings (e.g., `expect("git push --force")`) is excluded
4. **Case sensitivity:** Pattern matching is case-insensitive for SQL commands, case-sensitive for CLI commands
5. **Partial matching:** Patterns match as substrings -- `git push --force origin main` matches `git push --force`

## Gate UX

When an irreversible action is detected, the orchestrator presents:

```
+------------------------------------------+
|  IRREVERSIBLE ACTION DETECTED            |
|                                          |
|  Plan {plan_id} contains:               |
|  - `git push --force` (in action block) |
|  - `npm publish` (in action block)      |
|                                          |
|  These actions cannot be undone.         |
|  Proceed? [y/N]                          |
+------------------------------------------+
```

The executor agent is NOT spawned until the user confirms.
