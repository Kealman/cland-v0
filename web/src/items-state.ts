import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import type { TreePreferences } from './items-tree.ts';

export type ItemsPreferences = TreePreferences & { scope?: string | undefined; back: (string | undefined)[]; selection: string[] };
const listeners = new Set<() => void>();
let stored: ItemsPreferences | undefined;
export function itemsSnapshot(): ItemsPreferences {
  if (!stored) {
    const value = readInterfaceState('items') as { tree?: Partial<ItemsPreferences> } | null;
    const tree = value?.tree;
    stored = {
      open: tree?.open && typeof tree.open === 'object' && !Array.isArray(tree.open)
        ? Object.fromEntries(Object.entries(tree.open).filter(([, value]) => typeof value === 'boolean')) : {},
      hideDone: tree?.hideDone === true, archive: tree?.archive === true,
      scope: typeof tree?.scope === 'string' ? tree.scope : undefined,
      back: [], selection: [],
    };
  }
  return stored;
}
export function subscribeItems(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function saveItems(value: ItemsPreferences) {
  stored = value;
  const previous = readInterfaceState('items');
  writeInterfaceState('items', { ...(previous && typeof previous === 'object' ? previous : {}), tree: { open: value.open, hideDone: value.hideDone, archive: value.archive, scope: value.scope } });
  listeners.forEach(listener => listener());
}
