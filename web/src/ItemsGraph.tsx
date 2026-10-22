import { useEffect, useImperativeHandle, useMemo, useRef, useSyncExternalStore, type ComponentProps } from 'react';
import { ItemsTree, ScopeBreadcrumbs } from './ItemsTree.tsx';
import { itemRows } from './connection.ts';
import { currentRelease, done, numberOf } from './items-tree.ts';
import { itemsSnapshot, subscribeItems, saveItems } from './items-state.ts';
import { fromItems, rows, route } from './graph-layout.ts';
import s from './ItemsGraph.module.css';
import tree from './ItemsTree.module.css';

const width = 34, cell = 9, line = 22;
/** Sibling dependency geometry comes from the Lua differential-tested port. */
export function ItemsGraph({ connection, release, selected, select, controls }: ComponentProps<typeof ItemsTree>) {
  const preferences = useSyncExternalStore(subscribeItems, itemsSnapshot);
  const root = useRef<SVGSVGElement>(null);
  const model = useMemo(() => {
    const items = itemRows(connection);
    const scope = items.find(item => item.id === preferences.scope) ?? currentRelease(items, connection.tracker?.levels[0], release);
    const order = new Map(connection.siblingOrders?.[scope?.id ?? '']?.map((id, index) => [id, index]));
    const children = items.filter(item => (item.parent ?? undefined) === scope?.id && (!preferences.hideDone || !done(item)))
      .sort((a, b) => order.has(a.id) || order.has(b.id)
        ? (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)
        : (a.rank ?? numberOf(a.id) * 10) - (b.rank ?? numberOf(b.id) * 10));
    const layout = fromItems(children);
    const positions = rows(layout, () => 4);
    const routed = route(layout, positions, { orient: 'horizontal', width, top: 2, left: 2, height: () => 4, labelWidth: () => width - 2 });
    const bands = 'col' in routed.bounds ? routed.bounds.col : [];
    const linked = layout.nodes.map(id => ({ id, col: bands[layout.layer[id]! - 1]!, row: positions[id]! + 2 }));
    const bottom = Math.max(0, ...linked.map(node => node.row + 4));
    const tray = layout.tray.map((id, i) => ({ id, col: 2, row: bottom + 2 + i * 5 }));
    const nodes = [...linked, ...tray];
    return { scope, children, nodes, segments: routed.segments,
      width: Math.max(width + 4, ...nodes.map(node => node.col + width + 2)) * cell,
      height: Math.max(5, ...nodes.map(node => node.row + 4)) * line };
  }, [connection, preferences, release]);
  useEffect(() => { if (model.scope && !preferences.hideDone) connection.loadClosed?.(model.scope.id); }, [connection, model.scope, preferences.hideDone]);
  useImperativeHandle(controls, () => ({ run(action) {
    if (action === 'tree-done') saveItems({ ...preferences, hideDone: !preferences.hideDone });
    else if (action === 'tree-archive') saveItems({ ...preferences, archive: !preferences.archive });
    else if (action === 'tree-back') {
      if (preferences.back.length) saveItems({ ...preferences, scope: preferences.back.at(-1), back: preferences.back.slice(0, -1) });
    } else if (action === 'dismiss') {
      if (!preferences.selection.length) return false;
      saveItems({ ...preferences, selection: [] });
    } else if (['tree-next', 'tree-previous', 'tree-select', 'tree-extend-next', 'tree-extend-previous', 'tree-scope'].includes(action)) {
      const selectedIndex = model.nodes.findIndex(node => node.id === selected);
      const index = Math.max(0, selectedIndex);
      const current = model.nodes[index];
      if (!current) return true;
      if (action === 'tree-scope') {
        const item = model.children.find(item => item.id === selected);
        const scope = item && connection.tracker?.ladder.flat().includes(item.kind) ? item.id : item?.parent;
        if (scope && scope !== preferences.scope) saveItems({ ...preferences, scope, back: [...preferences.back, preferences.scope] });
      } else if (action === 'tree-select') {
        if (selectedIndex >= 0) saveItems({ ...preferences, selection: preferences.selection.includes(current.id) ? preferences.selection.filter(id => id !== current.id) : [...preferences.selection, current.id] });
      } else {
        const target = model.nodes[Math.max(0, Math.min(model.nodes.length - 1, index + (action === 'tree-next' || action === 'tree-extend-next' ? 1 : -1)))]!;
        if (action === 'tree-extend-next' || action === 'tree-extend-previous') saveItems({ ...preferences, selection: [...new Set([...preferences.selection, current.id, target.id])] });
        const node = [...root.current?.querySelectorAll<SVGGElement>('[data-object-id]') ?? []].find(node => node.dataset.objectId === target.id);
        node?.focus(); node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    } else return false;
    return true;
  } }));
  return <div className={s.graph}>
    <ScopeBreadcrumbs connection={connection} />
    <div className={tree.filters}>
      {!!preferences.selection.length && <span>{preferences.selection.length} selected</span>}
      <button aria-pressed={preferences.hideDone} title="Hide done items (D)" onClick={() => saveItems({ ...preferences, hideDone: !preferences.hideDone })}>D · {preferences.hideDone ? 'Done hidden' : 'Done shown'}</button>
      <button aria-pressed={preferences.archive} title="Show archived roots (A)" onClick={() => saveItems({ ...preferences, archive: !preferences.archive })}>A · {preferences.archive ? 'Archive shown' : 'Archive hidden'}</button>
    </div>
    <div className={s.scope} aria-label="Graph scope">{model.scope ? `${model.scope.id} ${model.scope.title}` : 'Unscheduled'}</div>
    <svg ref={root} role="tree" aria-label="Items graph" width={model.width} height={model.height}>
      {model.segments.map(([kind, a, b, c, chain], i) => kind === 'p' ? null : <path key={i} data-graph-edge={chain} className={s.edge}
        d={kind === 'h' ? `M ${b * cell} ${a * line} H ${c * cell}` : `M ${a * cell} ${b * line} V ${c * line}`} />)}
      {model.nodes.map(node => {
        const item = model.children.find(item => item.id === node.id)!;
        const counts = item.child_counts;
        const work = counts ? (['in progress', 'review', 'qa', 'ready'] as const).reduce((sum, status) => sum + (counts.statuses[status] ?? 0), 0) : 0;
        return <g key={item.id} role="treeitem" aria-selected={selected === item.id} data-marked={preferences.selection.includes(item.id)} data-object-id={item.id} data-tree-key={item.id}
          data-status={done(item) ? 'done' : item.derived_status ?? item.status} tabIndex={selected === item.id || !selected && node === model.nodes[0] ? 0 : -1}
          className={s.node} transform={`translate(${node.col * cell}, ${node.row * line})`}
          onClick={() => select(item.id)} onFocus={() => select(item.id)}>
          <title>{item.id} {item.title}</title>
          <rect x={-cell} y={-line} width={width * cell} height={4 * line} rx={6} />
          <text data-graph-glyph className={s.glyph}>{done(item) ? '✓' : item.glyph ?? '○'}</text>
          <text x={2 * cell} className={s.id}>{item.id}</text>
          <text y={line} data-graph-title className={s.title}>{item.title.length > 31 ? `${item.title.slice(0, 30)}…` : item.title}</text>
          <text y={2 * line} className={s.fact}>{counts ? `${counts.done}/${counts.total} · ${work} in work` : `${item.criteria.verified}/${item.criteria.total}`}</text>
        </g>;
      })}
    </svg>
    {!model.nodes.length && <p className={s.fact}>No items</p>}
  </div>;
}
