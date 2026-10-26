import type { OutboxClient, DeliveryResult } from '../../src/remote/outbox.ts';
import type { OutboxJob, OutboxAttempt } from '../../src/remote/state.ts';

/** Platform delivery facts, without a platform, token, timer or socket. */
export function outboxMessenger() {
  const delivered: OutboxJob[] = [];
  const calls: OutboxAttempt[] = [];
  let lostReceipt = false;
  let outcome: 'sent' | 'never-left' | 'unknown' = 'sent';
  let retryAfterMs: number | undefined;
  const client: OutboxClient & {
    delivered: OutboxJob[]; calls: OutboxAttempt[];
    beforeSend?: (job: OutboxJob, attempt: OutboxAttempt) => void | Promise<void>;
    refuse: (proof: 'never-left' | 'unknown') => void;
    recover: () => void;
    loseReceipt: () => void;
    rateLimit: (ms: number) => void;
  } = {
    delivered, calls,
    refuse: proof => { outcome = proof; },
    recover: () => { outcome = 'sent'; lostReceipt = false; },
    loseReceipt: () => { outcome = 'sent'; lostReceipt = true; },
    rateLimit: ms => { retryAfterMs = ms; },
    async send(job, attempt): Promise<DeliveryResult> {
      calls.push({ ...attempt });
      await client.beforeSend?.(job, attempt);
      if (retryAfterMs !== undefined) {
        const ms = retryAfterMs; retryAfterMs = undefined;
        return { status: 'never-left', retryAfterMs: ms };
      }
      if (outcome !== 'sent') return { status: outcome };
      delivered.push(job);
      if (lostReceipt) return { status: 'unknown' };
      return { status: 'sent', message: { chatId: 'fixture-chat', messageId: String(9007199254740992n + BigInt(delivered.length)), topic: 'general', message: null, ask: job.source, approval: null } };
    },
    async prove(): Promise<DeliveryResult> { return { status: 'unknown' }; },
  };
  return client;
}

/** Cleanup release is independent of the production abort receipt. */
export function heldOutboxReconnect(observeAbort = true) {
  const release = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  let entered = false;
  let exited = false;
  let settled = false;
  return {
    get entered() { return entered; },
    get exited() { return exited; },
    get settled() { return settled; },
    abortReceipt: aborted.promise,
    release: () => release.resolve(),
    reconnect: async (signal: AbortSignal) => {
      entered = true;
      const abort = () => { exited = true; aborted.resolve(); release.resolve(); };
      if (observeAbort) signal.addEventListener('abort', abort, { once: true });
      try { await release.promise; settled = true; return true; }
      finally { signal.removeEventListener('abort', abort); }
    },
  };
}
