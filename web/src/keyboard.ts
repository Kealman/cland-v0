import { shortcut, type Area } from './keymap.ts';

/** The shell's only key listener. Components subscribe to actions, never raw keys. */
export function listenForShortcuts(run: (area: Area) => void): () => void {
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.target instanceof Element && event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    )) return;
    const action = shortcut(event);
    if (!action) return;
    event.preventDefault();
    run(action);
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
