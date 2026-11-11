import type { WaitingLaunch } from '../protocol.ts';
import type { Store } from '../hub/store.ts';
import type { HubCards } from '../hub/hub-cards.ts';

const metadataKey = 'login-wait-cards';
type WaitCard = { pool: string; harness: string; id: string };

/** One prompt for each continuous pool/harness wait, including answered prompts.
 * Only active waits are retained; no ask history scan is needed on restart. */
export class LoginCards {
  readonly store: Store;
  readonly cards: HubCards;
  constructor(store: Store, cards: HubCards) {
    this.store = store; this.cards = cards;
    cards.onAnswer('login-create', (payload, _answer, context) => {
      const { pool, harness } = payload as WaitCard;
      return context.declined || context.option !== 1
        ? 'Not now'
        : `cland login add ${harness} --pool ${pool}`;
    });
  }

  reconcile(waits: readonly WaitingLaunch[]): void {
    const wanted = new Map<string, { pool: string; harness: string }>();
    for (const wait of waits) {
      // The reason is supplied by the placement verdict, never re-selected here.
      const match = /^waiting for a login (claude-code|codex|opencode)$/.exec(wait.reason);
      if (match) wanted.set(JSON.stringify([wait.pool, match[1]]), { pool: wait.pool, harness: match[1]! });
    }
    this.store.transaction(() => {
      const previous = JSON.parse(this.store.meta(metadataKey) ?? '{}') as Record<string, WaitCard>;
      const current: Record<string, WaitCard> = {};
      for (const [key, demand] of wanted) {
        current[key] = previous[key] ?? { ...demand, id: this.cards.raise('login-create', 'general',
          `Not enough ${demand.harness} logins. Create one?`, ['Create one', 'Not now'], false, demand) };
      }
      for (const [key, card] of Object.entries(previous)) {
        if (!wanted.has(key) && this.store.ask(card.id)?.state === 'open') this.cards.withdraw(card.id, 'No launches waiting for this login');
      }
      this.store.setMeta(metadataKey, JSON.stringify(current));
    });
  }
}
