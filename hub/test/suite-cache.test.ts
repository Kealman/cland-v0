// T1: cache eligibility and provenance at Suites; real Git/run recovery stays in suite-cache-recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { webPhaseAvailable } from '../src/web-phase.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { suiteCase } from './suite-case-fixture.ts';

for (const request of ['explicit local', 'epic default'] as const) test(`${request} cache requires the requested executor and platform`, t => suiteCase(t, async ({ setup, step, guardControl }) => {
  const f = await setup(fixtures => suiteUnit(fixtures, { machineReceiptsOnly: true, localPlatform: process.platform }));
  guardControl();
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated full', fetchedDev: f.candidate.head, soak: true, loadGate: true };
  const input = request === 'explicit local' ? { executor: 'local' as const, mode: 'all' as const, integrated: true } : { occasion: 'epic' as const, mode: 'all' as const, integrated: true };
  for (const incompatible of ['droplet', 'wrong OS', 'unknown OS'] as const) {
    const original = await step('seed admission', () => f.launch({ ...input, fresh: true }));
    await step('seed completion', () => f.finish(original.id));
    const source = (await step('read source receipt', () => f.jobs())).find(job => job.id === original.id)!;
    source.occasion = 'stage';
    if (incompatible === 'droplet') source.executor = 'droplet';
    if (incompatible === 'unknown OS') delete source.platform;
    else source.platform!.os = incompatible === 'droplet' ? 'linux' : process.platform === 'linux' ? 'darwin' : 'linux';
    await step('restore incompatible receipt', () => f.reopen([source]));
    const run = await step('requested admission', () => f.launch(input));
    assert.equal(run.cached, undefined, incompatible);
    assert.equal(f.status(run.id).executor, 'local');
    assert.match((await step('read bypass receipt', () => f.jobs())).find(job => job.id === run.id)!.cacheBypass!, /executor.*platform/);
    await step('requested completion', () => f.finish(run.id));
  }
  const executions = f.delivered.size;
  const source = (await step('read compatible receipt', () => f.jobs())).find(job => job.id === f.reports.at(-1)!.id)!;
  await step('restore host platform receipt', () => f.reopen([source]));
  const hit = await step('compatible admission', () => f.launch(input));
  assert.equal(hit.cached?.run, source.id);
  const result = await step('compatible durable result', () => f.result(hit.id));
  assert.equal(result.executor, 'local');
  assert.equal(result.platform?.os, process.platform);
  assert.ok((await step('cache log', () => f.log(hit.id))).includes(`executor local · platform ${process.platform}`));
  assert.equal(f.delivered.size, executions, 'compatible cache starts no worker');
}));

test('ordinary unconstrained reuse accepts a legacy receipt without platform evidence', t => suiteCase(t, async ({ setup, step, guardControl }) => {
  const f = await setup(fixtures => suiteUnit(fixtures, { machineReceiptsOnly: true }));
  guardControl();
  const original = await step('original admission', () => f.launch());
  await step('original completion', () => f.finish(original.id));
  const source = (await step('read original receipt', () => f.jobs())).find(job => job.id === original.id)!;
  source.executor = 'droplet';
  delete source.platform;
  await step('restore legacy receipt', () => f.reopen([source]));
  const executions = f.delivered.size;
  const hit = await step('unconstrained admission', () => f.launch());
  assert.equal(hit.cached?.run, original.id);
  const result = await step('cached durable result', () => f.result(hit.id));
  assert.equal(result.executor, 'droplet');
  assert.equal(result.platform, undefined);
  assert.equal(f.delivered.size, executions);
}));

test('droplet cache reuse has no new native result receipt and retains its original green outcome', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  const original = await f.launch(); await f.machine.started(original.id); await f.finish(original.id);
  const hit = await f.launch();
  assert.equal(hit.cached?.run, original.id);
  await f.result(hit.id);
  assert.deepEqual(f.status(hit.id).outcome, { code: 0, cause: 'cached' });
  assert.doesNotMatch(await f.log(hit.id), /missing result receipt|remote collection unavailable/);
  assert.deepEqual(f.acquisitions, [original.id]);
});

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
  assert.deepEqual(tracker.cached, { run: original.id, head, tree: originalTree, occasion: null, executor: 'local' });
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

test('machine-unavailable Web stays not run in durable receipts and cannot seed green cache after restart', async t => {
  const f = await suiteUnit(t);
  const lines: string[] = [];
  assert.equal(await webPhaseAvailable(async () => ({ available: false, reason: 'libnss3.so => not found' }), line => lines.push(line)), false);
  const first = await f.launch();
  await f.suites.settled();
  const run = f.delivered.get(first.id);
  assert.ok(run, 'observe worker admission before its unavailable receipt');
  await writeFile(run.result, JSON.stringify({ code: 0, finished: f.clock.now().toISOString() }));
  const result = await f.finish(first.id, 0, '# tests 1\n# pass 1\n' + lines.join('\n'));
  assert.equal(result.outcome!.code, 0, 'other phases still complete successfully');
  assert.deepEqual(result.webPhase, { status: 'not-run', reason: 'libnss3.so => not found' });
  assert.deepEqual(JSON.parse(await readFile(run.result, 'utf8')).webPhase, result.webPhase);
  await f.reopen();
  assert.deepEqual(f.status(first.id).webPhase, result.webPhase);
  const retry = await f.launch();
  assert.equal(retry.cached, undefined, 'unavailable browser coverage must execute again');
  await f.finish(retry.id);
});
