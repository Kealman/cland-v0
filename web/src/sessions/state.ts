import type { Capabilities, SnapshotValues, VerificationQueue } from '../../../shared/wire/index.ts';

export type SessionsState = {
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
