import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type Ref } from 'react';
import type { ExplorerSummary } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import type { Shortcut } from './keymap.ts';
import { itemsSnapshot, subscribeItems, saveItems as save } from './items-state.ts';
import { buildItemsTree, done } from './items-tree.ts';
import s from './ItemsTree.module.css';

export type TreeControls = { run: (action: Shortcut) => boolean };
const statusOrder = ['done', 'ready', 'qa', 'review', 'in progress', 'planned', 'backlog'] as const;
function Progress({ item }: { item: ExplorerSummary }) {
  const counts = item.child_counts;
  if (!counts) return null;
  return <><span className={s.fact}>{counts.done}/{counts.total}</span>
    <span className={s.meter} role="meter" aria-label={`${item.id} progress`} aria-valuemin={0} aria-valuemax={counts.total || 1} aria-valuenow={counts.done}
      data-mode={counts.total <= 16 ? 'cells' : 'proportional'} title={statusOrder.map(status => `${status}: ${counts.statuses[status] ?? 0}`).join(' · ')}>
      {statusOrder.flatMap(status => {
        const count = counts.statuses[status] ?? 0;
        return counts.total <= 16 ? Array.from({ length: count }, (_, i) => <i key={`${status}:${i}`} data-status={status} />)
          : count ? [<i key={status} data-status={status} style={{ flexGrow: count }} />] : [];
      })}
    </span>
    {(['in progress', 'review', 'qa'] as const).map(status => <span key={status} className={s.fact} title={status}>{status === 'in progress' ? '◐' : status} {counts.work[status]}</span>)}
  </>;
}
export function ItemFacts({ item, coordinator, showRank = true }: { item: ExplorerSummary; coordinator: string | null | undefined; showRank?: boolean }) {
  const stage = item.rollup?.stage;
  const claims = item.rollup?.claims.map(value => value.claim) ?? (item.claim ? [item.claim] : []);
  const holds = item.rollup?.holds.map(value => value.hold) ?? item.holds;
  const verdicts = item.rollup?.latest_verdict ? [item.rollup.latest_verdict] : item.verdicts;
  return <>
    <Progress item={item} />
    {stage && <span className={s.fact} title={stage.name}>S{stage.number}/{stage.total}</span>}
    {item.child_counts && <span className={s.fact} title="Lead">{item.claim?.role === 'lead' ? item.claim.session : coordinator ?? '—'}</span>}
    {claims.map((claim, index) => <span key={`claim:${index}`} className={s.fact} title={`Claim · ${claim.role}`}>{claim.session}</span>)}
    {holds.map((hold, index) => <span key={`hold:${index}`} className={s.fact} title={`Hold · ${hold.role}`}>{hold.role} {hold.session}</span>)}
    {verdicts.map(verdict => <span key={verdict.verdict} className={s.verdict} data-clear={verdict.result === 'clear'} data-current={verdict.current}
      title={`${verdict.by} · ${verdict.run}${verdict.scope ? ` · ${verdict.scope}` : ''}`}>
      {verdict.result === 'clear' ? '✓' : '✗'} {verdict.verdict} r{verdict.round}
    </span>)}
    <span className={s.fact} title="Criteria verified / total">{item.criteria.verified}/{item.criteria.total}</span>
    {showRank && item.rank_set && <span className={s.fact}>rank {item.rank}</span>}
    {done(item) && <span className={s.fact} title="Closed">{item.closed?.slice(0, 10) ?? '—'}</span>}
  </>;
}

