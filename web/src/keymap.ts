export const areas = ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'] as const;
export type Area = typeof areas[number];
export type Shortcut = Area | 'split' | 'open-other' | 'dismiss' | 'palette' | 'leader' | 'help' | 'accept' | 'next-kind' | 'previous-kind' | 'next-result' | 'previous-result' | 'fold-close' | 'fold-open';
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
};

export function shortcut(event: KeyStroke, leader = false): Shortcut | undefined {
  const chord = `${event.metaKey ? 'Meta+' : ''}${event.ctrlKey ? 'Control+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.code}`;
  return keyMap[leader ? `Space ${chord}` : chord];
}

export function areaKey(area: Area): string {
  return Object.entries(keyMap).find(([, action]) => action === area)![0].replace('Digit', '');
}


export function actionKeys(action: Shortcut): string[] {
  return Object.entries(keyMap).filter(([, value]) => value === action).map(([chord]) => chord);
}
export function displayKey(chord: string): string {
  return chord.replace(/Space Key([A-Z])/g, (_, letter: string) => `Space ${letter.toLowerCase()}`).replace('Meta+', '⌘').replace('Shift+Slash', '?')
    .replace('Shift+', '⇧').replace('Backslash', '\\').replace('Key', '').replace('Digit', '')
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
