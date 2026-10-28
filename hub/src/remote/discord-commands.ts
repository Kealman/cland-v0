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

/** Interaction secrets are scoped to a waiting code, never a frame or durable record. */
export class DiscordCommands {
  readonly #api: DiscordApi; readonly #clock: Clock; readonly #store: RemoteStore | undefined;
  readonly #name: () => string; readonly #signal: AbortSignal;
  readonly #pending = new Map<string, Array<{ token: string; timer: ClockTimer; identity: Pairing }>>();
  readonly #work = new Set<Promise<unknown>>();
  #pair: ((identity: Pairing) => string | null) | undefined;
  constructor(api: DiscordApi, clock: Clock, store: RemoteStore | undefined, name: () => string, signal: AbortSignal) {
    this.#api = api; this.#clock = clock; this.#store = store; this.#name = name; this.#signal = signal;
  }
  start(pair?: (identity: Pairing) => string | null): void { this.#pair = pair; }
  dispatch(frame: DiscordDispatch): void {
    if (frame.t !== 'INTERACTION_CREATE' || this.#signal.aborted) return;
    const work = this.#handle(frame.d).catch(() => {}); // Native errors and token-bearing dispatch never cross the boundary.
    this.#work.add(work); void work.finally(() => this.#work.delete(work));
  }
  async #handle(raw: unknown): Promise<void> {
    const d = raw as { id?: string; token?: string; type?: number; guild_id?: string; channel_id?: string; channel?: { type?: number }; member?: { nick?: string; user?: { id?: string; username?: string; global_name?: string } }; data?: { name?: string; options?: Array<{ name?: string }> } };
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
    if (command !== 'pair') { await reply(pairing ? 'This command is not available yet.' : 'Not paired yet: run `/cland pair` in the channel.'); return; }
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
