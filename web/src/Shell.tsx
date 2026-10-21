// The frame ported from Q-405's App.tsx, connected to the production web edge.
import { useEffect, useRef, useState } from 'react';
import { connectHub, type ConnectionState } from './connection.ts';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import { areas, areaKey, type Area } from './keymap.ts';
import { listenForShortcuts } from './keyboard.ts';
import s from './Shell.module.css';

const iconPaths = [
  'M4 4h16v16H4z M4 14h5l2 3h2l2-3h5',
  'M6 4h14v16H6z M3 8h6 M3 12h6 M3 16h6',
  'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a6 6 0 0 1 12 0v3 M17 4a4 4 0 0 1 0 8 M18 15a5 5 0 0 1 4 5',
  'M3 4h18v13H9l-6 4z',
  'M4 12h4l3-8 4 16 3-8h3',
  'M4 3h11l5 5v13H4z M14 3v6h6 M8 13h8 M8 17h6',
  'M4 5h16v14H4z M4 9h16 M8 14h3 M15 14h2',
];

type ShellPreferences = { collapsed: boolean; area: Area; release: string };
function savedShell(): ShellPreferences {
  const saved = readInterfaceState('shell') as Partial<ShellPreferences> | null;
  return {
    collapsed: saved?.collapsed === true,
    area: areas.includes(saved?.area as Area) ? saved!.area! : 'Inbox',
    release: typeof saved?.release === 'string' ? saved.release : '',
  };
}

/** Reference component: semantic markup, CSS Module, tokens, and factual labels. */
export function Shell() {
  const [preferences, setPreferences] = useState(savedShell);
  useEffect(() => writeInterfaceState('shell', preferences), [preferences]);
  const area = preferences.area;
  const setArea = (selected: Area) => setPreferences(previous => ({ ...previous, area: selected }));
  const areaButtons = useRef<Partial<Record<Area, HTMLButtonElement>>>({});
  useEffect(() => listenForShortcuts(selected => {
    setPreferences(previous => ({ ...previous, area: selected }));
    areaButtons.current[selected]?.focus();
  }), []);
  const [connection, setConnection] = useState<ConnectionState>({ project: 'Workbench', live: false });
  useEffect(() => connectHub(setConnection), []);
  useEffect(() => {
    document.title = `${connection.needsYou ? `(${connection.needsYou}) ` : ''}${connection.project} · cland`;
  }, [connection.project, connection.needsYou]);
  const releases = connection.releases ?? [];
  const release = releases.find(item => item.id === preferences.release) ?? releases[0];
  const counts: Partial<Record<Area, number | undefined>> = {
    Inbox: connection.needsYou, Items: connection.plans,
    Sessions: connection.approvals, Topics: connection.waitingTopics,
  };
  return <div className={s.app}>
    <header className={s.top}>
      <span className={s.brand}>cland</span>
      <span className={s.project} aria-label="Project">{connection.project}</span>
      <label className={s.release}>
        <span className={s.mono} data-item-id>{release?.id ?? '—'}</span>
        <select aria-label="Release" value={release?.id ?? ''} title={release?.title ?? 'No open release'}
          onChange={event => setPreferences({ ...preferences, release: event.target.value })}>
          {!releases.length && <option value="">Release —</option>}
          {releases.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <button className={s.search} aria-label="Palette" title="Palette (⌘K)">Search<kbd>⌘K</kbd></button>
      <div className={s.right}>
        <button className={s.coordinator} aria-label="Coordinator" title="Open Coordinator in Sessions" onClick={() => setArea('Sessions')}>
          Coordinator<span className={s.mono}>{connection.coordinator ?? '—'}</span>
        </button>
        <button className={s.needs} aria-label="Needs you" title="Open Inbox" onClick={() => setArea('Inbox')}>
          Needs you<span className={connection.needsYou === 0 ? s.clear : s.mono}>{connection.needsYou === undefined ? '—' : connection.needsYou || '✓'}</span>
        </button>
        <span className={s.live} role="status" aria-label="Hub connection">
          <span className={s.dot} data-live={connection.live} />{connection.restartRequired ? 'Restart hub' : connection.live ? 'Live' : 'Offline'}
        </span>
        <button className={s.help} aria-label="Help" title="Area keys">?</button>
      </div>
    </header>
    <div className={s.body}>
      <aside className={s.sidebar} data-collapsed={preferences.collapsed}>
        <nav className={s.rail} aria-label="Areas">
          {areas.map((name, index) => <button key={name}
            ref={node => { if (node) areaButtons.current[name] = node; else delete areaButtons.current[name]; }}
            data-area={name} title={`${name} (${areaKey(name)})`} aria-label={name}
            onClick={() => setArea(name)} className={name === area ? s.current : s.area}
            aria-current={name === area ? 'page' : undefined}>
            <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d={iconPaths[index]} />
            </svg>
            <span className={s.areaName}>{name}</span>
            {!!counts[name] && <span className={s.badge} data-count>{counts[name]}</span>}
          </button>)}
        </nav>
        <button className={s.collapse} aria-label={preferences.collapsed ? 'Expand rail' : 'Collapse rail'}
          title="Rail width (automatically collapsed below 1280 px)"
          onClick={() => setPreferences({ ...preferences, collapsed: !preferences.collapsed })}>
          {preferences.collapsed ? '»' : '«'}
        </button>
      </aside>
      <main className={s.main} aria-label={area}>
        <header className={s.heading}><h1>{area}</h1><span className={s.mono}>—</span></header>
      </main>
    </div>
  </div>;
}
