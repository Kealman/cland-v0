import type { ConnectionState } from '../connection.ts';
import { sessionGroups } from './state.ts';
import s from './Sessions.module.css';

export function SessionsHeader({ connection, archived, toggle, launch, launching }: { connection: ConnectionState; archived: boolean; toggle: () => void; launch: (aide: boolean) => void; launching: boolean }) {
  return <div className={s.header} data-session-slot="header">
    {sessionGroups(connection.sessions ?? []).map(group => <span key={group.name} data-session-count={group.name}>{group.name} {group.rows.length}</span>)}
    <button disabled={!connection.live || !connection.roles?.roles.length || launching} title="Launch a session (l)" onClick={() => launch(false)}>Launch a session</button>
    <button disabled={!connection.live || !connection.roles?.roles.length || launching} title="New Aide (a)" onClick={() => launch(true)}>New Aide</button>
    <button aria-label="Show archived sessions" aria-pressed={archived} title="Show archived sessions (A)" onClick={toggle}>Archive {connection.archivedSessions ?? '—'}</button>
  </div>;
}
