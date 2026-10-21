import { shortcut, type Shortcut } from './keymap.ts';

export type KeyContext = 'shell' | 'palette' | 'help';
/** The shell's only key listener, including modal controls and leader sequences. */
export function listenForShortcuts(run: (action: Shortcut) => void, context: () => KeyContext = () => 'shell'): () => void {
  let leaderTarget: EventTarget | null = null;
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) { leaderTarget = null; return; }
    const mode = context();
    const field = event.target instanceof Element && event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    );
    const pendingLeader = mode === 'shell' && !field && leaderTarget !== null && leaderTarget === event.target;
    const action = shortcut(event, pendingLeader) ?? shortcut(event);
    leaderTarget = null;
    if (action === 'leader' && mode !== 'shell') return;
    if (field && action !== 'palette' && !(mode === 'palette' && ['dismiss', 'accept', 'open-other', 'next-kind', 'previous-kind', 'next-result', 'previous-result'].includes(action ?? ''))) return;
    if (!action) return;
    if (mode === 'shell' && ['accept', 'next-kind', 'previous-kind', 'next-result', 'previous-result'].includes(action)) return;
    if (mode === 'help' && action !== 'dismiss' && action !== 'palette') return;
    event.preventDefault();
    if (action === 'leader') { leaderTarget = event.repeat ? null : event.target; return; }
    run(action);
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
