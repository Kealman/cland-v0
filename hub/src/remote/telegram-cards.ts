import type { RemoteIngress } from './gateway.ts';
import type { TelegramUpdateHandler } from './telegram-polling.ts';
import { TelegramError, type TelegramApi, type TgEntity } from './telegram-api.ts';
import type { Formatted } from './telegram-render.ts';
import { randomUUID } from 'node:crypto';
import type { AskCard, HubFrame, Inbox, InboxApproval, InboxAsk } from '../protocol.ts';
import type { RemoteStore } from './state.ts';
import type { TelegramOutbox } from './telegram-outbox.ts';
import { approvalCard, approvalOutcomeLine, askCard, closedCardLine, noticeCards, type CardAction, type RemoteCard } from './cards.ts';

import type { TelegramPrompts } from './telegram-prompts.ts';

/** Telegram renders the shared card model; opaque actions stay in hub.db. */
type CardRequest = <T>(type: string, fields: Record<string, unknown>, ingress?: RemoteIngress) => Promise<T>;

export class TelegramCards {
  readonly #store: RemoteStore;
  readonly #outbox: TelegramOutbox;
  readonly #api: TelegramApi;
  readonly #request: CardRequest;
  readonly #signal: AbortSignal;
  readonly #webOrigin: (() => string) | undefined;
  readonly #prompts: TelegramPrompts;
  constructor(store: RemoteStore, outbox: TelegramOutbox, api: TelegramApi,
    request: CardRequest, signal: AbortSignal, prompts: TelegramPrompts, webOrigin?: () => string) {
    this.#store = store; this.#outbox = outbox; this.#api = api; this.#request = request; this.#signal = signal;
    this.#prompts = prompts; this.#webOrigin = webOrigin;
  }

  readonly handler: TelegramUpdateHandler = {
    accepts: update => !!update.callback_query,
    handle: async update => {
      const press = update.callback_query!;
      const chat = String(press.message?.chat.id);
      const mapped = press.message && this.#store.message(chat, String(press.message.message_id));
      const raw = typeof press.data === 'string' ? this.#store.get(`telegram.button:${press.data}`) : null;
      const button = raw ? JSON.parse(raw) as { ask?: string; approval?: string; chat: string; action: CardAction } : null;
      const receipt = `telegram.press:${press.id}`;
      let toast = 'This button is not available';
      if (button && mapped && (button.ask && mapped.ask === button.ask || button.approval && mapped.approval === button.approval) && button.chat === chat) {
        const saved = this.#store.get(receipt);
        if (saved && saved !== 'pending') toast = saved;
        else {
          const inbox = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
          const open = () => button.approval ? inbox.approvals.some(row => row.id === button.approval) : inbox.asks.some(ask => ask.id === button.ask);
          if (saved !== 'pending' && !open()) toast = 'Already answered';
          else if (button.approval && 'choice' in button.action || button.ask && 'option' in button.action) {
            this.#store.set(receipt, 'pending');
            try {
              await this.#request(button.approval ? 'approval.answer' : 'topic.answer',
                button.approval && 'choice' in button.action ? { approval: button.approval, choice: button.action.choice }
                  : { ask: button.ask, option: 'option' in button.action ? button.action.option : undefined },
                { chatId: chat, messageId: `callback:${press.id}` });
              toast = 'Answered';
            } catch (error) {
              // A different client may win after the open-inbox read. Only a
              // closed hub record is terminal; a failed write still retries.
              const current = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
              if (button.approval ? current.approvals.some(row => row.id === button.approval) : current.asks.some(ask => ask.id === button.ask)) throw error;
              toast = 'Already answered';
            }
          } else if (button.ask && 'kind' in button.action) {
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
      await Promise.all([this.publish(frame.inbox.asks), this.publishApprovals(frame.inbox.approvals), this.publishNotices(frame.inbox), ...(frame.inbox.departures ?? []).flatMap(row => {
        if (row.kind === 'approval' && row.outcome && 'choice' in row.outcome) return [this.approvalOutcome(row.id, row.outcome)];

        if (row.kind !== 'ask' || !['answered', 'declined', 'withdrawn', 'cancelled'].includes(row.reason)) return [];
        return [this.outcome(row.id, { state: row.reason === 'declined' ? 'answered' : row.reason as AskCard['state'],
          ...(row.outcome && 'status' in row.outcome ? { outcome: row.outcome } : {}) })];
      })]);
    } else if (frame.type === 'ask' && frame.card.state !== 'open') await this.outcome(frame.ask, frame.card);
    else if (frame.type === 'approval' && frame.approval.state === 'closed' && frame.approval.outcome)
      await this.approvalOutcome(frame.approval.id, frame.approval.outcome);
    else if (frame.type === 'approval') await this.publishApprovals([frame.approval]);
  }

  async approvalOutcome(id: string, outcome: import('../protocol.ts').ApprovalOutcome): Promise<void> {
    const pairing = this.#store.pairing();
    const model = this.#store.get(`telegram.approval-model:${id}`);
    if (!pairing || !model) return;
    this.#store.set(`telegram.approval-closure:${id}`, JSON.stringify(outcome));
    const card = approvalCard(JSON.parse(model));
    await Promise.all(this.#store.messagesForApproval(id).filter(copy => copy.chatId === pairing.chatId).map(copy =>
      this.#outbox.edit({ chat_id: copy.chatId, message_id: Number(copy.messageId), ...telegramCard(card, approvalOutcomeLine(outcome)), reply_markup: { inline_keyboard: [] } },
      { key: `telegram.outcome:${copy.chatId}:${copy.messageId}`, source: id, topic: copy.topic, approval: id })));
  }

