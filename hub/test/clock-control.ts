// Pre-owned setup/effect observations for Date writer fault controls.
import type { TestContext } from 'node:test';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';
import { onCleanup } from './process-cleanup.ts';

export function clockControl(t: TestContext) {
  const abort = new AbortController();
  const gate = Promise.withResolvers<void>();
  const pending = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  const release = () => gate.resolve();
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= (async () => {
    abort.abort(new Error('Date control cancelled'));
    release();
    await within(Promise.allSettled([...pending]), 5000, undefined,
      () => new Error('incomplete Date control: writers did not drain'));
  })();
  onCleanup(t, dispose); // Registered before launching setup or page work.
  t.signal.addEventListener('abort', () => { void dispose().catch(() => {}); }, { once: true });
  return {
    gate: gate.promise, release, dispose, track,
    setup: <T>(receipt: Promise<T>, clock?: Clock, signal?: AbortSignal) => track(within(
      abortable(receipt, AbortSignal.any([abort.signal, t.signal, ...(signal ? [signal] : [])])), 1000, clock,
      () => new Error('Date control setup receipt missing'),
    )).catch(error => { abort.abort(error); release(); throw error; }),
    join: <T>(work: Promise<T>) => track(within(work, 5000, undefined,
      () => new Error('incomplete Date control: effect receipt missing'))),
  };
}
