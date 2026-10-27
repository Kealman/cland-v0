import { randomUUID } from 'node:crypto';
import type { RemoteStore, Pairing, OutboxJob } from './state.ts';
import type { Clock } from '../hub/clock.ts';

export type TelegramGapSend = (chat: string, text: string, key: string) => Promise<void>;
type Gap = { chat: string; user: string; text: string; key: string; jobs: string[] };
const STATE = 'telegram.gap';

function missed(store: RemoteStore, pairing: Pairing): OutboxJob[] {
  return store.outbox().filter(job => {
    const payload = job.payload as { telegram?: boolean; userId?: string; params?: { chat_id?: string | number } } | null;
    return job.kind === 'general' && job.state === 'missed' && payload?.telegram === true
      && String(payload.params?.chat_id) === pairing.chatId
      && (payload.userId === undefined || payload.userId === pairing.userId);
  });
}

/** A gap owns a captured set of missed jobs, never the arrivals during its send.
 * The native sender must reuse key's existing durable job, including unknown deliveries. */
export async function flushTelegramGap(store: RemoteStore, clock: Clock, send: TelegramGapSend): Promise<boolean> {
  const pairing = store.pairing();
  if (!pairing) return true;
  const saved = store.get(STATE);
  let gap = saved ? JSON.parse(saved) as Gap : null;
  if (gap && (gap.chat !== pairing.chatId || gap.user !== pairing.userId)) {
    store.set(STATE, null);
    gap = null;
  }
  if (!gap) {
    const jobs = missed(store, pairing);
    if (!jobs.length) return true;
    const count = new Set(jobs.map(job => job.source ?? job.id)).size;
    gap = { chat: pairing.chatId, user: pairing.userId, jobs: jobs.map(job => job.id), key: `telegram-gap-${randomUUID()}`,
      text: `${count} General messages missed since ${new Date(jobs[0]!.created).toTimeString().slice(0, 5)}` };
    store.set(STATE, JSON.stringify(gap));
  }
  await send(gap.chat, gap.text, gap.key);
  const captured = new Set(gap.jobs);
  store.transaction(() => {
    for (const job of store.outbox()) if (captured.has(job.id) && job.state === 'missed')
      store.putOutbox({ ...job, state: 'reported', updated: clock.now().toISOString() });
    store.set(STATE, null);
  });
  return missed(store, pairing).length === 0;
}
