export const areas = ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'] as const;
export type Area = typeof areas[number];
export type Shortcut = Area | 'split' | 'open-other' | 'dismiss' | 'palette' | 'leader' | 'help' | 'accept' | 'next-kind' | 'previous-kind' | 'next-result' | 'previous-result' | 'fold-close' | 'fold-open'
  | 'session-next' | 'session-previous' | 'session-open' | 'session-launch' | 'session-aide' | 'session-stop' | 'session-resume' | 'session-archive' | 'session-capabilities' | 'session-archive-toggle'
  | 'artifact-next' | 'artifact-previous' | 'artifact-open' | 'artifact-compose' | 'artifact-keep' | 'artifact-archive' | 'artifact-archive-toggle'
  | 'composer-send' | 'composer-newline'
  | 'topic-next' | 'topic-previous' | 'topic-open' | 'topic-close' | 'thread-next' | 'thread-previous' | 'thread-back' | 'thread-leader' | 'thread-toggle'
  | 'plan-approve' | 'plan-discuss' | 'tree-scope' | 'tree-back' | 'jump-leader' | 'jump-item' | 'jump-topic' | 'jump-session'
  | 'tree-select' | 'tree-extend-next' | 'tree-extend-previous' | 'tree-message' | 'tree-topic-message' | 'tree-edit-criteria'
  | 'tree-next' | 'tree-previous' | 'tree-open' | 'tree-close' | 'tree-leader' | 'tree-toggle' | 'tree-done' | 'tree-archive';
