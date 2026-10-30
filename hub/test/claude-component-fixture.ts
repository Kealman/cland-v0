import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { Clock } from '../src/hub/clock.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { dispatcherUi, inProcessSpoke, testWaitMs, until, type FrameClient, type ProjectHubOptions, type SpokeOptions } from './harness.ts';
import { guardDirectoryRemoval } from './process-cleanup.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';

/** Compose the shared acquisition/drain owner before any component I/O. */
export function claudeComponentOwner(t: TestContext, root: string, clock: Clock, hubOptions: ProjectHubOptions) {
  const owner = pacingOwner(t, { setupTimeoutMs: testWaitMs(5_000) });
  const removing = Promise.withResolvers<void>();
  guardDirectoryRemoval(root, () => { removing.resolve(); return owner.dispose(); });
  const ready = Promise.withResolvers<void>();
  const actual = Promise.withResolvers<{ hub: Awaited<typeof owner.serving>; ui: FrameClient }>();
  void actual.promise.catch(() => {});
  void ready.promise.catch(() => {});
  let admitted = false;

  const client = (hub: Awaited<typeof owner.serving>) => {
    let acquisition: Promise<FrameClient> | undefined;
    // Disposal owns a late client even if its welcome never reaches the caller.
    owner.close(async () => { (await acquisition?.catch(() => undefined))?.close(); });
    return owner.observe(async signal => {
      signal.throwIfAborted();
      const ui = await (acquisition = dispatcherUi(t, hub.dispatcher, root, () => {}));
      signal.throwIfAborted();
      return ui;
    });
  };
  const frame = (ui: FrameClient, predicate: (frame: Record<string, unknown>) => boolean) => owner.observe(async signal => {
    await until(() => signal.aborted || ui.frames.some(predicate), { what: 'owned Claude frame receipt', timeoutMs: 5_000 });
    signal.throwIfAborted();
    return ui.frames.find(predicate)!;
  });
  const observe = owner.observe;
  return {
    dispose: owner.dispose, observations: owner.observations, serving: owner.serving, actual: actual.promise, removing: removing.promise,
    frame, client, observe,
    start: (setup: { signal?: AbortSignal; clock?: Clock; publishReady?: boolean } = {}) => {
      assert.equal(admitted, false, 'one hub acquisition per owner');
      admitted = true;
      // The shared setup bound includes hub startup, hello and subscription.
      const starting = owner.start(root, {}, clock, { receipt: ready.promise, ...(setup.signal ? { signal: setup.signal } : {}), ...(setup.clock ? { clock: setup.clock } : {}), hubOptions });
      const connecting = observe(async signal => {
        const hub = await abortable(owner.serving, signal);
        signal.throwIfAborted();
        const ui = await client(hub);
        signal.throwIfAborted();
        const subscribed = await ui.request({ type: 'subscribe' });
        assert.equal(subscribed.ok, true, subscribed.error);
        actual.resolve({ hub, ui });
        if (setup.publishReady !== false) ready.resolve();
        return { hub, ui };
      });
      void connecting.catch(error => { actual.reject(error); ready.reject(error); });
      return Promise.all([starting, connecting]).then(([, connected]) => connected);
    },
    spoke: (options: SpokeOptions) => {
      let acquisition: Promise<Awaited<ReturnType<typeof inProcessSpoke>>> | undefined;
      owner.close(async () => { await (await acquisition?.catch(() => undefined))?.close(); });
      const native = observe(async signal => {
        signal.throwIfAborted();
        const peer = await (acquisition = inProcessSpoke(t, options));
        signal.throwIfAborted();
        await peer.waitForPresence([options.name!]);
        signal.throwIfAborted();
        return peer;
      });
      // A failed observation disposes and joins the admitted native acquisition;
      // the directory guard keeps storage/root ownership if that drain fails.
      return within(native, testWaitMs(5_000)).catch(async error => { await owner.dispose(); throw error; });
    },
  };
}
