import type { ModelDelta } from '../protocol.ts';
import type { Clock, ClockTimer } from './clock.ts';

const MAX_AGE_MS = 15 * 60 * 1000;
export const MODEL_BYTES = 4 * 1024 * 1024;
type Entry = { seq: number; at: number; full: string; slim: string; bytes: number };

/** The epoch's bounded wire history. Only the core's model emit point appends. */
export class ModelRing {
  readonly #clock: Clock;
  readonly #entries: Entry[] = [];
  #bytes = 0;
  #latest = 0;
  #closed = false;
  #timer: ClockTimer | undefined;
  constructor(clock: Clock) { this.#clock = clock; }

  append(full: ModelDelta, slim: ModelDelta = full): { full: string; slim: string } {
    const json = JSON.stringify(full);
    let slimJson = slim === full ? json : JSON.stringify(slim);
    if (slimJson === json) slimJson = json; // Retain one string when the shapes encode identically.
    if (this.#closed) return { full: json, slim: slimJson };
    const bytes = Buffer.byteLength(json) + (slimJson === json ? 0 : Buffer.byteLength(slimJson));
    this.#latest = full.seq;
    this.#entries.push({ seq: full.seq, at: this.#clock.now().getTime(), full: json, slim: slimJson, bytes });
    this.#bytes += bytes;
    this.#prune();
    return { full: json, slim: slimJson };
  }

  /** Null means the missing interval is no longer contiguous in this ring. */
  after(seq: number, slim: boolean): string[] | null {
    if (this.#closed) return null;
    this.#prune();
    const first = this.#entries[0]?.seq ?? this.#latest + 1;
    if (!Number.isSafeInteger(seq) || seq < first - 1 || seq > this.#latest) return null;
    return this.#entries.filter(entry => entry.seq > seq).map(entry => slim ? entry.slim : entry.full);
  }

  #prune(): void {
    const now = this.#clock.now().getTime();
    while (this.#entries.length && (this.#bytes > MODEL_BYTES || now - this.#entries[0]!.at > MAX_AGE_MS)) {
      this.#bytes -= this.#entries.shift()!.bytes;
    }
    this.#clock.clearTimeout(this.#timer);
    const first = this.#entries[0];
    this.#timer = first ? this.#clock.setTimeout(() => this.#prune(), first.at + MAX_AGE_MS + 1 - now) : undefined;
    this.#timer?.unref();
  }

  close(): void {
    this.#closed = true;
    this.#clock.clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#entries.length = 0; this.#bytes = 0;
  }
}
