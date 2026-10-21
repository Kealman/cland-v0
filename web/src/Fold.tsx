import { useId, useSyncExternalStore, type ReactNode } from 'react';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import { actionKeys, displayKey, type Shortcut } from './keymap.ts';
import s from './Fold.module.css';

const listeners = new Set<() => void>();
const volatile = new Map<string, Map<string, boolean>>();
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function folded(area: string, id: string): boolean {
  const saved = readInterfaceState(area);
  return volatile.get(area)?.get(id) ?? (record(record(saved).folds)[id] === true);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Browser-only group/block, sharing the area's versioned preference key. */
export function Fold({ area, id, label, count, level = 2, actions, children }: {
  area: string; id: string; label: string; count: number | string; level?: 1 | 2;
  actions?: ReactNode; children: ReactNode;
}) {
  const closed = useSyncExternalStore(subscribe, () => folded(area, id));
  const content = useId();
  const Heading = level === 1 ? 'h1' : 'h2';
  const toggle = () => {
    const saved = record(readInterfaceState(area));
    const changes = new Map(volatile.get(area));
    changes.set(id, !closed);
    volatile.set(area, changes);
    writeInterfaceState(area, { ...saved, folds: { ...record(saved.folds), ...Object.fromEntries(changes) } });
    for (const listener of listeners) listener();
  };
  return <div className={s.fold} data-fold-block>
    <header className={s.heading}>
      <Heading aria-label={label}><button data-fold-toggle aria-label={`Fold ${label}`} aria-expanded={!closed} aria-controls={content}
        title={`Fold (${actionKeys('fold-close').map(displayKey).join(' / ')} / ${actionKeys('fold-open').map(displayKey).join(' / ')})`} onClick={toggle}>
        <svg aria-hidden="true" viewBox="0 0 16 16" data-folded={closed}><path d="m5 3 5 5-5 5" /></svg><span>{label}</span>
      </button></Heading>
      <span className={s.count}>{count}</span>{actions}
    </header>
    <div id={content} hidden={closed}>{children}</div>
  </div>;
}

/** Called by the shell's shared shortcut dispatcher, never by a local listener. */
export function runFoldShortcut(action: Shortcut): boolean {
  if (action !== 'fold-close' && action !== 'fold-open') return false;
  const toggle = document.activeElement?.closest('[data-fold-block]')?.querySelector<HTMLButtonElement>('[data-fold-toggle]');
  if (!toggle) return false;
  toggle.focus();
  if ((toggle.getAttribute('aria-expanded') === 'true') === (action === 'fold-close')) toggle.click();
  return true;
}
