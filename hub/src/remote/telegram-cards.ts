import type { RemoteIngress } from './gateway.ts';
import type { TelegramUpdateHandler } from './telegram-polling.ts';
import { TelegramError, type TelegramApi } from './telegram-api.ts';
import { randomUUID } from 'node:crypto';
import type { AskCard, HubFrame, InboxAsk } from '../protocol.ts';
import type { RemoteStore } from './state.ts';
import type { TelegramOutbox } from './telegram-outbox.ts';
import { askCard, closedCardLine, type CardAction, type RemoteCard } from './cards.ts';
import type { TelegramPrompts } from './telegram-prompts.ts';

/** Telegram renders the shared card model; opaque actions stay in hub.db. */
type CardRequest = <T>(type: string, fields: Record<string, unknown>, ingress?: RemoteIngress) => Promise<T>;

export class TelegramCards {
  readonly #store: RemoteStore;
  readonly #outbox: TelegramOutbox;
  readonly #api: TelegramApi;
  readonly #request: CardRequest;
  readonly #signal: AbortSignal;
  readonly #prompts: TelegramPrompts;
  constructor(store: RemoteStore, outbox: TelegramOutbox, api: TelegramApi,
    request: CardRequest, signal: AbortSignal, prompts: TelegramPrompts) {
    this.#store = store; this.#outbox = outbox; this.#api = api; this.#request = request; this.#signal = signal;
    this.#prompts = prompts;
  }

