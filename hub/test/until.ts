// Condition waits have no fixture setup or native process dependencies.
import { realClock, type Clock } from '../src/hub/clock.ts';
import { setImmediate as yieldIO } from 'node:timers/promises';

/** Test-only failure budget; production processes never read this setting. */
export function testWaitMs(fallbackMs = 15_000): number {
  const configured = Number(process.env.CLAND_TEST_WAIT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : fallbackMs;
}

/**
 * Wait for an observable condition with one load-scaled deadline. Yield to I/O
 * between observations rather than sleeping a guessed amount of wall time.
 */
export async function until(predicate: () => boolean | Promise<boolean>, options: {
  what: string; timeoutMs?: number; loadFactor?: number; clock?: Clock;
}): Promise<void> {
  const clock = options.clock ?? realClock;
  const configured = options.loadFactor ?? Number(process.env.CLAND_TEST_LOAD_FACTOR ?? (process.env.CLAND_SUITE_EXECUTOR === 'droplet' ? 2 : 1));
  const factor = Number.isFinite(configured) && configured >= 1 ? configured : 1;
  const timeoutMs = (options.timeoutMs ?? testWaitMs()) * factor;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('until needs a positive finite deadline');
  let stopped = false;
  let last: unknown;
  const expired = Promise.withResolvers<void>();
  const timer = clock.setTimeout(() => expired.reject(new Error(`${options.what}: not within ${timeoutMs} ms${last ? ` (last error: ${String(last)})` : ''}`)), timeoutMs);
  const checking = async () => {
    while (!stopped) {
      try { if (await predicate()) return; }
      catch (error) { last = error; }
      if (!stopped) await yieldIO();
    }
  };
  try { await Promise.race([checking(), expired.promise]); }
  finally { stopped = true; clock.clearTimeout(timer); }
}

