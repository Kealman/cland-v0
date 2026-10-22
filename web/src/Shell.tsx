// The frame ported from Q-405's App.tsx, connected to the production web edge.
import { useEffect, useRef, useState } from 'react';
import { connectHub, findItem, type ConnectionState, type ObjectRow } from './connection.ts';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import { areas, areaKey, actionKeys, displayKey, type Area, type Shortcut } from './keymap.ts';
import { listenForShortcuts } from './keyboard.ts';
import s from './Shell.module.css';
import { PaletteDialog, type PaletteControls } from './Palette.tsx';
import { Fold, runFoldShortcut } from './Fold.tsx';
import { ItemCard } from './ItemCard.tsx';
import { type TreeControls } from './ItemsTree.tsx';
import { ItemsView, ItemsViewSwitcher } from './ItemsView.tsx';

const iconPaths = [
  'M4 4h16v16H4z M4 14h5l2 3h2l2-3h5',
  'M6 4h14v16H6z M3 8h6 M3 12h6 M3 16h6',
  'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a6 6 0 0 1 12 0v3 M17 4a4 4 0 0 1 0 8 M18 15a5 5 0 0 1 4 5',
  'M3 4h18v13H9l-6 4z',
  'M4 12h4l3-8 4 16 3-8h3',
  'M4 3h11l5 5v13H4z M14 3v6h6 M8 13h8 M8 17h6',
  'M4 5h16v14H4z M4 9h16 M8 14h3 M15 14h2',
];

type ShellPreferences = {
  collapsed: boolean; area: Area; release: string; ratio: number;
  secondary?: Area | undefined; row?: string | undefined; detail?: boolean | undefined;
  secondaryRow?: string | undefined; secondaryDetail?: boolean | undefined; dismissed?: string | undefined;
};
function savedShell(): ShellPreferences {
  const saved = readInterfaceState('shell') as Partial<ShellPreferences> | null;
  return {
    collapsed: saved?.collapsed === true,
    area: areas.includes(saved?.area as Area) ? saved!.area! : 'Inbox',
    release: typeof saved?.release === 'string' ? saved.release : '',
    secondary: areas.includes(saved?.secondary as Area) ? saved!.secondary : undefined,
    row: typeof saved?.row === 'string' ? saved.row : undefined,
    detail: saved?.detail === true,
    dismissed: typeof saved?.dismissed === 'string' ? saved.dismissed : undefined,
    secondaryRow: typeof saved?.secondaryRow === 'string' ? saved.secondaryRow : undefined,
    secondaryDetail: saved?.secondaryDetail === true,
    ratio: typeof saved?.ratio === 'number' && saved.ratio >= 0.2 && saved.ratio <= 0.8 ? saved.ratio : 2 / 3,
  };
}

