import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { useInboxVisit, liveInboxEntries, type InboxEntry as Entry } from './inbox-visit.tsx';
import type { AreaContentProps, AreaModule } from './AreaSlot.tsx';
import { Thread, type ThreadControls } from './Thread.tsx';
import { InboxArchive } from './InboxArchive.tsx';
import { ApprovalCard } from './ApprovalCard.tsx';
import { SessionRecentThread } from './SessionRecentThread.tsx';
import { AskCard } from './AskCard.tsx';
import { Fold, revealFold } from './Fold.tsx';
import { useEventSummary } from './use-event-summary.ts';
import s from './InboxArea.module.css';

export const inboxActions = ['inbox-archive', 'inbox-reply', 'thread-next', 'thread-previous', 'thread-back', 'thread-toggle', 'inbox-next', 'inbox-previous', 'inbox-open', 'inbox-remove', 'inbox-free', 'inbox-1', 'inbox-2', 'inbox-3', 'inbox-4', 'inbox-5', 'inbox-6', 'inbox-7', 'inbox-8', 'inbox-9'] as const;

function age(since: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (!Number.isFinite(minutes)) return '?';
  return minutes < 60 ? `${minutes} m` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ${minutes % 60} m` : `${Math.floor(minutes / 1440)} d ${Math.floor(minutes % 1440 / 60)} h`;
}
function facts(entry: Entry) {
  switch (entry.kind) {
    case 'ask': return { glyph: '?', subject: entry.row.topic.item ?? entry.row.topic.title, text: entry.row.question, sender: entry.row.from, role: entry.row.fromRole };
    case 'approval': return { glyph: '▲', subject: entry.row.session, text: entry.row.command ?? entry.row.subject.change ?? 'Waiting for approval', sender: entry.row.session, role: entry.row.role };
    case 'plan': return { glyph: '▲', subject: entry.row.id, text: entry.row.title, sender: '', role: undefined };
    case 'request': return { glyph: '◇', subject: entry.row.subject, text: entry.row.text, sender: entry.row.from, role: entry.row.fromRole };
    case 'message': return { glyph: '•', subject: entry.row.subject, text: entry.row.text, sender: entry.row.from, role: entry.row.fromRole };
  }
}

function InboxArea(props: AreaContentProps) {
  const thread = useRef<ThreadControls>(null);
  const detail = useRef<HTMLDivElement>(null);
  const [closed, setClosed] = useState<string>();
  const visit = useInboxVisit();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const list = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState('');
  const remove = async (entry: Entry) => {
    if (pending || !props.connection.live || !props.connection.command || (entry.kind !== 'request' && entry.kind !== 'message')) return;
    setPending(entry.row.id); setError('');
    try { await props.connection.command(entry.kind === 'request' ? { type: 'inbox.decline', request: entry.row.id } : { type: 'inbox.read', message: entry.row.id }); }
    catch (error) { setError(error instanceof Error ? error.message : 'Action failed'); }
    finally { setPending(undefined); }
  };
  const openEntry = (entry: Entry) => {
    if (entry.kind === 'plan') props.openPlan?.(entry.row.id);
    else if (entry.kind === 'approval') { if (entry.row.topic) props.openTopic?.(entry.row.topic); }
    else props.openTopic?.(entry.row.topic.id, entry.row.id);
  };
  const entries = [...visit.entries.values()];
  const liveIds = new Set(liveInboxEntries(props.connection).map(entry => entry.row.id));
  const sections: Array<{ id: string; name: string; rows: Entry[] }> = [
    { id: 'asks', name: 'Asks and approvals', rows: entries.filter(entry => entry.kind === 'ask' || entry.kind === 'approval') },
    { id: 'plans', name: 'Plan approvals', rows: entries.filter(entry => entry.kind === 'plan') },
    { id: 'requests', name: 'Requests', rows: entries.filter(entry => entry.kind === 'request') },
    { id: 'messages', name: 'Messages to you', rows: entries.filter(entry => entry.kind === 'message') },
  ];
  for (const section of sections) section.rows = section.rows.filter(({ row }) => !row.layer || row.layer === 'now').sort((a, b) => b.row.since.localeCompare(a.row.since));
  const selected = props.selected;
  const selectedSection = sections.find(section => section.rows.some(entry => entry.row.id === props.selected));
  const targetSection = selectedSection?.id;
  const targetOverflow = (selectedSection?.rows.findIndex(entry => entry.row.id === props.selected) ?? -1) >= 5;
  useLayoutEffect(() => {
    if (!props.selected || !targetSection) return;
    revealFold('inbox', targetSection);
    if (targetOverflow) setExpanded(previous => new Set(previous).add(targetSection));
  }, [props.selected, targetSection, targetOverflow]);
  const selectedEntry = sections.flatMap(section => section.rows).find(entry => entry.row.id === props.selected);
  useImperativeHandle(props.controls, () => ({ run: action => {
    if (action === 'inbox-archive') { list.current?.querySelector<HTMLButtonElement>('[data-inbox-archive-toggle]')?.click(); return true; }
    if (action.startsWith('thread-')) {
      if (action === 'thread-back') { list.current?.querySelector<HTMLButtonElement>(`[data-object-id="${CSS.escape(props.selected ?? '')}"]`)?.focus(); return true; }
      return thread.current?.run(action) ?? false;
    }
    if (action === 'inbox-reply') {
      if (selectedEntry?.kind !== 'message' && selectedEntry?.kind !== 'request') return true;
      setClosed(undefined);
      if (props.split) props.splitSelection?.();
      requestAnimationFrame(() => {
        const field = props.split
          ? document.querySelector<HTMLTextAreaElement>(`[data-area-module="Inbox"][data-area-surface="page"] [data-inbox-reply="${CSS.escape(selectedEntry.row.id)}"] textarea`)
          : detail.current?.querySelector<HTMLTextAreaElement>('textarea');
        field?.focus();
      });
      return true;
    }
    const targets = [...list.current?.querySelectorAll<HTMLElement>('[data-object-id], [data-fold-toggle], [data-inbox-more], [data-inbox-events], [data-inbox-archive-toggle], [data-inbox-outcome], [data-ask-state]:not([data-ask-state="open"]), [data-approval-outcome]') ?? []].filter(node => node.getClientRects().length);
    const focused = document.activeElement;
    const root = focused?.closest('[data-inbox-kind]');
    const id = root?.querySelector<HTMLElement>('[data-object-id]')?.dataset.objectId;
    const entry = sections.flatMap(section => section.rows).find(entry => entry.row.id === (id ?? selected));
    if (action === 'inbox-next' || action === 'inbox-previous') {
      const current = targets.findIndex(node => node === focused || node.dataset.objectId === id);
      const target = targets[Math.max(0, Math.min(targets.length - 1, current + (action === 'inbox-next' ? 1 : -1)))];
      target?.focus(); target?.scrollIntoView({ block: 'nearest' }); return true;
    }
    if (action === 'inbox-open') {
      if (focused?.matches('[data-inbox-events], [data-inbox-archive-toggle], [data-inbox-more], [data-fold-toggle]')) (focused as HTMLElement).click();
      else if (entry) openEntry(entry);
      return true;
    }
    if (!root) return false;
    if (entry && !liveIds.has(entry.row.id)) return true;
    const container = root;
    if (action === 'inbox-remove') {
      if (entry?.kind === 'ask') container?.querySelector<HTMLButtonElement>('[data-ask-decline]')?.click();
      else if (entry?.kind === 'approval') container?.querySelector<HTMLButtonElement>('[data-approval-deny]')?.click();
      else if (entry) void remove(entry);
      return true;
    }
    if (action === 'inbox-free') { container?.querySelector<HTMLInputElement>('input')?.focus(); return true; }
    if (/^inbox-[1-9]$/.test(action)) {
      const option = action.slice(-1);
      if (entry?.kind === 'ask') container?.querySelector<HTMLButtonElement>(`[data-ask-option="${option}"]`)?.click();
      else if (entry?.kind === 'approval') container?.querySelector<HTMLButtonElement>(`[data-approval-choice="${option === '1' ? 'once' : option === '2' ? 'always' : ''}"]`)?.click();
      return true;
    }
    return false;
  } }));
  const { summary, error: eventError } = useEventSummary(props.connection);
  return <section className={s.area} data-area-module="Inbox" data-area-surface="pane" data-key-context="inbox" data-inbox-pending={pending}>
    <div ref={list} role="list" aria-label="Inbox objects" className={s.rows}>
      {error && <div role="alert">{error}</div>}
      {sections.map(section => <div key={section.id} data-inbox-section={section.id} data-empty={!section.rows.length} data-inbox-empty={!section.rows.length ? true : undefined}>
        <Fold area="inbox" id={section.id} label={section.name} count={section.rows.filter(entry => liveIds.has(entry.row.id) && (entry.kind === 'ask' ? (props.connection.askCards?.get(entry.row.id)?.state ?? 'open') === 'open' : entry.kind !== 'approval' || entry.row.state !== 'closed')).length}>
          {section.rows.slice(0, expanded.has(section.id) ? undefined : 5).map(entry => {
            const { row, kind } = entry, info = facts(entry);
            const departure = visit.departures.get(row.id);
            const left = !liveIds.has(row.id);
            const folded = left && kind !== 'ask' && kind !== 'approval';
            const card = kind === 'ask' ? props.connection.askCards?.get(row.id) ?? { question: entry.row.question, options: entry.row.options, free: entry.row.free, state: 'open' as const } : undefined;
            const showCard = card && (selected === row.id || card.state !== 'open');
            return <div key={row.id} role="listitem" className={s.entry} data-inbox-kind={kind} data-key-context={kind === 'ask' || kind === 'approval' ? 'inbox-answer' : 'inbox'} data-ask-id={kind === 'ask' && !showCard ? row.id : undefined} data-ask-state={kind === 'ask' && !showCard ? card?.state : undefined} onFocus={() => { if (props.selected !== row.id) setClosed(undefined); props.select(row.id); }}>
              <button hidden={folded || (card ? card.state !== 'open' : kind === 'approval' && entry.row.state === 'closed')} className={s.row} data-object-id={row.id} aria-pressed={selected === row.id} onClick={() => { setClosed(undefined); props.select(row.id); }} title={info.text}>
                <span className={s.glyph}>{info.glyph}</span><span className={s.subject}>{info.subject}</span><span className={s.preview}>{info.text.split(/\r?\n/)[0]}</span>
                <span className={s.sender} data-role={info.role}>{info.sender}</span><time dateTime={row.since} title={row.since}>{age(row.since, now)}</time>
              </button>
              {folded && <div tabIndex={0} className={s.outcome} data-inbox-outcome title={info.text}>✓ {info.subject} · {departure?.reason ?? 'left Inbox'}{departure && <time dateTime={departure.ts}> · {new Date(departure.ts).toLocaleString()}</time>}</div>}
              {entry.kind === 'ask' && showCard && <AskCard id={row.id} topic={entry.row.topic.id} card={card} context="inbox-answer" connection={props.connection} />}
              {kind === 'approval' && (selected === row.id || entry.row.state === 'closed') && <ApprovalCard record={entry.row} connection={props.connection} />}
              {!folded && selected === row.id && (kind === 'request' || kind === 'message') && <div className={s.detail}><div>{info.text}</div><div className={s.actions}>
                <button data-inbox-open onClick={() => openEntry(entry)}>Enter · Open topic</button>
                <button disabled={!props.connection.live || !!pending} onClick={() => void remove(entry)}>{kind === 'request' ? 'd · Decline' : 'd · Mark read'}</button>
              </div></div>}
              {!folded && selected === row.id && kind === 'plan' && <div className={s.detail}>{entry.row.stages ?? '—'} stages · {entry.row.lanes ?? '—'} lanes · {entry.row.items ?? '—'} items<div className={s.actions}><button onClick={() => openEntry(entry)}>Enter · Open Plan</button></div></div>}
            </div>;
          })}
          {section.rows.length > 5 && <button className={s.more} data-inbox-more aria-expanded={expanded.has(section.id)} onClick={() => setExpanded(previous => { const next = new Set(previous); if (!next.delete(section.id)) next.add(section.id); return next; })}>
            {expanded.has(section.id) ? '▾' : '▸'} {section.rows.length - 5} more · oldest {age(section.rows.at(-1)!.row.since, now)}
          </button>}
        </Fold>
      </div>)}
      <button className={s.events} data-inbox-events title={eventError || "Events newer than the human’s shared last look"} onClick={() => props.navigate?.('Events')}>△ {summary?.events ?? '—'} new events · ⚠ {summary?.warnings ?? '—'}</button>
      <InboxArchive connection={props.connection} now={now} />
    </div>
    {!props.split && selectedEntry && closed !== selectedEntry.row.id && selectedEntry.kind !== 'plan' && <aside className={s.drawer} aria-label="Drawer" data-drawer-area="Inbox">
      <div className={s.actions}><button onClick={props.splitSelection}>Split</button><button onClick={() => { setClosed(selectedEntry.row.id); list.current?.querySelector<HTMLButtonElement>(`[data-object-id="${CSS.escape(selectedEntry.row.id)}"]`)?.focus(); }}>Close</button></div>
      <div className={s.thread} ref={detail} data-area-module="Inbox" data-area-surface="drawer" data-key-context="inbox"><InboxThread {...props} entry={selectedEntry} thread={thread} /></div>
    </aside>}
  </section>;
}

function InboxThread({ entry, thread, ...props }: AreaContentProps & { entry: Entry; thread?: Ref<ThreadControls> }) {
  const approval = entry.kind === 'approval' ? props.connection.approvalCards?.get(entry.row.id) ?? entry.row : undefined;
  if (approval) return <><ApprovalCard key={approval.id} record={approval} connection={props.connection} /><SessionRecentThread key={approval.id} session={approval.session} connection={props.connection} /></>;
  const topic = entry.kind === 'plan' || entry.kind === 'approval' ? undefined : entry.row.topic.id;
  if (!topic) return null;
  return <Thread key={topic} connection={props.connection} topic={topic} focusTarget={false} targetMessage={entry.kind === 'approval' ? undefined : entry.row.id}
    controls={thread} reply={entry.kind === 'message' || entry.kind === 'request' ? { id: entry.row.id, sender: entry.row.from } : undefined} />;
}
function InboxDetail(props: AreaContentProps) {
  const node = useRef<HTMLElement>(null);
  const current = useInboxVisit().entries.get(props.selected ?? '');
  const viewed = useRef<Entry | undefined>(undefined);
  if (current) viewed.current = current;
  const entry = viewed.current?.row.id === props.selected ? viewed.current : undefined;
  const thread = useRef<ThreadControls>(null);
  useImperativeHandle(props.controls, () => ({ run: action => {
    if (action === 'inbox-reply') { node.current?.querySelector<HTMLTextAreaElement>('[data-composer] textarea')?.focus(); return true; }
    if (action === 'thread-back') { props.closePage?.(); return true; }
    return thread.current?.run(action) ?? false;
  } }));
  return <section ref={node} className={s.thread} data-area-module="Inbox" data-area-surface="page" data-key-context="thread">{entry && <InboxThread {...props} entry={entry} thread={thread} />}</section>;
}

export const inboxModule: AreaModule = { context: 'inbox', handledActions: inboxActions, Pane: InboxArea, Page: InboxDetail, Drawer: InboxDetail };
