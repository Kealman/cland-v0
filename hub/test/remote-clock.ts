import type { FakeClock } from './fake-clock.ts';
import { AsyncLocalStorage } from 'node:async_hooks';

const drivers = new WeakMap<FakeClock, ReturnType<typeof createRemoteWaits>>();

/** Peers sharing a product clock must also share native-I/O and advance ownership. */
export function remoteWaits(clock: FakeClock) {
  let driver = drivers.get(clock);
  if (!driver) { driver = createRemoteWaits(clock); drivers.set(clock, driver); }
  return driver;
}

/** Only a product-requested delay admits an advance. Pending native I/O does not. */
function createRemoteWaits(clock: FakeClock) {
  type Wait = { due: number; completed: Promise<void> };
  const pending = new Set<Wait>();
  const context = new AsyncLocalStorage<object>();
  const running = new Set<object>();
  const active = new Set<object>();
  let advancing = false;
  let changed = Promise.withResolvers<void>();
  const publish = () => { const previous = changed; changed = Promise.withResolvers<void>(); previous.resolve(); };
  const wait = (ms: number): Promise<void> => {
    const owner = context.getStore();
    if (owner) active.delete(owner);
    const completion = Promise.withResolvers<void>();
    const receipt: Wait = { due: clock.now().getTime() + Math.max(1, Math.trunc(ms)), completed: completion.promise };
    clock.setTimeout(() => { pending.delete(receipt); completion.resolve(); publish(); }, ms);
    pending.add(receipt);
    publish();
    return receipt.completed.then(() => {
      if (owner && running.has(owner)) active.add(owner);
      publish();
    });
  };
  /** A sequential executor operation is doing I/O or asleep on this driver's clock.
   * Nested calls share ownership; independent concurrent operations track separately. */
  async function track<T>(work: () => Promise<T>): Promise<T> {
    const parent = context.getStore();
    if (parent && running.has(parent)) return work();
    const owner = {};
    running.add(owner); active.add(owner); publish();
    return context.run(owner, async () => {
      try { return await work(); }
      finally { running.delete(owner); active.delete(owner); publish(); }
    });
  }
  async function waiting(): Promise<void> {
    while (!pending.size) await changed.promise;
  }
  async function run<T>(work: Promise<T>): Promise<T> {
    let done = false;
    const settled = work.finally(() => { done = true; });
    void settled.catch(() => {});
    for (let waits = 0; !done;) {
      const notification = changed.promise;
      const next = [...pending].sort((a, b) => a.due - b.due)[0];
      // A retrying acquirer does not make time pass for a different acquirer
      // still publishing native files. All tracked work must yield first.
      if (!next || active.size || advancing) { await Promise.race([settled, notification]); continue; }
      if (++waits > 10000) throw new Error('remote operation requested more than 10000 delays');
      advancing = true;
      try {
        await clock.advance(Math.max(0, next.due - clock.now().getTime()));
        // Admission to finish is separate from the timer's completion receipt.
        await next.completed;
      } finally { advancing = false; publish(); }
    }
    return settled;
  }
  return { wait, run, track, waiting, get pending() { return [...pending].map(receipt => receipt.due); } };
}

export function drive<T>(fixture: { waits: ReturnType<typeof remoteWaits> }, work: Promise<T>): Promise<T> {
  return fixture.waits.run(work);
}
