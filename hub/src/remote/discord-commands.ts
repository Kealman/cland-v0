import type { HubFrame, HubStatus, Inbox } from '../protocol.ts';
import type { RemoteSend, RemoteIngress } from './gateway.ts';
import { statusReply, helpReply, type PhoneReply } from './replies.ts';
import type { DiscordApi } from './discord-api.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import type { Pairing, RemoteStore } from './state.ts';
import type { DiscordDispatch } from './discord-socket.ts';

export const CLAND_COMMAND = {
  type: 1, name: 'cland', description: 'Control this cland project',
  contexts: [0], integration_types: [0], default_member_permissions: '0',
  options: ['pair', 'status', 'inbox', 'mute', 'unmute', 'decision', 'question', 'help'].map(name => ({
    type: 1, name, description: `${name[0]!.toUpperCase()}${name.slice(1)}`,
    ...(['decision', 'question'].includes(name) ? { options: [{ type: 3, name: 'text', description: 'Text', required: true }] } : {}),
  })),
};
// Compare writable fields, including additions under options. Server metadata and
// optional empty/default fields do not warrant another global bulk overwrite.
const COMMAND_METADATA = new Set(['id', 'application_id', 'guild_id', 'version', 'name_localized', 'description_localized', 'dm_permission', 'default_permission']);
const EMPTY_ARRAY_DEFAULTS = new Set(['options', 'choices', 'channel_types']);
const FALSE_DEFAULTS = new Set(['required', 'autocomplete', 'nsfw']);
function definition(value: unknown, command = false): unknown {
  if (Array.isArray(value)) return value.map(v => definition(v));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([key, v]) => {
      if (command && COMMAND_METADATA.has(key)) return false;
      if (v === null || v === undefined) return false;
      if (FALSE_DEFAULTS.has(key) && v === false) return false;
      if (EMPTY_ARRAY_DEFAULTS.has(key) && Array.isArray(v) && v.length === 0) return false;
      return true;
    });
    if (command && !entries.some(([key]) => key === 'type')) entries.push(['type', 1]);
    return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, definition(v)]));
  }
  return value;
}
export async function registerCommands(api: DiscordApi, application: string, signal: AbortSignal): Promise<void> {
  const current = await api.listCommands(application, { signal });
  if (current.length !== 1 || JSON.stringify(definition(current[0], true)) !== JSON.stringify(definition(CLAND_COMMAND, true)))
    await api.putCommands(application, [CLAND_COMMAND], { signal });
}

