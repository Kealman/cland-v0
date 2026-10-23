import { useEffect, useState } from 'react';
import type { WebSessionResult } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import { Fold } from '../Fold.tsx';
import s from './Profile.module.css';

/** The human's browser sign-in is separate from the harness account registry. */
export function Profile({ connection }: { connection: ConnectionState }) {
  const [signIn, setSignIn] = useState<WebSessionResult>();
  const [error, setError] = useState<string>();
  const { command, live } = connection;
  useEffect(() => {
    if (!live || !command) return;
    let mounted = true;
    void command<WebSessionResult>({ type: 'web.session' }).then(value => {
      if (mounted) { setSignIn(value); setError(undefined); }
    }, (failure: Error) => { if (mounted) setError(failure.message); });
    return () => { mounted = false; };
  }, [command, live]);
  return <section aria-label="Profile" className={s.profile}>
    <Fold area="accounts" id="profile" label="Profile" count={signIn ? 1 : '—'}>
      <div className={s.content}>
        <h3>This browser</h3>
        {error ? <div role="alert" className={s.error} title={error}>Sign-in unavailable</div> : signIn ? <dl className={s.dates}>
          {([['Created', signIn.createdAt], ['Last used', signIn.lastUsedAt], ['Cookie expires', signIn.expiresAt]] as const).map(([label, value]) => <div key={label}>
            <dt>{label}</dt><dd><time dateTime={value} title={value}>{new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></dd>
          </div>)}
        </dl> : <span className={s.pending}>—</span>}
      </div>
    </Fold>
  </section>;
}
