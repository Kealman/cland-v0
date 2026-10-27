import type { AreaContentProps } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import s from './RemotesLine.module.css';

export function RemotesLine({ connection }: AreaContentProps) {
  const remotes = connection.remotes?.filter(remote => remote.enabled) ?? [];
  if (!remotes.length) return null;
  return <div className={s.block} data-session-slot="remotes">
    <Fold area="sessions" id="remotes" label="Remotes" count={remotes.length}>
      <ul className={s.rows}>{remotes.map(remote => <li key={remote.messenger} data-remote={remote.messenger}
        data-error={remote.connection === 'offline' || remote.connection === 'stopped'} className={s.row}>
        <span title="Messenger">{remote.messenger}</span>
        <span title="Connection state and the start of the current outage">{remote.connection}{remote.offlineSince ? ` since ${remote.offlineSince}` : ''}</span>
        <span title="Name of the human paired with this project">{remote.pairedName ? `paired ${remote.pairedName}` : 'unpaired'}</span>
        <span title="Mute silences General messages; asks, approvals and hub notices still arrive">{remote.mute ? 'muted' : 'unmuted'}</span>
        <span title="Number of queued, sending or uncertain outbox jobs">outbox {remote.outboxDepth}</span>
        {remote.lastError && <span title="Last redacted remote error">{remote.lastError}</span>}
      </li>)}</ul>
    </Fold>
  </div>;
}
