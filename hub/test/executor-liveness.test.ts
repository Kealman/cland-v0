// T2: real status RPC and embedded hub shutdown on isolated state; provider never answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject, connectUi } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { FakeClock } from './fake-clock.ts';
import { DigitalOceanApi } from '../src/executor/droplet/api.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { writeLease } from '../src/executor/droplet/lease.ts';
import { LocalExecutor } from '../src/executor/local.ts';

const processes = { alive: () => true, started: () => 'fixture identity' };

for (const phase of ['sweep', 'lease recovery'] as const) test(`status observes ${phase} while shutdown bounds an unanswered provider call`, async t => {
  const root = await tempProject(t, 'executor-liveness-');
  const clock = new FakeClock();
  const sweepEntered = Promise.withResolvers<void>(), statusEntered = Promise.withResolvers<void>();
  let calls = 0;
  const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-liveness' }, clock, async () => {
    if (++calls === 1) sweepEntered.resolve(); else statusEntered.resolve();
    return new Promise(() => {});
  });
  if (phase === 'lease recovery') await writeLease(root, {
    kind: 'droplet', provider: 'digitalocean', run: 'old-run', lease: 'old-lease', name: 'cland-old', tags: ['cland'],
    size: 'c-8', region: 'lon1', priceHourly: 1, keyName: 'old-key', keyId: null, resource: 123, state: 'releasing',
    created: clock.now().toISOString(), deadline: new Date(clock.now().getTime() + 60000).toISOString(),
  });
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  const hub = await projectHub(t, root, { CLAND_EXECUTOR_STATE: join(root, 'state') }, { clock, syntheticProvider: { token: 'cland-test-liveness', api }, droplet: { api, processes } });
  await sweepEntered.promise;
  const ui = await connectUi(t, hub.discovery, 'cli');
  const response = ui.request({ type: 'executor.status' });
  await statusEntered.promise;
  await clock.advance(250);
  const status = await response;
  assert.equal(status.ok, true, status.error);
  const value = status.value as { reconciliation: string; summary: string };
  assert.equal(value.reconciliation, phase === 'sweep' ? 'sweeping' : 'reconciling');
  assert.match(value.summary, /provider unavailable or deferred/);
  let stopped = false;
  const stop = within(hub.stop().then(() => { stopped = true; }), 16000, clock);
  await clock.advance(15000);
  await stop;
  assert.equal(stopped, true);
  assert.equal(calls, 2, 'shutdown starts no further provider work');
});


test('status bypasses the ledger lock held during deferred reconcile', async t => {
  const root = await tempProject(t, 'executor-locked-status-');
  const clock = new FakeClock();
  const state = join(root, 'state'); await mkdir(state);
  const lock = join(state, 'spend.json.lock');
  await writeFile(lock, JSON.stringify({ pid: process.pid, started: 'fixture identity', token: 'other-work' }));
  const attempted = Promise.withResolvers<void>();
  const waiting = { ...processes, alive: () => { attempted.resolve(); return true; } };
  const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-liveness' }, clock, async () => ({ droplets: [], ssh_keys: [] }));
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  const hub = await projectHub(t, root, { CLAND_EXECUTOR_STATE: state }, { clock, syntheticProvider: { token: 'cland-test-liveness', api }, droplet: { api, processes: waiting } });
  await attempted.promise;
  const ui = await connectUi(t, hub.discovery, 'cli');
  const response = await ui.request({ type: 'executor.status' }, 1000);
  assert.equal(response.ok, true, response.error);
  assert.equal((response.value as { reconciliation: string }).reconciliation, 'reconciling');
  const stop = hub.stop();
  await rm(lock);
  await clock.advance(1000);
  await stop;
});


test('930-job legacy history serves status within the component bound during a stalled sweep', { timeout: 15000 }, async t => {
  const root = await tempProject(t, 'executor-history-status-');
  const clock = new FakeClock();
  await mkdir(join(root, '.cland'), { recursive: true });
  const database = join(root, '.cland/hub.db');
  const seeded = new Store(database);
  const history: SuiteJob[] = Array.from({ length: 930 }, (_, index) => ({
    id: `history-${index}`, executor: index % 2 ? 'local' : 'droplet', mode: 'auto', cwd: root,
    topic: 'general', to: [], actor: null, head: 'a'.repeat(40), branch: 'fixture',
    log: join(root, 'historical-suite.log'), result: join(root, 'historical-result.json'), gate: join(root, 'historical-ready'), pid: null, started: null, outcome: { code: 0, cause: '' },
    artifact: null, reported: index >= 6, error: index < 6 ? 'forbidden: artifact.create (a session with no role has no tools)' : null,
    cleaned: true, state: 'finished', finished: clock.now().toISOString(),
    selection: { mode: 'hub-only', files: ['x'.repeat(9000)], reason: 'historical job payload' },
  }));
  const legacy = JSON.stringify(history);
  seeded.setMeta('suite-jobs', legacy); seeded.close();
  const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  let calls = 0;
  const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-liveness' }, clock, async () => {
    entered[calls++]?.resolve(); return new Promise(() => {});
  });
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  // Timing is diagnostic evidence; the test's component timeout and real RPC
  // deadline enforce the bound. Product timers advance only through FakeClock.
  const starting = performance.now();
  const hub = await projectHub(t, root, { CLAND_EXECUTOR_STATE: join(root, 'state') }, { clock, syntheticProvider: { token: 'cland-test-liveness', api }, droplet: { api, processes } });
  const servingMs = performance.now() - starting;
  await entered[0]!.promise;
  const ui = await connectUi(t, hub.discovery, 'cli');
  const requesting = performance.now();
  const statusWork = ui.request({ type: 'executor.status' }, 1500);
  await entered[1]!.promise; await clock.advance(250);
  const status = await statusWork;
  const statusMs = performance.now() - requesting;
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { reconciliation: string }).reconciliation, 'sweeping');
  const observer = new Store(database);
  try {
    assert.equal(observer.suiteJobHistory().length, 930);
    assert.ok(Buffer.byteLength(observer.meta('suite-jobs')!) < 1_000_000);
    t.diagnostic(JSON.stringify({ jobs: 930, legacyBytes: Buffer.byteLength(legacy), activeBytes: Buffer.byteLength(observer.meta('suite-jobs')!), startToServingMs: servingMs, statusResponseMs: statusMs, unansweredProvider: true }));
  } finally { observer.close(); }
  const stopping = hub.stop(); await clock.advance(15000); await stopping;
});
