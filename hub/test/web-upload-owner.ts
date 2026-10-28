import type { TestContext } from 'node:test';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';
import { onCleanup } from './process-cleanup.ts';
import { testWaitMs } from './until.ts';

/** Register before POST; retain native work until abort, released I/O and hub drainage join. */
export function uploadOwner(t: TestContext, stopHub: () => Promise<void>, release: () => void) {
  const abort = new AbortController();
  const pending = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= (async () => {
    abort.abort(new Error('upload fixture cancelled'));
    release();
    const stopping = track(stopHub());
    const outcomes = await within(Promise.allSettled([...pending, stopping]), testWaitMs(5000), undefined,
      () => new Error('incomplete upload fixture: HTTP/control/writer drainage deadline reached'));
    const failures = outcomes.filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'upload fixture drainage failed');
  })();
  onCleanup(t, dispose);
  return {
    dispose,
    pending: () => pending.size,
    signal: abort.signal,
    track,
    join: <T>(work: Promise<T>) => within(work, testWaitMs(5000), undefined,
      () => new Error('incomplete upload fixture: native operation receipt missing')),
    setup: <T>(receipt: Promise<T>, options: { clock?: Clock; signal?: AbortSignal } = {}) => track(within(
      abortable(receipt, AbortSignal.any([abort.signal, t.signal, ...(options.signal ? [options.signal] : [])])),
      1000, options.clock, () => new Error('upload setup receipt deadline reached'),
    )).catch(async error => { await dispose(); throw error; }),
    post: (url: string, options: RequestInit) => track(fetch(url, {
      ...options, signal: AbortSignal.any([abort.signal, t.signal]),
    }).then(async response => ({ outcome: 'response' as const, status: response.status, body: await response.text() })).catch(error => ({ outcome: 'closed' as const, error: error instanceof Error ? error.name : 'unknown' }))),
  };
}
