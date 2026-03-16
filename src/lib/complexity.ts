/**
 * Complexity Classification Engine
 *
 * Classifies task descriptions into Simple/Medium/Complex tiers.
 * When no override is provided, returns a filled prompt template for
 * the skill workflow's LLM to perform actual classification.
 */

import { output, error } from './core';

// ---- Types ----

export interface ComplexityResult {
  tier: 'simple' | 'medium' | 'complex';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  signals: {
    file_scope: 'low' | 'medium' | 'high';
    integration_surface: 'low' | 'medium' | 'high';
    ambiguity: 'low' | 'medium' | 'high';
    domain_novelty: 'low' | 'medium' | 'high';
    cross_cutting: string[];
  };
}

export interface ComplexityConfig {
  tier: 'simple' | 'medium' | 'complex';
  research: 'skip' | 'light' | 'full';
  max_plans: number;
  plan_checker: boolean;
  verifier: boolean;
}

// ---- Config Table ----

export const COMPLEXITY_TIERS: Record<string, ComplexityConfig> = {
  simple: {
    tier: 'simple',
    research: 'skip',
    max_plans: 1,
    plan_checker: false,
    verifier: false,
  },
  medium: {
    tier: 'medium',
    research: 'light',
    max_plans: 3,
    plan_checker: true,
    verifier: true,
  },
  complex: {
    tier: 'complex',
    research: 'full',
    max_plans: 10,
    plan_checker: true,
    verifier: true,
  },
};

// ---- Classifier Prompt Template ----

export const CLASSIFIER_PROMPT = `
Classify this task's complexity into one of three tiers: Simple, Medium, or Complex.

## Task Description
{task_description}

## Project Context
{project_summary_from_state_md}

## Signal Framework

Evaluate these signals:

1. **file_scope**: How many files/modules will be touched?
   - Low: 1-2 files, single module
   - Medium: 3-5 files, 2-3 modules
   - High: 6+ files, cross-module changes

2. **integration_surface**: External systems, APIs, databases involved?
   - Low: No external dependencies
   - Medium: 1-2 external integrations
   - High: 3+ external systems or complex protocol work

3. **ambiguity**: How well-specified is the task?
   - Low: Concrete files, specific changes described
   - Medium: Goal is clear but implementation details are open
   - High: Vague goal, multiple valid interpretations

4. **domain_novelty**: Is this a well-known pattern or new territory?
   - Low: Standard CRUD, config changes, UI tweaks
   - Medium: Familiar domain with some novel aspects
   - High: New paradigm, unfamiliar technology, architectural shift

5. **cross_cutting**: Auth, security, migrations, backwards compatibility?
   - List any that apply

## Classification Rules

- **Simple**: All signals low. Task is self-contained, well-specified, touches few files.
  Plan with: 1 lightweight plan, no research, no verification.

- **Medium**: Any signal is medium, or task has moderate scope with clear direction.
  Plan with: 2-3 plans, light research (single agent), standard verification.

- **Complex**: Any signal is high, or 3+ signals are medium.
  Plan with: Full multi-plan treatment, 4-agent research, verification with iteration.

- **Ambiguity rule**: If the description is vague AND touches a known-complex domain
  (auth, payments, real-time, data migration, multi-tenancy), classify UP one tier.

## Output Format

Return JSON:
{
  "tier": "simple|medium|complex",
  "confidence": "high|medium|low",
  "rationale": "2-3 sentences explaining classification",
  "signals": {
    "file_scope": "low|medium|high",
    "integration_surface": "low|medium|high",
    "ambiguity": "low|medium|high",
    "domain_novelty": "low|medium|high",
    "cross_cutting": ["list", "of", "concerns"]
  }
}
`;

// ---- Functions ----

const VALID_TIERS = new Set(['simple', 'medium', 'complex']);

/**
 * Returns the complexity config for a given tier name, or null if invalid.
 */
export function getComplexityConfig(tier: string): ComplexityConfig | null {
  if (!tier || !VALID_TIERS.has(tier)) return null;
  return COMPLEXITY_TIERS[tier] ?? null;
}

/**
 * Classify complexity for a task.
 *
 * - If `override` is provided and valid, returns a ComplexityResult immediately.
 * - If `override` is invalid, throws an error.
 * - If no override, returns `{ prompt: string }` with the filled classifier prompt
 *   for the skill workflow's LLM to evaluate.
 */
export function classifyComplexity(options: {
  taskDescription: string;
  projectContext?: string;
  override?: string;
}): ComplexityResult | { prompt: string } {
  const { taskDescription, projectContext, override } = options;

  if (override !== undefined) {
    if (!VALID_TIERS.has(override)) {
      throw new Error(`Invalid complexity tier: "${override}". Must be one of: simple, medium, complex`);
    }

    return {
      tier: override as 'simple' | 'medium' | 'complex',
      confidence: 'high',
      rationale: `Complexity set to ${override} (user override)`,
      signals: {
        file_scope: 'low',
        integration_surface: 'low',
        ambiguity: 'low',
        domain_novelty: 'low',
        cross_cutting: [],
      },
    };
  }

  // No override: fill the prompt template and return it for LLM classification
  const filledPrompt = CLASSIFIER_PROMPT
    .replace('{task_description}', taskDescription || '')
    .replace('{project_summary_from_state_md}', projectContext || 'No project context available');

  return { prompt: filledPrompt };
}

