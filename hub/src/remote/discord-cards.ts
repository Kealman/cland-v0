import type { HubFrame, InboxAsk, TopicMessage } from '../protocol.ts';
import type { RemoteStore } from './state.ts';
import type { DiscordOutbox } from './discord-outbox.ts';
import type { DiscordActionRow } from './discord-api.ts';
import type { RemoteSend } from './gateway.ts';
import type { DiscordApi } from './discord-api.ts';
import type { DiscordDispatch } from './discord-socket.ts';
import type { Clock } from '../hub/clock.ts';
import { askCard, inboxPublication, outcomeLine } from './cards.ts';

export function discordAsk(ask: InboxAsk): { content: string; components: DiscordActionRow[] } {
  const card = askCard(ask);
  const numbered = ask.options.some(label => [...label].length > 34);
  const options = card.buttons.filter(b => 'option' in b.action);
  const components: DiscordActionRow[] = [];
  for (let i = 0; i < options.length; i += 5) components.push({ type: 1, components: options.slice(i, i + 5).map(b => ({
    type: 2, style: 1, label: numbered && 'option' in b.action ? String(b.action.option) : b.label,
    custom_id: `ask:${ask.id}:${'option' in b.action ? b.action.option : ''}`,
  })) });
  components.push({ type: 1, components: card.buttons.filter(b => 'kind' in b.action).map(b => ({
    type: 2, style: 2, label: b.label, custom_id: `ask:${ask.id}:${'kind' in b.action ? b.action.kind : ''}`,
  })) });
  const title = [...card.title].slice(0, 100).join('');
  const list = numbered ? '\n\n' + ask.options.map((label, i) => `${i + 1}. ${label}`).join('\n') : '';
  const prefix = `**${title}**\n\n`, marker = '… (full question in the workbench)';
  const budget = 2000 - [...prefix + list].length;
  let question = card.question;
  if ([...question].length > budget) {
    question = [...question].slice(0, Math.max(0, budget - [...marker].length)).join('');
    const word = question.lastIndexOf(' ');
    if (word > 0) question = question.slice(0, word);
    question += marker;
  }
  return { content: prefix + question + list, components };
}

