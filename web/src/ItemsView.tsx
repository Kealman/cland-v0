import { useSyncExternalStore, type ComponentProps } from 'react';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import { ItemsTree } from './ItemsTree.tsx';
import { ItemsBoard } from './ItemsBoard.tsx';
import s from './ItemsView.module.css';

// Later views enable one entry and provide their component here.
export const itemViews = [
  { id: 'tree', label: 'Tree', enabled: true },
  { id: 'board', label: 'Board', enabled: true },
  { id: 'graph', label: 'Graph', enabled: false },
  { id: 'plan', label: 'Plan', enabled: false },
] as const;
type View = typeof itemViews[number]['id'];
let current: View | undefined;
const listeners = new Set<() => void>();
function snapshot(): View {
  if (!current) {
    const saved = readInterfaceState('items') as { view?: string } | null;
    current = itemViews.find(view => view.enabled && view.id === saved?.view)?.id ?? 'tree';
  }
  return current;
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function change(view: View) {
  current = view;
  const saved = readInterfaceState('items');
  writeInterfaceState('items', { ...(saved && typeof saved === 'object' ? saved : {}), view });
  listeners.forEach(listener => listener());
}
export function ItemsViewSwitcher() {
  const view = useSyncExternalStore(subscribe, snapshot);
  return <div className={s.switcher} role="group" aria-label="Items view">
    {itemViews.map(option => <button key={option.id} disabled={!option.enabled} aria-pressed={view === option.id}
      title={option.enabled ? option.label : `${option.label} unavailable`} onClick={() => change(option.id)}>{option.label}</button>)}
  </div>;
}
export function ItemsView(props: ComponentProps<typeof ItemsTree>) {
  const view = useSyncExternalStore(subscribe, snapshot);
  return view === 'board' ? <ItemsBoard {...props} /> : <ItemsTree {...props} />;
}
