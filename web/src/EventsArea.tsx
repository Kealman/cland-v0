import { Fragment, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { AreaContentProps, AreaModule } from './AreaSlot.tsx';
import { ComposerPicker } from './ComposerPicker.ts';
import type { EventRow } from '../../shared/wire/index.ts';
import { ItemNavigation } from './ItemText.tsx';
import { Fold } from './Fold.tsx';
import { EVENT_KINDS } from '../../shared/wire/index.ts';
import { usePhone } from './phone.ts';
import s from './EventsArea.module.css';

const eventKinds = EVENT_KINDS;

function EventsArea({ connection, controls, openSubject }: AreaContentProps) {
  const phone = usePhone();
  const picker = useContext(ComposerPicker);
  const items = useContext(ItemNavigation);
  const open = (row: NonNullable<typeof connection.eventsView>['rows'][number]) => {
    if (row.subject.kind === 'item') items.open(row.subject.id);
    else openSubject?.(row.subject);
  };
  const root = useRef<HTMLDivElement>(null);
  const focused = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    let id = focused.current;
    const seen = new Set<string>();
    while (id && connection.eventsAliases?.has(id) && !seen.has(id)) { seen.add(id); id = connection.eventsAliases.get(id); }
    if (id && id !== focused.current) {
      focused.current = id;
      if (document.activeElement === document.body) root.current?.querySelector<HTMLButtonElement>(`[data-event-id="${CSS.escape(id)}"]`)?.focus();
    }
  }, [connection.eventsAliases]);
  const chooseSubject = () => picker({ kind: 'Subjects', choose: row => {
    const kind = ({ Items: 'item', Sessions: 'session', Topics: 'topic', Artifacts: 'artifact' } as const)[row.area as 'Items' | 'Sessions' | 'Topics' | 'Artifacts'];
    if (kind) connection.setEventsFilter?.({ ...connection.eventsFilter, subject: { kind, id: row.id } });
  } });
  const activate = connection.activateEvents;
  useEffect(() => { activate?.(true); return () => activate?.(false); }, [activate]);
  useImperativeHandle(controls, () => ({ run(action) {
    if (action === 'events-older') { void connection.loadEvents?.(true); return true; }
    if (action === 'events-fold') {
      const toggle = document.activeElement?.closest('[data-fold-block]')?.querySelector<HTMLButtonElement>('[data-fold-toggle]');
      if (toggle && root.current?.contains(toggle)) { toggle.focus(); toggle.click(); }
      return true;
    }
    if (action === 'events-open') {
      const id = document.activeElement?.getAttribute('data-event-id');
      const row = connection.eventsView?.rows.find(row => row.id === id);
      if (row) open(row);
      else if (document.activeElement instanceof HTMLButtonElement) document.activeElement.click();
      return true;
    }
    if (action === 'events-next' || action === 'events-previous') {
      const rows = [...root.current?.querySelectorAll<HTMLButtonElement>('[data-event-id], [data-fold-toggle]') ?? []].filter(node => node.checkVisibility());
      const index = rows.indexOf(document.activeElement as HTMLButtonElement);
      rows[Math.max(0, Math.min(rows.length - 1, index + (action === 'events-next' ? 1 : -1)))]?.focus();
      return true;
    }
    if (action === 'events-subject') { chooseSubject(); return true; }
    const filter = connection.eventsFilter ?? {};
    if (action === 'events-warnings') connection.setEventsFilter?.({ ...filter, warnings: !filter.warnings });
    else if (action === 'events-clear') connection.setEventsFilter?.({});
    else if (action === 'events-all') { const { kinds: _kinds, ...rest } = filter; connection.setEventsFilter?.(rest); }
    else if (action.startsWith('events-kind-')) connection.setEventsFilter?.({ ...filter, kinds: [eventKinds[Number(action.slice('events-kind-'.length)) - 1]!] });
    else return false;
    return true;
  } }));
  const page = connection.eventsView;
  const days = new Map<string, EventRow[]>();
  for (const row of page?.rows ?? []) {
    const date = new Date(row.ts);
    const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const rows = days.get(day) ?? []; rows.push(row); days.set(day, rows);
  }
  const look = connection.eventsVisitLook;
  const boundary = look ? page?.rows.find(row => Date.parse(row.ts) <= Date.parse(look))?.id : undefined;
  const lastLook = look && <p className={s.lastLook} data-events-last-look={look}>── △ Your last look · <time dateTime={look}>{new Date(look).toLocaleString('en-GB')}</time> · {page?.rows.filter(row => Date.parse(row.ts) > Date.parse(look)).length ?? 0} new above</p>;
  return <div ref={root} data-area-module="Events" data-area-surface="pane" className={s.events} data-key-context="events">
    <p data-events-filter>kind: {connection.eventsFilter?.kinds?.join(', ') || 'all'} · {connection.eventsFilter?.warnings ? 'warnings only' : 'all levels'} · subject: {connection.eventsFilter?.subject?.id ?? 'any'}</p>
    {phone && <div role="group" aria-label="Events filters" className={s.filters}>
      <button aria-pressed={!connection.eventsFilter?.kinds?.length} onClick={() => {
        const { kinds: _kinds, ...rest } = connection.eventsFilter ?? {};
        connection.setEventsFilter?.(rest);
      }}>All kinds</button>
      {eventKinds.map(kind => <button key={kind} aria-pressed={connection.eventsFilter?.kinds?.includes(kind) ?? false} onClick={() => connection.setEventsFilter?.({ ...connection.eventsFilter, kinds: [kind] })}>{kind}</button>)}
      <button aria-pressed={connection.eventsFilter?.warnings ?? false} onClick={() => connection.setEventsFilter?.({ ...connection.eventsFilter, warnings: !connection.eventsFilter?.warnings })}>Warnings</button>
      <button aria-pressed={!!connection.eventsFilter?.subject} onClick={chooseSubject}>Subject</button>
      <button onClick={() => connection.setEventsFilter?.({})}>Clear filters</button>
    </div>}
    {connection.eventsLoading && <span data-events-loading role="status">Loading events…</span>}
    <div role="list" aria-label="Events objects">
      {[...days].map(([day, rows]) => <Fold key={day} area="events" id={`day:${day}`} label={new Date(rows[0]!.ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + (new Date(rows[0]!.ts).toDateString() === new Date().toDateString() ? ' · today' : '')} count={rows.length}>
        {rows.map(row => <Fragment key={row.id}>{row.id === boundary && lastLook}<button title={row.text} className={s.row} data-bookkeeping={row.bookkeeping === true} data-event-warning={row.warning === true} data-event-new={!!connection.eventsVisitLook && Date.parse(row.ts) > Date.parse(connection.eventsVisitLook)} onClick={() => open(row)} onFocus={() => { focused.current = row.id; }} onBlur={event => { if (event.relatedTarget) focused.current = undefined; }} data-event-id={row.id} data-object-id={row.id}>
          <time dateTime={row.ts}>{new Date(row.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
          <span>{row.glyph}</span><span>{row.kind}</span><span data-event-subject={row.subject.id}>{row.subject.id}</span><span>{row.text}{(row.count ?? 1) > 1 ? ` · ×${row.count}` : ''}</span>
        </button></Fragment>)}
      </Fold>)}
    </div>
    {!boundary && lastLook}
    {page?.rows.length === 0 && <p className={s.empty}>No events</p>}
    {connection.eventsError && <p role="alert">{connection.eventsError}</p>}
    <footer>{page?.rows.length ?? 0} events {page?.more && <button disabled={!connection.live || connection.eventsLoading} onClick={() => void connection.loadEvents?.(true)}>A · 200 older events</button>}</footer>
  </div>;
}
export const eventsModule: AreaModule = { context: 'events', handledActions: ['events-subject', 'events-open', 'events-next', 'events-previous', 'events-fold', 'events-leader', 'events-older', 'events-warnings', 'events-clear', 'events-all', ...eventKinds.map((_, i) => `events-kind-${i + 1}` as const)], Pane: EventsArea, Page: EventsArea, Drawer: () => null };
