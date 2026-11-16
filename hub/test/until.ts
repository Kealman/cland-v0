// Condition waits have no fixture setup or native process dependencies.
import { realClock, type Clock } from '../src/hub/clock.ts';
import { setImmediate as yieldIO } from 'node:timers/promises';

/** Setup headroom includes runnable work and the phase about to start. */
export function suiteLoadFactor(options: {
  load: number; workers: number; parallelism: number; executor?: string; override?: string;
}): number {
  const override = Number(options.override);
  if (Number.isFinite(override) && override >= 1) return override;
  return Math.max(options.executor === 'droplet' ? 2 : 1,
    (options.load + options.workers) / options.parallelism);
}

/** Test-only failure budget; production processes never read this setting. */
export function testWaitMs(fallbackMs = 15_000): number {
  const configured = Number(process.env.CLAND_TEST_WAIT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : fallbackMs;
}

/** Shared deadline arithmetic for condition waits and their outer phase envelopes. */
export function waitTimeoutMs(ms:number,loadFactor?:number):number {
  const configured=loadFactor??Number(process.env.CLAND_TEST_LOAD_FACTOR??(process.env.CLAND_SUITE_EXECUTOR==='droplet'?2:1));
  const factor=Number.isFinite(configured)&&configured>=1?configured:1;
  const timeoutMs=ms*factor;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('until needs a positive finite deadline');
  return timeoutMs;
}

/** Real acquisition tolerates loaded workers; injected setup clocks retain exact fault bounds. */
export function testSetupWaitMs(clock?: Clock, explicitMs?: number): number {
  return explicitMs ?? (clock ? 1_000 : waitTimeoutMs(testWaitMs(5_000)));
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

