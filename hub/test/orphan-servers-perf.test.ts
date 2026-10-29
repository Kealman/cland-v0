// T4: native process lifecycle — hub startup under sixteen resistant processes and bounded sweep escalation.
// The startup elapsed-time measurement requires a quiet machine; it is a soak assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, pidAlive, sleep, startDaemon, tempProject } from './harness.ts';
import { sweepOrphans } from '../src/orphans.ts';
import { systemProcesses } from '../src/system-processes.ts';
import { fakeOpenCode, leftoverOpenCode, OPENCODE_FAKE } from './orphan-server-fixture.ts';

test('hub start opens its socket promptly while sixteen TERM-resistant orphans are swept in parallel', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const env = { ...fake.env, FAKE_OPENCODE_IGNORE_TERM: '1' };
  const pids = await Promise.all(Array.from({ length: 16 }, (_, i) => leftoverOpenCode(t, root, OPENCODE_FAKE, env, root, `orphan-${i}`)));
  const started = performance.now();
  const { discovery } = await startDaemon(t, root, env, { sweep: true });
  assert.ok(performance.now() - started < 5000, 'cleanup cannot hold socket startup behind sixteen grace periods');
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await eventually('parallel sweep ends every resistant orphan', async () => pids.every(pid => !pidAlive(pid)) ? true : undefined, 15_000);
});

test('the shared sweep deadline preserves remaining servers and prevents later signals', { timeout: 30_000 }, async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const pid = await leftoverOpenCode(t, root, OPENCODE_FAKE, { ...fake.env, FAKE_OPENCODE_IGNORE_TERM: '1' });
  // Own the hold: even a delayed installation of the fake's TERM handler cannot
  // end this server. Observe the native stopped state before starting the sweep.
  process.kill(pid, 'SIGSTOP');
  await eventually('orphan is stopped', async () => (await systemProcesses()).some(row => row.pid === pid && row.state.startsWith('T')) ? true : undefined);
  let now = Date.now();
  const deadline = now + 400;
  const clock = t.mock.method(Date, 'now', () => now);
  const kill = process.kill.bind(process);
  const signals: Array<NodeJS.Signals | number> = [];
  const signalling = t.mock.method(process, 'kill', (target: number, signal: NodeJS.Signals | number = 'SIGTERM') => {
    const result = kill(target, signal);
    if (target === pid && signal !== 0) {
      signals.push(signal);
      // Discovery has no wall-time race. Expire only after the real TERM was
      // delivered to the held server, before any subsequent inspection/signal.
      if (signal === 'SIGTERM') now = deadline;
    }
    return result;
  });
  try {
    await assert.rejects(sweepOrphans(root, () => {}, 'harness', { deadline }), /deadline|failed|timed out/);
    await sleep(1300); // Negative: exceed the one-second escalation grace after the expired sweep deadline.
    assert.deepEqual(signals, ['SIGTERM'], 'no worker signals after the deadline');
    assert.equal(pidAlive(pid), true, 'the held server survives the expired sweep');
  } finally {
    clock.mock.restore();
    signalling.mock.restore();
    if (pidAlive(pid)) kill(pid, 'SIGCONT');
  }
});
