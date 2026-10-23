import type { AreaContentProps } from './AreaSlot.tsx';
import { ItemText } from './ItemText.tsx';
import s from './Shell.module.css';

/** Temporary inventory shared by area modules until their full views land. */
export function AreaObjects({ area, rows, selected, select, label }: AreaContentProps & { label?: string }) {
  return <ul className={s.objects} aria-label={label ?? `${area} objects`}>
    {rows?.map(object => <li key={object.id}><button className={s.object} data-object-id={object.id}
      title={object.title} aria-pressed={selected === object.id} onFocus={() => select(object.id)} onClick={() => select(object.id)}>
      <span className={s.mono}>{object.id}</span> <span>{object.title}</span>
    </button></li>)}
  </ul>;
}
export function AreaObjectDetail({ rows, selected }: AreaContentProps) {
  const row = rows?.find(object => object.id === selected);
  return row && <div className={s.detail}><span className={s.mono}>{row.id}</span><p><ItemText text={row.title} /></p></div>;
}
