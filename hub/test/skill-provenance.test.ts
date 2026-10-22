// T1: the provenance lint boundary rejects absent/empty records without subprocesses.
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { checkSkillProvenance } from './lint-skill-provenance.ts';

test('provenance lint requires records behind the stable changes pointer', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-provenance-lint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL('../../.agents/skills/implement/', import.meta.url), root, { recursive: true });
  const folder = pathToFileURL(`${root}/`);
  const records = join(root, 'CHANGES');
  await rm(records);
  await assert.rejects(() => checkSkillProvenance(folder, 'implement'), /CHANGES/);
  await writeFile(records, ' \n\n');
  await assert.rejects(() => checkSkillProvenance(folder, 'implement'), /CHANGES.*(?:empty|entry|record)/);
  await writeFile(records, 'Test-first merge-safe provenance (T-1145)\n');
  await checkSkillProvenance(folder, 'implement');
});
