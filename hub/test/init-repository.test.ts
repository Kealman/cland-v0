// T1: an empty ownership selector does no Git work and cannot adopt unrelated files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Report } from '../src/init/files.ts';
import { commitClandFiles } from '../src/init/repository.ts';
import { emptyFolder, scratchMachine, snapshot } from './init-machine.ts';

test('an empty provision report cannot become repository-wide staging', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await writeFile(join(root, 'private.txt'), 'private content');
  const before = await snapshot(root);
  assert.doesNotThrow(() => commitClandFiles(new Report(root), root));
  assert.deepEqual(await snapshot(root), before);
  assert.equal(await readFile(join(root, 'private.txt'), 'utf8'), 'private content');
});