const literal = (text: string): string => text.replace(/[\\`*_[\]|~>]/g, '\\$&');
function renderReply(reply: PhoneReply): string[] {
  const lines = [{ text: reply.title, prefix: '**', suffix: '**', gap: '' }];
  for (const group of reply.groups) {
    lines.push({ text: group.label, prefix: '**', suffix: '**', gap: '\n\n' });
    for (const line of group.lines) lines.push({ text: line.startsWith('• ') ? line.slice(2) : line,
      prefix: line.startsWith('• ') ? '- ' : '', suffix: '', gap: '\n' });
  }
  reply.small.forEach((text, index) => lines.push({ text, prefix: '-# ', suffix: '', gap: index ? '\n' : '\n\n' }));
  const pages: string[] = []; let page = '';
  for (const line of lines) {
    // Escape atoms belong to a single Unicode code point and are never divided.
    const atoms = [...line.text].map(literal);
    const budget = 2000 - [...line.prefix + line.suffix].length;
    let content = '', size = 0, gap = line.gap;
    const append = () => {
      const rendered = line.prefix + content + line.suffix;
      if ([...page + gap + rendered].length > 2000) { pages.push(page); page = ''; }
      page += (page ? gap : '') + rendered;
      gap = '\n'; content = ''; size = 0;
    };
    for (const atom of atoms) {
      const length = [...atom].length;
      if (size + length > budget) append();
      content += atom; size += length;
    }
    append();
  }
  if (page) pages.push(page);
  return pages;
}

function discordHelp(project: string): string[] {
  return renderReply(helpReply(project, { groups: [
    { label: 'Follow', lines: ['General messages arrive here.', 'Asks and approvals arrive as cards; use their buttons.', '/cland inbox re-sends open ask cards oldest first. Earlier copies keep working.'] },
    { label: 'Send', lines: ['Write to the Coordinator or reply to a mirrored message.', 'Use /cland decision or /cland question with a text field.', 'Plans are approved in the workbench.'] },
    { label: 'Commands', lines: [
      '• /cland pair: Pair this channel', '• /cland status: Hub, sessions and queues',
      '• /cland inbox: Re-send open ask cards', '• /cland mute: Mute General here',
      '• /cland unmute: Resume General here', '• /cland decision <text>: Send a decision',
      '• /cland question <text>: Ask a question', '• /cland help: Commands and trust',
    ] },
  ], small: ['Only the paired Discord user in this channel can act.',
    'Pairing is approved locally. Session, release and configuration controls stay in the workbench.'] }));
}

/** Interaction secrets are scoped to a waiting code, never a frame or durable record. */
export class DiscordCommands {
  readonly #api: DiscordApi; readonly #clock: Clock; readonly #store: RemoteStore | undefined;
  readonly #name: () => string; readonly #signal: AbortSignal;
  readonly #pending = new Map<string, Array<{ token: string; timer: ClockTimer; identity: Pairing }>>();
  readonly #work = new Set<Promise<unknown>>();
  #send: RemoteSend | undefined; #next = 0;
  readonly #requests = new Map<string, ReturnType<typeof Promise.withResolvers<unknown>>>();
  readonly #connected: () => boolean;
  readonly #publishInbox: ((inbox: Inbox, key: string) => Promise<number>) | undefined;
  #pair: ((identity: Pairing) => string | null) | undefined;
  constructor(api: DiscordApi, clock: Clock, store: RemoteStore | undefined, name: () => string, signal: AbortSignal, connected: () => boolean = () => false, publishInbox?: (inbox: Inbox, key: string) => Promise<number>) {
    this.#api = api; this.#clock = clock; this.#store = store; this.#name = name; this.#signal = signal; this.#connected = connected; this.#publishInbox = publishInbox;
  }
  start(pair?: (identity: Pairing) => string | null, send?: RemoteSend): void { this.#pair = pair; this.#send = send; }
  receive(frame: HubFrame): void {
    if (frame.type !== 'result') return;
    const pending = this.#requests.get(frame.id);
    if (frame.ok) pending?.resolve(frame.value); else pending?.reject(new Error('Discord command refused'));
  }
  async #request<T>(type: string, fields: Record<string, unknown> = {}, ingress?: RemoteIngress): Promise<T> {
    const id = `discord-command-${++this.#next}`;
    const pending = Promise.withResolvers<unknown>(); this.#requests.set(id, pending);
    const abort = () => pending.reject(new Error('Discord command cancelled'));
    this.#signal.addEventListener('abort', abort, { once: true });
    try {
      this.#signal.throwIfAborted();
      if (!this.#send) throw new Error('Discord command unavailable');
      this.#send({ ...fields, type, id }, ingress);
      return await pending.promise as T;
    } finally { this.#requests.delete(id); this.#signal.removeEventListener('abort', abort); }
  }
  async #status(): Promise<string[]> {
    const status = await this.#request<HubStatus>('hub.status');
    const releases = await this.#request<{ items: Array<{ id: string; title: string }> }>('task.list', { kind: 'release', state: 'open', projection: 'summary' });
    const gateway = await this.#api.getGatewayBot({ signal: this.#signal });
    const budget = JSON.parse(this.#store?.get('discord.identify') ?? 'null') as { timestamps: number[] } | null;
    const count = budget?.timestamps.filter(at => at > this.#clock.now().getTime() - 86400000).length ?? 0;
    return renderReply(statusReply(this.#name(), status, releases.items, { connected: this.#connected(),
      muted: this.#store?.get('mute') === 'true', label: 'This channel',
      outbox: this.#store?.outbox().filter(job => ['queued', 'sending', 'uncertain'].includes(job.state)).length ?? 0,
      extra: [`Identifies today: ${count}`, `Remaining session starts: ${gateway.session_start_limit.remaining}`] }));
  }
  async #answer(id: string, token: string, application: string | undefined, produce: () => Promise<string | string[] | null>): Promise<void> {
    let deferred: Promise<unknown> | undefined;
    // Own the acknowledgement before starting any hub or REST work.
    const timer = this.#clock.setTimeout(() => {
      if (this.#signal.aborted) return;
      deferred = this.#api.defer(id, token, { signal: this.#signal });
      void deferred.catch(() => {});
    }, 2000);
    timer.unref();
    const cancel = () => this.#clock.clearTimeout(timer);
    this.#signal.addEventListener('abort', cancel, { once: true });
    try {
      let text: string | string[] | null;
      try { text = await produce(); }
      catch { if (this.#signal.aborted) return; text = 'Command failed. Try again.'; }
      this.#clock.clearTimeout(timer);
      const pages = text === null ? [] : typeof text === 'string' ? [text] : text;
      if (deferred) {
        await deferred;
        if (pages.length && application && /^\d+$/.test(application))
          await this.#api.editOriginal(application, token, pages[0]!, { signal: this.#signal });
      } else if (pages.length) await this.#api.callback(id, token, pages[0]!, { signal: this.#signal });
      if (application && /^\d+$/.test(application))
        for (const page of pages.slice(1)) await this.#api.followup(application, token, page, { signal: this.#signal });
    } finally {
      this.#clock.clearTimeout(timer); this.#signal.removeEventListener('abort', cancel);
      await deferred?.catch(() => {});
    }
  }
  dispatch(frame: DiscordDispatch): void {
    if (frame.t !== 'INTERACTION_CREATE' || this.#signal.aborted) return;
    const work = this.#handle(frame.d).catch(() => {}); // Native errors and token-bearing dispatch never cross the boundary.
    this.#work.add(work); void work.finally(() => this.#work.delete(work));
  }
  async #handle(raw: unknown): Promise<void> {
    const d = raw as { id?: string; application_id?: string; token?: string; type?: number; guild_id?: string; channel_id?: string; channel?: { type?: number }; member?: { nick?: string; user?: { id?: string; username?: string; global_name?: string } }; data?: { name?: string; options?: Array<{ name?: string; options?: Array<{ name?: string; value?: unknown }> }> } };
    if (d?.type !== 2 || d.data?.name !== 'cland' || typeof d.token !== 'string' || typeof d.id !== 'string') return;
    const user = d.member?.user;
    const reply = (text: string) => this.#api.callback(d.id!, d.token!, text, { signal: this.#signal });
    if (![d.guild_id, d.channel_id, user?.id].every(id => typeof id === 'string' && /^\d+$/.test(id)) || d.channel?.type !== 0) { await reply('Run /cland pair in a server text channel.'); return; }
    const identity: Pairing = { guildId: d.guild_id!, chatId: d.channel_id!, userId: user!.id!, name: d.member?.nick ?? user!.global_name ?? user!.username ?? user!.id! };
    const pairing = this.#store?.pairing();
    const sameUser = pairing?.guildId === identity.guildId && pairing.userId === identity.userId;
    const here = sameUser && pairing?.chatId === identity.chatId;
    const command = d.data.options?.[0]?.name;
    if (pairing && (!sameUser || (!here && command !== 'pair'))) { await reply('This channel or user is not paired with this project.'); return; }
    if (command !== 'pair') {
      if (!here) { await reply('Not paired yet: run `/cland pair` in the channel.'); return; }
      await this.#answer(d.id, d.token, d.application_id, async () => {
        if (command === 'decision' || command === 'question') {
          const text = d.data?.options?.[0]?.options?.find(option => option.name === 'text')?.value;
          if (typeof text !== 'string' || !text.trim()) return 'Provide a text field.';
          await this.#request('topic.send', { topic: 'general', kind: command, text }, { chatId: identity.chatId, messageId: d.id! });
          return 'Sent';
        }
        if (command === 'inbox' && this.#publishInbox) {
          const inbox = await this.#request<Inbox>('inbox.list');
          const current = this.#store?.pairing();
          if (!current || current.guildId !== identity.guildId || current.chatId !== identity.chatId || current.userId !== identity.userId)
            return 'This channel or user is not paired with this project.';
          const count = await this.#publishInbox(inbox, `discord.inbox:${d.id}`);
          return count ? `${count} open card${count === 1 ? '' : 's'}` : 'Nothing needs you';
        }
        if (command === 'mute' || command === 'unmute')
          return this.#store?.applyMute(`discord.mute:${d.id}`, command === 'mute') ?? null;
        return command === 'status' ? this.#status() : command === 'help' ? discordHelp(this.#name()) : 'This command is not available yet.';
      });
      return;
    }
    if (here) { await reply(`Paired with ${this.#name()}`); return; }
    const text = this.#pair?.(identity);
    if (text == null) return;
    const code = /code ([A-Z2-9]{8})/.exec(text)?.[1];
    if (code) {
      const entries = this.#pending.get(code) ?? [];
      const item = { token: d.token, identity, timer: undefined as unknown as ClockTimer };
      item.timer = this.#clock.setTimeout(() => { const live = this.#pending.get(code); if (!live) return; const next = live.filter(e => e !== item); if (next.length) this.#pending.set(code, next); else this.#pending.delete(code); }, 900000);
      item.timer.unref(); entries.push(item); this.#pending.set(code, entries);
    }
    await reply(text);
  }
  async approved(pairing: Pairing, application: string): Promise<void> {
    const selected = [...this.#pending.values()].flat().filter(e => e.identity.userId === pairing.userId && e.identity.chatId === pairing.chatId && e.identity.guildId === pairing.guildId);
    this.#clear();
    await Promise.allSettled([...this.#work]);
    await Promise.all(selected.map(e => this.#api.editOriginal(application, e.token, `Approved: this channel is paired with ${this.#name()}`, { signal: this.#signal }).catch(() => {})));
  }
  #clear(): void { for (const entries of this.#pending.values()) for (const e of entries) this.#clock.clearTimeout(e.timer); this.#pending.clear(); }
  async stop(): Promise<void> { this.#clear(); await Promise.allSettled([...this.#work]); }
}
