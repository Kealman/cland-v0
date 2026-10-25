// T2: admission crosses real lock files with a scripted provider and hub clock.
// Process identities are injected; real lock contention and retry policy stay under test.
import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import fs from 'node:fs/promises';
import { completeJournalLines } from './journal-lines.ts';
import { fixture } from './remote-fixture.ts';
import { eventually, tempProject, projectHub } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { onCleanup } from './process-cleanup.ts';
import { acquireLockAsync, acquireLockWithRetry, type LockProcessTable } from '../src/hub/lock.ts';
import { drive, remoteWaits } from './remote-clock.ts';
import { cancelAndDrain, type OwnedRemoteRun } from './remote-cleanup.ts';
import type { TestContext } from 'node:test';
import { FakeClock } from './fake-clock.ts';
import { scratchMachine, legacyLedger, ledger } from './init-machine.ts';
import { rememberProject, reserveShardSpend, spendPath } from '../src/executor/droplet/spend.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import type { HubStatus } from '../src/protocol.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { integrated } from './close-run-fixture.ts';

const processes: LockProcessTable = { alive: pid => pid === process.pid, started: () => null };

for (const phase of ['reserve', 'release'] as const) test(`hub stop cancels shard planning ${phase} and restart settles its durable release`, { timeout: 10000 }, async t => {
  const f = await integrated(t, '', 2, undefined, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '3600000' } });
  await eventually('startup sweep persisted', async () => {
    assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return completeJournalLines(await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line)).find(row => row.event === 'executor-sweep');
  });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const planning = Promise.withResolvers<void>(), resume = Promise.withResolvers<void>();
  const sizes = f.api.provider.sizes.bind(f.api.provider);
  let calls = 0;
  if (phase === 'release') t.mock.method(f.api.provider, 'sizes', async (...args: Parameters<typeof sizes>) => {
    if (++calls === 1) { planning.resolve(); await resume.promise; throw new Error('controlled shard planning refusal'); }
    return sizes(...args);
  });
  const path = `${spendPath(f.env)}.lock`;
  const attempted = Promise.withResolvers<void>();
  const link = fs.link;
  t.mock.method(fs, 'link', async (...args: Parameters<typeof fs.link>) => {
    try { return await link(...args); }
    catch (error) {
      if (args[1] === path && (error as NodeJS.ErrnoException).code === 'EEXIST') attempted.resolve();
      throw error;
    }
  });
  let lock: Awaited<ReturnType<typeof acquireLockAsync>> | undefined;
  let stopping: Promise<unknown> | undefined;
  onCleanup(t, async () => {
    resume.resolve(); await lock?.release();
    await drive(f, stopping ?? f.stop());
  });
  if (phase === 'reserve') lock = await acquireLockAsync(path, undefined, undefined, 'UTC', processes);
  // Suite.start joins planning, so observe its persisted job independently of
  // the submission reply; no client request timer owns this held boundary.
  f.ui.send({ type: 'suite.start', id: 'held-shard-submit', as: { name: 'impl', sessionId: 'remote-impl', shell: true }, cwd: f.root, mode: 'all', occasion: 'stage', report: f.topic, to: ['impl'], fresh: true });
  const job = await eventually('close job persisted before shard planning', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
    return (status.value as HubStatus).suites?.find(job => job.occasion === 'stage');
  });
  const runs = [1, 2].map(n => `${job.id}-shard-${n}`);
  if (phase === 'release') {
    await planning.promise;
    await reserveShardSpend(f.root, runs, 'c-8', 0.25, 900000, 10, f.env, f.clock, processes);
    lock = await acquireLockAsync(path, undefined, undefined, 'UTC', processes);
    resume.resolve();
  }
  await attempted.promise;
  const intents = join(f.root, '.cland/run/executor/shard-releases');
  if (phase === 'release') {
    const names = await eventually('shard release intent published', async () => {
      const names = await readdir(intents).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
      return names.length ? names : undefined;
    });
    assert.equal(names.length, 1);
    assert.deepEqual(JSON.parse(await readFile(join(intents, names[0]!), 'utf8')), runs);
  }
  let stopped = false;
  stopping = f.stop();
  void stopping.then(() => { stopped = true; });
  await eventually('hub stop drains shard planner with ledger still held', () => stopped ? true : undefined, 3000);
  await stopping;
  assert.equal(JSON.parse(await readFile(path, 'utf8')).token, lock!.holder.token);
  assert.equal(f.api.requests.filter(r => r.method === 'POST').length, 0);
  if (phase === 'release') {
    const ledger = JSON.parse(await readFile(spendPath(f.env), 'utf8'));
    assert.equal(ledger.entries.filter((entry: { cost: number | null }) => entry.cost === null).length, 2, 'release intent owns the still-counted reservations until restart can take the ledger');
  }
  await lock!.release();
  const next = await projectHub(t, f.root, f.env, { clock: f.clock, droplet: f.dependencies, harnesses: 'fake', probes: 'fake', syntheticProvider: { token: f.syntheticProvider.token, api: f.api.provider } });
  const ui = await sessionUi(t, next.discovery);
  await eventually('next hub durably settles shard release intent', async () => {
    const ledger = JSON.parse(await readFile(spendPath(f.env), 'utf8'));
    return ledger.entries.every((entry: { cost: number | null }) => entry.cost !== null) && (await readdir(intents)).length === 0 ? true : undefined;
  });
  const status = await ui.request({ type: 'executor.status' });
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { spend: { reserved: number } }).spend.reserved, 0);
});

