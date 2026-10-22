import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import { ItemsTree, ItemFacts, ScopeBreadcrumbs } from './ItemsTree.tsx';
import { buildItemsBoard } from './items-board.ts';
import { itemsSnapshot, subscribeItems, saveItems } from './items-state.ts';
import s from './ItemsTree.module.css';
import b from './ItemsBoard.module.css';

/** Read-only Board; keyboard actions enter through the shell's shared dispatcher. */
export function ItemsBoard({ connection, release, selected, select, controls, onNavigate }: ComponentProps<typeof ItemsTree>) {
  const preferences = useSyncExternalStore(subscribeItems, itemsSnapshot);
  const [parent, setParent] = useState<string>();
  const model = useMemo(() => buildItemsBoard(connection, preferences, release, parent), [connection, preferences, release, parent]);
  const root = useRef<HTMLDivElement>(null);
  const cursor = useRef<string | undefined>(model.rows.find(row => row.item?.id === selected)?.key);
  const previousSelected = useRef(selected);
  const [groupCursor, setGroupCursor] = useState<string>();
  const focus = (key: string) => {
    cursor.current = key;
    const node = [...root.current?.querySelectorAll<HTMLButtonElement>('[data-board-key]') ?? []].find(node => node.dataset.boardKey === key);
    node?.focus(); node?.scrollIntoView({ block: 'nearest' });
  };
  useEffect(() => {
    if (selected !== previousSelected.current || !model.rows.some(row => row.key === cursor.current)) {
      cursor.current = model.rows.find(row => row.item?.id === selected)?.key;
      previousSelected.current = selected;
    }
  }, [model, selected]);
  useEffect(() => { for (const id of model.loads) connection.loadClosed?.(id); }, [model, connection]);
  useImperativeHandle(controls, () => ({ run(action) {
    if (!['tree-next', 'tree-previous', 'tree-open', 'tree-close', 'tree-toggle', 'tree-done', 'tree-archive', 'tree-select', 'tree-extend-next', 'tree-extend-previous', 'tree-scope', 'tree-back', 'dismiss'].includes(action)) return false;
    if (action === 'tree-back') {
      if (preferences.back.length) saveItems({ ...preferences, scope: preferences.back.at(-1), back: preferences.back.slice(0, -1) });
    } else if (action === 'dismiss') {
      if (!preferences.selection.length) return false;
      saveItems({ ...preferences, selection: [] });
    } else if (action === 'tree-done') saveItems({ ...preferences, hideDone: !preferences.hideDone });
    else if (action === 'tree-archive') saveItems({ ...preferences, archive: !preferences.archive });
    else {
      const targets = model.rows.filter(row => !row.note);
      const cursorIndex = targets.findIndex(row => row.key === cursor.current);
      const index = Math.max(0, cursorIndex < 0 ? targets.findIndex(row => row.item?.id === selected) : cursorIndex);
      const row = targets[index];
      if (!row) return true;
      if (action === 'tree-scope') {
        const scope = row.expandable && row.item ? row.item.id : row.item?.parent;
        if (scope && scope !== preferences.scope) saveItems({ ...preferences, scope, back: [...preferences.back, preferences.scope] });
      } else if (action === 'tree-select') {
        const id = row.item?.id;
        if (id) saveItems({ ...preferences, selection: preferences.selection.includes(id) ? preferences.selection.filter(value => value !== id) : [...preferences.selection, id] });
      } else if (action === 'tree-extend-next' || action === 'tree-extend-previous') {
        const target = targets[Math.max(0, Math.min(targets.length - 1, index + (action === 'tree-extend-next' ? 1 : -1)))]!;
        saveItems({ ...preferences, selection: [...new Set([...preferences.selection, ...[row, target].flatMap(value => value.item ? [value.item.id] : [])])] });
        focus(target.key);
      } else if (action === 'tree-next' || action === 'tree-previous') focus(targets[Math.max(0, Math.min(targets.length - 1, index + (action === 'tree-next' ? 1 : -1)))]!.key);
      else if (action === 'tree-open' && row.open) {
        const child = targets[index + 1]; if (child?.parent === row.key) focus(child.key);
      } else if (row.parent && (action === 'tree-close' && !row.open || action === 'tree-toggle' && !row.expandable)) {
        saveItems({ ...preferences, open: { ...preferences.open, [row.parent!]: false } }); focus(row.parent!);
      } else if (row.expandable) saveItems({ ...preferences, open: { ...preferences.open, [row.key]: action === 'tree-open' || action === 'tree-toggle' && !row.open } });
    }
    return true;
  } }));
  const chooseTab = (id: string | undefined) => { onNavigate?.(); setParent(id); };
  const toggle = (key: string, open: boolean) => saveItems({ ...preferences, open: { ...preferences.open, [key]: !open } });
  return <div className={s.explorer}>
    <ScopeBreadcrumbs connection={connection} />
    <div className={s.filters}>
      <button aria-pressed={preferences.hideDone} title="Hide done items (D)" onClick={() => saveItems({ ...preferences, hideDone: !preferences.hideDone })}>D · {preferences.hideDone ? 'Done hidden' : 'Done shown'}</button>
      <button aria-pressed={preferences.archive} title="Show archived roots (A)" onClick={() => saveItems({ ...preferences, archive: !preferences.archive })}>A · {preferences.archive ? 'Archive shown' : 'Archive hidden'}</button>
      {preferences.hideDone && <span>{model.scope?.child_counts?.done ?? connection.doneItems ?? 0} done hidden</span>}
      {!!preferences.selection.length && <span>{preferences.selection.length} selected</span>}
    </div>
    <div className={b.tabs} role="group" aria-label="Board epic tabs">
      <button aria-pressed={!model.tab} aria-label="All epics" onClick={() => chooseTab(undefined)}>All</button>
      {model.tabs.map(item => <button key={item.id} aria-pressed={model.tab?.id === item.id} onClick={() => chooseTab(item.id)}>{item.id} {item.title}</button>)}
    </div>
    <div className={b.scope} aria-label="Board scope"><span>{model.scope ? `${model.scope.id} ${model.scope.title}` : 'Unscheduled'}</span>
      {model.scope?.child_counts && <span>{model.scope.child_counts.done}/{model.scope.child_counts.total}</span>}
    </div>
    <div ref={root} role="tree" aria-label="Items board" className={s.tree}>
      {model.rows.map(row => row.note ? <div key={row.key} className={s.stage} data-board-section style={{ paddingLeft: 16 + row.depth * 20 }}>{row.title}</div>
        : <button key={row.key} role="treeitem" aria-level={row.depth + 1} aria-expanded={row.expandable ? row.open : undefined}
          aria-selected={row.item ? selected === row.item.id : groupCursor === row.key} data-marked={preferences.selection.includes(row.item?.id ?? row.key)} data-board-key={row.key} data-tree-key={row.key}
          data-object-id={row.item?.id} data-status={row.item?.derived_status ?? row.item?.status}
          className={s.row} style={{ paddingLeft: 12 + row.depth * 20 }} tabIndex={selected === row.item?.id || !selected && row === model.rows[0] ? 0 : -1}
          title={row.item?.summary?.text ?? row.title} onFocus={() => { cursor.current = row.key; setGroupCursor(row.key); if (row.item) select(row.item.id); }}
          onClick={event => { if (row.item) select(row.item.id); if (row.expandable && (!row.item || event.target instanceof Element && event.target.closest('[data-tree-chevron]'))) toggle(row.key, row.open); }}
          onDoubleClick={() => { if (row.expandable) toggle(row.key, row.open); }}>
          <span className={s.chevron} data-tree-chevron aria-hidden="true">{row.expandable ? row.open ? '▾' : '▸' : ''}</span>
          {row.item && <><span className={s.glyph} title={row.item.derived_status}>{row.item.glyph ?? '○'}</span><span className={s.id}>{row.item.id}</span></>}
          {row.item?.parent && !row.expandable && <span className={s.id}>{row.item.parent} ›</span>}
          <span className={s.title}>{row.title}</span>
          {row.facts?.map(fact => <span key={fact} className={s.fact}>{fact}</span>)}
          {row.item?.blocked && <span className={s.fact} title={`Blocked by ${row.item.open_blockers.join(', ')}`}>◌ blocked</span>}
          {row.next && <span className={s.next}>next</span>}
          {row.item && (row.expandable ? row.item.claim && <span className={s.fact}>{row.item.claim.session}</span>
            : <ItemFacts item={row.item} coordinator={connection.coordinator} showRank={false} />)}
        </button>)}
    </div>
    {model.scope?.kind === connection.tracker?.levels[0] && <div className={b.categories} aria-label="Board categories">
      <span>Categories ({model.categories.length})</span>{model.categories.map(item => <span key={item.id}>{item.title} · {(item.child_counts?.total ?? 0) - (item.child_counts?.done ?? 0)} open · {item.child_counts?.done ?? 0} done</span>)}
      {!!model.unscheduled && <span>Unscheduled ({model.unscheduled})</span>}
    </div>}
  </div>;
}
