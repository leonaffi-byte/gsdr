import { describe, it, expect } from 'vitest';
import {
  ComplexityResult,
  ComplexityConfig,
  COMPLEXITY_TIERS,
  CLASSIFIER_PROMPT,
  classifyComplexity,
  getComplexityConfig,
  LABELED_TEST_CASES,
} from '../src/lib/complexity';

// ---- COMPLEXITY_TIERS config tests ----

describe('COMPLEXITY_TIERS config', () => {
  it('has entries for simple, medium, complex', () => {
    expect(COMPLEXITY_TIERS).toHaveProperty('simple');
    expect(COMPLEXITY_TIERS).toHaveProperty('medium');
    expect(COMPLEXITY_TIERS).toHaveProperty('complex');
  });

  it('simple tier: research=skip, max_plans=1, plan_checker=false, verifier=false', () => {
    const s = COMPLEXITY_TIERS.simple;
    expect(s.research).toBe('skip');
    expect(s.max_plans).toBe(1);
    expect(s.plan_checker).toBe(false);
    expect(s.verifier).toBe(false);
  });

  it('medium tier: research=light, max_plans=3, plan_checker=true, verifier=true', () => {
    const m = COMPLEXITY_TIERS.medium;
    expect(m.research).toBe('light');
    expect(m.max_plans).toBe(3);
    expect(m.plan_checker).toBe(true);
    expect(m.verifier).toBe(true);
  });

  it('complex tier: research=full, max_plans=10, plan_checker=true, verifier=true', () => {
    const c = COMPLEXITY_TIERS.complex;
    expect(c.research).toBe('full');
    expect(c.max_plans).toBe(10);
    expect(c.plan_checker).toBe(true);
    expect(c.verifier).toBe(true);
  });
});

// ---- getComplexityConfig tests ----

describe('getComplexityConfig', () => {
  it('returns COMPLEXITY_TIERS.simple for "simple"', () => {
    expect(getComplexityConfig('simple')).toEqual(COMPLEXITY_TIERS.simple);
  });

  it('returns COMPLEXITY_TIERS.medium for "medium"', () => {
    expect(getComplexityConfig('medium')).toEqual(COMPLEXITY_TIERS.medium);
  });

  it('returns COMPLEXITY_TIERS.complex for "complex"', () => {
    expect(getComplexityConfig('complex')).toEqual(COMPLEXITY_TIERS.complex);
  });

  it('returns null for invalid tier', () => {
    expect(getComplexityConfig('invalid')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getComplexityConfig('')).toBeNull();
  });
});

// ---- ComplexityResult type shape test ----

describe('ComplexityResult type', () => {
  it('override result has tier, confidence, rationale, signals fields', () => {
    const result = classifyComplexity({ taskDescription: 'test', override: 'simple' });
    // When override is used, it returns a ComplexityResult
    const cr = result as ComplexityResult;
    expect(cr).toHaveProperty('tier');
    expect(cr).toHaveProperty('confidence');
    expect(cr).toHaveProperty('rationale');
    expect(cr).toHaveProperty('signals');
    expect(cr.signals).toHaveProperty('file_scope');
    expect(cr.signals).toHaveProperty('integration_surface');
    expect(cr.signals).toHaveProperty('ambiguity');
    expect(cr.signals).toHaveProperty('domain_novelty');
    expect(cr.signals).toHaveProperty('cross_cutting');
  });
});

// ---- CLASSIFIER_PROMPT tests ----

describe('CLASSIFIER_PROMPT', () => {
  it('contains signal framework section for file_scope', () => {
    expect(CLASSIFIER_PROMPT).toContain('file_scope');
  });

  it('contains signal framework section for integration_surface', () => {
    expect(CLASSIFIER_PROMPT).toContain('integration_surface');
  });

  it('contains signal framework section for ambiguity', () => {
    expect(CLASSIFIER_PROMPT).toContain('ambiguity');
  });

  it('contains signal framework section for domain_novelty', () => {
    expect(CLASSIFIER_PROMPT).toContain('domain_novelty');
  });

  it('contains signal framework section for cross_cutting', () => {
    expect(CLASSIFIER_PROMPT).toContain('cross_cutting');
  });

  it('contains classification rules for Simple, Medium, Complex', () => {
    expect(CLASSIFIER_PROMPT).toContain('Simple');
    expect(CLASSIFIER_PROMPT).toContain('Medium');
    expect(CLASSIFIER_PROMPT).toContain('Complex');
  });

  it('contains output format with JSON structure', () => {
    expect(CLASSIFIER_PROMPT).toContain('"tier"');
    expect(CLASSIFIER_PROMPT).toContain('"confidence"');
    expect(CLASSIFIER_PROMPT).toContain('"rationale"');
    expect(CLASSIFIER_PROMPT).toContain('"signals"');
  });

  it('contains placeholders for task_description and project_summary', () => {
    expect(CLASSIFIER_PROMPT).toContain('{task_description}');
    expect(CLASSIFIER_PROMPT).toContain('{project_summary_from_state_md}');
  });
});

