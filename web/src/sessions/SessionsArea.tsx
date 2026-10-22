import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { AreaControls, AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { AreaObjectDetail } from '../AreaObjects.tsx';

import { SessionsHeader } from './SessionsHeader.tsx';
import { AccountsStrip } from './AccountsStrip.tsx';
import { VerifyLine } from './VerifyLine.tsx';
import { SessionGroups } from './SessionGroups.tsx';

function SessionsArea(props: AreaContentProps) {
  const [archived, setArchived] = useState(false);
  const groups = useRef<AreaControls>(null);
  const toggle = () => setArchived(value => !value);
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
function SessionPage(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="page" data-key-context="sessions"><AreaObjectDetail {...props} /></section>;
}
function SessionDrawer(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="drawer" data-key-context="sessions"><AreaObjectDetail {...props} /></section>;
}
export const sessionsModule: AreaModule = { context: 'sessions', handledActions: ['session-next', 'session-previous', 'session-archive-toggle'], Pane: SessionsArea, Page: SessionPage, Drawer: SessionDrawer };
