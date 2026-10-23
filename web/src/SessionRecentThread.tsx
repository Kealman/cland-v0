import { useEffect, useState } from 'react';
import type { SessionHistoryResult } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import { MessageBlock } from './MessageBlock.tsx';
import s from './Thread.module.css';

/** A bounded, read-only view of the session's messages across topics. */
export function SessionRecentThread({ session, connection }: { session: string; connection: ConnectionState }) {
  const [history, setHistory] = useState<SessionHistoryResult>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const { command, live } = connection;
  useEffect(() => {
    let current = true;
    setHistory(undefined); setError('');
    if (live && command) void command<SessionHistoryResult>({ type: 'session.history', session, limit: 20 }).then(
      value => { if (current) setHistory(value); },
      error => { if (current) setError(error instanceof Error ? error.message : 'History unavailable'); },
    );
    return () => { current = false; };
  }, [command, live, session, retry]);
  return <section className={s.thread} aria-label={`${session} recent thread`}>
    <header className={s.heading}><h2>{session}</h2>{!history && live && !error && <span role="status">Loading</span>}
      {error && <button title={error} onClick={() => setRetry(value => value + 1)}>Retry</button>}</header>
    <div className={s.messages} role="log" aria-label={`${session} recent thread`} tabIndex={0}>
      {history?.messages.map(message => <MessageBlock key={message.id} message={{ ...message, topic: message.topic ?? 'general' }} connection={connection} />)}
    </div>
  </section>;
}
