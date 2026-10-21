export const areas = ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'] as const;
export type Area = typeof areas[number];
type KeyStroke = { code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

/** The single physical-code/modifier table; also the source for displayed area keys. */
export const keyMap: Readonly<Record<string, Area>> = {
  Digit1: 'Inbox', Digit2: 'Items', Digit3: 'Sessions', Digit4: 'Topics',
  Digit5: 'Events', Digit6: 'Artifacts', Digit7: 'Accounts',
};

export function shortcut(event: KeyStroke): Area | undefined {
  const chord = `${event.metaKey ? 'Meta+' : ''}${event.ctrlKey ? 'Control+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.code}`;
  return keyMap[chord];
}

export function areaKey(area: Area): string {
  return Object.entries(keyMap).find(([, action]) => action === area)![0].replace('Digit', '');
}

