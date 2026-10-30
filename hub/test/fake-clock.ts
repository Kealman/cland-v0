// Deterministic hub scheduling without replacing global timers used by real sockets/journal I/O.
import { setImmediate as yieldIO } from 'node:timers/promises';
import { until } from './until.ts';
import type { Clock, ClockTimer } from '../src/hub/clock.ts';

type Timer = ClockTimer & { due: number; order: number; callback: () => void; interval: number | null };

export class FakeClock implements Clock {
  #time: number;
  readonly #observers = new Set<TimeObservation>();

  /** Register the owner before admitting writes; rejected updates remain owned facts. */
  observeTime(update: (time: Date) => Promise<void>): TimeObservation {
    const observation = new TimeObservation(update, () => this.#observers.delete(observation));
    this.#observers.add(observation);
    return observation;
  }

  #changed(): void {
    for (const observer of this.#observers) observer.enqueue(this.now());
  }
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

  /** Simulate synchronous CPU work without running timer callbacks during that work. */
  block(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('block needs a finite non-negative duration');
    this.#time += ms;
    this.#changed();
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
        const timer = [...this.#timers].filter(t => t.due <= Math.max(target, this.#time)).sort((a, b) => a.due - b.due || a.order - b.order)[0];
        if (!timer) break;
        this.#time = Math.max(this.#time, timer.due);
        if (timer.interval === null) this.#timers.delete(timer);
        // Like Node after blocked work, an overdue interval fires once; missed ticks do not replay.
        else { timer.due = this.#time + timer.interval; timer.order = this.#order++; }
        timer.callback();
        await yieldIO();
      }
      this.#time = Math.max(this.#time, target);
      this.#changed();
      await Promise.all([...this.#observers].map(observer => observer.drain()));
      for (const observer of this.#observers) observer.throwIfFailed();
      await yieldIO();
    } finally { this.#advancing = false; }
  }
}

/** One bounded observation owner. Its tail never rejects, including when nobody advances. */
export class TimeObservation {
  readonly errors: unknown[] = [];
  #tail = Promise.resolve();
  #pending = 0;
  #closed = false;
  #reported = 0;
  readonly #update: (time: Date) => Promise<void>;
  readonly #unregister: () => void;
  constructor(update: (time: Date) => Promise<void>, unregister: () => void) {
    this.#update = update;
    this.#unregister = unregister;
  }
  enqueue(time: Date): void {
    if (this.#closed) return;
    this.#pending++;
    this.#tail = this.#tail.then(() => this.#update(time)).catch(error => {
      this.errors.push(error);
    }).finally(() => { this.#pending--; });
  }
  async drain(options: { clock?: Clock; timeoutMs?: number } = {}): Promise<void> {
    await until(() => this.#pending === 0, { ...options, what: 'clock Date writers drained', timeoutMs: options.timeoutMs ?? 5000 });
  }
  throwIfFailed(): void {
    const errors = this.errors.slice(this.#reported);
    this.#reported = this.errors.length;
    if (errors.length) throw new AggregateError(errors, 'browser Date updates failed');
  }
  stop(): void {
    this.#closed = true;
    this.#unregister();
  }
  close(): Promise<void> {
    this.stop();
    return this.drain();
  }
}
