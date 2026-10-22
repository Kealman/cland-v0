import { DigitalOceanError } from './api.ts';
import { realClock, type Clock } from '../../hub/clock.ts';
import type { Provider } from './dependencies.ts';

/** Detach an unanswered boundary without letting its late reply resume callers. */
export async function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}

/** Bound the caller even when an injected provider ignores its deadline. No retry
 * is started here: ambiguous mutations remain owned by their durable lease. */
export async function within<T>(work: Promise<T>, ms: number, clock: Clock = realClock, timeoutError: () => Error = () => new Error('executor operation deadline reached')): Promise<T> {
  let timer: ReturnType<Clock['setTimeout']> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = clock.setTimeout(() => reject(timeoutError()), ms);
      timer.unref();
    })]);
  } finally { clock.clearTimeout(timer); }
}

const deadlineArgument: Record<keyof Provider, number> = {
  account: 0, sizes: 0, regions: 0, droplets: 1, keys: 0, create: 1, droplet: 1,
  importKey: 2, deleteDroplet: 1, deleteKey: 1, dropletAction: 3, action: 1,
  actions: 0, snapshots: 0, transferImage: 2, tagImage: 2, deleteSnapshot: 1,
};

export function boundedProvider(provider: Provider, clock: Clock, timeoutMs: number, deadline?: number, signal?: AbortSignal): Provider {
  return new Proxy(provider, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const index = deadlineArgument[property as keyof Provider];
      const supplied = args[index];
      const explicit = Math.min(deadline ?? Infinity, typeof supplied === 'number' ? supplied : Infinity);
      const now = clock.now().getTime();
      const remaining = Math.min(timeoutMs, explicit - now);
      if (remaining <= 0) return Promise.reject(new DigitalOceanError(0, 'deadline', 'request deadline reached'));
      // The transport cap bounds this wait, but is not a caller deadline. Keep
      // that distinction when the inner API's abort wins the timer race too.
      args[index] = Number.isFinite(explicit) ? explicit : undefined;
      const deadlineLimited = explicit <= now + timeoutMs;
      return within(abortable(Promise.resolve().then(() => { signal?.throwIfAborted(); return value.apply(target, args); }), signal), remaining, clock,
        () => deadlineLimited ? new DigitalOceanError(0, 'deadline', 'request deadline reached') : new DigitalOceanError(0, 'transport', 'request failed or exceeded its time bound'));
    };
  } });
}
