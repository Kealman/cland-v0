// T2: real socket replies while compatibility admission is held at an observed
// barrier. Native ps termination remains in suite-recovery.test.ts (T3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HubStatus, VerificationQueue } from '../src/protocol.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import { fixture as componentFixture } from './suite-component-fixture.ts';

test('verify queue retains a local release recovery failure until cleanup succeeds, with the next run waiting', async t => {
  const f = await componentFixture(t);
  let blocked = true;
  const reason = 'compatibility recovery failed; ambiguous writer ownership; ownership preserved';
  t.mock.method(LocalExecutor.prototype, 'release', async () => {
    if (blocked) throw new Error(reason);
    return { lifetimeMs: null, costUsd: null };
  });
  await f.ui.request({ type: 'subscribe' });
  const first = await f.launch();
  await f.settle();
  const next = await f.ui.request({ type: 'suite.start', mode: 'auto', fresh: true, cwd: f.root, report: f.topic });
  assert.equal(next.ok, true, next.error);
  const nextId = (next.value as { id: string }).id;
  assert.notEqual(nextId, first.id);
  await f.settle();
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queue.holder?.id, first.id);
  assert.equal(queue.localBlocked?.reason, reason);
  assert.equal(queue.waiters[0]!.id, nextId);
  assert.equal(queue.waiters[0]!.etaMs, null);
  const pushed = await f.ui.waitFor(frame => frame.type === 'verification.queue'
    && (frame.queue as VerificationQueue).localBlocked?.reason === reason
    && (frame.queue as VerificationQueue).waiters.some(waiter => waiter.id === nextId));
  assert.equal((pushed.queue as VerificationQueue).waiters[0]!.etaMs, null);
  assert.equal(f.executions.length, 1, 'waiting run cannot start before cleanup completes');
  const rendered = await cland(f.root, 'verify', 'queue');
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.ok(rendered.stdout.includes(`local: blocked · ${reason}`), rendered.stdout);
  blocked = false;
  await f.settle();
  const recovered = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(recovered.localBlocked, undefined);
  assert.equal(f.executions.length, 2, 'successor starts only after successful cleanup');
});

test('verify queue exposes a failed local admission and its reason through CLI and subscription', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\nexecutor="local"\n');
  const reason = 'compatibility recovery failed; runner group live; ownership preserved';
  let fail = true;
  const hub = await projectHub(t, root, {}, { clock, durationContext: null,
    compatibility: { holder: async () => fail ? null : { holder: null, since: clock.now().toISOString() }, occupied: async () => { if (fail) throw new Error(reason); return true; } },
    candidate: { head: async () => 'a'.repeat(40), tree: async () => 'b'.repeat(40),
      inspect: async () => ({ head: 'a'.repeat(40), branch: 'candidate', tree: 'b'.repeat(40),
        selection: { mode: 'hub-only', files: [], reason: 'blocked admission fixture' }, tierPlan: [], budgetBase: undefined }) },
  });
  const ui = await connectUi(t, hub.discovery, 'cli');
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'suite.start', mode: 'auto', cwd: root, report: 'general' });
  assert.equal(launched.ok, true, launched.error);
  await hub.verificationSettled();
  const queue = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queue.localBlocked?.reason, reason);
  assert.equal(queue.waiters.length, 1);
  assert.equal(queue.waiters[0]!.etaMs, null, 'blocked admission has no known start ETA');
  const pushed = await ui.waitFor(frame => frame.type === 'verification.queue' && Boolean((frame.queue as VerificationQueue).localBlocked));
  assert.equal((pushed.queue as VerificationQueue).localBlocked?.reason, reason);
  const rendered = await cland(root, 'verify', 'queue');
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.ok(rendered.stdout.includes(`local: blocked · ${reason}`), rendered.stdout);
  assert.doesNotMatch(rendered.stdout, /local: none/);
  fail = false;
  await clock.advance(1000);
  await hub.verificationSettled();
  const retried = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(retried.localBlocked, undefined, 'successful compatibility retry clears the stale error');
  assert.equal(retried.holder?.kind, 'hand run');
});

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
