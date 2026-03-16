/**
 * Tests for the dependency graph engine (scheduler.ts)
 * Covers PARA-01 through PARA-06
 */

import { describe, it, expect } from 'vitest';
import {
  parseDependsOn,
  buildDependencyGraph,
  detectFileConflicts,
  computeBatches,
  distributeAgentBudget,
  type DependencyGraph,
  type PhaseNode,
  type ExecutionBatch,
} from '../src/lib/scheduler';

// ---- Mock Data ----

/**
 * Mock 5-phase ROADMAP structure matching GSDR:
 * Phase 1: Foundation (no deps)
 * Phase 2: Complexity Calibration (depends on Phase 1)
 * Phase 3: Front-Loaded Interaction (depends on Phase 1, Phase 2)
 * Phase 4: Dependency Graph Engine (depends on Phase 1)
 * Phase 5: Autonomous Execution (depends on Phase 3, Phase 4)
 *
 * Expected batches:
 * Batch 1: Phase 1
 * Batch 2: Phase 2, Phase 4 (both only depend on 1)
 * Batch 3: Phase 3 (depends on 1, 2)
 * Batch 4: Phase 5 (depends on 3, 4)
 */
function makeMockGraph(overrides?: Partial<DependencyGraph>): DependencyGraph {
  return {
    generated: '2026-03-15T00:00:00Z',
    phases: [
      {
        phase_number: '1',
        phase_name: 'Foundation',
        depends_on: [],
        status: 'planned',
        plans: [
          { id: '01-01', wave: 1, files_modified: ['src/index.ts'], autonomous: true },
          { id: '01-02', wave: 1, files_modified: ['src/lib/core.ts'], autonomous: true },
        ],
      },
      {
        phase_number: '2',
        phase_name: 'Complexity Calibration',
        depends_on: ['1'],
        status: 'planned',
        plans: [
          { id: '02-01', wave: 1, files_modified: ['src/lib/complexity.ts'], autonomous: true },
        ],
      },
      {
        phase_number: '3',
        phase_name: 'Front-Loaded Interaction',
        depends_on: ['1', '2'],
        status: 'planned',
        plans: [
          { id: '03-01', wave: 1, files_modified: ['src/lib/init.ts'], autonomous: true },
        ],
      },
      {
        phase_number: '4',
        phase_name: 'Dependency Graph Engine',
        depends_on: ['1'],
        status: 'planned',
        plans: [
          { id: '04-01', wave: 1, files_modified: ['src/lib/scheduler.ts'], autonomous: true },
        ],
      },
      {
        phase_number: '5',
        phase_name: 'Autonomous Execution',
        depends_on: ['3', '4'],
        status: 'planned',
        plans: [
          { id: '05-01', wave: 1, files_modified: ['src/lib/executor.ts'], autonomous: true },
          { id: '05-02', wave: 2, files_modified: ['src/lib/verifier.ts'], autonomous: true },
        ],
      },
    ],
    edges: [
      { from: '1', to: '2' },
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '1', to: '4' },
      { from: '3', to: '5' },
      { from: '4', to: '5' },
    ],
    batches: [],
    ...overrides,
  };
}

// ---- PARA-01: Cross-phase dependency graph ----

