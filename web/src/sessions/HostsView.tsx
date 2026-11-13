import { useEffect, useRef, useState } from 'react';
import type { AskCard, HostsStatePool } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import s from './HostsView.module.css';
import { signInCardId } from '../signin-index.ts';
import { readSignInCards, writeSignInCards } from './signin-cards.ts';

// Metadata returned by login.list; no credential fields enter this view.
type Login = { provider?: string; region?: string; name: string; harness: string; account: string; kind: string; state: string;
  signedOut?: { reason: string }; lastSignIn: string | null; bindings: Array<{ host: string }> };
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
const money = (value: number | null) => value === null ? 'unknown' : `$${value.toFixed(2)}`;
function uptime(created: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(created)) / 1000));
  if (!Number.isFinite(seconds)) return 'unknown';
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
}

function HostRow({ host, connection, now }: { host: HostsStatePool['hosts'][number]; connection: ConnectionState; now: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const stop = async () => {
    if (!confirm || !connection.live || !connection.command || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const outcome = await connection.command<{ state?: string; reason?: string }>({ type: 'host.stop', host: host.id });
      setConfirm(false);
      if (outcome.state !== 'destroyed') setError(`${outcome.state ?? 'unknown'}: ${outcome.reason ?? 'deletion not confirmed'}`);
    }
    catch (cause) { setError(message(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  return <li data-host-id={host.id} className={s.row}>
    <span title="Host id">{host.id}</span>
    <span title="Provider machine size">{host.size}</span>
    <span title="Provider region">{host.region}</span>
    <span title="Host state">{host.state}</span>
    <span title="Time since the host was created">{uptime(host.created, now)}</span>
    <span title="Sessions running on this host">sessions {host.sessions.length}: {host.sessions.join(', ') || 'none'}</span>
    <span title="Last reported hourly price in USD">{money(host.priceHourly)}/h</span>
    <span title="Spend today in USD, as last pushed by the hub">{money(host.spendToday)} today</span>
    {confirm ? <div role="group" aria-label={`Confirm Stop ${host.id}`} className={s.row}>
      <span>Stop {host.id}? {host.sessions.length} sessions end as exited.</span>
      <button disabled={!connection.live || pending} onClick={() => { void stop(); }}>Confirm</button>
      <button disabled={pending} onClick={() => setConfirm(false)}>Cancel</button>
    </div> : <button disabled={!connection.live || pending} onClick={() => setConfirm(true)}>Stop</button>}
    {error && <span role="alert" className={s.error}>{error}</span>}
  </li>;
}

type Harness = 'codex' | 'claude-code' | 'opencode';
const isHarness = (value: string): value is Harness => ['codex', 'claude-code', 'opencode'].includes(value);

function SignInCard({ id, card, connection }: { id: string; card: AskCard; connection: ConnectionState }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false);
  const answer = async (text?: string) => {
    if (!connection.live || !connection.command || busy.current) return;
    if (input.current) input.current.value = '';
    busy.current = true; setPending(true); setError('');
    try { await connection.command({ type: 'topic.answer', ask: id, ...(text === undefined ? { declined: true, reason: 'Cancel sign-in' } : { text }) }); }
    catch (cause) { setError(message(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  if (card.state !== 'open') return <span>{card.outcome?.status === 'answered' ? card.outcome.text : card.state}</span>;
  const link = card.question.match(/https?:\/\/[^\s]+/)?.[0];
  return <div className={s.card} data-signin-card={id}>
    <span>{card.question}</span>
    {link && <a href={link} target="_blank" rel="noreferrer">{link}</a>}
    {card.free && <form onSubmit={event => { event.preventDefault(); const value = input.current?.value.trim(); if (value) void answer(value); }}>
      <label>Sign-in code <input ref={input} autoComplete="off" disabled={!connection.live || pending} /></label>
      <button disabled={!connection.live || pending}>Send code</button>
    </form>}
    <button disabled={!connection.live || pending} onClick={() => void answer()}>Cancel sign-in</button>
    {error && <span role="alert" className={s.error}>{error}</span>}
  </div>;
}

function AddLogin({ pool, harnesses, connection, started }: { pool: string; harnesses: Harness[]; connection: ConnectionState; started: (value: { name: string; card: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false);
  return <div className={s.row}>
    <button disabled={!connection.live || !harnesses.length || pending} onClick={() => setOpen(value => !value)}>Add</button>
    {open && <form className={s.row} onSubmit={event => {
      event.preventDefault(); if (busy.current || !connection.live || !connection.command) return;
      const data = new FormData(event.currentTarget), harness = String(data.get('harness')), name = String(data.get('name') ?? '').trim();
      if (!isHarness(harness)) return;
      busy.current = true; setPending(true); setError('');
      void connection.command<{ name: string; card: string }>({ type: 'login.add', pool, harness, ...(name ? { name } : {}) })
        .then(async value => { await started(value); setOpen(false); }).catch(cause => setError(message(cause)))
        .finally(() => { busy.current = false; setPending(false); });
    }}>
      <label>Harness <select name="harness" disabled={pending}>{harnesses.map(harness => <option key={harness}>{harness}</option>)}</select></label>
      <label>Name <input name="name" disabled={pending} /></label>
      <button disabled={!connection.live || pending}>Start sign-in</button>
    </form>}
    {error && <span role="alert" className={s.error}>{error}</span>}
  </div>;
}

function LoginRow({ login, connection, refresh, cardId, started }: { login: Login; connection: ConnectionState; refresh: () => Promise<void>; cardId?: string | undefined; started: (value: { name: string; card: string }) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const busy = useRef(false);
  const removable = login.state !== 'in-use' && login.bindings.length === 0;
  const remove = async () => {
    if (!confirm || !removable || !connection.live || !connection.command || busy.current) return;
    busy.current = true; setPending(true); setError(''); setResult('');
    try {
      await connection.command({ type: 'login.remove', name: login.name });
      setConfirm(false);
      await refresh();
    } catch (cause) { setError(message(cause)); setConfirm(false); }
    finally { busy.current = false; setPending(false); }
  };
  const snapshot = async () => {
    if (!connection.live || !connection.command || busy.current) return;
    busy.current = true; setPending(true); setError(''); setResult('');
    try {
      const outcome = await connection.command<{ state: string; snapshot?: { id: string }; reason?: string; retryAt?: string }>({ type: 'login.snapshot', name: login.name });
      if (outcome.state === 'snapshotted') setResult(`snapshotted: ${outcome.snapshot?.id ?? 'unknown'}`);
      else setError(`${outcome.state}: ${outcome.reason ?? 'snapshot not confirmed'}${outcome.retryAt ? `; retry at ${outcome.retryAt}` : ''}`);
      await refresh();
    } catch (cause) { setError(message(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  const card = cardId ? connection.askCards?.get(cardId) : undefined;
  const signin = async () => {
    if (!connection.live || !connection.command || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await started(await connection.command<{ name: string; card: string }>({ type: 'login.signin', name: login.name })); }
    catch (cause) { setError(message(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  return <li data-login-name={login.name} data-signed-out={login.state === 'signed-out'} className={s.row}>
    <span title="Login name">{login.name}</span><span title="Harness">{login.harness}</span>
    <span title="Account">{login.account}</span><span title="Login kind">{login.kind}</span>
    <span title="Login state">{login.state}</span>
    <span title="Bound hosts">hosts: {login.bindings.map(binding => binding.host).join(', ') || 'none'}</span>
    <span title="Last sign-in">last sign-in: {login.lastSignIn ?? 'none'}</span>
    {login.signedOut && <span>{login.signedOut.reason}</span>}
    {login.kind === 'disk' && login.state === 'signed-out' && <button disabled={!connection.live || pending} onClick={() => void signin()}>Sign in again</button>}
    {cardId && card && <SignInCard key={cardId} id={cardId} card={card} connection={connection} />}
    {removable && (confirm ? <div role="group" aria-label={`Confirm Remove ${login.name}`} className={s.row}>
      <span>Remove {login.name}? {login.kind === 'disk' ? 'Its volume and snapshots are deleted.' : 'Its key file is deleted.'}</span>
      <button disabled={!connection.live || pending} onClick={() => { void remove(); }}>Confirm</button>
      <button disabled={pending} onClick={() => setConfirm(false)}>Cancel</button>
    </div> : <button disabled={!connection.live || pending} onClick={() => setConfirm(true)}>Remove</button>)}
    {login.kind === 'disk' && <button disabled={!connection.live || pending} onClick={() => { void snapshot(); }}>Snapshot</button>}
    {result && <span role="status">{result}</span>}
    {error && <span role="alert" className={s.error}>{error}</span>}
  </li>;
}

export function HostsView({ connection, pools }: { connection: ConnectionState; pools: readonly HostsStatePool[] }) {
  const [now, setNow] = useState(Date.now);
  const [logins, setLogins] = useState<Login[] | null>(null);
  const [error, setError] = useState('');
  const { command, live } = connection;
  const [cards, setCards] = useState(readSignInCards);
  const cardsRef = useRef(cards);
  const refresh = async () => { if (command) setLogins(await command<Login[]>({ type: 'login.list' })); };
  const started = async (value: { name: string; card: string }) => {
    const next = { ...cardsRef.current, [value.name]: value.card };
    cardsRef.current = next; writeSignInCards(next); setCards(next); await refresh();
  };
  useEffect(() => {
    const next = Object.fromEntries(Object.entries(cards).filter(([, id]) => {
      const card = connection.askCards?.get(id);
      return !card || card.state === 'open';
    }));
    if (Object.keys(next).length !== Object.keys(cards).length) { cardsRef.current = next; writeSignInCards(next); setCards(next); }
  }, [cards, connection.askCards]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let current = true;
    if (live && command) {
      void command<Login[]>({ type: 'login.list' }).then(rows => {
        if (current) { setLogins(rows); setError(''); }
      }, cause => { if (current) setError(message(cause)); });
    }
    return () => { current = false; };
  }, [pools, live, command, connection.signInCards]);
  return <div>
    {pools.map(pool => <section key={pool.name} aria-label={`Hosts in ${pool.name}`}>
      <h3 className={s.heading}>{pool.name}</h3>
      <AddLogin pool={pool.name} connection={connection} started={started} harnesses={[...new Set([
        ...(connection.roles?.roles.filter(role => role.launch.pool === pool.name).map(role => role.launch.harness) ?? []),
        ...(logins ?? []).filter(login => login.kind === 'key' || (login.provider === pool.provider && login.region === pool.region)).map(login => login.harness),
      ])].filter(isHarness)} />
      <ul className={s.rows}>{pool.hosts.map(host => <HostRow key={host.id} host={host} connection={connection} now={now} />)}</ul>
    </section>)}
    <h3 className={s.heading}>Logins</h3>
    {error && <span role="alert" className={s.error}>{error}</span>}
    {logins === null ? <span>Loading logins</span> : logins.length === 0 ? <span>No logins</span> : <ul className={s.rows}>
      {logins.map(login => <LoginRow key={login.name} login={login} connection={connection} refresh={refresh} started={started} cardId={signInCardId(connection, login.name) ?? cards[login.name]} />)}
    </ul>}
  </div>;
}
