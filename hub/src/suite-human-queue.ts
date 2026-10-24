import type { SuiteSlotResult } from './protocol.ts';

/** Wait for admission on the caller's existing human queue connection. */
export async function waitForHumanSlot(result: SuiteSlotResult, options: {
  request: () => Promise<SuiteSlotResult>;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  interrupted: () => boolean;
  report: (message: string) => void;
}): Promise<SuiteSlotResult> {
  let last = ''; let printed = 0;
  while (!result.admitted) {
    if (options.interrupted()) throw new Error('human suite interrupted');
    const waiter = result.queue.waiters.find(w => w.id === result.id);
    const holder = result.queue.holder;
    const duration = (ms: number | null) => ms === null ? 'unknown' : `${Math.ceil(ms / 1000)}s`;
    const place = `${waiter?.position ?? '?'} of ${result.queue.waiters.length}`;
    const eta = duration(waiter?.etaMs ?? null);
    const signature = `${place}:${eta}:${holder?.session}:${holder?.pid}`;
    if (signature !== last || options.now() - printed >= 60_000) {
      options.report(`waiting for the suite queue: place ${place} · ${holder?.session ?? holder?.kind ?? 'no holder'} runs ${duration(holder?.runMs ?? null)} · ETA ~${eta}\n`);
      last = signature; printed = options.now();
    }
    await options.wait(2000);
    result = await options.request();
  }
  return result;
}
