import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the SKILL.md files once for all tests
const EXECUTE_PHASE_SKILL_PATH = resolve(__dirname, '../skills/execute-phase/SKILL.md');
const PLAN_PHASE_SKILL_PATH = resolve(__dirname, '../skills/plan-phase/SKILL.md');

let executePhaseSkill: string;
let planPhaseSkill: string;

beforeAll(() => {
  executePhaseSkill = readFileSync(EXECUTE_PHASE_SKILL_PATH, 'utf-8');
  planPhaseSkill = readFileSync(PLAN_PHASE_SKILL_PATH, 'utf-8');
});

// ---- Task 04-02-01 (PARA-03): Cross-phase execution orchestration in execute-phase ----

describe('execute-phase SKILL.md — cross-phase orchestration mode (PARA-03)', () => {
  it('supports --milestone flag listed in argument-hint', () => {
    // The skill frontmatter must advertise --milestone support so callers know it is available
    expect(executePhaseSkill).toContain('--milestone');
  });

  it('supports --all flag for cross-phase execution', () => {
    // Both --milestone and --all must be supported as cross-phase triggers
    expect(executePhaseSkill).toContain('--all');
  });

  it('checks for cross-phase mode before entering single-phase steps', () => {
    // A dedicated routing step must detect --milestone/--all before any phase-specific logic
    expect(executePhaseSkill).toMatch(/check_cross_phase_mode|CROSS_PHASE_MODE/);
  });

  it('routes to execute_milestone step when cross-phase mode is active', () => {
    // The execute_milestone step must exist as the cross-phase execution handler
    expect(executePhaseSkill).toContain('execute_milestone');
  });

  it('invokes dependency-graph CLI to generate graph before scheduling', () => {
    // Cross-phase mode must call the dependency-graph command to compute execution order
    expect(executePhaseSkill).toMatch(/dependency-graph/);
  });

  it('reads dependency-graph.json to obtain batch definitions', () => {
    // The skill must read the generated JSON artifact to access phase batches
    expect(executePhaseSkill).toContain('dependency-graph.json');
  });

  it('processes phases in batches from the dependency graph', () => {
    // Batch-based iteration must be present for phase-level scheduling
    expect(executePhaseSkill).toMatch(/batch|batches/i);
  });

  it('checks agent budget before spawning phases in a batch', () => {
    // max_agents or agent budget check must precede spawning to enforce concurrency limits
    expect(executePhaseSkill).toMatch(/max_agents|agent budget|Budget:/i);
  });

  it('delegates each phase to single-phase execute-phase mode to preserve wave ordering', () => {
    // Cross-phase mode must spawn per-phase execute-phase calls (single-phase mode)
    // This ensures within-phase wave execution (PARA-03) is preserved
    expect(executePhaseSkill).toMatch(/single.phase mode|no --milestone flag|single-phase execute/i);
  });

  it('handles file conflicts between parallel plans by running them sequentially', () => {
    // File conflicts detected in batch must trigger sequential (not parallel) execution
    expect(executePhaseSkill).toMatch(/file_conflict|file conflict|sequential/i);
  });

  it('preserves existing single-phase steps when cross-phase mode is not active', () => {
    // The skill must retain handle_branching, discover_and_group_plans, and execute_waves
    // to keep single-phase mode fully functional
    expect(executePhaseSkill).toContain('execute_waves');
    expect(executePhaseSkill).toContain('handle_branching');
    expect(executePhaseSkill).toContain('discover_and_group_plans');
  });
});

// ---- Task 04-02-02 (PARA-04): Multi-phase parallel planning in plan-phase ----

describe('plan-phase SKILL.md — multi-phase parallel planning (PARA-04)', () => {
  it('supports --milestone flag listed in argument-hint', () => {
    // The skill frontmatter must advertise --milestone support
    expect(planPhaseSkill).toContain('--milestone');
  });

  it('supports --all flag for multi-phase planning', () => {
    // Both --milestone and --all must trigger multi-phase parallel planning
    expect(planPhaseSkill).toContain('--all');
  });

  it('checks for multi-phase mode before entering single-phase planning steps', () => {
    // A mode-detection block must check for the flags before running single-phase logic
    expect(planPhaseSkill).toMatch(/MULTI_PHASE_MODE|multi.phase mode/i);
  });

  it('routes to parallel_planning step when multi-phase mode is active', () => {
    // The parallel_planning step must exist as the multi-phase planning handler
    expect(planPhaseSkill).toContain('parallel_planning');
  });

  it('invokes dependency-graph CLI to determine planning order', () => {
    // Multi-phase mode must call the dependency-graph command to compute phase ordering
    expect(planPhaseSkill).toMatch(/dependency-graph/);
  });

  it('reads dependency-graph.json to group phases into planning batches', () => {
    // The generated JSON must be read to access batches for concurrent planning
    expect(planPhaseSkill).toContain('dependency-graph.json');
  });

  it('spawns concurrent planning agents for phases within each batch', () => {
    // Multiple plan-phase agents must be spawned in parallel within each batch
    expect(planPhaseSkill).toMatch(/spawn.*plan.phase|plan.phase.*each phase|concurrent.*plan/i);
  });

  it('enforces agent budget cap (max_concurrent_agents) for planning agents', () => {
    // Planning agent count must be capped to prevent overloading the environment
    expect(planPhaseSkill).toMatch(/max_concurrent_agents|agent.*cap|cap.*agent/i);
  });

  it('respects dependency ordering across batches (later batches run after earlier ones complete)', () => {
    // The batch loop must be sequential across batches even when intra-batch is parallel
    expect(planPhaseSkill).toMatch(/batch|[Bb]atch \{N\}|next batch/i);
  });

  it('regenerates dependency graph after each planning batch for accurate file conflict data', () => {
    // After each batch completes, the graph must be regenerated to capture files_modified from new plans
    expect(planPhaseSkill).toMatch(/[Rr]egenerate.*dependency.graph|dependency.graph.*regenerat|dependency-graph.*--cwd/);
  });

  it('preserves existing single-phase planning behavior when multi-phase mode is not active', () => {
    // Original single-phase steps (research, planner, plan-checker) must be untouched
    expect(planPhaseSkill).toContain('gsdr-planner');
    expect(planPhaseSkill).toContain('gsdr-plan-checker');
    expect(planPhaseSkill).toContain('gsdr-phase-researcher');
  });
});
