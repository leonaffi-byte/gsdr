/**
 * Scheduler -- DAG construction, file-conflict detection, batch computation, agent budget distribution
 * Implements the dependency graph engine for cross-phase parallelism in GSDR.
 */

import * as fs from 'fs';
import * as path from 'path';
import { output, error } from './core';
import { extractFrontmatter } from './frontmatter';

// ---- Interfaces ----

export interface DependencyGraph {
  generated: string;
  phases: PhaseNode[];
  edges: DependencyEdge[];
  batches: ExecutionBatch[];
}

export interface PhaseNode {
  phase_number: string;
  phase_name: string;
  depends_on: string[];
  status: 'complete' | 'planned' | 'pending';
  plans: PlanSummary[];
}

export interface PlanSummary {
  id: string;
  wave: number;
  files_modified: string[];
  autonomous: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface ExecutionBatch {
  batch_number: number;
  phases: string[];
  max_agents: number;
  file_conflicts: FileConflict[];
}

export interface FileConflict {
  file: string;
  plans: string[];
  resolution: 'sequential';
}

export interface AgentBudget {
  phase: string;
  allocated_agents: number;
  total_plans: number;
}

// ---- Functions ----

/**
 * Parse a "Depends on" string from ROADMAP.md into an array of phase numbers.
 * Handles: "Nothing (first phase)" -> [], "Phase 1" -> ["1"],
 * "Phase 1, Phase 2" -> ["1", "2"], "Phases 1 and 3" -> ["1", "3"], null -> []
 */
export function parseDependsOn(dependsOnStr: string | null): string[] {
  if (!dependsOnStr) return [];
  const normalized = dependsOnStr.toLowerCase().trim();
  if (normalized.includes('nothing') || normalized.includes('first phase') || normalized === 'none') {
    return [];
  }
  const matches = dependsOnStr.match(/\d+(?:\.\d+)*/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Build a DependencyGraph by parsing ROADMAP.md and plan frontmatter from disk.
 */
export function buildDependencyGraph(cwd: string): DependencyGraph {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found at ' + roadmapPath);
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const phasesDir = path.join(cwd, '.planning', 'phases');

  // Parse phase headers and depends_on from ROADMAP.md
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const phases: PhaseNode[] = [];
  const edges: DependencyEdge[] = [];

  let match: RegExpExecArray | null;
  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();

    // Extract section for this phase
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index! : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    // Parse depends_on
    // Match both formats: "**Depends on:** X" and "**Depends on**: X"
    const dependsMatch = section.match(/\*\*Depends on\*?\*?:?\s*\*?\*?\s*:?\s*([^\n]+)/i);
    const dependsOnStr = dependsMatch ? dependsMatch[1].trim() : null;
    const dependsOn = parseDependsOn(dependsOnStr);

    // Create edges
    for (const dep of dependsOn) {
      edges.push({ from: dep, to: phaseNum });
    }

    // Determine status from disk
    const normalizedNum = phaseNum.padStart(2, '0');
    let status: 'complete' | 'planned' | 'pending' = 'pending';
    const plans: PlanSummary[] = [];

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const dirMatch = dirs.find(d => d.startsWith(normalizedNum + '-') || d === normalizedNum);

      if (dirMatch) {
        const phaseDir = path.join(phasesDir, dirMatch);
        const phaseFiles = fs.readdirSync(phaseDir);
        const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
        const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

        const completedPlanIds = new Set(
          summaryFiles.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
        );

        for (const planFile of planFiles) {
          const planId = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
          const planPath = path.join(phaseDir, planFile);
          const planContent = fs.readFileSync(planPath, 'utf-8');
          const fm = extractFrontmatter(planContent);

          const wave = parseInt(String(fm.wave), 10) || 1;
          let autonomous = true;
          if (fm.autonomous !== undefined) {
            autonomous = fm.autonomous === 'true' || fm.autonomous === true;
          }

          let filesModified: string[] = [];
          const fmFiles = fm['files_modified'] || fm['files-modified'];
          if (fmFiles) {
            filesModified = Array.isArray(fmFiles) ? fmFiles as string[] : [fmFiles as string];
          }

          plans.push({ id: planId, wave, files_modified: filesModified, autonomous });
        }

        if (summaryFiles.length >= planFiles.length && planFiles.length > 0) {
          status = 'complete';
        } else if (planFiles.length > 0) {
          status = 'planned';
        }
      }
    } catch {
      // phases dir doesn't exist or can't be read
    }

    phases.push({
      phase_number: phaseNum,
      phase_name: phaseName,
      depends_on: dependsOn,
      status,
      plans,
    });
  }

  const graph: DependencyGraph = {
    generated: new Date().toISOString(),
    phases,
    edges,
    batches: [],
  };

  return graph;
}

/**
 * Detect file conflicts among plans within a set of batch phases.
 * Plans with empty files_modified are treated as conflicting with everything (fail-safe).
 * Paths are normalized (backslash -> forward slash) before comparison.
 */
export function detectFileConflicts(graph: DependencyGraph, batchPhases: string[]): FileConflict[] {
  const fileOwners = new Map<string, string[]>();
  const unsafePlans: string[] = [];
  const allPlanIds: string[] = [];

  for (const phaseNum of batchPhases) {
    const phase = graph.phases.find(p => p.phase_number === phaseNum);
    if (!phase) continue;

    for (const plan of phase.plans) {
      allPlanIds.push(plan.id);

      if (plan.files_modified.length === 0) {
        // Plans with no files_modified are unsafe -- conflict with everything
        unsafePlans.push(plan.id);
        continue;
      }

      for (const file of plan.files_modified) {
        // Normalize path: backslash to forward slash
        const normalized = file.replace(/\\/g, '/');
        if (!fileOwners.has(normalized)) fileOwners.set(normalized, []);
        fileOwners.get(normalized)!.push(plan.id);
      }
    }
  }

  const conflicts: FileConflict[] = [];

  // File-level conflicts (2+ plans modifying same file)
  for (const [file, plans] of fileOwners) {
    if (plans.length > 1) {
      conflicts.push({ file, plans, resolution: 'sequential' });
    }
  }

  // Unsafe plans (empty files_modified) conflict with all other plans in batch
  if (unsafePlans.length > 0) {
    const otherPlans = allPlanIds.filter(id => !unsafePlans.includes(id));
    const allConflictingPlans = [...unsafePlans, ...otherPlans];
    if (allConflictingPlans.length > 1) {
      conflicts.push({
        file: '__UNSAFE_NO_FILES_DECLARED__',
        plans: allConflictingPlans,
        resolution: 'sequential',
      });
    }
  }

  return conflicts;
}

/**
 * Compute execution batches using Kahn's algorithm (BFS-based topological sort).
 * Groups phases with satisfied dependencies into concurrent batches.
 * Detects circular dependencies (throws if cycle found).
 */
export function computeBatches(graph: DependencyGraph, maxAgents?: number): ExecutionBatch[] {
  const effectiveMax = Math.min(maxAgents ?? 5, 10);

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const phase of graph.phases) {
    inDegree.set(phase.phase_number, 0);
    adjacency.set(phase.phase_number, []);
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // BFS-based batching (Kahn's algorithm)
  const batches: ExecutionBatch[] = [];
  let ready = [...inDegree.entries()]
    .filter(([_, deg]) => deg === 0)
    .map(([phase]) => phase);

  let batchNum = 0;
  let processed = 0;

  while (ready.length > 0) {
    batchNum++;

    // Filter out already-complete phases for batch content, but still process them for graph traversal
    const pending = ready.filter(p =>
      graph.phases.find(ph => ph.phase_number === p)?.status !== 'complete'
    );

    if (pending.length > 0) {
      // Calculate total agents needed
      const totalAgents = pending.reduce((sum, p) => {
        const phase = graph.phases.find(ph => ph.phase_number === p);
        return sum + (phase ? phase.plans.length : 0);
      }, 0);

      batches.push({
        batch_number: batchNum,
        phases: pending,
        max_agents: Math.min(totalAgents, effectiveMax),
        file_conflicts: [],
      });
    }

    // Advance: reduce in-degree for dependents
    const nextReady: string[] = [];
    for (const phase of ready) {
      processed++;
      for (const dependent of adjacency.get(phase) || []) {
        const newDeg = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, newDeg);
        if (newDeg === 0) nextReady.push(dependent);
      }
    }
    ready = nextReady;
  }

