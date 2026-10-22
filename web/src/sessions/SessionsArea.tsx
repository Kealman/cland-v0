import type { AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { AreaObjects, AreaObjectDetail } from '../AreaObjects.tsx';

import { SessionsHeader } from './SessionsHeader.tsx';
import { AccountsStrip } from './AccountsStrip.tsx';
import { VerifyLine } from './VerifyLine.tsx';
import { SessionGroups } from './SessionGroups.tsx';

function SessionsArea(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="pane" data-key-context="sessions">
    <SessionsHeader {...props} /><AccountsStrip {...props} /><VerifyLine {...props} /><SessionGroups {...props} />
    <AreaObjects {...props} />
  </section>;
}
function SessionPage(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="page" data-key-context="sessions"><AreaObjectDetail {...props} /></section>;
}
function SessionDrawer(props: AreaContentProps) {
  return <section data-area-module="Sessions" data-area-surface="drawer" data-key-context="sessions"><AreaObjectDetail {...props} /></section>;
}
export const sessionsModule: AreaModule = { context: 'sessions', handledActions: [], Pane: SessionsArea, Page: SessionPage, Drawer: SessionDrawer };
