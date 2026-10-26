import { randomBytes } from 'node:crypto';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import type { InboxPairing, RemoteVia } from '../protocol.ts';
import type { Pairing, RemoteState } from './state.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Project-owned pairing requests; the platform supplies numeric identity, never a frame actor. */
export class PairingCodes {
  readonly #state: RemoteState;
  readonly #clock: Clock;
  readonly #changed: () => void;
  readonly #listeners = new Set<() => void>();
  #timer: ClockTimer | undefined;
  #closed = false;

  constructor(state: RemoteState, clock: Clock, changed: () => void) {
    this.#state = state; this.#clock = clock; this.#changed = changed;
    this.waiting();
  }

  issue(messenger: RemoteVia, identity: Pairing): string | null {
    if (this.#closed) throw new Error('pairing is closed');
    this.waiting();
    const remote = this.#state.forMessenger(messenger);
    if (remote.replies(identity.userId) >= 2) return null;
    remote.countReply(identity.userId);
    const waiting = remote.requests();
    const previous = waiting.find(request => request.userId === identity.userId && request.chatId === identity.chatId && request.guildId === identity.guildId);
    if (previous) return this.#reply(messenger, identity.userId, previous.code);
    if (waiting.length >= 3) return 'Three pairing codes are already waiting; ask the project owner to resolve them.';
    let code: string;
    do { code = [...randomBytes(8)].map(byte => ALPHABET[byte & 31]).join(''); }
    while (remote.requests().some(request => request.code === code));
    const now = this.#clock.now().getTime();
    remote.putRequest({ ...identity, code, created: new Date(now).toISOString(), expires: new Date(now + (messenger === 'telegram' ? 3600_000 : 900_000)).toISOString() });
    this.waiting();
    this.#notify();
    return this.#reply(messenger, identity.userId, code);
  }

  /** Current durable requests, with a stable id for local approval in the next layer. */
  waiting(): InboxPairing[] {
    const now = this.#clock.now().getTime();
    const rows: InboxPairing[] = [];
    let removed = false;
    for (const messenger of ['telegram', 'discord'] as const) {
      const remote = this.#state.forMessenger(messenger);
      for (const request of remote.requests()) {
        if (Date.parse(request.expires) <= now) {
          remote.removeRequest(request.code); removed = true; continue;
        }
        const label = messenger === 'telegram' ? 'Telegram' : 'Discord';
        rows.push({ ...request, id: `pairing:${messenger}:${request.code}`, messenger,
          text: `Pair ${label} user ${request.userId} (${request.name})? code ${request.code}`,
          command: `cland remote approve ${messenger} ${request.code}`, since: request.created, layer: 'now' });
      }
    }
    if (this.#timer) this.#clock.clearTimeout(this.#timer);
    this.#timer = undefined;
    if (rows.length && !this.#closed) {
      const next = Math.min(...rows.map(row => Date.parse(row.expires)));
      this.#timer = this.#clock.setTimeout(() => { this.#timer = undefined; this.waiting(); }, next - now);
      this.#timer.unref();
    }
    if (removed) this.#notify();
    return rows;
  }

  /** Approval callers must resolve again at the point they grant access. */
  get(id: string): InboxPairing | null { return this.waiting().find(row => row.id === id) ?? null; }

  clear(messenger: RemoteVia): void {
    if (this.#closed) throw new Error('pairing is closed');
    const remote = this.#state.forMessenger(messenger);
    for (const row of remote.requests()) remote.removeRequest(row.code);
    this.waiting();
    this.#notify();
  }

  close(): void {
    this.#closed = true;
    if (this.#timer) this.#clock.clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#listeners.clear();
  }

  /** Invalidate synchronous read replay at persistence, before the coalesced inbox publication. */
  onChange(listener: () => void): void { this.#listeners.add(listener); }

  #notify(): void {
    this.#changed();
    for (const listener of this.#listeners) listener();
  }

  #reply(messenger: RemoteVia, userId: string, code: string): string {
    return `Pair ${messenger === 'telegram' ? 'Telegram' : 'Discord'} user ${userId}: code ${code}\ncland remote approve ${messenger} ${code}\nask the project's owner to approve`;
  }
}