/** Actions arrive from the shell's single physical-code dispatcher. */
export function ItemsTree({ connection, release, selected, select, controls }: {
  connection: ConnectionState; release: string | undefined; selected: string | undefined;
  select: (id: string) => void; controls: Ref<TreeControls>;
}) {
  const preferences = useSyncExternalStore(subscribeItems, itemsSnapshot);
  const rows = useMemo(() => {
    const start = performance.now();
    const result = buildItemsTree(connection, preferences, release, preferences.scope);
    performance.measure('cland.items.rebuild', { start, end: performance.now(), detail: { items: connection.items?.length ?? 0 } });
    return result;
  }, [connection, preferences, release]);
  const root = useRef<HTMLDivElement>(null);
  const cursor = useRef<string | undefined>(undefined);
  const [cursorKey, setCursorKey] = useState<string>();
  const previousRows = useRef(rows);
  const focus = (key: string) => {
    cursor.current = key;
    setCursorKey(key);
    const button = [...root.current?.querySelectorAll<HTMLButtonElement>('[data-tree-key]') ?? []].find(node => node.dataset.treeKey === key);
    button?.focus();
    button?.scrollIntoView({ block: 'nearest' });
  };
  useEffect(() => {
    if (cursor.current && !rows.some(row => row.key === cursor.current)) {
      const parent = previousRows.current.find(row => row.key === cursor.current)?.parent;
      const target = rows.find(row => row.key === parent) ?? rows.find(row => !row.note);
      if (target) focus(target.key);
    }
    previousRows.current = rows;
    for (const row of rows) if (row.open) {
      if (!preferences.hideDone || preferences.archive && row.key === ':releases') connection.loadClosed?.(row.item ? row.key : row.parent ?? '');
      if (row.item?.kind === connection.tracker?.levels[1]) connection.loadPlan?.(row.key);
    }
  }, [rows, connection, preferences.hideDone, preferences.archive]);
  useImperativeHandle(controls, () => ({ run(action) {
    if (!['tree-next','tree-previous','tree-open','tree-close','tree-toggle','tree-done','tree-archive'].includes(action)) return false;
    if (action === 'tree-done') save({ ...preferences, hideDone: !preferences.hideDone });
    else if (action === 'tree-archive') save({ ...preferences, archive: !preferences.archive });
    else {
      const targets = rows.filter(row => !row.note);
      const index = Math.max(0, targets.findIndex(row => row.key === (cursor.current ?? selected)));
      const row = targets[index];
      if (!row) return true;
      if (action === 'tree-next' || action === 'tree-previous') focus(targets[Math.max(0, Math.min(targets.length - 1, index + (action === 'tree-next' ? 1 : -1)))]!.key);
      else if (action === 'tree-open' && row.open) {
        const child = targets[index + 1];
        if (child?.parent === row.key) focus(child.key);
      } else if (action === 'tree-close' && (!row.open || row.fixed)) {
        if (row.parent) { save({ ...preferences, open: { ...preferences.open, [row.parent]: false } }); focus(row.parent); }
      } else if (row.expandable && !row.fixed) save({ ...preferences, open: { ...preferences.open, [row.key]: action === 'tree-open' || action === 'tree-toggle' && !row.open } });
      else if (action === 'tree-toggle' && row.parent) { save({ ...preferences, open: { ...preferences.open, [row.parent]: false } }); focus(row.parent); }
    }
    return true;
  } }));
  return <div className={s.explorer}>
    <div className={s.filters}>
      <button aria-pressed={preferences.hideDone} onClick={() => save({ ...preferences, hideDone: !preferences.hideDone })} title="Hide done items (D)">D · {preferences.hideDone ? 'Done hidden' : 'Done shown'}</button>
      <button aria-pressed={preferences.archive} onClick={() => save({ ...preferences, archive: !preferences.archive })} title="Show archived roots (A)">A · {preferences.archive ? 'Archive shown' : 'Archive hidden'}</button>
      {preferences.hideDone && <span>{connection.doneItems ?? connection.items?.filter(done).length ?? 0} done hidden</span>}
    </div>
    <div ref={root} role="tree" aria-label="Items tree" className={s.tree}>
      {rows.map(row => row.note ? <div key={row.key} className={s.stage} style={{ paddingLeft: 16 + row.depth * 20 }}>
        {row.facts?.map(fact => <span key={fact}>{fact}</span>)}<span>{row.title}</span>
      </div> : <button key={row.key} role="treeitem" aria-level={row.depth + 1} aria-expanded={row.expandable ? row.open : undefined}
        aria-selected={(cursorKey ?? selected) === row.key} data-tree-key={row.key} data-object-id={row.item?.id} data-status={row.item?.derived_status ?? row.item?.status}
        className={s.row} style={{ paddingLeft: 12 + row.depth * 20 }} tabIndex={(cursorKey ?? selected) === row.key || !selected && !cursorKey && row === rows[0] ? 0 : -1}
        title={row.item?.summary?.text ?? row.title} onFocus={() => { cursor.current = row.key; setCursorKey(row.key); if (row.item) select(row.key); }}
        onClick={event => {
          cursor.current = row.key;
          if (row.item) select(row.key);
          if (!row.fixed && row.expandable && (!row.item || event.target instanceof Element && event.target.closest('[data-tree-chevron]'))) save({ ...preferences, open: { ...preferences.open, [row.key]: !row.open } });
        }} onDoubleClick={() => { if (row.expandable && !row.fixed) save({ ...preferences, open: { ...preferences.open, [row.key]: !row.open } }); }}>
        <span className={s.chevron} data-tree-chevron aria-hidden="true">{row.expandable ? row.open ? '▾' : '▸' : ''}</span>
        {row.item && <><span className={s.ordinal} title="Ordinal">{row.ordinal}</span><span className={s.glyph} title={row.item.derived_status}>{row.item.glyph ?? '○'}</span><span className={s.id}>{row.item.id}</span></>}
        <span className={s.title}>{row.title}</span>
        {row.count !== undefined && <span className={s.fact}>({row.count})</span>}
        {row.facts?.map(fact => <span key={fact} className={s.fact}>{fact}</span>)}
        {row.item?.blocked && <span className={s.fact} title={`Blocked by ${row.item.open_blockers.join(', ')}`}>blocked</span>}
        {row.item?.next && <span className={s.next} title={`Next ${row.item.next}`}>next {row.item.next}</span>}
        {row.next && <span className={s.next} title="Next planned task">next</span>}
        {row.item && <ItemFacts item={row.item} coordinator={connection.coordinator} />}
      </button>)}
    </div>
  </div>;
}
