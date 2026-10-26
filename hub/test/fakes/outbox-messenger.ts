import type { OutboxClient, DeliveryResult } from '../../src/remote/outbox.ts';
import type { OutboxJob, OutboxAttempt } from '../../src/remote/state.ts';

/** Platform delivery facts, without a platform, token, timer or socket. */
export function outboxMessenger() {
  const delivered: OutboxJob[] = [];
  const calls: OutboxAttempt[] = [];
  let lostReceipt = false;
  let outcome: 'sent' | 'never-left' | 'unknown' = 'sent';
  const client: OutboxClient & {
    delivered: OutboxJob[]; calls: OutboxAttempt[];
    beforeSend?: (job: OutboxJob, attempt: OutboxAttempt) => void | Promise<void>;
    refuse: (proof: 'never-left' | 'unknown') => void;
    recover: () => void;
    loseReceipt: () => void;
  } = {
    delivered, calls,
    refuse: proof => { outcome = proof; },
    recover: () => { outcome = 'sent'; lostReceipt = false; },
    loseReceipt: () => { outcome = 'sent'; lostReceipt = true; },
    async send(job, attempt): Promise<DeliveryResult> {
      calls.push({ ...attempt });
      await client.beforeSend?.(job, attempt);
      if (outcome !== 'sent') return { status: outcome };
      delivered.push(job);
      if (lostReceipt) return { status: 'unknown' };
      return { status: 'sent', message: { chatId: 'fixture-chat', messageId: String(9007199254740992n + BigInt(delivered.length)), topic: 'general', message: null, ask: job.source, approval: null } };
    },
    async prove(): Promise<DeliveryResult> { return { status: 'unknown' }; },
  };
  return client;
}
