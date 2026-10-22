import type { AreaContentProps, AreaModule } from './AreaSlot.tsx';
import { useImperativeHandle, useRef } from 'react';
import { Fold } from './Fold.tsx';
import s from './TopicsArea.module.css';
import { Thread, type ThreadControls } from './Thread.tsx';

export const topicActions = ['topic-next', 'topic-previous', 'topic-open', 'topic-close', 'thread-next', 'thread-previous', 'thread-back'] as const;

export function TopicDetail({ connection, selected, controls }: AreaContentProps) {
  const thread = useRef<ThreadControls>(null);
  useImperativeHandle(controls, () => ({ run: action => {
    if (action === 'thread-back') {
      document.querySelector<HTMLButtonElement>(`[data-key-context="topics"] [data-object-id="${CSS.escape(selected ?? '')}"]`)?.focus();
      return true;
    }
    return thread.current?.run(action) ?? false;
  } }), [selected]);
  return <div className={s.area}>{connection && selected && <Thread key={selected} connection={connection} topic={selected} controls={thread} />}</div>;
}

function TopicPage(props: AreaContentProps) {
  return <section data-area-module="Topics" data-area-surface="page" data-key-context="topics"><TopicDetail {...props} /></section>;
}
function TopicDrawer(props: AreaContentProps) {
  return <section data-area-module="Topics" data-area-surface="drawer" data-key-context="topics"><TopicDetail {...props} /></section>;
}

export const topicsModule: AreaModule = { context: 'topics', handledActions: topicActions, Pane: TopicsArea, Page: TopicPage, Drawer: TopicDrawer };

export function TopicsArea({ connection, selected, select, controls }: AreaContentProps) {
  const list = useRef<HTMLDivElement>(null);
  const thread = useRef<ThreadControls>(null);
  useImperativeHandle(controls, () => ({ run: action => {
    if (action.startsWith('thread-')) {
      if (action === 'thread-back') {
        list.current?.querySelector<HTMLButtonElement>(`[data-object-id="${CSS.escape(selected ?? '')}"]`)?.focus();
        return true;
      }
      return thread.current?.run(action) ?? false;
    }
    const targets = [...list.current?.querySelectorAll<HTMLButtonElement>('[data-fold-toggle], [data-object-id]') ?? []].filter(node => node.getClientRects().length);
    const focused = document.activeElement;
    const current = targets.indexOf(focused as HTMLButtonElement);
    if (action === 'topic-next' || action === 'topic-previous') {
      const next = targets[Math.max(0, Math.min(targets.length - 1, current + (action === 'topic-next' ? 1 : -1)))];
      next?.focus(); next?.scrollIntoView({ block: 'nearest' }); return true;
    }
    if (action === 'topic-open') {
      if (focused?.hasAttribute('data-fold-toggle')) { if (focused.getAttribute('aria-expanded') === 'false') (focused as HTMLButtonElement).click(); }
      else thread.current?.focus();
      return true;
    }
    if (action === 'topic-close') {
      const toggle = focused?.closest('[data-fold-block]')?.querySelector<HTMLButtonElement>('[data-fold-toggle]');
      toggle?.focus(); if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click(); return true;
    }
    return false;
  } }), [selected]);
  const topics = [...connection?.topics ?? []].sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '') || a.id.localeCompare(b.id));
  const groups = [
    { id: 'waiting', label: 'Waiting for you', rows: topics.filter(row => row.status === 'waiting for human') },
    { id: 'standing', label: 'Project', rows: topics.filter(row => row.standing && row.status !== 'waiting for human').sort((a, b) => Number(b.id === 'general') - Number(a.id === 'general')) },
    { id: 'items', label: 'Item topics', rows: topics.filter(row => !row.standing && row.status !== 'waiting for human' && row.status !== 'closed') },
    { id: 'closed', label: 'Closed', rows: topics.filter(row => row.status === 'closed') },
  ];
  return <div className={s.area} data-area-module="Topics" data-area-surface="pane" data-key-context="topics">
    <div ref={list} className={s.list} role="list" aria-label="Topics objects">
      {groups.map(group => <div key={group.id} data-topic-group={group.id} className={group.id === 'standing' ? s.standing : undefined}>
        <Fold area="topics" id={`group:${group.id}`} label={group.label} count={group.rows.length} defaultFolded={group.id === 'closed'}>
          {group.rows.map(topic => <button key={topic.id} className={s.row} data-standing={topic.standing} data-object-id={topic.id} aria-pressed={selected === topic.id}
            onFocus={() => select(topic.id)} onClick={() => select(topic.id)}>
            <span className={s.title}>{topic.title}</span><span className={s.meta}><span>{topic.item}</span>
              <span aria-label="Unread">{topic.unread}</span><time title={topic.lastMessageAt ?? undefined} dateTime={topic.lastMessageAt ?? undefined}>{topic.lastMessageAt ? new Date(topic.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</time></span>
          </button>)}
        </Fold>
      </div>)}
    </div>
    {connection && selected && <Thread key={selected} connection={connection} topic={selected} controls={thread} />}
  </div>;
}
