// Hygiene: the rate limit per session, the loop breaker per pair, the size cap. Pure bookkeeping
// over a clock: the core asks it and acts on the answer.
//
// TODO(config): the thresholds are constants for now; a later ticket moves them into the project's config.

export type RateLimit = { max: number; windowMs: number };
export type LoopBreaker = { max: number; windowMs: number; muteMs: number };

export const RATE_LIMIT: RateLimit = { max: 30, windowMs: 10 * 60 * 1000 };
export const LOOP_BREAKER: LoopBreaker = { max: 20, windowMs: 5 * 60 * 1000, muteMs: 10 * 60 * 1000 };
export const MAX_TEXT_BYTES = 8 * 1024;

export const pairKey = (a: string, b: string): string => [a, b].sort().join('|');
const minutes = (ms: number): number => Math.round(ms / 60_000);

export class Hygiene {
  readonly #rate: RateLimit;
  readonly #loop: LoopBreaker;
  readonly #maxBytes: number;
  readonly #outbound = new Map<string, number[]>(); // session → send instants in the window
  readonly #pairs = new Map<string, number[]>(); // pair → agent-to-agent instants in the window
  readonly #muted = new Map<string, number>(); // pair → muted until

  constructor(options: { rateLimit?: RateLimit; loopBreaker?: LoopBreaker; maxTextBytes?: number } = {}) {
    this.#rate = options.rateLimit ?? RATE_LIMIT;
    this.#loop = options.loopBreaker ?? LOOP_BREAKER;
    this.#maxBytes = options.maxTextBytes ?? MAX_TEXT_BYTES;
  }

  /** The reason a text may not be sent at all, or null. */
  sizeRefusal(text: string): string | null {
    const bytes = Buffer.byteLength(text, 'utf8');
    return bytes > this.#maxBytes ? `message is ${bytes} bytes; the cap is ${this.#maxBytes} — put the material in an item or a file and send the pointer` : null;
  }

  /** Human text over the cap, cut with a marker that names the original length. */
  truncate(text: string): string {
    if (Buffer.byteLength(text, 'utf8') <= this.#maxBytes) return text;
    const head = Buffer.from(text, 'utf8').subarray(0, this.#maxBytes - 64).toString('utf8').replace(/�+$/, '');
    return `${head} … [truncated by the hub: ${text.length} chars]`;
  }

  /** Count one outbound message for a session; the refusal reason when the window is full, else null. */
  rateRefusal(session: string, now: number): string | null {
    const stamps = (this.#outbound.get(session) ?? []).filter((t) => now - t < this.#rate.windowMs);
    this.#outbound.set(session, stamps);
    if (stamps.length >= this.#rate.max) {
      return `rate limit: ${this.#rate.max} messages in ${minutes(this.#rate.windowMs)} min — the window frees at ${new Date((stamps[0] as number) + this.#rate.windowMs).toISOString()}`;
    }
    stamps.push(now);
    return null;
  }

  /** Why a pair may not talk now, or null. An expired mute is forgotten on the way. */
  muteRefusal(a: string, b: string, now: number): string | null {
    const key = pairKey(a, b);
    const until = this.#muted.get(key);
    if (until === undefined) return null;
    if (until <= now) {
      this.#muted.delete(key);
      return null;
    }
    // A hard cool-down, not "waiting for a human message": a message from a person only resets the count
    // for the NEXT window, so a comment in a real loop cannot reopen it; lifting it early is `unmute`.
    return `loop breaker: ${a} ↔ ${b} exchanged more than ${this.#loop.max} messages in ${minutes(this.#loop.windowMs)} min with no human in between — a hard ${minutes(this.#loop.muteMs)}-min cool-down, muted until ${new Date(until).toISOString()}`;
  }

  /** Count an agent-to-agent message; when it crosses the threshold the pair is muted and the mute's end is returned. */
  countPair(a: string, b: string, now: number): number | null {
    const key = pairKey(a, b);
    const stamps = (this.#pairs.get(key) ?? []).filter((t) => now - t < this.#loop.windowMs);
    stamps.push(now);
    this.#pairs.set(key, stamps);
    if (stamps.length <= this.#loop.max) return null;
    const until = now + this.#loop.muteMs;
    this.#muted.set(key, until);
    this.#pairs.delete(key);
    return until;
  }

  /** A person lifts a running mute: clears the pair's mute and its count. Returns whether a mute was lifted. */
  unmute(a: string, b: string): boolean {
    const key = pairKey(a, b);
    this.#pairs.delete(key);
    return this.#muted.delete(key);
  }

  /** A human wrote to a session: every pair it is in starts counting afresh. The mute itself runs its course. */
  humanTouched(session: string): void {
    for (const key of [...this.#pairs.keys()]) if (key.split('|').includes(session)) this.#pairs.delete(key);
  }

  get loopBreaker(): LoopBreaker {
    return this.#loop;
  }
}
