import { useImperativeHandle, useRef } from 'react';
import type { AreaContentProps } from '../AreaSlot.tsx';
import { ApprovalCard } from '../ApprovalCard.tsx';
import { Composer } from '../Composer.tsx';
import { SessionRecentThread } from '../SessionRecentThread.tsx';
import type { ThreadControls } from '../Thread.tsx';
import s from './Sessions.module.css';

export function SessionDrawer({ connection, selected, controls, focusThread, inline }: AreaContentProps & { inline?: boolean }) {
  const thread = useRef<ThreadControls>(null);
  const row = [...connection.sessions ?? [], ...connection.archivedSessionRows ?? []].find(row => row.name === selected);
  const approval = [...connection.approvalCards?.values() ?? []].reverse().filter(record => record.session === selected && (!row || record.sessionId === row.sessionId))
    .sort((a, b) => Number(a.state === 'closed') - Number(b.state === 'closed') || b.since.localeCompare(a.since))[0];
  const topic = connection.topics?.find(topic => topic.item && topic.item === row?.item)?.id ?? 'general';
  useImperativeHandle(controls, () => ({ run: action => {
    if (action === 'thread-back') {
      document.querySelector<HTMLButtonElement>(`[data-session-slot="groups"] [data-object-id="${CSS.escape(selected ?? '')}"]`)?.focus();
      return true;
    }
    return thread.current?.run(action) ?? false;
  } }), [selected]);
  return <section className={s.drawer} data-area-module={inline ? undefined : 'Sessions'} data-area-surface={inline ? undefined : 'drawer'} data-key-context="sessions" data-session-thread={selected}>
    {approval && <div className={s.approval}><ApprovalCard key={approval.id} record={approval} connection={connection} /></div>}
    {selected && <SessionRecentThread key={selected} session={selected} connection={connection} controls={thread} focusRequest={focusThread}
      composer={<Composer connection={connection} topic={topic} session={selected} />} />}
  </section>;
}
