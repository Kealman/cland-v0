// Condition waits have no fixture setup or native process dependencies.
import { realClock, type Clock } from '../src/hub/clock.ts';
import { setImmediate as yieldIO } from 'node:timers/promises';

import { waitTimeoutMs } from '../src/suite-wait-budget.ts';
export { suiteLoadFactor, waitTimeoutMs } from '../src/suite-wait-budget.ts';

/** Test-only failure budget; production processes never read this setting. */
export function testWaitMs(fallbackMs = 15_000): number {
  const configured = Number(process.env.CLAND_TEST_WAIT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : fallbackMs;
}

/** Fake owners share real setup headroom without scaling injected fault clocks. */
export function testDeadlineMs(fallbackMs: number, clock?: Clock, explicitMs?: number): number {
  return explicitMs ?? (clock ? fallbackMs : waitTimeoutMs(testWaitMs(fallbackMs)));
}

/** Real acquisition tolerates loaded workers; injected setup clocks retain exact fault bounds. */
export function testSetupWaitMs(clock?: Clock, explicitMs?: number): number {
  return testDeadlineMs(clock ? 1_000 : 5_000, clock, explicitMs);
}

export type WaitOptions = {
  timeoutMs?: number; loadFactor?: number; clock?: Clock;
  /** A product behaviour deadline, rather than setup headroom. */
  behaviour?: string;
};

function conditionTimeoutMs(options: WaitOptions): number {
  return waitTimeoutMs(options.timeoutMs ?? testWaitMs(),
    options.behaviour ? 1 : options.loadFactor ?? (options.clock ? 1 : undefined));
}

/** One deadline owns predicate time as well as the interval between observations. */
async function observe<T>(check: () => T | undefined | Promise<T | undefined>, options: WaitOptions & { what: string }, intervalMs: number): Promise<T> {
  const clock = options.clock ?? realClock;
  const timeoutMs = conditionTimeoutMs(options);
  const deadline = clock.now().getTime() + timeoutMs;
  let stopped = false;
  let last: unknown;
  let pollTimer: ReturnType<Clock['setTimeout']> | undefined;
  let releasePoll: (() => void) | undefined;
  const expired = Promise.withResolvers<T>();
  const expire = () => expired.reject(new Error(`${options.what}: not within ${timeoutMs} ms${last ? ` (last error: ${String(last)})` : ''}`));
  const timer = clock.setTimeout(expire, timeoutMs);
  const checking = async (): Promise<T> => {
    while (!stopped) {
      try {
        const value = await check();
        if (clock.now().getTime() >= deadline) { expire(); return expired.promise; }
        if (!stopped && value !== undefined) return value;
      }
      catch (error) { last = error; }
      if (!stopped) {
        if (intervalMs) await new Promise<void>(resolve => {
          releasePoll = resolve;
          pollTimer = clock.setTimeout(resolve, intervalMs);
        });
        else await yieldIO();
      }
    }
    return expired.promise;
  };
  try { return await Promise.race([checking(), expired.promise]); }
  finally {
    stopped = true;
    clock.clearTimeout(timer);
    clock.clearTimeout(pollTimer);
    releasePoll?.();
  }
}

/** Yield to I/O between observations; asynchronous predicate time shares the deadline. */
export async function until(predicate: () => boolean | Promise<boolean>, options: WaitOptions & { what: string }): Promise<void> {
  await observe(async () => await predicate() ? true : undefined, options, 0);
}

/** Poll until `check` returns a value (not undefined), or fail with what was last seen. */
export async function eventually<T>(what: string, check: () => Promise<T | undefined> | T | undefined, budget: number | WaitOptions = {}): Promise<T> {
  const options = typeof budget === 'number' ? { timeoutMs: budget } : budget;
  return observe(check, { ...options, what }, 50);
}

