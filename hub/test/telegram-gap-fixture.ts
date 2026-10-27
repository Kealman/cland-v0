import type { TestContext } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { flushTelegramGap } from '../src/remote/telegram-gap.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { pairing } from './telegram-polling-fixture.ts';

/** Own the barrier and writer before setup can allocate storage or publish readiness. */
export async function heldTelegramGap(t: TestContext) {
  const clock = new FakeClock(new Date(2026, 9, 16, 13, 20));
  const setupClock = new FakeClock();
  const lifetime = new AbortController();
  const accepted = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  void ready.promise.catch(() => {});
  let db: Store | undefined, observer: Store | undefined;
  let producer: Promise<boolean> | undefined, observing: Promise<void> | undefined;
  let drivingSetup: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  let joined = false, closed = false, outcome: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  let finalStates: string[] = [];
  const calls: Array<{ chat: string; text: string; key: string }> = [];
  const dispose = () => disposing ??= (async () => {
    lifetime.abort(new Error('Telegram gap fixture cancelled'));
    accepted.resolve();
    await producer?.catch(() => {});
    joined = producer !== undefined;
    await observing?.catch(() => {});
    await drivingSetup;
    // Observe the durable terminal rows while both handles are still owned.
    finalStates = observer?.remotes.forMessenger('telegram').outbox().map(row => row.state) ?? [];
    observer?.close(); observer = undefined;
    db?.close(); db = undefined;
    closed = true;
  })();
  onCleanup(t, dispose);
  const root = await tempProject(t);
  db = new Store(join(root, 'gap.db'));
  observer = new Store(join(root, 'gap.db'));
  const store = db.remotes.forMessenger('telegram');
  const view = observer.remotes.forMessenger('telegram');
  store.setPairing(pairing);
  const missed = (id: string, source: string) => store.putOutbox({ id, kind: 'general', source, state: 'missed',
    payload: { telegram: true, params: { chat_id: pairing.chatId }, userId: pairing.userId },
    created: clock.now().toISOString(), updated: clock.now().toISOString() });
  const start = async (options: { signal?: AbortSignal; publishReady?: boolean } = {}) => {
    if (producer) throw new Error('Telegram gap fixture has one producer');
    const signal = AbortSignal.any([lifetime.signal, t.signal, ...(options.signal ? [options.signal] : [])]);
    // Setup and held behavior have separate injected-clock bounds.
    observing = within(abortable(ready.promise, signal), 1_000, setupClock,
      () => new Error('Telegram gap setup receipt deadline reached'));
    void observing.catch(() => {});
    producer = flushTelegramGap(store, clock, async (chat, text, key) => {
      calls.push({ chat, text, key });
      if (options.publishReady !== false) ready.resolve();
      await within(abortable(accepted.promise, signal), 1_000, clock,
        () => new Error('Telegram gap held send deadline reached'));
    });
    void producer.then(() => { outcome = 'fulfilled'; }, () => { outcome = 'rejected'; });
    // Capture/readiness is synchronous at this T1 seam. Advance its independent
    // setup clock after triggering it; advance yields queued receipt microtasks
    // first and still reaches the deadline if no receipt was published. Callers
    // never need the awaited start to return before its bound can progress.
    drivingSetup = setupClock.advance(1_000);
    try { await observing; }
    catch (error) { await dispose(); throw error; }
  };
  return { clock, setupClock, store, view, missed, start, calls, dispose,
    accept: () => accepted.resolve(), completion: () => producer!,
    receipts: () => ({ joined, closed, outcome, finalStates }),
  };
}
