import { useEffect, useState } from 'react';
import type { EventsPage } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';

/** Count every unread page; a partial page is never a complete event/warning count. */
export function useEventSummary(connection: ConnectionState) {
  const { events, command, live } = connection;
  const look = connection.marks?.events;
  const [summary, setSummary] = useState<{ events: number; warnings: number }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setSummary(undefined); setError('');
    if (!events || look === undefined) return;
    const cutoff = look ? Date.parse(look) : -Infinity;
    const count = async () => {
      const rows = new Map(events.rows.map(row => [row.id, row]));
      let page = events;
      const cursors = new Set<string>();
      while (page.more && !page.rows.some(row => Date.parse(row.ts) <= cutoff)) {
        if (!live || !command) return;
        if (!page.before || cursors.has(page.before)) throw new Error('Event cursor did not advance');
        cursors.add(page.before);
        page = await command<EventsPage>({ type: 'events.list', before: page.before, limit: 200 });
        if (!current) return;
        for (const row of page.rows) rows.set(row.id, row);
      }
      const newer = [...rows.values()].filter(row => Date.parse(row.ts) > cutoff);
      if (current) setSummary({ events: newer.length, warnings: newer.filter(row => row.warning).length });
    };
    void count().catch(error => { if (current) setError(error instanceof Error ? error.message : 'Event count unavailable'); });
    return () => { current = false; };
  }, [events, look, command, live]);
  return { summary, error };
}
