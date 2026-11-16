export const STARTUP_OWNER_PREFIX = 'suite startup owner ';
export type StartupOwner = { id: string; event: 'start' | 'finish' };
export const startupOwnerLine = (owner: StartupOwner) => STARTUP_OWNER_PREFIX + JSON.stringify(owner);
export function parseStartupOwner(line: string): StartupOwner | undefined {
  if (!line.startsWith(STARTUP_OWNER_PREFIX)) return undefined;
  try {
    const row = JSON.parse(line.slice(STARTUP_OWNER_PREFIX.length));
    if (typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 200 && ['start', 'finish'].includes(row.event)) return row;
  } catch { /* A torn marker never delegates. */ }
  return undefined;
}