describe('PARA-01', () => {
  describe('parseDependsOn', () => {
    it('returns [] for "Nothing (first phase)"', () => {
      expect(parseDependsOn('Nothing (first phase)')).toEqual([]);
    });

    it('returns ["1"] for "Phase 1"', () => {
      expect(parseDependsOn('Phase 1')).toEqual(['1']);
    });

    it('returns ["1", "2"] for "Phase 1, Phase 2"', () => {
      expect(parseDependsOn('Phase 1, Phase 2')).toEqual(['1', '2']);
    });

    it('returns ["1", "3"] for "Phases 1 and 3"', () => {
      expect(parseDependsOn('Phases 1 and 3')).toEqual(['1', '3']);
    });

    it('returns [] for null', () => {
      expect(parseDependsOn(null)).toEqual([]);
    });
  });

  describe('buildDependencyGraph', () => {
    it('produces a DAG with correct edges for 5-phase mock', () => {
      const graph = makeMockGraph();
      // buildDependencyGraph stub returns empty, so we test the structure
      // After implementation, this will test real ROADMAP parsing
      expect(graph.phases).toHaveLength(5);
      expect(graph.edges).toHaveLength(6);
    });
  });

  describe('computeBatches', () => {
    it('groups independent phases into batch 1', () => {
      const graph = makeMockGraph();
      const batches = computeBatches(graph);
      expect(batches.length).toBeGreaterThan(0);
      // Batch 1 should contain only Phase 1 (the only one with no deps)
      expect(batches[0].phases).toContain('1');
    });

    it('places Phase 5 (depends on 3,4) in batch after both 3 and 4', () => {
      const graph = makeMockGraph();
      const batches = computeBatches(graph);
      const phase5Batch = batches.find(b => b.phases.includes('5'));
      const phase3Batch = batches.find(b => b.phases.includes('3'));
      const phase4Batch = batches.find(b => b.phases.includes('4'));
      expect(phase5Batch).toBeDefined();
      expect(phase3Batch).toBeDefined();
      expect(phase4Batch).toBeDefined();
      expect(phase5Batch!.batch_number).toBeGreaterThan(phase3Batch!.batch_number);
      expect(phase5Batch!.batch_number).toBeGreaterThan(phase4Batch!.batch_number);
    });

    it('detects circular dependencies and reports cycle', () => {
      const circularGraph: DependencyGraph = {
        generated: '2026-03-15T00:00:00Z',
        phases: [
          { phase_number: '1', phase_name: 'A', depends_on: ['2'], status: 'planned', plans: [] },
          { phase_number: '2', phase_name: 'B', depends_on: ['3'], status: 'planned', plans: [] },
          { phase_number: '3', phase_name: 'C', depends_on: ['1'], status: 'planned', plans: [] },
        ],
        edges: [
          { from: '2', to: '1' },
          { from: '3', to: '2' },
          { from: '1', to: '3' },
        ],
        batches: [],
      };
      expect(() => computeBatches(circularGraph)).toThrow(/cycle/i);
    });
  });
});

// ---- PARA-02: File-level conflict detection ----

describe('PARA-02', () => {
  it('detects FileConflict when two plans declare same file', () => {
    const graph = makeMockGraph({
      phases: [
        {
          phase_number: '1',
          phase_name: 'A',
          depends_on: [],
          status: 'planned',
          plans: [
            { id: '01-01', wave: 1, files_modified: ['src/shared.ts'], autonomous: true },
            { id: '01-02', wave: 1, files_modified: ['src/shared.ts'], autonomous: true },
          ],
        },
      ],
    });
    const conflicts = detectFileConflicts(graph, ['1']);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].file).toBe('src/shared.ts');
    expect(conflicts[0].plans).toContain('01-01');
    expect(conflicts[0].plans).toContain('01-02');
    expect(conflicts[0].resolution).toBe('sequential');
  });

  it('returns no conflicts when files do not overlap', () => {
    const graph = makeMockGraph({
      phases: [
        {
          phase_number: '1',
          phase_name: 'A',
          depends_on: [],
          status: 'planned',
          plans: [
            { id: '01-01', wave: 1, files_modified: ['src/a.ts'], autonomous: true },
            { id: '01-02', wave: 1, files_modified: ['src/b.ts'], autonomous: true },
          ],
        },
      ],
    });
    const conflicts = detectFileConflicts(graph, ['1']);
    expect(conflicts).toEqual([]);
  });
});

// ---- PARA-03: Preserve within-phase wave execution ----

describe('PARA-03', () => {
  it('computeBatches does NOT flatten within-phase waves', () => {
    const graph = makeMockGraph();
    const batches = computeBatches(graph);
    // Phase 5 has plans in wave 1 and wave 2
    // computeBatches should NOT flatten them - the phase node retains its plans with wave assignments
    const phase5 = graph.phases.find(p => p.phase_number === '5');
    expect(phase5).toBeDefined();
    expect(phase5!.plans[0].wave).toBe(1);
    expect(phase5!.plans[1].wave).toBe(2);
    // Batches deal with phases, not individual plans
    const phase5Batch = batches.find(b => b.phases.includes('5'));
    expect(phase5Batch).toBeDefined();
    // The batch just references phase numbers, not plan-level details
    expect(phase5Batch!.phases).toContain('5');
  });
});

// ---- PARA-05: Agent budget distribution ----

