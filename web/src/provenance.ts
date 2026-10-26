/** Keep legacy sources readable; messenger names have their public capitalization. */
export function remoteSource(via: unknown): string | undefined {
  return via === 'telegram' ? 'via Telegram' : via === 'discord' ? 'via Discord' : undefined;
}
export function sourceLabel(via: string): string {
  return remoteSource(via) ?? via;
}
