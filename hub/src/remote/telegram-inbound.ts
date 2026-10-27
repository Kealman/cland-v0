import type { HubFrame, HumanMessageKind, TopicMessage } from '../protocol.ts';
import type { RemoteStore } from './state.ts';
import type { TelegramUpdateHandler } from './telegram-polling.ts';
import type { TelegramApi } from './telegram-api.ts';
import type { RemoteSend, RemoteReceipt } from './gateway.ts';

type Receipt = { chat: string; message: number; stored: boolean; delivered: boolean; seen: boolean };

/** Native text input uses the same human frame path as the workbenches. */
export class TelegramInbound {
  readonly #store: RemoteStore;
  readonly #send: RemoteSend;
  readonly #api: TelegramApi;
  readonly #signal: AbortSignal;
  readonly #sent: () => void;
  readonly #receipt: RemoteReceipt | undefined;
  readonly #pending = new Map<string, { resolve: (message: TopicMessage) => void; reject: (error: Error) => void; receipt: Receipt }>();
  readonly #reactions = new Map<string, Promise<void>>();
  #next = 0;
  constructor(store: RemoteStore, send: RemoteSend, api: TelegramApi, signal: AbortSignal, sent: () => void, receipt?: RemoteReceipt) {
    this.#store = store; this.#send = send; this.#api = api; this.#signal = signal; this.#sent = sent; this.#receipt = receipt;
  }
  async recover(): Promise<void> {
    if (!this.#receipt) return; // Previous injected ports retain their original lifetime.
    for (const { key } of this.#store.entries('telegram.inbound:')) {
      this.#signal.throwIfAborted();
      // Earlier HTTP awaits can deliver or finish another pending receipt.
      const receipt = JSON.parse(this.#store.get(key)!) as Receipt;
      if (receipt.seen) continue;
      if (this.#store.pairing()?.chatId !== receipt.chat) continue;
      const message = this.#receipt({ chatId: receipt.chat, messageId: String(receipt.message) });
      if (!message) continue;
      receipt.delivered ||= message.stage === 'delivered' || message.stage === 'injected';
      this.#store.set(key, JSON.stringify(receipt));
      await this.#flush(message.id);
    }
  }
  readonly handler: TelegramUpdateHandler = {
    accepts: update => typeof update.message?.text === 'string' && !!input(update.message.text),
    handle: async (update, signal) => {
      const message = update.message!;
      const parsed = input(message.text!)!;
      const id = `telegram-in-${++this.#next}`;
      const result = Promise.withResolvers<TopicMessage>();
      this.#pending.set(id, { ...result, receipt: { chat: String(message.chat.id), message: message.message_id,
        stored: false, delivered: false, seen: false } });
      const abort = () => result.reject(new Error('Telegram input cancelled'));
      signal.addEventListener('abort', abort, { once: true });
      try {
        signal.throwIfAborted();
        const reply = message.reply_to_message && this.#store.message(String(message.chat.id), String(message.reply_to_message.message_id));
        this.#send({ type: 'topic.send', id, topic: reply?.topic ?? 'general',
          ...(reply?.message ? { replyTo: reply.message } : {}), ...parsed },
        { chatId: String(message.chat.id), messageId: String(message.message_id) });
        const saved = await result.promise;
        await this.#flush(saved.id);
      } finally {
        signal.removeEventListener('abort', abort);
        this.#pending.delete(id);
      }
    },
  };
  receive(frame: HubFrame): void | Promise<void> {
    if (frame.type === 'delivery' && (frame.stage === 'delivered' || frame.stage === 'injected')) {
      const key = `telegram.inbound:${frame.message}`;
      const value = this.#store.get(key);
      if (!value) return;
      const receipt = JSON.parse(value) as Receipt;
      receipt.delivered = true;
      this.#store.set(key, JSON.stringify(receipt));
      return this.#flush(frame.message);
    }
    if (frame.type !== 'result') return;
    const pending = this.#pending.get(frame.id);
    if (!pending) return;
    if (!frame.ok) pending.reject(new Error(frame.error));
    else {
      const message = (frame.value as { message: TopicMessage }).message;
      const key = `telegram.inbound:${message.id}`;
      const old = this.#store.get(key);
      const receipt = old ? JSON.parse(old) as Receipt : pending.receipt;
      receipt.delivered ||= message.stage === 'delivered' || message.stage === 'injected';
      this.#store.set(key, JSON.stringify(receipt));
      pending.resolve(message);
    }
  }

  #flush(message: string): Promise<void> {
    const active = this.#reactions.get(message);
    if (active) return active;
    const key = `telegram.inbound:${message}`;
    const owner = Promise.withResolvers<void>();
    this.#reactions.set(message, owner.promise);
    void (async () => {
      try {
        for (;;) {
          const receipt = JSON.parse(this.#store.get(key)!) as Receipt;
          const emoji = !receipt.stored ? '👌' : receipt.delivered && !receipt.seen ? '👀' : null;
          if (emoji === null) {
            // Check arrivals and release ownership in one synchronous turn.
            // A later delivery acquires its own owner, even before this settles.
            this.#reactions.delete(message);
            owner.resolve();
            return;
          }
          await this.#api.setMessageReaction({ chat_id: receipt.chat, message_id: receipt.message,
            reaction: [{ type: 'emoji', emoji }] }, { signal: this.#signal });
          this.#sent();
          // A delivery can arrive during the HTTP exchange; retain its durable bit.
          const current = JSON.parse(this.#store.get(key)!) as Receipt;
          if (emoji === '👌') current.stored = true; else current.seen = true;
          this.#store.set(key, JSON.stringify(current));
        }
      } catch (error) {
        this.#reactions.delete(message);
        owner.reject(error);
      }
    })();
    return owner.promise;
  }
}

function input(text: string): { text: string; kind: HumanMessageKind } | null {
  if (!text.trim()) return null;
  if (!text.startsWith('/')) return { text, kind: 'message' };
  const command = /^\/(decision|question)(?:@[A-Za-z0-9_]+)?\s+([\s\S]+)$/.exec(text);
  return command?.[2]?.trim() ? { text: command[2], kind: command[1] as HumanMessageKind } : null;
}
