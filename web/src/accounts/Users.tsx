import { useEffect, useState } from 'react';
import type { WebSessionResult } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import { Fold } from '../Fold.tsx';
import s from './Users.module.css';

type User = { id: string; name: string; displayName: string; role: string; state: string };

export function Users({ connection }: { connection: ConnectionState }) {
  const { command, live } = connection;
  const [view, setView] = useState<{ userId: string; rows: User[] | undefined; error?: string }>();
  useEffect(() => {
    setView(undefined);
    if (!live || !command) return;
    let mounted = true;
    void command<WebSessionResult>({ type: 'web.session' }).then(async profile => {
      if (!mounted || profile.user?.role !== 'admin') return;
      const userId = profile.user.id;
      try {
        const value = await command<{ users: User[] }>({ type: 'user.list' });
        if (mounted) setView({ userId, rows: value.users });
      } catch (failure) {
        if (mounted) setView({ userId, rows: undefined, error: (failure as Error).message });
      }
    }).catch(() => { /* A missing profile grants no user-management view. */ });
    return () => { mounted = false; };
  }, [command, live]);
  return live && command && view ? <UserManagement key={view.userId} command={command} initialRows={view.rows} initialError={view.error} /> : null;
}

/** Unmounted on disconnect/profile loss, including its pending creation closures. */
function UserManagement({ command, initialRows, initialError }: {
  command: NonNullable<ConnectionState['command']>; initialRows: User[] | undefined; initialError: string | undefined;
}) {
  const [rows, setRows] = useState(initialRows);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [invite, setInvite] = useState<string>();
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  return <section aria-label="Users" className={s.users}>
    <Fold area="accounts" id="users" label="Users" count={rows?.length ?? '—'}>
      <div className={s.content}>
        {error && <div role="alert" className={s.error}>{error}</div>}
        <div className={s.scroll}><table><thead><tr>{['Name', 'Display name', 'Role', 'State'].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows?.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.displayName}</td><td>{user.role}</td><td>{user.state}</td></tr>)}</tbody>
        </table></div>
        <form className={s.form} onSubmit={event => {
          event.preventDefault();
          if (!command || pending) return;
          setPending(true); setError(undefined); setInvite(undefined);
          void command<{ user: User; url: string }>({ type: 'user.add', name, ...(displayName ? { displayName } : {}) }).then(async value => {
            setInvite(value.url); setName(''); setDisplayName('');
            const listed = await command<{ users: User[] }>({ type: 'user.list' });
            setRows(listed.users);
          }).catch((failure: Error) => setError(failure.message)).finally(() => setPending(false));
        }}>
          <label>Name<input required value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Display name<input value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
          <button disabled={pending} type="submit">Create user</button>
        </form>
        {invite && <div className={s.invite}>
          <label>Invite link<input readOnly value={invite} onFocus={event => event.target.select()} /></label>
          <button type="button" onClick={() => {
            setError(undefined);
            void Promise.resolve().then(() => {
              if (!navigator.clipboard) throw new Error('Clipboard unavailable');
              return navigator.clipboard.writeText(invite);
            }).catch(() => setError('Select and copy the invite link'));
          }}>Copy invite</button>
          <button type="button" onClick={() => setInvite(undefined)}>Dismiss invite</button>
        </div>}
      </div>
    </Fold>
  </section>;
}
