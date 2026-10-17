// T1: Suites slot and budget policy on semantic executor/machine receipts.
// Two real worker receipt proofs stay in suite-remote-process.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { suiteUnit } from './suite-unit-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { readLeases, type DropletLease } from '../src/executor/droplet/lease.ts';

type Fixture = Awaited<ReturnType<typeof suiteUnit>>;
async function running(f: Fixture, id: string) {
  await f.machine.waits.run(f.when(() => f.status(id)?.state === 'running' ? true : undefined));
  await f.machine.started(id);
  await f.suites.settled();
}
const remote = (f: Fixture, require = true) => f.launch(require ? { executor: 'droplet', fresh: true } : { fresh: true });

for (const alreadyAnnounced of [false, true]) test(`fallback notice and log occur once across 20 ticks and restart (already announced: ${alreadyAnnounced})`, async t => {
  let inspections = 0;
  const f = await suiteUnit(t, { requesterDead: () => { inspections++; return false; } });
  f.hold(true);
  const job = await f.launch();
  const jobs = await f.jobs();
  Object.assign(jobs[0]!, { requestedExecutor: 'droplet', fallback: 'remote budget full', ...(alreadyAnnounced ? { fallbackLogged: true } : {}) });
  await f.reopen(jobs);
  const initial = inspections;
  for (let n = 0; n < 20; n++) {
    await f.suites.settled(); const before = inspections; await f.tick();
    await f.when(() => inspections > before ? true : undefined); // Each inspection is a scheduler receipt, not a time pump.
  }
  const expected = alreadyAnnounced ? [] : [job.id];
  assert.equal(inspections - initial, 20); assert.deepEqual(f.notices, expected);
  assert.deepEqual(f.logs.filter(e => e.event === 'verification-executor-fallback').map(e => e.id), expected);
  await f.reopen();
  for (let n = 0; n < 20; n++) { await f.suites.settled(); const before = inspections; await f.tick(); await f.when(() => inspections > before ? true : undefined); }
  assert.equal(inspections - initial, 40); assert.deepEqual(f.notices, expected);
  assert.deepEqual(f.logs.filter(e => e.event === 'verification-executor-fallback').map(e => e.id), expected);
});

test('startup posts the persisted remote receipt before admitting its waiter', async t => {
  const f = await suiteUnit(t, { remoteBudget: 1 });
  const run = await remote(f); await running(f, run.id); await f.finish(run.id);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland/run/suites', run.id, 'result.json'), 'utf8'));
  assert.equal(receipt.code, 0);
  const jobs = await f.jobs(); const prior = jobs[0]!;
  Object.assign(prior, { state: 'launching', outcome: null, reported: false, artifact: null, nextPoll: f.clock.now().getTime() + 60000 });
  delete prior.cleaned; delete prior.finished; delete prior.completedAt;
  const waiter = { ...prior, id: 'restored-waiter', actor: null, state: 'queued' as const, queued: f.clock.now().toISOString(), log: join(f.root, 'waiter.log'), result: join(f.root, 'waiter.json'), gate: '' };
  delete waiter.lease; delete waiter.remoteAcquireAttempted; delete waiter.remoteLogStart; delete waiter.nextPoll;
  await writeFile(waiter.log, '');
  f.reports.length = 0; await f.reopen([prior, waiter]); await f.tick();
  const restored = await f.result(run.id);
  assert.deepEqual(restored.outcome, { code: 0, cause: '' }); assert.equal(restored.finished, receipt.finished); assert.deepEqual(restored.platform, receipt.platform);
  await running(f, waiter.id); await f.finish(waiter.id);
  assert.deepEqual(f.reports.map(j => j.id), [run.id, waiter.id]); assert.equal(f.suites.snapshot().remote!.length, 0); assert.equal(f.suites.snapshot().waiters.length, 0);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});

for (const remoteOnly of ['explicit droplet', 'local_fallback=false'] as const) test(`${remoteOnly} waits for remote capacity while later local requests proceed`, async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1 }, remoteOnly === 'local_fallback=false' ? 'local_fallback=false' : '');
  const a = await remote(f); await running(f, a.id);
  const b = await remote(f, remoteOnly === 'explicit droplet');
  const q = f.suites.snapshot();
  assert.equal(q.localFallback, remoteOnly !== 'local_fallback=false'); assert.equal(q.holder, null); assert.equal(q.waiters[0]!.waitingFor, 'remote'); assert.equal(q.waiters[0]!.etaMs, q.remote![0]!.etaMs);
  assert.deepEqual(q.waiters.map(w => [w.id, w.executor, w.position]), [[b.id, 'droplet', 1]]);
  const c = await f.launch({ executor: 'local' }); assert.equal(f.suites.snapshot().holder?.id, c.id); assert.equal(f.api.droplets.length, 1);
  await f.finish(a.id); await running(f, b.id); assert.equal(f.suites.snapshot().holder?.id, c.id);
  await f.finish(b.id); assert.equal(f.status(b.id).executor, 'droplet'); await f.finish(c.id); assert.deepEqual(f.api.droplets, []);
});

