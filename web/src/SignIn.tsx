import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import styles from './SignIn.module.css';

export function SignIn() {
  const invite = location.pathname === '/invite';
  const [user, setUser] = useState<{ name: string; displayName: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = new URLSearchParams(location.search).get('token') ?? '';
  useEffect(() => {
    if (!invite) return;
    const abort = new AbortController();
    void fetch(`/invite/details?token=${encodeURIComponent(token)}`, { method: 'POST', signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUser(data);
    }).catch((reason: unknown) => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Invite unavailable'); });
    return () => abort.abort();
  }, [token, invite]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    setBusy(true); setError('');
    try {
      const response = await fetch(invite ? '/invite/register' : '/signin/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invite ? { token, password } : { name: form.get('name'), password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      location.replace('/');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Registration failed'); setBusy(false); }
  }
  return <main className={styles.shell}>
    <section className={styles.card} aria-label={invite ? 'Invite' : 'Sign in'}>
      <div className={styles.brand}>cland</div>
      <h1>{invite ? user?.displayName ?? 'Invite' : 'Sign in'}</h1>
      {(!invite || user) && <>{user && <p>{user.name}</p>}<form onSubmit={event => { void submit(event); }}>
        {!invite && <><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="username" required disabled={busy} /></>}
        <label htmlFor="password">{invite ? 'Set password' : 'Password'}</label>
        <input id="password" name="password" type="password" autoComplete={invite ? 'new-password' : 'current-password'} minLength={invite ? 12 : undefined} maxLength={1024} required disabled={busy} title={invite ? 'At least 12 characters' : undefined} />
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form></>}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>;
}
