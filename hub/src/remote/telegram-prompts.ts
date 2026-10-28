import type { Inbox, InboxAsk } from '../protocol.ts';
import type { RemoteIngress } from './gateway.ts';
import type { RemoteStore } from './state.ts';
import type { TelegramOutbox } from './telegram-outbox.ts';
import type { TgUpdate } from './telegram-api.ts';
import type { TelegramUpdateHandler } from './telegram-polling.ts';
import { TelegramError } from './telegram-api.ts';

type Request = <T>(type: string, fields: Record<string, unknown>, ingress?: RemoteIngress) => Promise<T>;
type Prompt = { ask: string; chat: string; card: number; question: string; topic: string; mode: 'other' | 'decline' };
type Target = { ask: string; mode: Prompt['mode'] | 'card' | 'unverified'; prompt?: string }
  | { approval: string; mode: 'approval' };
type Answer = { fields?: { ask: string; text?: string; option?: number; declined?: true; reason?: string }; prompt?: string; note?: string; stored?: boolean };

/** Separate, immutable ForceReply messages; only cards belong in the editable ask map. */
export class TelegramPrompts {
  readonly #store: RemoteStore;
  readonly #outbox: TelegramOutbox;
  readonly #request: Request;
  readonly #late: ((written: number) => string | undefined) | undefined;
  readonly #answer: (fields: Record<string, unknown>, ingress: RemoteIngress, stored: () => void) => Promise<void>;
  constructor(store: RemoteStore, outbox: TelegramOutbox, request: Request, answer: (fields: Record<string, unknown>, ingress: RemoteIngress, stored: () => void) => Promise<void>, late?: (written: number) => string | undefined) {
    this.#store = store; this.#outbox = outbox; this.#request = request; this.#answer = answer; this.#late = late;
  }