  // Cycle detection: if not all nodes were processed, there's a cycle
  if (processed < graph.phases.length) {
    const remaining = graph.phases
      .filter(p => !batches.some(b => b.phases.includes(p.phase_number)) &&
        p.status !== 'complete')
      .map(p => p.phase_number);

    // Also check complete phases that weren't processed
    const allProcessedInBatches = new Set<string>();
    for (const b of batches) {
      for (const p of b.phases) allProcessedInBatches.add(p);
    }
    // Add complete phases that were processed but not in batches
    const unprocessed = graph.phases
      .map(p => p.phase_number)
      .filter(p => {
        // Check if this phase was ever in the ready queue by checking if it was processed
        // A phase is unprocessed if its in-degree never reached 0
        return (inDegree.get(p) || 0) > 0;
      });

    if (unprocessed.length > 0) {
      throw new Error(`Dependency cycle detected among phases: ${unprocessed.join(' -> ')}`);
    }
    // If remaining only has complete phases, that's fine
    if (remaining.length > 0) {
      throw new Error(`Dependency cycle detected among phases: ${remaining.join(' -> ')}`);
    }
  }

  return batches;
}

/**
 * Distribute the agent budget across phases in a batch.
 * If total plans <= maxAgents, each phase gets what it needs.
 * Otherwise, proportional allocation with minimum 1 per phase.
 */
