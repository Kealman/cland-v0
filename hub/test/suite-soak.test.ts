// T1: nightly scheduling uses candidate facts, semantic executor receipts and a FakeClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { releaseT3Cover } from '../src/hub/suites.ts';
import { devT3Result } from '../src/hub/dev-t3-result.ts';
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

test('periodic dev T3 waits two hours, skips unchanged dev and survives restart without overlap', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true }, 'dev_t3_every="2h"\nlifetime="6h"\nrun_timeout="5h"');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 0);
  // Restart across simulated downtime instead of replaying 7200 unrelated ticks.
  f.clock.block(7_198_000); await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 0, 'one second before the two-hour cursor');
  await f.tick(); await f.suites.settled();
  const first = (await f.jobs())[0]!;
  assert.ok(first);
  assert.equal(first.occasion, 'dev-t3');
  assert.equal(first.actor, null);
  assert.equal(first.executor, 'droplet');
  assert.deepEqual(first.selection?.tiers, ['T3']);
  assert.equal(first.selection?.soak, false);
  assert.equal(first.shards, undefined);
  assert.deepEqual(first.to, ['coordinator']);
  await f.machine.waits.run(f.machine.started(first.id));
  await f.reopen();
  f.candidate.head = 'b'.repeat(40); f.candidate.tree = 'e'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  f.clock.block(7_200_000); await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 1, 'a running periodic run prevents overlap');
  await f.finish(first.id);
  assert.deepEqual(releaseT3Cover(f.store, first.tree!), { run: first.id, head: first.head }, 'executed periodic receipt supplies release coverage');
  await f.tick(); await f.suites.settled();
  const next = f.suites.status()[1]!;
  assert.ok(next, 'moved dev receives the next due run');
  await f.machine.waits.run(f.machine.started(next.id));
  await f.finish(next.id, 1);
  assert.equal(releaseT3Cover(f.store, f.candidate.tree!), null, 'red periodic receipt cannot cover release');
  f.clock.block(7_200_000); await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 2, 'unchanged head is not repeated, even after red and restart');
  assert.equal(f.store.mergeQueue().length, 0);
});

test('periodic T3 configuration round-trips duration and disable settings', () => {
  for (const interval of ['', '2h', '30m']) {
    const c = parseConfig(`[verification]\ndev_t3_every=${JSON.stringify(interval)}`, 'test');
    assert.equal(parseConfig(renderConfig(c), 'test').verification.devT3Every, interval);
    assert.equal(c.verification.devT3EveryMs, interval === '' ? 0 : interval === '2h' ? 7_200_000 : 1_800_000);
  }
  for (const value of ['0', '"0h"', '"soon"']) assert.throws(() => parseConfig(`[verification]\ndev_t3_every=${value}`, 'test'), /dev_t3_every/);
});

test('periodic result exposes failing files, pinned heads and the first-parent merge range', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true }, 'dev_t3_every="1s"');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.tick(); f.clock.block(1000); await f.tick(); await f.suites.settled();
  const first = (await f.jobs())[0]!;
  await f.machine.waits.run(f.machine.started(first.id)); await f.finish(first.id);
  f.candidate.head = 'b'.repeat(40); f.candidate.tree = 'e'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  f.clock.block(1000); await f.tick(); await f.suites.settled();
  const second = (await f.jobs()).find(job => job.id !== first.id)!;
  assert.deepEqual(second.devT3, { previousGreenHead: first.head, previousGreenRun: first.id });
  await f.machine.waits.run(f.machine.started(second.id));
  await f.finish(second.id, 1, 'suite test failures [{"file":"hub/test/example.test.ts","name":"failed"}]\n# tests 1\n# fail 1\n');
  const result = await devT3Result((await f.suites.receipt(second.id)).job,
    'suite test failures [{"file":"hub/test/example.test.ts","name":"failed"}]\n', { id: 'A-1', path: '/durable/log' }, async args => {
      assert.deepEqual(args, ['log', '--first-parent', '--reverse', '--format=%H%x00%s', `${first.head}..${second.head}`, '--']);
      return `${second.head}\0Merge T-123`;
    });
  assert.equal(result.previousGreenHead, first.head);
  assert.equal(result.previousGreenRun, first.id);
  assert.equal(result.head, second.head);
  assert.equal(result.result, 'red');
  assert.deepEqual(result.failingFiles, ['hub/test/example.test.ts']);
  assert.deepEqual(result.merges, [{ head: second.head, subject: 'Merge T-123' }]);
});
