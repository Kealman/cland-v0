import { keyMap, shortcut, type KeyContext, type Shortcut } from './keymap.ts';

export type { KeyContext } from './keymap.ts';

const fieldSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

/** Only explicit declarations give a field (or nested thread) its own context. */
export function focusedKeyContext(target: EventTarget | null, fallback: KeyContext): KeyContext {
  const field = target instanceof Element ? target.closest(fieldSelector) : null;
  const owner = field ?? (target instanceof Element ? target.closest('[data-key-context]') : null);
  const declared = owner?.getAttribute('data-key-context');
  return declared && Object.hasOwn(keyMap, declared) ? declared as KeyContext : fallback;
}

/** The shell's only raw key listener. Unhandled context chords never run shell actions. */
export function listenForShortcuts(
  run: (action: Shortcut) => void,
  context: (target: EventTarget | null) => KeyContext = () => 'shell',
  handles: (action: Shortcut, context: KeyContext) => boolean = () => true,
): () => void {
  let leaderTarget: EventTarget | null = null;
  let leaderContext: KeyContext = 'shell';
  let prefix: boolean | 'KeyZ' | 'KeyG' = true;
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) { leaderTarget = null; return; }
    const mode = context(event.target);
    const field = event.target instanceof Element && event.target.closest(fieldSelector);
    const declaredField = field && field.getAttribute('data-key-context') === mode;
    const modal = mode === 'palette' || mode === 'help';
    const pendingLeader = !modal && !field && leaderTarget !== null && leaderTarget === event.target && leaderContext === mode;
    const action = shortcut(event, pendingLeader ? prefix : false, mode) ?? shortcut(event, false, mode);
    leaderTarget = null;
    if (!action) return;
    const local = Object.values(keyMap[mode]).includes(action);
    const paletteControl = mode === 'palette' && (local || action === 'dismiss' || action === 'open-other');
    if (field && action !== 'palette' && !paletteControl && !(declaredField && local)) return;
    if (action === 'leader' && modal) return;
    if (action === 'leader' && event.target instanceof Element && event.target.closest('[data-fold-toggle]')) return;
    if ((action === 'fold-close' || action === 'fold-open') && !(event.target instanceof Element && event.target.closest('[data-fold-block]'))) return;
    const cardAccept = mode === 'items' && action === 'accept' && event.target instanceof Element &&
      (event.target.getAttribute('role') === 'treeitem' || event.target.getAttribute('aria-label') === 'Item card');
    if (mode === 'items' && action === 'accept' && !cardAccept) return;
    if (mode === 'thread' && action === 'thread-toggle' && event.code === 'Enter' && event.target instanceof Element &&
      event.target.closest('a, button, [role="button"]') && !event.target.closest('[data-run-anchor]')) return;
    // Session Enter owns rows, confirmations and the queue; other buttons keep native activation.
    if (mode === 'sessions' && action === 'session-open' && event.target instanceof Element &&
        event.target.closest('button') && !event.target.closest('[data-object-id], [data-session-actions], [data-session-slot="verification"]')) return;
    if (mode === 'launch' && action === 'accept' && event.target instanceof Element && event.target.closest('button')) return;
    if (mode === 'help' && action !== 'dismiss' && action !== 'palette') return;
    if (local && !handles(action, mode)) {
      if (declaredField) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (action === 'leader' || action === 'jump-leader' || action === 'tree-leader' || action === 'thread-leader') {
      prefix = action === 'leader' ? true : action === 'jump-leader' ? 'KeyG' : 'KeyZ';
      leaderTarget = event.repeat ? null : event.target;
      leaderContext = mode;
      return;
    }
    prefix = true;
    run(action);
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