export function distributeAgentBudget(batch: ExecutionBatch, graph: DependencyGraph, maxAgents: number): AgentBudget[] {
  const phaseData = batch.phases.map(p => ({
    phase: p,
    plans: graph.phases.find(ph => ph.phase_number === p)?.plans.length || 0,
  }));

  const totalPlans = phaseData.reduce((s, p) => s + p.plans, 0);

  if (totalPlans <= maxAgents) {
    // Everyone gets what they need
    return phaseData.map(p => ({
      phase: p.phase,
      allocated_agents: p.plans,
      total_plans: p.plans,
    }));
  }

  // Proportional allocation with minimum 1
  const allocations = phaseData.map(p => ({
    phase: p.phase,
    allocated_agents: Math.max(1, Math.round((p.plans / totalPlans) * maxAgents)),
    total_plans: p.plans,
  }));

  // Adjust down if total exceeds budget (reduce largest allocation first)
  let total = allocations.reduce((s, a) => s + a.allocated_agents, 0);
  while (total > maxAgents) {
    const largest = allocations.reduce((max, a) =>
      a.allocated_agents > max.allocated_agents ? a : max
    );
    largest.allocated_agents--;
    total--;
  }

  return allocations;
}

/**
 * CLI command: generate dependency-graph.json
 * Builds the DAG, computes batches with conflict detection, writes to disk, and outputs summary.
 */
export function cmdDependencyGraph(cwd: string, raw: boolean): void {
  const graph = buildDependencyGraph(cwd);
  const batches = computeBatches(graph);

  // Run conflict detection for each batch
  for (const batch of batches) {
    batch.file_conflicts = detectFileConflicts(graph, batch.phases);
  }

  graph.batches = batches;

  // Write dependency-graph.json
  const outputPath = path.join(cwd, '.planning', 'dependency-graph.json');
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf-8');

  // Count total conflicts
  const totalConflicts = batches.reduce((s, b) => s + b.file_conflicts.length, 0);

  output({
    phases: graph.phases.length,
    edges: graph.edges.length,
    batches: batches.length,
    conflicts: totalConflicts,
    output_path: outputPath,
  }, raw);
}
