import type { RemoteStore } from './state.ts';

/** Single-mode receipts retain their v0.3 keys; users channels recover independently. */
export function discordChannelKey(store: RemoteStore, key: string, channel: string): string {
  return store.usersMode() ? `${key}:${channel}` : key;
}

/** Startup and catch-up use the same retained checkpoint identity, including Resume. */
export function hasDiscordHistory(store: RemoteStore): boolean {
  return store.publicationPairings().some(pair => store.get(discordChannelKey(store, 'discord.history', pair.chatId)) !== null);
}

/** A durable warning remains owed to this channel; it is not a bot-wide failure. */
export class DiscordRecoveryIncomplete extends Error {
  readonly channel: string;
  constructor(channel: string) { super('Discord recovery warning delivery incomplete'); this.channel = channel; }
}
