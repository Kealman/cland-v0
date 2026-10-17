import type { FakeClock } from './fake-clock.ts';

/** Only a product-requested delay admits an advance. Pending native I/O does not. */
export function remoteWaits(clock: FakeClock) {
  type Wait = { due: number; completed: Promise<void> };
  const pending = new Set<Wait>();
  let changed = Promise.withResolvers<void>();
  const publish = () => { const previous = changed; changed = Promise.withResolvers<void>(); previous.resolve(); };
  const wait = (ms: number): Promise<void> => {
    const completion = Promise.withResolvers<void>();
    const receipt: Wait = { due: clock.now().getTime() + Math.max(1, Math.trunc(ms)), completed: completion.promise };
    clock.setTimeout(() => { pending.delete(receipt); completion.resolve(); publish(); }, ms);
    pending.add(receipt);
    publish();
    return receipt.completed;
  };
  async function run<T>(work: Promise<T>): Promise<T> {
    let done = false;
    const settled = work.finally(() => { done = true; });
    void settled.catch(() => {});
    for (let waits = 0; !done;) {
      const notification = changed.promise;
      const next = [...pending].sort((a, b) => a.due - b.due)[0];
      if (!next) { await Promise.race([settled, notification]); continue; }
      if (++waits > 10000) throw new Error('remote operation requested more than 10000 delays');
      await clock.advance(Math.max(0, next.due - clock.now().getTime()));
      // Admission to finish is separate from the timer's completion receipt.
      await next.completed;
    }
    return settled;
  }
  return { wait, run, get pending() { return [...pending].map(receipt => receipt.due); } };
}

export function drive<T>(fixture: { waits: ReturnType<typeof remoteWaits> }, work: Promise<T>): Promise<T> {
  return fixture.waits.run(work);
}
