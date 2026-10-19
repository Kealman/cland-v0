// T1: known-identity admission uses semantic worker receipts and in-process store recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { suiteUnit } from './suite-unit-fixture.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';

test('task load proofs become known only after their exact head lands on dev', async t => {
  let landing: { tip: string; branch: string; base: string } | null = null;
  const f = await suiteUnit(t, { machineReceiptsOnly: true, taskLanding: () => landing });
  f.candidate.selection.loadGate = true;
  const file = 'hub/test/example.test.ts';
  const identity = `${file}::proved`;
  const first = await f.launch({ item: 'T-1', fresh: true });
  await f.finish(first.id, 0, `load gate: ${identity} 5/5 passed\nload gate: ${file}::skipped skipped, not load-gated; 5/5 skipped; reasons: ["missing binary"]\nload gate: ${file}::partial 4/5 passed\nquarantine load gate: ${file}::quarantined 4/5 passed; 1/5 quarantined failures\n`);
  await rm((await f.suites.receipt(first.id)).job.log); // Durable proofs survive log retention as well as restart.
  await f.reopen();
  for (const state of ['unlanded', 'wrong head', 'wrong branch', 'wrong base', 'landed'] as const) {
    landing = state === 'unlanded' ? null : { tip: state === 'wrong head' ? 'b'.repeat(40) : f.candidate.head,
      branch: state === 'wrong branch' ? 'other' : f.candidate.branch, base: state === 'wrong base' ? 'main' : 'dev' };
    const next = await f.launch({ item: 'T-2', fresh: true });
    const selection = f.status(next.id).selection;
    assert.equal(loadGateRepetitions(identity, selection, {}), state === 'landed' ? 0 : 5, state);
    assert.equal(loadGateRepetitions(identity, { ...selection!, loadGateBaseline: { run: null, tests: [] } }, {}), 5, 'occasion baselines are independent');
    for (const name of ['new', 'skipped', 'partial', 'quarantined']) assert.equal(loadGateRepetitions(`${file}::${name}`, selection, {}), 5, name);
    assert.equal(loadGateRepetitions(`${file}::baseline`, selection, { [`${file}::baseline`]: 1 }), 0);
    await f.finish(next.id);
  }
});


test('only completed reported task greens backfill retained pre-upgrade proofs', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true,
    taskLanding: () => ({ tip: f.candidate.head, branch: f.candidate.branch, base: 'dev' }) });
  f.candidate.selection.loadGate = true;
  const identity = 'hub/test/example.test.ts::legacy';
  const first = await f.launch({ item: 'T-1', fresh: true });
  await f.finish(first.id, 0, `load gate: ${identity} 5/5 passed\n`);
  const original = (await f.suites.receipt(first.id)).job;
  delete original.loadProofs;
  const variants = [
    { outcome: { code: 1, cause: 'failed' } }, { cancelled: true }, { requesterDied: true },
    { reported: false, reportFailedPermanently: true }, { cached: { run: 'other', head: original.head, tree: original.tree! } },
    { integrated: true }, { occasion: 'stage' as const }, { item: null },
    { selection: { ...original.selection!, loadGate: false } }, {},
  ];
  for (const [i, patch] of variants.entries()) {
    await f.reopen([{ ...original, ...patch }]);
    const next = await f.launch({ item: 'T-2', fresh: true });
    assert.equal(loadGateRepetitions(identity, f.status(next.id).selection, {}), i === variants.length - 1 ? 0 : 5, JSON.stringify(patch));
    await f.finish(next.id);
  }
});
