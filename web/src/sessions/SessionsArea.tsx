import { useEffect, useImperativeHandle, useRef, useSyncExternalStore } from 'react';
import type { AreaControls, AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { AreaObjectDetail } from '../AreaObjects.tsx';

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

function SessionsArea(props: AreaContentProps) {
  const archived = useSyncExternalStore(subscribeArchive, () => archivedVisible);
  const groups = useRef<AreaControls>(null);
  const toggle = toggleArchive;
  const load = props.connection.loadArchivedSessions;
  const live = props.connection.live;
  useEffect(() => { if (archived && live) load?.(); }, [archived, live, load]);
  useImperativeHandle(props.controls, () => ({ run(action) {
    if (action === 'session-archive-toggle') { toggle(); return true; }
    return groups.current?.run(action) ?? false;
  } }));
  return <section data-area-module="Sessions" data-area-surface="pane" data-key-context="sessions">
    <SessionsHeader connection={props.connection} archived={archived} toggle={toggle} /><AccountsStrip {...props} /><VerifyLine {...props} /><SessionGroups {...props} controls={groups} archived={archived} />
  </section>;
}
function SessionDrawer(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="drawer" data-key-context="sessions"><AreaObjectDetail {...props} /></section>;
}
export const sessionsModule: AreaModule = { context: 'sessions', handledActions: ['session-next', 'session-previous', 'session-archive-toggle', 'session-stop', 'session-resume', 'session-archive', 'session-capabilities', 'session-open', 'dismiss'], Pane: SessionsArea, Page: SessionPage, Drawer: SessionDrawer };
