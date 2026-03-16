---
name: gsdr:reapply-patches
description: "Reapply local patches after GSDR update"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

<purpose>
Reapply locally modified GSDR files that were backed up during an update. The installer detects modified files, backs them up to gsdr-local-patches/, and this command merges those modifications into the new version.
</purpose>

<process>

<step name="find_patches">
Check for backed-up patches:

```bash
PATCHES_DIR=""
if [ -d "./.claude/gsdr-local-patches" ]; then
  PATCHES_DIR="./.claude/gsdr-local-patches"
elif [ -d "$HOME/.claude/gsdr-local-patches" ]; then
  PATCHES_DIR="$HOME/.claude/gsdr-local-patches"
fi

if [ -z "$PATCHES_DIR" ] || [ ! -f "$PATCHES_DIR/backup-meta.json" ]; then
  echo "No local patches found. Nothing to reapply."
  exit 0
fi

cat "$PATCHES_DIR/backup-meta.json"
```

Parse backup-meta.json for list of modified files and their original/new paths.
</step>

<step name="show_patches">
Display what was backed up:

```
## Local Patches Found

| File | Status |
|------|--------|
| [file1] | Modified before update |
| [file2] | Modified before update |

These files were backed up before the last GSDR update.
```
</step>

<step name="reapply">
For each backed-up file:

1. Read the backed-up version (old modification)
2. Read the current version (new from update)
3. Identify the user modifications (diff between original and modified)
4. Apply modifications to the new version where possible
5. Report conflicts that need manual resolution

```
Reapplying patches...

- [file1]: Applied successfully
- [file2]: Conflict -- manual review needed
```
</step>

<step name="cleanup">
After successful reapply:

```bash
rm -rf "$PATCHES_DIR"
```

Report completion.
</step>

</process>

<success_criteria>
- [ ] Patch directory found and read
- [ ] Each patch file examined
- [ ] Compatible patches reapplied
- [ ] Conflicts reported for manual resolution
- [ ] Patch directory cleaned up
</success_criteria>
