/** Session cleanup durations shared by configuration and prune requests. */
export function durationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  const ms = match ? Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]!]!) : NaN;
  if (!Number.isSafeInteger(ms) || ms <= 0) throw new Error('duration must be a positive integer followed by s, m, h or d');
  return ms;
}
