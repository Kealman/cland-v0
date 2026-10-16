import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

const SKILLS = new URL('../../.agents/skills/', import.meta.url);

test('every shipped skill keeps Codex implicit invocation consistent with its frontmatter', async () => {
  const skills = (await readdir(SKILLS, { withFileTypes: true })).filter(entry => entry.isDirectory());
  assert.ok(skills.length > 0, 'the shipped skill set is not empty');
  const mismatches: string[] = [];
  for (const skill of skills) {
    const markdown = await readFile(new URL(`${skill.name}/SKILL.md`, SKILLS), 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1];
    assert.ok(frontmatter, `${skill.name}: SKILL.md has frontmatter`);
    const metadata = parseYaml(frontmatter);
    // cland's own skills may have no Codex override; that leaves implicit invocation enabled.
    const yaml = await readFile(new URL(`${skill.name}/agents/openai.yaml`, SKILLS), 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    });
    const codex = parseYaml(yaml);
    if ((codex?.policy?.allow_implicit_invocation === false) !== (metadata['disable-model-invocation'] === true)) {
      mismatches.push(skill.name);
    }
  }
  assert.deepEqual(mismatches, [], 'Codex policy and disable-model-invocation disagree for these skills');
});
