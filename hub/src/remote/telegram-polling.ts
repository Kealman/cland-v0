import type { LogFn } from '../log.ts';
import type { Clock } from '../hub/clock.ts';
import type { RemoteStore } from './state.ts';
import { TelegramError, type TelegramApi, type TgUpdate, type TgUpdateKind } from './telegram-api.ts';

export const TELEGRAM_ALLOWED_UPDATES: readonly TgUpdateKind[] = ['message', 'edited_message', 'callback_query', 'my_chat_member'];
/** Resolve only when the handler's effects are durable. Cancellation must drain its writers. */
export type TelegramUpdateHandler = {
  /** Pairing handlers see only private /start input; all other handlers require the current pairing. */
  kind?: 'paired' | 'pairing';
  accepts: (update: TgUpdate) => boolean;
  handle: (update: TgUpdate, signal: AbortSignal) => Promise<void>;
};
export type TelegramPollingOptions = {
  store: RemoteStore; handlers?: readonly TelegramUpdateHandler[]; log?: LogFn;
  notice?: (cause: string, fix: string) => void;
};

function identity(update: TgUpdate, botId: number): { userId: string; chatId: string; dedupe?: string } | null {
  const kinds = Object.keys(update).filter(key => key !== 'update_id');
  if (kinds.length !== 1 || !TELEGRAM_ALLOWED_UPDATES.some(kind => kind === kinds[0])) return null;
  const message = update.message ?? update.edited_message;
  const callback = update.callback_query;
  const member = update.my_chat_member;
  const chat = message?.chat ?? callback?.message?.chat ?? member?.chat;
  const from = message?.from ?? callback?.from ?? member?.from;
  if (!chat || chat.type !== 'private' || !Number.isSafeInteger(chat.id)
    || !from || !Number.isSafeInteger(from.id) || from.is_bot !== false || from.id === botId) return null;
  if (message && (!Number.isSafeInteger(message.message_id) || message.message_id <= 0)) return null;
  if (callback && (typeof callback.id !== 'string' || !callback.id)) return null;
  if (member && member.new_chat_member?.user?.id !== botId) return null;
  return { userId: String(from.id), chatId: String(chat.id),
    ...(message ? { dedupe: `message:${chat.id}:${message.message_id}` }
      : callback ? { dedupe: `callback:${callback.id}` } : {}),
  };
}

/** One serial poll owner under Gateway's lease; all timing is injected. */
export async function pollTelegram(api: TelegramApi, clock: Clock, botId: number, options: TelegramPollingOptions,
  signal: AbortSignal, exchanged: () => void): Promise<void> {
  const store = options.store;
  let offline = false;
  let conflictSince: number | undefined;
  let unhandled: number | undefined;
  while (!signal.aborted) {
    let updates: TgUpdate[];
    try {
      const offset = store.get('telegram.offset');
      updates = await boundedPoll(api, clock, offset, offline ? 0 : 40, signal);
      if (!Array.isArray(updates)) throw new Error('Telegram returned invalid updates');
      exchanged();
      offline = false;
      conflictSince = undefined;
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof TelegramError && [401, 403].includes(error.code)) throw error;
      if (error instanceof TelegramError && error.code === 409) {
        conflictSince ??= clock.now().getTime();
        if (clock.now().getTime() - conflictSince >= 60_000)
          throw new TelegramError('getUpdates', 409, 'another consumer of the token');
      } else conflictSince = undefined;
      offline = true;
      const delay = conflictSince !== undefined
        ? Math.min(1_000, 60_000 - (clock.now().getTime() - conflictSince))
        : error instanceof TelegramError && error.retryAfter !== undefined
          ? Math.max(1, Math.min(300_000, error.retryAfter * 1_000)) : 1_000;
      const waiting = pause(clock, signal, delay);
      options.log?.({ event: 'telegram-poll-retry', delay, code: error instanceof TelegramError ? error.code : 0,
        reason: error instanceof TelegramError ? error.description : 'invalid updates' });
      await waiting;
      continue;
    }
    for (const update of updates) {
      if (signal.aborted) return;
      // An unusable provider envelope cannot safely move the acknowledgement cursor.
      if (!update || !Number.isSafeInteger(update.update_id) || update.update_id < 0) throw new Error('Telegram returned an invalid update id');
      if (store.get(`telegram.update:${update.update_id}`) !== null) continue;
      const who = identity(update, botId);
      const paired = store.pairing();
      const pairedInput = who && paired && who.userId === paired.userId && who.chatId === paired.chatId;
      const pairingStart = who && update.message && /^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(update.message.text ?? '');
      const accepted = pairedInput || pairingStart;
      const dedupe = who?.dedupe;
      if (accepted && (!dedupe || store.get(`telegram.${dedupe}`) === null)) {
        const handler = options.handlers?.find(handler =>
          (handler.kind === 'pairing' ? pairingStart : pairedInput) && handler.accepts(update));
        if (!handler) {
          if (unhandled !== update.update_id) {
            unhandled = update.update_id;
            options.log?.({ event: 'telegram-update-unhandled', update: update.update_id });
          }
          // Preserve input until a handler is installed; never spin on immediate replay.
          await pause(clock, signal, 1_000);
          break;
        }
        await handler.handle(update, signal);
        unhandled = undefined;
        if (signal.aborted) return;
      }
      store.confirmTelegramUpdate(update.update_id, accepted ? dedupe : undefined);
    }
  }
}

async function boundedPoll(api: TelegramApi, clock: Clock, offset: string | null, timeout: number, signal: AbortSignal): Promise<TgUpdate[]> {
  // The transport keeps its >=30-second HTTP budget; liveness independently
  // cancels even an offline zero-timeout request after its own 15-second grace.
  const deadline = new AbortController();
  const timer = clock.setTimeout(() => deadline.abort(), (timeout + 15) * 1_000);
  timer.unref();
  try {
    return await api.getUpdates({ ...(offset === null ? {} : { offset: Number(offset) }),
      timeout, allowed_updates: TELEGRAM_ALLOWED_UPDATES }, { signal: AbortSignal.any([signal, deadline.signal]) });
  } catch (error) {
    if (deadline.signal.aborted && !signal.aborted)
      throw new TelegramError('getUpdates', 0, 'poll stalled after its timeout plus 15 seconds; restarting polling');
    throw error;
  } finally { clock.clearTimeout(timer); }
}

function pause(clock: Clock, signal: AbortSignal, ms: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clock.clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = clock.setTimeout(done, ms);
    timer.unref();
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}