// ---- classifyComplexity override tests ----

describe('classifyComplexity with override', () => {
  it('with override="simple" returns ComplexityResult with tier simple', () => {
    const result = classifyComplexity({ taskDescription: 'anything', override: 'simple' });
    const cr = result as ComplexityResult;
    expect(cr.tier).toBe('simple');
    expect(cr.confidence).toBe('high');
    expect(cr.rationale).toContain('override');
  });

  it('with override="medium" returns ComplexityResult with tier medium', () => {
    const result = classifyComplexity({ taskDescription: 'anything', override: 'medium' });
    const cr = result as ComplexityResult;
    expect(cr.tier).toBe('medium');
    expect(cr.confidence).toBe('high');
    expect(cr.rationale).toContain('override');
  });

  it('with override="complex" returns ComplexityResult with tier complex', () => {
    const result = classifyComplexity({ taskDescription: 'anything', override: 'complex' });
    const cr = result as ComplexityResult;
    expect(cr.tier).toBe('complex');
    expect(cr.confidence).toBe('high');
    expect(cr.rationale).toContain('override');
  });

  it('with invalid override throws error', () => {
    expect(() => classifyComplexity({ taskDescription: 'test', override: 'invalid' })).toThrow();
  });
});

// ---- classifyComplexity without override (returns prompt) ----

describe('classifyComplexity without override', () => {
  it('returns object with prompt field when no override', () => {
    const result = classifyComplexity({ taskDescription: 'add a button', projectContext: 'React app' });
    expect(result).toHaveProperty('prompt');
    const promptResult = result as { prompt: string };
    expect(promptResult.prompt).toContain('add a button');
    expect(promptResult.prompt).toContain('React app');
  });
});

// ---- LABELED_TEST_CASES validation ----

describe('LABELED_TEST_CASES', () => {
  it('has exactly 20 entries', () => {
    expect(LABELED_TEST_CASES).toHaveLength(20);
  });

  it('each entry has description, projectContext, expectedTier, rationale fields', () => {
    for (const tc of LABELED_TEST_CASES) {
      expect(tc).toHaveProperty('description');
      expect(tc).toHaveProperty('projectContext');
      expect(tc).toHaveProperty('expectedTier');
      expect(tc).toHaveProperty('rationale');
      expect(typeof tc.description).toBe('string');
      expect(typeof tc.projectContext).toBe('string');
      expect(['simple', 'medium', 'complex']).toContain(tc.expectedTier);
      expect(typeof tc.rationale).toBe('string');
    }
  });

  it('contains at least 5 simple cases', () => {
    const simpleCount = LABELED_TEST_CASES.filter(tc => tc.expectedTier === 'simple').length;
    expect(simpleCount).toBeGreaterThanOrEqual(5);
  });

  it('contains at least 5 medium cases', () => {
    const mediumCount = LABELED_TEST_CASES.filter(tc => tc.expectedTier === 'medium').length;
    expect(mediumCount).toBeGreaterThanOrEqual(5);
  });

  it('contains at least 5 complex cases', () => {
    const complexCount = LABELED_TEST_CASES.filter(tc => tc.expectedTier === 'complex').length;
    expect(complexCount).toBeGreaterThanOrEqual(5);
  });

  it('contains edge cases with same description but different contexts', () => {
    const descriptions = LABELED_TEST_CASES.map(tc => tc.description);
    const duplicates = descriptions.filter((d, i) => descriptions.indexOf(d) !== i);
    expect(duplicates.length).toBeGreaterThanOrEqual(1);
  });
});
