// T2: batch selection reads a disposable candidate, with Git replaced at its public boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { batchInteractionSelection } from '../src/suite-interactions.ts';
import { selectionFromEnv, type SuiteSelection } from '../src/suite-selection.ts';
import { batchInteractionSummary } from '../src/hub/merge-batches.ts';
import { fakeOnlyFixture } from './fake-only-fixture.ts';

test('T3 report transport keeps older reports and refuses executable proposals', () => {
  const old: SuiteSelection = { mode: 'full', files: [], reason: 'batch', batchInteraction: { mode: 'run', files: [], phases: [], reason: 'batch' } };
  assert.deepEqual(selectionFromEnv({ CLAND_SUITE_SELECTION: JSON.stringify(old) }), old);
  const t3 = { mode: 'report' as const, files: ['hub/test/native.test.ts'], reason: 'importers' };
  const updated: SuiteSelection = { ...old, batchInteraction: { ...old.batchInteraction!, t3 } };
  assert.deepEqual(selectionFromEnv({ CLAND_SUITE_SELECTION: JSON.stringify(updated) }), updated);
  assert.deepEqual(batchInteractionSummary(updated.batchInteraction).t3, { mode: 'report', selectedFileCount: 1, examples: t3.files });
  assert.throws(() => selectionFromEnv({ CLAND_SUITE_SELECTION: JSON.stringify({ ...old, batchInteraction: { ...old.batchInteraction, t3: { ...t3, mode: 'run' } } }) }), /invalid T3 interaction report/);
});

test('batch T3 importer proposals stay report only even when T2 additions run', async t => fakeOnlyFixture(t, async root => {
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, 'hub/src'), { recursive: true });
  await writeFile(join(root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/native.test.ts': 'T3', 'hub/test/other.test.ts': 'T3',
  } }));
  await writeFile(join(root, 'hub/test/native.test.ts'), "import '../src/shared.ts';");
  await writeFile(join(root, 'hub/test/other.test.ts'), 'export {};');
  await writeFile(join(root, 'hub/src/shared.ts'), 'export const value = 1;');
  const baseline = { mode: 'full' as const, files: [], reason: 'batch', tiers: ['T1' as const], web: 'none' as const };
  const result = await batchInteractionSelection(root, baseline, ['member'], async () => 'hub/src/shared.ts\0', undefined, 'run');
  assert.deepEqual(result.batchInteraction?.t3, { mode: 'report', files: ['hub/test/native.test.ts'], reason: 'T3 sibling-merge importers' });
  assert.deepEqual(result.tiers, ['T1']);
  assert.deepEqual(result.files, []);
  assert.deepEqual(result.interactionTests, []);
  const empty = await batchInteractionSelection(root, baseline, ['member'], async () => 'docs/readme.md\0');
  assert.deepEqual(empty.batchInteraction?.t3?.files, []);
  const covered = await batchInteractionSelection(root, { ...baseline, tiers: ['T1', 'T3'] }, ['member'], async () => 'hub/src/shared.ts\0');
  assert.deepEqual(covered.batchInteraction?.t3?.files, []);
  const unavailable = await batchInteractionSelection(root, baseline, ['member'], async () => 'hub/src/shared.ts\0', async () => { throw new Error('scanner unavailable'); }, 'run');
  assert.equal(unavailable.batchInteraction?.t3?.files, null);
  assert.deepEqual(unavailable.tiers, ['T1']);
}));
