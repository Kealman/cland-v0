import { discordLateText } from './discord-catchup.ts';
import { discordCdn, CdnError } from './discord-cdn.ts';
import type { RemoteRedactor } from './redact.ts';
import { voiceNote } from './voice.ts';
import type { Clock } from '../hub/clock.ts';
import type { SpeechProvider } from '../speech/index.ts';
import type { DiscordApi } from './discord-api.ts';
type Attachment = { id: string; filename: string; content_type?: string; size: number; url: string; duration_secs?: number };
export type DiscordMediaOptions = { redact?: RemoteRedactor; api: DiscordApi; clock: Clock; fakeRoot?: string | undefined; maxUploadMb?: (() => number) | undefined; speech?: SpeechProvider | null | undefined; speechSettings?: { maxSeconds: number; language: string } | undefined };
import type { HubFrame, TopicMessage, InboxAsk } from '../protocol.ts';
import type { RemoteSend, RemoteReceipt } from './gateway.ts';
import type { RemoteStore } from './state.ts';
import type { DiscordDispatch } from './discord-socket.ts';

import type { DiscordOutbox } from './discord-outbox.ts';
type Receipt = { channel: string; user: string; message: string; hub: string; delivered: boolean };

/** Serialize native ingress; only a successful hub result confirms the cursor. */
export class DiscordInbound {
  readonly #batch: import('./gateway.ts').RemoteBatch | undefined;
  #feedback: Set<string> | undefined;
  #results: HubFrame[] | undefined;
  #collecting: Array<() => Promise<void>> | undefined;
  /** History supplies at most twenty text inputs; media retains its awaited FIFO path. */
  group(dispatch: () => void): void {
    const work: Array<() => Promise<void>> = [];
    this.#collecting = work;
    try { dispatch(); } finally { this.#collecting = undefined; }
    this.#tail = this.#tail.catch(() => {}).then(async () => {
      const pending: Promise<void>[] = [];
      const start = () => { for (const run of work) pending.push(run()); };
      const feedback = new Set<string>();
      this.#feedback = feedback;
      const results: HubFrame[] = [];
      try {
        this.#results = results;
        try { if (this.#batch) this.#batch(start); else start(); }
        finally { this.#results = undefined; }
        this.#store.transaction(() => { for (const frame of results) this.receive(frame); });
        await Promise.all(pending);
      } catch (error) {
        for (const completion of this.#pending.values()) completion.reject(new Error('Discord history group incomplete'));
        await Promise.allSettled(pending);
        throw error;
      } finally { this.#feedback = undefined; }
      const flushed: Promise<void>[] = [];
      this.#store.transaction(() => { for (const message of feedback) flushed.push(this.#flush(message)); });
      await Promise.all(flushed);
    });
    void this.#tail.catch(() => {});
  }
  readonly #media: DiscordMediaOptions | undefined;
  readonly #store: RemoteStore; readonly #send: RemoteSend; readonly #signal: AbortSignal;
  readonly #pending = new Map<string, { resolve: (message: TopicMessage | null) => void; reject: (error: Error) => void; receipt: Receipt }>();
  readonly #outbox: DiscordOutbox | undefined; readonly #receipt: RemoteReceipt | undefined;
  readonly #echoes = new Set<Promise<void>>();
  #tail: Promise<void> = Promise.resolve(); #next = 0;
  constructor(store: RemoteStore, send: RemoteSend, signal: AbortSignal, outbox?: DiscordOutbox, receipt?: RemoteReceipt, media?: DiscordMediaOptions, batch?: import('./gateway.ts').RemoteBatch) { this.#batch = batch; this.#media = media; this.#store = store; this.#send = send; this.#signal = signal; this.#outbox = outbox; this.#receipt = receipt; }
  dispatch(frame: DiscordDispatch): void {
    if (frame.t !== 'MESSAGE_CREATE') return;
    const m = frame.d; const author = m.author as { id?: string; bot?: boolean } | undefined;
    const paired = this.#store.pairing();
    if (!paired || m.channel_id !== paired.chatId || author?.id !== paired.userId || author.bot
      || m.webhook_id !== undefined || (m.type !== 0 && m.type !== 19)
      || typeof m.id !== 'string' || !/^\d+$/.test(m.id) || typeof m.content !== 'string' || (!m.content.trim() && !(Array.isArray(m.attachments) && m.attachments.length))) return;
    const messageId = m.id, content = m.content, channel = paired.chatId;
    const run = async () => {
      this.#signal.throwIfAborted();
      if (this.#store.pairing()?.chatId !== channel || this.#store.pairing()?.userId !== paired.userId) return;
      if (this.#store.get(`discord.inbound:${messageId}`)) { this.#confirmCursor(messageId); return; }
      if (Array.isArray(m.attachments) && m.attachments.length && this.#media) {
        try { await this.#handleMedia(m, paired.chatId, paired.userId, frame.replayed ? discordLateText('', m.timestamp, frame.returnedAt ?? this.#media.clock.now().toISOString()).trim() : undefined); }
        catch {
          this.#signal.throwIfAborted();
          if (!this.#paired(channel, paired.userId)) return;
          await this.#outbox?.send(channel, 'Attachment could not be downloaded', `discord.media-error:${channel}:${messageId}`, false, messageId, messageId);
          this.#store.set(`discord.inbound:${messageId}`, '1'); this.#confirmCursor(messageId);
        }
        return;
      }
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
        await this.#flush(messageId);
      } finally { this.#pending.delete(id); this.#signal.removeEventListener('abort', abort); }
    };
    if (this.#collecting) this.#collecting.push(run);
    else this.#tail = this.#tail.catch(() => {}).then(run);
    void this.#tail.catch(() => {}); // Native/result failures carry no arbitrary platform data into logs.
  }
  #paired(channel: string, user: string): boolean { const pair = this.#store.pairing(); return pair?.chatId === channel && pair.userId === user; }
  async #handleMedia(m: Record<string, unknown>, channel: string, user: string, late?: string): Promise<void> {
    const media = this.#media!, message = m.id as string, ingress = { chatId: channel, messageId: message };
    const files = m.attachments as Attachment[], limit = (media.maxUploadMb?.() ?? 50) * 1024 * 1024;
    const voice = Number(m.flags) & 8192 && files.length === 1 && (!files[0]!.content_type || files[0]!.content_type.startsWith('audio/'));
    const say = (line: string) => this.#say(channel, user, message, line);
    const recovered = this.#receipt?.(ingress);
    if (recovered) { this.#saveMedia(recovered, channel, user, message); this.#confirmCursor(message); return; }
    if (files.some(f => !Number.isSafeInteger(f.size) || f.size < 0 || f.size > limit)) {
      await say('Attachment exceeds the [artifacts] upload limit'); this.#store.set(`discord.inbound:${message}`, '1'); this.#confirmCursor(message); return;
    }
    if (voice && (files[0]!.duration_secs ?? 0) > (media.speechSettings?.maxSeconds ?? 600)) {
      await say('Voice message exceeds [speech] max_seconds'); this.#store.set(`discord.inbound:${message}`, '1'); this.#confirmCursor(message); return;
    }
    const download = async (file: Attachment, signal: AbortSignal): Promise<Buffer> => {
      try { return await discordCdn(file.url, limit, signal, media.fakeRoot); }
      catch (error) {
        if (!(error instanceof CdnError) || ![403, 404].includes(error.status)) throw error;
        const fresh = await media.api.getMessage(channel, message, { signal });
        if (!this.#paired(channel, user)) throw new Error('Discord pairing changed');
        const replacement = fresh.attachments?.find(f => f.id === file.id);
        if (!replacement || replacement.size > limit) throw new Error('Discord attachment unavailable');
        return discordCdn(replacement.url, limit, signal, media.fakeRoot);
      }
    };
    const reference = m.type === 19 ? (m.message_reference as { message_id?: string } | undefined)?.message_id : undefined;
    const reply = reference && !late ? this.#store.message(channel, reference) : null;
    const model = reply?.ask ? this.#store.get(`discord.card-model:${reply.ask}`) : null;
    const ask = model ? JSON.parse(model) as InboxAsk : null;
    let caption = m.content as string, bytes: Buffer[], descriptions: Array<{ name: string; mime: string }>;
    let echo: string | undefined, answer: string | undefined;
    if (voice) {
      const file = files[0]!;
      const result = await voiceNote({ fetch: signal => download(file, signal), provider: media.speech ?? null,
        clock: media.clock, signal: this.#signal, message, mime: file.content_type ?? 'audio/ogg', filename: file.filename,
        duration: file.duration_secs, language: media.speechSettings?.language });
      caption = result.text + (caption ? `\n${caption}` : ''); bytes = [result.bytes]; descriptions = [{ name: result.name, mime: result.mime }];
      echo = media.redact?.text(result.line) ?? result.line; if (reply?.ask) answer = result.transcript;
    } else {
      bytes = []; descriptions = [];
      for (const file of files) { bytes.push(await download(file, this.#signal)); descriptions.push({ name: file.filename, mime: file.content_type ?? 'application/octet-stream' }); }
    }
    if (late) caption += `\n\n${late}`;
    this.#signal.throwIfAborted(); if (!this.#paired(channel, user)) return;
    if (echo) this.#store.set(`discord.voice:${channel}:${message}`, JSON.stringify({ channel, user, message, line: media.redact?.text(echo) ?? echo, ready: false }));
    const normal = (text: string) => text.trim().replace(/[\p{P}]+$/gu, '').trim().toLowerCase();
    const value = normal(answer ?? '');
    const option = /^[1-9]$/.test(value) ? Number(value) : (ask?.options.findIndex(option => normal(option) === value) ?? -1) + 1;
    const answerFields = ask && !ask.free ? option > 0 && option <= ask.options.length ? { option } : null : { text: answer };
    const post = async (answering: boolean): Promise<TopicMessage | null> => {
      const id = `discord-in-${++this.#next}`, completion = Promise.withResolvers<TopicMessage | null>();
      this.#pending.set(id, { ...completion, receipt: { channel, user, message, hub: '', delivered: false } });
      const abort = () => completion.reject(new Error('Discord input cancelled'));
      this.#signal.addEventListener('abort', abort, { once: true });
      try {
        this.#send(answering ? { type: 'topic.answer', id, ask: reply!.ask, ...answerFields }
          : { type: 'artifact.upload', id, topic: 'general', caption, files: descriptions }, ingress, answering ? undefined : bytes);
        return await completion.promise;
      } finally { this.#pending.delete(id); this.#signal.removeEventListener('abort', abort); }
    };
    const saved = (answer && answerFields ? await post(true) : null) ?? await post(false);
    if (saved) this.#saveMedia(saved, channel, user, message);
    this.#confirmCursor(message);
    if (echo) {
      const key = `discord.voice:${channel}:${message}`;
      const intent = JSON.parse(this.#store.get(key)!); intent.ready = true; this.#store.set(key, JSON.stringify(intent));
      this.#echo(intent);
    }
    await this.#flush(message);
  }
  async #say(channel: string, user: string, message: string, line: string): Promise<void> {
    const points = [...line], chunks: string[] = [];
    while (points.length) chunks.push(points.splice(0, 1900).join(''));
    for (const [index, part] of chunks.entries()) {
      if (!this.#paired(channel, user)) return;
      const source = `discord.media:${channel}:${message}${chunks.length > 1 ? `:part:${index + 1}` : ''}`;
      await this.#outbox?.send(channel, chunks.length > 1 ? `🎤 · ${index + 1}/${chunks.length}\n${part}` : part, source, false, source, message);
    }
  }
  #echo(intent: { channel: string; user: string; message: string; line: string }): void {
    const work = this.#say(intent.channel, intent.user, intent.message, intent.line);
    this.#echoes.add(work); void work.finally(() => this.#echoes.delete(work)).catch(() => {});
  }
  #saveMedia(saved: TopicMessage, channel: string, user: string, message: string): void {
    this.#store.putMessage({ chatId: channel, messageId: message, topic: saved.topic, message: saved.id, ask: null, approval: null });
    this.#store.set(`discord.inbound:${message}`, JSON.stringify({ channel, user, message, hub: saved.id, delivered: saved.stage === 'delivered' || saved.stage === 'injected' }));
  }
  #confirmCursor(messageId: string): void {
    this.#store.transaction(() => {
      const previous = this.#store.get('discord.lastMessageId');
      if (!previous || BigInt(messageId) > BigInt(previous)) this.#store.set('discord.lastMessageId', messageId);
    });
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
    if (this.#results) { this.#results.push(frame); return; }
    const pending = this.#pending.get(frame.id);
    if (!pending) return;
    if (frame.ok) {
      const saved = (frame.value as { message: TopicMessage }).message;
      const receipt = { ...pending.receipt, hub: saved.id, delivered: saved.stage === 'delivered' || saved.stage === 'injected' };
      this.#store.set(`discord.inbound:${receipt.message}`, JSON.stringify(receipt));
      this.#store.putMessage({ chatId: receipt.channel, messageId: receipt.message, topic: saved.topic, message: saved.id, ask: null, approval: null });
      this.#confirmCursor(receipt.message);
      pending.resolve(saved);
    }
    else if (this.#signal.aborted) pending.reject(new Error('Discord input cancelled'));
    else {
      // A terminal hub refusal is handled input, not a broken gateway exchange.
      this.#store.set(`discord.inbound:${pending.receipt.message}`, '1');
      this.#confirmCursor(pending.receipt.message);
      pending.resolve(null);
    }
  }
  async recover(): Promise<void> {
    for (const { key, value } of this.#store.entries('discord.voice:')) {
      const intent = JSON.parse(value);
      if (!intent.ready && this.#receipt?.({ chatId: intent.channel, messageId: intent.message })) {
        intent.ready = true; this.#store.set(key, JSON.stringify(intent));
      }
      if (intent.ready) this.#echo(intent);
    }
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
    if (this.#feedback) { this.#feedback.add(message); return; }
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
  async stop(): Promise<void> { await this.#tail.catch(() => {}); await Promise.allSettled([...this.#echoes]); }
}
