// T1: queue snapshots, timing persistence and ETA mathematics on Suites.
// CLI formatting and a real package holder retain separate protocol/runner proofs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { suiteUnit } from './suite-unit-fixture.ts';
import type { VerificationQueue } from '../src/protocol.ts';

test('verification queue pushes holder and waiter changes without ticking elapsed time', async t => {
  const pushed: VerificationQueue[] = [];
  const f = await suiteUnit(t, { onQueue: queue => pushed.push(queue) });
  f.hold(true, { since: f.clock.now().toISOString(), holder: { pid: 123, started: null, token: 'hand', worktree: '/fixture', since: f.clock.now().toISOString() } });
  const first = await f.launch();
  await f.tick();
  await f.suites.settled();
  assert.equal(pushed.at(-1)?.holder?.pid, 123);
  assert.deepEqual(pushed.at(-1)?.waiters.map(w => w.id), [first.id]);
  const before = pushed.length;
  await f.tick(5000);
  await f.suites.settled();
  assert.equal(pushed.length, before, 'elapsed run, wait and ETA do not republish the queue');
  assert.ok((await f.suites.queue()).holder!.runMs! >= 5000, 'explicit reads still return current timing');
  const second = await f.launch();
  await f.tick();
  await f.suites.settled();
  assert.equal(pushed.length, before + 1);
  assert.deepEqual(pushed.at(-1)?.waiters.map(w => w.id), [first.id, second.id]);
  f.hold(false);
  await f.tick();
  await f.suites.settled();
  assert.equal(pushed.at(-1)?.holder?.id, first.id);
  assert.deepEqual(pushed.at(-1)?.waiters.map(w => w.id), [second.id]);
});

test('verify queue shows a hand holder, ordered waiters and unknown ETA; survives restart', async t => {
  const f = await suiteUnit(t);
  const shim = { since: f.clock.now().toISOString(), holder: { pid: 123, started: null, token: 'hand', worktree: '/hand/worktree', since: f.clock.now().toISOString() } };
  f.hold(true, shim);
  const first = await f.launch(); const second = await f.launch();
  assert.equal(first.pid, null);
  const check = async () => {
    const q = await f.suites.queue();
    assert.equal(q.version, 1); assert.equal(q.holder?.kind, 'hand run'); assert.equal(q.holder?.pid, 123); assert.equal(q.holder?.worktree, '/hand/worktree');
    assert.deepEqual(q.waiters.map(w => [w.id, w.position, w.session]), [[first.id, 1, 'caller-1'], [second.id, 2, 'caller-2']]);
    assert.ok(q.waiters.every(w => w.waitMs >= 0 && w.etaMs === null));
    assert.equal(q.metrics.window, 20); assert.equal(q.metrics.run.count, 0);
  };
  await check(); await f.reopen(); await check();
});

