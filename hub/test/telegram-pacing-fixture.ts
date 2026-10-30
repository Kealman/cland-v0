import type { TestContext } from 'node:test';
import { Store } from '../src/hub/store.ts';
import { projectHub, until, testWaitMs, type ProjectHubOptions } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';

/** Own resources before acquisition, including setup whose serving receipt is lost. */
export function pacingOwner(t: TestContext, options: { setupTimeoutMs?: number } = {}) {
  let db: Store | undefined;
  const hubs = new Set<Awaited<ReturnType<typeof projectHub>>>();
  const acquiring = new Set<Promise<Awaited<ReturnType<typeof projectHub>>>>();
  const observing = new Set<Promise<Awaited<ReturnType<typeof projectHub>>>>();
  const observations = new Set<Promise<unknown>>();
  let disposing: Promise<void> | undefined;
  const abort = new AbortController();
  const drainAbort = new AbortController();
  const serving = Promise.withResolvers<Awaited<ReturnType<typeof projectHub>>>();
  const closers: Array<{ close: () => void | Promise<void>; startupOnly: boolean; called: boolean }> = [];
  const dispose = () => disposing ??= (async () => {
    // Spend the shutdown budget on drainage, never on fixture acquisition.
    const deadline = setTimeout(() => drainAbort.abort(new Error('Telegram fixture drainage deadline reached')), testWaitMs(5_000));
    deadline.unref();
    try {
      const hadAcquisition = acquiring.size > 0;
      abort.abort(new Error('Telegram pacing fixture setup cancelled'));
      const failures: unknown[] = [];
      const stopKnown = async (releaseStartup: boolean) => {
        const pending = closers.filter(entry => !entry.called && (!entry.startupOnly || releaseStartup));
        for (const entry of pending) entry.called = true;
        const stopped = await Promise.allSettled([
          ...[...hubs].map(hub => hub.stop()), ...pending.map(entry => Promise.resolve().then(entry.close)),
        ]);
        for (const result of stopped) if (result.status === 'rejected') failures.push(result.reason);
      };
      // Release held I/O and custom owners before joining acquisition, not behind it.
      await stopKnown(hadAcquisition);
      while (acquiring.size) await Promise.allSettled([...acquiring]);
      // A cancelled acquisition may still return a late hub; retain and stop it.
      await stopKnown(false);
      while (observing.size) await Promise.allSettled([...observing]);
      while (observations.size) await Promise.allSettled([...observations]);
      if (failures.length) throw new AggregateError(failures, 'Telegram pacing fixture writers did not drain');
      db?.close();
    } finally { clearTimeout(deadline); }
  })();
  onCleanup(t, dispose);
  return {
    dispose, serving: serving.promise,
    observations: () => observations.size,
    observe: <T>(start: (signal: AbortSignal) => Promise<T>, options: { drain?: boolean } = {}): Promise<T> => {
      // Native close receipts survive cancellation until writers have stopped.
      const work = start(AbortSignal.any([t.signal, options.drain ? drainAbort.signal : abort.signal]));
      observations.add(work);
      void work.then(() => observations.delete(work), () => observations.delete(work));
      return work;
    },
    close: (close: () => void | Promise<void>, options: { startupOnly?: boolean } = {}) => {
      closers.push({ close, startupOnly: options.startupOnly ?? false, called: false });
    },
    store: (path: string) => db = new Store(path),
    start: (root: string, extra: Record<string, string>, clock: Clock, setup: {
      receipt?: Promise<void>; signal?: AbortSignal; clock?: Clock; hubOptions?: ProjectHubOptions;
    } = {}) => {
      const signal = AbortSignal.any([abort.signal, t.signal, ...(setup.signal ? [setup.signal] : [])]);
      const ready = Promise.withResolvers<Awaited<ReturnType<typeof projectHub>>>();
      // Arm the setup observer before even invoking actual native acquisition.
      const observed = within(abortable(ready.promise, signal), options.setupTimeoutMs ?? 1_000, setup.clock,
        () => new Error('Telegram pacing fixture setup receipt deadline reached'));
      observing.add(observed);
      void observed.then(() => observing.delete(observed), () => observing.delete(observed));
      const native = Promise.resolve().then(() => {
        signal.throwIfAborted();
        return projectHub(t, root, extra, { clock, ...setup.hubOptions });
      });
      acquiring.add(native);
      void native.then(hub => {
        hubs.add(hub); serving.resolve(hub);
        return abortable(setup.receipt ?? Promise.resolve(), signal).then(() => ready.resolve(hub));
      }, ready.reject).catch(ready.reject);
      void native.then(() => acquiring.delete(native), () => acquiring.delete(native));
      return observed.catch(async error => { await dispose(); throw error; });
    },
  };
}

/** Advance only from durable queued work with no native send still awaiting I/O. */
export async function driveTelegram<T>(clock: import('./fake-clock.ts').FakeClock, state: import('../src/remote/state.ts').RemoteStore, work: Promise<T>): Promise<T> {
  let done = false;
  const settled = work.finally(() => { done = true; });
  void settled.catch(() => {});
  for (let advances = 0; !done;) {
    let delay = 0;
    await until(() => {
      if (done) return true;
      const jobs = state.outbox();
      if (jobs.some(job => job.state === 'sending')) return false;
      const waits = jobs.filter(job => job.state === 'queued' || job.state === 'uncertain').map(job => {
        const chat = String((job.payload as { params: { chat_id: string } }).params.chat_id);
        return Math.max(Number(state.get('telegram.outbox.holdUntil') ?? 0), Number(state.get(`telegram.outbox.last:${chat}`) ?? -Infinity) + 1_000) - clock.now().getTime();
      }).filter(ms => ms > 0);
      if (!waits.length) return false;
      delay = Math.min(...waits);
      return true;
    }, { what: 'native operation completion or durable Telegram pacing wait', timeoutMs: 2_000 });
    if (done) break;
    if (++advances > 100) throw new Error('Telegram fixture exceeded 100 durable pacing advances');
    await clock.advance(delay);
  }
  return settled;
}
