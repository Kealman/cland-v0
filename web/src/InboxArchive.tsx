import { useEffect, useId, useState } from 'react';
import type { Inbox, InboxDeparture } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import { sourceLabel } from './provenance.ts';
import { useInboxVisit } from './inbox-visit.tsx';
import s from './InboxArea.module.css';

function outcomeText(row: InboxDeparture) {
  const outcome = row.outcome;
  if (!outcome) return '';
  if ('status' in outcome) return `${outcome.status === 'declined' ? outcome.reason : `${outcome.option ? `${outcome.option} ` : ''}${outcome.text}`} · ${outcome.by}${outcome.via ? ` · ${sourceLabel(outcome.via)}` : ''}`;
  return `${outcome.choice} · ${outcome.by} · ${sourceLabel(outcome.via)}`;
}

export function InboxArchive({ connection, now }: { connection: ConnectionState; now: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<InboxDeparture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const visit = useInboxVisit();
  const id = useId();
  const { live, command, inbox } = connection;
  useEffect(() => {
    if (!open || !live || !command) { setLoading(false); return; }
    let current = true;
    setLoading(true); setError('');
    void command<Inbox>({ type: 'inbox.list', archive: true }).then(value => {
      if (current) { setRows(value.archive ?? []); setLoading(false); }
    }, error => { if (current) { setError(error instanceof Error ? error.message : 'Archive unavailable'); setLoading(false); } });
    return () => { current = false; };
    // Each replacement refreshes the visible archive, without replacing live rows/counts.
  }, [open, live, command, inbox, retry]);
  const archive = [...new Map([...rows, ...visit.departures.values()].map(row => [`${row.kind}:${row.id}`, row])).values()]
    .filter(row => Date.parse(row.ts) >= now - 7 * 86_400_000).sort((a, b) => b.ts.localeCompare(a.ts));
  return <>
    <button className={s.archiveToggle} data-inbox-archive-toggle aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} title="Departures in the last seven days (A)">
      {open ? '▾' : '▸'} Archive · {connection.inbox?.archiveToday ?? '—'} today
    </button>
    {open && <div id={id} role="list" aria-label="Inbox archive" className={s.archive}>
      {loading && <span role="status">Loading</span>}
      {error && <button title={error} onClick={() => setRetry(value => value + 1)}>Retry archive</button>}
      {archive.map(row => <div role="listitem" key={`${row.kind}:${row.id}`} data-inbox-archive-id={row.id} title={row.since}>
        <div><span>{row.kind} · {row.subject}</span><span> · {row.text}</span></div>
        <div><time dateTime={row.ts}>{new Date(row.ts).toLocaleString()}</time><span> · {row.reason}</span>{row.outcome && <span> · {outcomeText(row)}</span>}</div>
      </div>)}
      {!archive.length && !loading && !error && <span>0 departures · 7 days</span>}
    </div>}
  </>;
}
