import type { LogFn } from '../log.ts';
import type { InboxApproval, AskCard, HubFrame, Inbox, InboxAsk, TopicMessage } from '../protocol.ts';
import type { RemoteStore } from './state.ts';
import type { DiscordOutbox } from './discord-outbox.ts';
import type { DiscordActionRow } from './discord-api.ts';
import type { RemoteSend } from './gateway.ts';
import type { DiscordApi } from './discord-api.ts';
import type { DiscordDispatch } from './discord-socket.ts';
import type { Clock } from '../hub/clock.ts';
import { approvalCard, approvalOutcomeLine, askCard, inboxPublication, outcomeLine } from './cards.ts';

export function discordAsk(ask: InboxAsk, suffix = ''): { content: string; components: DiscordActionRow[] } {
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
  const budget = 2000 - [...prefix + list + suffix].length;
  let question = card.question;
  if ([...question].length > budget) {
    question = [...question].slice(0, Math.max(0, budget - [...marker].length)).join('');
    const word = question.lastIndexOf(' ');
    if (word > 0) question = question.slice(0, word);
    question += marker;
  }
  return { content: prefix + question + list + suffix, components };
}

export function discordApproval(approval: InboxApproval, tail = ''): { content: string; components: DiscordActionRow[] } {
  const card = approvalCard(approval);
  const prefix = `**${[...card.title].slice(0, 150).join('')}**\n\n\`\`\`\n`;
  const suffix = '\n```\n… (full command in the workbench)' + tail;
  // Keep an embedded fence from escaping the preview's code block.
  const question = card.question.replaceAll('```', '`\u200b``');
  const content = prefix + [...question].slice(0, 2000 - [...prefix + suffix].length).join('') + suffix;
  return { content, components: [{ type: 1, components: card.buttons.map(button => ({
    type: 2, style: button.style === 'success' ? 3 : button.style === 'danger' ? 4 : 1,
    label: button.label, custom_id: `approval:${approval.id}:${'choice' in button.action ? button.action.choice : ''}`,
  })) }] };
}