// ---- Labeled Test Cases ----

export interface LabeledTestCase {
  description: string;
  projectContext: string;
  expectedTier: 'simple' | 'medium' | 'complex';
  rationale: string;
}

export const LABELED_TEST_CASES: LabeledTestCase[] = [
  // --- Simple (5 cases) ---
  {
    description: 'Fix typo in README.md',
    projectContext: 'TypeScript web app, Phase 3 of 5',
    expectedTier: 'simple',
    rationale: 'Single file, no integration, fully specified',
  },
  {
    description: 'Add eslint rule to disallow console.log in production code',
    projectContext: 'React frontend, standard toolchain',
    expectedTier: 'simple',
    rationale: 'Config change, 1-2 files, well-known pattern',
  },
  {
    description: 'Add loading spinner to the user list page',
    projectContext: 'React app with existing component library',
    expectedTier: 'simple',
    rationale: 'Single component, existing patterns, well-specified',
  },
  {
    description: 'Rename the UserService class to AccountService',
    projectContext: 'NestJS backend, 12 modules',
    expectedTier: 'simple',
    rationale: 'Mechanical refactor, find-and-replace pattern',
  },
  {
    description: 'Update Node.js version from 18 to 20 in CI config',
    projectContext: 'GitHub Actions CI pipeline',
    expectedTier: 'simple',
    rationale: 'Single config file, well-documented upgrade path',
  },

  // --- Medium (8 cases) ---
  {
    description: 'Add JWT authentication to the Express API',
    projectContext: 'Express.js REST API, no auth currently',
    expectedTier: 'medium',
    rationale: 'Well-known pattern but touches multiple files (middleware, routes, config)',
  },
  {
    description: 'Create a user profile page with edit functionality',
    projectContext: 'React app with existing user model',
    expectedTier: 'medium',
    rationale: 'Multiple components, form handling, API integration',
  },
  {
    description: 'Add dark mode support',
    projectContext: 'React app with Tailwind CSS, no theme system',
    expectedTier: 'medium',
    rationale: 'Cross-cutting CSS changes, new theme context, multiple components affected',
  },
  {
    description: 'Implement email notifications for new comments',
    projectContext: 'Node.js app with existing comment system',
    expectedTier: 'medium',
    rationale: 'New external integration (email), queue/async considerations',
  },
  {
    description: 'Refactor the data access layer to use repository pattern',
    projectContext: 'Express app with direct database calls in routes',
    expectedTier: 'medium',
    rationale: 'Architectural refactor touching many files, but well-known pattern',
  },
  {
    description: 'Add pagination to all list endpoints',
    projectContext: 'REST API with 8 list endpoints',
    expectedTier: 'medium',
    rationale: 'Repetitive pattern across multiple files, some query complexity',
  },
  {
    description: 'Create admin dashboard with user management',
    projectContext: 'SaaS app with existing user model, no admin UI',
    expectedTier: 'medium',
    rationale: 'New feature area but uses existing data model and auth',
  },
  {
    description: 'Add webhook support for order status changes',
    projectContext: 'E-commerce API',
    expectedTier: 'medium',
    rationale: 'External integration, retry logic, but focused scope',
  },

  // --- Complex (5 cases) ---
  {
    description: 'Add OAuth2 with RBAC and role hierarchy',
    projectContext: 'Multi-tenant SaaS platform',
    expectedTier: 'complex',
    rationale: 'Multiple external providers, role hierarchy design, cross-cutting auth checks',
  },
  {
    description: 'Migrate from REST to GraphQL',
    projectContext: 'Production API with 30 endpoints and 5 client apps',
    expectedTier: 'complex',
    rationale: 'Architectural shift, backwards compatibility, all clients affected',
  },
  {
    description: 'Implement real-time collaboration on documents',
    projectContext: 'Document editor app',
    expectedTier: 'complex',
    rationale: 'CRDT/OT algorithms, WebSocket infrastructure, conflict resolution',
  },
  {
    description: 'Add multi-tenant support with data isolation',
    projectContext: 'Single-tenant SaaS converting to multi-tenant',
    expectedTier: 'complex',
    rationale: 'Database schema changes, tenant isolation at every layer, migration path',
  },
  {
    description: 'Build CI/CD pipeline with staging, canary, and production environments',
    projectContext: 'Greenfield project, deploying to Kubernetes',
    expectedTier: 'complex',
    rationale: 'Multiple environments, deployment strategies, infrastructure as code',
  },

  // --- Edge Cases (2 cases -- same description, different context) ---
  {
    description: 'Add auth',
    projectContext: 'Large enterprise application with existing user directory',
    expectedTier: 'complex',
    rationale: 'Ambiguous + enterprise context + known-complex domain = classify UP',
  },
  {
    description: 'Add auth',
    projectContext: 'Simple CLI tool for personal use',
    expectedTier: 'simple',
    rationale: 'Same description but simple context = API key or basic auth',
  },
];

// ---- CLI Command Handler ----

/**
 * CLI handler for `gsdr-tools classify-complexity`.
 *
 * - With override: outputs ComplexityResult JSON
 * - Without override: outputs { prompt: string } for skill workflow
 */
export function cmdClassifyComplexity(
  _cwd: string,
  taskDescription: string,
  override: string | undefined,
  raw: boolean,
): void {
  const result = classifyComplexity({ taskDescription, override });
  output(result, raw, raw ? JSON.stringify(result) : undefined);
}
