export const areas = ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'] as const;
export type Area = typeof areas[number];
export type Shortcut = Area | 'split' | 'open-other' | 'dismiss' | 'palette' | 'leader' | 'help' | 'accept' | 'next-kind' | 'previous-kind' | 'next-result' | 'previous-result' | 'fold-close' | 'fold-open'
  | 'tree-scope' | 'tree-back' | 'jump-leader' | 'jump-item' | 'jump-topic' | 'jump-session'
  | 'tree-select' | 'tree-extend-next' | 'tree-extend-previous' | 'tree-message' | 'tree-topic-message' | 'tree-edit-criteria'
  | 'tree-next' | 'tree-previous' | 'tree-open' | 'tree-close' | 'tree-leader' | 'tree-toggle' | 'tree-done' | 'tree-archive';
type KeyStroke = { code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

/** The single physical-code/modifier table; also the source for displayed area keys. */
export const keyMap: Readonly<Record<string, Shortcut>> = {
  Digit1: 'Inbox', Digit2: 'Items', Digit3: 'Sessions', Digit4: 'Topics',
  Digit5: 'Events', Digit6: 'Artifacts', Digit7: 'Accounts',
  'Meta+Backslash': 'split', 'Meta+Enter': 'open-other', Escape: 'dismiss',
  'Meta+KeyK': 'palette', Space: 'leader', 'Space KeyP': 'palette', 'Shift+Slash': 'help',
  Enter: 'accept', Tab: 'next-kind', 'Shift+Tab': 'previous-kind',
  ArrowDown: 'next-result', ArrowUp: 'previous-result',
  ArrowLeft: 'fold-close', ArrowRight: 'fold-open',
  // Items selection, scope and message bindings (T-1074).
  KeyS: 'tree-scope', 'Space Space': 'tree-back',
  KeyG: 'jump-leader', 'KeyG KeyI': 'jump-item', 'KeyG KeyT': 'jump-topic', 'KeyG KeyS': 'jump-session',
  KeyX: 'tree-select', 'Shift+KeyJ': 'tree-extend-next', 'Shift+KeyK': 'tree-extend-previous',
  KeyM: 'tree-message', 'Shift+KeyM': 'tree-topic-message',
  KeyE: 'tree-edit-criteria',
  KeyJ: 'tree-next', KeyK: 'tree-previous', KeyL: 'tree-open', KeyH: 'tree-close',
  KeyZ: 'tree-leader', 'KeyZ KeyA': 'tree-toggle', 'Shift+KeyD': 'tree-done', 'Shift+KeyA': 'tree-archive',
};

export function shortcut(event: KeyStroke, leader: boolean | 'KeyZ' | 'KeyG' = false): Shortcut | undefined {
  const chord = `${event.metaKey ? 'Meta+' : ''}${event.ctrlKey ? 'Control+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.code}`;
  return keyMap[leader ? `${leader === true ? 'Space' : leader} ${chord}` : chord];
}

export function areaKey(area: Area): string {
  return Object.entries(keyMap).find(([, action]) => action === area)![0].replace('Digit', '');
}


export function actionKeys(action: Shortcut): string[] {
  return Object.entries(keyMap).filter(([, value]) => value === action).map(([chord]) => chord);
}
export function displayKey(chord: string): string {
  if (/^Key[A-Z]$/.test(chord)) return chord.slice(3).toLowerCase();
  return chord.replace(/Space Key([A-Z])/g, (_, letter: string) => `Space ${letter.toLowerCase()}`).replace('Meta+', '⌘').replace('Shift+Slash', '?')
    .replace(/Space Space/g, '␣␣').replace(/KeyG Key([ITS])/g, (_, letter: string) => `g${letter.toLowerCase()}`).replace(/KeyZ KeyA/g, 'za').replace(/Shift\+Key([AD])/g, '$1').replace('Shift+', '⇧').replace('Backslash', '\\').replace('Key', '').replace('Digit', '')
    .replace('ArrowDown', '↓').replace('ArrowUp', '↑').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Escape', 'Esc');
}

/** Labels and scopes carry no chords: help and palette derive those from keyMap. */
export const shellActions: ReadonlyArray<{ action: Shortcut; label: string }> = [
  ...areas.map(area => ({ action: area, label: `Go to ${area}` })),
  { action: 'palette', label: 'Open palette' }, { action: 'help', label: 'Area keys' },
  { action: 'split', label: 'Toggle split' }, { action: 'open-other', label: 'Open in other pane' },
  { action: 'dismiss', label: 'Close' },
];
export const paletteActions: ReadonlyArray<{ action: Shortcut; label: string }> = [
  { action: 'accept', label: 'Open result' }, { action: 'open-other', label: 'Open in other pane' },
  { action: 'next-kind', label: 'Next kind' }, { action: 'previous-kind', label: 'Previous kind' },
  { action: 'next-result', label: 'Next result' }, { action: 'previous-result', label: 'Previous result' },
  { action: 'dismiss', label: 'Close' },
];
export const foldActions: ReadonlyArray<{ action: Shortcut; label: string }> = [
  { action: 'fold-close', label: 'Fold group' }, { action: 'fold-open', label: 'Unfold group' },
];
export const treeActions: ReadonlyArray<{ action: Shortcut; label: string }> = [
  { action: 'tree-scope', label: 'Scope to item' }, { action: 'tree-back', label: 'Previous scope' },
  { action: 'jump-item', label: 'Jump to item' }, { action: 'jump-topic', label: 'Jump to topic' }, { action: 'jump-session', label: 'Jump to session' },
  { action: 'tree-select', label: 'Toggle item selection' },
  { action: 'tree-extend-next', label: 'Extend selection down' }, { action: 'tree-extend-previous', label: 'Extend selection up' },
  { action: 'tree-message', label: 'Message General' }, { action: 'tree-topic-message', label: 'Message item topic' },
  { action: 'tree-edit-criteria', label: 'Edit criteria block' },
  { action: 'tree-next', label: 'Next item' }, { action: 'tree-previous', label: 'Previous item' },
  { action: 'tree-open', label: 'Unfold or enter children' }, { action: 'tree-close', label: 'Fold or go to parent' },
  { action: 'tree-toggle', label: 'Toggle item fold' }, { action: 'tree-done', label: 'Hide done items' },
  { action: 'tree-archive', label: 'Show archived roots' },
  { action: 'accept', label: 'Enter card or return to tree' },
  { action: 'dismiss', label: 'Return from card or close drawer' },
];
