import { TelegramError } from './telegram-api.ts';
import type { RemoteStore, OutboxJob, Pairing } from './state.ts';
import type { Clock } from '../hub/clock.ts';
import { remotePublications } from './cards.ts';
import { flushGap, type GapSend } from './gap.ts';

export type TelegramGapSend = GapSend;

function matches(job: OutboxJob, pairing: Pairing): boolean {
  const payload = job.payload as { telegram?: boolean; userId?: string; clandUserId?: string; params?: { chat_id?: string | number } } | null;
  return payload?.telegram === true && String(payload.params?.chat_id) === pairing.chatId
    && (payload.userId === undefined || payload.userId === pairing.userId)
    && (pairing.clandUserId === undefined || payload.clandUserId === pairing.clandUserId);
}

/** Preserve Telegram's persisted key and native job identity predicate. */
export function flushTelegramGap(store: RemoteStore, clock: Clock, send: TelegramGapSend, chat?: string): Promise<boolean> {
  return remotePublications(store, async pairing => {
    if (chat !== undefined && pairing.chatId !== chat) return true;
    try {
      return await flushGap(store, clock, {
        ...(pairing.clandUserId ? { owner: pairing.clandUserId } : {}),
        stateKey: pairing.clandUserId ? `telegram.gap:${pairing.chatId}` : 'telegram.gap', matches,
      }, async (chat, text, key) => {
        // A durable unknown result fences the informational line, not recovery.
        // Do not mutate that job or attempt, or submit its native effect again.
        const uncertain = () => {
          const pairing = store.pairing();
          if (!pairing || pairing.chatId !== chat) return false;
          return store.outbox(['uncertain']).some(job => {
            const payload = job.payload as { key?: string } | null;
            // flushGap has already matched its captured user/chat to this pairing.
            return matches(job, pairing) && payload?.key === key;
          });
        };
        if (uncertain()) {
          if (pairing.clandUserId) throw new PendingTelegramGap();
          return;
        }
        try { await send(chat, text, key); }
        catch (error) {
          if (error instanceof TelegramError && [401, 403, 409].includes(error.code)) throw error;
          if (pairing.clandUserId && uncertain()) throw new PendingTelegramGap();
          if (!uncertain()) throw error;
        }
      });
    } catch (error) {
      // A destination's pending notice cannot hold healthy polling/cards behind it.
      // Keep its checkpoint and all missed jobs; only bot-level faults escape.
      if (pairing.clandUserId && (error instanceof PendingTelegramGap
        || error instanceof TelegramError && ![401, 409].includes(error.code))) return true;
      throw error;
    }
  }).then(results => results.every(Boolean));
}

class PendingTelegramGap extends Error {}
