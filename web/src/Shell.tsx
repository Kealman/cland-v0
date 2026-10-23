// The frame ported from Q-405's App.tsx, connected to the production web edge.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { browserNotifications } from './browser-notifications.ts';
import type { NotificationNotice } from './notification-rules.ts';
import { artifactSelection } from './artifacts/state.ts';
import { connectHub, findItem, type ConnectionState, type ObjectRow } from './connection.ts';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import { areas, areaKey, actionKeys, displayKey, treeActions, planActions, contextActions, areaContext, type KeyContext, type Area, type Shortcut } from './keymap.ts';
import { focusedKeyContext, listenForShortcuts } from './keyboard.ts';
import s from './Shell.module.css';
import { PaletteDialog, type PaletteControls } from './Palette.tsx';
import { runApprovalShortcut } from './ApprovalCard.tsx';
import { AskNavigation, runAskShortcut } from './AskCard.tsx';
import { ComposerPicker, type ComposerSelection } from './ComposerPicker.ts';
import { runComposerShortcut } from './Composer.tsx';
import { Fold, runFoldShortcut } from './Fold.tsx';
import { ItemCard } from './ItemCard.tsx';
import { ItemNavigation } from './ItemText.tsx';
import { itemsSnapshot, saveItems, subscribeItems } from './items-state.ts';
import type { MessageTarget } from './QuickMessage.tsx';
import { type TreeControls } from './ItemsTree.tsx';
import { ItemsView, ItemsViewSwitcher, showItemsView, useItemsView } from './ItemsView.tsx';

