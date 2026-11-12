import { useEffect, useRef, useState } from 'react';
import type { HostsStatePool } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import s from './HostsView.module.css';

// Metadata returned by login.list; no credential fields enter this view.
type Login = { name: string; harness: string; account: string; kind: string; state: string;
  lastSignIn: string | null; bindings: Array<{ host: string }> };
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

export function HostsView({ connection, pools }: { connection: ConnectionState; pools: readonly HostsStatePool[] }) {
  const [now, setNow] = useState(Date.now);
  const [logins, setLogins] = useState<Login[] | null>(null);
  const [error, setError] = useState('');
  const { command, live } = connection;
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
  }, [pools, live, command]);
  return <div>
    {pools.map(pool => <section key={pool.name} aria-label={`Hosts in ${pool.name}`}>
      <h3 className={s.heading}>{pool.name}</h3>
      <ul className={s.rows}>{pool.hosts.map(host => <HostRow key={host.id} host={host} connection={connection} now={now} />)}</ul>
    </section>)}
    <h3 className={s.heading}>Logins</h3>
    {error && <span role="alert" className={s.error}>{error}</span>}
    {logins === null ? <span>Loading logins</span> : logins.length === 0 ? <span>No logins</span> : <ul className={s.rows}>
      {logins.map(login => <li key={login.name} data-login-name={login.name} data-signed-out={login.state === 'signed-out'} className={s.row}>
        <span title="Login name">{login.name}</span><span title="Harness">{login.harness}</span>
        <span title="Account">{login.account}</span><span title="Login kind">{login.kind}</span>
        <span title="Login state">{login.state}</span>
        <span title="Bound hosts">hosts: {login.bindings.map(binding => binding.host).join(', ') || 'none'}</span>
        <span title="Last sign-in">last sign-in: {login.lastSignIn ?? 'none'}</span>
      </li>)}
    </ul>}
  </div>;
}