for (const kind of ['spend', 'executor'] as const) test(`hub stop cancels the held ${kind} admission lock and restart has no reservation`, { timeout: 10000 }, async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '3600000' } });
  await eventually('startup sweep persisted', async () => {
    assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return completeJournalLines(await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line)).find(row => row.event === 'executor-sweep');
  });
  const path = kind === 'spend' ? `${spendPath(f.env)}.lock` : join(f.root, '.cland/run/executor/budget.lock');
  const lock = await acquireLockAsync(path, undefined, undefined, 'UTC', processes);
  const before = await readFile(path, 'utf8');
  let stopping: Promise<unknown> | undefined;
  onCleanup(t, async () => {
    await lock.release();
    await drive(f, stopping ?? f.stop());
  });
  const job = await f.launch();
  await f.waits.waiting();
  stopping = f.stop();
  let stopped = false;
  void stopping.then(() => { stopped = true; });
  await eventually('hub stop completes while admission lock stays held', () => stopped ? true : undefined, 3000);
  await stopping;
  assert.equal(await readFile(path, 'utf8'), before, 'shutdown leaves the other owner intact');
  assert.equal(f.api.requests.filter(r => r.method === 'POST').length, 0, 'no provider resource was created');
  assert.equal(f.machine.calls.filter(call => call.step === 'start').length, 0);
  await lock.release();
  const next = await projectHub(t, f.root, f.env, { clock: f.clock, droplet: f.dependencies, harnesses: 'fake', probes: 'fake', syntheticProvider: { token: f.syntheticProvider.token, api: f.api.provider } });
  const ui = await sessionUi(t, next.discovery);
  await eventually('next hub reconciles the interrupted acquisition', async () => {
    const leases = await readLeases(f.root);
    return leases.some(lease => lease.run === job.id && lease.state === 'released') ? true : undefined;
  });
  const status = await ui.request({ type: 'executor.status' });
  assert.equal(status.ok, true, status.error);
  const value = status.value as { leases: unknown[]; spend: { reserved: number } };
  assert.deepEqual(value.leases, []);
  assert.equal(value.spend.reserved, 0);
});

test('lock contention expires at the admission deadline or the sixty-second cap', async t => {
  const root = await tempProject(t, 'retry-deadline-');
  const path = join(root, 'held.lock');
  const lock = await acquireLockAsync(path, undefined, undefined, 'UTC', processes);
  onCleanup(t, () => lock.release());
  for (const [budget, elapsed] of [[40000, 40000], [90000, 60000]]) {
    const clock = new FakeClock();
    const waits = remoteWaits(clock);
    await waits.run(assert.rejects(acquireLockWithRetry(path, clock.now().getTime() + budget!, { clock, wait: waits.wait, processes }), new RegExp(`after waiting ${elapsed} ms`)));
  }
});

