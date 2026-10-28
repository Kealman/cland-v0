import type { Clock } from '../hub/clock.ts';
import type { RemoteStore } from './state.ts';

const DAY = 86400000;
type Budget = { timestamps: number[]; failures: number; warned: number | null; retryAt?: number };
/** Reserve before writing to the socket: crashes may overcount, never undercount. */
export class DiscordIdentifyBudget {
  readonly #clock: Clock;
  readonly #store: RemoteStore | undefined;
  #state: Budget;
  constructor(clock: Clock, store?: RemoteStore) {
    this.#clock = clock; this.#store = store;
    this.#state = JSON.parse(store?.get('discord.identify') ?? 'null') ?? { timestamps: [], failures: 0, warned: null };
  }
  delay(random: () => number): number {
    const last = this.#state.timestamps.at(-1);
    if (last === undefined) return 0;
    const backoff = this.#state.failures ? Math.min(300000, 5000 * 2 ** Math.min(this.#state.failures - 1, 6)) * (0.5 + random() * 0.5) : 0;
    return Math.max(0, Math.max(last + 5000, this.#state.retryAt ?? last + backoff) - this.#clock.now().getTime());
  }
  reserve(): boolean {
    const now = this.#clock.now().getTime();
    this.#state.timestamps = this.#state.timestamps.filter(at => at > now - DAY);
    this.#state.timestamps.push(now);
    this.#state.failures++; delete this.#state.retryAt;
    const warn = this.#state.timestamps.length >= 500 && (this.#state.warned === null || now - this.#state.warned >= DAY);
    if (warn) this.#state.warned = now;
    this.#save(); return warn;
  }
  failed(random: () => number): void {
    const backoff = Math.min(300000, 5000 * 2 ** Math.min(this.#state.failures - 1, 6));
    this.#state.retryAt = this.#clock.now().getTime() + backoff * (0.5 + random() * 0.5);
    this.#save();
  }
  ready(): void { this.#state.failures = 0; delete this.#state.retryAt; this.#save(); }
  #save(): void { this.#store?.set('discord.identify', JSON.stringify(this.#state)); }
}
