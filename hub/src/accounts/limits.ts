// Source-shaped account windows. Sessions and harness polls supply readings; no provider calls here.
import { isDeepStrictEqual } from 'node:util';
import type { Account, Accounts } from './registry.ts';

export type LimitWindow = { id: string; label: string; usedPercent: number; resetsAt: string; windowMins?: number; severity?: string; scope?: string };
export type LimitSource = { kind: 'session'; session: string } | { kind: 'poll' };
export type AccountReading = { account: string; harness: string; windows: LimitWindow[]; at: string; source: LimitSource; signedOut?: boolean };
export type AccountView = Account & { windows: LimitWindow[]; at: string | null; source: LimitSource | null; signedOut?: boolean };
export type AccountList = Omit<Accounts, 'accounts'> & { accounts: AccountView[] };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const iso = (v: unknown, seconds = false): string | null => {
  const time = typeof v === 'number' ? v * (seconds ? 1000 : 1) : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? new Date(time).toISOString() : null;
};
const duration = (mins: number): string => mins === 300 ? '5h' : mins === 10080 ? 'wk' : mins >= 1440 && mins % 1440 === 0 ? `${mins / 1440}d` : `${mins / 60}h`;

/** Sparse Codex notifications retain omitted values; an explicit null removes a window. */
export function mergeLimits(previous: Record<string, unknown> | null | undefined, update: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...previous };
  for (const [key, value] of Object.entries(update)) merged[key] = object(value) ? mergeLimits(object(merged[key]) ? merged[key] : null, value) : value;
  return merged;
}

export function codexWindows(rateLimits: unknown, byId: unknown): LimitWindow[] {
  const windows: LimitWindow[] = [];
  const bucket = (value: unknown, id: string, scope?: string) => {
    if (!object(value)) return;
    for (const slot of ['primary', 'secondary']) {
      const w = value[slot];
      if (!object(w) || typeof w.usedPercent !== 'number' || !Number.isFinite(w.usedPercent)) continue;
      const resetsAt = iso(w.resetsAt, true);
      if (!resetsAt) continue;
      const mins = typeof w.windowDurationMins === 'number' && Number.isFinite(w.windowDurationMins) ? w.windowDurationMins : undefined;
      windows.push({ id: `${id}:${slot}`, label: scope ?? (mins === undefined ? slot : duration(mins)), usedPercent: w.usedPercent, resetsAt,
        ...(mins !== undefined ? { windowMins: mins } : {}), ...(typeof w.severity === 'string' ? { severity: w.severity } : {}), ...(scope ? { scope } : {}) });
    }
  };
  // The compatibility snapshot prefers codex but may name another bucket.
  // Index it by its actual id, then prefer the matching by-id snapshot once.
  const buckets: Record<string, unknown> = object(byId) ? { ...byId } : {};
  if (object(rateLimits)) {
    const id = typeof rateLimits.limitId === 'string' ? rateLimits.limitId : 'codex';
    if (!object(buckets[id])) buckets[id] = rateLimits;
  }
  bucket(buckets.codex, 'codex');
  for (const id of Object.keys(buckets).sort()) {
    if (id === 'codex') continue;
    const value = buckets[id];
    bucket(value, id, object(value) && typeof value.limitName === 'string' ? value.limitName : id);
  }
  return windows;
}

export function claudeWindows(value: unknown): LimitWindow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(w => {
    if (!object(w) || typeof w.kind !== 'string' || typeof w.percentUsed !== 'number' || !Number.isFinite(w.percentUsed)) return [];
    const resetsAt = iso(w.resetsAt);
    if (!resetsAt) return [];
    return [{ id: w.kind, label: w.kind === 'five_hour' ? '5h' : w.kind === 'seven_day' ? 'wk' : w.kind, usedPercent: w.percentUsed, resetsAt,
      ...(typeof w.severity === 'string' ? { severity: w.severity } : {}) }];
  });
}

/** Durable newest-wins store. A repeated window/source refreshes age silently. */
export class AccountLimits {
  readonly #readings = new Map<string, AccountReading>();
  readonly #state: { read(key: string): string | null; write(key: string, value: string): void };
  constructor(state: { read(key: string): string | null; write(key: string, value: string): void }) {
    this.#state = state;
    const saved = state.read('account-limits');
    if (saved) for (const reading of JSON.parse(saved) as AccountReading[]) this.#readings.set(reading.account, reading);
  }
  update(reading: AccountReading): boolean {
    const previous = this.#readings.get(reading.account);
    if (previous && (Date.parse(previous.at) > Date.parse(reading.at) || previous.at === reading.at && previous.source.kind === 'session' && reading.source.kind === 'poll')) return false;
    if (isDeepStrictEqual(previous, reading)) return false;
    const changed = !previous || previous.signedOut !== reading.signedOut || previous.harness !== reading.harness || !isDeepStrictEqual(previous.windows, reading.windows) || !isDeepStrictEqual(previous.source, reading.source);
    this.#readings.set(reading.account, structuredClone(reading));
    this.#state.write('account-limits', JSON.stringify([...this.#readings.values()]));
    return changed;
  }
  view(account: Account): AccountView {
    const saved = this.#readings.get(account.name);
    const reading = account.harness !== 'opencode' && saved?.harness === account.harness ? saved : undefined;
    return { ...account, windows: reading?.windows ?? [], at: reading?.at ?? null, source: reading?.source ?? null, ...(reading?.signedOut ? { signedOut: true } : {}) };
  }
  list(registry: Accounts): AccountList {
    const accounts = registry.accounts.map(a => this.view(a));
    for (const reading of this.#readings.values()) if (reading.account.startsWith('default:')) accounts.push(this.view({ name: reading.account, harness: reading.harness, path: null, variable: reading.harness === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR' }));
    return { ...registry, accounts: accounts.sort((a, b) => a.name.localeCompare(b.name)) };
  }
}
