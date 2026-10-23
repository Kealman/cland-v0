import type { EventSubject } from '../../shared/wire/index.ts';
import type { ComponentType, Ref } from 'react';
import { type Area, type KeyContext, type Shortcut } from './keymap.ts';
import type { ConnectionState, ObjectRow } from './connection.ts';
import { eventsModule } from './EventsArea.tsx';
import { inboxModule } from './InboxArea.tsx';
import { topicsModule } from './TopicsArea.tsx';
import { sessionsModule } from './sessions/SessionsArea.tsx';
import { accountsModule } from './accounts/AccountsArea.tsx';
import { artifactsModule } from './artifacts/ArtifactsArea.tsx';

export type SlottedArea = Exclude<Area, 'Items'>;
export type AreaControls = { run: (action: Shortcut) => boolean };
export type AreaContentProps = {
  split?: boolean;
  splitSelection?: () => void;
  area: SlottedArea;
  connection: ConnectionState;
  rows: readonly ObjectRow[] | undefined;
  selected: string | undefined;
  select: (id: string) => void;
  open?: () => void;
  navigate?: (area: Area) => void;
  targetMessage?: string | undefined;
  focusThread?: number | undefined;
  openTopic?: (topic: string, message?: string) => void;
  openPlan?: (id: string) => void;
  openSubject?: (subject: EventSubject) => void;
  openPage?: (id: string) => void;
  closePage?: () => void;
  controls?: Ref<AreaControls>;
};
export type AreaModule = {
  context: KeyContext;
  handledActions: readonly Shortcut[];
  Pane: ComponentType<AreaContentProps>;
  Page: ComponentType<AreaContentProps>;
  Drawer: ComponentType<AreaContentProps>;
};


/** Each area's module owns its content and declares only the actions it implements. */
export const areaModules: Readonly<Record<SlottedArea, AreaModule>> = {
  Inbox: inboxModule, Sessions: sessionsModule, Topics: topicsModule,
  Events: eventsModule, Artifacts: artifactsModule, Accounts: accountsModule,
};

export function AreaSlot({ surface, ...props }: AreaContentProps & { surface: 'pane' | 'page' | 'drawer' }) {
  const module = areaModules[props.area];
  const Content = surface === 'pane' ? module.Pane : surface === 'page' ? module.Page : module.Drawer;
  return <Content {...props} />;
}