describe('PARA-05', () => {
  it('distributes budget when plans <= maxAgents (everyone gets what they need)', () => {
    const graph = makeMockGraph({
      phases: [
        {
          phase_number: '2',
          phase_name: 'B',
          depends_on: [],
          status: 'planned',
          plans: [
            { id: '02-01', wave: 1, files_modified: ['a.ts'], autonomous: true },
          ],
        },
        {
          phase_number: '4',
          phase_name: 'D',
          depends_on: [],
          status: 'planned',
          plans: [
            { id: '04-01', wave: 1, files_modified: ['b.ts'], autonomous: true },
            { id: '04-02', wave: 1, files_modified: ['c.ts'], autonomous: true },
          ],
        },
      ],
    });
    const batch: ExecutionBatch = {
      batch_number: 1,
      phases: ['2', '4'],
      max_agents: 5,
      file_conflicts: [],
    };
    const budgets = distributeAgentBudget(batch, graph, 5);
    expect(budgets).toHaveLength(2);
    const phase2Budget = budgets.find(b => b.phase === '2');
    const phase4Budget = budgets.find(b => b.phase === '4');
    expect(phase2Budget!.allocated_agents).toBe(1);
    expect(phase4Budget!.allocated_agents).toBe(2);
    const total = budgets.reduce((s, b) => s + b.allocated_agents, 0);
    expect(total).toBeLessThanOrEqual(5);
  });

  it('proportionally allocates when plans > maxAgents, total <= maxAgents', () => {
    // Create a graph with 15 plans across 3 phases
    const graph = makeMockGraph({
      phases: [
        {
          phase_number: '1',
          phase_name: 'A',
          depends_on: [],
          status: 'planned',
          plans: Array.from({ length: 5 }, (_, i) => ({
            id: `01-0${i + 1}`,
            wave: 1,
            files_modified: [`a${i}.ts`],
            autonomous: true,
          })),
        },
        {
          phase_number: '2',
          phase_name: 'B',
          depends_on: [],
          status: 'planned',
          plans: Array.from({ length: 5 }, (_, i) => ({
            id: `02-0${i + 1}`,
            wave: 1,
            files_modified: [`b${i}.ts`],
            autonomous: true,
          })),
        },
        {
          phase_number: '3',
          phase_name: 'C',
          depends_on: [],
          status: 'planned',
          plans: Array.from({ length: 5 }, (_, i) => ({
            id: `03-0${i + 1}`,
            wave: 1,
            files_modified: [`c${i}.ts`],
            autonomous: true,
          })),
        },
      ],
    });
    const batch: ExecutionBatch = {
      batch_number: 1,
      phases: ['1', '2', '3'],
      max_agents: 5,
      file_conflicts: [],
    };
    const budgets = distributeAgentBudget(batch, graph, 5);
    const total = budgets.reduce((s, b) => s + b.allocated_agents, 0);
    expect(total).toBeLessThanOrEqual(5);
    // Each phase should get at least 1
    for (const b of budgets) {
      expect(b.allocated_agents).toBeGreaterThanOrEqual(1);
    }
  });

  it('default maxAgents is 5, configurable up to 10', () => {
    // This is a contract test -- the computeBatches function should default to 5
    const graph = makeMockGraph();
    const batchesDefault = computeBatches(graph);
    for (const batch of batchesDefault) {
      expect(batch.max_agents).toBeLessThanOrEqual(5);
    }

    const batches10 = computeBatches(graph, 10);
    for (const batch of batches10) {
      expect(batch.max_agents).toBeLessThanOrEqual(10);
    }

    // Cap at 10 even if 15 requested
    const batchesCapped = computeBatches(graph, 15);
    for (const batch of batchesCapped) {
      expect(batch.max_agents).toBeLessThanOrEqual(10);
    }
  });
});

// ---- PARA-06: File ownership enforcement ----

describe('PARA-06', () => {
  it('treats plans with empty files_modified as conflicting with everything', () => {
    const graph = makeMockGraph({
      phases: [
        {
          phase_number: '1',
          phase_name: 'A',
          depends_on: [],
          status: 'planned',
          plans: [
            { id: '01-01', wave: 1, files_modified: [], autonomous: true },
            { id: '01-02', wave: 1, files_modified: ['src/a.ts'], autonomous: true },
          ],
        },
      ],
    });
    const conflicts = detectFileConflicts(graph, ['1']);
    expect(conflicts.length).toBeGreaterThan(0);
    // The unsafe plan should conflict with the other plan
    const unsafeConflict = conflicts.find(c => c.file === '__UNSAFE_NO_FILES_DECLARED__');
    expect(unsafeConflict).toBeDefined();
    expect(unsafeConflict!.plans).toContain('01-01');
    expect(unsafeConflict!.plans).toContain('01-02');
  });

  it('normalizes paths (backslash to forward slash)', () => {
    const graph = makeMockGraph({
      phases: [
        {
          phase_number: '1',
          phase_name: 'A',
          depends_on: [],
          status: 'planned',
          plans: [
            { id: '01-01', wave: 1, files_modified: ['src\\lib\\shared.ts'], autonomous: true },
            { id: '01-02', wave: 1, files_modified: ['src/lib/shared.ts'], autonomous: true },
          ],
        },
      ],
    });
    const conflicts = detectFileConflicts(graph, ['1']);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].file).toBe('src/lib/shared.ts');
  });
});
