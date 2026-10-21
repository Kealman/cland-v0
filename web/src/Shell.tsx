// The frame ported from Q-405's App.tsx, connected to the production web edge.
import { useEffect, useState } from 'react';
import { connectHub, type ConnectionState } from './connection.ts';
import s from './Shell.module.css';

const areas = ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'] as const;

/** Reference component: semantic markup, CSS Module, tokens, and factual labels. */
export function Shell() {
  const [connection, setConnection] = useState<ConnectionState>({ project: 'Workbench', live: false });
  useEffect(() => connectHub(setConnection), []);
  return <div className={s.app}>
    <header className={s.top}>
      <span className={s.brand}>cland</span>
      <span className={s.project} aria-label="Project">{connection.project}</span>
      <span className={s.release}>Release <span className={s.mono}>—</span></span>
      <span className={s.search}>Search <kbd>⌘K</kbd></span>
      <div className={s.right}>
        <span className={s.coordinator}>Coordinator <span className={s.mono}>—</span></span>
        <span className={s.needs}>Needs you <span className={s.mono}>—</span></span>
        <span className={s.live} role="status" aria-label="Hub connection"><span className={s.dot} data-live={connection.live} /> {connection.live ? 'Live' : 'Offline'}</span>
        <span className={s.help}>?</span>
      </div>
    </header>
    <div className={s.body}>
      <nav className={s.rail} aria-label="Areas">
        {areas.map(area => <span key={area} className={area === 'Inbox' ? s.current : s.area} aria-current={area === 'Inbox' ? 'page' : undefined}>{area}</span>)}
      </nav>
      <main className={s.main} aria-label="Inbox">
        <header className={s.heading}><h1>Inbox</h1><span className={s.mono}>—</span></header>
      </main>
    </div>
  </div>;
}
