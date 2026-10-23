import { useId, useRef, useState } from 'react';
import type { ApprovalChoice, ApprovalRecord } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import type { Shortcut } from './keymap.ts';
import { BottomSheet } from './BottomSheet.tsx';
import { usePhone } from './phone.ts';
import s from './AskCard.module.css';
import a from './ApprovalCard.module.css';

/** The native record owns offered choices and the attributed outcome. */
export function ApprovalCard({ record, connection, phoneOpen, closePhone }: { record: ApprovalRecord; connection: ConnectionState; phoneOpen?: boolean; closePhone?: () => void }) {
  const phone = usePhone();
  const [pending, setPending] = useState(false);
  const [denying, setDenying] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const denyButton = useRef<HTMLButtonElement>(null);
  const noteId = useId();
  const answer = async (choice: ApprovalChoice) => {
    if (pending || connection.recoveringApprovals?.has(record.id) || !connection.live || !connection.command || record.state !== 'pending' || record.answerIn !== 'hub' || !record.choices.includes(choice)) return;
    setPending(true); setError('');
    try { await connection.command({ type: 'approval.answer', approval: record.id, choice, ...(choice === 'deny' && note.trim() ? { note } : {}) }); }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Approval failed');
      await connection.recoverApproval?.(record.id).catch(() => {});
    }
    finally { setPending(false); }
  };
  if (record.state === 'closed') return <div tabIndex={0} data-approval-outcome className={`${s.folded} ${a.folded}`}>{record.outcome && <>
    <span>{({ once: 'Approved once', always: 'Approved always', deny: 'Denied', withdrawn: 'Withdrawn', 'answered in the harness': 'Answered in the harness' })[record.outcome.choice]} by {record.outcome.by === 'human' ? 'the human' : record.outcome.by}</span>
    <span> · {record.outcome.via} · </span><time dateTime={record.outcome.at}>{new Date(record.outcome.at).toLocaleString()}</time>
  </>}</div>;
  const recovering = connection.recoveringApprovals?.has(record.id);
  const disabled = !!recovering || !connection.live || pending || record.state !== 'pending';
  const controls = <section tabIndex={0} data-approval-id={record.id} data-key-context={phone ? 'sheet' : 'approval'} data-phone-sheet={phone || undefined} className={`${s.card} ${a.card}`} aria-label="Command approval">
    <div className={s.heading}><strong>{record.session}</strong><span className={s.meta}>{record.harness ?? '—'}</span></div>
    <div className={s.meta}>Since <time dateTime={record.since} title={record.since}>{new Date(record.since).toLocaleString()}</time></div>
    {(record.subject.command ?? record.command) && <pre className={s.command}>{record.subject.command ?? record.command}</pre>}
    {record.subject.cwd && <div className={s.meta}>{record.subject.cwd}</div>}
    {record.subject.reason && <div>{record.subject.reason}</div>}
    {record.subject.files?.map(file => <div key={file}>{file}</div>)}
    {record.subject.change && <pre className={s.command}>{record.subject.change}</pre>}
    {record.answerIn === 'tui' ? <span className={s.meta}>Answer in Neovim</span> : <>
      <div className={s.options}>
        {record.choices.includes('once') && <button data-approval-choice="once" disabled={disabled} onClick={() => void answer('once')}>{!phone && '1 · '}Approve once</button>}
        {record.choices.includes('always') && <button data-approval-choice="always" disabled={disabled} onClick={() => void answer('always')}>{!phone && '2 · '}Always for this command</button>}
        {!phone && record.choices.includes('deny') && <button ref={denyButton} data-approval-deny disabled={disabled} onClick={() => { setDenying(value => !value); requestAnimationFrame(() => field.current?.focus()); }}>{denying ? 'Cancel denial' : 'd · Deny'}</button>}
      </div>
      {phone && record.choices.includes('deny') ? <form className={s.answer} onSubmit={event => { event.preventDefault(); void answer('deny'); }}>
        <div className={s.label}>
          <label htmlFor={noteId}>Denial note</label>
          <input id={noteId} ref={field} title="Optional" data-key-context="sheet" value={note} disabled={disabled} onChange={event => setNote(event.target.value)} />
          <button type="submit" data-approval-deny className={s.decline} disabled={disabled}>Deny</button>
        </div>
      </form> : denying && <form className={`${s.answer} ${a.denial}`} onSubmit={event => { event.preventDefault(); void answer('deny'); }}>
        <label>Denial note<input ref={field} title="Optional" data-key-context="approval-note" value={note} disabled={disabled} onChange={event => setNote(event.target.value)} /></label>
        <button disabled={disabled} type="submit">Deny</button>
        <button type="button" data-approval-cancel onClick={() => { setDenying(false); setNote(''); denyButton.current?.focus(); }}>Cancel</button>
      </form>}
    </>}
    {recovering && !connection.approvalRecoveryErrors?.has(record.id) && <span role="status">Checking outcome</span>}
    {!recovering && (pending || record.state === 'answering') && <span role="status">Sending answer</span>}
    {connection.approvalRecoveryErrors?.has(record.id) && <span role="alert" className={s.error}>{connection.approvalRecoveryErrors.get(record.id)}</span>}
    {error && <span role="alert" className={s.error}>{error}</span>}
  </section>;
  if (!phone) return controls;
  if (!phoneOpen || record.answerIn !== 'hub') return null;
  return <BottomSheet label="Command approval" header={<span>{record.session} · {record.harness ?? '—'}</span>} close={() => closePhone?.()}>{controls}</BottomSheet>;
}

/** Called by the shell's shared dispatcher, including when reused in a drawer. */
export function runApprovalShortcut(action: Shortcut): boolean {
  if (!action.startsWith('approval-')) return false;
  const card = document.activeElement?.closest('[data-approval-id]');
  if (!card) return false;
  const selector = action === 'approval-once' ? '[data-approval-choice="once"]'
    : action === 'approval-always' ? '[data-approval-choice="always"]'
    : action === 'approval-deny' ? '[data-approval-deny]' : '[data-approval-cancel]';
  card.querySelector<HTMLButtonElement>(selector)?.click();
  return true;
}
