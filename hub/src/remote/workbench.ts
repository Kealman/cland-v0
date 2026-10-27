import { isDeepStrictEqual } from 'node:util';
import type { RemoteStateRow } from '../protocol.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';

/** One publication owner: urgent facts immediately, depth-only changes at most once per second. */
export class RemoteWorkbench {
  readonly #clock: Clock;
  readonly #read: () => RemoteStateRow[];
  readonly #publish: (rows: RemoteStateRow[]) => void;
  #last: RemoteStateRow[] | undefined;
  #at = -Infinity;
  #timer: ClockTimer | undefined;
  #pending = false;
  #closed = false;
  constructor(clock: Clock, read: () => RemoteStateRow[], publish: (rows: RemoteStateRow[]) => void) {
    this.#clock = clock; this.#read = read; this.#publish = publish;
  }
  changed = (): void => {
    if (this.#closed || this.#pending) return;
    this.#pending = true;
    // Domain writers may still be inside a SQLite transaction. Read after it commits.
    queueMicrotask(() => { this.#pending = false; if (!this.#closed) this.#flush(); });
  };
  #flush(): void {
    const rows = this.#read();
    if (isDeepStrictEqual(rows, this.#last)) return;
    const facts = (values: RemoteStateRow[]) => values.map(({ outboxDepth: _, ...row }) => row);
    const urgent = !this.#last || !isDeepStrictEqual(facts(rows), facts(this.#last));
    const remaining = 1_000 - (this.#clock.now().getTime() - this.#at);
    if (!urgent && remaining > 0) {
      this.#timer ??= this.#clock.setTimeout(() => { this.#timer = undefined; this.#flush(); }, remaining);
      this.#timer.unref();
      return;
    }
    this.#clock.clearTimeout(this.#timer); this.#timer = undefined;
    this.#last = rows; this.#at = this.#clock.now().getTime();
    this.#publish(rows);
  }
  close(): void {
    this.#closed = true;
    this.#clock.clearTimeout(this.#timer); this.#timer = undefined;
  }
}
