import type { ComponentType, Ref } from 'react';
import { areaContext, type Area, type KeyContext, type Shortcut } from './keymap.ts';
import type { ObjectRow } from './connection.ts';
import { ItemText } from './ItemText.tsx';
import s from './Shell.module.css';

export type SlottedArea = Exclude<Area, 'Items'>;
export type AreaControls = { run: (action: Shortcut) => boolean };
export type AreaContentProps = {
  area: SlottedArea;
  rows: readonly ObjectRow[] | undefined;
  selected: string | undefined;
  select: (id: string) => void;
  controls?: Ref<AreaControls>;
};
export type AreaModule = {
  context: KeyContext;
  handledActions: readonly Shortcut[];
  Pane: ComponentType<AreaContentProps>;
  Drawer: ComponentType<AreaContentProps>;
};

function StandInList({ area, rows, selected, select }: AreaContentProps) {
  return <ul className={s.objects} aria-label={`${area} objects`}>
    {rows?.map(object => <li key={object.id}><button className={s.object} data-object-id={object.id}
      title={object.title} aria-pressed={selected === object.id} onFocus={() => select(object.id)} onClick={() => select(object.id)}>
      <span className={s.mono}>{object.id}</span> <span>{object.title}</span>
    </button></li>)}
  </ul>;
}
function StandInDetail({ rows, selected }: AreaContentProps) {
  const row = rows?.find(object => object.id === selected);
  return row && <div className={s.detail}><span className={s.mono}>{row.id}</span><p><ItemText text={row.title} /></p></div>;
}
const standIn = (area: SlottedArea): AreaModule => ({ context: areaContext(area), handledActions: [], Pane: StandInList, Drawer: StandInDetail });

/** Each area's module owns its content and declares only the actions it implements. */
export const areaModules: Readonly<Record<SlottedArea, AreaModule>> = {
  Inbox: standIn('Inbox'), Sessions: standIn('Sessions'), Topics: standIn('Topics'),
  Events: standIn('Events'), Artifacts: standIn('Artifacts'), Accounts: standIn('Accounts'),
};

export function AreaSlot({ surface, ...props }: AreaContentProps & { surface: 'pane' | 'drawer' }) {
  const module = areaModules[props.area];
  const Content = surface === 'pane' ? module.Pane : module.Drawer;
  return <Content {...props} />;
}
