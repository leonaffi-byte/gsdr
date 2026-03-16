/**
 * Autonomous Execution Library -- Pure functions for autonomous execution logic
 * Covers error normalization, failure tracking (FAILURES.md CRUD), strike detection,
 * irreversible action matching, and end-of-run report generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { safeReadFile, output, error } from './core';

// ---- Types ----

export interface AttemptRecord {
  attempt: number;
  timestamp: string;
  error: string;
  diagnosis: string;
  solution_tried: string;
  result: 'resolved' | 'same_error' | 'no_improvement' | 'new_error';
}

export interface FailureEntry {
  plan_id: string;
  status: 'active' | 'resolved' | 'halted' | 'skipped_upstream_failure';
  error_signature: string;
  attempts: AttemptRecord[];
  strike_count: number;
  halted_reason?: string;
  blocked_by?: string;
}

interface FailuresFrontmatter {
  created: string;
  updated: string;
  total_failures: number;
  resolved: number;
  halted: number;
  skipped: number;
}

// ---- Error Signature Normalization ----

/**
 * Normalize error signatures for reliable comparison.
 * Strips variable parts: line numbers, file paths, timestamps, hex addresses, stack frames.
 */
export function normalizeErrorSignature(error: string): string {
  return error
    .replace(/:\d+:\d+/g, ':LINE:COL')                          // line:col numbers
    .replace(/at\s+.+\(.+\)/g, 'at STACK')                      // stack trace frames
    .replace(/\/[\w/.@-]+\.\w+/g, 'FILE')                       // file paths
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, 'TIMESTAMP')      // ISO timestamps
    .replace(/0x[0-9a-f]+/gi, 'ADDR')                           // hex addresses
    .trim();
}

// ---- FAILURES.md Serialization ----

function serializeEntry(entry: FailureEntry): string {
  const lines: string[] = [];
  lines.push(`## ${entry.plan_id}`);
  lines.push(`- status: ${entry.status}`);
  lines.push(`- error_signature: ${JSON.stringify(entry.error_signature)}`);
  lines.push(`- strike_count: ${entry.strike_count}`);
  if (entry.halted_reason) {
    lines.push(`- halted_reason: ${JSON.stringify(entry.halted_reason)}`);
  }
  if (entry.blocked_by) {
    lines.push(`- blocked_by: ${entry.blocked_by}`);
  }
  if (entry.attempts.length > 0) {
    lines.push(`- attempts:`);
    for (const a of entry.attempts) {
      lines.push(`  - attempt: ${a.attempt}`);
      lines.push(`    timestamp: ${a.timestamp}`);
      lines.push(`    error: ${JSON.stringify(a.error)}`);
      lines.push(`    diagnosis: ${JSON.stringify(a.diagnosis)}`);
      lines.push(`    solution_tried: ${JSON.stringify(a.solution_tried)}`);
      lines.push(`    result: ${a.result}`);
    }
  }
  return lines.join('\n');
}

function buildFrontmatter(entries: FailureEntry[], created?: string): string {
  const now = new Date().toISOString();
  const resolved = entries.filter(e => e.status === 'resolved').length;
  const halted = entries.filter(e => e.status === 'halted').length;
  const skipped = entries.filter(e => e.status === 'skipped_upstream_failure').length;

  return `---
created: ${created || now}
updated: ${now}
total_failures: ${entries.length}
resolved: ${resolved}
halted: ${halted}
skipped: ${skipped}
---`;
}

// ---- FAILURES.md CRUD ----

/**
 * Creates FAILURES.md with YAML frontmatter if it does not exist.
 * Appends new entry section to existing FAILURES.md.
 * Updates frontmatter counts.
 */
export function appendFailure(failuresPath: string, entry: FailureEntry): void {
  const existing = safeReadFile(failuresPath);

  if (!existing) {
    // Create new file
    const frontmatter = buildFrontmatter([entry]);
    const content = `${frontmatter}\n\n# Failure Log\n\n${serializeEntry(entry)}\n`;
    fs.writeFileSync(failuresPath, content, 'utf-8');
    return;
  }

  // Parse existing entries and add new one
  const parsed = readFailures(failuresPath);
  parsed.entries.push(entry);

  // Rebuild entire file
  const created = parsed.frontmatter.created || new Date().toISOString();
  const frontmatter = buildFrontmatter(parsed.entries, created);
  const body = parsed.entries.map(e => serializeEntry(e)).join('\n\n');
  const content = `${frontmatter}\n\n# Failure Log\n\n${body}\n`;
  fs.writeFileSync(failuresPath, content, 'utf-8');
}

