// Hub time is one dependency. I/O deadlines and native transports use real time separately.
export interface ClockTimer {
  unref(): void;
}

export interface Clock {
  now(): Date;
  setTimeout(callback: () => void, ms: number): ClockTimer;
  clearTimeout(timer: ClockTimer | null | undefined): void;
  setInterval(callback: () => void, ms: number): ClockTimer;
  clearInterval(timer: ClockTimer | null | undefined): void;
}

// Keep native handles private: passing a fake handle to real cancellation must fail visibly.
const nativeTimers = new WeakMap<ClockTimer, () => void>();
function own(timer: NodeJS.Timeout, clear: (timer: NodeJS.Timeout) => void): ClockTimer {
  const handle: ClockTimer = { unref: () => { timer.unref(); } };
  nativeTimers.set(handle, () => clear(timer));
  return handle;
}
function cancel(handle: ClockTimer | null | undefined): void {
  if (!handle) return;
  const clear = nativeTimers.get(handle);
  if (!clear) throw new Error('timer belongs to another clock');
  clear();
}
export const realClock: Clock = {
  now: () => new Date(),
  setTimeout: (callback, ms) => own(setTimeout(callback, ms), clearTimeout),
  clearTimeout: cancel,
  setInterval: (callback, ms) => own(setInterval(callback, ms), clearInterval),
  clearInterval: cancel,
};

/** The old timestamp-only seam remains for existing tests; never combine it with a Clock. */
export type ClockOptions = { clock?: Clock; now?: never } | { clock?: never; now?: () => Date };
export function resolveClock(options: ClockOptions): Clock {
  if (options.clock && options.now) throw new Error('pass clock or now, never both');
  return options.clock ?? (options.now ? { ...realClock, now: options.now } : realClock);
}