test('verify records wait/run timings, zero-time cache hits, recent median/p90 and a mode-aware ETA', async t => {
  const f = await suiteUnit(t);
  f.hold(true); const first = await f.launch();
  await f.tick(2000);
  assert.equal(f.suites.snapshot().waiters[0]!.waitMs, 2000);
  f.hold(false); await f.tick();
  await f.when(() => f.status(first.id).state === 'running' ? true : undefined);
  assert.equal(f.suites.snapshot().holder?.id, first.id);
  await f.tick(4000); await f.finish(first.id);
  const run = f.status(first.id);
  assert.equal(run.waitMs, 3000); assert.equal(run.runMs, 4000); assert.ok(run.admittedAt && run.completedAt);
  f.hold(true);
  const hit = await f.launch(); assert.equal(hit.cached?.run, first.id); await f.result(hit.id);
  const cached = f.status(hit.id);
  assert.equal(cached.waitMs, 0); assert.equal(cached.runMs, 0); assert.equal(cached.finished, run.finished); assert.notEqual(cached.completedAt, run.completedAt);
  assert.equal(run.executor, 'local'); assert.ok(run.platform); assert.equal(cached.executor, run.executor); assert.deepEqual(cached.platform, run.platform);
  const stats = f.suites.snapshot().metrics;
  assert.equal(stats.count, 2); assert.deepEqual(stats.run, { count: 2, medianMs: 2000, p90Ms: 4000 }); assert.deepEqual(stats.wait, { count: 2, medianMs: 1500, p90Ms: 3000 });
  const timing = f.logs.filter(e => e.event === 'verification-timing'); assert.equal(timing.length, 2);
  assert.equal(timing.find(e => e.id === hit.id)!.runMs, 0);
  for (const id of [first.id, hit.id]) { const entry = timing.find(e => e.id === id)!; assert.equal(entry.executor, 'local'); assert.deepEqual(entry.platform, run.platform); }
  const shim = { since: f.clock.now().toISOString(), holder: { pid: 123, started: null, token: 'hand', since: f.clock.now().toISOString() } };
  f.hold(true, shim);
  const fresh = await f.launch({ fresh: true }); const next = await f.launch({ fresh: true });
  const queue = await f.suites.queue();
  assert.deepEqual(queue.waiters.map(w => w.id), [fresh.id, next.id]); assert.equal(queue.waiters[0]!.expectedRunMs, 4000, 'cache zeros do not shorten execution estimates');
  assert.ok(queue.waiters[0]!.etaMs !== null && queue.waiters[0]!.etaMs >= 0);
  assert.equal(queue.waiters[1]!.etaMs! - queue.waiters[0]!.etaMs!, 4000);
  await f.reopen(); assert.deepEqual(f.suites.snapshot().metrics, stats); assert.equal(f.status(first.id).runMs, 4000);
  await f.tick();
  await f.suites.cancel(fresh.id, null, () => {}); await f.result(fresh.id);
  await f.suites.cancel(next.id, null, () => {}); await f.result(next.id);
  assert.equal(f.status(fresh.id).runMs, 0); assert.ok(f.status(fresh.id).waitMs! > 0);
  f.hold(false); const replacement = await f.launch({ fresh: true }); await f.finish(replacement.id);
  f.hold(true);
  for (let n = 0; n < 20; n++) {
    await f.tick(1); // Distinct completion instants establish the bounded history order.
    const hit = await f.launch(); assert.equal(hit.cached?.run, replacement.id); await f.result(hit.id);
  }
  const bounded = f.suites.snapshot(); assert.equal(bounded.waiters.length, 0);
  const { queueWait, ...legacy } = bounded.metrics;
  assert.deepEqual(legacy, { window: 20, count: 20, wait: { count: 20, medianMs: 0, p90Ms: 0 }, run: { count: 20, medianMs: 0, p90Ms: 0 } });
  assert.equal(queueWait?.last50Runs.local.count, 2); assert.equal(queueWait?.last50Runs.local.cacheHits, 21);
});

test('restored finished remote run excludes restart downtime from run timing and queue duration statistics', async t => {
  const f = await suiteUnit(t);
  const run = await f.launch();
  await f.tick(4000); await f.finish(run.id);
  const prior = (await f.jobs()).find(job => job.id === run.id)!;
  const admittedAt = prior.admittedAt!;
  const finished = new Date(Date.parse(admittedAt) + 4000).toISOString();
  Object.assign(prior, { executor: 'droplet', state: 'finished', finished, reported: false, artifact: null, cleaned: true });
  delete prior.lease; delete prior.completedAt; delete prior.runMs;
  await writeFile(prior.result, JSON.stringify({ code: 0, finished }));
  await f.suites.close();
  await f.clock.advance(60000);
  await f.reopen([prior]); await f.tick();
  const restored = await f.result(run.id);
  assert.equal(restored.completedAt, finished);
  assert.equal(restored.runMs, 4000);
  assert.deepEqual(f.suites.snapshot().metrics.run, { count: 1, medianMs: 4000, p90Ms: 4000 });
  await f.reopen();
  assert.equal(f.status(run.id).runMs, 4000);
});
