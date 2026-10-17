// T1: executor overrides and cache eligibility at Suites; worker results are semantic receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';

const remoteReady = async (f: Awaited<ReturnType<typeof suiteUnit>>, id: string) => {
  await f.machine.waits.run(f.when(() => f.status(id).state === 'running' ? true : undefined));
  await f.machine.started(id);
};

test('explicit droplet reuses only droplet greens while omitted executor keeps cross-executor reuse', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  const local = await f.launch({ executor: 'local' }); await f.finish(local.id);
  assert.equal(f.status(local.id).executor, 'local');
  const defaultHit = await f.launch(); assert.equal(defaultHit.cached?.run, local.id); await f.result(defaultHit.id);
  assert.equal(f.status(defaultHit.id).executor, 'local');
  const remote = await f.launch({ executor: 'droplet' }); assert.equal(remote.cached, undefined);
  await remoteReady(f, remote.id); await f.finish(remote.id);
  assert.equal(f.status(remote.id).executor, 'droplet');
  assert.match(await f.log(remote.id), /Cache bypassed: explicit --executor droplet requires a droplet green; cached green ran locally/);
  const remoteHit = await f.launch({ executor: 'droplet' }); assert.equal(remoteHit.cached?.run, remote.id); await f.result(remoteHit.id);
  assert.equal(f.status(remoteHit.id).executor, 'droplet');
  const newerLocal = await f.launch({ executor: 'local', fresh: true }); await f.finish(newerLocal.id);
  const olderRemoteHit = await f.launch({ executor: 'droplet' }); assert.equal(olderRemoteHit.cached?.run, remote.id); await f.result(olderRemoteHit.id);
  assert.equal(f.status(olderRemoteHit.id).executor, 'droplet');
  const newerDefaultHit = await f.launch(); assert.equal(newerDefaultHit.cached?.run, newerLocal.id); await f.result(newerDefaultHit.id);
  assert.equal(f.status(newerDefaultHit.id).executor, 'local');
  assert.equal(f.acquisitions.length, 1);
});

test('executor overrides bypass host locks and dirty explicit remote candidates refuse', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.hold(true, { since: f.clock.now().toISOString(), holder: { pid: 123, started: null, token: 'hand', since: f.clock.now().toISOString() } });
  const remote = await f.launch({ executor: 'droplet' }); await remoteReady(f, remote.id); await f.finish(remote.id);
  assert.equal(f.status(remote.id).executor, 'droplet');
  f.candidate.tree = null;
  await assert.rejects(f.launch({ executor: 'droplet' }), /dirty worktree cannot be bundled for droplet/);
  const queue = await f.suites.queue(); assert.deepEqual(queue.waiters, []);
  assert.equal(queue.holder?.kind, 'hand run'); assert.equal(queue.holder.id, null);
  assert.equal(f.delivered.size, 0, 'no local worker was admitted');
});

test('a local override executes locally despite a droplet default', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  const job = await f.launch({ executor: 'local', fresh: true }); await f.finish(job.id);
  assert.ok(f.delivered.has(job.id)); assert.equal(f.status(job.id).executor, 'local');
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});
