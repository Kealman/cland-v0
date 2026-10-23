import type { AccountView, LimitWindow } from '../../../shared/wire/index.ts';

export type AccountTone = 'normal' | 'warning' | 'critical';
export const harnessName = (harness: string) => ({ 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode' })[harness] ?? harness;

function tone(window: LimitWindow): AccountTone {
  if (window.severity) return window.severity === 'critical' ? 'critical' : window.severity === 'warning' ? 'warning' : 'normal';
  return window.usedPercent >= 90 ? 'critical' : window.usedPercent >= 75 ? 'warning' : 'normal';
}

/** Neovim's account clock formats, using the browser's local timezone. */
export function resetTime(value: string | null, now: number): string {
  const at = new Date(value ?? '');
  if (!Number.isFinite(at.getTime())) return '--:--';
  const today = new Date(now);
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  if (at.toDateString() === today.toDateString()) return time;
  if (Math.abs(at.getTime() - now) < 7 * 86_400_000) return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()]} ${time}`;
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

function readingAge(at: string | null, now: number): string {
  const seconds = Math.max(0, (now - Date.parse(at ?? '')) / 1000);
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return '<1m';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/** One source-shaped projection shared by the registry and compact strip. */
export function accountModel(account: AccountView, now: number) {
  const status = account.signedOut ? 'signed out' : account.harness === 'opencode' ? 'no limit data' : !Number.isFinite(Date.parse(account.at ?? '')) || !account.windows.length ? 'no reading yet' : undefined;
  const windows = (status ? [] : account.windows).map(window => ({ ...window, share: `${Math.round(window.usedPercent)}%`, reset: resetTime(window.resetsAt, now), tone: tone(window) }));
  const worst = windows.reduce<typeof windows[number] | undefined>((found, window) => !found || window.usedPercent > found.usedPercent ? window : found, undefined);
  return {
    ...account, windows, worst, status, share: worst?.share ?? '—', age: readingAge(account.at, now),
    tone: account.limited ? 'critical' as const : worst?.tone ?? 'normal',
    limit: account.limited ? { ...account.limited, sinceTime: resetTime(account.limited.since, now), reset: account.limited.resetsAt ? resetTime(account.limited.resetsAt, now) : 'until cleared' } : undefined,
    source: account.source?.kind === 'session' ? `from ${account.source.session}` : account.source?.kind === 'poll' ? 'poll' : '—',
  };
}

export function accountModels(accounts: readonly AccountView[], now: number) {
  return [...accounts.filter(row => !row.name.startsWith('default:')), ...accounts.filter(row => row.name.startsWith('default:'))].map(row => accountModel(row, now));
}