/**
 * Parses FAILURES.md frontmatter and all entry sections.
 * Returns empty entries array if file does not exist.
 * Handles malformed entries gracefully (skips, does not crash).
 */
export function readFailures(failuresPath: string): { frontmatter: FailuresFrontmatter; entries: FailureEntry[] } {
  const defaultFm: FailuresFrontmatter = {
    created: '',
    updated: '',
    total_failures: 0,
    resolved: 0,
    halted: 0,
    skipped: 0,
  };

  const content = safeReadFile(failuresPath);
  if (!content) {
    return { frontmatter: defaultFm, entries: [] };
  }

  // Parse frontmatter
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  const fm: FailuresFrontmatter = { ...defaultFm };
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const kv = line.match(/^(\w+):\s*(.+)/);
      if (kv) {
        const key = kv[1] as keyof FailuresFrontmatter;
        const val = kv[2].trim();
        if (key === 'created' || key === 'updated') {
          fm[key] = val;
        } else if (key in fm) {
          (fm as Record<string, unknown>)[key] = parseInt(val, 10) || 0;
        }
      }
    }
  }

  // Parse entries -- split by ## headings
  const entries: FailureEntry[] = [];
  const entryPattern = /^## (.+)$/gm;
  let match: RegExpExecArray | null;
  const positions: { planId: string; start: number }[] = [];

  while ((match = entryPattern.exec(content)) !== null) {
    positions.push({ planId: match[1].trim(), start: match.index + match[0].length });
  }

  for (let i = 0; i < positions.length; i++) {
    const { planId, start } = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].start - positions[i + 1].planId.length - 3 : content.length;
    const section = content.slice(start, end).trim();

    try {
      const entry = parseEntrySection(planId, section);
      if (entry) entries.push(entry);
    } catch {
      // Skip malformed entries
    }
  }

  return { frontmatter: fm, entries };
}

