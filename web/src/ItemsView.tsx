import { useSyncExternalStore, type ComponentProps } from 'react';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import { ItemsTree } from './ItemsTree.tsx';
import { ItemsBoard } from './ItemsBoard.tsx';
import { ItemsPlan } from './ItemsPlan.tsx';
import { ItemsGraph } from './ItemsGraph.tsx';
import s from './ItemsView.module.css';
import { usePhone } from './phone.ts';

// Views share the Items selection and scope.
export const itemViews = [
  { id: 'tree', label: 'Tree', enabled: true },
  { id: 'board', label: 'Board', enabled: true },
  { id: 'graph', label: 'Graph', enabled: true },
  { id: 'plan', label: 'Plan', enabled: true },
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
export function showItemsView(view: View) {
  current = view;
  const saved = readInterfaceState('items');
  writeInterfaceState('items', { ...(saved && typeof saved === 'object' ? saved : {}), view });
  listeners.forEach(listener => listener());
}
export function useItemsView() { return useSyncExternalStore(subscribe, snapshot); }
export function ItemsViewSwitcher({ onChange }: { onChange?: () => void } = {}) {
  const view = useSyncExternalStore(subscribe, snapshot);
  return <div className={s.switcher} role="group" aria-label="Items view">
    {itemViews.map(option => <button key={option.id} disabled={!option.enabled} aria-pressed={view === option.id}
      title={option.enabled ? option.label : `${option.label} unavailable`} onClick={() => { onChange?.(); showItemsView(option.id); }}>{option.label}</button>)}
  </div>;
}
export function ItemsView(props: ComponentProps<typeof ItemsTree>) {
  const phone = usePhone();
  const view = useSyncExternalStore(subscribe, snapshot);
  if (phone) return <ItemsTree {...props} />;
  return view === 'plan' ? <ItemsPlan {...props} /> : view === 'graph' ? <ItemsGraph {...props} /> : view === 'board' ? <ItemsBoard {...props} /> : <ItemsTree {...props} />;
}
