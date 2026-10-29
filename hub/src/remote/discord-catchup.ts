import { setImmediate as yieldIO } from 'node:timers/promises';
import type { DiscordApi, DiscordMessage } from './discord-api.ts';
import type { DiscordInbound } from './discord-inbound.ts';
import type { RemoteStore } from './state.ts';

export const DISCORD_HISTORY_LIMIT = 500;

/** Native replay metadata stays inside the adapter; public ingress frames are unchanged. */
export function discordLateText(text: string, timestamp: unknown, returnedAt: string): string {
  const written = typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))
    ? new Date(timestamp).toISOString().slice(11, 16) : 'unknown';
  return `${text}\n\n(written on Discord at ${written}; the hub was down until ${returnedAt.slice(11, 16)})`;
}


/** Freeze a bounded batch before advancing its cursor, including across interruptions. */
export async function catchDiscordHistory(api: DiscordApi, store: RemoteStore, inbound: DiscordInbound,
  returnedAt: string, signal: AbortSignal, overflow: (key: string) => Promise<void>, limit = DISCORD_HISTORY_LIMIT): Promise<void> {
  const pair = store.pairing(), cursor = store.get('discord.lastMessageId');
  if (!pair || !cursor) return;
  const raw = store.get('discord.history');
  let batch = raw ? JSON.parse(raw) as { channel: string; user: string; returnedAt: string; messages: DiscordMessage[]; overflow: boolean; key: string } : null;
  if (batch && (batch.channel !== pair.chatId || batch.user !== pair.userId)) batch = null;
  if (!batch) {
    const channel = await api.getChannel(pair.chatId, { signal });
    if (!channel.last_message_id || channel.last_message_id === cursor) return;
    const messages: DiscordMessage[] = [];
    let before: string | undefined;
    let done = false;
    while (!done && messages.length <= limit) {
      const page = await api.listMessages(pair.chatId, { ...(before ? { before } : {}), limit: 100 }, { signal });
      if (!page.length) break;
      for (const m of page) {
        if (BigInt(m.id) <= BigInt(cursor)) { done = true; break; }
        if (m.channel_id === pair.chatId && m.author.id === pair.userId && !m.author.bot && m.webhook_id === undefined
          && (m.type === 0 || m.type === 19) && (m.content.trim() || m.attachments?.length)) messages.push(m);
      }
      const next = page.at(-1)!.id;
      if (next === before || page.length < 100) break;
      before = next;
    }
    batch = { channel: pair.chatId, user: pair.userId, returnedAt, messages: messages.slice(0, limit).reverse(), overflow: messages.length > limit, key: `discord.history-overflow:${channel.last_message_id}` };
    store.set('discord.history', JSON.stringify(batch));
  }
  for (let index = 0; index < batch.messages.length;) {
    signal.throwIfAborted();
    const group: DiscordMessage[] = [];
    // Replies need the earlier native mapping; keep them serial like media I/O.
    while (index < batch.messages.length && group.length < 20) {
      const message = batch.messages[index]!;
      if (message.type === 19 || message.attachments?.length) break;
      group.push(message); index++;
    }
    const dispatch = (m: DiscordMessage) => inbound.dispatch({ op: 0, t: 'MESSAGE_CREATE', replayed: true,
      returnedAt: batch.returnedAt, d: { ...m, content: m.attachments?.length ? m.content : discordLateText(m.content, m.timestamp, batch.returnedAt) } });
    if (group.length) inbound.group(() => { for (const m of group) dispatch(m); });
    else dispatch(batch.messages[index++]!);
    await inbound.idle();
    await yieldIO();
  }
  if (batch.overflow) await overflow(batch.key);
  store.set('discord.history', null);
}
