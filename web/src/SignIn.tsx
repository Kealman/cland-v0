import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import styles from './SignIn.module.css';

export function SignIn() {
  const [user, setUser] = useState<{ name: string; displayName: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = new URLSearchParams(location.search).get('token') ?? '';
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`/invite/details?token=${encodeURIComponent(token)}`, { method: 'POST', signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUser(data);
    }).catch((reason: unknown) => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Invite unavailable'); });
    return () => abort.abort();
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true); setError('');
    try {
      const response = await fetch('/invite/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      location.replace('/');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Registration failed'); setBusy(false); }
  }
  return <main className={styles.shell}>
    <section className={styles.card} aria-label="Invite">
      <div className={styles.brand}>cland</div>
      <h1>{user ? user.displayName : 'Invite'}</h1>
      {user && <><p>{user.name}</p><form onSubmit={event => { void submit(event); }}>
        <label htmlFor="password">Set password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required disabled={busy} title="At least 12 characters" />
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form></>}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>;
}