/** Reference component: semantic markup, CSS Module, tokens, and factual labels. */
export function Shell() {
  const [preferences, setPreferences] = useState(savedShell);
  useEffect(() => writeInterfaceState('shell', preferences), [preferences]);
  const [overlay, setOverlay] = useState<'palette' | 'help' | undefined>();
  const [active, setActive] = useState<'primary' | 'secondary'>('primary');
  const split = preferences.secondary !== undefined;
  const area = active === 'secondary' && preferences.secondary ? preferences.secondary : preferences.area;
  const setArea = (selected: Area) => setPreferences(previous => active === 'secondary' && previous.secondary
    ? { ...previous, secondary: selected, secondaryRow: undefined, secondaryDetail: false } : { ...previous, area: selected, row: undefined, detail: false });
  const dismissed = preferences.dismissed;
  const setDismissed = (key: string | undefined) => setPreferences(previous => ({ ...previous, dismissed: key }));
  const selectionKey = `${preferences.area}/${preferences.row ?? ''}`;
  const selectRow = (pane: 'primary' | 'secondary', id: string) => {
    if (id !== (pane === 'primary' ? preferences.row : preferences.secondaryRow)) setDismissed(undefined);
    setPreferences(previous => pane === 'primary' ? { ...previous, row: id } : { ...previous, secondaryRow: id });
  };
  const areaButtons = useRef<Partial<Record<Area, HTMLButtonElement>>>({});
  const workspace = useRef<HTMLDivElement>(null);
  const closePane = (pane: 'primary' | 'secondary') => {
    setDismissed(selectionKey);
    setPreferences(previous => pane === 'primary'
      ? { ...previous, area: previous.secondary ?? previous.area, row: previous.secondaryRow, detail: previous.secondaryDetail, secondary: undefined, secondaryRow: undefined, dismissed: `${previous.secondary}/${previous.secondaryRow ?? ''}` }
      : { ...previous, secondary: undefined, secondaryRow: undefined });
    setActive('primary');
  };
  const openOther = () => {
    const selected = active === 'primary' ? preferences.row : preferences.secondaryRow;
    if (!selected) return;
    setDismissed(selectionKey);
    setPreferences(previous => active === 'primary'
      ? { ...previous, secondary: previous.area, secondaryRow: selected, secondaryDetail: true, ratio: split ? previous.ratio : 2 / 3 }
      : { ...previous, area: previous.secondary!, row: selected, detail: true });
  };
  const paletteControls = useRef<PaletteControls>(null);
  const cardOrigin = useRef<{ item: string; pane: string } | null>(null);
  const primaryTree = useRef<TreeControls>(null);
  const secondaryTree = useRef<TreeControls>(null);
  const runShortcut = (action: Shortcut, fromPalette = false) => {
    if (!overlay && area === 'Items') {
      const focused = document.activeElement;
      const inCard = focused?.closest('[aria-label="Item card"]');
      if (inCard && (action === 'dismiss' || action === 'tree-close' || action === 'accept')) {
        const item = inCard.getAttribute('data-item-id');
        const origin = cardOrigin.current?.item === item ? cardOrigin.current : null;
        const trees = [...workspace.current?.querySelectorAll<HTMLButtonElement>('[data-tree-key]') ?? []];
        const matches = trees.filter(node => node.dataset.objectId === item);
        const target = matches.find(node => node.closest('[data-pane]')?.getAttribute('data-pane') === origin?.pane) ?? matches[0];
        target?.focus();
        return;
      }
      if (action === 'accept' && focused?.getAttribute('role') === 'treeitem') {
        const item = focused.getAttribute('data-object-id');
        if (!item) return;
        const pane = focused.closest('[data-pane]')?.getAttribute('data-pane') ?? active;
        cardOrigin.current = { item, pane };
        setDismissed(undefined);
        if (split) setPreferences(previous => pane === 'primary'
          ? { ...previous, secondary: 'Items', secondaryRow: item, secondaryDetail: true }
          : { ...previous, area: 'Items', row: item, detail: true });
        requestAnimationFrame(() => {
          const cards = [...document.querySelectorAll<HTMLElement>('[aria-label="Item card"]')];
          cards.find(node => node.dataset.itemId === item && (!split || node.closest('[data-pane]')?.getAttribute('data-pane') !== pane))?.focus();
        });
        return;
      }
      if (inCard && action.startsWith('tree-')) return;
    }
    if (!overlay && area === 'Items' && (active === 'primary' ? primaryTree : secondaryTree).current?.run(action)) return;
    if (runFoldShortcut(action)) return;
    if (action === 'palette') setOverlay('palette');
    else if (overlay && !fromPalette) paletteControls.current?.run(action);
    else if (action === 'help') setOverlay('help');
    else if (action === 'split') {
      if (split) closePane('secondary');
      else setPreferences(previous => ({ ...previous, secondary: previous.area, secondaryRow: undefined, secondaryDetail: false, ratio: 2 / 3 }));
    } else if (action === 'open-other') openOther();
    else if (action === 'dismiss') { setDismissed(selectionKey); areaButtons.current[preferences.area]?.focus(); }
    else if (areas.includes(action as Area)) {
      setArea(action as Area);
      areaButtons.current[action as Area]?.focus();
    }
  };
  const keyboard = useRef({ run: runShortcut, overlay, area });
  useEffect(() => { keyboard.current = { run: runShortcut, overlay, area }; });
  useEffect(() => listenForShortcuts(action => keyboard.current.run(action), () => keyboard.current.overlay ?? (keyboard.current.area === 'Items' ? 'items' : 'shell')), []);
  const [connection, setConnection] = useState<ConnectionState>({ project: 'Workbench', live: false });
  useEffect(() => connectHub(setConnection), []);
  useEffect(() => {
    document.title = `${connection.needsYou ? `(${connection.needsYou}) ` : ''}${connection.project} · cland`;
  }, [connection.project, connection.needsYou]);
  const openResult = (target: Area, row: ObjectRow, pane: boolean) => {
    setPreferences(previous => {
      if (pane) return active === 'primary'
        ? { ...previous, secondary: target, secondaryRow: row.id, secondaryDetail: true, dismissed: selectionKey, ratio: split ? previous.ratio : 2 / 3 }
        : { ...previous, area: target, row: row.id, detail: true, dismissed: `${target}/${row.id}` };
      return active === 'secondary' && previous.secondary
        ? { ...previous, secondary: target, secondaryRow: row.id, secondaryDetail: true }
        : { ...previous, area: target, row: row.id, detail: false, dismissed: undefined };
    });
  };
  const selectedRow = preferences.area === 'Items' ? findItem(connection, preferences.row) : connection.rows?.[preferences.area]?.find(row => row.id === preferences.row);
  const drawerOpen = !split && selectedRow && dismissed !== selectionKey && !preferences.detail;
  const releases = connection.releases ?? [];
  const release = releases.find(item => item.id === preferences.release) ?? releases[0];
  const counts: Partial<Record<Area, number | undefined>> = {
    Inbox: connection.needsYou, Items: connection.plans,
    Sessions: connection.approvals, Topics: connection.waitingTopics,
  };
  return <div className={s.app}>
    {overlay && <PaletteDialog mode={overlay} area={area} connection={connection} controls={paletteControls}
      close={() => setOverlay(undefined)} run={action => {
        if (action === 'palette' || action === 'help') setOverlay(action);
        else { setOverlay(undefined); runShortcut(action, true); }
      }} open={openResult} />}
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
      <button className={s.search} aria-label="Palette" title={`Palette (${actionKeys('palette').map(displayKey).join(' / ')})`} onClick={() => setOverlay('palette')}>Search<kbd>{displayKey(actionKeys('palette')[0]!)}</kbd></button>
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
        <button className={s.help} aria-label="Help" title="Area keys" onClick={() => setOverlay('help')}>?</button>
      </div>
    </header>
    <div className={s.body}>
      <aside className={s.sidebar} data-collapsed={split || preferences.collapsed}>
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
          disabled={split} title="Rail width (automatically collapsed below 1280 px and while split)"
          onClick={() => setPreferences({ ...preferences, collapsed: !preferences.collapsed })}>
          {preferences.collapsed ? '»' : '«'}
        </button>
      </aside>
      <main className={s.main} aria-label={area}>
        <div className={s.workspace} ref={workspace}>
          {(['primary', 'secondary'] as const).filter(pane => pane === 'primary' || split).map(pane => {
            const paneArea = pane === 'primary' ? preferences.area : preferences.secondary!;
            const selected = pane === 'primary' ? preferences.row : preferences.secondaryRow;
            const detail = pane === 'primary' ? preferences.detail : preferences.secondaryDetail;
            const rows = connection.rows?.[paneArea];
            const row = paneArea === 'Items' ? findItem(connection, selected) : rows?.find(object => object.id === selected);
            return <section key={pane} className={s.pane} data-pane={pane} aria-label={`${pane} pane`} tabIndex={-1}
              style={{ flex: split ? `${pane === 'primary' ? preferences.ratio : 1 - preferences.ratio} 1 0` : '1' }}
              onPointerDown={() => setActive(pane)} onFocus={() => setActive(pane)}>
              <Fold area={paneArea.toLowerCase()} id={detail ? `detail:${selected}` : 'objects'}
                label={detail && row ? row.title : paneArea} count={detail ? 1 : rows?.length ?? '—'} level={1}
                actions={<>{!detail && paneArea === 'Items' && <ItemsViewSwitcher />}{split && <div className={s.actions}>
                  <button onClick={() => setPreferences(previous => ({ ...previous, area: previous.secondary!, secondary: previous.area,
                    row: previous.secondaryRow, secondaryRow: previous.row, detail: previous.secondaryDetail, secondaryDetail: previous.detail }))}>Swap</button>
                  <button onClick={() => closePane(pane)}>Close</button>
                </div>}</>}>
              {!detail && paneArea === 'Items' && <ItemsView connection={connection} release={release?.id} selected={selected}
                select={id => selectRow(pane, id)} controls={pane === 'primary' ? primaryTree : secondaryTree} />}
              {!detail && paneArea !== 'Items' && <ul className={s.objects} aria-label={`${paneArea} objects`}>
                {rows?.map(object => <li key={object.id}><button className={s.object} data-object-id={object.id}
                  title={object.title} aria-pressed={selected === object.id} onFocus={() => selectRow(pane, object.id)} onClick={() => selectRow(pane, object.id)}>
                  <span className={s.mono}>{object.id}</span> <span>{object.title}</span>
                </button></li>)}
              </ul>}
              {detail && row && (paneArea === 'Items' && findItem(connection, row.id)
                ? <ItemCard key={row.id} item={findItem(connection, row.id)!} connection={connection} />
                : <div className={s.detail}><span className={s.mono}>{row.id}</span><p>{row.title}</p></div>)}
              </Fold>
              {pane === 'primary' && split && <div className={s.divider} role="separator" aria-label="Pane divider"
                aria-orientation="vertical" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(preferences.ratio * 100)}
                onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }}
                onPointerMove={event => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const rect = workspace.current!.getBoundingClientRect();
                  setPreferences(previous => ({ ...previous, ratio: Math.max(0.2, Math.min(0.8, (event.clientX - rect.x) / rect.width)) }));
                }}
                onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} />}
            </section>;
          })}
        </div>
        {drawerOpen && <aside className={s.drawer} aria-label="Drawer">
          <Fold area={preferences.area.toLowerCase()} id={`drawer:${selectedRow.id}`} label={selectedRow.title} count={1} actions={<div className={s.actions}>
            <button title="Open in the other pane (⌘Enter)" onClick={openOther}>Split</button>
            <button onClick={() => { setDismissed(selectionKey); areaButtons.current[preferences.area]?.focus(); }}>Close</button>
          </div>}>
          {preferences.area === 'Items' && findItem(connection, selectedRow.id)
            ? <ItemCard key={selectedRow.id} item={findItem(connection, selectedRow.id)!} connection={connection} />
            : <div className={s.detail}><span className={s.mono}>{selectedRow.id}</span><p>{selectedRow.title}</p></div>}
          </Fold>
        </aside>}
      </main>
    </div>
  </div>;
}
