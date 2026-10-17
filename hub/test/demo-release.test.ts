// T3: detached watchdog deletion after hub shutdown, plus one demo.stop socket proof on a process machine.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually, pidAlive, projectHub } from './harness.ts';
import { fixture } from './remote-fixture.ts';
import { readLease, writeLease } from '../src/executor/droplet/lease.ts';
import { armWatchdog, stopWatchdog } from '../src/executor/droplet/watchdog.ts';
import { ownProcess } from './process-cleanup.ts';

test('the detached demo watchdog confirms an active droplet losing tags during its delete', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000', CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '2000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Watchdog demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  const dir = join(f.root, '.cland/run/executor/leases', (started.value as { lease: string }).lease);
  const lease = await readLease(dir);
  await f.stop();
  await stopWatchdog(lease, f.env);
  await eventually('original watchdog is gone', () => !pidAlive(lease.watchdog!.pid) ? true : undefined);
  f.api.faults.deletePolls = 3; f.api.faults.stripTagsOnDelete = true;
  await writeLease(f.root, { ...lease, deadline: new Date().toISOString() });
  // An ordinary retry would wait 10s. The receipt within 8s must come from
  // the shared bounded identity recheck, without another DELETE attempt.
  const watchdog = await armWatchdog(dir, { ...process.env, ...f.env, CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '10000' });
  ownProcess(t, watchdog.pid);
  const receipt = await eventually('watchdog confirms provider absence', async () => {
    try { return JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')); } catch { return undefined; }
  }, 8000);
  assert.deepEqual(receipt.deleted, [lease.resource]);
  await eventually('watchdog exits after confirming absence', () => !pidAlive(watchdog.pid) ? true : undefined);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
  const recheck = JSON.parse((await readFile(join(dir, 'watchdog.log'), 'utf8')).trim());
  assert.deepEqual(recheck.attention.fields, ['tags']);
  assert.equal(recheck.attention.observed.status, 'active');
});

test('demo stop waits for an archived droplet with stripped tags to become absent', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Deleting demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic }); assert.equal(started.ok, true, started.error);
  f.api.faults.deletePolls = 2;
  f.api.faults.archiveOnDelete = true;
  const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
  assert.equal((stopped.value as { state: string }).state, 'released');
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')).length, 1);
});
