import type { SessionRow } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import s from './Sessions.module.css';

export function SessionCapabilities({ row, connection }: { row: SessionRow; connection: ConnectionState }) {
  const caps = row.harness ? connection.adapters?.[row.harness] : undefined;
  if (!caps) return <p>{row.harness ? `No capability table from the ${row.harness} adapter` : `No adapter for ${row.name}`}</p>;
  const rows = [
    ...(['busy', 'idle', 'waiting for approval', 'waiting for human'] as const).map(state => [state, caps.states[state]]),
    ['unknown', 'always'], ['History', caps.history], ['Usage', caps.usage], ['Model change', caps.setModel],
    ['Approval relay', caps.approvalRelay], ['Terminal', caps.terminal],
  ];
  return <table className={s.capabilities} aria-label={`${row.name} capabilities`}>
    <tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td title={value === 'heuristic' ? 'Derived, may be wrong' : value === 'none' ? 'Never emulated' : undefined}>{value}</td></tr>)}</tbody>
  </table>;
}
