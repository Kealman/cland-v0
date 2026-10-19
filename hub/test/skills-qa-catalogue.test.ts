// T1: shipped QA catalogue, role lists and skill documentation are source contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, constants } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SKILL = join(REPO, '.agents', 'skills', 'qa');
const RECORD = join(SKILL, 'qa-record.sh');
const HEADER_FIELDS = ['id', 'title', 'preconditions', 'expected', 'since', 'regression'];

test('shipped QA cases declare complete ordered catalogue headers', async () => {
  const dir = join(REPO, 'qa', 'cases');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.lua'));
  assert.ok(files.length >= 2, 'the shipped cases');
  for (const file of files) {
    const text = await readFile(join(dir, file), 'utf8');
    const header = new Map<string, string>();
    for (const line of text.split('\n')) {
      const m = /^-- ([a-z]+): (.+)$/.exec(line);
      if (!m) break;
      header.set(m[1] as string, m[2] as string);
    }
    assert.deepEqual([...header.keys()], HEADER_FIELDS, `${file} opens with the header fields, in order`);
    assert.equal(header.get('id'), file.replace(/\.lua$/, ''), `${file}: id is the file name`);
    assert.match(header.get('regression') as string, /^(yes|no)$/, `${file}: regression is yes or no`);
  }
});

test('default QA roles include the skill and matching self-contained briefs', async () => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  assert.ok(roles.get('qa')?.skills.includes('qa'), 'QA has the qa skill');
  assert.ok(roles.get('coordinator')?.skills.includes('qa'), 'the Coordinator has the qa skill');
  for (const role of ['qa', 'coordinator']) assert.match(roles.get(role)?.clause ?? '', /qa\/briefs\/T-<n>\.md/, `the ${role} clause names the brief`);
  assert.match(await readFile(join(SKILL, 'SKILL.md'), 'utf8'), /^---\nname: qa\n/);
  accessSync(RECORD, constants.R_OK);
  // the brief template and the shipped brief have the same sections, and the shipped brief names cases that exist
  const section = (text: string) => [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const template = await readFile(join(SKILL, 'BRIEF.md'), 'utf8');
  const brief = await readFile(join(REPO, 'qa', 'briefs', 'T-62.md'), 'utf8');
  assert.deepEqual(section(brief), section(template));
  // self-contained: the build is resolved by a rule in the brief, never by what a request says
  for (const text of [brief, template]) {
    assert.match(text, /tip of that branch when the run starts/);
    assert.doesNotMatch(text, /commit the request names/);
  }
  for (const id of [...brief.matchAll(/^\| `([A-Z]+-\d+)` \|/gm)].map((m) => m[1])) accessSync(join(REPO, 'qa', 'cases', `${id}.lua`), constants.R_OK);
});

test('QA skill documents recovery and both evidence directory failures', async () => {
  const text = await readFile(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(text, /qa-record\.sh recover T-<n> <run> <captures-dir> lines\.jsonl/);
  assert.match(text, /Neither directory can be written/);
  assert.match(text, /cannot be written: the script keeps the captures/);
  assert.match(text, /every block the script printed on stderr after `no evidence directory could be made`, verbatim/);
});

test('QA briefs resolve the build at the current tip and block mismatched requests', async () => {
  for (const file of [join(SKILL, 'BRIEF.md'), join(REPO, 'qa', 'briefs', 'T-62.md')]) {
    assert.match(await readFile(file, 'utf8'), /honoured when it equals HEAD; when it differs, record `BLOCKED` naming both commits/);
  }
});

test('QA aside policy routes findings to the Coordinator and Bugs category', async () => {
  const text = await readFile(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(text, /outside the item under test.*bug found aside/);
  assert.match(text, /--parent C-<n> --label qa-found --label needs-triage/);
  assert.match(text, /category Bugs/);
});
