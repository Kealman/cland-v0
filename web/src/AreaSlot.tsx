import type { ComponentType, Ref } from 'react';
import { areaContext, type Area, type KeyContext, type Shortcut } from './keymap.ts';
import type { ConnectionState, ObjectRow } from './connection.ts';
import { AreaObjects, AreaObjectDetail } from './AreaObjects.tsx';
import { sessionsModule } from './sessions/SessionsArea.tsx';
import { accountsModule } from './accounts/AccountsArea.tsx';
import { artifactsModule } from './artifacts/ArtifactsArea.tsx';

export type SlottedArea = Exclude<Area, 'Items'>;
export type AreaControls = { run: (action: Shortcut) => boolean };
export type AreaContentProps = {
  area: SlottedArea;
  connection: ConnectionState;
  rows: readonly ObjectRow[] | undefined;
  selected: string | undefined;
  select: (id: string) => void;
  controls?: Ref<AreaControls>;
};
export type AreaModule = {
  context: KeyContext;
  handledActions: readonly Shortcut[];
  Pane: ComponentType<AreaContentProps>;
  Page: ComponentType<AreaContentProps>;
  Drawer: ComponentType<AreaContentProps>;
};

const standIn = (area: SlottedArea): AreaModule => ({ context: areaContext(area), handledActions: [], Pane: AreaObjects, Page: AreaObjectDetail, Drawer: AreaObjectDetail });

/** Each area's module owns its content and declares only the actions it implements. */
export const areaModules: Readonly<Record<SlottedArea, AreaModule>> = {
  Inbox: standIn('Inbox'), Sessions: sessionsModule, Topics: standIn('Topics'),
  Events: standIn('Events'), Artifacts: artifactsModule, Accounts: accountsModule,
};

export function AreaSlot({ surface, ...props }: AreaContentProps & { surface: 'pane' | 'page' | 'drawer' }) {
  const module = areaModules[props.area];
  const Content = surface === 'pane' ? module.Pane : surface === 'page' ? module.Page : module.Drawer;
  return <Content {...props} />;
}
