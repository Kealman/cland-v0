// T3: provider loss and hub restart reconcile two live remote shard processes; cancellation uses scripted receipts.
import { pollerDeadline } from './fakes/finish-poller.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { integrated } from './close-run-fixture.ts';
import { remoteEventually as eventually } from './remote-fixture.ts';
import { clandWithEnv, connectUi, killDaemon, nativeProjectHub as projectHub, startDaemon } from './harness.ts';
import type { VerificationQueue } from '../src/protocol.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { afterCleanup, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { drive, remoteWaits } from './remote-clock.ts';
import { until, testWaitMs, waitTimeoutMs } from './until.ts';
import { readLeaseHistory } from '../src/executor/droplet/lease.ts';
import { caseDeadlines, drainFixtureWork } from './case-deadlines.ts';
import { FakeClock } from './fake-clock.ts';

function cancellationOwner(t: TestContext) {
  let drained = false, restored = false;
  let close!: () => Promise<void>;
  const release = Promise.withResolvers<void>();
  const owner = caseDeadlines(t, {
    timeoutMs: waitTimeoutMs(testWaitMs()),
    ownership: {
      guardDirectoryRemoval,
      beforeDirectories(context, cleanup) {
        close = async () => { await cleanup(); drained = true; };
        beforeDirectories(context, close);
      },
    },
    releaseOnClose: () => release.resolve(),
  });
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  let restore: (() => void) | undefined;
  const releaseGuard = () => {
    assert.ok(drained, 'cancellation cleanup incomplete; native guard retained');
    if (restored) return;
    try { guard?.verify(); } finally { restore?.(); restored = true; }
  };
  afterCleanup(t, async () => {
    await drainFixtureWork();
    releaseGuard();
  });
  return { release, close: () => close(), releaseGuard,
    run: (body: (fixtures: TestContext, signal: AbortSignal, step: typeof owner.wait) => Promise<void>) =>
      owner.wait('owned cancellation callback', () => owner.run(async (admit, signal) => {
        const step: typeof owner.wait = (name, work) => owner.wait(name, () => admit(async () => {
          const result = await work();
          signal.throwIfAborted();
          return result;
        }));
        await step('native guard setup', async () => { guard = await fakeNativeGuard(fn => { restore = fn; }); });
        await body(owner.fixtures, signal, step);
      })),
  };
}

