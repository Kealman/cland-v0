// One-time links are volatile; browser sessions are persisted as digests. The hub secret is deliberately not an input.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { Store } from './store.ts';

export const WEB_SESSION_SECONDS = 30 * 24 * 60 * 60;
const LINK_MS = 5 * 60 * 1000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export class WebAuth {
  readonly cookieName: string;
  readonly #now: () => number;
  readonly #links: Map<string, number>;
  readonly #store: Store;

  /** `root` is the canonical project root; the optional link store holds digests only. */
  constructor(root: string, store: Store, now: () => number = Date.now, links = new Map<string, number>()) {
    this.cookieName = `cland_${digest(root).slice(0, 12)}`;
    this.#now = now;
    this.#store = store;
    this.#links = links;
  }

  #prune(): void {
    const now = this.#now();
    for (const [hash, expires] of this.#links) if (expires <= now) this.#links.delete(hash);
    this.#store.pruneWebSessions(now - WEB_SESSION_SECONDS * 1000);
  }

  mint(): string {
    this.#prune();
    const token = randomBytes(32).toString('hex');
    this.#links.set(digest(token), this.#now() + LINK_MS);
    return token;
  }

  redeem(token: string): string | null {
    this.#prune();
    if (!this.#links.delete(digest(token))) return null;
    const session = randomBytes(32).toString('hex');
    this.#store.createWebSession(randomUUID(), digest(session), this.#now());
    return session;
  }

  accepts(cookie: string | undefined): boolean {
    return this.session(cookie) !== null;
  }

  /** Authenticate an upgrade and record its last use; expiry is fixed at creation. */
  session(cookie: string | undefined): string | null {
    const matches = (cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${this.cookieName}=`));
    if (matches.length !== 1) return null;
    const now = this.#now();
    return this.#store.useWebSession(digest(matches[0]!.slice(this.cookieName.length + 1)), now, now - WEB_SESSION_SECONDS * 1000);
  }

  sessions(): Array<{ id: string; createdAt: string; lastUsedAt: string }> {
    this.#prune();
    return this.#store.webSessions().map(row => ({ id: row.id, createdAt: new Date(row.createdAt).toISOString(), lastUsedAt: new Date(row.lastUsedAt).toISOString() }));
  }

  revoke(id: string): boolean { return this.#store.revokeWebSession(id); }
}
