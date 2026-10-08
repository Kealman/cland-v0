// Hygiene: the rate limit per session, the loop breaker per pair, the size cap. Pure bookkeeping
// over a clock: the core asks it and acts on the answer. Every key is a session's stable identity (its
// harness session id, never its name, which a rename changes); names appear only in the reasons. With a memory (the hub's store) every change is
// written through, so a restarted hub keeps a running mute, a pair's count and a session's rate window.
//
// The constants below are the defaults (BCAS's); a project's `.cland/config.toml` `[hygiene]` overrides them at hub
// start (`src/init/config.ts`, read by the daemon).
import type { HygieneRefusal } from '../protocol.ts';

export type RateLimit = { max: number; windowMs: number };
export type LoopBreaker = { max: number; windowMs: number; muteMs: number };

export const RATE_LIMIT: RateLimit = { max: 30, windowMs: 10 * 60 * 1000 };
export const LOOP_BREAKER: LoopBreaker = { max: 20, windowMs: 5 * 60 * 1000, muteMs: 10 * 60 * 1000 };
export const MAX_TEXT_BYTES = 8 * 1024;

/** A send hygiene refused as a whole (the size cap, the rate limit): the reason, and the typed refusal the
 *  request's result carries (`{ code: 'hygiene', rule }`). */
export class HygieneError extends Error {
  readonly refusal: HygieneRefusal;
  constructor(message: string, refusal: HygieneRefusal) {
    super(message);
    this.refusal = refusal;
  }
}

/** One piece of hygiene's state: a session's send instants, a pair's instants, or a pair's mute end. */
export type HygieneRow = { kind: 'outbound' | 'pair' | 'mute'; key: string; value: string };

/** Where hygiene keeps its state across restarts. */
export interface HygieneMemory {
  hygieneRows(): HygieneRow[];
  saveHygiene(kind: HygieneRow['kind'], key: string, value: string | null): void;
}

export const pairKey = (a: string, b: string): string => [a, b].sort().join('|');
const minutes = (ms: number): number => Math.round(ms / 60_000);

export class Hygiene {
  readonly #rate: RateLimit;
  readonly #loop: LoopBreaker;
  readonly #maxBytes: number;
  readonly #outbound = new Map<string, number[]>(); // session → send instants in the window
  readonly #pairs = new Map<string, number[]>(); // pair → agent-to-agent instants in the window
  readonly #muted = new Map<string, number>(); // pair → muted until
  readonly #memory: HygieneMemory | null;

  constructor(options: { rateLimit?: RateLimit; loopBreaker?: LoopBreaker; maxTextBytes?: number; memory?: HygieneMemory } = {}) {
    this.#rate = options.rateLimit ?? RATE_LIMIT;
    this.#loop = options.loopBreaker ?? LOOP_BREAKER;
    this.#maxBytes = options.maxTextBytes ?? MAX_TEXT_BYTES;
    this.#memory = options.memory ?? null;
    for (const row of this.#memory?.hygieneRows() ?? []) {
      try {
        const value: unknown = JSON.parse(row.value);
        if (row.kind === 'mute' && typeof value === 'number') this.#muted.set(row.key, value);
        else if (Array.isArray(value) && value.every((v) => typeof v === 'number')) (row.kind === 'pair' ? this.#pairs : this.#outbound).set(row.key, value);
      } catch {
        /* an unreadable row is no state */
      }
    }
  }

  /** Write one map entry through to the memory (or forget it there when it is gone here). */
  #save(kind: HygieneRow['kind'], key: string): void {
    if (!this.#memory) return;
    const map = kind === 'mute' ? this.#muted : kind === 'pair' ? this.#pairs : this.#outbound;
    const value = map.get(key);
    const empty = value === undefined || (Array.isArray(value) && value.length === 0);
    this.#memory.saveHygiene(kind, key, empty ? null : JSON.stringify(value));
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
      this.#save('outbound', session);
      return `rate limit: ${this.#rate.max} messages in ${minutes(this.#rate.windowMs)} min — the window frees at ${new Date((stamps[0] as number) + this.#rate.windowMs).toISOString()}`;
    }
    stamps.push(now);
    this.#save('outbound', session);
    return null;
  }

  /** Why a pair may not talk now, or null. An expired mute is forgotten on the way. `names` are what the
   *  reason calls the two sessions (their current names); the keys by default. */
  muteRefusal(a: string, b: string, now: number, names: readonly [string, string] = [a, b]): string | null {
    const key = pairKey(a, b);
    const until = this.#muted.get(key);
    if (until === undefined) return null;
    if (until <= now) {
      this.#muted.delete(key);
      this.#save('mute', key);
      return null;
    }
    // A hard cool-down, not "waiting for a human message": a message from a person only resets the count
    // for the NEXT window, so a comment in a real loop cannot reopen it; lifting it early is `unmute`.
    return `loop breaker: ${names[0]} ↔ ${names[1]} exchanged more than ${this.#loop.max} messages in ${minutes(this.#loop.windowMs)} min with no human in between — a hard ${minutes(this.#loop.muteMs)}-min cool-down, muted until ${new Date(until).toISOString()}`;
  }

  /** When a running mute of the pair ends (ms epoch), or null. */
  mutedUntil(a: string, b: string, now: number): number | null {
    const until = this.#muted.get(pairKey(a, b));
    return until !== undefined && until > now ? until : null;
  }

  /** Count an agent-to-agent message; when it crosses the threshold the pair is muted and the mute's end is returned. */
  countPair(a: string, b: string, now: number): number | null {
    const key = pairKey(a, b);
    const stamps = (this.#pairs.get(key) ?? []).filter((t) => now - t < this.#loop.windowMs);
    stamps.push(now);
    this.#pairs.set(key, stamps);
    if (stamps.length <= this.#loop.max) {
      this.#save('pair', key);
      return null;
    }
    const until = now + this.#loop.muteMs;
    this.#muted.set(key, until);
    this.#pairs.delete(key);
    this.#save('mute', key);
    this.#save('pair', key);
    return until;
  }

  /** A person lifts a running mute: clears the pair's mute and its count. Returns whether a mute was lifted. */
  unmute(a: string, b: string): boolean {
    const key = pairKey(a, b);
    this.#pairs.delete(key);
    const lifted = this.#muted.delete(key);
    this.#save('pair', key);
    this.#save('mute', key);
    return lifted;
  }

  /** A human wrote to a session: every pair it is in starts counting afresh. The mute itself runs its course. */
  humanTouched(session: string): void {
    for (const key of [...this.#pairs.keys()]) {
      if (!key.split('|').includes(session)) continue;
      this.#pairs.delete(key);
      this.#save('pair', key);
    }
  }

  get loopBreaker(): LoopBreaker {
    return this.#loop;
  }
}