test('local_fallback defaults to true, validates booleans and survives rendering', () => {
  assert.equal(parseConfig('', 'test').verification.localFallback, true);
  for (const value of ['0', '"false"', '[]']) assert.throws(() => parseConfig(`[verification]\nlocal_fallback=${value}`, 'test'), /local_fallback.*boolean/);
  for (const value of [false, true]) { const c = parseConfig(`[verification]\nlocal_fallback=${value}`, 'test'); assert.equal(c.verification.localFallback, value); assert.deepEqual(parseConfig(renderConfig(c), 'test'), c); }
});
test('remote_budget defaults to four, validates positive integers and survives rendering', () => {
  assert.equal(parseConfig('', 'test').verification.remoteBudget, 4);
  for (const value of ['0', '-1', '1.5', '"2"']) assert.throws(() => parseConfig(`[verification]\nremote_budget=${value}`, 'test'), /remote_budget.*positive integer/);
  const c = parseConfig('[verification]\nremote_budget=3', 'test'); assert.equal(c.verification.remoteBudget, 3); assert.deepEqual(parseConfig(renderConfig(c), 'test'), c);
});

test('three remote callers run together beside the local slot, which a human takes next', async t => {
  const f = await suiteUnit(t, { remoteBudget: 3 });
  const jobs = [];
  for (let n = 0; n < 3; n++) { const job = await remote(f); await running(f, job.id); jobs.push(job); }
  assert.equal(f.api.droplets.length, 3);
  const q = f.suites.snapshot(); assert.equal(q.holder, null); assert.equal(q.remote!.length, 3); assert.equal(q.remoteBudget, 3);
  assert.ok(q.remote!.every(r => r.executor === 'droplet' && r.machine?.name.startsWith('cland-') && r.machine.size === 'c-8' && r.machine.region === 'lon1'));
  const local = await f.launch(); assert.equal(f.suites.snapshot().holder?.id, local.id);
  const owner = {}; const slot = f.suites.slot({ id: 'slot-request', type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'hand-head', pid: 123, token: 'human' }, owner);
  assert.equal(slot.admitted, false);
  await f.finish(local.id); await f.when(() => f.suites.snapshot().holder?.session === 'human' ? true : undefined);
  assert.equal(f.suites.snapshot().remote!.length, 3); f.suites.leave(owner);
  for (const job of jobs) { await f.finish(job.id); assert.equal(f.status(job.id).executor, 'droplet'); }
  assert.deepEqual(f.api.droplets, []);
});

for (const frees of ['remote', 'local'] as const) test(`a full remote budget falls back once; a waiting request takes the first ${frees} slot to free`, async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 2 });
  const jobs = [];
  for (let n = 0; n < 2; n++) { const job = await remote(f); await running(f, job.id); jobs.push(job); }
  const fallback = await f.launch(); const waiting = await f.launch(); const q = f.suites.snapshot();
  assert.equal(q.localFallback, true); assert.equal(q.holder?.id, fallback.id); assert.equal(q.holder.executor, 'local');
  assert.deepEqual(q.remote!.map(r => r.id).sort(), jobs.map(j => j.id).sort()); assert.deepEqual(q.waiters.map(w => [w.id, w.executor]), [[waiting.id, 'droplet']]);
  assert.deepEqual(f.notices, [fallback.id]);
  assert.deepEqual(f.logs.filter(e => e.event === 'verification-executor-fallback' && e.id === fallback.id).map(e => e.cause), ['remote budget full']);
  assert.deepEqual(f.logs.filter(e => e.event === 'verification-admitted').map(e => [e.remoteActive, e.remoteBudget]), [[1, 2], [2, 2]]);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  if (frees === 'remote') {
    await f.finish(jobs[0]!.id); await running(f, waiting.id); assert.equal(f.api.droplets.length, 2); assert.equal(f.suites.snapshot().holder?.id, fallback.id);
  } else {
    await f.finish(fallback.id); await f.when(() => f.delivered.has(waiting.id) ? true : undefined); assert.equal(f.suites.snapshot().holder?.id, waiting.id); assert.equal(f.api.droplets.length, 2);
  }
  await f.finish(waiting.id);
  for (const job of jobs) if (!f.status(job.id).reported) await f.finish(job.id);
  if (!f.status(fallback.id).reported) await f.finish(fallback.id);
  assert.deepEqual(f.api.droplets, []);
});

test('a hand holder and an earlier local waiter do not block a remote caller', async t => {
  const f = await suiteUnit(t, { remoteBudget: 2 });
  const owner = {}; f.suites.slot({ id: 'slot-request', type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'hand-head', pid: 123, token: 'human' }, owner);
  await f.when(() => f.suites.snapshot().holder?.session === 'human' ? true : undefined);
  const local = await f.launch(); const job = await remote(f); await running(f, job.id);
  const q = f.suites.snapshot(); assert.equal(q.holder?.session, 'human'); assert.deepEqual(q.waiters.map(w => [w.id, w.executor]), [[local.id, 'local']]); assert.equal(q.remote![0]!.id, job.id);
  f.suites.leave(owner); await f.when(() => f.delivered.has(local.id) ? true : undefined);
  await f.finish(local.id); await f.finish(job.id);
});

