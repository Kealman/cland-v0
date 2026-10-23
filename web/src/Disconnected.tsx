import { useEffect, useState } from 'react';
import type { ConnectionState } from './connection.ts';
import s from './Disconnected.module.css';

export function connectionTime(time: number): string {
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Disconnected({ connection, since }: { connection: ConnectionState; since: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return <div data-disconnected className={s.strip}>
    <span>Disconnected since <time dateTime={new Date(since).toISOString()}>{connectionTime(since)}</time>
      {connection.restartRequired ? ' · Restart hub' : connection.nextAttemptAt === undefined ? ' · Connecting' : ` · retry in ${Math.max(0, Math.ceil((connection.nextAttemptAt - now) / 1000))} s`}</span>
    {!connection.restartRequired && <button onClick={connection.retryNow}>Retry</button>}
  </div>;
}