async function admissionCase(t: TestContext, kind: 'spend' | 'executor', failBeforeRelease = false) {
  const state = await tempProject(t, 'admission-lock-');
  const f = await fixture(t, { machine: 'scripted', config: 'lifetime="15m"\nrun_timeout="5m"\nremote_budget=1\ndaily_spend_usd=3', env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_DROPLET_MACHINE_MS: '10000', CLAND_TEST_EXECUTOR_SWEEP_MS: '3600000' } });
  // Finish startup reconciliation before taking the held lock; periodic sweeps
  // are outside this admission proof and must not race its fixture setup.
  assert.equal((await f.ui.request({ type: 'executor.status' })).ok, true);
  const startup = await eventually('initial executor sweep durably completed', async () => {
    assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const records = completeJournalLines(await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
    return records.find(record => record.event === 'executor-sweep');
  });
  assert.equal(startup.failures, 0);
  const path = kind === 'spend' ? join(state, 'spend.json.lock') : join(f.root, '.cland/run/executor/budget.lock');
  const lock = await acquireLockAsync(path, undefined, undefined, 'UTC', processes);
  let held = true;
  const runs: OwnedRemoteRun[] = [];
  let cleanupWork: ReturnType<typeof cancelAndDrain> | undefined;
  const release = async () => { if (held) { await lock.release(); held = false; } };
  const cleanup = () => cleanupWork ??= cancelAndDrain(runs, release);
  onCleanup(t, cleanup);
  try {
    // A retry wait is a receipt that the real lock was attempted and found held.
    // A second receipt after advancing past the old 15s cutoff proves continued admission.
    assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
    const run = await f.launch();
    runs.push({ fixture: f, id: run.id });
    await eventually('admission attempted the held lock', () => f.waits.pending.length ? true : undefined);
    await f.clock.advance(16000);
    await eventually('admission retries past the old deadline', () => f.waits.pending.some(due => due > f.clock.now().getTime()) ? true : undefined);
    assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
    const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
    assert.equal(status.suites!.find(s => s.id === run.id)!.executor, 'droplet', 'contention must not send the run to the local queue');
    assert.deepEqual(await f.messages(run.id), []);
    if (failBeforeRelease) assert.fail(`controlled ${kind} assertion failure`);
    await release();
    await drive(f, f.machine.started(run.id));
    await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as { remote?: { id: string }[] }).remote?.some(job => job.id === run.id) === true);
    await f.clock.advance(1000);
    const result = await f.result(run.id);
    assert.match(result.text, /Executor droplet/);
    assert.match(result.text, /exit 0/);
    assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
    const history = JSON.stringify((await f.ui.request({ type: 'topic.history', topic: f.topic })).value);
    assert.doesNotMatch(history, /droplet unavailable/);
  } finally {
    const reports = await cleanup();
    if (failBeforeRelease) {
      assert.equal(f.machine.calls.filter(call => call.step === 'start').length, 0);
      assert.match(reports[0]!.text, /cancelled/);
      assert.deepEqual(f.api.droplets, []);
      assert.deepEqual(f.api.keys, []);
    }
  }
}

for (const kind of ['spend', 'executor'] as const) test(`remote admission survives ${kind} lock contention beyond the old deadline`, { timeout: 120000 }, t => admissionCase(t, kind));

test('assertion failures drain acquisitions asleep on either admission lock', { timeout: 30000 }, async t => {
  for (const kind of ['spend', 'executor'] as const) await assert.rejects(admissionCase(t, kind, true), new RegExp(`controlled ${kind} assertion failure`));
});

for (const source of ['primary', 'legacy migration']) test(`registry sweep ${source} contention uses the executor wait and drains before shutdown`, { timeout: 2000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await mkdir(join(machine.root, '.cland'));
  await rememberProject(machine.root, machine.env, processes, clock);
  if (source === 'legacy migration') await legacyLedger(machine, []);
  const lock = await acquireLockAsync(`${spendPath(machine.env)}.lock`, undefined, undefined, 'UTC', processes);
  const delays: number[] = [];
  const executor = new DropletExecutor(machine.root, undefined, () => {}, machine.env, undefined, {
    clock, processes, wait: async ms => { delays.push(ms); await lock.release(); },
  });
  let sweeping: Promise<void> | undefined;
  onCleanup(t, async () => {
    await lock.release();
    // Failure cleanup releases the held fixture lock before advancing a retry.
    // No directory disappears beneath an outstanding sweep writer.
    await clock.advance(1000);
    await sweeping;
    await executor.close();
  });
  sweeping = executor.sweep();
  await sweeping;
  await executor.close();
  assert.deepEqual(delays, [25], 'the first contended lock retry is delivered to the injected executor wait');
  assert.deepEqual((await ledger(machine)).projects, [machine.root]);
});

test('shutdown drains a registry sweep waiting on another ledger holder', { timeout: 2000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await mkdir(join(machine.root, '.cland'));
  await rememberProject(machine.root, machine.env, processes, clock);
  const before = await readFile(spendPath(machine.env), 'utf8');
  const lock = await acquireLockAsync(`${spendPath(machine.env)}.lock`, undefined, undefined, 'UTC', processes);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const events: Record<string, unknown>[] = [];
  const executor = new DropletExecutor(machine.root, undefined, event => events.push(event), machine.env, undefined, {
    clock, processes, wait: async () => { entered.resolve(); await release.promise; },
  });
  let sweeping: Promise<void> | undefined;
  onCleanup(t, async () => {
    release.resolve();
    await lock.release();
    await clock.advance(1000);
    await sweeping;
    await executor.close();
  });
  sweeping = executor.sweep();
  await entered.promise;
  await executor.close();
  await sweeping;
  assert.equal(await readFile(spendPath(machine.env), 'utf8'), before, 'shutdown completes without taking the other holder’s ledger');
  assert.ok(events.some(event => event.event === 'executor-sweep'));
  assert.ok(events.some(event => event.event === 'executor-reconcile-failed' && event.reason === 'project registry sweep deferred'));
});
