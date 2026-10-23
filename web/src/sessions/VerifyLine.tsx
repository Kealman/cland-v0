import { useEffect, useState } from 'react';
import type { AreaContentProps } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import { verificationModel, type ExecutorStatus, type QueueRow } from './verification.ts';
import s from './VerifyLine.module.css';

function QueueView({ connection, view }: Pick<AreaContentProps, 'connection'> & { view: ReturnType<typeof verificationModel> }) {
  const [executor, setExecutor] = useState<ExecutorStatus>();
  const [error, setError] = useState('');
  const command = connection.command;
  const live = connection.live;
  useEffect(() => {
    if (!live || !command) return;
    let active = true;
    void command<ExecutorStatus>({ type: 'executor.status' }).then(value => {
      if (active) { setExecutor(value); setError(''); }
    }, reason => { if (active) setError(String(reason.message)); });
    return () => { active = false; };
  }, [command, live]);
  const spend = verificationModel(null, 0, executor).spend;
  const row = (value: QueueRow) => <tr key={value.slot} data-verification-row>
    <td>{value.slot}</td><td>{value.session}</td><td>{value.item}</td>
    <td className={s.detail}><span>{value.detail}</span><span>since {value.since}</span></td>
    <td>{value.time}</td><td>{value.eta}</td>
  </tr>;
  return <div className={s.view}>
    <div className={s.scroll}><table aria-label="Verification queue">
      <thead><tr>{['slot', 'session', 'item', 'what and where', 'running / wait', 'ETA'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>
        {view.local ? row(view.local) : <tr><td>{connection.verification?.queue ? 'local 0/1' : 'local —'}</td><td colSpan={5}>{connection.verification?.queue ? 'free' : '—'}</td></tr>}
        {view.remote.map(row)}{view.waiters.map(row)}
      </tbody>
    </table></div>
    <div className={s.metrics}><span>{view.metrics}</span><span data-verification-spend title={error || 'Today’s completed droplet spend and daily cap, read when the queue opens.'}>{spend}</span></div>
  </div>;
}

export function VerifyLine({ connection }: AreaContentProps) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const received = connection.verification;
  const view = verificationModel(received?.queue, received ? now - received.receivedAt : 0);
  return <div className={s.queue} data-session-slot="verification" title="Verification queue. Enter toggles the view. Running times and waits age from receipt; ~ marks the hub’s unchanged estimates.">
    <Fold area="sessions" id="verification" label={view.summary} count="" defaultFolded>
      {open => open && <QueueView connection={connection} view={view} />}
    </Fold>
  </div>;
}
