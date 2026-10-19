// T2: real socket replies while compatibility admission is held at an observed
// barrier. Native ps termination remains in suite-recovery.test.ts (T3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HubStatus } from '../src/protocol.ts';

test('status and cancellation reply before a held compatibility inspection completes', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  let inspecting = false, hold = false;
  onCleanup(t, () => release.resolve());
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\nexecutor="local"\n');
  const hub = await projectHub(t, root, {}, { clock, durationContext: null,
    compatibility: { holder: async () => null, occupied: async () => {
      if (!hold) return true;
      inspecting = true; entered.resolve();
      await release.promise;
      inspecting = false; completed.resolve();
      return true;
    } },
    candidate: { head: async () => 'a'.repeat(40), tree: async () => 'b'.repeat(40),
      inspect: async () => ({ head: 'a'.repeat(40), branch: 'candidate', tree: 'b'.repeat(40),
        selection: { mode: 'hub-only', files: [], reason: 'held admission fixture' }, tierPlan: [], budgetBase: undefined }) },
  });
  const ui = await connectUi(t, hub.discovery, 'cli');
  const topic = ((await ui.request({ type: 'topic.create', title: 'Held admission' })).value as { topic: { id: string } }).topic.id;
  const launch = await ui.request({ type: 'suite.start', mode: 'auto', cwd: root, report: topic });
  assert.equal(launch.ok, true, launch.error);
  const job = launch.value as { id: string; pid: number | null };
  assert.equal(job.pid, null);
  hold = true;
  await clock.advance(1000);
  await entered.promise;
  const status = await ui.request({ type: 'hub.status' });
  assert.equal(status.ok, true, status.error);
  assert.equal(inspecting, true, 'status replied while admission was still held');
  assert.equal((status.value as HubStatus).suites?.find(run => run.id === job.id)?.state, 'queued');
  const cancel = await ui.request({ type: 'suite.cancel', suite: job.id });
  assert.equal(cancel.ok, true, cancel.error);
  assert.equal(inspecting, true, 'cancellation replied while admission was still held');
  assert.deepEqual(cancel.value, { id: job.id, topic, cancelled: true });
  release.resolve();
  await completed.promise;
  await hub.verificationSettled();
});
