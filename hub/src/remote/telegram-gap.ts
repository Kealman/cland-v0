import type { RemoteStore } from './state.ts';
import type { Clock } from '../hub/clock.ts';
import { flushGap, type GapSend } from './gap.ts';

export type TelegramGapSend = GapSend;

/** Preserve Telegram's persisted key and native job identity predicate. */
export function flushTelegramGap(store: RemoteStore, clock: Clock, send: TelegramGapSend): Promise<boolean> {
  return flushGap(store, clock, { stateKey: 'telegram.gap', matches: (job, pairing) => {
    const payload = job.payload as { telegram?: boolean; userId?: string; params?: { chat_id?: string | number } } | null;
    return payload?.telegram === true && String(payload.params?.chat_id) === pairing.chatId
      && (payload.userId === undefined || payload.userId === pairing.userId);
  } }, send);
}
