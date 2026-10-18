// T1: nightly scheduling uses candidate facts, semantic executor receipts and a FakeClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';

test('nightly submits once after UTC time and skips an unchanged candidate across restart', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true }, 'soak="12:01"');
  const greenLog = '# tests 1\n# pass 1\nsuite timing {"file":"hub/test/example.test.ts","name":"old","seconds":0.01}\n';
  // The fake stream must keep the same byte prefix across completion.
  f.machine.script({ outcome: 'slow', log: greenLog });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 0, 'before configured UTC time');
  f.clock.block(60_000); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 1);
  const job = (await f.jobs())[0]!;
  assert.equal(job.occasion, 'soak');
  assert.equal(job.executor, 'droplet');
  assert.equal(job.integrated, true);
  assert.equal(job.topic, 'general');
  assert.deepEqual(job.to, ['coordinator']);
  assert.equal(job.selection?.soak, true);
  assert.equal(job.selection?.loadGate, true);
  assert.equal(job.shards, undefined, 'one droplet holds the nightly run');
  await f.machine.waits.run(f.machine.started(job.id));
  await f.tick(); await f.suites.settled(); // Observe streaming before the completion receipt.
  assert.match(await f.log(job.id), /^suite timing .*old/m, 'observe the streamed identity before completion');
  await f.finish(job.id, 0, greenLog);
  await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 1, 'same UTC attempt survives restart');
  f.clock.block(86_400_000); await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 1, 'same candidate tree needs no new soak');
  f.candidate.head = 'b'.repeat(40); f.candidate.tree = 'e'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  f.clock.block(86_400_000); await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 2, 'changed candidate gets the next nightly run');
  const next = (await f.jobs())[1]!;
  assert.deepEqual(next.selection?.loadGateBaseline, { run: job.id, tests: ['hub/test/example.test.ts::old'] });
  const merge = { item: 'T-99', branch: 't/queued', head: 'c'.repeat(40), verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coordinator', name: 'coordinator', role: 'coordinator' } };
  f.store.enqueueMerge(merge);
  await f.machine.waits.run(f.machine.started(next.id));
  await f.finish(next.id, 1);
  assert.deepEqual(f.store.mergeQueue(), [merge], 'a red soak does not alter queued merges');
});

test('soak configuration validates UTC HH:MM and preserves empty disable on render', () => {
  for (const time of ['', '00:00', '03:00', '23:59']) {
    const config = parseConfig(`[verification]\nsoak=${JSON.stringify(time)}`, 'test');
    assert.equal(parseConfig(renderConfig(config), 'test').verification.soak, time);
  }
  for (const time of ['3:00', '24:00', '03:60', '03:00Z', 300]) {
    assert.throws(() => parseConfig(`[verification]\nsoak=${JSON.stringify(time)}`, 'test'), /verification.soak/);
  }
});
