import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { AreaContentProps, AreaControls } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import { sessionGroups } from './state.ts';
import { SessionRow } from './SessionRow.tsx';

export function SessionGroups({ connection, selected, select, controls, archived, openPage, open }: AreaContentProps & { archived: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const actions = useRef<AreaControls>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const row = [...root.current?.querySelectorAll<HTMLElement>('[data-object-id]') ?? []].find(node => node.dataset.objectId === selected);
    const toggle = row?.closest('[data-fold-block]')?.querySelector<HTMLButtonElement>('[data-fold-toggle]');
    if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  useImperativeHandle(controls, () => ({ run(action) {
    const narrow = window.matchMedia('(max-width: 639px)').matches;
    if (!narrow && actions.current?.run(action)) return true;
    if (narrow && action === 'session-open' && selected) { openPage?.(selected); return true; }
    if (!narrow && action === 'session-open' && selected && document.activeElement?.hasAttribute('data-object-id')) { open?.(); return true; }
    if (action !== 'session-next' && action !== 'session-previous') return false;
    const rows = [...root.current?.querySelectorAll<HTMLButtonElement>('[data-object-id]') ?? []].filter(node => node.offsetParent !== null);
    const index = rows.findIndex(node => node.dataset.objectId === selected);
    const next = index < 0 ? (action === 'session-next' ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, index + (action === 'session-next' ? 1 : -1)));
    const target = rows[next];
    if (target) { select(target.dataset.objectId!); target.focus(); target.scrollIntoView({ block: 'nearest' }); }
    return true;
  } }));
  return <div ref={root} data-session-slot="groups" role="list" aria-label="Sessions objects">
    {sessionGroups(connection.sessions ?? []).map(group => <section key={group.name} aria-label={group.name}>
      <Fold area="sessions" id={group.name.toLowerCase()} label={group.name} count={group.rows.length}
        actions={group.name === 'Stopped' ? <span>{connection.archivedSessions ?? '—'} archived</span> : undefined}>
        {(group.name === 'Stopped' ? group.rows.slice(0, 20) : group.rows).map(row => <SessionRow key={row.key} row={row} selected={selected === row.name} select={select} connection={connection} now={now} controls={selected === row.name ? actions : undefined} openPage={openPage} openThread={open} />)}
      </Fold>
    </section>)}
    {archived && <section aria-label="Archived">
      <Fold area="sessions" id="archived" label="Archived" count={connection.archivedSessionRows?.length ?? '—'}>
        {connection.archivedSessionsError && <span role="alert">{connection.archivedSessionsError}</span>}
        {connection.archivedSessionRows?.map(row => <SessionRow key={row.key} row={row} selected={selected === row.name} select={select} connection={connection} now={now} controls={selected === row.name ? actions : undefined} openPage={openPage} openThread={open} />)}
      </Fold>
    </section>}
  </div>;
}