function parseEntrySection(planId: string, section: string): FailureEntry | null {
  const statusMatch = section.match(/^- status:\s*(.+)/m);
  const sigMatch = section.match(/^- error_signature:\s*(.+)/m);
  const strikeMatch = section.match(/^- strike_count:\s*(\d+)/m);
  const haltedMatch = section.match(/^- halted_reason:\s*(.+)/m);
  const blockedMatch = section.match(/^- blocked_by:\s*(.+)/m);

  const status = statusMatch ? statusMatch[1].trim() : 'active';
  const errorSig = sigMatch ? stripQuotes(sigMatch[1].trim()) : '';
  const strikeCount = strikeMatch ? parseInt(strikeMatch[1], 10) : 0;
  const haltedReason = haltedMatch ? stripQuotes(haltedMatch[1].trim()) : undefined;
  const blockedBy = blockedMatch ? blockedMatch[1].trim() : undefined;

  // Parse attempts
  const attempts: AttemptRecord[] = [];
  const attemptBlocks = section.split(/\n\s{2}- attempt:\s*/);
  for (let i = 1; i < attemptBlocks.length; i++) {
    const block = attemptBlocks[i];
    const attemptNum = parseInt(block.match(/^(\d+)/)?.[1] || '0', 10);
    const ts = block.match(/timestamp:\s*(.+)/)?.[1]?.trim() || '';
    const err = stripQuotes(block.match(/error:\s*(.+)/)?.[1]?.trim() || '');
    const diag = stripQuotes(block.match(/diagnosis:\s*(.+)/)?.[1]?.trim() || '');
    const sol = stripQuotes(block.match(/solution_tried:\s*(.+)/)?.[1]?.trim() || '');
    const res = block.match(/result:\s*(.+)/)?.[1]?.trim() || 'same_error';

    attempts.push({
      attempt: attemptNum,
      timestamp: ts,
      error: err,
      diagnosis: diag,
      solution_tried: sol,
      result: res as AttemptRecord['result'],
    });
  }

  return {
    plan_id: planId,
    status: status as FailureEntry['status'],
    error_signature: errorSig,
    attempts,
    strike_count: strikeCount,
    halted_reason: haltedReason,
    blocked_by: blockedBy,
  };
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Updates an existing entry's status field.
 * Appends new attempt record if provided.
 * Recalculates frontmatter counts.
 */
export function updateFailureStatus(
  failuresPath: string,
  planId: string,
  status: string,
  attemptRecord?: AttemptRecord,
): void {
  const { frontmatter, entries } = readFailures(failuresPath);
  const entry = entries.find(e => e.plan_id === planId);
  if (!entry) return;

  entry.status = status as FailureEntry['status'];
  if (attemptRecord) {
    entry.attempts.push(attemptRecord);
  }

  // Rebuild file
  const fm = buildFrontmatter(entries, frontmatter.created);
  const body = entries.map(e => serializeEntry(e)).join('\n\n');
  const content = `${fm}\n\n# Failure Log\n\n${body}\n`;
  fs.writeFileSync(failuresPath, content, 'utf-8');
}

// ---- Strike Detection ----

/**
 * Determines if a retry attempt is non-improving.
 * Per user decision: "same error signature OR no test improvement -- either counts as a strike"
 *
 * Returns true if:
 * - Normalized error signatures match (same_error)
 * - currAttempt.result is 'no_improvement'
 *
 * Returns false if:
 * - Error signature changed AND result is not 'no_improvement' (new_error with test improvement)
 * - Result is 'resolved'
 */
export function isNonImproving(
  _prevAttempt: AttemptRecord,
  currAttempt: AttemptRecord,
  normalizedPrevError: string,
  normalizedCurrError: string,
): boolean {
  // Resolved is never non-improving
  if (currAttempt.result === 'resolved') return false;

  // Same error signature = non-improving
  if (normalizedPrevError === normalizedCurrError) return true;

  // No test improvement = non-improving even if error changed
  if (currAttempt.result === 'no_improvement') return true;

  // Different error and not no_improvement = making progress
  return false;
}

// ---- Irreversible Action Detection ----

/**
 * Scans action content for irreversible Bash command patterns.
 * Merges defaultPatterns with configOverrides (overrides extend, not replace).
 * Ignores patterns inside code comments or string literals in test assertions.
 */
export function checkIrreversibleAction(
  actionContent: string,
  defaultPatterns: string[],
  configOverrides?: string[],
): { matched: boolean; matches: string[] } {
  const allPatterns = [...defaultPatterns, ...(configOverrides || [])];
  const matches: string[] = [];

  // Process line by line to skip comments and string literals
  const lines = actionContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Skip lines that are inside string literals (test assertions)
    if (/(?:expect|assert|toBe|toEqual|toContain|toMatch)\s*\(/.test(trimmed)) continue;
    if (/['"`].*['"`]/.test(trimmed) && !trimmed.match(/^\s*(?:git|npm|yarn|pnpm|rm|docker|kubectl|drop|truncate|delete|terraform)/i)) {
      // Line appears to be a string literal context, not an actual command
      // Only skip if the line doesn't start with a command-like pattern
      continue;
    }

    for (const pattern of allPatterns) {
      // SQL keywords are case-insensitive
      const sqlKeywords = ['DROP TABLE', 'TRUNCATE', 'DELETE FROM'];
      const isSql = sqlKeywords.some(kw => pattern.toUpperCase() === kw);

      let regex: RegExp;
      if (isSql) {
        regex = new RegExp(escapeRegexStr(pattern), 'i');
      } else {
        regex = new RegExp(escapeRegexStr(pattern));
      }

      if (regex.test(trimmed) && !matches.includes(pattern)) {
        matches.push(pattern);
      }
    }
  }

  return { matched: matches.length > 0, matches };
}

function escapeRegexStr(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- End-of-Run Report Generation ----

/**
 * Generates end-of-run report by reading SUMMARY.md, FAILURES.md, and VERIFICATION.md files.
 * Produces markdown report with sections: Summary table, What Was Built,
 * What Was Verified, What Was Auto-Fixed, What Needs Human Attention.
 */
export function generateEndOfRunReport(cwd: string, milestone: string): string {
  const planningDir = path.join(cwd, '.planning');
  const phasesDir = path.join(planningDir, 'phases');

  // Collect SUMMARY.md files
  const summaries: { phase: string; planId: string; content: string }[] = [];
  // Collect VERIFICATION.md files
  const verifications: { phase: string; content: string }[] = [];

  let totalPlans = 0;
  let completedPlans = 0;
  let phasesCompleted = 0;
  let totalPhases = 0;

  if (fs.existsSync(phasesDir)) {
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    totalPhases = phaseDirs.length;

    for (const dir of phaseDirs) {
      const dirPath = path.join(phasesDir, dir);
      const files = fs.readdirSync(dirPath);
      const planFiles = files.filter(f => f.endsWith('-PLAN.md'));
      const summaryFiles = files.filter(f => f.endsWith('-SUMMARY.md'));
      const verificationFiles = files.filter(f => f.includes('VERIFICATION'));

      totalPlans += planFiles.length;
      completedPlans += summaryFiles.length;
      if (planFiles.length > 0 && summaryFiles.length >= planFiles.length) {
        phasesCompleted++;
      }

      for (const sf of summaryFiles) {
        const content = safeReadFile(path.join(dirPath, sf)) || '';
        summaries.push({ phase: dir, planId: sf.replace('-SUMMARY.md', ''), content });
      }

      for (const vf of verificationFiles) {
        const content = safeReadFile(path.join(dirPath, vf)) || '';
        verifications.push({ phase: dir, content });
      }
    }
  }

  // Read FAILURES.md
  const failuresPath = path.join(planningDir, 'FAILURES.md');
  const { entries: failureEntries } = readFailures(failuresPath);

  const autoFixed = failureEntries.filter(e => e.status === 'resolved');
  const needsAttention = failureEntries.filter(e => e.status === 'halted' || e.status === 'skipped_upstream_failure');

  // Build report
  const lines: string[] = [];
  lines.push('# GSDR End-of-Run Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Milestone:** ${milestone}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Phases completed | ${phasesCompleted}/${totalPhases} |`);
  lines.push(`| Plans executed | ${completedPlans}/${totalPlans} |`);
  lines.push(`| Auto-fixes applied | ${autoFixed.length} |`);
  lines.push(`| Tasks needing attention | ${needsAttention.length} |`);
  lines.push('');

  // What Was Built
  lines.push('## What Was Built');
  lines.push('');
  if (summaries.length === 0) {
    lines.push('No summaries found.');
  } else {
    let currentPhase = '';
    for (const s of summaries) {
      if (s.phase !== currentPhase) {
        currentPhase = s.phase;
        lines.push(`### ${s.phase}`);
      }
      // Extract one-liner from summary content (first non-frontmatter, non-heading line)
      const bodyLines = s.content.replace(/^---[\s\S]*?---\n*/, '').split('\n');
      const oneLiner = bodyLines.find(l => l.trim() && !l.startsWith('#')) || s.planId;
      lines.push(`- **${s.planId}:** ${oneLiner.trim()}`);
    }
  }
  lines.push('');

  // What Was Verified
  lines.push('## What Was Verified');
  lines.push('');
  if (verifications.length === 0) {
    lines.push('No verification reports found.');
  } else {
    for (const v of verifications) {
      lines.push(`- **${v.phase}:** Verification report available`);
    }
  }
  lines.push('');

  // What Was Auto-Fixed
  lines.push('## What Was Auto-Fixed');
  lines.push('');
  if (autoFixed.length === 0) {
    lines.push('No auto-fixes were needed.');
  } else {
    for (const f of autoFixed) {
      const lastAttempt = f.attempts[f.attempts.length - 1];
      lines.push(`- **${f.plan_id}** (resolved): ${lastAttempt?.diagnosis || f.error_signature}`);
    }
  }
  lines.push('');

  // What Needs Human Attention
  lines.push('## What Needs Human Attention');
  lines.push('');
  if (needsAttention.length === 0) {
    lines.push('No items need human attention.');
  } else {
    for (const f of needsAttention) {
      if (f.status === 'halted') {
        lines.push(`- **${f.plan_id}** (halted): ${f.halted_reason || 'Max retries exceeded'}`);
      } else if (f.status === 'skipped_upstream_failure') {
        lines.push(`- **${f.plan_id}** (skipped): Blocked by ${f.blocked_by || 'upstream failure'}`);
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ---- CLI Command Wrappers ----

/**
 * CLI wrapper for normalizeErrorSignature.
 */
export function cmdNormalizeError(errorString: string, raw: boolean): void {
  if (!errorString) error('error string required');
  const normalized = normalizeErrorSignature(errorString);
  output({ normalized }, raw, normalized);
}

/**
 * CLI wrapper for appendFailure.
 */
export function cmdAppendFailure(failuresPath: string, entryJson: string, raw: boolean): void {
  if (!failuresPath) error('--path required');
  if (!entryJson) error('--entry required');
  let entry: FailureEntry;
  try {
    entry = JSON.parse(entryJson) as FailureEntry;
  } catch {
    error('Invalid JSON for --entry');
  }
  appendFailure(failuresPath, entry!);
  output({ success: true }, raw, 'ok');
}

/**
 * CLI wrapper for readFailures.
 */
export function cmdReadFailures(failuresPath: string, raw: boolean): void {
  if (!failuresPath) error('--path required');
  const result = readFailures(failuresPath);
  output(result, raw, JSON.stringify(result));
}

/**
 * CLI wrapper for updateFailureStatus.
 */
export function cmdUpdateFailureStatus(
  failuresPath: string,
  planId: string,
  status: string,
  attemptJson: string | null,
  raw: boolean,
): void {
  if (!failuresPath) error('--path required');
  if (!planId) error('--plan-id required');
  if (!status) error('--status required');
  let attempt: AttemptRecord | undefined;
  if (attemptJson) {
    try {
      attempt = JSON.parse(attemptJson) as AttemptRecord;
    } catch {
      error('Invalid JSON for --attempt');
    }
  }
  updateFailureStatus(failuresPath, planId, status, attempt);
  output({ success: true }, raw, 'ok');
}

/**
 * CLI wrapper for isNonImproving.
 */
export function cmdIsNonImproving(
  prevJson: string,
  currJson: string,
  prevSig: string,
  currSig: string,
  raw: boolean,
): void {
  if (!prevJson) error('--prev required');
  if (!currJson) error('--curr required');
  if (!prevSig) error('--prev-sig required');
  if (!currSig) error('--curr-sig required');
  let prev: AttemptRecord;
  let curr: AttemptRecord;
  try {
    prev = JSON.parse(prevJson) as AttemptRecord;
  } catch {
    error('Invalid JSON for --prev');
  }
  try {
    curr = JSON.parse(currJson) as AttemptRecord;
  } catch {
    error('Invalid JSON for --curr');
  }
  const result = isNonImproving(prev!, curr!, prevSig, currSig);
  output({ non_improving: result }, raw, String(result));
}

/**
 * CLI wrapper for checkIrreversibleAction.
 * Reads file content from --content-file, loads default patterns from references/irreversible-actions.md if --patterns not provided.
 */
export function cmdCheckIrreversible(
  cwd: string,
  opts: { contentFile: string | null; patterns: string[] | null; overrides: string[] | null },
  raw: boolean,
): void {
  // Read action content from file
  let actionContent = '';
  if (opts.contentFile) {
    const filePath = path.isAbsolute(opts.contentFile) ? opts.contentFile : path.join(cwd, opts.contentFile);
    const content = safeReadFile(filePath);
    if (!content) error(`Cannot read content file: ${opts.contentFile}`);
    actionContent = content!;
  }

  // Load default patterns from references/irreversible-actions.md if not provided
  let patterns: string[] = opts.patterns || [];
  if (patterns.length === 0) {
    const refPath = path.join(__dirname, '..', 'references', 'irreversible-actions.md');
    const refContent = safeReadFile(refPath);
    if (refContent) {
      // Extract patterns from table rows: | `pattern` | description |
      const patternMatches = refContent.match(/\|\s*`([^`]+)`\s*\|/g);
      if (patternMatches) {
        patterns = patternMatches.map(m => {
          const match = m.match(/`([^`]+)`/);
          return match ? match[1] : '';
        }).filter(Boolean);
      }
    }
  }

  const result = checkIrreversibleAction(actionContent, patterns, opts.overrides || undefined);
  output(result, raw, JSON.stringify(result));
}

/**
 * CLI wrapper for generateEndOfRunReport.
 */
export function cmdGenerateReport(cwd: string, milestone: string, raw: boolean): void {
  if (!milestone) error('--milestone required');
  const report = generateEndOfRunReport(cwd, milestone);
  output({ report }, raw, report);
}