/** Abort settles this exact driver; receipt promises themselves own no work. */
async function startDriver(f: Parameters<typeof drive>[0], started: Promise<unknown>, signal: AbortSignal) {
  signal.throwIfAborted();
  const aborted = Promise.withResolvers<never>();
  const cancel = () => aborted.reject(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  try { await drive(f, Promise.race([started, aborted.promise])); }
  finally { signal.removeEventListener('abort', cancel); }
}

const barrier = `node -e "${pollerDeadline()}const fs=require('fs');fs.mkdirSync('.cland',{recursive:true});fs.writeFileSync('.cland/started','yes');const timer=setInterval(()=>{if(fs.existsSync('.cland/finish')){clearInterval(timer);console.log('# tests 1');console.log('# pass 1')}},25)"`;

test('a sharded close handles cancel with one result and confirmed cleanup', t => {
  const owner = cancellationOwner(t);
  return owner.run(async (fixtures, signal, step) => {
  const f = await step('scripted fixture setup', () => integrated(fixtures, '', 2, undefined, { machine: 'scripted' }));
  f.machine.script({ outcome: 'slow' }, { outcome: 'slow' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  // Hold acquisition so both persisted-start observers are armed before start.
  f.api.beforeCreate(() => owner.release.promise);
  const job = await step('sharded admission', () => drive(f, f.launch('all', '--fresh', '--occasion', 'stage')));
  const shards = [1, 2].map(n => `${job.id}-shard-${n}`);
  const started = Promise.all(shards.map(id => f.machine.started(id)));
  owner.release.resolve();
  await step('both persisted shard-start receipts', () => startDriver(f, started, signal));
  await until(async () => {
    const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; state: string }[] };
    return status.suites.some(run => run.id === job.id && run.state === 'running');
  }, { what: 'sharded parent durably running' });
  const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(q.holder, null);
  assert.deepEqual(q.remote!.map(r => [r.shard, r.occasion]).sort(), [['shard-1', 'stage'], ['shard-2', 'stage']]);
  assert.equal((await f.ui.request({ type: 'suite.cancel', suite: q.remote![0]!.id! })).ok, true);
  const result = await drive(f, f.result(job.id));
  assert.match(result.text, /cancelled/);
  await until(async () => {
    const leases = (await readLeaseHistory(f.root)).filter(lease => shards.includes(lease.run));
    const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return leases.length === 2 && leases.every(lease => lease.state === 'released') && queue.remote!.length === 0;
  }, { what: 'both shard leases released and remote slots free' });
  assert.equal((await f.messages(job.id)).length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  for (const run of shards) assert.ok(f.machine.calls.some(call => call.run === run && call.step === 'cancel'));
  assert.deepEqual(f.api.droplets, []);
  });
});

test('cancellation cleanup joins a missing-start driver before releasing the native guard', async t => {
  const owner = cancellationOwner(t);
  const entered = Promise.withResolvers<void>();
  let joined = false, cleaned = false;
  const running = owner.run(async (fixtures, signal, step) => {
    fixtures.after(() => { assert.ok(joined, 'original driver joined before resource drainage'); cleaned = true; });
    await step('missing start receipt', async () => {
      const driver = startDriver({ waits: remoteWaits(new FakeClock()) }, new Promise(() => {}), signal);
      entered.resolve();
      try { await driver; } finally { joined = true; }
    });
  });
  const rejected = assert.rejects(running, /fixture work admission closed/);
  await entered.promise;
  assert.throws(owner.releaseGuard, /cleanup incomplete; native guard retained/);
  assert.equal(joined, false);
  await owner.close();
  await rejected;
  assert.equal(joined, true);
  assert.equal(cleaned, true);
  owner.releaseGuard();
});

for (const action of ['lost', 'restart'] as const) test(`a sharded close handles ${action} with one result and confirmed cleanup`, async t => {
  const f = await integrated(t, '', 2, barrier, { hub: action === 'restart' ? startDaemon : projectHub });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const submitted = await clandWithEnv(f.root, f.actor, 'verify', 'all', '--fresh', '--occasion', 'stage', '--report', f.topic, '--json');
  assert.equal(submitted.code, 0, submitted.stderr);
  const job = JSON.parse(submitted.stdout);
  const machines: Awaited<ReturnType<typeof f.remote>>[] = [];
  for (const n of [1, 2]) machines.push(await f.remote(`${job.id}-shard-${n}`));
  for (const machine of machines) await eventually('shard reached package barrier', async () => await readFile(join(machine.home, 'cland/.cland/started'), 'utf8').catch(() => '') === 'yes' ? true : undefined);
  const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(q.holder, null);
  assert.deepEqual(q.remote!.map(r => [r.shard, r.occasion]).sort(), [['shard-1', 'stage'], ['shard-2', 'stage']]);
  let ui = f.ui;
  if (action === 'lost') {
    // The fake provider reports 404 for exactly the first machine.
    const lost = f.api.droplets.findIndex(d => f.api.machineDirs.get(d.id) === machines[0]!.home.slice(0, -'/home/runner'.length));
    assert.notEqual(lost, -1);
    f.api.droplets.splice(lost, 1);
  } else if (action === 'restart') {
    await killDaemon(f.discovery.pid);
    const restarted = await startDaemon(t, f.root, f.env, { syntheticProvider: f.syntheticProvider });
    ui = await connectUi(t, restarted.discovery);
  }
  // A status poll may already have seen the provider's 200 before the loss.
  // Keep shard 1 at its observed worker gate so that poll cannot collect a pass
  // before the next poll sees the 404. Release it only after the loss report.
  const finishing = action === 'lost' ? machines.slice(1) : action === 'restart' ? machines : [];
  for (const machine of finishing) await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
  for (const machine of finishing) await eventually('released shard completed', async () => await readFile(join(machine.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  const result = await f.result(job.id, ui);
  assert.match(result.text, action === 'restart' ? /exit 0/ : /shard-1: remote machine lost/);
  if (action === 'lost') {
    await writeFile(join(machines[0]!.home, 'cland/.cland/finish'), 'yes');
    await eventually('lost shard worker finished before fixture removal', async () => await readFile(join(machines[0]!.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  }
  const messages = await f.messages(job.id, ui);
  assert.equal(messages.length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  await eventually('all sharded remote slots released', async () => {
    const q = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return q.remote!.length === 0 ? true : undefined;
  });
  assert.deepEqual(f.api.droplets, []);
});