test('local ETA uses local history while remote ETA includes its own acquisition time', async t => {
  const f = await suiteUnit(t, { remoteBudget: 1 });
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  f.ownIO(() => release.resolve());
  f.api.beforeCreate(async () => { entered.resolve(); await release.promise; });
  const first = await remote(f); await entered.promise;
  const admitted = f.status(first.id).admittedAt!;
  await f.tick(2000); // One advance after the held provider-I/O receipt.
  assert.equal(f.status(first.id).state, 'launching', 'native provider I/O stays held across clock advancement');
  release.resolve(); await running(f, first.id);
  const created = Date.parse(f.api.droplets[0]!.created_at);
  const lease = (await f.jobs()).find(j => j.id === first.id)!.lease as DropletLease;
  const started = Date.parse(lease.execution!.startedAt!);
  await f.tick(3000); await f.finish(first.id);
  const remoteRun = f.status(first.id); const remoteMs = remoteRun.runMs!;
  assert.ok(Date.parse(admitted) <= created && created <= started);
  assert.equal(remoteMs, Date.parse(remoteRun.finished!) - Date.parse(admitted)); assert.equal(remoteMs, 5000, '2s acquisition plus 3s execution');
  assert.ok(started <= Date.parse(remoteRun.finished!), 'execution completes after machine admission');
  assert.ok(remoteMs >= Date.parse(remoteRun.finished!) - created);
  const local = await f.launch({ fresh: true }); await f.tick(1000); await f.finish(local.id);
  const localMs = f.status(local.id).runMs!; assert.equal(localMs, 1000);
  const runningJob = await remote(f); await running(f, runningJob.id);
  const shim = { since: f.clock.now().toISOString(), holder: { pid: 123, started: null, token: 'eta-human', worktree: f.root, since: f.clock.now().toISOString() } };
  f.hold(true, shim); const a = await f.launch(); const b = await f.launch(); const q = await f.suites.queue();
  assert.deepEqual(q.waiters.map(w => w.id), [a.id, b.id]); assert.deepEqual(q.waiters.map(w => w.expectedRunMs), [localMs, localMs]);
  assert.equal(q.waiters[0]!.etaMs, q.holder!.etaMs); assert.equal(q.waiters[1]!.etaMs! - q.waiters[0]!.etaMs!, localMs);
  assert.equal(q.remote![0]!.etaMs, Math.max(0, remoteMs - q.remote![0]!.runMs!));
  for (const job of [a, b]) { await f.suites.cancel(job.id, null, () => {}); await f.result(job.id); }
  await f.finish(runningJob.id);
});

test('reload captures new policy for queued admissions while active runs retain their config', async t => {
  const f = await suiteUnit(t, { remoteBudget: 1 }, 'lifetime="15m"\nrun_timeout="5m"\nload_gate_workers=1');
  const first = await remote(f); await running(f, first.id);
  const old = (await f.jobs()).find(j => j.id === first.id)!;
  const waiting = await remote(f); assert.deepEqual(f.suites.snapshot().waiters.map(w => w.id), [waiting.id]);
  f.configure('[verification]\nexecutor="droplet"\nremote_budget=2\nlifetime="11m"\nrun_timeout="1m"\nload_gate_workers=4');
  await f.tick(); await running(f, waiting.id);
  const jobs = await f.jobs(); const active = jobs.find(j => j.id === first.id)!, admitted = jobs.find(j => j.id === waiting.id)!;
  assert.equal(active.lease!.deadline, old.lease!.deadline); assert.equal(active.config!.verification.runTimeoutMs, 300000); assert.equal(active.limits!.loadGateWorkers, 1);
  assert.equal(admitted.config!.verification.runTimeoutMs, 60000); assert.equal(admitted.limits!.loadGateWorkers, 4);
  assert.ok(Date.parse(active.lease!.deadline) - Date.parse(admitted.lease!.deadline) > 180000);
  assert.equal(f.suites.snapshot().remote!.length, 2);
  await f.finish(first.id); await f.finish(waiting.id);
});

test('provider acquisition cleanup completes after a controlled pre-release assertion failure', async t => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  t.after(() => release.resolve()); // Rescue only if the cleanup-under-test is broken.
  const f = await suiteUnit(t);
  f.ownIO(() => release.resolve());
  let creationCompleted = false;
  f.api.beforeCreate(async () => { entered.resolve(); await release.promise; creationCompleted = true; });
  const pending = await remote(f);
  await entered.promise;
  assert.equal(f.status(pending.id).state, 'launching', 'provider creation is still held');
  await assert.rejects(async () => {
    try { assert.fail('controlled pre-release assertion'); }
    finally { await f.close(); }
  }, { code: 'ERR_ASSERTION', message: 'controlled pre-release assertion' });
  assert.equal(creationCompleted, true);
  await f.machine.started(pending.id);
  assert.equal(f.status(pending.id).state, 'running', 'acquisition drained before the store closed');
  await assert.rejects(stat(f.root), { code: 'ENOENT' });
});
