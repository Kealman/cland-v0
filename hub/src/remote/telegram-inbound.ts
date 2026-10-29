import type { HubFrame, HumanMessageKind, TopicMessage } from '../protocol.ts';
import type { Pairing, RemoteStore } from './state.ts';
import type { TelegramUpdateHandler } from './telegram-polling.ts';
import type { TelegramApi } from './telegram-api.ts';
import type { RemoteSend, RemoteReceipt, RemoteIngress } from './gateway.ts';

type Receipt = { pairing?: Pick<Pairing, 'userId' | 'chatId' | 'guildId'> | null; chat: string; message: number; stored: boolean; delivered: boolean; seen: boolean; targets?: number[]; storedTargets?: number[]; seenTargets?: number[] };

/** Native text input uses the same human frame path as the workbenches. */
export class TelegramInbound {
  readonly #store: RemoteStore;
  readonly #send: RemoteSend;
  readonly #api: Pick<TelegramApi, 'setMessageReaction'>;
  readonly #signal: AbortSignal;
  readonly #sent: () => void;
  readonly #receipt: RemoteReceipt | undefined;
  readonly #late: ((written: number) => string | undefined) | undefined;
  readonly #pending = new Map<string, { resolve: (message: TopicMessage) => void; reject: (error: Error) => void; receipt: Receipt }>();
  readonly #reactions = new Map<string, Promise<void>>();
  #next = 0;
  constructor(store: RemoteStore, send: RemoteSend, api: Pick<TelegramApi, 'setMessageReaction'>, signal: AbortSignal, sent: () => void, receipt?: RemoteReceipt, late?: (written: number) => string | undefined) {
    this.#store = store; this.#send = send; this.#api = api; this.#signal = signal; this.#sent = sent; this.#receipt = receipt; this.#late = late;
  }
  async recover(): Promise<void> {
    if (!this.#receipt) return; // Previous injected ports retain their original lifetime.
    for (const { key } of this.#store.entries('telegram.inbound:')) {
      this.#signal.throwIfAborted();
      // Earlier HTTP awaits can deliver or finish another pending receipt.
      const receipt = JSON.parse(this.#store.get(key)!) as Receipt;
      if (receipt.seen) continue;
      if (!this.#paired(receipt)) continue;
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
      const late = this.#late?.(message.date);
      if (late) parsed.text += `\n\n(${late})`;
      const reply = message.reply_to_message && this.#store.message(String(message.chat.id), String(message.reply_to_message.message_id));
      const reference = reply?.message ? this.#store.get(`telegram.notice-reference:${reply.message}`) : null;
      await this.#post({ type: 'topic.send', topic: reference ? 'general' : reply?.topic ?? 'general',
        ...(reply?.message && !reference ? { replyTo: reply.message } : {}),
        ...parsed, ...(reference ? { text: `${reference} ${parsed.text}` } : {}) },
      { chatId: String(message.chat.id), messageId: String(message.message_id) }, signal);
    },
  };

  answer(fields: Record<string, unknown>, ingress: RemoteIngress, stored: () => void): Promise<void> {
    return this.#post({ ...fields, type: 'topic.answer' }, ingress, this.#signal, stored);
  }

  /** A committed upload survives a lost result even when native files expire. */
  async recoverUpload(ingress: RemoteIngress, members?: string[]): Promise<boolean> {
    const saved = this.#receipt?.(ingress);
    if (!saved) return false;
    this.#saveUpload(saved, ingress, members);
    await this.#flush(saved.id);
    return true;
  }

  #saveUpload(saved: TopicMessage, ingress: RemoteIngress, members?: string[]): void {
    this.#store.transaction(() => {
      for (const messageId of members ?? [ingress.messageId]) this.#store.putMessage({ chatId: ingress.chatId, messageId,
        topic: saved.topic, message: saved.id, ask: null, approval: null });
      const key = `telegram.inbound:${saved.id}`;
      const value = this.#store.get(key);
      const pairing = this.#store.pairing();
      const receipt: Receipt = value ? JSON.parse(value) as Receipt : {
        pairing: pairing ? { userId: pairing.userId, chatId: pairing.chatId, guildId: pairing.guildId } : null,
        chat: ingress.chatId, message: Number(ingress.messageId), stored: false, delivered: false, seen: false,
      };
      if (members) receipt.targets = members.map(Number);
      receipt.delivered ||= saved.stage === 'delivered' || saved.stage === 'injected';
      this.#store.set(key, JSON.stringify(receipt));
    });
  }

  upload(fields: Record<string, unknown>, ingress: RemoteIngress, bytes: readonly Buffer[], members?: string[]): Promise<void> {
    return this.#post({ ...fields, type: 'artifact.upload' }, ingress, this.#signal, undefined, bytes, members);
  }

  async #post(frame: Record<string, unknown>, ingress: RemoteIngress, signal: AbortSignal, stored?: () => void, bytes?: readonly Buffer[], members?: string[]): Promise<void> {
    const id = `telegram-in-${++this.#next}`;
    const result = Promise.withResolvers<TopicMessage>();
    const pairing = this.#store.pairing();
    this.#pending.set(id, { ...result, receipt: { pairing: pairing ? { userId: pairing.userId, chatId: pairing.chatId, guildId: pairing.guildId } : null, chat: ingress.chatId, message: Number(ingress.messageId),
      stored: false, delivered: false, seen: false, ...(members ? { targets: members.map(Number) } : {}) } });
    const abort = () => result.reject(new Error('Telegram input cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    try {
      signal.throwIfAborted();
      this.#send({ ...frame, id }, ingress, bytes);
      const saved = await result.promise;
      if (members) this.#saveUpload(saved, ingress, members);
      stored?.();
      await this.#flush(saved.id);
    } finally {
      signal.removeEventListener('abort', abort);
      this.#pending.delete(id);
    }
  }

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
      this.#store.putMessage({ chatId: receipt.chat, messageId: String(receipt.message), topic: message.topic, message: message.id, ask: null, approval: null });
      pending.resolve(message);
    }
  }

  #paired(receipt: Receipt): boolean {
    const current = this.#store.pairing();
    if (!current || current.chatId !== receipt.chat) return false;
    // Older receipts have only a chat id; retain their original recovery scope.
    if (receipt.pairing === undefined) return true;
    return receipt.pairing !== null && current.userId === receipt.pairing.userId
      && current.chatId === receipt.pairing.chatId && current.guildId === receipt.pairing.guildId;
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
          const emoji = !this.#paired(receipt) ? null : !receipt.stored ? '👌' : receipt.delivered && !receipt.seen ? '👀' : null;
          if (emoji === null) {
            // Check arrivals and release ownership in one synchronous turn.
            // A later delivery acquires its own owner, even before this settles.
            this.#reactions.delete(message);
            owner.resolve();
            return;
          }
          for (const target of receipt.targets ?? [receipt.message]) {
            const field = emoji === '👌' ? 'storedTargets' : 'seenTargets';
            const latest = JSON.parse(this.#store.get(key)!) as Receipt;
            if (latest[field]?.includes(target)) continue;
            await this.#api.setMessageReaction({ chat_id: receipt.chat, message_id: target,
              reaction: [{ type: 'emoji', emoji }] }, { signal: this.#signal });
            if (!this.#paired(receipt)) {
              this.#reactions.delete(message);
              owner.resolve();
              return;
            }
            this.#sent();
            const current = JSON.parse(this.#store.get(key)!) as Receipt;
            if (current.targets) (current[field] ??= []).push(target);
            this.#store.set(key, JSON.stringify(current));
          }
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
