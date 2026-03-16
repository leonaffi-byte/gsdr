---
name: update
description: "Update GSDR to latest version"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

<purpose>
Check for GSDR updates via npm, display changelog for versions between installed and latest, obtain user confirmation, and execute clean installation with cache clearing.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="get_installed_version">
Detect whether GSDR is installed locally or globally by checking both locations and validating install integrity:

```bash
# Check local first (takes priority only if valid)
# Claude Code only
LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR=""
if [ -f "./.claude/plugins/local/gsdr/VERSION" ]; then
  LOCAL_VERSION_FILE="./.claude/plugins/local/gsdr/VERSION"
  LOCAL_MARKER_FILE="./.claude/plugins/local/gsdr/skills/help/SKILL.md"
  LOCAL_DIR="$(cd "./.claude" 2>/dev/null && pwd)"
fi
GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR=""
if [ -f "$HOME/.claude/plugins/local/gsdr/VERSION" ]; then
  GLOBAL_VERSION_FILE="$HOME/.claude/plugins/local/gsdr/VERSION"
  GLOBAL_MARKER_FILE="$HOME/.claude/plugins/local/gsdr/skills/help/SKILL.md"
  GLOBAL_DIR="$(cd "$HOME/.claude" 2>/dev/null && pwd)"
fi

# Only treat as LOCAL if the resolved paths differ (prevents misdetection when CWD=$HOME)
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  if [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ]; then
    IS_LOCAL=true
  fi
fi

if [ "$IS_LOCAL" = true ]; then
  cat "$LOCAL_VERSION_FILE"
  echo "LOCAL"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  cat "$GLOBAL_VERSION_FILE"
  echo "GLOBAL"
else
  echo "UNKNOWN"
fi
```

Parse output:
- If last line is "LOCAL": local install is valid; installed version is first line; use `--local`
- If last line is "GLOBAL": local missing/invalid, global install is valid; installed version is first line; use `--global`
- If "UNKNOWN": proceed to install step (treat as version 0.0.0)

**If VERSION file missing:**
```
## GSDR Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

Proceed to install step (treat as version 0.0.0 for comparison).
</step>

<step name="check_latest_version">
Check npm for latest version:

```bash
npm view gsdr version 2>/dev/null
```

**If npm check fails:**
```
Couldn't check for updates (offline or npm unavailable).

To update manually: `npx gsdr --global`
```

Exit.
</step>

<step name="compare_versions">
Compare installed vs latest:

**If installed == latest:**
```
## GSDR Update

**Installed:** X.Y.Z
**Latest:** X.Y.Z

You're already on the latest version.
```

Exit.

**If installed > latest:**
```
## GSDR Update

**Installed:** X.Y.Z
**Latest:** A.B.C

You're ahead of the latest release (development version?).
```

Exit.
</step>

<step name="show_changes_and_confirm">
**If update available**, fetch and show what's new BEFORE updating:

1. Fetch changelog from GitHub raw URL
2. Extract entries between installed and latest versions
3. Display preview and ask for confirmation:

```
## GSDR Update Available

**Installed:** 1.5.10
**Latest:** 1.5.15

### What's New
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### Added
- Feature X

## [1.5.14] - 2026-01-18

### Fixed
- Bug fix Y

────────────────────────────────────────────────────────────

⚠️  **Note:** The installer performs a clean install of GSDR folders:
- `commands/gsdr/` will be wiped and replaced
- `skills/` will be wiped and replaced
- `agents/gsdr-*` files will be replaced

(Paths are relative to your plugin install location)

Your custom files in other locations are preserved:
- Custom commands not in `commands/gsdr/` ✓
- Custom agents not prefixed with `gsdr-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GSDR files directly, they'll be automatically backed up to `gsdr-local-patches/` and can be reapplied with `/gsdr:reapply-patches` after the update.
```

Use AskUserQuestion:
- Question: "Proceed with update?"
- Options:
  - "Yes, update now"
  - "No, cancel"

**If user cancels:** Exit.
</step>

<step name="run_update">
Run the update using the install type detected in step 1:

**If LOCAL install:**
```bash
npx -y gsdr@latest --local
```

**If GLOBAL install (or unknown):**
```bash
npx -y gsdr@latest --global
```

Capture output. If install fails, show error and exit.

Clear the update cache so statusline indicator disappears:

```bash
# Clear update cache (Claude Code only)
rm -f "./.claude/cache/gsdr-update-check.json"
rm -f "$HOME/.claude/cache/gsdr-update-check.json"
```

The SessionStart hook (`gsd-check-update.js`) writes to the detected runtime's cache directory, so all paths must be cleared to prevent stale update indicators.
</step>

<step name="display_result">
Format completion message (changelog was already shown in confirmation step):

```
╔═══════════════════════════════════════════════════════════╗
║  GSDR Updated: v1.5.10 → v1.5.15                           ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Restart Claude Code to pick up the new commands.

[View full changelog](https://github.com/leonaffi-byte/gsdr/blob/master/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
After update completes, check if the installer detected and backed up any locally modified files:

Check for gsdr-local-patches/backup-meta.json in the config directory.

**If patches found:**

```
Local patches were backed up before the update.
Run /gsdr:reapply-patches to merge your modifications into the new version.
```

**If no patches:** Continue normally.
</step>
</process>

<success_criteria>
- [ ] Installed version read correctly
- [ ] Latest version checked via npm
- [ ] Update skipped if already current
- [ ] Changelog fetched and displayed BEFORE update
- [ ] Clean install warning shown
- [ ] User confirmation obtained
- [ ] Update executed successfully
- [ ] Restart reminder shown
</success_criteria>
