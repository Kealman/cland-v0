import { useEffect, useState } from 'react';
import type { ExplorerSummary } from '../../shared/wire/index.ts';
import { itemRows, type ConnectionState } from './connection.ts';
import s from './ItemCard.module.css';
import { ItemText } from './ItemText.tsx';
import { QuickMessage, type MessageTarget } from './QuickMessage.tsx';
import { numberOf } from './items-tree.ts';
import { ItemCriteria } from './ItemCriteria.tsx';

/** Snapshot facts remain independent from the body, fetched only on expansion. */
export function ItemCard({ item: row, connection, message }: { item: ExplorerSummary; connection: ConnectionState; message?: MessageTarget | undefined }) {
  const items = itemRows(connection);
  const item = { ...row, ...connection.cardFacts?.[row.id] };
  const [bodyOpen, setBodyOpen] = useState(false);
  const ownVerdict = item.verdicts.at(-1);
  const rolled = item.rollup?.latest_verdict;
  const owner = rolled ? items.find(value => value.id === rolled.item) : undefined;
  const matches = (value: ExplorerSummary['verdicts'][number]) => value.run === rolled?.run && value.verdict === rolled.verdict;
  const verdict = rolled ? { ...rolled, ...owner?.verdicts.find(matches), ...connection.cardFacts?.[rolled.item]?.verdicts?.find(matches) } : ownVerdict;
  const needsOwner = !!rolled && (verdict?.round === undefined || verdict.reason === undefined);
  useEffect(() => {
    if (row.state === 'closed') connection.loadCard?.(row.id);
    if (rolled && needsOwner) connection.loadCard?.(rolled.item);
    if (bodyOpen) connection.loadBody?.(row.id);
  }, [connection, row.id, row.state, needsOwner, rolled, bodyOpen]);
  const parent = items.find(value => value.id === item.parent);
  const siblings = (items.filter(value => value.parent === item.parent) ?? []).sort((a, b) => (a.rank ?? numberOf(a.id) * 10) - (b.rank ?? numberOf(b.id) * 10) || numberOf(a.id) - numberOf(b.id));
  const order = connection.siblingOrders?.[item.parent ?? '']
    ?? (connection.closedTasksLoaded?.(parent?.id ?? '') ? siblings.map(value => value.id) : undefined);
  const ordinal = order ? order.indexOf(item.id) + 1 : 0;
  const activity = item.rollup?.last_activity;
  const relations = (ids: string[]) => ids.length ? ids.map(id => {
    const target = items.find(value => value.id === id);
    return `${id}${target ? ` · ${target.derived_status ?? target.status ?? target.state} · ${target.title}` : ''}`;
  }).join('\n') : 'none';
  const body = connection.bodies?.[item.id];
  return <section className={s.card} role="region" aria-label="Item card" data-item-id={item.id} tabIndex={-1}>
    <span className={s.id}>{item.id}</span>
    {message && <QuickMessage connection={connection} target={message} />}
    <h3>Summary</h3>
    <p><ItemText text={item.summary?.text ?? (connection.cardErrors?.[item.id] || (item.state === 'closed' ? 'Loading…' : 'No summary'))} /></p>
    {item.summary?.provenance && <small>{item.summary.provenance}</small>}
    <h3>Facts</h3>
    <dl>
      <dt>Status</dt><dd>{item.glyph} {item.derived_status ?? item.status ?? item.state}</dd>
      <dt>Layer</dt><dd>{item.rollup?.layer ?? item.layer ?? '—'}</dd>
      <dt>Labels</dt><dd>{item.labels.join(' · ') || '—'}</dd>
      <dt>Size</dt><dd>{item.size ?? '—'}</dd>
      <dt>Parent</dt><dd><ItemText text={parent ? `${parent.id} ${parent.title}` : item.parent ?? '—'} /></dd>
      <dt>Lead</dt><dd>{item.claim?.session ?? (item.child_counts ? connection.coordinator : null) ?? '—'}</dd>
      <dt>Claim</dt><dd>{item.claim ? `${item.claim.session} · ${item.claim.role}` : 'none'}</dd>
      <dt>Holds</dt><dd>{item.holds.map(value => `${value.session} · ${value.role}`).join('\n') || 'none'}</dd>
      {item.rollup?.claims.map(value => <div className={s.fact} key={`claim:${value.item}`}><dt>{value.item} claim</dt><dd>{value.claim.session} · {value.claim.role}</dd></div>)}
      {item.rollup?.holds.map(value => <div className={s.fact} key={`hold:${value.item}:${value.hold.role}`}><dt>{value.item} hold</dt><dd>{value.hold.session} · {value.hold.role}</dd></div>)}
      <dt>Ordinal</dt><dd title={ordinal ? undefined : 'Full sibling order is not available yet'}>{ordinal ? `${ordinal} of ${order!.length} ${item.parent ?? 'at root'}` : '—'}</dd>
      {item.rank_set && <><dt>Rank</dt><dd>{item.rank}</dd></>}
    </dl>
    <h3>Progress</h3>
    {item.child_counts ? <>
      <p>{item.child_counts.done} of {item.child_counts.total} done</p>
      <p>{Object.entries(item.child_counts.statuses).map(([status, count]) => `${count} ${status}`).join(' · ')}</p>
    </> : <p>{item.criteria.verified} of {item.criteria.total} verified · {item.criteria.done} done · {item.criteria.failed} failed · {item.criteria.stale} stale</p>}
    <ItemCriteria key={item.id} item={row} connection={connection} />
    {!!item.stages?.length && <><h3>Plan stages</h3>{item.stages.map((stage, index) => <p key={stage.name}>
      S{index + 1} {stage.name} · {stage.state} · {stage.merged}/{stage.total} merged · {stage.qa.scope} {stage.qa.when}
    </p>)}</>}
    {item.rollup?.stage && <p>Stage {item.rollup.stage.number}/{item.rollup.stage.total} · {item.rollup.stage.name}</p>}
    <h3>Latest verdict</h3>
    {verdict ? <div className={s.verdict} data-clear={verdict.result === 'clear'}>
      {rolled && <small>{rolled.item} · {rolled.title}</small>}
      <strong>{verdict.result === 'clear' ? '✓' : '✗'} {verdict.verdict} · {verdict.result}</strong>
      <p>{verdict.by} · r{verdict.round ?? '—'} · {verdict.scope ?? '—'}{verdict.current === false ? ' · stale' : ''}</p>
      <p><ItemText text={verdict.reason ?? 'No reason'} /></p><small>{verdict.run} · {verdict.at}</small>
    </div> : <p>none</p>}
    <h3>Relations</h3>
    <dl><dt>Blocked by</dt><dd><ItemText text={relations(item.blocked_by)} /></dd>
      <dt>Blocks</dt><dd><ItemText text={relations(items.filter(value => value.blocked_by.includes(item.id)).map(value => value.id) ?? [])} /></dd>
      {item.follows?.length ? <><dt>Follows</dt><dd><ItemText text={relations(item.follows)} /></dd></> : null}
      {item.regression_of && <><dt>Regression of</dt><dd><ItemText text={relations([item.regression_of])} /></dd></>}
    </dl>
    {item.kind === 'task' && <><h3>Branch and suite</h3><dl>
      <dt>Branch</dt><dd>{item.branch ?? '—'}</dd>
      <dt>cland verify</dt><dd>{item.verify ? `${item.verify.result ?? item.verify.state} · ${item.verify.id} · ${item.verify.head.slice(0, 7)} · ${item.verify.executor}${item.verify.cached ? ' · cached' : ''} · ${item.verify.finished ?? '—'}` : 'none'}</dd>
    </dl></>}
    <h3>Dates</h3><dl><dt>Created</dt><dd>{item.created ?? '—'}</dd><dt>Updated</dt><dd>{item.updated}</dd>
      {item.closed && <><dt>Closed</dt><dd>{item.closed}</dd></>}
      <dt>Last activity</dt><dd>{activity ? `${activity.at} · ${activity.source} · ${activity.item}` : `${item.updated} · item updated`}</dd>
    </dl>
    {item.decision && <><h3>Decision</h3><p><ItemText text={item.decision.text} /></p><small>{item.decision.by} · {item.decision.at}</small></>}
    <h3><button className={s.bodyToggle} aria-expanded={bodyOpen} onClick={() => setBodyOpen(!bodyOpen)}>
      {bodyOpen ? '▾' : '▸'} Agents’ text
    </button></h3>
    <small>{item.agents_text?.sections.join(', ') || 'No sections'} · {item.agents_text?.words ?? 0} words</small>
    {bodyOpen && <pre className={s.body}><ItemText text={body?.text ?? body?.error ?? 'Loading…'} /></pre>}
  </section>;
}
