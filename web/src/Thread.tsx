import { Fragment, useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import type { ConnectionState } from './connection.ts';
import { MessageBlock } from './MessageBlock.tsx';
import s from './Thread.module.css';
import { useTopicRead } from './use-topic-read.ts';
import type { Shortcut } from './keymap.ts';

export type ThreadControls = { focus: () => void; run: (action: Shortcut) => boolean };

export function Thread({ connection, topic, controls }: { connection: ConnectionState; topic: string; controls?: Ref<ThreadControls> }) {
  const node = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const atEnd = useRef(true);
  const opened = useRef(false);
  const state = connection.threads?.get(topic);
  useImperativeHandle(controls, () => ({ focus: () => node.current?.focus(), run: action => {
    if (action !== 'thread-next' && action !== 'thread-previous') return false;
    const rows = [...node.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const target = rows[index < 0 ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (action === 'thread-next' ? 1 : -1)))];
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest' });
    return true;
  } }), []);
  useTopicRead(node, connection, topic, state?.messages);
  useEffect(() => { if (connection.live) void connection.threads?.load(topic); }, [connection.live, connection.threads, connection.threads?.generation, topic, state?.loaded]);
  useLayoutEffect(() => {
    const log = node.current;
    if (!log || !state?.loaded) return;
    if (anchor.current) {
      if (state.loading) return;
      const element = [...log.querySelectorAll<HTMLElement>('[data-message-id]')].find(row => row.dataset.messageId === anchor.current!.id);
      if (element) log.scrollTop += element.getBoundingClientRect().top - anchor.current.top;
      anchor.current = null;
    } else if (!opened.current || atEnd.current) log.scrollTop = log.scrollHeight;
    opened.current = true;
  }, [state?.messages, state?.loaded, state?.loading]);
  const earlier = () => {
    if (!node.current || state?.loading || !state?.more || !connection.live) return;
    const first = node.current.querySelector<HTMLElement>('[data-message-id]');
    if (first) anchor.current = { id: first.dataset.messageId!, top: first.getBoundingClientRect().top };
    void connection.threads?.load(topic, true);
  };
  const title = connection.topics?.find(row => row.id === topic)?.title ?? topic;
  return <section className={s.thread} data-key-context="thread" aria-label={title}>
    <header className={s.heading}><h2>{title}</h2>{state?.loading && <span role="status">Loading</span>}
      {state?.error && <button title={state.error} onClick={() => { if (state.loaded) earlier(); else void connection.threads?.load(topic); }}>Retry</button>}</header>
    <div ref={node} className={s.messages} data-loaded={!!state?.loaded} role="log" aria-label={`${title} thread`} tabIndex={0}
      onScroll={() => { const log = node.current!; atEnd.current = log.scrollHeight - log.clientHeight - log.scrollTop < 2; if (log.scrollTop === 0) earlier(); }}>
      {state?.messages.map((message, index, messages) => <Fragment key={message.id}>
        {(index === 0 || new Date(messages[index - 1]!.ts).toDateString() !== new Date(message.ts).toDateString()) &&
          <div role="separator" className={s.date}>{new Date(message.ts).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>}
        <MessageBlock message={message} />
      </Fragment>)}
    </div>
  </section>;
}
