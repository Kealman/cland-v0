// T1: the provenance lint boundary rejects absent/empty records without subprocesses.
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { Report } from '../src/init/files.ts';
import { provisionSkills } from '../src/init/skills.ts';
import { checkSkillProvenance } from './lint-skill-provenance.ts';

test('provenance lint requires records behind the stable changes pointer', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-provenance-lint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL('../../.agents/skills/implement/', import.meta.url), root, { recursive: true });
  const folder = pathToFileURL(`${root}/`);
  const records = join(root, 'CHANGES');
  await rm(records, { recursive: true });
  await assert.rejects(() => checkSkillProvenance(folder, 'implement'), /CHANGES/);
  await mkdir(records);
  await assert.rejects(() => checkSkillProvenance(folder, 'implement'), /CHANGES.*entry/);
  await writeFile(join(records, 'test.md'), ' \n\n');
  await assert.rejects(() => checkSkillProvenance(folder, 'implement'), /CHANGES.*(?:empty|entry|record)/);
  await writeFile(join(records, 'test.md'), 'Test-first merge-safe provenance (T-1145)\n');
  await checkSkillProvenance(folder, 'implement');
});


test('skill update migrates an untouched CHANGES file to entries and preserves an edited copy', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'cland-provenance-update-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const source = join(scratch, 'source');
  const skill = join(source, 'implement');
  await cp(new URL('../../.agents/skills/implement/', import.meta.url), skill, { recursive: true });
  await rm(join(skill, 'CHANGES'), { recursive: true });
  await writeFile(join(skill, 'CHANGES'), 'old entry\n');
  const untouched = join(scratch, 'untouched');
  const edited = join(scratch, 'edited');
  for (const root of [untouched, edited]) provisionSkills(new Report(root), root, source);
  await writeFile(join(edited, '.agents/skills/implement/CHANGES'), 'project edit\n');
  await rm(join(skill, 'CHANGES'));
  await mkdir(join(skill, 'CHANGES'));
  await writeFile(join(skill, 'CHANGES/T-1455.md'), 'old entry\n');
  for (const root of [untouched, edited]) provisionSkills(new Report(root), root, source);
  assert.equal(await readFile(join(untouched, '.agents/skills/implement/CHANGES/T-1455.md'), 'utf8'), 'old entry\n');
  const manifest = JSON.parse(await readFile(join(untouched, '.agents/skills/.cland-manifest.json'), 'utf8'));
  assert.match(manifest.skills.implement['CHANGES/T-1455.md'], /^[a-f0-9]{64}$/);
  assert.equal(manifest.skills.implement.CHANGES, undefined);
  assert.equal(await readFile(join(edited, '.agents/skills/implement/CHANGES'), 'utf8'), 'project edit\n');
});