  async publishApprovals(approvals: InboxApproval[]): Promise<void> {
    const pairing = this.#store.pairing();
    if (!pairing) return;
    await Promise.all(approvals.filter(approval => approval.answerIn === 'hub' && approval.state !== 'closed').map(approval => {
      this.#store.set(`telegram.approval-model:${approval.id}`, JSON.stringify(approval));
      const key = `telegram.approval:${pairing.chatId}:${approval.id}`;
      const previous = this.#store.get(key);
      const card = approvalCard(approval);
      const keyboard = previous ? JSON.parse(previous) : this.#store.transaction(() => {
        const rows = card.buttons.map(button => {
          const data = randomUUID();
          this.#store.set(`telegram.button:${data}`, JSON.stringify({ approval: approval.id, chat: pairing.chatId, action: button.action }));
          return [{ text: button.label, style: button.style, callback_data: data }];
        });
        this.#store.set(key, JSON.stringify(rows));
        return rows;
      });
      return this.#outbox.send({ chat_id: pairing.chatId, ...telegramCard(card),
        reply_markup: { inline_keyboard: keyboard }, link_preview_options: { is_disabled: true } },
      { key, kind: 'card', source: approval.id, topic: approval.topic ?? 'general', approval: approval.id }).then(async () => {
        const closed = this.#store.get(`telegram.approval-closure:${approval.id}`);
        if (closed) await this.approvalOutcome(approval.id, JSON.parse(closed));
      });
    }));
  }

  async publishNotices(inbox: Inbox): Promise<void> {
    const pairing = this.#store.pairing();
    if (!pairing) return;
    const notices = noticeCards(inbox, this.#webOrigin?.()).sort((a, b) => a.since.localeCompare(b.since)
      || a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind));
    await Promise.all(notices.map(notice => {
      if (notice.reference) this.#store.set(`telegram.notice-reference:${notice.id}`, notice.reference);
      return this.#outbox.send({ chat_id: pairing.chatId, ...telegramCard(notice.card),
        link_preview_options: { is_disabled: true } },
      { key: `telegram.notice:${pairing.chatId}:${notice.kind}:${notice.id}:${notice.since}`, kind: 'card', source: notice.id, topic: notice.topic });
    }));
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
    const rendered = telegramCard(view, line);
    await Promise.all(this.#store.messagesForAsk(id).filter(copy => copy.chatId === pairing.chatId).map(copy =>
      this.#outbox.edit({ chat_id: copy.chatId, message_id: Number(copy.messageId), ...rendered,
        reply_markup: { inline_keyboard: [] } },
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
      return this.#outbox.send({ chat_id: pairing.chatId, ...telegramCard(card),
        reply_markup: { inline_keyboard: keyboard }, link_preview_options: { is_disabled: true } },
      { key, kind: 'card', source: ask.id, topic: ask.topic.id, ask: ask.id }).then(async () => {
        const closed = this.#store.get(`telegram.card-closure:${ask.id}`);
        if (closed) await this.outcome(ask.id, JSON.parse(closed));
      });
    }));
  }
}


/** One native card id, including after its outcome; never split an ask's controls. */
function telegramCard(card: RemoteCard, outcome?: string): Formatted {
  // Source titles and configured origins have no short text bound. Reserve
  // space for the body and outcome, retaining the full source and link target.
  const titlePoints = [...card.title];
  const title = titlePoints.length <= 1024 ? card.title : titlePoints.slice(0, 1023).join('') + '…';
  const header = `${title}\n\n`;
  const linkText = card.link ? [...card.link].length <= 1024 ? card.link : 'Open workbench' : '';
  const link = linkText ? `\n\n${linkText}` : '';
  // Options are at most 200 characters. Keep generous space for their full
  // outcome, attribution and local time without moving the question preview.
  const budget = 4096 - [...header].length - [...link].length - 2 - Math.max(1024, [...outcome ?? ''].length);
  let question = card.question;
  if ([...question].length > budget) {
    const marker = `…\n${card.truncated ?? `full ${card.preview ?? 'question'} in the workbench`}`;
    const prefix = [...question].slice(0, Math.max(0, budget - [...marker].length)).join('');
    const boundary = card.truncated ? prefix : /[\s\S]*\s/.exec(prefix)?.[0];
    question = (boundary ?? prefix).trimEnd() + marker;
  }
  const text = header + question + link + (outcome ? `\n\n${outcome}` : '');
  const entities: TgEntity[] = [{ type: 'bold', offset: 0, length: title.length }];
  if (card.link) entities.push({ type: linkText === card.link ? 'url' : 'text_link',
    offset: header.length + question.length + 2, length: linkText.length,
    ...(linkText !== card.link ? { url: card.link } : {}) });
  return { text, entities };
}
