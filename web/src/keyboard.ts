import { shortcut, type Shortcut } from './keymap.ts';

export type KeyContext = 'shell' | 'items' | 'palette' | 'help';
/** The shell's only key listener, including modal controls and leader sequences. */
export function listenForShortcuts(run: (action: Shortcut) => void, context: () => KeyContext = () => 'shell'): () => void {
  let leaderTarget: EventTarget | null = null;
  let prefix: boolean | 'KeyZ' | 'KeyG' = true;
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) { leaderTarget = null; return; }
    const mode = context();
    const field = event.target instanceof Element && event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    );
    const inShell = mode === 'shell' || mode === 'items';
    const pendingLeader = inShell && !field && leaderTarget !== null && leaderTarget === event.target;
    const action = shortcut(event, pendingLeader ? prefix : false) ?? shortcut(event);
    leaderTarget = null;
    if (action === 'leader' && !inShell) return;
    if (action?.startsWith('tree-') && mode !== 'items') return;
    if (field && action !== 'palette' && !(mode === 'palette' && ['dismiss', 'accept', 'open-other', 'next-kind', 'previous-kind', 'next-result', 'previous-result'].includes(action ?? ''))) return;
    if (!action) return;
    if (action === 'leader' && event.target instanceof Element && event.target.closest('[data-fold-toggle]')) return;
    if ((action === 'fold-close' || action === 'fold-open') && !(event.target instanceof Element && event.target.closest('[data-fold-block]'))) return;
    const cardAccept = mode === 'items' && action === 'accept' && event.target instanceof Element &&
      (event.target.getAttribute('role') === 'treeitem' || event.target.getAttribute('aria-label') === 'Item card');
    if (inShell && !cardAccept && ['accept', 'next-kind', 'previous-kind', 'next-result', 'previous-result'].includes(action)) return;
    if (mode === 'help' && action !== 'dismiss' && action !== 'palette') return;
    event.preventDefault();
    if (action === 'leader') { prefix = true; leaderTarget = event.repeat ? null : event.target; return; }
    if (action === 'jump-leader') { prefix = 'KeyG'; leaderTarget = event.repeat ? null : event.target; return; }
    if (action === 'tree-leader') { prefix = 'KeyZ'; leaderTarget = event.repeat ? null : event.target; return; }
    prefix = true;
    run(action);
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
