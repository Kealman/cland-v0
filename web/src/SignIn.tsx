import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import styles from './SignIn.module.css';

export function SignIn() {
  const available = isSecureContext && typeof PublicKeyCredential !== 'undefined';
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
  async function passkey() {
    setBusy(true); setError('');
    try {
      const form = document.querySelector('form')!;
      const name = new FormData(form).get('name');
      const base = invite ? '/invite/passkey' : '/signin/passkey';
      const post = async (path: string, body: unknown) => {
        const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      };
      const options = await post(base + '/options', invite ? { token } : { name });
      const challenge = options.challenge;
      const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const encode = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      options.challenge = decode(challenge);
      if (invite) options.user.id = decode(options.user.id);
      for (const row of options.allowCredentials ?? options.excludeCredentials ?? []) row.id = decode(row.id);
      const credential = await (invite ? navigator.credentials.create({ publicKey: options }) : navigator.credentials.get({ publicKey: options })) as PublicKeyCredential | null;
      if (!credential) throw new Error('Passkey unavailable');
      const response = credential.response;
      const data = { credentialId: encode(credential.rawId), clientDataJSON: encode(response.clientDataJSON),
        ...(response instanceof AuthenticatorAttestationResponse ? { attestationObject: encode(response.attestationObject) } : { authenticatorData: encode((response as AuthenticatorAssertionResponse).authenticatorData), signature: encode((response as AuthenticatorAssertionResponse).signature) }) };
      await post(base + '/finish', { challenge, response: data });
      location.replace('/');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Passkey failed'); setBusy(false); }
  }
  return <main className={styles.shell}>
    <section className={styles.card} aria-label={invite ? 'Invite' : 'Sign in'}>
      <div className={styles.brand}>cland</div>
      <h1>{invite ? user?.displayName ?? 'Invite' : 'Sign in'}</h1>
      {(!invite || user) && <>{user && <p>{user.name}</p>}<form onSubmit={event => { void submit(event); }}>
        {!invite && <><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="username" required disabled={busy} /></>}
        {available && <button type="button" disabled={busy} onClick={() => { void passkey(); }}>{invite ? 'Create passkey' : 'Use passkey'}</button>}
        <label title={!available ? 'Passkeys are unavailable in this browser or connection. Use a password.' : undefined} htmlFor="password">{invite ? 'Set password' : 'Password'}</label>
        <input id="password" name="password" type="password" autoComplete={invite ? 'new-password' : 'current-password'} minLength={invite ? 12 : undefined} maxLength={1024} required disabled={busy} title={invite ? 'At least 12 characters' : undefined} />
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form></>}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>;
}
