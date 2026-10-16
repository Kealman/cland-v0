// Deterministic hub scheduling without replacing global timers used by real sockets/journal I/O.
import { setImmediate as yieldIO } from 'node:timers/promises';
import type { Clock, ClockTimer } from '../src/hub/clock.ts';

type Timer = ClockTimer & { due: number; order: number; callback: () => void; interval: number | null };

export class FakeClock implements Clock {
  #time: number;
  #order = 0;
  #advancing = false;
  readonly #timers = new Set<Timer>();
  readonly #owned = new WeakSet<ClockTimer>();

  constructor(at: Date | number = Date.parse('2026-10-16T12:00:00Z')) {
    this.#time = at instanceof Date ? at.getTime() : at;
    if (!Number.isFinite(this.#time)) throw new Error('clock needs a finite starting time');
  }
  now(): Date { return new Date(this.#time); }
  get pending(): number { return this.#timers.size; }
  setTimeout(callback: () => void, ms: number): ClockTimer { return this.#schedule(callback, ms, false); }
  setInterval(callback: () => void, ms: number): ClockTimer { return this.#schedule(callback, ms, true); }
  clearTimeout(timer: ClockTimer | null | undefined): void {
    if (!timer) return;
    if (!this.#owned.has(timer)) throw new Error('timer belongs to another clock');
    this.#timers.delete(timer as Timer);
  }
  clearInterval(timer: ClockTimer | null | undefined): void { this.clearTimeout(timer); }

  #schedule(callback: () => void, ms: number, repeat: boolean): Timer {
    // Node normalizes out-of-range/sub-millisecond delays to 1 ms.
    const delay = !Number.isFinite(ms) || ms < 1 || ms > 2 ** 31 - 1 ? 1 : Math.trunc(ms);
    const timer: Timer = { callback, due: this.#time + delay, order: this.#order++, interval: repeat ? delay : null, unref() {} };
    this.#owned.add(timer);
    this.#timers.add(timer);
    return timer;
  }

  /** Run each due callback at its deadline, including work it schedules. Callers still await their
   * expected frame/record: yielding allows I/O to progress, it is not an I/O completion barrier. */
  async advance(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('advance needs a finite non-negative duration');
    if (this.#advancing) throw new Error('clock advance is already in progress');
    this.#advancing = true;
    const target = this.#time + ms;
    try {
      await yieldIO();
      for (;;) {
        const timer = [...this.#timers].filter(t => t.due <= target).sort((a, b) => a.due - b.due || a.order - b.order)[0];
        if (!timer) break;
        this.#time = timer.due;
        if (timer.interval === null) this.#timers.delete(timer);
        else { timer.due += timer.interval; timer.order = this.#order++; }
        timer.callback();
        await yieldIO();
      }
      this.#time = target;
      await yieldIO();
    } finally { this.#advancing = false; }
  }
}
