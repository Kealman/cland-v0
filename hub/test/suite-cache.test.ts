// T1: cache eligibility and provenance at Suites; real Git/run recovery stays in suite-cache-recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { suiteUnit } from './suite-unit-fixture.ts';

test('selected-run cache reuse requires the same covering test files', async t => {
  const f = await suiteUnit(t);
  f.candidate.selection = { mode: 'hub-selected', files: ['hub/src/example.ts'], reason: 'coverage', tests: ['hub/test/first.test.ts'] };
  const first = await f.launch(); await f.finish(first.id);
  const same = await f.launch(); assert.equal(same.cached?.run, first.id); await f.result(same.id);
  f.candidate.selection.tests = ['hub/test/second.test.ts'];
  const other = await f.launch(); assert.equal(other.cached, undefined); await f.finish(other.id);
  assert.equal(f.delivered.size, 2);
});

test('verify reuses a green candidate tree after a tracker-only commit and reports original provenance', async t => {
  const f = await suiteUnit(t);
  const head = f.candidate.head;
  const original = await f.launch(); await f.finish(original.id);
  const same = await f.launch(); assert.equal(same.pid, null); assert.equal(same.cached?.run, original.id); await f.result(same.id);
  assert.equal(f.status(same.id).executor, f.status(original.id).executor);
  assert.deepEqual(f.status(same.id).platform, f.status(original.id).platform);
  const originalTree = f.candidate.tree;
  f.candidate.head = 'b'.repeat(40); // Tracker-only commit leaves the candidate tree intact.
  const tracker = await f.launch(); assert.equal(tracker.cached?.run, original.id); assert.equal(tracker.cached?.tree, originalTree);
  await f.result(tracker.id);
  assert.equal(f.status(tracker.id).head, f.candidate.head);
  assert.deepEqual(tracker.cached, { run: original.id, head, tree: originalTree });
  assert.match(await f.log(tracker.id), new RegExp(`Original run ${original.id} · head ${head}`));
  assert.match(await f.log(tracker.id), new RegExp(`Requested head ${f.candidate.head}`));
  f.candidate.tree = 'e'.repeat(40);
  const changed = await f.launch(); assert.equal(changed.cached, undefined); await f.finish(changed.id);
  assert.equal(f.delivered.size, 2);
});

for (const cancellation of ['requester', 'head change'] as const) test(`a fresh attempt cancelled by ${cancellation} preserves the original green cache evidence`, async t => {
  const f = await suiteUnit(t);
  const original = await f.launch(); await f.finish(original.id);
  f.hold(true);
  const fresh = await f.launch({ fresh: true }); assert.equal(fresh.pid, null); assert.equal(fresh.cached, undefined);
  if (cancellation === 'requester') await f.suites.cancel(fresh.id, null, () => {});
  else {
    f.candidate.head = 'b'.repeat(40); f.hold(false); await f.tick();
    await f.when(() => f.status(fresh.id).outcome ?? undefined);
    await f.tick(); // Observe the head-rejection receipt before its reporting tick.
  }
  assert.match((await f.result(fresh.id)).outcome!.cause, /cancelled/);
  const hit = await f.launch(); assert.equal(hit.cached?.run, original.id); assert.equal(hit.pid, null); await f.result(hit.id);
  assert.match(await f.log(hit.id), new RegExp(`Original run ${original.id}`));
  assert.equal(f.delivered.size, 1);
});

test('verify --fresh runs despite a green cache and cache hits do not extend expiry', async t => {
  const f = await suiteUnit(t, { cacheMaxAgeMs: 6000 });
  const first = await f.launch(); await f.finish(first.id);
  const forced = await f.launch({ fresh: true }); assert.equal(forced.cached, undefined); assert.notEqual(forced.id, first.id); await f.finish(forced.id);
  await f.tick(3000);
  const cached = await f.launch(); assert.equal(cached.cached?.run, forced.id); await f.result(cached.id);
  // The original completion is the deadline, even with a hit halfway through.
  await f.tick(3000);
  const expired = await f.launch(); assert.equal(expired.cached, undefined); await f.finish(expired.id);
  assert.equal(f.delivered.size, 3);
});

