import type { Clock, ClockTimer } from './hub/clock.ts';

/** Best-effort requests never participate in admission decisions. */
export class LintWarmQueue {
  readonly #clock: Clock;
  readonly #run: (head: string) => Promise<void>;
  readonly #quietMs: number;
  #timer: ClockTimer | undefined;
  #pending: string | null = null;
  #work: Promise<void> | undefined;
  #warmed: string | null = null;
  #closed = false;
  #due = 0;
  constructor(clock: Clock, run: (head: string) => Promise<void>, quietMs = 1000) {
    this.#clock = clock; this.#run = run; this.#quietMs = quietMs;
  }
  request(head: string | null): void {
    if (this.#closed || !head) return;
    this.#pending = head === this.#warmed ? null : head;
    this.#due = this.#clock.now().getTime() + this.#quietMs;
    this.#schedule();
  }
  #schedule(): void {
    this.#clock.clearTimeout(this.#timer);
    this.#timer = undefined;
    if (this.#closed || !this.#pending || this.#work) return;
    this.#timer = this.#clock.setTimeout(() => {
      this.#timer = undefined;
      const head = this.#pending!;
      this.#pending = null;
      this.#work = this.#run(head).then(() => { this.#warmed = head; }, () => {}).finally(() => {
        this.#work = undefined;
        if (this.#pending === this.#warmed) this.#pending = null;
        this.#schedule();
      });
    }, Math.max(1, this.#due - this.#clock.now().getTime()));
    this.#timer.unref();
  }
  async close(): Promise<void> {
    this.#closed = true; this.#pending = null;
    this.#clock.clearTimeout(this.#timer);
    await this.#work;
  }
}