  readonly handler: TelegramUpdateHandler = {
    accepts: update => !!update.callback_query,
    handle: async update => {
      const press = update.callback_query!;
      const chat = String(press.message?.chat.id);
      const mapped = press.message && this.#store.message(chat, String(press.message.message_id));
      const raw = typeof press.data === 'string' ? this.#store.get(`telegram.button:${press.data}`) : null;
      const button = raw ? JSON.parse(raw) as { ask: string; chat: string; action: CardAction } : null;
      const receipt = `telegram.press:${press.id}`;
      let toast = 'This button is not available';
      if (button && mapped?.ask === button.ask && button.chat === chat) {
        const saved = this.#store.get(receipt);
        if (saved && saved !== 'pending') toast = saved;
        else {
          const inbox = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
          if (saved !== 'pending' && !inbox.asks.some(ask => ask.id === button.ask)) toast = 'Already answered';
          else if ('option' in button.action) {
            this.#store.set(receipt, 'pending');
            try {
              await this.#request('topic.answer', { ask: button.ask, option: button.action.option },
                { chatId: chat, messageId: `callback:${press.id}` });
              toast = 'Answered';
            } catch (error) {
              // A different client may win after the open-inbox read. Only a
              // closed hub record is terminal; a failed write still retries.
              const current = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
              if (current.asks.some(ask => ask.id === button.ask)) throw error;
              toast = 'Already answered';
            }
          } else {
            const ask = inbox.asks.find(ask => ask.id === button.ask)!;
            this.#prompts.prepare(press.id, chat, press.message!.message_id, ask, button.action.kind);
            toast = button.action.kind === 'decline' ? 'Why decline' : 'Your answer';
          }
        }
      }
      this.#store.set(receipt, toast);
      try {
        await this.#api.answerCallbackQuery({ callback_query_id: press.id, text: toast }, { signal: this.#signal });
      } catch (error) {
        // Telegram cannot acknowledge an expired press. Its durable decision is
        // already saved; terminal expiry must not block every later update.
        if (!(error instanceof TelegramError && error.code === 400 && error.description.toLowerCase().includes('query is too old'))) throw error;
      }
      await this.#prompts.publish(press.id);
    },
  };

  async receive(frame: HubFrame): Promise<void> {
    if (frame.type === 'inbox') {
      await Promise.all([this.publish(frame.inbox.asks), ...(frame.inbox.departures ?? []).flatMap(row => {
        if (row.kind !== 'ask' || !['answered', 'declined', 'withdrawn', 'cancelled'].includes(row.reason)) return [];
        return [this.outcome(row.id, { state: row.reason === 'declined' ? 'answered' : row.reason as AskCard['state'],
          ...(row.outcome && 'status' in row.outcome ? { outcome: row.outcome } : {}) })];
      })]);
    } else if (frame.type === 'ask' && frame.card.state !== 'open') await this.outcome(frame.ask, frame.card);
  }

  async outcome(id: string, card: Pick<AskCard, 'state' | 'outcome'>): Promise<void> {
    const pairing = this.#store.pairing();
    if (!pairing) return;
    const model = this.#store.get(`telegram.card-model:${id}`);
    if (!model) return;
    // A send may already be accepted while its response/map is still in flight.
    // Retain the hub's closure so that copy folds as soon as it is mapped.
    this.#store.set(`telegram.card-closure:${id}`, JSON.stringify(card));
    const ask = JSON.parse(model) as InboxAsk;
    const line = closedCardLine(card, ask.from);
    if (!line) return;
    const view = askCard(ask);
    const text = telegramCardText(view, line);
    await Promise.all(this.#store.messagesForAsk(id).filter(copy => copy.chatId === pairing.chatId).map(copy =>
      this.#outbox.edit({ chat_id: copy.chatId, message_id: Number(copy.messageId), text,
        entities: [{ type: 'bold', offset: 0, length: view.title.length }], reply_markup: { inline_keyboard: [] } },
      { key: `telegram.outcome:${copy.chatId}:${copy.messageId}`, source: id, topic: copy.topic, ask: id })));
  }

  async publish(asks: InboxAsk[]): Promise<void> {
    const pairing = this.#store.pairing();
    if (!pairing) return;
    await Promise.all(asks.map(ask => {
      this.#store.set(`telegram.card-model:${ask.id}`, JSON.stringify(ask));
      const key = `telegram.card:${pairing.chatId}:${ask.id}`;
      const previous = this.#store.get(key);
      const card = askCard(ask);
      const keyboard = previous ? JSON.parse(previous) : this.#store.transaction(() => {
        const rows = card.buttons.map(button => {
          const data = randomUUID();
          this.#store.set(`telegram.button:${data}`, JSON.stringify({ ask: ask.id, chat: pairing.chatId, action: button.action }));
          return [{ text: button.label, callback_data: data }];
        });
        this.#store.set(key, JSON.stringify(rows));
        return rows;
      });
      return this.#outbox.send({ chat_id: pairing.chatId, text: telegramCardText(card),
        entities: [{ type: 'bold', offset: 0, length: card.title.length }],
        reply_markup: { inline_keyboard: keyboard }, link_preview_options: { is_disabled: true } },
      { key, kind: 'card', source: ask.id, topic: ask.topic.id, ask: ask.id }).then(async () => {
        const closed = this.#store.get(`telegram.card-closure:${ask.id}`);
        if (closed) await this.outcome(ask.id, JSON.parse(closed));
      });
    }));
  }
}


/** One native card id, including after its outcome; never split an ask's controls. */
function telegramCardText(card: RemoteCard, outcome?: string): string {
  const header = `${card.title}\n\n`;
  // Options are at most 200 characters. Keep generous space for their full
  // outcome, attribution and local time without moving the question preview.
  const budget = 4096 - [...header].length - 2 - Math.max(1024, [...outcome ?? ''].length);
  let question = card.question;
  if ([...question].length > budget) {
    const marker = '…\nfull question in the workbench';
    const prefix = [...question].slice(0, Math.max(0, budget - [...marker].length)).join('');
    const boundary = /[\s\S]*\s/.exec(prefix)?.[0];
    question = (boundary ?? prefix).trimEnd() + marker;
  }
  return header + question + (outcome ? `\n\n${outcome}` : '');
}