test('dirty candidates bypass green cache and cannot seed a later clean result', async t => {
  const f = await suiteUnit(t);
  f.candidate.tree = null; // Untracked file.
  const dirty = await f.launch(); assert.equal(dirty.cached, undefined); await f.finish(dirty.id);
  f.candidate.tree = 'd'.repeat(40);
  const clean = await f.launch(); assert.equal(clean.cached, undefined); await f.finish(clean.id);
  for (const _state of ['unstaged', 'staged']) {
    f.candidate.tree = null;
    const changed = await f.launch(); assert.equal(changed.cached, undefined); await f.finish(changed.id);
  }
  f.candidate.tree = 'd'.repeat(40);
  const restored = await f.launch(); assert.equal(restored.cached?.run, clean.id); await f.result(restored.id);
  assert.equal(f.delivered.size, 4);
});

test('cache keys separate modes and workers; failed fresh attempts supersede green', async t => {
  const f = await suiteUnit(t);
  const green = await f.launch(); await f.finish(green.id);
  f.candidate.selection.mode = 'full';
  const mode = await f.launch(); assert.equal(mode.cached, undefined); await f.finish(mode.id);
  f.candidate.selection.mode = 'hub-only';
  const workers = await f.launch({ workers: 2 }); assert.equal(workers.cached, undefined); await f.finish(workers.id);
  const failed = await f.launch({ fresh: true }); await f.finish(failed.id, 1);
  const retry = await f.launch(); assert.equal(retry.cached, undefined); await f.finish(retry.id);
});

test('remote cache keys separate machine sizes and preserve executor provenance', async t => {
  const f = await suiteUnit(t);
  f.api.sizes.push({ slug: 'c-16', available: true, price_hourly: 0.5, disk: 100, regions: ['lon1'] }); f.api.regions[0]!.sizes.push('c-16');
  const first = await f.launch({ executor: 'droplet', size: 'c-8' });
  await f.machine.waits.run(f.when(() => f.status(first.id).state === 'running' ? true : undefined)); await f.machine.started(first.id); await f.finish(first.id);
  const same = await f.launch({ executor: 'droplet', size: 'c-8' }); assert.equal(same.cached?.run, first.id); await f.result(same.id);
  assert.equal(f.status(same.id).executor, 'droplet'); assert.deepEqual(f.status(same.id).platform, f.status(first.id).platform);
  const other = await f.launch({ executor: 'droplet', size: 'c-16' }); assert.equal(other.cached, undefined);
  await f.machine.waits.run(f.when(() => f.status(other.id).state === 'running' ? true : undefined)); await f.machine.started(other.id); await f.finish(other.id);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});


test('cache expiry still applies when candidate inspection was held across its deadline', async t => {
  const f = await suiteUnit(t, { cacheMaxAgeMs: 6000 });
  const green = await f.launch(); await f.finish(green.id);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  f.ownIO(() => release.resolve());
  f.beforeInspect(async () => { entered.resolve(); await release.promise; });
  let acknowledged = false;
  const pending = f.launch().then(job => { acknowledged = true; return job; });
  await entered.promise;
  await f.clock.advance(5000); // Original completion + 6000 ms, exactly the expiry boundary.
  assert.equal(acknowledged, false); assert.equal(f.delivered.size, 1, 'inspection I/O remains held');
  release.resolve(); const expired = await pending;
  assert.equal(expired.cached, undefined); await f.finish(expired.id); assert.equal(f.delivered.size, 2);
});

test('candidate inspection cleanup completes after a controlled pre-release assertion failure', async t => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  // Rescue a broken cleanup implementation after the runner cancels this test;
  // the passing path must finish cleanup while this hook has not yet run.
  t.after(() => release.resolve());
  const f = await suiteUnit(t);
  f.ownIO(() => release.resolve());
  f.beforeInspect(async () => { entered.resolve(); await release.promise; });
  const pending = f.launch();
  await entered.promise;
  assert.equal(f.delivered.size, 0, 'candidate inspection is still held');
  await assert.rejects(async () => {
    try { assert.fail('controlled pre-release assertion'); }
    finally { await f.close(); }
  }, { code: 'ERR_ASSERTION', message: 'controlled pre-release assertion' });
  const admitted = await pending;
  assert.ok(f.delivered.has(admitted.id), 'submission drained before the store closed');
  await assert.rejects(stat(f.root), { code: 'ENOENT' });
});
