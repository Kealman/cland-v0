// T1: periodic/nightly policy and culprit filing use candidate facts, fake runner receipts and a FakeClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { releaseT3Cover } from '../src/hub/suites.ts';
import { devT3Result } from '../src/hub/dev-t3-result.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { DevT3Search } from '../src/hub/dev-t3-search.ts';
import { reportDevT3Search } from '../src/hub/dev-t3-report.ts';
import { HubCore } from '../src/hub/core.ts';
import { Tracker } from '../src/tracker/tracker.ts';

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
  assert.deepEqual(first.selection?.tiers, ['T2', 'T3']);
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

test('periodic T2/T3 failures reach Bug filing through the culprit search', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true }, 'dev_t3_every="1s"');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.tick(); f.clock.block(1000); await f.tick(); await f.suites.settled();
  const first = (await f.jobs())[0]!;
  assert.deepEqual(first.selection?.tiers, ['T2', 'T3']);
  assert.equal(first.selection?.loadGate, false);
  await f.machine.waits.run(f.machine.started(first.id)); await f.finish(first.id);
  f.candidate.head = 'b'.repeat(40); f.candidate.tree = 'e'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  f.clock.block(1000); await f.tick(); await f.suites.settled();
  const second = (await f.jobs()).find(job => job.id !== first.id)!;
  assert.deepEqual(second.devT3, { previousGreenHead: first.head, previousGreenRun: first.id });
  await f.machine.waits.run(f.machine.started(second.id));
  const files = ['hub/test/process.test.ts', 'hub/test/verify-tool.test.ts'];
  const log = `suite test failures ${JSON.stringify(files.map(file => ({ file, name: 'failed' })))}\n# tests 2\n# fail 2\n`;
  await f.finish(second.id, 1, log);
  const result = await devT3Result((await f.suites.receipt(second.id)).job,
    log, { id: 'A-1', path: '/durable/log' }, async args => {
      assert.deepEqual(args, ['log', '--first-parent', '--reverse', '--format=%H%x00%s', `${first.head}..${second.head}`, '--']);
      return `${second.head}\0Merge T-123`;
    });
  assert.equal(result.previousGreenHead, first.head);
  assert.equal(result.previousGreenRun, first.id);
  assert.equal(result.head, second.head);
  assert.equal(result.result, 'red');
  assert.deepEqual(result.failingFiles, files);
  assert.deepEqual(result.merges, [{ head: second.head, subject: 'Merge T-123' }]);
  const tracker = new Tracker({ root: f.root, db: ':memory:', clock: f.clock, git: async () => null, readBase: async () => null });
  const core = new HubCore({ clock: f.clock });
  t.after(async () => { await tracker.stop(); core.close(); core.store.close(); });
  const probes: Array<{ head: string; file: string }> = [];
  const search = new DevT3Search(f.store, {
    probe: async (_input, head, file) => {
      probes.push({ head, file });
      return { head, file, run: `probe-${probes.length}`, result: head === first.head ? 'green' : 'red', artifact: 'A-2', path: '/durable/probe' };
    },
    report: report => reportDevT3Search(core, tracker, report),
  });
  search.accept(result);
  for (let i = 0; i < 5; i++) await search.tick();
  assert.deepEqual(probes, files.flatMap(file => [{ head: second.head, file }, { head: first.head, file }]));
  const bugs = tracker.list().filter(item => item.labels.includes(`dev-t3-${second.head}`));
  assert.equal(bugs.length, 1, 'one Bug groups T2 and T3 failures at the same culprit merge');
  assert.equal(tracker.list().find(item => item.id === bugs[0]!.parent)!.title, 'Bugs');
  const bug = tracker.view(bugs[0]!.id);
  for (const value of [...files, first.head, second.head, first.id, second.id, '/durable/log', '/durable/probe']) assert.ok(bug.body.includes(value), value);
  const report = core.topicHistory('general').messages.find(message => message.detail?.event === 'verification-dev-t3-search');
  assert.ok(report, 'same durable result interface reaches the existing search report');
  search.accept(result); await search.tick();
  assert.equal(tracker.list().filter(item => item.labels.includes(`dev-t3-${second.head}`)).length, 1);
});
