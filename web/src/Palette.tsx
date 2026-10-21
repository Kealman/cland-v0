import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { actionKeys, displayKey, shellActions, paletteActions, type Area, type Shortcut } from './keymap.ts';
import type { ConnectionState, ObjectRow } from './connection.ts';
import s from './Palette.module.css';

const kinds = [
  { prefix: '>', name: 'Actions' }, { prefix: '#', name: 'Items' }, { prefix: '@', name: 'Sessions' },
  { prefix: '~', name: 'Artifacts' }, { prefix: '/', name: 'Topics' },
] as const;
type Result = { id: string; title: string; kind: typeof kinds[number]; action?: Shortcut | undefined; area?: Area | undefined; positions: number[]; score: number };
export type PaletteControls = { run: (action: Shortcut) => void };

// Ordered subsequence matching retains the actual positions for the blue characters.
function match(text: string, query: string): number[] | undefined {
  // Each folded code point retains its original code-point index, even when
  // lowercasing expands one character (İ → i + combining dot).
  const folded = Array.from(text).flatMap((character, index) =>
    Array.from(character.toLowerCase(), value => ({ value, index })));
  const positions: number[] = [];
  let start = 0;
  for (const character of query.toLowerCase()) {
    const position = folded.findIndex((part, index) => index >= start && part.value === character);
    if (position < 0) return;
    positions.push(folded[position]!.index); start = position + 1;
  }
  return [...new Set(positions)];
}
function Keys({ action }: { action: Shortcut }) {
  return <kbd>{actionKeys(action).map(displayKey).join(' / ') || 'No key'}</kbd>;
}
export function PaletteDialog({ mode, area, connection, controls, close, run, open }: {
  mode: 'palette' | 'help'; area: Area; connection: ConnectionState; controls: Ref<PaletteControls>;
  close: () => void; run: (action: Shortcut) => void; open: (area: Area, row: ObjectRow, pane: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current!.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const kind = kinds.find(kind => query.startsWith(kind.prefix));
  const search = (kind ? query.slice(1) : query).trim();
  const results: Result[] = [];
  for (const candidate of kinds) {
    if (kind && candidate !== kind) continue;
    const objects = candidate.name === 'Actions' ? shellActions.map(row => ({ id: row.action, title: row.label, action: row.action }))
      : connection.rows?.[candidate.name] ?? [];
    for (const object of objects) {
      const action = 'action' in object ? object.action : undefined;
      const text = action ? object.title : `${object.id} ${object.title}`;
      const positions = match(text, search);
      if (!positions) continue;
      results.push({ ...object, kind: candidate, area: candidate.name === 'Actions' ? undefined : candidate.name,
        positions, score: positions.length ? positions.at(-1)! - positions[0]! + positions[0]! / 100 : 0 });
    }
  }
  const best = results.reduce((index, row, current) => row.score < results[index]!.score ? current : index, 0);
  // A changed query picks the best match; subsequent arrows move through the fixed groups.
  const selected = Math.min(cursor < 0 ? best : cursor, Math.max(0, results.length - 1));
  const choose = (result: Result | undefined, pane: boolean) => {
    if (!result) return;
    close();
    if (result.action) run(result.action);
    else open(result.area!, result, pane);
  };
  useImperativeHandle(controls, () => ({ run(action) {
    if (action === 'dismiss') close();
    else if (mode === 'palette') {
      if (action === 'accept' || action === 'open-other') choose(results[selected], action === 'open-other');
      else if (action === 'next-kind' || action === 'previous-kind') {
        const index = kind ? kinds.indexOf(kind) : action === 'next-kind' ? -1 : 0;
        const next = (index + (action === 'next-kind' ? 1 : -1) + kinds.length) % kinds.length;
        setQuery(kinds[next]!.prefix + search); setCursor(-1);
      } else if (action === 'next-result' || action === 'previous-result') {
        setCursor((selected + (action === 'next-result' ? 1 : -1) + results.length) % (results.length || 1));
      }
    }
  } }));
  const activeResult = useRef<HTMLDivElement>(null);
  useEffect(() => { activeResult.current?.scrollIntoView({ block: 'nearest' }); }, [selected, query]);
  return <dialog ref={dialog} className={s.dialog} aria-label={mode === 'palette' ? 'Palette' : `${area} keys`}
    onCancel={event => { event.preventDefault(); close(); }}>
    {mode === 'help' ? <>
      <header className={s.header}><h2>{area} keys</h2><button autoFocus onClick={close}>Close</button></header>
      <dl className={s.keys}>{shellActions.map(row => <div key={row.action} data-key-action={row.action}>
        <dt>{row.label}</dt><dd><Keys action={row.action} /></dd>
      </div>)}</dl>
    </> : <>
      <input aria-label="Search palette" autoFocus value={query} onChange={event => { setQuery(event.target.value); setCursor(-1); }}
        role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="palette-results"
        aria-activedescendant={results.length ? `palette-result-${selected}` : undefined} />
      <div className={s.prefixes}>{kinds.map(row => <button key={row.prefix} aria-pressed={row === kind}
        onClick={() => { setQuery(row.prefix + search); setCursor(-1); dialog.current!.querySelector('input')!.focus(); }}>
        <kbd>{row.prefix}</kbd> {row.name}
      </button>)}</div>
      <div id="palette-results" role="listbox" aria-label="Results" className={s.results}>
        {kinds.map(group => {
          const rows = results.filter(row => row.kind === group);
          return rows.length > 0 && <section key={group.name} role="group" aria-label={group.name} data-palette-group={group.name}>
            <h2>{group.name} <span>{rows.length}</span></h2>
            {rows.map(row => {
              const index = results.indexOf(row);
              const text = row.action ? row.title : `${row.id} ${row.title}`;
              return <div key={row.id} id={`palette-result-${index}`} role="option" aria-selected={selected === index}
                ref={selected === index ? activeResult : undefined} className={s.result} onPointerMove={() => setCursor(index)}
                onClick={() => choose(row, false)}>
                <span>{Array.from(text).map((character, index) => row.positions.includes(index) ? <mark key={index}>{character}</mark> : character)}</span>
                {row.action && <Keys action={row.action} />}
              </div>;
            })}
          </section>;
        })}
        {!results.length && <p className={s.empty}>0 results</p>}
      </div>
      <footer className={s.footer}>{paletteActions.map(row => <span key={row.action} title={row.label}><Keys action={row.action} /> {row.label}</span>)}</footer>
    </>}
  </dialog>;
}
