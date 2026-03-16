/**
 * Shared type definitions for GSDR tooling
 */

// ---- Config types ----

export interface GsdrConfig {
  mode?: 'yolo' | 'interactive' | 'custom';
  granularity?: 'coarse' | 'standard' | 'fine';
  model_profile: string;
  commit_docs: boolean;
  search_gitignored: boolean;
  branching_strategy: string;
  phase_branch_template: string;
  milestone_branch_template: string;
  research: boolean;
  plan_checker: boolean;
  verifier: boolean;
  nyquist_validation: boolean;
  parallelization: boolean;
  brave_search: boolean;
  model_overrides: Record<string, string> | null;
}

export interface GsdrConfigFile {
  mode?: string;
  granularity?: string;
  model_profile?: string;
  commit_docs?: boolean;
  search_gitignored?: boolean;
  branching_strategy?: string;
  phase_branch_template?: string;
  milestone_branch_template?: string;
  workflow?: {
    research?: boolean;
    plan_check?: boolean;
    verifier?: boolean;
    nyquist_validation?: boolean;
    auto_advance?: boolean;
  };
  parallelization?: boolean | { enabled: boolean };
  brave_search?: boolean;
  model_overrides?: Record<string, string>;
  git?: {
    branching_strategy?: string;
    phase_branch_template?: string;
    milestone_branch_template?: string;
  };
  planning?: {
    commit_docs?: boolean;
    search_gitignored?: boolean;
  };
  [key: string]: unknown;
}

// ---- State types ----

export interface StateFrontmatter {
  gsd_state_version: string;
  milestone: string;
  milestone_name: string;
  status: string;
  stopped_at: string;
  last_updated: string;
  last_activity: string;
  progress: {
    total_phases: number;
    completed_phases: number;
    total_plans: number;
    completed_plans: number;
    percent: number;
  };
}

// ---- Phase types ----

export interface PhaseInfo {
  found: boolean;
  directory: string;
  phase_number: string;
  phase_name: string | null;
  phase_slug: string | null;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
  has_research: boolean;
  has_context: boolean;
  has_verification: boolean;
  archived?: string;
}

export interface RoadmapPhaseInfo {
  found: boolean;
  phase_number: string;
  phase_name: string;
  goal: string | null;
  section: string;
}

// ---- Init types ----

export interface InitResult {
  commit_docs: boolean;
  phase_found: boolean;
  phase_dir: string | null;
  phase_number: string | null;
  phase_name: string | null;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
  state_path: string;
  config_path: string;
}

// ---- Model types ----

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export interface ModelProfile {
  quality: ModelTier;
  balanced: ModelTier;
  budget: ModelTier;
}

// ---- Git types ----

export interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ---- Milestone types ----

export interface MilestoneInfo {
  version: string;
  name: string;
}

export interface ArchivedPhaseDir {
  name: string;
  milestone: string;
  basePath: string;
  fullPath: string;
}

// ---- Frontmatter types ----

export type FrontmatterValue = string | number | boolean | string[] | Record<string, unknown>;
export type FrontmatterObject = Record<string, FrontmatterValue>;

export interface FrontmatterSchema {
  required: string[];
}

// ---- Complexity types (re-exported from src/lib/complexity.ts) ----

export type { ComplexityResult, ComplexityConfig } from './lib/complexity';
