import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react';
import type { AreaControls, AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { AreaObjectDetail } from '../AreaObjects.tsx';

import { SessionLaunch } from './SessionLaunch.tsx';
import { SessionsHeader } from './SessionsHeader.tsx';
import { AccountsStrip } from './AccountsStrip.tsx';
import { VerifyLine } from './VerifyLine.tsx';
import { SessionGroups } from './SessionGroups.tsx';
import { SessionPage } from './SessionPage.tsx';

// Keep the list context while its page occupies the pane, including without storage.
let archivedVisible = false;
const archiveListeners = new Set<() => void>();
function subscribeArchive(listener: () => void) {
  archiveListeners.add(listener);
  return () => { archiveListeners.delete(listener); };
}
function toggleArchive() {
  archivedVisible = !archivedVisible;
  for (const listener of archiveListeners) listener();
}

function SessionsArea(props: AreaContentProps & { page?: boolean }) {
  const archived = useSyncExternalStore(subscribeArchive, () => archivedVisible);
  const [launch, setLaunch] = useState<'session' | 'aide' | null>(null);
  const launcher = useRef<AreaControls>(null);
  const groups = useRef<AreaControls>(null);
  const toggle = toggleArchive;
  const load = props.connection.loadArchivedSessions;
  const live = props.connection.live;
  useEffect(() => { if (archived && live) load?.(); }, [archived, live, load]);
  useImperativeHandle(props.controls, () => ({ run(action) {
    if (launch) return launcher.current?.run(action) ?? true;
    if (action === 'session-launch' || action === 'session-aide') { if (live && props.connection.roles?.roles.length) setLaunch(action === 'session-aide' ? 'aide' : 'session'); return true; }
    if (action === 'session-open') {
      const toggle = document.activeElement?.closest('[data-session-slot="verification"]')?.querySelector<HTMLButtonElement>('[data-fold-toggle]');
      if (toggle) { toggle.click(); return true; }
    }
    if (action === 'session-archive-toggle') { toggle(); return true; }
    return groups.current?.run(action) ?? false;
  } }));
  const launchForm = launch && <SessionLaunch connection={props.connection} aide={launch === 'aide'} controls={launcher} close={() => setLaunch(null)} />;
  if (props.page) return <SessionPage {...props} controls={groups}>{launchForm}</SessionPage>;
  return <section data-area-module="Sessions" data-area-surface="pane" data-key-context="sessions">
    <SessionsHeader connection={props.connection} archived={archived} toggle={toggle} launching={!!launch} launch={aide => setLaunch(aide ? 'aide' : 'session')} />
    {launchForm}
    <AccountsStrip {...props} /><VerifyLine {...props} /><SessionGroups {...props} controls={groups} archived={archived} />
  </section>;
}
function SessionsPage(props: AreaContentProps) { return <SessionsArea {...props} page />; }
function SessionDrawer(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="drawer" data-key-context="sessions"><AreaObjectDetail {...props} /></section>;
}
export const sessionsModule: AreaModule = { context: 'sessions', handledActions: ['session-launch', 'session-aide', 'accept', 'session-next', 'session-previous', 'session-archive-toggle', 'session-stop', 'session-resume', 'session-archive', 'session-capabilities', 'session-open', 'dismiss'], Pane: SessionsArea, Page: SessionsPage, Drawer: SessionDrawer };
