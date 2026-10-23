import { Fragment, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { TopicMessage, ThreadRun } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import { MessageBlock } from './MessageBlock.tsx';
import s from './Thread.module.css';
import { useTopicRead } from './use-topic-read.ts';
import type { Shortcut } from './keymap.ts';

export type ThreadControls = { focus: () => void; run: (action: Shortcut) => boolean };

export function Thread({ connection, topic, controls, targetMessage }: { connection: ConnectionState; topic: string; targetMessage?: string | undefined; controls?: Ref<ThreadControls> }) {
  const node = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const atEnd = useRef(true);
  const opened = useRef(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleAnchor = useRef<{ row: HTMLElement; top: number } | null>(null);
  const regionId = useId();
  const state = connection.threads?.get(topic);
  const toggle = (row: HTMLElement) => {
    const id = row.closest<HTMLElement>('[data-run-id]')?.dataset.runId;
    if (!id) return false;
    const button = row.closest('[data-run-id]')!.querySelector<HTMLButtonElement>('[data-run-anchor]')!;
    toggleAnchor.current = { row: button, top: button.getBoundingClientRect().top };
    atEnd.current = false;
    button.focus({ preventScroll: true });
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    return true;
  };
  useImperativeHandle(controls, () => ({ focus: () => node.current?.focus(), run: action => {
    if (action === 'thread-toggle') return document.activeElement instanceof HTMLElement && !!node.current?.contains(document.activeElement) && toggle(document.activeElement);
    if (action !== 'thread-next' && action !== 'thread-previous') return false;
    const rows = [...node.current?.querySelectorAll<HTMLElement>('[data-thread-row]') ?? []];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const target = rows[index < 0 ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (action === 'thread-next' ? 1 : -1)))];
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest' });
    return true;
  } }), []);
  useLayoutEffect(() => {
    if (!toggleAnchor.current || !node.current) return;
    const { row, top } = toggleAnchor.current;
    node.current.scrollTop += row.getBoundingClientRect().top - top;
    toggleAnchor.current = null;
  }, [expanded]);
  useTopicRead(node, connection, topic, state?.messages, expanded);
  useEffect(() => { if (connection.live) void connection.threads?.load(topic); }, [connection.live, connection.threads, connection.threads?.generation, topic, state?.loaded]);
  useLayoutEffect(() => {
    const log = node.current;
    if (!log || !state?.loaded) return;
    if (anchor.current) {
      if (state.loading) return;
      const element = [...log.querySelectorAll<HTMLElement>('[data-thread-row]')].find(row => row.dataset.threadRow === anchor.current!.id);
      if (element) log.scrollTop += element.getBoundingClientRect().top - anchor.current.top;
      anchor.current = null;
    } else if (!opened.current || atEnd.current) log.scrollTop = log.scrollHeight;
    opened.current = true;
  }, [state?.messages, state?.loaded, state?.loading]);
  const navigated = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!targetMessage || navigated.current === targetMessage || !state?.loaded || !node.current) return;
    const message = state.messages.find(row => row.id === targetMessage);
    if (!message) {
      if (state.more && !state.loading && !state.error && connection.live) void connection.threads?.load(topic, true);
      return;
    }
    if (message.runId && !expanded.has(message.runId)) { setExpanded(previous => new Set(previous).add(message.runId!)); return; }
    const target = [...node.current.querySelectorAll<HTMLElement>('[data-message-id]')].find(row => row.dataset.messageId === targetMessage);
    if (!target) return;
    atEnd.current = false; navigated.current = targetMessage;
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center' });
  }, [targetMessage, state, expanded, connection.live, connection.threads, topic]);
  const earlier = () => {
    if (!node.current || state?.loading || !state?.more || !connection.live) return;
    // In an open run, anchor its first message: the sticky summary cannot
    // measure content prepended inside the same run.
    const first = node.current.querySelector<HTMLElement>('[data-message-id]');
    if (first) anchor.current = { id: first.dataset.threadRow!, top: first.getBoundingClientRect().top };
    void connection.threads?.load(topic, true);
  };
  const title = connection.topics?.find(row => row.id === topic)?.title ?? topic;
  const blocks: { messages: TopicMessage[]; run?: ThreadRun }[] = [];
  for (const message of state?.messages ?? []) {
    const run = message.runId ? state?.runs[message.runId] : undefined;
    const last = blocks.at(-1);
    if (run && last?.run?.id === run.id) last.messages.push(message);
    else blocks.push({ messages: [message], ...(run ? { run } : {}) });
  }
  return <section className={s.thread} data-key-context="thread" aria-label={title}>
    <header className={s.heading}><h2>{title}</h2>{state?.loading && <span role="status">Loading</span>}
      {state?.error && <button title={state.error} onClick={() => { if (state.loaded) earlier(); else void connection.threads?.load(topic); }}>Retry</button>}</header>
    <div ref={node} className={s.messages} data-loaded={!!state?.loaded} role="log" aria-label={`${title} thread`} tabIndex={0}
      onScroll={() => { const log = node.current!; atEnd.current = log.scrollHeight - log.clientHeight - log.scrollTop < 2; if (log.scrollTop === 0) earlier(); }}>
      {blocks.map(({ messages, run }, index) => {
        const first = messages[0]!, last = messages.at(-1)!;
        const open = !!run && expanded.has(run.id);
        return <Fragment key={run?.id ?? first.id}>
          {(index === 0 || new Date(blocks[index - 1]!.messages.at(-1)!.ts).toDateString() !== new Date(first.ts).toDateString()) &&
            <div role="separator" className={s.date}>{new Date(first.ts).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>}
          {run ? <div data-run-id={run.id} className={s.run}>
            <button data-run-anchor data-thread-row={run.id} data-message-id={open ? undefined : last.id} data-message-seq={open ? undefined : last.seq}
              className={s.runAnchor} aria-expanded={open} aria-controls={`${regionId}-${run.id}`} title={run.foldLine} onClick={event => toggle(event.currentTarget)}>{run.foldLine}</button>
            <div id={`${regionId}-${run.id}`}>{open && messages.map(message => <MessageBlock key={message.id} message={message} connection={connection} />)}</div>
          </div> : <MessageBlock message={first} connection={connection} />}
        </Fragment>;
      })}
    </div>
  </section>;
}