type KeyStroke = { code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

export type KeyContext = 'shell' | 'items' | 'topics' | 'thread' | 'inbox' | 'events' | 'composer' | 'sessions' | 'artifacts' | 'accounts' | 'palette' | 'help' | 'launch';
export type KeyAction = { action: Shortcut; label: string };

/** One physical-code/modifier map, partitioned by focused context. */
export const keyMap: Readonly<Record<KeyContext, Readonly<Record<string, Shortcut>>>> = {
  shell: {
    Digit1: 'Inbox', Digit2: 'Items', Digit3: 'Sessions', Digit4: 'Topics',
    Digit5: 'Events', Digit6: 'Artifacts', Digit7: 'Accounts',
    'Meta+Backslash': 'split', 'Meta+Enter': 'open-other', Escape: 'dismiss',
    'Meta+KeyK': 'palette', Space: 'leader', 'Space KeyP': 'palette', 'Shift+Slash': 'help',
    ArrowLeft: 'fold-close', ArrowRight: 'fold-open',
    KeyG: 'jump-leader', 'KeyG KeyI': 'jump-item', 'KeyG KeyT': 'jump-topic', 'KeyG KeyS': 'jump-session',
  },
  items: {
    Enter: 'accept',
    // Items selection, scope and message bindings (T-1074).
    KeyA: 'plan-approve', KeyD: 'plan-discuss',
    KeyS: 'tree-scope', 'Space Space': 'tree-back',
    KeyX: 'tree-select', 'Shift+KeyJ': 'tree-extend-next', 'Shift+KeyK': 'tree-extend-previous',
    KeyM: 'tree-message', 'Shift+KeyM': 'tree-topic-message',
    KeyE: 'tree-edit-criteria',
    KeyJ: 'tree-next', KeyK: 'tree-previous', KeyL: 'tree-open', KeyH: 'tree-close',
    KeyZ: 'tree-leader', 'KeyZ KeyA': 'tree-toggle', 'Shift+KeyD': 'tree-done', 'Shift+KeyA': 'tree-archive',
  },
  topics: { KeyJ: 'topic-next', ArrowDown: 'topic-next', KeyK: 'topic-previous', ArrowUp: 'topic-previous', Enter: 'topic-open', KeyL: 'topic-open', KeyH: 'topic-close' },
  thread: { KeyJ: 'thread-next', ArrowDown: 'thread-next', KeyK: 'thread-previous', ArrowUp: 'thread-previous', KeyH: 'thread-back', Escape: 'thread-back', Enter: 'thread-toggle', KeyZ: 'thread-leader', 'KeyZ KeyA': 'thread-toggle' },
  inbox: {}, events: {},
  composer: { Enter: 'composer-send', 'Shift+Enter': 'composer-newline', 'Meta+Enter': 'composer-send' },
  sessions: { KeyJ: 'session-next', ArrowDown: 'session-next', KeyK: 'session-previous', ArrowUp: 'session-previous',
    Enter: 'session-open', KeyL: 'session-launch', KeyA: 'session-aide', KeyX: 'session-stop', KeyR: 'session-resume',
    KeyD: 'session-archive', KeyC: 'session-capabilities', 'Shift+KeyA': 'session-archive-toggle' },
  artifacts: { KeyJ: 'artifact-next', ArrowDown: 'artifact-next', ArrowUp: 'artifact-previous', Enter: 'artifact-open',
    KeyS: 'artifact-compose', KeyK: 'artifact-keep', KeyD: 'artifact-archive', 'Shift+KeyA': 'artifact-archive-toggle' },
  accounts: {},
  palette: { Enter: 'accept', Tab: 'next-kind', 'Shift+Tab': 'previous-kind', ArrowDown: 'next-result', ArrowUp: 'previous-result' },
  help: {},
  launch: { Enter: 'accept', Escape: 'dismiss' },
};

export function shortcut(event: KeyStroke, leader: boolean | 'KeyZ' | 'KeyG' = false, context: KeyContext = 'shell'): Shortcut | undefined {
  const chord = `${event.metaKey ? 'Meta+' : ''}${event.ctrlKey ? 'Control+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.code}`;
  const stroke = leader ? `${leader === true ? 'Space' : leader} ${chord}` : chord;
  return keyMap[context][stroke] ?? keyMap.shell[stroke];
}

export function areaKey(area: Area): string {
  return Object.entries(keyMap.shell).find(([, action]) => action === area)![0].replace('Digit', '');
}


export function actionKeys(action: Shortcut, context?: KeyContext): string[] {
  // Without a context retain all aliases, including actions shadowed elsewhere.
  const entries = context ? Object.entries({ ...keyMap.shell, ...keyMap[context] }) : Object.values(keyMap).flatMap(table => Object.entries(table));
  return [...new Set(entries.filter(([, value]) => value === action).map(([chord]) => chord))];
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

export const planActions: ReadonlyArray<{ action: Shortcut; label: string }> = [
  { action: 'plan-approve', label: 'Approve plan' }, { action: 'plan-discuss', label: 'Discuss plan with Lead' },
];


/** Future views opt in action by action; declaring a chord alone never enables it. */
export const contextActions: Readonly<Partial<Record<KeyContext, ReadonlyArray<KeyAction>>>> = {
  items: [...treeActions, ...planActions],
  topics: [{ action: 'topic-next', label: 'Next topic or group' }, { action: 'topic-previous', label: 'Previous topic or group' },
    { action: 'topic-open', label: 'Enter thread or unfold group' }, { action: 'topic-close', label: 'Fold topic group' }],
  thread: [{ action: 'thread-next', label: 'Next message' }, { action: 'thread-previous', label: 'Previous message' }, { action: 'thread-back', label: 'Return to topic list' }, { action: 'thread-toggle', label: 'Toggle agent run' }],
  composer: [{ action: 'composer-send', label: 'Send message' }, { action: 'composer-newline', label: 'New line' }],
  sessions: [
    { action: 'session-next', label: 'Next session' }, { action: 'session-previous', label: 'Previous session' },
    { action: 'session-open', label: 'Open session or queue' }, { action: 'session-launch', label: 'Launch a session' },
    { action: 'session-aide', label: 'New Aide' }, { action: 'session-stop', label: 'Stop session' },
    { action: 'session-resume', label: 'Resume session' }, { action: 'session-archive', label: 'Archive session' },
    { action: 'session-capabilities', label: 'Capabilities' }, { action: 'session-archive-toggle', label: 'Show archived sessions' },
  ],
  artifacts: [
    { action: 'artifact-next', label: 'Next artifact' }, { action: 'artifact-previous', label: 'Previous artifact' },
    { action: 'artifact-open', label: 'Open artifact' }, { action: 'artifact-compose', label: 'Attach to composer' },
    { action: 'artifact-keep', label: 'Keep artifact' }, { action: 'artifact-archive', label: 'Archive artifact' },
    { action: 'artifact-archive-toggle', label: 'Show archived artifacts' },
  ],
};

export function areaContext(area: Area): KeyContext {
  return area.toLowerCase() as KeyContext;
}
