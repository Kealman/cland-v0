import type { Capabilities, InboxAsk, SnapshotValues, VerificationQueue } from '../../../shared/wire/index.ts';

export type SessionsState = {
  sessionAsks?: InboxAsk[];
  archivedSessionRows?: SnapshotValues['sessions']['rows'];
  archivedSessionsError?: string | undefined;
  loadArchivedSessions?: () => void;
  adapters?: Record<string, Capabilities>;
  sessions?: SnapshotValues['sessions']['rows'];
  archivedSessions?: number;
  roles?: SnapshotValues['sessions']['roles'];
  verification?: { queue: VerificationQueue | null; receivedAt: number };
};

export function sessionSnapshot(value: SnapshotValues['sessions'], receivedAt: number): SessionsState {
  return { sessions: value.rows, archivedSessions: value.archived, roles: value.roles,
    verification: { queue: value.verification, receivedAt } };
}

export function replaceSession(rows: NonNullable<SessionsState['sessions']>, key: string, row: typeof rows[number] | null) {
  if (!row) return rows.filter(value => value.key !== key);
  return rows.some(value => value.key === key)
    ? rows.map(value => value.key === key ? row : value) : [...rows, row];
}

export const groupNames = ['Yours', 'Waiting', 'Busy', 'Idle', 'Stopped'] as const;
export function sessionGroups(rows: NonNullable<SessionsState['sessions']>) {
  return groupNames.map(name => ({ name, rows: rows.filter(row => {
    const group = !row.live ? 'Stopped' : row.role === 'aide' ? 'Yours'
      : row.state.startsWith('waiting') ? 'Waiting' : row.state === 'busy' ? 'Busy' : 'Idle';
    return group === name;
  }).sort((a, b) => name === 'Stopped' ? (b.stoppedAt ?? b.startedAt ?? '').localeCompare(a.stoppedAt ?? a.startedAt ?? '') || a.name.localeCompare(b.name) : 0) }));
}
