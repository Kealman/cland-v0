import type { AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { AreaObjects, AreaObjectDetail } from '../AreaObjects.tsx';

function AccountsArea(props: AreaContentProps) {
  return <section data-area-module="Accounts" data-area-surface="pane" data-key-context="accounts"><AreaObjects {...props} /></section>;
}
function AccountPage(props: AreaContentProps) {
  return <section data-area-module="Accounts" data-area-surface="page" data-key-context="accounts"><AreaObjectDetail {...props} /></section>;
}
function AccountDrawer(props: AreaContentProps) {
  return <section data-area-module="Accounts" data-area-surface="drawer" data-key-context="accounts"><AreaObjectDetail {...props} /></section>;
}
export const accountsModule: AreaModule = { context: 'accounts', handledActions: [], Pane: AccountsArea, Page: AccountPage, Drawer: AccountDrawer };
