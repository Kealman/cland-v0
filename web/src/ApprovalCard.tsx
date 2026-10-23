import { useRef, useState } from 'react';
import type { ApprovalChoice, ApprovalRecord } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import s from './AskCard.module.css';

/** The native record owns offered choices and the attributed outcome. */
export function ApprovalCard({ record, connection }: { record: ApprovalRecord; connection: ConnectionState }) {
  const [pending, setPending] = useState(false);
  const [denying, setDenying] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const answer = async (choice: ApprovalChoice) => {
    if (pending || connection.recoveringApprovals?.has(record.id) || !connection.live || !connection.command || record.state !== 'pending' || !record.choices.includes(choice)) return;
    setPending(true); setError('');
    try { await connection.command({ type: 'approval.answer', approval: record.id, choice, ...(choice === 'deny' ? { note } : {}) }); }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Approval failed');
      await connection.recoverApproval?.(record.id).catch(() => {});
    }
    finally { setPending(false); }
  };
  if (record.state === 'closed') return <div tabIndex={0} data-approval-outcome className={s.folded}>{record.outcome && <>
    <span>{({ once: 'Approved once', always: 'Approved always', deny: 'Denied', withdrawn: 'Withdrawn', 'answered in the harness': 'Answered in the harness' })[record.outcome.choice]}</span>
    <span> · {record.outcome.by} · {record.outcome.via} · </span><time dateTime={record.outcome.at}>{new Date(record.outcome.at).toLocaleString()}</time>
  </>}</div>;
  const recovering = connection.recoveringApprovals?.has(record.id);
  const disabled = !!recovering || !connection.live || pending || record.state !== 'pending';
  return <section className={s.card} aria-label="Command approval">
    <pre className={s.command}>{record.subject.command ?? record.command ?? record.subject.change}</pre>
    {record.subject.cwd && <div className={s.meta}>{record.subject.cwd}</div>}
    {record.subject.reason && <div>{record.subject.reason}</div>}
    {record.subject.files?.map(file => <div key={file}>{file}</div>)}
    {record.answerIn === 'tui' ? <span className={s.meta}>Answer in Neovim</span> : <>
      <div className={s.options}>
        {record.choices.includes('once') && <button data-approval-choice="once" disabled={disabled} onClick={() => void answer('once')}>1 · Approve once</button>}
        {record.choices.includes('always') && <button data-approval-choice="always" disabled={disabled} onClick={() => void answer('always')}>2 · Always for this command</button>}
        {record.choices.includes('deny') && <button data-approval-deny disabled={disabled} onClick={() => { setDenying(value => !value); requestAnimationFrame(() => field.current?.focus()); }}>{denying ? 'Cancel denial' : 'd · Deny'}</button>}
      </div>
      {denying && <form className={s.answer} onSubmit={event => { event.preventDefault(); void answer('deny'); }}>
        <label>Denial note<input ref={field} value={note} disabled={disabled} onChange={event => setNote(event.target.value)} /></label>
        <button disabled={disabled} type="submit">Deny</button>
      </form>}
    </>}
    {recovering && !connection.approvalRecoveryErrors?.has(record.id) && <span role="status">Checking outcome</span>}
    {!recovering && (pending || record.state === 'answering') && <span role="status">Sending answer</span>}
    {connection.approvalRecoveryErrors?.has(record.id) && <span role="alert" className={s.error}>{connection.approvalRecoveryErrors.get(record.id)}</span>}
    {error && <span role="alert" className={s.error}>{error}</span>}
  </section>;
}
