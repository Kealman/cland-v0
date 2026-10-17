// T4: real hub startup under sixteen resistant processes and bounded sweep escalation.
// These elapsed-time measurements require a quiet machine; they are soak assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, pidAlive, sleep, startDaemon, tempProject } from './harness.ts';
import { sweepOrphans } from '../src/orphans.ts';
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

test('the shared sweep deadline preserves remaining servers and prevents later signals', async t => {
  const root = await tempProject(t);
  const fake = await fakeOpenCode(t);
  const pid = await leftoverOpenCode(t, root, OPENCODE_FAKE, { ...fake.env, FAKE_OPENCODE_IGNORE_TERM: '1' });
  const start = performance.now();
  await assert.rejects(sweepOrphans(root, () => {}, 'harness', { deadline: Date.now() + 400 }), /deadline|failed|timed out/);
  assert.ok(performance.now() - start < 1500, 'all workers settle within the shared bound');
  await sleep(1300); // Negative: exceed the one-second escalation grace after the expired sweep deadline.
  assert.equal(pidAlive(pid), true, 'no worker keeps signalling after the deadline');
});
