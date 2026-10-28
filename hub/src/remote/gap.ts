import { randomUUID } from 'node:crypto';
import type { RemoteStore, Pairing, OutboxJob } from './state.ts';
import type { Clock } from '../hub/clock.ts';

export type GapSend = (chat: string, text: string, key: string) => Promise<void>;
type Gap = { chat: string; user: string; text: string; key: string; jobs: string[] };
export type GapOptions = { stateKey: string; matches: (job: OutboxJob, pairing: Pairing) => boolean };

/** A gap owns a captured set of missed jobs, never the arrivals during its send.
 * The native sender must reuse key's existing durable job, including unknown deliveries. */
export async function flushGap(store: RemoteStore, clock: Clock, options: GapOptions, send: GapSend): Promise<boolean> {
  const pairing = store.pairing();
  if (!pairing) return true;
  const missed = () => store.outbox().filter(job => job.kind === 'general' && job.state === 'missed' && options.matches(job, pairing));
  const saved = store.get(options.stateKey);
  let gap = saved ? JSON.parse(saved) as Gap : null;
  if (gap && (gap.chat !== pairing.chatId || gap.user !== pairing.userId)) {
    store.set(options.stateKey, null);
    gap = null;
  }
  if (!gap) {
    const jobs = missed();
    if (!jobs.length) return true;
    const count = new Set(jobs.map(job => job.source ?? job.id)).size;
    gap = { chat: pairing.chatId, user: pairing.userId, jobs: jobs.map(job => job.id), key: `${options.stateKey.replace(/\./g, '-')}-${randomUUID()}`,
      text: `${count} General messages missed since ${new Date(jobs[0]!.created).toTimeString().slice(0, 5)}` };
    store.set(options.stateKey, JSON.stringify(gap));
  }
  await send(gap.chat, gap.text, gap.key);
  const captured = new Set(gap.jobs);
  store.transaction(() => {
    for (const job of store.outbox()) if (captured.has(job.id) && job.state === 'missed')
      store.putOutbox({ ...job, state: 'reported', updated: clock.now().toISOString() });
    store.set(options.stateKey, null);
  });
  return missed().length === 0;
}
