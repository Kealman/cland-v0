/** Native replay metadata stays inside the adapter; public ingress frames are unchanged. */
export function discordLateText(text: string, timestamp: unknown, returnedAt: string): string {
  const written = typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))
    ? new Date(timestamp).toISOString().slice(11, 16) : 'unknown';
  return `${text}\n\n(written on Discord at ${written}; the hub was down until ${returnedAt.slice(11, 16)})`;
}
