import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

describe('FOUND-04: Context engineering preserved', () => {
  it('executor agent contains files_to_read block', () => {
    const executorPath = path.join(ROOT, 'agents', 'gsdr-executor.md');
    const content = fs.readFileSync(executorPath, 'utf-8');
    expect(content).toContain('files_to_read');
  });

  it('agent files do not inline large code blocks that should be @path references', () => {
    const agentsDir = path.join(ROOT, 'agents');
    const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));

    for (const file of agentFiles) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
      // Look for code blocks longer than 500 chars that look like inlined file content
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      for (const block of codeBlocks) {
        // Allow long code blocks that are examples/templates within agent instructions
        // Flag blocks that look like they should be file references (contain full file paths)
        if (block.length > 500) {
          const hasFilePath = /[A-Z]:\\|\/home\/|\/usr\//.test(block);
          expect(
            hasFilePath,
            `${file} has a >500 char code block with hardcoded file paths that should be @path references`
          ).toBe(false);
        }
      }
    }
  });

  it('skills with context: fork properly delegate to agents', () => {
    const skillsDir = path.join(ROOT, 'skills');
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

    let forkCount = 0;
    for (const dir of skillDirs) {
      const skillPath = path.join(skillsDir, dir.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      const content = fs.readFileSync(skillPath, 'utf-8');
      if (content.includes('context: fork')) {
        forkCount++;
        // Skills with context: fork should reference an agent or have agent delegation
        const hasAgent = content.includes('agent:') || content.includes('gsdr-');
        expect(hasAgent, `Skill ${dir.name} has context: fork but no agent reference`).toBe(true);
      }
    }
    expect(forkCount, 'Should have at least one skill with context: fork').toBeGreaterThan(0);
  });

  it('representative skills use ${CLAUDE_SKILL_DIR} for path references', () => {
    const skillsToCheck = ['plan-phase', 'execute-phase', 'new-project'];
    const skillsDir = path.join(ROOT, 'skills');

    for (const skill of skillsToCheck) {
      const skillPath = path.join(skillsDir, skill, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      const content = fs.readFileSync(skillPath, 'utf-8');
      // Skills that reference other files should use ${CLAUDE_SKILL_DIR}
      if (content.includes('dist/') || content.includes('references/') || content.includes('templates/')) {
        expect(
          content,
          `Skill ${skill} references paths but doesn't use \${CLAUDE_SKILL_DIR}`
        ).toContain('${CLAUDE_SKILL_DIR}');
      }
    }
  });
});