import { InboxVisitProvider } from './inbox-visit.tsx';
import { AreaSlot, areaModules, type AreaControls } from './AreaSlot.tsx';
import { useDesktop } from './desktop.ts';
import type { Artifact } from '../../shared/wire/index.ts';
import { ArtifactNavigation, ArtifactViewerFallback } from './artifacts/ArtifactNavigation.ts';
import { TopicArtifactsProvider } from './artifacts/TopicArtifacts.tsx';

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
  const [composerSelection, setComposerSelection] = useState<ComposerSelection>();
  const pendingPaletteAction = useRef<Shortcut | undefined>(undefined);
  const [overlayContext, setOverlayContext] = useState<KeyContext>('shell');
  const [active, setActive] = useState<'primary' | 'secondary'>('primary');
  const navigationSerial = useRef(0);
  useEffect(() => subscribeItems(() => { navigationSerial.current++; }), []);
  const focusPane = (pane: 'primary' | 'secondary') => {
    if (pane !== active) navigationSerial.current++;
    setActive(pane);
  };
  const split = preferences.secondary !== undefined;
  const area = active === 'secondary' && preferences.secondary ? preferences.secondary : preferences.area;
  const setArea = (selected: Area, pane = active) => {
    navigationSerial.current++;
    setPreferences(previous => pane === 'secondary' && previous.secondary
      ? { ...previous, secondary: selected, secondaryRow: undefined, secondaryDetail: false } : { ...previous, area: selected, row: undefined, detail: false });
  };
  const inboxWasActive = useRef(area === 'Inbox');
  useEffect(() => {
    if (inboxWasActive.current && area !== 'Inbox') setPreferences(previous => ({ ...previous,
      ...(previous.area === 'Inbox' && !previous.detail ? { row: undefined } : {}),
      ...(previous.secondary === 'Inbox' && !previous.secondaryDetail ? { secondaryRow: undefined } : {}) }));
    inboxWasActive.current = area === 'Inbox';
  }, [area]);
  const dismissed = preferences.dismissed;
  const setDismissed = (key: string | undefined) => setPreferences(previous => ({ ...previous, dismissed: key }));
  const selectionKey = `${preferences.area}/${preferences.row ?? ''}`;
  const selectRow = (pane: 'primary' | 'secondary', id: string) => {
    if (id !== (pane === 'primary' ? preferences.row : preferences.secondaryRow)) { navigationSerial.current++; setDismissed(undefined); setMessage(undefined); }
    setPreferences(previous => pane === 'primary' ? { ...previous, row: id } : { ...previous, secondaryRow: id });
  };
  const areaButtons = useRef<Partial<Record<Area, HTMLButtonElement>>>({});
  const workspace = useRef<HTMLDivElement>(null);
  const closePane = (pane: 'primary' | 'secondary') => {
    navigationSerial.current++;
    setDismissed(selectionKey);
    setPreferences(previous => pane === 'primary'
      ? { ...previous, area: previous.secondary ?? previous.area, row: previous.secondaryRow, detail: previous.secondaryDetail, secondary: undefined, secondaryRow: undefined, dismissed: `${previous.secondary}/${previous.secondaryRow ?? ''}` }
      : { ...previous, secondary: undefined, secondaryRow: undefined });
    setActive('primary');
  };
  const openOther = () => {
    navigationSerial.current++;
    const selected = active === 'primary' ? preferences.row : preferences.secondaryRow;
    if (!selected) return;
    setDismissed(selectionKey);
    setPreferences(previous => active === 'primary'
      ? { ...previous, secondary: previous.area, secondaryRow: selected, secondaryDetail: true, ratio: split ? previous.ratio : 2 / 3 }
      : { ...previous, area: previous.secondary!, row: selected, detail: true });
  };
  const primaryArea = useRef<AreaControls>(null);
  const secondaryArea = useRef<AreaControls>(null);
  const view = useItemsView();
  const desktop = useDesktop();
  const focusedContext = overlay ? overlayContext : areaContext(area);
  const handledActions = focusedContext === 'composer' || focusedContext === 'reply' || focusedContext === 'approval' || focusedContext === 'approval-note' ? contextActions[focusedContext] ?? [] : area === 'Items'
    ? (view === 'plan' ? planActions.filter(row => desktop || row.action !== 'plan-approve') : treeActions)
    : (contextActions[focusedContext] ?? []).filter(row => focusedContext === 'ask' && row.action.startsWith('ask-') || areaModules[area].handledActions.includes(row.action));
  const paletteControls = useRef<PaletteControls>(null);
  const cardOrigin = useRef<{ item: string; pane: string } | null>(null);
  const primaryTree = useRef<TreeControls>(null);
  const secondaryTree = useRef<TreeControls>(null);
  const [threadTargets, setThreadTargets] = useState<Partial<Record<'primary' | 'secondary', { topic: string; message?: string | undefined }>>>({});
  const [navigationError, setNavigationError] = useState('');
  const [message, setMessage] = useState<MessageTarget>();
  const openOverlay = (mode: 'palette' | 'help') => {
    setComposerSelection(undefined);
    if (!overlay) {
      const context = focusedKeyContext(document.activeElement, areaContext(area));
      setOverlayContext(context === 'shell' ? areaContext(area) : context);
    }
    setOverlay(mode);
  };
  const runShortcut = (action: Shortcut) => {
    if (!overlay && action.startsWith('jump-')) {
      const focused = document.activeElement?.closest('[data-item-link]')?.getAttribute('data-item-link');
      const selectedId = focused ?? (active === 'primary' ? preferences.row : preferences.secondaryRow);
      const id = connection.topics?.find(topic => topic.id === selectedId)?.item ?? selectedId;
      const item = findItem(connection, id);
      if (action === 'jump-item' && id) void openItem(id);
      else if (action === 'jump-topic' && item) {
        const topic = connection.topics?.find(value => value.item === item.id);
        if (topic) openResult('Topics', topic, false);
      } else if (action === 'jump-session' && (item?.claim?.session || connection.coordinator)) {
        const name = item?.claim?.session ?? connection.coordinator!;
        openResult('Sessions', { id: name, title: name }, false);
      }
      return;
    }
    if (!overlay && area === 'Items' && (action === 'tree-message' || action === 'tree-topic-message')) {
      const id = active === 'primary' ? preferences.row : preferences.secondaryRow;
      if (id) {
        const selection = itemsSnapshot().selection;
        setDismissed(undefined);
        if (split) openOther();
        setMessage({ card: id, ids: selection.length ? selection : [id], topic: action === 'tree-topic-message', selection: selection.length > 0, serial: (message?.serial ?? 0) + 1 });
      }
      return;
    }
    if (!overlay && area === 'Items') {
      const focused = document.activeElement;
      if (action === 'tree-edit-criteria') {
        focused?.closest('[data-criteria-block]')?.querySelector<HTMLButtonElement>('[data-criteria-toggle][aria-expanded="false"]')?.click();
        return;
      }
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
      if ((action === 'accept' || action === 'tree-open' && !focused?.hasAttribute('aria-expanded')) && focused?.getAttribute('role') === 'treeitem') {
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
    if (!overlay && area !== 'Items' && areaModules[area].handledActions.includes(action) && (active === 'primary' ? primaryArea : secondaryArea).current?.run(action)) return;
    if (!overlay && runApprovalShortcut(action)) return;
    if (!overlay && runAskShortcut(action)) return;
    if (!overlay && runComposerShortcut(action)) return;
    if (runFoldShortcut(action)) return;
    if (action === 'palette') openOverlay('palette');
    else if (overlay) paletteControls.current?.run(action);
    else if (action === 'help') openOverlay('help');
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
  // Modal cleanup restores the originating focus before contextual actions run.
  useEffect(() => {
    if (overlay || !pendingPaletteAction.current) return;
    const action = pendingPaletteAction.current;
    pendingPaletteAction.current = undefined;
    keyboard.current.run(action);
  }, [overlay]);
  useEffect(() => listenForShortcuts(action => keyboard.current.run(action), target => {
    const current = keyboard.current;
    return current.overlay ?? focusedKeyContext(target, current.area === 'Items' ? 'items' : areaModules[current.area].context);
  }, (action, context) => {
    if (context === 'shell' || context === 'composer' || context === 'reply' || context === 'ask' || context === 'approval' || context === 'approval-note' || context === 'items' || context === 'palette' || context === 'help') return true;
    const current = keyboard.current.area;
    return current !== 'Items' && areaModules[current].handledActions.includes(action);
  }), []);
  const [connection, setConnection] = useState<ConnectionState>({ project: 'Workbench', live: false });
  const [openedArtifacts, setOpenedArtifacts] = useState<Artifact[]>([]);
  const notificationOpen = useRef<(target: NotificationNotice['target']) => void>(() => {});
  useEffect(() => {
    const notifications = browserNotifications(target => notificationOpen.current(target));
    const disconnect = connectHub(setConnection, notifications.receive);
    return () => { disconnect(); notifications.close(); };
  }, []);
  useEffect(() => {
    document.title = `${connection.needsYou ? `(${connection.needsYou}) ` : ''}${connection.project} · cland`;
  }, [connection.project, connection.needsYou]);
  const openResult = (target: Area, row: ObjectRow, pane: boolean) => {
    navigationSerial.current++;
    setMessage(undefined);
    setPreferences(previous => {
      if (pane) return active === 'primary'
        ? { ...previous, secondary: target, secondaryRow: row.id, secondaryDetail: true, dismissed: selectionKey, ratio: split ? previous.ratio : 2 / 3 }
        : { ...previous, area: target, row: row.id, detail: true, dismissed: `${target}/${row.id}` };
      return active === 'secondary' && previous.secondary
        ? { ...previous, secondary: target, secondaryRow: row.id, secondaryDetail: true }
        : { ...previous, area: target, row: row.id, detail: false, dismissed: undefined };
    });
  };
  const selectedRow = preferences.area === 'Items' ? findItem(connection, preferences.row) : preferences.area === 'Artifacts' ? artifactSelection(connection.artifacts, preferences.row) : connection.rows?.[preferences.area]?.find(row => row.id === preferences.row);
  const drawerOpen = !split && preferences.area !== 'Topics' && preferences.area !== 'Inbox' && preferences.area !== 'Events' && selectedRow && dismissed !== selectionKey && !preferences.detail;
  const releases = connection.releases ?? [];
  const release = releases.find(item => item.id === preferences.release) ?? releases[0];
  const counts: Partial<Record<Area, number | undefined>> = {
    Inbox: connection.needsYou, Items: connection.plans,
    Sessions: connection.approvals, Topics: connection.waitingTopics,
  };
  const openItem = async (id: string, detail = false) => {
    const serial = ++navigationSerial.current;
    setNavigationError('');
    setMessage(undefined);
    try {
      const result = await connection.resolveItem?.(id);
      if (serial !== navigationSerial.current) return;
      if (!result) { setNavigationError(id); return; }
      const { item, ancestors } = result;
      const state = itemsSnapshot();
      const open: Record<string, boolean> = { ...state.open, ':categories': true, ':unscheduled': true, ':releases': true };
      let releaseId: string | undefined;
      for (const parent of [item, ...ancestors]) {
        open[parent.id] = true; open[`:direct:${parent.id}`] = true; open[`:more:${parent.id}`] = true;
        if (parent.kind === connection.tracker?.levels[0]) releaseId = parent.id;
      }
      showItemsView('tree');
      saveItems({ ...state, open, scope: undefined, hideDone: false, archive: true, back: [...state.back, state.scope] });
      setPreferences(previous => active === 'primary' ? { ...previous, area: 'Items', row: item.id, detail, dismissed: undefined, release: releaseId ?? previous.release }
        : { ...previous, secondary: 'Items', secondaryRow: item.id, secondaryDetail: detail, dismissed: undefined, release: releaseId ?? previous.release });
    } catch { if (serial === navigationSerial.current) setNavigationError(id); }
  };
  useEffect(() => { notificationOpen.current = target => {
    if (target.area === 'Items') { setOverlay(undefined); void openItem(target.id, true); return; }
    navigationSerial.current++;
    // Native notification clicks run outside React. Commit the destination and
    // palette focus cleanup before focusing its row; hidden pages may have no frames.
    flushSync(() => {
      setOverlay(undefined);
      setMessage(undefined);
      setPreferences(previous => active === 'secondary' && previous.secondary
        ? { ...previous, secondary: 'Inbox', secondaryRow: target.id, secondaryDetail: false, dismissed: undefined }
        : { ...previous, area: 'Inbox', row: target.id, detail: false, dismissed: undefined });
    });
    workspace.current?.querySelector<HTMLElement>(`[data-pane="${active}"] [data-area-module="Inbox"][data-area-surface="pane"] [data-object-id="${CSS.escape(target.id)}"]`)?.focus();
  }; });
  return <TopicArtifactsProvider><InboxVisitProvider connection={connection} active={area === 'Inbox'}><ComposerPicker.Provider value={selection => { setOverlayContext(selection.kind === 'Subjects' ? 'events' : 'composer'); setComposerSelection(selection); setOverlay('palette'); }}><AskNavigation.Provider value={(id, source) => {
    const pane = source.closest('[data-pane]')?.getAttribute('data-pane') === 'secondary' ? 'secondary' : 'primary';
    navigationSerial.current++;
    setMessage(undefined);
    setActive(pane);
    setPreferences(previous => pane === 'secondary'
      ? { ...previous, secondary: 'Inbox', secondaryRow: id, secondaryDetail: false }
      : { ...previous, area: 'Inbox', row: id, detail: false, dismissed: undefined });
    requestAnimationFrame(() => workspace.current?.querySelector<HTMLElement>(`[data-pane="${pane}"] [data-area-module="Inbox"][data-area-surface="pane"] [data-ask-id="${CSS.escape(id)}"]`)?.focus());
  }}><ArtifactNavigation.Provider value={(artifact, source) => {
    navigationSerial.current++;
    setMessage(undefined);
    setOpenedArtifacts(previous => [...previous.filter(row => row.id !== artifact.id), artifact]);
    const pane = source.closest('[data-pane]')?.getAttribute('data-pane') ?? active;
    setPreferences(previous => pane === 'primary'
      ? { ...previous, secondary: 'Artifacts', secondaryRow: artifact.id, secondaryDetail: true, dismissed: selectionKey, ratio: split ? previous.ratio : 2 / 3 }
      : { ...previous, area: 'Artifacts', row: artifact.id, detail: true, dismissed: `Artifacts/${artifact.id}` });
  }}><ItemNavigation.Provider value={{ open: id => { void openItem(id); }, prefixes: ['T', ...Object.values(connection.tracker?.prefixes ?? {})] }}><div className={s.app}>
    {navigationError && <div role="alert" title={`Could not open ${navigationError}`}>Item unavailable · {navigationError}</div>}
    {overlay && <PaletteDialog mode={overlay} area={area} context={overlayContext} actions={handledActions} connection={connection} controls={paletteControls} selection={composerSelection}
      close={() => { setOverlay(undefined); setComposerSelection(undefined); }} run={action => {
        if (action === 'palette' || action === 'help') openOverlay(action);
        else { pendingPaletteAction.current = action; setOverlay(undefined); }
      }} open={openResult} />}
    <header className={s.top}>
      <span className={s.brand}>cland</span>
      <span className={s.project} aria-label="Project">{connection.project}</span>
      <label className={s.release}>
        <span className={s.mono} data-item-id>{release?.id ?? '—'}</span>
        <select aria-label="Release" value={release?.id ?? ''} title={release?.title ?? 'No open release'}
          onChange={event => { navigationSerial.current++; setPreferences({ ...preferences, release: event.target.value }); }}>
          {!releases.length && <option value="">Release —</option>}
          {releases.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <button className={s.search} aria-label="Palette" title={`Palette (${actionKeys('palette').map(displayKey).join(' / ')})`} onClick={() => openOverlay('palette')}>Search<kbd>{displayKey(actionKeys('palette')[0]!)}</kbd></button>
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
        <button className={s.help} aria-label="Help" title="Area keys" onClick={() => openOverlay('help')}>?</button>
      </div>
    </header>
    <div className={s.body}>
      <aside className={s.sidebar} data-collapsed={split || preferences.collapsed}>
        <nav data-area-navigation className={s.rail} aria-label="Areas">
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
            const fallback = detail && paneArea === 'Artifacts' ? openedArtifacts.find(artifact => artifact.id === selected) : undefined;
            const row = paneArea === 'Items' ? findItem(connection, selected) : paneArea === 'Artifacts' ? artifactSelection(connection.artifacts, selected) ?? fallback : rows?.find(object => object.id === selected);
            return <section key={pane} className={s.pane} data-pane={pane} aria-label={`${pane} pane`} tabIndex={-1}
              style={{ flex: split ? `${pane === 'primary' ? preferences.ratio : 1 - preferences.ratio} 1 0` : '1' }}
              onPointerDown={() => focusPane(pane)} onFocus={() => focusPane(pane)}>
              <Fold area={paneArea.toLowerCase()} id={detail ? `detail:${selected}` : 'objects'}
                label={detail && row ? row.title : paneArea} count={detail ? 1 : rows?.length ?? '—'} level={1}
                actions={<>{!detail && paneArea === 'Items' && <ItemsViewSwitcher onChange={() => { navigationSerial.current++; }} />}{split && <div className={s.actions}>
                  <button onClick={() => { navigationSerial.current++; setPreferences(previous => ({ ...previous, area: previous.secondary!, secondary: previous.area,
                    row: previous.secondaryRow, secondaryRow: previous.row, detail: previous.secondaryDetail, secondaryDetail: previous.detail })); }}>Swap</button>
                  <button onClick={() => closePane(pane)}>Close</button>
                </div>}</>}>
              {!detail && paneArea === 'Items' && <ItemsView onNavigate={() => { navigationSerial.current++; }} connection={connection} release={release?.id} selected={selected}
                select={id => selectRow(pane, id)} controls={pane === 'primary' ? primaryTree : secondaryTree} />}
              {paneArea !== 'Items' && <ArtifactViewerFallback.Provider value={fallback}><AreaSlot split={split} splitSelection={openOther} connection={connection} area={paneArea} rows={rows} selected={selected} select={id => selectRow(pane, id)}
                open={() => { setDismissed(undefined); if (split) openOther(); }}
                openSubject={async subject => {
                  const serial = ++navigationSerial.current;
                  const target = subject.kind === 'session' ? 'Sessions' : subject.kind === 'topic' ? 'Topics' : subject.kind === 'artifact' ? 'Artifacts' : undefined;
                  if (!target) return;
                  try {
                    if (subject.kind === 'artifact') {
                      const artifact = connection.artifacts?.find(row => row.id === subject.id) ??
                        (await connection.command?.<{ artifact: Artifact }>({ type: 'artifact.list', artifact: subject.id }))?.artifact;
                      if (serial !== navigationSerial.current) return;
                      if (!artifact) throw new Error('Artifact unavailable');
                      setOpenedArtifacts(previous => [...previous.filter(row => row.id !== artifact.id), artifact]);
                    }
                    setPreferences(previous => pane === 'primary'
                      ? { ...previous, area: target, row: subject.id, detail: subject.kind === 'artifact', dismissed: undefined }
                      : { ...previous, secondary: target, secondaryRow: subject.id, secondaryDetail: subject.kind === 'artifact', dismissed: undefined });
                  } catch { if (serial === navigationSerial.current) setNavigationError(subject.id); }
                }}
                navigate={target => setArea(target, pane)}
                targetMessage={threadTargets[pane]?.topic === selected ? threadTargets[pane]?.message : undefined}
                openTopic={(topic, message) => {
                  navigationSerial.current++;
                  setThreadTargets(previous => ({ ...previous, [pane]: { topic, message } }));
                  setPreferences(previous => pane === 'primary' ? { ...previous, area: 'Topics', row: topic, detail: false } : { ...previous, secondary: 'Topics', secondaryRow: topic, secondaryDetail: false });
                }}
                openPlan={id => {
                  navigationSerial.current++; showItemsView('plan');
                  setPreferences(previous => pane === 'primary' ? { ...previous, area: 'Items', row: id, detail: false } : { ...previous, secondary: 'Items', secondaryRow: id, secondaryDetail: false });
                }}
                openPage={id => { navigationSerial.current++; setPreferences(previous => pane === 'primary'
                  ? { ...previous, row: id, detail: true } : { ...previous, secondaryRow: id, secondaryDetail: true }); }}
                closePage={() => {
                  navigationSerial.current++;
                  setPreferences(previous => pane === 'primary' ? { ...previous, detail: false, dismissed: selectionKey }
                    : { ...previous, secondaryDetail: false });
                  requestAnimationFrame(() => {
                    const rows = workspace.current?.querySelectorAll<HTMLButtonElement>(`[data-pane="${pane}"] [data-object-id]`);
                    [...rows ?? []].find(node => node.dataset.objectId === selected)?.focus();
                  });
                }}
                controls={pane === 'primary' ? primaryArea : secondaryArea} surface={detail ? 'page' : 'pane'} /></ArtifactViewerFallback.Provider>}
              {detail && row && paneArea === 'Items' && findItem(connection, row.id) &&
                <ItemCard key={row.id} item={findItem(connection, row.id)!} connection={connection} message={message?.card === row.id ? message : undefined} />}
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
        {drawerOpen && <aside className={s.drawer} data-drawer-area={preferences.area} aria-label="Drawer">
          <Fold area={preferences.area.toLowerCase()} id={`drawer:${selectedRow.id}`} label={selectedRow.title} count={1} actions={<div className={s.actions}>
            <button title="Open in the other pane (⌘Enter)" onClick={openOther}>Split</button>
            <button onClick={() => { setDismissed(selectionKey); areaButtons.current[preferences.area]?.focus(); }}>Close</button>
          </div>}>
          {preferences.area === 'Items' && findItem(connection, selectedRow.id)
            ? <ItemCard key={selectedRow.id} item={findItem(connection, selectedRow.id)!} connection={connection} message={message?.card === selectedRow.id ? message : undefined} />
            : preferences.area !== 'Items' && <AreaSlot connection={connection} area={preferences.area} rows={connection.rows?.[preferences.area]} selected={selectedRow.id}
              select={id => selectRow('primary', id)} surface="drawer" />}
          </Fold>
        </aside>}
      </main>
    </div>
  </div></ItemNavigation.Provider></ArtifactNavigation.Provider></AskNavigation.Provider></ComposerPicker.Provider></InboxVisitProvider></TopicArtifactsProvider>;
}
