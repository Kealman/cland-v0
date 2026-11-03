// One-time links are volatile; browser sessions are persisted as digests. The hub secret is deliberately not an input.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { Store } from './store.ts';

export const WEB_SESSION_SECONDS = 30 * 24 * 60 * 60;
const LINK_MS = 5 * 60 * 1000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export class WebAuth {
  #fences = 0;
  readonly cookieName: string;
  readonly #now: () => number;
  readonly #links: Map<string, number>;
  readonly #store: Store;
  readonly #linkUsers = new Map<string, string>();

  /** `root` is the canonical project root; the optional link store holds digests only. */
  constructor(root: string, store: Store, now: () => number = Date.now, links = new Map<string, number>()) {
    this.cookieName = `cland_${digest(root).slice(0, 12)}`;
    this.#now = now;
    this.#store = store;
    this.#links = links;
  }

  #prune(): void {
    const now = this.#now();
    for (const [hash, expires] of this.#links) if (expires <= now) { this.#links.delete(hash); this.#linkUsers.delete(hash); }
    this.#store.pruneWebSessions(now - WEB_SESSION_SECONDS * 1000);
  }

  fence(): () => void {
    this.#fences++;
    let released = false;
    return () => { if (!released) { released = true; this.#fences--; } };
  }

  revokeAll(): void { this.#links.clear(); this.#linkUsers.clear(); this.#store.revokeAllWebSessions(); }

  assertAdmission(): void {
    if (this.#fences) throw new Error('browser sign-in transition is in progress');
  }

  mint(userId?: string): string {
    if (userId !== undefined && this.#store.users.get(userId)?.state !== 'active') throw new Error('unknown or inactive user');
    if (this.#store.users.mode() === 'users' && !userId) throw new Error('users mode requires a user-bound link');
    this.assertAdmission();
    this.#prune();
    const token = randomBytes(32).toString('hex');
    this.#links.set(digest(token), this.#now() + LINK_MS);
    if (userId) this.#linkUsers.set(digest(token), userId);
    return token;
  }

  redeem(token: string): string | null {
    if (this.#fences) return null;
    this.#prune();
    if (!this.#links.delete(digest(token))) return null;
    const userId = this.#linkUsers.get(digest(token)) ?? null;
    this.#linkUsers.delete(digest(token));
    if (this.#store.users.mode() === 'users' && (!userId || this.#store.users.get(userId)?.state !== 'active')) return null;
    const session = randomBytes(32).toString('hex');
    this.#store.createWebSession(randomUUID(), digest(session), this.#now(), userId);
    return session;
  }

  /** Issue only after the caller's credential validation; may join its Store transaction. */
  issue(userId: string): string {
    this.assertAdmission();
    if (this.#store.users.mode() !== 'users' || this.#store.users.get(userId)?.state !== 'active') throw new Error('unknown or inactive user');
    const session = randomBytes(32).toString('hex');
    this.#store.createWebSession(randomUUID(), digest(session), this.#now(), userId);
    return session;
  }

  accepts(cookie: string | undefined): boolean {
    return this.session(cookie) !== null;
  }

  /** Authenticate an upgrade and record its last use; expiry is fixed at creation. */
  session(cookie: string | undefined): string | null {
    if (this.#fences) return null;
    const matches = (cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${this.cookieName}=`));
    if (matches.length !== 1) return null;
    const now = this.#now();
    return this.#store.useWebSession(digest(matches[0]!.slice(this.cookieName.length + 1)), now, now - WEB_SESSION_SECONDS * 1000);
  }

  /** Read only the identity captured at this socket's authenticated upgrade. */
  profile(id: string): import('../protocol.ts').WebSessionResult {
    this.#prune();
    const row = this.#store.webSession(id);
    if (!row) throw new Error('this browser sign-in has expired or was revoked');
    const user = this.user(id);
    return {
      ...(user ? { user: { id: user.id, name: user.name, displayName: user.displayName, role: user.role } } : {}),
      createdAt: new Date(row.createdAt).toISOString(),
      lastUsedAt: new Date(row.lastUsedAt).toISOString(),
      expiresAt: new Date(row.createdAt + WEB_SESSION_SECONDS * 1000).toISOString(),
    };
  }

  user(id: string): import('./users.ts').User | null {
    if (this.#store.users.mode() !== 'users') return null;
    const row = this.#store.webSession(id);
    const user = row?.userId ? this.#store.users.get(row.userId) : null;
    if (!user || user.state !== 'active') throw new Error('browser sign-in has no active user');
    return user;
  }

  sessions(): Array<{ id: string; createdAt: string; lastUsedAt: string }> {
    this.#prune();
    return this.#store.webSessions().map(row => ({ id: row.id, createdAt: new Date(row.createdAt).toISOString(), lastUsedAt: new Date(row.lastUsedAt).toISOString() }));
  }

  /** Capabilities check the same fixed session lifetime without requiring its cookie. */
  active(id: string): boolean {
    if (this.#fences) return false;
    this.#prune();
    return this.#store.webSessionActive(id, this.#now() - WEB_SESSION_SECONDS * 1000);
  }

  revoke(id: string): boolean { return this.#store.revokeWebSession(id); }
}

/** The single cookie policy seam for link, invite and credential sign-in. */
export function webSessionCookie(auth: WebAuth, token: string, req: import('node:http').IncomingMessage, origin: string): string {
  return `${auth.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${WEB_SESSION_SECONDS}${origin && req.headers.host?.toLowerCase() === new URL(origin).host ? '; Secure' : ''}`;
}
