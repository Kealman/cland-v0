// In-memory browser credentials. The hub secret is deliberately not an input.
import { createHash, randomBytes } from 'node:crypto';

export const WEB_SESSION_SECONDS = 30 * 24 * 60 * 60;
const LINK_MS = 5 * 60 * 1000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export class WebAuth {
  readonly cookieName: string;
  readonly #now: () => number;
  readonly #links: Map<string, number>;
  readonly #sessions = new Map<string, number>();

  /** `root` is the canonical project root; the optional link store holds digests only. */
  constructor(root: string, now: () => number = Date.now, links = new Map<string, number>()) {
    this.cookieName = `cland_${digest(root).slice(0, 12)}`;
    this.#now = now;
    this.#links = links;
  }

  #prune(): void {
    const now = this.#now();
    for (const store of [this.#links, this.#sessions]) {
      for (const [hash, expires] of store) if (expires <= now) store.delete(hash);
    }
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
    this.#sessions.set(digest(session), this.#now() + WEB_SESSION_SECONDS * 1000);
    return session;
  }

  accepts(cookie: string | undefined): boolean {
    this.#prune();
    const matches = (cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${this.cookieName}=`));
    return matches.length === 1 && this.#sessions.has(digest(matches[0]!.slice(this.cookieName.length + 1)));
  }
}