export class DiscordCards {
  #send: RemoteSend | undefined; #next = 0;
  #replayReady = false;
  #history = true;
  #latest: Inbox | undefined;
  readonly #requests = new Map<string, ReturnType<typeof Promise.withResolvers<unknown>>>();
  readonly #work = new Set<Promise<void>>();
  readonly #log: LogFn | undefined;
  readonly #webOrigin: (() => string) | undefined;
  readonly #api: DiscordApi; readonly #clock: Clock; readonly #signal: AbortSignal;
  readonly #store: RemoteStore; readonly #outbox: DiscordOutbox;
  constructor(store: RemoteStore, outbox: DiscordOutbox, api: DiscordApi, clock: Clock, signal: AbortSignal, log?: LogFn, webOrigin?: () => string) {
    this.#webOrigin = webOrigin; this.#log = log; this.#store = store; this.#outbox = outbox; this.#api = api; this.#clock = clock; this.#signal = signal;
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
    if (frame.replayed) this.#replayReady = false;
    const work = (frame.replayed ? this.#replay(frame.d) : this.#press(frame.d)).catch(() => {});
    this.#work.add(work); void work.finally(() => this.#work.delete(work));
  }
  async #replay(raw: Record<string, unknown>): Promise<void> {
    const d = raw as { type?: number; id?: string; guild_id?: string; channel_id?: string; member?: { user?: { id?: string } }; message?: { id?: string }; data?: { custom_id?: string } };
    const pair = this.#store.pairing();
    if (d.type !== 3 || !d.id || !pair || pair.guildId !== d.guild_id || pair.chatId !== d.channel_id || pair.userId !== d.member?.user?.id) return;
    const mapping = d.message?.id && this.#store.message(pair.chatId, d.message.id);
    const match = /^(ask|approval):(.+):([^:]+)$/.exec(d.data?.custom_id ?? '');
    if (!mapping || !match || (match[1] === 'ask' ? mapping.ask : mapping.approval) !== match[2]) return;
    const model = this.#store.get(match[1] === 'ask' ? `discord.card-model:${match[2]}` : `discord.approval-model:${match[2]}`);
    if (!model) return;
    const rendered = match[1] === 'ask' ? discordAsk(JSON.parse(model)) : discordApproval(JSON.parse(model));
    if (!rendered.components.some(row => row.components.some(button => button.custom_id === d.data?.custom_id))) return;
    const key = `discord.replay-press:${d.id}`;
    if (this.#store.get(key) === '1') return;
    // No token or provider payload is persisted. The id is also the stable resend key.
    this.#store.set(key, JSON.stringify({ channel: pair.chatId, user: pair.userId, kind: match[1], card: match[2], old: d.message!.id }));
  }
  beginHistory(): void { this.#history = true; this.#replayReady = false; }
  async finishHistory(key: string): Promise<void> {
    if (!this.#store.entries('discord.card-model:').length && !this.#store.entries('discord.approval-model:').length) {
      this.#history = false; this.#replayReady = true;
      if (this.#latest) await this.publishInbox(this.#latest);
      return;
    }
    const inbox = await this.#request<Inbox>('inbox.list', {});
    const pair = this.#store.pairing();
    if (pair) for (const row of [...inbox.asks.map(a => ({ id: a.id, kind: 'ask' })), ...inbox.approvals.map(a => ({ id: a.id, kind: 'approval' }))]) {
      const copies = row.kind === 'ask' ? this.#store.messagesForAsk(row.id) : this.#store.messagesForApproval(row.id);
      const olds = copies.filter(copy => copy.chatId === pair.chatId).map(copy => copy.messageId);
      const intent = `discord.replay-press:${key}:${row.kind}:${row.id}`;
      if (olds.length && !this.#store.get(intent)) this.#store.set(intent, JSON.stringify({ channel: pair.chatId, user: pair.userId, kind: row.kind, card: row.id, old: olds[0], olds }));
    }
    await this.#outbox.resume();
    await this.#recoverReplay(inbox);
    this.#history = false;
    this.#replayReady = true;
    await this.publishInbox(inbox);
  }
  beginReplay(): void { this.#replayReady = false; }
  async finishReplay(): Promise<void> {
    this.#history = false;
    this.#replayReady = true;
    if (!this.#store.entries('discord.replay-press:').some(row => row.value !== '1')) return;
    const inbox = await this.#request<Inbox>('inbox.list', {});
    await this.#recoverReplay(inbox);
  }
  async #recoverReplay(inbox: Inbox): Promise<void> {
    for (const { key, value } of this.#store.entries('discord.replay-press:')) {
      if (value === '1') continue;
      const saved = JSON.parse(value) as { channel: string; user: string; kind: string; card: string; old: string; olds?: string[] };
      const pair = this.#store.pairing();
      if (pair?.chatId !== saved.channel || pair.userId !== saved.user) continue;
      const asks = saved.kind === 'ask' ? inbox.asks.filter(row => row.id === saved.card) : [];
      const approvals = saved.kind === 'approval' ? inbox.approvals.filter(row => row.id === saved.card) : [];
      if (asks.length || approvals.length) {
        await this.publishInbox({ ...inbox, asks, approvals, plans: [], requests: [], messages: [] }, key, true);
        const job = this.#store.outbox().find(row => row.source === `${key}:discord.card:${saved.channel}:${saved.kind === 'approval' ? 'approval:' : ''}${saved.card}`);
        if (job?.state !== 'sent') continue;
        for (const old of saved.olds ?? [saved.old]) await this.#outbox.edit(saved.channel, old, '↓ Re-sent below', key);
      }
      this.#store.set(key, '1');
    }
  }
  async #press(raw: unknown): Promise<void> {
    const d = raw as { type?: number; id?: string; token?: string; application_id?: string; guild_id?: string; channel_id?: string; member?: { user?: { id?: string } }; message?: { id?: string }; data?: { custom_id?: string; components?: Array<{ component?: { custom_id?: string; value?: string } }> } };
    if (![3, 5].includes(d.type ?? 0) || typeof d.id !== 'string' || typeof d.token !== 'string') return;
    const reply = (text: string) => this.#api.callback(d.id!, d.token!, text, { signal: this.#signal });
    const pair = this.#store.pairing();
    if (!pair || pair.guildId !== d.guild_id || pair.chatId !== d.channel_id || pair.userId !== d.member?.user?.id) { await reply("This card is for the project's owner"); return; }
    if (d.data?.custom_id?.startsWith('approval:')) { await this.#approvalPress(d, reply); return; }
    const match = /^(?:ask|modal):(.+):(other|decline|[1-9])$/.exec(d.data?.custom_id ?? '');
    const mapping = d.message?.id && this.#store.message(pair.chatId, d.message.id);
    if (!match || !mapping || mapping.ask !== match[1]) { await reply('This button is not available'); return; }
    const model = this.#store.get(`discord.card-model:${mapping.ask}`);
    const ask = model ? JSON.parse(model) as InboxAsk : null;
    if (!ask || (match[2] === 'other' && !ask.free) || (/^[1-9]$/.test(match[2]!) && Number(match[2]) > ask.options.length)) { await reply('This button is not available'); return; }
    const closure = this.#store.get(`discord.card-closure:${mapping.ask}`);
    if (closure) { await reply('Already answered'); await this.#outcome(mapping.ask!, JSON.parse(closure)); return; }
    const modal = d.type === 5;
    if (modal !== d.data!.custom_id!.startsWith('modal:') || (modal && !['other', 'decline'].includes(match[2]!))) { await reply('This button is not available'); return; }
    const text = d.data?.components?.find(row => row.component?.custom_id === 'answer')?.component?.value;
    if (modal && (typeof text !== 'string' || !text.trim() || text.length > 4000)) { await reply('An answer of 1 to 4000 characters is required.'); return; }
    if (!modal && (match[2] === 'other' || match[2] === 'decline')) {
      const inbox = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
      if (!inbox.asks.some(row => row.id === mapping.ask)) { await reply('Already answered'); return; }
      await this.#api.modal(d.id, d.token, { custom_id: `modal:${mapping.ask}:${match[2]}`, title: match[2] === 'other' ? 'Your answer' : 'Why decline', components: [
        { type: 10, content: [...ask.question].slice(0, 4000).join('') },
        { type: 18, label: match[2] === 'other' ? 'Answer' : 'Reason', component: { type: 4, custom_id: 'answer', style: 2, required: true, max_length: 4000 } },
      ] }, { signal: this.#signal }); return;
    }
    let deferred: Promise<unknown> | undefined;
    const timer = this.#clock.setTimeout(() => { if (!this.#signal.aborted) { deferred = this.#api.update(d.id!, d.token!, null, { signal: this.#signal }); void deferred.catch(() => {}); } }, 2000);
    timer.unref();
    const cancel = () => this.#clock.clearTimeout(timer);
    this.#signal.addEventListener('abort', cancel, { once: true });
    try {
      let result: { message: TopicMessage };
      try { result = await this.#request('topic.answer', { ask: mapping.ask, ...(modal ? match[2] === 'decline' ? { declined: true, reason: text } : { text } : { option: Number(match[2]) }) }, d.id); }
      catch {
        this.#clock.clearTimeout(timer);
        if (!this.#signal.aborted) {
          const inbox = await this.#request<import('../protocol.ts').Inbox>('inbox.list', {});
          const text = inbox.asks.some(row => row.id === mapping.ask) ? 'Could not answer. Try again.' : 'Already answered';
          if (deferred) {
            this.#log?.({ event: 'discord-card-refusal-ready' });
            // Join initial acknowledgement before follow-up I/O, but a lost
            // response does not cancel the private refusal still owed.
            await deferred.catch(() => {});
            if (d.application_id && /^\d+$/.test(d.application_id)) {
              this.#log?.({ event: 'discord-card-refusal-followup' });
              await this.#api.followup(d.application_id, d.token, text, { signal: this.#signal });
            }
          } else await reply(text);
          const closure = this.#store.get(`discord.card-closure:${mapping.ask}`);
          if (closure) await this.#outcome(mapping.ask!, JSON.parse(closure));
        }
        return;
      }
      this.#store.set(`discord.press:${d.id}`, 'answered');
      const content = [...outcomeLine(result.message.ask?.outcome ?? { ...(modal && match[2] === 'decline' ? { status: 'declined' as const, reason: text!.trim() } : { status: 'answered' as const, text: result.message.text }), by: 'human', via: 'discord', at: result.message.ts })].slice(0, 2000).join('');
      this.#clock.clearTimeout(timer);
      if (deferred) {
        // Persist the owed edit even when Discord accepted the defer but lost its response.
        await Promise.all([deferred.catch(() => {}), this.#outbox.edit(pair.chatId, d.message!.id!, content, `discord.press:${d.id}`)]);
      }
      else await this.#api.update(d.id, d.token, content, { signal: this.#signal });
    } finally { this.#clock.clearTimeout(timer); this.#signal.removeEventListener('abort', cancel); await deferred?.catch(() => {}); }
  }
  async #approvalPress(d: { type?: number; id?: string; token?: string; application_id?: string; message?: { id?: string }; data?: { custom_id?: string } }, reply: (text: string) => Promise<unknown>): Promise<void> {
    const pair = this.#store.pairing()!;
    const match = /^approval:(.+):(once|always|deny)$/.exec(d.data?.custom_id ?? '');
    const mapping = d.message?.id && this.#store.message(pair.chatId, d.message.id);
    const raw = match && this.#store.get(`discord.approval-model:${match[1]}`);
    const model = raw ? JSON.parse(raw) as InboxApproval : null;
    if (d.type !== 3 || !match || !mapping || mapping.approval !== match[1] || !model || !model.choices.includes(match[2] as import('../protocol.ts').ApprovalChoice)) { await reply('This button is not available'); return; }
    const id = match[1]!;
    const closed = () => this.#store.get(`discord.card-closure:approval:${id}`);
    if (closed()) { await reply('Already answered'); await this.#outbox.closeApproval(id, JSON.parse(closed()!)); return; }
    let deferred: Promise<unknown> | undefined;
    const timer = this.#clock.setTimeout(() => { if (!this.#signal.aborted) { deferred = this.#api.update(d.id!, d.token!, null, { signal: this.#signal }); void deferred.catch(() => {}); } }, 2000);
    timer.unref();
    const cancel = () => this.#clock.clearTimeout(timer);
    this.#signal.addEventListener('abort', cancel, { once: true });
    try {
      let result: { approval: InboxApproval };
      try { result = await this.#request('approval.answer', { approval: id, choice: match[2] }, d.id); }
      catch {
        cancel();
        if (this.#signal.aborted) return;
        const inbox = await this.#request<Inbox>('inbox.list', {});
        const text = inbox.approvals.some(row => row.id === id) ? 'Could not answer. Try again.' : 'Already answered';
        if (deferred) { await deferred.catch(() => {}); if (d.application_id) await this.#api.followup(d.application_id, d.token!, text, { signal: this.#signal }); }
        else await reply(text);
        if (closed()) await this.#outbox.closeApproval(id, JSON.parse(closed()!));
        return;
      }
      this.#store.set(`discord.press:${d.id}`, 'answered');
      cancel();
      const outcome = result.approval.outcome!;
      const content = [...approvalOutcomeLine(outcome)].slice(0, 2000).join('');
      if (deferred) await Promise.all([deferred.catch(() => {}), this.#outbox.closeApproval(id, outcome)]);
      else await this.#api.update(d.id!, d.token!, content, { signal: this.#signal });
    } finally { cancel(); this.#signal.removeEventListener('abort', cancel); await deferred?.catch(() => {}); }
  }
  async #outcome(id: string, card: Pick<AskCard, 'state' | 'outcome'>): Promise<void> {
    await this.#outbox.closeCard(id, card);
  }

  async idle(): Promise<void> { await Promise.all([...this.#work]); }
  async stop(): Promise<void> { await Promise.allSettled([...this.#work]); }
  async receive(frame: HubFrame): Promise<void> {
    if (this.#signal.aborted) return;
    if (frame.type === 'result') { const p = this.#requests.get(frame.id); if (frame.ok) p?.resolve(frame.value); else p?.reject(new Error('Discord card refused')); }
    if (frame.type === 'ask' && frame.card.state !== 'open') await this.#outcome(frame.ask, frame.card);
    if (frame.type === 'approval' && frame.approval.state === 'closed' && frame.approval.outcome) await this.#outbox.closeApproval(frame.approval.id, frame.approval.outcome);
    if (frame.type !== 'inbox') return;
    this.#latest = frame.inbox;
    await Promise.all((frame.inbox.departures ?? []).flatMap(row => {
      if (row.kind === 'approval' && row.outcome && 'choice' in row.outcome) return [this.#outbox.closeApproval(row.id, row.outcome)];
      if (row.kind !== 'ask' || !['answered', 'declined', 'withdrawn', 'cancelled'].includes(row.reason)) return [];
      return [this.#outcome(row.id, { state: row.reason === 'declined' ? 'answered' : row.reason as AskCard['state'],
        ...(row.outcome && 'status' in row.outcome ? { outcome: row.outcome } : {}) })];
    }));
    if (this.#replayReady) await this.#recoverReplay(frame.inbox);
    await this.publishInbox(frame.inbox);
  }
  async publishInbox(inbox: Inbox, resend?: string, replay = false): Promise<number> {
    const pair = this.#store.pairing(); if (!pair || (this.#history && !replay)) return 0;
    const rows = inboxPublication(inbox, this.#webOrigin?.());
    await Promise.all(rows.map(row => {
      if (row.kind === 'notice') {
        const notice = row.notice;
        if (notice.reference) this.#store.set(`discord.notice-reference:${notice.id}`, notice.reference);
        const tail = `\n\n${notice.card.question}${notice.card.link ? `\n${notice.card.link}` : ''}`;
        // Plan instructions and the public origin are fixed content: only its
        // variable title may consume the remaining native message budget.
        const titleBudget = 2000 - [...tail].length;
        const title = notice.kind === 'plan' && [...notice.card.title].length > titleBudget
          ? [...notice.card.title].slice(0, Math.max(0, titleBudget - 1)).join('') + '…' : notice.card.title;
        const content = [...`${title}${tail}`].slice(0, 2000).join('');
        return this.#outbox.notice(pair.chatId, content, `discord.notice:${notice.kind}:${notice.id}:${notice.since}`, notice.topic, notice.id, resend);
      }
      if (row.kind === 'approval') {
        this.#store.set(`discord.approval-model:${row.id}`, JSON.stringify(row.approval));
        const rendered = discordApproval(row.approval, replay ? '\n\na button pressed then may have been lost; press again' : '');
        return this.#outbox.card(pair.chatId, rendered.content, rendered.components, row.id, row.approval.topic ?? 'general', resend, true);
      }
      this.#store.set(`discord.card-model:${row.id}`, JSON.stringify(row.ask));
      const rendered = discordAsk(row.ask, replay ? '\n\na button pressed then may have been lost; press again' : '');
      return this.#outbox.card(pair.chatId, rendered.content, rendered.components, row.id, row.ask.topic.id, resend).then(async () => {
        const closure = this.#store.get(`discord.card-closure:${row.id}`);
        if (closure) await this.#outcome(row.id, JSON.parse(closure));
      });
    }));
    return rows.length;
  }
}
