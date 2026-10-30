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

test('release skill records human conditional approval and checks every condition before publication', async () => {
  const skill = await readFile(new URL('release/SKILL.md', SKILLS), 'utf8');
  const conditional = skill.split('## Conditional release approval')[1]?.split('\n## ')[0];
  assert.ok(conditional, 'release skill has a conditional approval procedure');
  for (const requirement of [
    /daytime/,
    /Coordinator.*`ask`/,
    /human.*version.*conditions/s,
    /release epic is clear.*covers are green/,
    /Record.*ask.*answer.*release item/s,
    /each condition.*evidence.*before.*`cland release`/s,
    /missing.*failed.*pending/s,
    /version or.*notes.*fresh.*ask/s,
    /declined.*approval/s,
  ]) assert.match(conditional, requirement);
  assert.match(skill, /Once the preview is approved and every recorded condition is satisfied/);
});

test('conditional release approval survives only the human-approved readiness changes', async () => {
  const skill = await readFile(new URL('release/SKILL.md', SKILLS), 'utf8');
  const conditional = skill.split('## Conditional release approval')[1]?.split('\n## ')[0];
  assert.ok(conditional);
  assert.match(conditional, /ask.*future changes/s);
  assert.match(conditional, /reviewed fixes.*tracker.*evidence/s);
  assert.match(conditional, /within.*approved scope.*without another ask/s);
  assert.match(conditional, /outside.*scope.*fresh.*ask/s);
  assert.match(conditional, /final.*preview.*head.*cover/s);
  assert.match(skill, /For ordinary exact-build approval, if dev or the notes changed/);
  assert.doesNotMatch(conditional, /step 4 also requires a new\s+preview and approval when dev changes/);
});
