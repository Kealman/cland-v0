import type { AreaContentProps } from '../AreaSlot.tsx';
import { SessionActions } from './SessionActions.tsx';
import s from './Sessions.module.css';

export function SessionPage({ connection, selected, controls }: AreaContentProps) {
  const row = [...connection.sessions ?? [], ...connection.archivedSessionRows ?? []].find(value => value.name === selected);
  const usage = row?.usage?.total;
  return <section className={s.page} data-area-module="Sessions" data-area-surface="page" data-key-context="sessions">
    {row ? <>
      <dl className={s.facts}>
        <dt>Session</dt><dd>{row.name}</dd>
        <dt>Role</dt><dd>{row.role ?? '—'}</dd>
        <dt>Harness</dt><dd>{row.harness ?? '—'}</dd>
        <dt>Model</dt><dd>{row.model ?? '—'}</dd>
        <dt>Account</dt><dd>{row.account ?? '—'}</dd>
        <dt>State</dt><dd>{row.live ? row.state : row.status}</dd>
        <dt>Usage</dt><dd>{usage ? `${usage.totalTokens} tok${usage.cost === undefined ? '' : ` · $${usage.cost.toFixed(2)}`}` : '—'}</dd>
      </dl>
      <SessionActions key={row.key} row={row} connection={connection} controls={controls} showCapabilities />
    </> : <p>Session unavailable</p>}
  </section>;
}
