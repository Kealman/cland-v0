import { useImperativeHandle, useRef, type ReactNode } from 'react';
import type { AreaContentProps, AreaControls } from '../AreaSlot.tsx';
import { SessionActions } from './SessionActions.tsx';
import { SessionDrawer } from './SessionDrawer.tsx';
import s from './Sessions.module.css';

export function SessionPage({ connection, selected, controls, closePage, children, ...props }: AreaContentProps & { children?: ReactNode }) {
  const actions = useRef<AreaControls>(null);
  const thread = useRef<AreaControls>(null);
  useImperativeHandle(controls, () => ({ run: action => action.startsWith('thread-') ? thread.current?.run(action) ?? false : actions.current?.run(action) ?? false }), []);
  const row = [...connection.sessions ?? [], ...connection.archivedSessionRows ?? []].find(value => value.name === selected);
  const usage = row?.usage?.total;
  return <section className={s.page} data-area-module="Sessions" data-area-surface="page" data-key-context="sessions">
    {children}
    {row ? <>
      <dl className={s.facts}>
        <dt>Session</dt><dd>{row.name}</dd>
        <dt>Role</dt><dd>{row.role ?? '—'}</dd>
        <dt>Harness</dt><dd>{row.harness ?? '—'}</dd>
        <dt>Model</dt><dd>{row.model ?? '—'}</dd>
        <dt>Account</dt><dd>{row.account ?? '—'}</dd>
        <dt>State</dt><dd>{row.live ? row.state : row.status}</dd>
        <dt>Usage</dt><dd>{usage ? `${usage.totalTokens} tok${usage.cost === undefined ? '' : ` · $${usage.cost.toFixed(2)}`}` : '—'}</dd>
      </dl>
      {row.approvalCommand && <pre className={s.waitingCommand}><code>{row.approvalCommand}</code></pre>}
      <SessionActions key={row.key} row={row} connection={connection} controls={actions} onBack={closePage} showCapabilities />
      {props.focusThread && <SessionDrawer {...props} connection={connection} selected={selected} controls={thread} inline />}
    </> : <p>Session unavailable</p>}
  </section>;
}
