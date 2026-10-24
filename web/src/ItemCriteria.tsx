import { useEffect, useRef, useState } from 'react';
import type { ExplorerSummary } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import s from './ItemCriteria.module.css';

// The card reads criterion details only when opened, through task.view.
type Criterion = { id: string | null; text: string; checked: boolean; marks: Array<{ kind: string; by: string }> };
type CriteriaView = { item: { criteria: Criterion[] } };
type CriterionOp = 'add' | 'edit' | 'remove' | 'done' | 'normalize';

export function ItemCriteria({ item, connection, readOnly = false }: { item: ExplorerSummary; connection: ConnectionState; readOnly?: boolean }) {
  const id = item.id;
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const serial = useRef(0);
  const command = connection.command;
  useEffect(() => {
    if (!open || !connection.live || !command) return;
    const request = ++serial.current;
    let cancelled = false;
    void command<CriteriaView>({ type: 'task.view', item: id }).then(value => {
      if (!cancelled && request === serial.current) { setCriteria(value.item.criteria); setError(''); }
    }, reason => { if (!cancelled && request === serial.current) setError(String(reason)); });
    return () => { cancelled = true; };
  }, [id, item, open, command, connection.live]);
  const mutate = async (op: CriterionOp, criterion?: string, draft?: string) => {
    if (readOnly || busy || !connection.live || !command) return false;
    if (draft !== undefined && (!draft.trim() || /[\r\n]|^\s*C[1-9]\d*\./.test(draft))) {
      setError('Use one line of criterion text without a Ck. label'); return false;
    }
    const request = ++serial.current;
    setBusy(true); setError('');
    try {
      const value = await command<CriteriaView>({ type: 'task.criterion', item: id, op,
        ...(criterion ? { criterion } : {}), ...(draft !== undefined ? { text: draft.trim() } : {}) });
      if (request === serial.current) setCriteria(value.item.criteria);
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Criterion write failed'); return false; }
    finally { setBusy(false); }
  };
  return <section data-criteria-block className={s.block} aria-label="Criteria">
    <h3><button type="button" data-criteria-toggle aria-expanded={open} title={readOnly ? 'Read criteria' : 'Edit criteria (e)'} onClick={() => setOpen(!open)}>Criteria</button></h3>
    {open && <>
      {criteria ? criteria.map((criterion, index) => readOnly
        ? <div key={criterion.id ?? index} className={s.row}><span>{criterion.checked ? '✓' : '○'} {criterion.id} {criterion.text}</span></div>
        : criterion.id
        ? <CriterionRow key={criterion.id} criterion={criterion} id={criterion.id} disabled={busy || !connection.live} mutate={mutate} />
        : <div key={`legacy:${index}`} data-criterion-legacy className={s.row} title="This criterion has no persisted id. Assign ids in edit mode or with the CLI normalize operation before editing it here.">
          <small>No id</small><span>{criterion.checked ? '✓' : '○'} {criterion.text}</span>
        </div>) : <span>Loading…</span>}
      {!readOnly && !!criteria?.some(criterion => !criterion.id) && <div className={s.normalize}>
        <button type="button" data-criteria-normalize disabled={busy || !connection.live} title="Assign stable ids to the criteria that have none; their text and marks stay as they are." onClick={() => { void mutate('normalize'); }}>Assign ids</button>
      </div>}
      {!readOnly && <form className={s.add} onSubmit={event => { event.preventDefault(); void mutate('add', undefined, text).then(ok => { if (ok) setText(''); }); }}>
        <label>New criterion<input aria-label="New criterion" value={text} onChange={event => setText(event.target.value)} disabled={busy || !connection.live} /></label>
        <button disabled={busy || !connection.live || !criteria || !text.trim()}>Add criterion</button>
      </form>}
      {error && <span role="alert" title={error}>Criteria failed</span>}
    </>}
  </section>;
}

function CriterionRow({ criterion, id, disabled, mutate }: { criterion: Criterion; id: string; disabled: boolean; mutate: (op: CriterionOp, id?: string, text?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<string>();
  const [saved, setSaved] = useState(false);
  const text = draft ?? criterion.text;
  const done = criterion.marks.find(mark => mark.kind === 'done');
  return <form className={s.row} data-criterion-id={id} onSubmit={event => { event.preventDefault(); void mutate('edit', id, text).then(ok => { if (ok) { setDraft(undefined); setSaved(true); } }); }}>
    <label>{id}<input aria-label={`Criterion ${id}`} value={text} onChange={event => { setDraft(event.target.value); setSaved(false); }} disabled={disabled} /></label>
    <div className={s.actions}>
      <button aria-label={`Save ${id}`} disabled={disabled || draft === undefined || !text.trim()}>Save</button>
      <button type="button" aria-label={`Remove ${id}`} disabled={disabled} onClick={() => { void mutate('remove', id); }}>Remove</button>
      <button type="button" aria-label={`Mark ${id} done`} disabled={disabled || !!done} onClick={() => { void mutate('done', id); }}>{done ? '✓ Done' : 'Mark done'}</button>
      {done && <small>{done.by}</small>}
      {saved && <span role="status">Saved</span>}
    </div>
  </form>;
}
