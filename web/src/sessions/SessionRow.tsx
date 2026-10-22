import type { SessionRow as Row } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import type { Ref } from 'react';
import type { AreaControls } from '../AreaSlot.tsx';
import { SessionActions } from './SessionActions.tsx';
import s from './Sessions.module.css';

function sessionAge(since: string | null | undefined, now: number): string {
  if (!since || !Number.isFinite(Date.parse(since))) return '—';
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h` : `${Math.floor(seconds / 86400)}d`;
}
function usage(row: Row) {
  const total = row.usage?.total;
  if (!total) return '—';
  if (total.cost !== undefined && total.cost > 0) return `$${total.cost.toFixed(2)}`;
  return total.totalTokens >= 1000 ? `${(total.totalTokens / 1000).toFixed(1)}k tok` : `${total.totalTokens} tok`;
}
const harnesses: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };

export function SessionRow({ row, selected, select, connection, now, controls, openPage }: {
  row: Row; selected: boolean; select: (id: string) => void; connection: ConnectionState; now: number;
  controls?: Ref<AreaControls> | undefined;
  openPage?: ((id: string) => void) | undefined;
}) {
  const state = !row.live ? (row.status === 'stopped' ? 'stopped' : 'died') : row.state;
  const glyph = !row.live ? (row.status === 'stopped' ? '×' : '✗') : row.state === 'busy' || row.state === 'waiting for human' ? '●'
    : row.state === 'idle' ? '○' : row.state === 'waiting for approval' ? '▲' : '?';
  const role = connection.roles?.roles.find(role => role.role === row.role)?.label ?? row.role ?? '—';
  const topics = row.state === 'waiting for human' ? connection.sessionAsks?.filter(ask => ask.from === row.name).map(ask => ask.topic) ?? [] : [];
  return <div className={s.session} data-state={state}>
    <button className={s.row} data-object-id={row.name} aria-pressed={selected}
      onPointerDown={event => { if (window.matchMedia('(max-width: 639px)').matches) event.preventDefault(); }}
      onFocus={() => select(row.name)} onClick={() => { select(row.name); if (window.matchMedia('(max-width: 639px)').matches) openPage?.(row.name); }}>
      <span className={s.glyph} aria-label={state}>{glyph}</span>
      <span className={s.name}>{row.name}</span>
      <span className={s.role} data-session-role={row.role ?? 'other'}>{role}</span>
      <span className={s.meta} title={[row.harness, row.model, row.account].filter(Boolean).join(' · ')}>
        <span>{row.harness ? harnesses[row.harness] ?? row.harness : '—'}</span>
        <span>{row.model ?? '—'}</span><span>{row.account ?? '—'}</span>
      </span>
      <span className={s.item} data-item-requested={row.itemRequested} title={row.holds.map(hold => `${hold.item} ${hold.role}`).join(', ')}>
        {row.item ?? 'free'}{row.itemKind && row.itemKind !== 'item' ? ` ${row.itemKind}` : ''}{row.additionalHolds > 0 ? ` +${row.additionalHolds}` : ''}
      </span>
      <span className={s.state}>{state} <span className={s.age} data-session-age>{sessionAge(row.live ? row.stateSince : row.stoppedAt, now)}</span></span>
      <span className={s.usage}>{usage(row)}</span>
    </button>
    {selected && <div className={s.detail} data-session-detail={row.name}>
      {row.approvalCommand && <code>{row.approvalCommand}</code>}
      {[...new Map(topics.map(topic => [topic.id, topic])).values()].map(topic => <span key={topic.id}>{topic.title}</span>)}
      {!row.approvalCommand && topics.length === 0 && <span>{state}</span>}
      <SessionActions row={row} connection={connection} controls={controls} />
    </div>}
  </div>;
}
