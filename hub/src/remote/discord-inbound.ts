import type { HubFrame } from '../protocol.ts';
import type { RemoteSend } from './gateway.ts';
import type { RemoteStore } from './state.ts';
import type { DiscordDispatch } from './discord-socket.ts';

/** Serialize native ingress; only a successful hub result confirms the cursor. */
export class DiscordInbound {
  readonly #store: RemoteStore; readonly #send: RemoteSend; readonly #signal: AbortSignal;
  readonly #pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  #tail: Promise<void> = Promise.resolve(); #next = 0;
  constructor(store: RemoteStore, send: RemoteSend, signal: AbortSignal) { this.#store = store; this.#send = send; this.#signal = signal; }
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
      const completion = Promise.withResolvers<void>(); this.#pending.set(id, completion);
      const abort = () => completion.reject(new Error('Discord input cancelled'));
      this.#signal.addEventListener('abort', abort, { once: true });
      try {
        this.#send({ type: 'topic.send', id, topic: 'general', kind: 'message', text: content }, { chatId: channel, messageId });
        await completion.promise;
        this.#store.transaction(() => {
          this.#store.set(`discord.inbound:${messageId}`, '1');
          const previous = this.#store.get('discord.lastMessageId');
          if (!previous || BigInt(messageId) > BigInt(previous)) this.#store.set('discord.lastMessageId', messageId);
        });
      } finally { this.#pending.delete(id); this.#signal.removeEventListener('abort', abort); }
    });
    void this.#tail.catch(() => {}); // Native/result failures carry no arbitrary platform data into logs.
  }
  receive(frame: HubFrame): void {
    if (frame.type !== 'result') return;
    const pending = this.#pending.get(frame.id);
    if (!pending) return;
    if (frame.ok) pending.resolve(); else pending.reject(new Error('Discord input refused'));
  }
  async stop(): Promise<void> { await this.#tail.catch(() => {}); }
}
