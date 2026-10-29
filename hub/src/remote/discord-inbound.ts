import type { HubFrame, TopicMessage } from '../protocol.ts';
import type { RemoteSend, RemoteReceipt } from './gateway.ts';
import type { RemoteStore } from './state.ts';
import type { DiscordDispatch } from './discord-socket.ts';

import type { DiscordOutbox } from './discord-outbox.ts';
type Receipt = { channel: string; user: string; message: string; hub: string; delivered: boolean };

/** Serialize native ingress; only a successful hub result confirms the cursor. */
export class DiscordInbound {
  readonly #store: RemoteStore; readonly #send: RemoteSend; readonly #signal: AbortSignal;
  readonly #pending = new Map<string, { resolve: (message: TopicMessage | null) => void; reject: (error: Error) => void; receipt: Receipt }>();
  readonly #outbox: DiscordOutbox | undefined; readonly #receipt: RemoteReceipt | undefined;
  #tail: Promise<void> = Promise.resolve(); #next = 0;
  constructor(store: RemoteStore, send: RemoteSend, signal: AbortSignal, outbox?: DiscordOutbox, receipt?: RemoteReceipt) { this.#store = store; this.#send = send; this.#signal = signal; this.#outbox = outbox; this.#receipt = receipt; }
  dispatch(frame: DiscordDispatch): void {
    if (frame.t !== 'MESSAGE_CREATE') return;
    const m = frame.d; const author = m.author as { id?: string; bot?: boolean } | undefined;
    const paired = this.#store.pairing();
    if (!paired || m.channel_id !== paired.chatId || author?.id !== paired.userId || author.bot
      || m.webhook_id !== undefined || (m.type !== 0 && m.type !== 19)
      || typeof m.id !== 'string' || !/^\d+$/.test(m.id) || typeof m.content !== 'string' || !m.content.trim()) return;
    const messageId = m.id, content = m.content, channel = paired.chatId;
    this.#tail = this.#tail.catch(() => {}).then(async () => {
      this.#signal.throwIfAborted();
      if (this.#store.pairing()?.chatId !== channel || this.#store.pairing()?.userId !== paired.userId || this.#store.get(`discord.inbound:${messageId}`)) return;
      const id = `discord-in-${++this.#next}`;
      const completion = Promise.withResolvers<TopicMessage | null>(); this.#pending.set(id, { ...completion, receipt: { channel, user: paired.userId, message: messageId, hub: '', delivered: false } });
      const abort = () => completion.reject(new Error('Discord input cancelled'));
      this.#signal.addEventListener('abort', abort, { once: true });
      try {
        const reference = m.type === 19 ? (m.message_reference as { message_id?: string } | undefined)?.message_id : undefined;
        const reply = reference && m.referenced_message !== null ? this.#store.message(channel, reference) : null;
        const noticeReference = reply?.message ? this.#store.get(`discord.notice-reference:${reply.message}`) : null;
        this.#send({ type: 'topic.send', id, topic: reply?.topic ?? 'general', ...(reply?.message && !noticeReference ? { replyTo: reply.message } : {}), kind: 'message', text: noticeReference ? `${noticeReference} ${content}` : content }, { chatId: channel, messageId });
        await completion.promise;
        this.#store.transaction(() => {
          const previous = this.#store.get('discord.lastMessageId');
          if (!previous || BigInt(messageId) > BigInt(previous)) this.#store.set('discord.lastMessageId', messageId);
        });
        await this.#flush(messageId);
      } finally { this.#pending.delete(id); this.#signal.removeEventListener('abort', abort); }
    });
    void this.#tail.catch(() => {}); // Native/result failures carry no arbitrary platform data into logs.
  }
  receive(frame: HubFrame): void | Promise<void> {
    if (frame.type === 'delivery' && (frame.stage === 'delivered' || frame.stage === 'injected')) {
      for (const { key, value } of this.#store.entries('discord.inbound:')) {
        if (value === '1') continue; // Previous releases retain their dedup tombstones.
        const receipt = JSON.parse(value) as Receipt;
        if (receipt.hub !== frame.message) continue;
        receipt.delivered = true; this.#store.set(key, JSON.stringify(receipt));
        return this.#flush(receipt.message);
      }
    }
    if (frame.type !== 'result') return;
    const pending = this.#pending.get(frame.id);
    if (!pending) return;
    if (frame.ok) {
      const saved = (frame.value as { message: TopicMessage }).message;
      const receipt = { ...pending.receipt, hub: saved.id, delivered: saved.stage === 'delivered' || saved.stage === 'injected' };
      this.#store.set(`discord.inbound:${receipt.message}`, JSON.stringify(receipt));
      pending.resolve(saved);
    }
    else if (this.#signal.aborted) pending.reject(new Error('Discord input cancelled'));
    else {
      // A terminal hub refusal is handled input, not a broken gateway exchange.
      this.#store.set(`discord.inbound:${pending.receipt.message}`, '1');
      pending.resolve(null);
    }
  }
  async recover(): Promise<void> {
    for (const { key, value } of this.#store.entries('discord.inbound:')) {
      this.#signal.throwIfAborted();
      if (value === '1') continue;
      const receipt = JSON.parse(value) as Receipt;
      const saved = this.#receipt?.({ chatId: receipt.channel, messageId: receipt.message });
      receipt.delivered ||= saved?.stage === 'delivered' || saved?.stage === 'injected';
      this.#store.set(key, JSON.stringify(receipt));
      await this.#flush(receipt.message);
    }
  }
  async #flush(message: string): Promise<void> {
    const value = this.#store.get(`discord.inbound:${message}`);
    if (!value || value === '1') return;
    const receipt = JSON.parse(value) as Receipt, pair = this.#store.pairing();
    if (pair?.chatId !== receipt.channel || pair.userId !== receipt.user) return;
    await this.#outbox?.react(receipt.channel, message, '👌', receipt.user);
    // Delivery may arrive during the first HTTP exchange.
    const current = JSON.parse(this.#store.get(`discord.inbound:${message}`)!) as Receipt;
    const pairing = this.#store.pairing();
    if (pairing?.chatId !== receipt.channel || pairing.userId !== receipt.user) return;
    if (current.delivered) await this.#outbox?.react(receipt.channel, message, '👀', receipt.user);
  }
  idle(): Promise<void> { return this.#tail; }
  async stop(): Promise<void> { await this.#tail.catch(() => {}); }
}
