import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { InboxAsk, InboxApproval, InboxPlan, InboxRequest, InboxMessage } from '../../shared/wire/index.ts';
import type { AreaContentProps, AreaModule } from './AreaSlot.tsx';
import { AreaObjectDetail } from './AreaObjects.tsx';
import { ApprovalCard } from './ApprovalCard.tsx';
import { AskCard } from './AskCard.tsx';
import { Fold, revealFold } from './Fold.tsx';
import { useEventSummary } from './use-event-summary.ts';
import s from './InboxArea.module.css';

export const inboxActions = ['inbox-next', 'inbox-previous', 'inbox-open', 'inbox-remove', 'inbox-free', 'inbox-1', 'inbox-2', 'inbox-3', 'inbox-4', 'inbox-5', 'inbox-6', 'inbox-7', 'inbox-8', 'inbox-9'] as const;

type Entry = { kind: 'ask'; row: InboxAsk } | { kind: 'approval'; row: InboxApproval } | { kind: 'plan'; row: InboxPlan } | { kind: 'request'; row: InboxRequest } | { kind: 'message'; row: InboxMessage };
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
  const retained = useRef(new Map<string, InboxAsk>());
  for (const row of props.connection.sessionAsks ?? []) retained.current.set(row.id, row);
  const retainedApprovals = useRef(new Map<string, InboxApproval>());
  for (const row of props.connection.inbox?.approvals ?? []) retainedApprovals.current.set(row.id, row);
  for (const [id] of retainedApprovals.current) {
    const latest = props.connection.approvalCards?.get(id);
    if (latest) retainedApprovals.current.set(id, latest);
  }
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
  const inbox = props.connection.inbox;
  const sections: Array<{ id: string; name: string; rows: Entry[] }> = [
    { id: 'asks', name: 'Asks and approvals', rows: [...retained.current.values()].map(row => ({ kind: 'ask', row })) },
    { id: 'plans', name: 'Plan approvals', rows: (inbox?.plans ?? []).map(row => ({ kind: 'plan', row })) },
    { id: 'requests', name: 'Requests', rows: (inbox?.requests ?? []).map(row => ({ kind: 'request', row })) },
    { id: 'messages', name: 'Messages to you', rows: (inbox?.messages ?? []).map(row => ({ kind: 'message', row })) },
  ];
  sections[0]!.rows.push(...[...retainedApprovals.current.values()].map(row => ({ kind: 'approval' as const, row })));
  for (const section of sections) section.rows = section.rows.filter(({ row }) => !row.layer || row.layer === 'now').sort((a, b) => b.row.since.localeCompare(a.row.since));
  const selected = props.selected ?? sections.flatMap(section => section.rows)[0]?.row.id;
  const selectedSection = sections.find(section => section.rows.some(entry => entry.row.id === props.selected));
  const targetSection = selectedSection?.id;
  const targetOverflow = (selectedSection?.rows.findIndex(entry => entry.row.id === props.selected) ?? -1) >= 5;
  useLayoutEffect(() => {
    if (!props.selected || !targetSection) return;
    revealFold('inbox', targetSection);
    if (targetOverflow) setExpanded(previous => new Set(previous).add(targetSection));
  }, [props.selected, targetSection, targetOverflow]);
  useImperativeHandle(props.controls, () => ({ run: action => {
    const targets = [...list.current?.querySelectorAll<HTMLElement>('[data-object-id], [data-fold-toggle], [data-inbox-more], [data-inbox-events], [data-ask-state]:not([data-ask-state="open"]), [data-approval-outcome]') ?? []].filter(node => node.getClientRects().length);
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
      if (focused?.matches('[data-inbox-events], [data-inbox-more], [data-fold-toggle]')) (focused as HTMLElement).click();
      else if (entry) openEntry(entry);
      return true;
    }
    if (!root) return false;
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
  return <section data-area-module="Inbox" data-area-surface="pane" data-key-context="inbox" data-inbox-pending={pending}>
    <div ref={list} role="list" aria-label="Inbox objects" className={s.rows}>
      {error && <div role="alert">{error}</div>}
      {sections.map(section => <div key={section.id} data-inbox-section={section.id} data-empty={!section.rows.length} data-inbox-empty={!section.rows.length ? true : undefined}>
        <Fold area="inbox" id={section.id} label={section.name} count={section.rows.filter(entry => entry.kind === 'ask' ? (props.connection.askCards?.get(entry.row.id)?.state ?? 'open') === 'open' : entry.kind !== 'approval' || entry.row.state !== 'closed').length}>
          {section.rows.slice(0, expanded.has(section.id) ? undefined : 5).map(entry => {
            const { row, kind } = entry, info = facts(entry);
            const card = kind === 'ask' ? props.connection.askCards?.get(row.id) ?? { question: entry.row.question, options: entry.row.options, free: entry.row.free, state: 'open' as const } : undefined;
            const showCard = card && (selected === row.id || card.state !== 'open');
            return <div key={row.id} role="listitem" className={s.entry} data-inbox-kind={kind} data-key-context={kind === 'ask' || kind === 'approval' ? 'inbox-answer' : 'inbox'} data-ask-id={kind === 'ask' && !showCard ? row.id : undefined} data-ask-state={kind === 'ask' && !showCard ? card?.state : undefined} onFocus={() => props.select(row.id)}>
              <button hidden={card ? card.state !== 'open' : kind === 'approval' && entry.row.state === 'closed'} className={s.row} data-object-id={row.id} aria-pressed={selected === row.id} onClick={() => props.select(row.id)} title={info.text}>
                <span className={s.glyph}>{info.glyph}</span><span className={s.subject}>{info.subject}</span><span className={s.preview}>{info.text.split(/\r?\n/)[0]}</span>
                <span className={s.sender} data-role={info.role}>{info.sender}</span><time dateTime={row.since} title={row.since}>{age(row.since, now)}</time>
              </button>
              {entry.kind === 'ask' && showCard && <AskCard id={row.id} topic={entry.row.topic.id} card={card} context="inbox-answer" connection={props.connection} />}
              {kind === 'approval' && (selected === row.id || entry.row.state === 'closed') && <ApprovalCard record={entry.row} connection={props.connection} />}
              {selected === row.id && (kind === 'request' || kind === 'message') && <div className={s.detail}><div>{info.text}</div><div className={s.actions}>
                <button data-inbox-open onClick={() => openEntry(entry)}>Enter · Open topic</button>
                <button disabled={!props.connection.live || !!pending} onClick={() => void remove(entry)}>{kind === 'request' ? 'd · Decline' : 'd · Mark read'}</button>
              </div></div>}
              {selected === row.id && kind === 'plan' && <div className={s.detail}>{entry.row.stages ?? '—'} stages · {entry.row.lanes ?? '—'} lanes · {entry.row.items ?? '—'} items<div className={s.actions}><button onClick={() => openEntry(entry)}>Enter · Open Plan</button></div></div>}
            </div>;
          })}
          {section.rows.length > 5 && <button className={s.more} data-inbox-more aria-expanded={expanded.has(section.id)} onClick={() => setExpanded(previous => { const next = new Set(previous); if (!next.delete(section.id)) next.add(section.id); return next; })}>
            {expanded.has(section.id) ? '▾' : '▸'} {section.rows.length - 5} more · oldest {age(section.rows.at(-1)!.row.since, now)}
          </button>}
        </Fold>
      </div>)}
      <button className={s.events} data-inbox-events title={eventError || "Events newer than the human’s shared last look"} onClick={() => props.navigate?.('Events')}>△ {summary?.events ?? '—'} new events · ⚠ {summary?.warnings ?? '—'}</button>
    </div>
  </section>;
}

export const inboxModule: AreaModule = { context: 'inbox', handledActions: inboxActions, Pane: InboxArea, Page: AreaObjectDetail, Drawer: AreaObjectDetail };
