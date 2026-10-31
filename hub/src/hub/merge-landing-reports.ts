import type { Store } from './store.ts';
import type { Tracker } from '../tracker/tracker.ts';
import type { TopicNotice } from './core.ts';

type Obligation = { item: string; head: string; branch: string; batch: string; topic: string; recipients: string[] };
const KEY = 'merge-landing-reports';
/** Only unsettled queue landings are retained, independently of queue/claim cleanup. */
export class MergeLandingReports {
  readonly store: Store;
  readonly tracker: Pick<Tracker, 'summary' | 'mergeReceipt'>;
  readonly notice: (topic: string, notice: TopicNotice, ids: string[]) => { id: string; pending: string[] } | null;
  constructor(store: Store, tracker: Pick<Tracker, 'summary' | 'mergeReceipt'>,
    notice: (topic: string, notice: TopicNotice, ids: string[]) => { id: string; pending: string[] } | null) {
    this.store = store; this.tracker = tracker; this.notice = notice;
  }
  #pending(): Obligation[] { return JSON.parse(this.store.meta(KEY) ?? '[]') as Obligation[]; }
  capture(obligation: Obligation): void {
    const pending = this.#pending();
    if (pending.some(row => row.item === obligation.item && row.batch === obligation.batch)) return;
    pending.push({ ...obligation, recipients: [...new Set(obligation.recipients)] });
    this.store.setMeta(KEY, JSON.stringify(pending));
  }
  retire(item: string, batch: string): void {
    this.store.setMeta(KEY, JSON.stringify(this.#pending().filter(row => row.item !== item || row.batch !== batch)));
  }
  reconcile(): void {
    this.store.transaction(() => {
      const remaining = this.#pending().filter(row => {
        const receipt = this.tracker.mergeReceipt(row.item);
        if (this.tracker.summary(row.item)?.state !== 'closed' || receipt?.tip !== row.head || receipt.branch !== row.branch) return true;
        const admitted = this.notice(row.topic, {
          id: `merge-queue-landed:${row.batch}:${row.item}:${receipt.commit}`, kind: 'report',
          text: `merge-queue-landed ${row.item}: merged ${receipt.commit} onto ${receipt.base}; batch ${row.batch}`,
          detail: { event: 'merge-queue-landed', item: row.item, commit: receipt.commit, batch: row.batch },
        }, row.recipients);
        if (!admitted) return true;
        row.recipients = admitted.pending;
        return row.recipients.length > 0;
      });
      this.store.setMeta(KEY, JSON.stringify(remaining));
    });
  }
}