  prepare(press: string, chat: string, card: number, ask: InboxAsk, mode: Prompt['mode']): void {
    const key = `telegram.prompt:${press}`;
    if (this.#store.get(key)) return;
    this.#store.transaction(() => {
      this.#store.set(key, JSON.stringify({ ask: ask.id, chat, card, question: ask.question, topic: ask.topic.id, mode } satisfies Prompt));
      this.#store.set(`telegram.prompt-wait:${chat}`, key);
    });
  }

  async publish(press: string): Promise<void> {
    const key = `telegram.prompt:${press}`;
    const raw = this.#store.get(key);
    if (!raw) return;
    const incomplete = `telegram.prompt-incomplete:${press}`;
    if (this.#store.get(incomplete)) return;
    const prompt = JSON.parse(raw) as Prompt;
    const declining = prompt.mode === 'decline';
    try {
      await this.#outbox.send({ chat_id: prompt.chat,
        text: `${declining ? 'Why decline' : 'Your answer to'}: ${[...prompt.question].slice(0, 3900).join('')}\n\n/cancel keeps the ask open`,
        reply_parameters: { message_id: prompt.card },
        reply_markup: { force_reply: true, input_field_placeholder: declining ? 'Reason for declining' : 'Your answer' } },
      { key, source: key, topic: prompt.topic });
    } catch (error) {
      if (error instanceof TelegramError && [401, 403].includes(error.code)) throw error;
      if (!this.#store.outbox().some(job => job.source === key && job.state === 'uncertain')) throw error;
      // The outbox owns this unknown send permanently. Record an incomplete
      // publication, not a success, so the callback cursor can release later input.
      this.#store.set(incomplete, JSON.stringify({ chat: prompt.chat, ask: prompt.ask }));
    }
  }

  cancel(chat: string): void {
    this.#store.set(`telegram.prompt-wait:${chat}`, null);
  }

  readonly handler: TelegramUpdateHandler = {
    accepts: update => {
      const message = update.message;
      if (!message?.text?.trim() || message.text.startsWith('/')) return false;
      const chat = String(message.chat.id);
      if (this.#store.get(`telegram.answer-input:${chat}:${message.message_id}`)) return true;
      // Late unthreaded text stays a General message; explicit replies retain
      // their own mapped target and may answer only while that ask is open.
      if (!message.reply_to_message && this.#late?.(message.date)) return false;
      return !!this.#target(chat, message.reply_to_message?.message_id);
    },
    handle: async update => { await this.#handle(update); },
  };

  /** Freeze a voice target before native/provider I/O, including an absent wait. */
  captureVoice(chat: string, message: string, reply?: string, late?: string): Target | null {
    const key = `telegram.voice-target:${chat}:${message}`;
    const saved = this.#store.get(key);
    if (saved !== null) return JSON.parse(saved) as Target | null;
    const target = late ? null : this.#target(chat, reply ? Number(reply) : undefined);
    this.#store.set(key, JSON.stringify(target));
    return target;
  }

  async voice(update: TgUpdate, target: Target): Promise<{ answered: boolean; note?: string }> {
    const answer = await this.#handle(update, target);
    if (answer.stored && answer.prompt) {
      const chat = String(update.message!.chat.id);
      if (this.#store.get(`telegram.prompt-wait:${chat}`) === answer.prompt) this.cancel(chat);
    }
    return { answered: !!answer.stored, ...(answer.note ? { note: answer.note } : {}) };
  }

  async #handle(update: TgUpdate, voiceTarget?: Target): Promise<Answer> {
    const message = update.message!;
    const chat = String(message.chat.id);
    const key = `telegram.answer-input:${chat}:${message.message_id}`;
    const saved = this.#store.get(key);
    const target = !saved ? voiceTarget ?? this.#target(chat, message.reply_to_message?.message_id)! : undefined;
    let answer: Answer;
    if (saved) answer = JSON.parse(saved) as Answer;
    else if (target!.mode === 'unverified') {
      answer = { note: 'Prompt delivery is unconfirmed. Reply to the ask card or use /cancel.' };
      this.#store.set(key, JSON.stringify(answer));
    } else if (target!.mode === 'approval') {
      answer = { note: this.#store.get(`telegram.approval-closure:${target!.approval}`)
        ? 'This approval is already closed.' : 'Use the approval card’s buttons to answer.' };
      this.#store.set(key, JSON.stringify(answer));
    } else {
      const inbox = await this.#request<Inbox>('inbox.list', {});
      const ask = inbox.asks.find(ask => ask.id === target!.ask);
      let option = /^\s*[1-9]\s*$/.test(message.text!) ? Number(message.text!.trim()) : 0;
      if (voiceTarget) {
        const normal = (text: string) => text.trim().replace(/[\p{P}]+$/gu, '').trim().toLowerCase();
        const value = normal(message.text!);
        option = /^[1-9]$/.test(value) ? Number(value) : (ask?.options.findIndex(option => normal(option) === value) ?? -1) + 1;
      }
      answer = target!.prompt ? { prompt: target!.prompt } : {};
      if (!ask) answer.note = 'This ask is already closed.';
      else if (target!.mode === 'decline') answer.fields = { ask: ask.id, declined: true, reason: message.text! };
      else if (target!.mode === 'card' && !ask.free) {
        if (option && option <= ask.options.length) answer.fields = { ask: ask.id, option };
        else answer.note = `Reply with an option number from 1 to ${ask.options.length}.`;
      } else answer.fields = { ask: ask.id, text: message.text! };
      // Freeze routing and the exact fields before dispatch; a lost result
      // retries the same gateway receipt even after the prompt wait clears.
      this.#store.set(key, JSON.stringify(answer));
    }
    if (answer.fields) {
      try {
        await this.#answer(answer.fields, { chatId: chat, messageId: String(message.message_id) }, () => {
          answer.stored = true;
          this.#store.set(key, JSON.stringify(answer));
        });
      } catch (error) {
        if (answer.stored) throw error;
        // Only a hub-owned closure is terminal. Transient write/feedback
        // failures must retry the exact saved ingress, never become General.
        const current = await this.#request<Inbox>('inbox.list', {});
        if (current.asks.some(ask => ask.id === answer.fields!.ask)) throw error;
        answer = { ...(answer.prompt ? { prompt: answer.prompt } : {}), note: 'This ask is already closed.' };
        this.#store.set(key, JSON.stringify(answer));
      }
    }
    if (voiceTarget) return answer;
    if (answer.prompt && this.#store.get(`telegram.prompt-wait:${chat}`) === answer.prompt) this.#store.set(`telegram.prompt-wait:${chat}`, null);
    if (answer.note) {
      const noteKey = `${key}:note`;
      try { await this.#outbox.send({ chat_id: chat, text: answer.note }, { key: noteKey }); }
      catch (error) {
        if (error instanceof TelegramError && [401, 403].includes(error.code)) throw error;
        if (!this.#store.outbox().some(job => job.state === 'uncertain' && (job.payload as { key?: string }).key === noteKey)) throw error;
        this.#store.set(`telegram.answer-note-incomplete:${chat}:${message.message_id}`, noteKey);
      }
      return answer;
    }
    return answer;
  }

  #target(chat: string, reply?: number): Target | null {
    if (reply !== undefined) {
      const mapped = this.#store.message(chat, String(reply));
      if (mapped?.ask) return { ask: mapped.ask, mode: 'card' };
      if (mapped?.approval) return { approval: mapped.approval, mode: 'approval' };
      if (!mapped && (this.#store.get(`telegram.prompt-wait:${chat}`)
        || this.#store.entries('telegram.prompt-incomplete:').some(row => (JSON.parse(row.value) as { chat: string }).chat === chat)))
        return { ask: '', mode: 'unverified' };
      // Explicit replies never borrow another prompt's current wait.
      const key = mapped?.message;
      if (!key?.startsWith('telegram.prompt:')) return null;
      const raw = this.#store.get(key);
      const prompt = raw ? JSON.parse(raw) as Prompt : null;
      return prompt?.chat === chat ? { ask: prompt.ask, mode: prompt.mode, prompt: key } : null;
    }
    const key = this.#store.get(`telegram.prompt-wait:${chat}`);
    const raw = key && this.#store.get(key);
    const prompt = raw ? JSON.parse(raw) as Prompt : null;
    return prompt?.chat === chat ? { ask: prompt.ask, mode: prompt.mode, prompt: key! } : null;
  }
}