export class DiscordCards {
  #send: RemoteSend | undefined; #next = 0;
  readonly #requests = new Map<string, ReturnType<typeof Promise.withResolvers<unknown>>>();
  readonly #work = new Set<Promise<void>>();
  readonly #api: DiscordApi; readonly #clock: Clock; readonly #signal: AbortSignal;
  readonly #store: RemoteStore; readonly #outbox: DiscordOutbox;
  constructor(store: RemoteStore, outbox: DiscordOutbox, api: DiscordApi, clock: Clock, signal: AbortSignal) {
    this.#store = store; this.#outbox = outbox; this.#api = api; this.#clock = clock; this.#signal = signal;
  }
  start(send: RemoteSend): void { this.#send = send; }
  async #request<T>(type: string, fields: Record<string, unknown>, interaction?: string): Promise<T> {
    const id = `discord-card-${++this.#next}`, pending = Promise.withResolvers<unknown>();
    this.#requests.set(id, pending);
    const abort = () => pending.reject(new Error('Discord card cancelled'));
    this.#signal.addEventListener('abort', abort, { once: true });
    try {
      this.#signal.throwIfAborted();
      this.#send!({ type, id, ...fields }, interaction ? { chatId: this.#store.pairing()!.chatId, messageId: `interaction:${interaction}` } : undefined);
      return await pending.promise as T;
    } finally { this.#requests.delete(id); this.#signal.removeEventListener('abort', abort); }
  }
  dispatch(frame: DiscordDispatch): void {
    if (frame.t !== 'INTERACTION_CREATE' || this.#signal.aborted) return;
    const work = this.#press(frame.d).catch(() => {});
    this.#work.add(work); void work.finally(() => this.#work.delete(work));
  }
  async #press(raw: unknown): Promise<void> {
    const d = raw as { type?: number; id?: string; token?: string; guild_id?: string; channel_id?: string; member?: { user?: { id?: string } }; message?: { id?: string }; data?: { custom_id?: string } };
    if (d.type !== 3 || typeof d.id !== 'string' || typeof d.token !== 'string') return;
    const reply = (text: string) => this.#api.callback(d.id!, d.token!, text, { signal: this.#signal });
    const pair = this.#store.pairing();
    if (!pair || pair.guildId !== d.guild_id || pair.chatId !== d.channel_id || pair.userId !== d.member?.user?.id) { await reply('This channel or user is not paired with this project.'); return; }
    const match = /^ask:(.+):(other|decline|[1-9])$/.exec(d.data?.custom_id ?? '');
    const mapping = d.message?.id && this.#store.message(pair.chatId, d.message.id);
    if (!match || !mapping || mapping.ask !== match[1]) { await reply('This button is not available'); return; }
    const model = this.#store.get(`discord.card-model:${mapping.ask}`);
    const ask = model ? JSON.parse(model) as InboxAsk : null;
    if (!ask || (match[2] === 'other' && !ask.free) || (/^[1-9]$/.test(match[2]!) && Number(match[2]) > ask.options.length)) { await reply('This button is not available'); return; }
    if (match[2] === 'other' || match[2] === 'decline') { await reply('not available yet'); return; }
    let deferred: Promise<unknown> | undefined;
    const timer = this.#clock.setTimeout(() => { if (!this.#signal.aborted) { deferred = this.#api.update(d.id!, d.token!, null, { signal: this.#signal }); void deferred.catch(() => {}); } }, 2000);
    timer.unref();
    const cancel = () => this.#clock.clearTimeout(timer);
    this.#signal.addEventListener('abort', cancel, { once: true });
    try {
      let result: { message: TopicMessage };
      try { result = await this.#request('topic.answer', { ask: mapping.ask, option: Number(match[2]) }, d.id); }
      catch {
        this.#clock.clearTimeout(timer);
        if (!this.#signal.aborted && !deferred) {
          const inbox = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
          await reply(inbox.asks.some(row => row.id === mapping.ask) ? 'Could not answer. Try again.' : 'Already answered');
        }
        return;
      }
      this.#store.set(`discord.press:${d.id}`, 'answered');
      const content = outcomeLine({ status: 'answered', text: result.message.text, by: 'human', via: 'discord', at: result.message.ts });
      this.#clock.clearTimeout(timer);
      if (deferred) {
        // Persist the owed edit even when Discord accepted the defer but lost its response.
        await Promise.all([deferred.catch(() => {}), this.#outbox.edit(pair.chatId, d.message!.id!, content, `discord.press:${d.id}`)]);
      }
      else await this.#api.update(d.id, d.token, content, { signal: this.#signal });
    } finally { this.#clock.clearTimeout(timer); this.#signal.removeEventListener('abort', cancel); await deferred?.catch(() => {}); }
  }
  async stop(): Promise<void> { await Promise.allSettled([...this.#work]); }
  async receive(frame: HubFrame): Promise<void> {
    if (this.#signal.aborted) return;
    if (frame.type === 'result') { const p = this.#requests.get(frame.id); if (frame.ok) p?.resolve(frame.value); else p?.reject(new Error('Discord card refused')); }
    if (frame.type !== 'inbox') return;
    const pair = this.#store.pairing(); if (!pair) return;
    await Promise.all(inboxPublication(frame.inbox).flatMap(row => {
      if (row.kind !== 'ask') return [];
      this.#store.set(`discord.card-model:${row.id}`, JSON.stringify(row.ask));
      const rendered = discordAsk(row.ask);
      return [this.#outbox.card(pair.chatId, rendered.content, rendered.components, row.id, row.ask.topic.id)];
    }));
  }
}
