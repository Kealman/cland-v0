import type { ConnectionState } from '../connection.ts';
import { sessionGroups } from './state.ts';
import s from './Sessions.module.css';

export function SessionsHeader({ connection, archived, toggle }: { connection: ConnectionState; archived: boolean; toggle: () => void }) {
  return <div className={s.header} data-session-slot="header">
    {sessionGroups(connection.sessions ?? []).map(group => <span key={group.name} data-session-count={group.name}>{group.name} {group.rows.length}</span>)}
    <button aria-label="Show archived sessions" aria-pressed={archived} title="Show archived sessions (A)" onClick={toggle}>Archive {connection.archivedSessions ?? '—'}</button>
  </div>;
}
