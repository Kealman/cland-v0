import { useEffect, useRef, useState } from 'react';
import { findItem, type ConnectionState } from './connection.ts';
import s from './QuickMessage.module.css';

export type MessageTarget = { card: string; ids: string[]; topic: boolean; serial: number; selection: boolean };
export function QuickMessage({ connection, target }: { connection: ConnectionState; target: MessageTarget }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [topicMode, setTopicMode] = useState(target.topic);
  const createdTopic = useRef<string | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setTopicMode(target.topic); input.current?.focus(); }, [target.serial, target.topic]);
  const item = target.ids.length === 1 ? findItem(connection, target.ids[0]) : undefined;
  const canTopic = !target.selection && (item?.kind === 'task' || item?.kind === connection.tracker?.levels[1]);
  const submit = async () => {
    if (!text.trim() || busy || !connection.command) return;
    setBusy(true); setError('');
    try {
      const context = target.ids.map(id => { const item = findItem(connection, id); return `${item?.id ?? id} · ${item?.title ?? ''}`; });
      let topic = 'general';
      if (topicMode && canTopic && item) {
        topic = connection.topics?.find(value => value.item === item.id)?.id ?? createdTopic.current ?? '';
        if (!topic) {
          const result = await connection.command<{ topic: { id: string } }>({ type: 'topic.create', item: item.id, title: `${item.id} ${item.title}` });
          createdTopic.current = topic = result.topic.id;
        }
      }
      await connection.command({ type: 'topic.send', topic, text: `${text.trim()}\n${context.join('\n')}`, to: ['coordinator'] });
      setText('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Send failed'); }
    finally { setBusy(false); }
  };
  return <form className={s.form} onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label>{topicMode && canTopic ? item?.id : 'General'}<input ref={input} aria-label="Quick message" value={text} onChange={event => setText(event.target.value)} disabled={busy} /></label>
    <button type="button" disabled={busy || !canTopic} aria-pressed={topicMode && canTopic} title="Send to the item's topic (M); selections go to General" onClick={() => setTopicMode(!topicMode)}>Item topic</button>
    <button disabled={busy || !connection.live || !text.trim()}>Send</button>
    {error && <span role="alert" title={error}>Send failed</span>}
  </form>;
}
