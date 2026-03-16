
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import type {
  GsdrConfig,
  GsdrConfigFile,
  GitResult,
  ModelProfile,
  MilestoneInfo,
  PhaseInfo,
  RoadmapPhaseInfo,
  ArchivedPhaseDir,
} from '../types';

// ---- Path helpers ----

/** Normalize a path to always use forward slashes (cross-platform). */
export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

// ---- Model Profile Table ----

export const MODEL_PROFILES: Record<string, ModelProfile> = {
  'gsdr-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'gsdr-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsdr-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsdr-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsdr-project-researcher':   { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsdr-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsdr-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsdr-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
  'gsdr-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsdr-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsdr-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsdr-nyquist-auditor':      { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

// ---- Output helpers ----

export function output(result: unknown, raw?: boolean, rawValue?: string): void {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    // Large payloads exceed Claude Code's Bash tool buffer (~50KB).
    // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
    if (json.length > 50000) {
      const tmpPath = path.join(os.tmpdir(), `gsdr-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

export function error(message: string): never {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// ---- File utilities ----

export function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ---- Config loading ----

export function loadConfig(cwd: string): GsdrConfig {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const defaults: GsdrConfig = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsdr/phase-{phase}-{slug}',
    milestone_branch_template: 'gsdr/{milestone}-{slug}',
    research: true,
    plan_checker: true,
    verifier: true,
    nyquist_validation: true,
    parallelization: true,
    brave_search: false,
    model_overrides: null,
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed: GsdrConfigFile = JSON.parse(raw);

    // Migrate deprecated "depth" key to "granularity" with value mapping
    if ('depth' in parsed && !('granularity' in parsed)) {
      const depthToGranularity: Record<string, string> = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
      parsed.granularity = depthToGranularity[parsed.depth as string] || (parsed.depth as string);
      delete parsed.depth;
      try { fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8'); } catch { /* ignore */ }
    }

    const get = (key: string, nested?: { section: string; field: string }): unknown => {
      if ((parsed as Record<string, unknown>)[key] !== undefined) return (parsed as Record<string, unknown>)[key];
      if (nested) {
        const section = (parsed as Record<string, Record<string, unknown>>)[nested.section];
        if (section && section[nested.field] !== undefined) {
          return section[nested.field];
        }
      }
      return undefined;
    };

    const parallelization = ((): boolean => {
      const val = get('parallelization');
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val !== null && 'enabled' in (val as object)) return (val as { enabled: boolean }).enabled;
      return defaults.parallelization;
    })();

    return {
      model_profile: (get('model_profile') as string) ?? defaults.model_profile,
      commit_docs: (get('commit_docs', { section: 'planning', field: 'commit_docs' }) as boolean) ?? defaults.commit_docs,
      search_gitignored: (get('search_gitignored', { section: 'planning', field: 'search_gitignored' }) as boolean) ?? defaults.search_gitignored,
      branching_strategy: (get('branching_strategy', { section: 'git', field: 'branching_strategy' }) as string) ?? defaults.branching_strategy,
      phase_branch_template: (get('phase_branch_template', { section: 'git', field: 'phase_branch_template' }) as string) ?? defaults.phase_branch_template,
      milestone_branch_template: (get('milestone_branch_template', { section: 'git', field: 'milestone_branch_template' }) as string) ?? defaults.milestone_branch_template,
      research: (get('research', { section: 'workflow', field: 'research' }) as boolean) ?? defaults.research,
      plan_checker: (get('plan_checker', { section: 'workflow', field: 'plan_check' }) as boolean) ?? defaults.plan_checker,
      verifier: (get('verifier', { section: 'workflow', field: 'verifier' }) as boolean) ?? defaults.verifier,
      nyquist_validation: (get('nyquist_validation', { section: 'workflow', field: 'nyquist_validation' }) as boolean) ?? defaults.nyquist_validation,
      parallelization,
      brave_search: (get('brave_search') as boolean) ?? defaults.brave_search,
      model_overrides: (parsed.model_overrides as Record<string, string>) || null,
    };
  } catch {
    return defaults;
  }
}

// ---- Git utilities ----

export function isGitIgnored(cwd: string, targetPath: string): boolean {
  try {
    execSync('git check-ignore -q --no-index -- ' + targetPath.replace(/[^a-zA-Z0-9._\-/]/g, ''), {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

export function execGit(cwd: string, args: string[]): GitResult {
  try {
    const escaped = args.map(a => {
      if (/^[a-zA-Z0-9._\-/=:@]+$/.test(a)) return a;
      return "'" + a.replace(/'/g, "'\\''") + "'";
    });
    const stdout = execSync('git ' + escaped.join(' '), {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      exitCode: e.status ?? 1,
      stdout: (e.stdout ?? '').toString().trim(),
      stderr: (e.stderr ?? '').toString().trim(),
    };
  }
}

// ---- Phase utilities ----

export function escapeRegex(value: string | number): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizePhaseName(phase: string | number): string {
  const match = String(phase).match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  if (!match) return String(phase);
  const padded = match[1].padStart(2, '0');
  const letter = match[2] ? match[2].toUpperCase() : '';
  const decimal = match[3] || '';
  return padded + letter + decimal;
}

export function comparePhaseNum(a: string | number, b: string | number): number {
  const pa = String(a).match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  const pb = String(b).match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  const intDiff = parseInt(pa[1], 10) - parseInt(pb[1], 10);
  if (intDiff !== 0) return intDiff;
  const la = (pa[2] || '').toUpperCase();
  const lb = (pb[2] || '').toUpperCase();
  if (la !== lb) {
    if (!la) return -1;
    if (!lb) return 1;
    return la < lb ? -1 : 1;
  }
  const aDecParts = pa[3] ? pa[3].slice(1).split('.').map(p => parseInt(p, 10)) : [];
  const bDecParts = pb[3] ? pb[3].slice(1).split('.').map(p => parseInt(p, 10)) : [];
  const maxLen = Math.max(aDecParts.length, bDecParts.length);
  if (aDecParts.length === 0 && bDecParts.length > 0) return -1;
  if (bDecParts.length === 0 && aDecParts.length > 0) return 1;
  for (let i = 0; i < maxLen; i++) {
    const av = Number.isFinite(aDecParts[i]) ? aDecParts[i] : 0;
    const bv = Number.isFinite(bDecParts[i]) ? bDecParts[i] : 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function searchPhaseInDir(baseDir: string, relBase: string, normalized: string): PhaseInfo | null {
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));
    const match = dirs.find(d => d.startsWith(normalized));
    if (!match) return null;

    const dirMatch = match.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
    const phaseDir = path.join(baseDir, match);
    const phaseFiles = fs.readdirSync(phaseDir);

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
    const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
    const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
    const hasVerification = phaseFiles.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');

    const completedPlanIds = new Set(
      summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
    );
    const incompletePlans = plans.filter(p => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      return !completedPlanIds.has(planId);
    });

    return {
      found: true,
      directory: toPosixPath(path.join(relBase, match)),
      phase_number: phaseNumber,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans,
      summaries,
      incomplete_plans: incompletePlans,
      has_research: hasResearch,
      has_context: hasContext,
      has_verification: hasVerification,
    };
  } catch {
    return null;
  }
}

export function findPhaseInternal(cwd: string, phase: string | number): PhaseInfo | null {
  if (!phase) return null;

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);

  const current = searchPhaseInDir(phasesDir, '.planning/phases', normalized);
  if (current) return current;

  // Search archived milestone phases (newest first)
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return null;

  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const archiveDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of archiveDirs) {
      const archivePath = path.join(milestonesDir, archiveName);
      const relBase = '.planning/milestones/' + archiveName;
      const result = searchPhaseInDir(archivePath, relBase, normalized);
      if (result) {
        const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
        result.archived = versionMatch ? versionMatch[1] : undefined;
        return result;
      }
    }
  } catch { /* ignore */ }

  return null;
}

export function getArchivedPhaseDirs(cwd: string): ArchivedPhaseDir[] {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const results: ArchivedPhaseDir[] = [];

  if (!fs.existsSync(milestonesDir)) return results;

  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const phaseDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of phaseDirs) {
      const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
      const version = versionMatch ? versionMatch[1] : archiveName;
      const archivePath = path.join(milestonesDir, archiveName);
      const entries = fs.readdirSync(archivePath, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));

      for (const dir of dirs) {
        results.push({
          name: dir,
          milestone: version,
          basePath: path.join('.planning', 'milestones', archiveName),
          fullPath: path.join(archivePath, dir),
        });
      }
    }
  } catch { /* ignore */ }

  return results;
}

// ---- Roadmap & model utilities ----

export function getRoadmapPhaseInternal(cwd: string, phaseNum: string | number): RoadmapPhaseInfo | null {
  if (!phaseNum) return null;
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return null;

  try {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    const escapedPhase = escapeRegex(phaseNum.toString());
    const phasePattern = new RegExp(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, 'i');
    const headerMatch = content.match(phasePattern);
    if (!headerMatch) return null;

    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index!;
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index! : content.length;
    const section = content.slice(headerIndex, sectionEnd).trim();

    const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    return {
      found: true,
      phase_number: phaseNum.toString(),
      phase_name: phaseName,
      goal,
      section,
    };
  } catch {
    return null;
  }
}

export function resolveModelInternal(cwd: string, agentType: string): string {
  const config = loadConfig(cwd);

  // Check per-agent override first
  const override = config.model_overrides?.[agentType];
  if (override) {
    return override === 'opus' ? 'inherit' : override;
  }

  // Fall back to profile lookup
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  const resolved = agentModels[profile as keyof ModelProfile] || agentModels['balanced'] || 'sonnet';
  return resolved === 'opus' ? 'inherit' : resolved;
}

// ---- Misc utilities ----

export function pathExistsInternal(cwd: string, targetPath: string): boolean {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

export function generateSlugInternal(text: string | null): string | null {
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function getMilestoneInfo(cwd: string): MilestoneInfo {
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');

    // Check for list-format roadmaps using in-progress marker
    const inProgressMatch = roadmap.match(/\u{1F6A7}\s*\*\*v(\d+\.\d+)\s+([^*]+)\*\*/u);
    if (inProgressMatch) {
      return {
        version: 'v' + inProgressMatch[1],
        name: inProgressMatch[2].trim(),
      };
    }

    // Heading-format roadmaps -- strip shipped milestones in <details> blocks
    const cleaned = roadmap.replace(/<details>[\s\S]*?<\/details>/gi, '');
    const headingMatch = cleaned.match(/## .*v(\d+\.\d+)[:\s]+([^\n(]+)/);
    if (headingMatch) {
      return {
        version: 'v' + headingMatch[1],
        name: headingMatch[2].trim(),
      };
    }
    const versionMatch = cleaned.match(/v(\d+\.\d+)/);
    return {
      version: versionMatch ? versionMatch[0] : 'v1.0',
      name: 'milestone',
    };
  } catch {
    return { version: 'v1.0', name: 'milestone' };
  }
}

/**
 * Returns a filter function that checks whether a phase directory belongs
 * to the current milestone based on ROADMAP.md phase headings.
 */
export function getMilestonePhaseFilter(cwd: string): ((dirName: string) => boolean) & { phaseCount: number } {
  const milestonePhaseNums = new Set<string>();
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
    let m: RegExpExecArray | null;
    while ((m = phasePattern.exec(roadmap)) !== null) {
      milestonePhaseNums.add(m[1]);
    }
  } catch { /* ignore */ }

  if (milestonePhaseNums.size === 0) {
    const passAll = ((_dirName: string) => true) as ((dirName: string) => boolean) & { phaseCount: number };
    passAll.phaseCount = 0;
    return passAll;
  }

  const normalized = new Set(
    [...milestonePhaseNums].map(n => (n.replace(/^0+/, '') || '0').toLowerCase())
  );

  const isDirInMilestone = ((dirName: string): boolean => {
    const m = dirName.match(/^0*(\d+[A-Za-z]?(?:\.\d+)*)/);
    if (!m) return false;
    return normalized.has(m[1].toLowerCase());
  }) as ((dirName: string) => boolean) & { phaseCount: number };

  isDirInMilestone.phaseCount = milestonePhaseNums.size;
  return isDirInMilestone;
}
