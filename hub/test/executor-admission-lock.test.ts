// T2: admission crosses real lock files with a scripted provider and hub clock.
// Git/ps fixture infrastructure remains until T-719; no hub, spoke or watchdog child.
import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { eventually, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { acquireLockAsync, acquireLockWithRetry } from '../src/hub/lock.ts';
import { drive, remoteWaits } from './remote-clock.ts';
import { cancelAndDrain, type OwnedRemoteRun } from './remote-cleanup.ts';
import type { TestContext } from 'node:test';
import { FakeClock } from './fake-clock.ts';
import type { HubStatus } from '../src/protocol.ts';

test('lock contention expires at the admission deadline or the sixty-second cap', async t => {
  const root = await tempProject(t, 'retry-deadline-');
  const path = join(root, 'held.lock');
  const lock = await acquireLockAsync(path, undefined, undefined, 'UTC');
  onCleanup(t, () => lock.release());
  for (const [budget, elapsed] of [[40000, 40000], [90000, 60000]]) {
    const clock = new FakeClock();
    const waits = remoteWaits(clock);
    await waits.run(assert.rejects(acquireLockWithRetry(path, clock.now().getTime() + budget!, { clock, wait: waits.wait }), new RegExp(`after waiting ${elapsed} ms`)));
  }
});

async function admissionCase(t: TestContext, kind: 'spend' | 'executor', failBeforeRelease = false) {
  const state = await tempProject(t, 'admission-lock-');
  const f = await fixture(t, { machine: 'scripted', config: 'lifetime="15m"\nrun_timeout="5m"\nremote_budget=1\ndaily_spend_usd=3', env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_DROPLET_MACHINE_MS: '10000', CLAND_TEST_EXECUTOR_SWEEP_MS: '3600000' } });
  // Finish startup reconciliation before taking the held lock; periodic sweeps
  // are outside this admission proof and must not race its fixture setup.
  assert.equal((await f.ui.request({ type: 'executor.status' })).ok, true);
  const path = kind === 'spend' ? join(state, 'spend.json.lock') : join(f.root, '.cland/run/executor/budget.lock');
  const lock = await acquireLockAsync(path, undefined, undefined, 'UTC');
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
