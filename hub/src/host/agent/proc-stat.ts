/** One grammar for Linux stat's parenthesized comm, parent and native birth. */
export function parseLinuxStat(stat: string): { pid: number; state: string; parent: number | null; ticks: string | null } | null {
  const match = /^(\d+) \([\s\S]*\) (\S+) ([\s\S]*)$/.exec(stat.trim());
  if (!match) return null;
  const fields = match[3]!.split(/\s+/), parent = fields[0], ticks = fields[18];
  return { pid: Number(match[1]), state: match[2]!,
    parent: parent && /^\d+$/.test(parent) && Number.isSafeInteger(Number(parent)) ? Number(parent) : null,
    ticks: ticks && /^\d+$/.test(ticks) ? ticks : null };
}
