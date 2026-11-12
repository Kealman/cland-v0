import { useEffect, useState } from 'react';
import type { AreaContentProps } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import s from './HostsLine.module.css';

function uptime(created: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(created)) / 1000));
  if (!Number.isFinite(seconds)) return 'unknown';
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
}
const money = (value: number | null) => value === null ? 'unknown' : `$${value.toFixed(2)}`;

export function HostsLine({ connection }: AreaContentProps) {
  const pools = connection.hosts ?? [];
  const [now, setNow] = useState(Date.now);
  const liveHosts = pools.some(pool => pool.hosts.length > 0);
  useEffect(() => {
    if (!liveHosts) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveHosts]);
  if (!pools.length) return null;
  return <div className={s.block} data-session-slot="hosts">
    <div className={s.summaries}>{pools.map(pool => <div key={pool.name} className={s.row} data-host-pool={pool.name} data-error={!!pool.alert}>
      <span title="Pool name and current hosts / configured maximum hosts">{pool.name} {pool.hostCount}/{pool.maxHosts} hosts</span>
      <span title="Used and reserved slots / slots on current hosts"> · {pool.slotsUsed}/{pool.slotsTotal} slots</span>
      <span title="Logins in use / usable logins in this pool's provider and region; claude means Claude Code"> · logins {Object.entries(pool.logins).map(([harness, login]) => `${harness === 'claude-code' ? 'claude' : harness} ${login.inUse}/${login.usable}${login.signedOut ? ` (${login.signedOut} signed out)` : ''}`).join(', ') || 'none'}</span>
      {pool.alert && <span title="Current tunnel outage or provider failure">{pool.alert.kind === 'outage' ? `${pool.alert.host} unreachable` : pool.alert.reason}</span>}
    </div>)}</div>
    <Fold area="sessions" id="hosts" label="Hosts" count={pools.reduce((sum, pool) => sum + pool.hostCount, 0)}>
      <ul className={s.rows}>{pools.flatMap(pool => pool.hosts.map(host => <li key={`${pool.name}/${host.id}`} data-host-id={host.id} className={s.row}>
        <span title="Host id">{host.id}</span>
        <span title="Provider machine size">{host.size}</span>
        <span title="Provider region">{host.region}</span>
        <span title="Time since the host was created">{uptime(host.created, now)}</span>
        <span title="Sessions running on this host">sessions {host.sessions.length}: {host.sessions.join(', ') || 'none'}</span>
        <span title="Last reported hourly price in USD">{money(host.priceHourly)}/h</span>
        <span title="Spend today in USD, as last pushed by the hub">{money(host.spendToday)} today</span>
      </li>))}</ul>
    </Fold>
  </div>;
}
