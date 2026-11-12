import { HostsView } from './HostsView.tsx';
import type { AreaContentProps } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import s from './HostsLine.module.css';

export function HostsLine({ connection }: AreaContentProps) {
  const pools = connection.hosts ?? [];
  if (!pools.length) return null;
  return <div className={s.block} data-session-slot="hosts">
    <div className={s.summaries}>{pools.map(pool => <div key={pool.name} className={s.row} data-host-pool={pool.name} data-error={!!pool.alert}>
      <span title="Pool name and current hosts / configured maximum hosts">{pool.name} {pool.hostCount}/{pool.maxHosts} hosts</span>
      <span title="Used and reserved slots / slots on current hosts"> · {pool.slotsUsed}/{pool.slotsTotal} slots</span>
      <span title="Logins in use / usable logins in this pool's provider and region; claude means Claude Code"> · logins {Object.entries(pool.logins).map(([harness, login]) => `${harness === 'claude-code' ? 'claude' : harness} ${login.inUse}/${login.usable}${login.signedOut ? ` (${login.signedOut} signed out)` : ''}`).join(', ') || 'none'}</span>
      {pool.alert && <span title="Current tunnel outage or provider failure">{pool.alert.kind === 'outage' ? `${pool.alert.host} unreachable` : pool.alert.reason}</span>}
    </div>)}</div>
    <Fold area="sessions" id="hosts" label="Hosts" count={pools.reduce((sum, pool) => sum + pool.hostCount, 0)}>
      {open => open ? <HostsView connection={connection} pools={pools} /> : null}
    </Fold>
  </div>;
}
