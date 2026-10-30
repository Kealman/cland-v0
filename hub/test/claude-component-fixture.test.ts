// T2: shared component setup cancellation, observation drainage and root-removal barriers.
// Production projectHub/dispatcher with a fake harness; no Claude binary or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { tempProject, testWaitMs } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup, ownDirectory } from './process-cleanup.ts';
import { fakeHarness } from './fakes/harness.ts';
import { claudeComponentOwner } from './claude-component-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';

for (const failure of ['omitted', 'aborted'] as const) test(`Claude component ${failure} setup joins admitted observations before root removal`, async t => {
  const root = await tempProject(t);
  let completed = false;
  const remove = ownDirectory(undefined, root, { beforeRemove: () => assert.equal(completed, true, 'removal follows the owned completion receipt') });
  const clock = new FakeClock();
  const setupClock = new FakeClock();
  const abort = new AbortController();
  const emergency = new AbortController();
  const released = Promise.withResolvers<void>();
  let writer: Promise<void> | undefined;
  const releaseAndJoin = async () => {
    emergency.abort();
    released.resolve();
    await writer;
  };
  // Registered before the component's disposer: an assertion anywhere after
  // admission must release this deliberate hold before the owner joins it.
  onCleanup(t, releaseAndJoin);
  const owner = claudeComponentOwner(t, root, clock, { clock, adapters: [(host, clock) => fakeHarness('claude-code', { host, clock })] });
  const starting = owner.start({ publishReady: false, signal: abort.signal, clock: setupClock });
  const failed = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /cancel Claude setup/);
  void failed.catch(() => {}); // Early assertion failure still owns setup cancellation.
  const { hub, ui } = await within(owner.actual, 5_000);
  const draining = Promise.withResolvers<void>();
  // An admitted writer deliberately finishes after cancellation; drainage owns
  // its positive completion, rather than treating the abort as completion.
  writer = owner.observe(async signal => {
    const cancelled = AbortSignal.any([signal, emergency.signal]);
    await new Promise<void>(resolve => {
      const done = () => { draining.resolve(); resolve(); };
      if (cancelled.aborted) done();
      else cancelled.addEventListener('abort', done, { once: true });
    });
    await released.promise;
    completed = true;
  });
  assert.ok(ui.frames.some(frame => frame.type === 'welcome'), 'full acquisition completed before its readiness receipt is lost');
  try {
    if (failure === 'omitted') await setupClock.advance(testWaitMs(5_000));
    else abort.abort(new Error('cancel Claude setup'));
    await within(draining.promise, 5_000);
    await within(hub.stopped, 5_000);
    const removing = remove();
    void removing.catch(() => {}); // Own rejection immediately; keep its assertion below.
    await within(owner.removing, 5_000);
    assert.equal(completed, false, 'hub stop does not settle the separately owned writer');
    assert.equal(existsSync(root), true, 'the removal barrier retains the root while admitted work is draining');
    released.resolve();
    await within(Promise.all([writer, failed, removing]), 5_000);
    assert.equal(completed, true);
    assert.equal(owner.observations(), 0);
    assert.equal(existsSync(root), false, 'root removal follows the joined writer completion');
    assert.equal(setupClock.pending, 0);
    assert.equal(clock.pending, 0);
  } finally {
    await releaseAndJoin();
    await owner.dispose();
  }
});
