// Durable FIFO requests pin a reviewed head; execution belongs to the merge batch runner.
import type { MergeQueueEntry } from '../protocol.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import { branchTips, gitIn, resolveCommit, type Git } from '../tracker/verdict-git.ts';
import { MergeError } from '../merge.ts';
import type { Store } from './store.ts';
import type { Clock } from './clock.ts';
import type { Resumed } from './worktrees.ts';

export class MergeQueue {
  readonly git: Git;
  readonly store: Store;
  readonly tracker: Tracker;
  readonly clock: Clock;
  readonly enabled: () => boolean;
  readonly #unwatch: Array<() => void>;
  #stopped = false;
  readonly dropped: (entry: MergeQueueEntry, reason: string) => void;
  constructor(store: Store, tracker: Tracker, clock: Clock, enabled: () => boolean, git?: Git, env?: NodeJS.ProcessEnv, dropped: (entry: MergeQueueEntry, reason: string) => void = () => {}) {
    this.dropped = dropped;
    this.store = store; this.tracker = tracker; this.clock = clock; this.enabled = enabled;
    this.git = git ?? gitIn(tracker.root, env);
    this.#unwatch = [tracker.onChange(() => this.reconcile()), tracker.onTipsChanged(() => this.reconcile(true)), tracker.onVerdict((id, _author, verdict) => {
      if (verdict.result !== 'not clear') return;
      const entry = this.entries().find(entry => entry.item === id);
      if (entry) this.drop(entry, `${verdict.verdict} not clear`);
    })];
  }

  entries(): MergeQueueEntry[] { return this.store.mergeQueue(); }

  stop(): void { this.#stopped = true; for (const unwatch of this.#unwatch) unwatch(); }

  async refresh(resumed: Resumed = work => work()): Promise<MergeQueueEntry[]> {
    if (!this.entries().length || this.#stopped) return this.entries();
    const tips = await branchTips(this.git, resumed);
    return resumed(() => { if (!this.#stopped) this.reconcile(tips !== null, tips ?? undefined); return this.entries(); });
  }

  reconcile(refreshed = false, tips?: ReadonlyMap<string, string>): void {
    if (this.#stopped) return;
    for (const entry of this.entries()) {
      const item = this.tracker.summary(entry.item);
      const head = tips ? tips.get(entry.branch) ?? null : this.tracker.freshnessTip(entry.branch);
      let reason: string | undefined;
      if (item?.state === 'closed' && this.tracker.mergeReceipt(entry.item)) { this.store.dropMerge(entry.item); continue; }
      if (!item || item.state === 'closed') reason = 'item closed or removed';
      else if (item.branch !== entry.branch) reason = 'task branch changed';
      else if ((head !== null || refreshed) && head !== entry.head) reason = 'branch head changed or deleted';
      else {
        for (const kind of ['review', 'qa'] as const) {
          const verdict = item.verdicts.filter(v => v.source === 'hub' && v.verdict === kind && v.stage === undefined).at(-1);
          if (verdict?.result === 'not clear') reason = `${kind} not clear`;
        }
      }
      if (reason) this.drop(entry, reason);
    }
  }

  position(item: string): { position: number; enqueued: string } | undefined {
    const entries = this.entries(), index = entries.findIndex(entry => entry.item === item);
    return index < 0 ? undefined : { position: index + 1, enqueued: entries[index]!.enqueued };
  }

  cancel(item: string): { item: string; cancelled: boolean } {
    item = this.tracker.resolveId(item) ?? item;
    const entry = this.entries().find(entry => entry.item === item);
    if (entry) this.drop(entry, 'cancelled');
    return { item, cancelled: !!entry };
  }

  drop(entry: MergeQueueEntry, reason: string): void {
    this.store.transaction(() => {
      this.store.dropMerge(entry.item);
      this.dropped(entry, reason);
    });
  }

  async candidate(view: ItemView, resumed: Resumed): Promise<{ head: string; base: string; baseTip: string; files: string[] }> {
    const base = view.verdictBase;
    if (!base || !view.branch || ['dev', 'main', base].includes(view.branch)) throw new MergeError('merge-branch', 'no task branch or integration base');
    const head = await resolveCommit(this.git, `refs/heads/${view.branch}`);
    const baseTip = await resolveCommit(this.git, `refs/heads/${base}`);
    if (!head || !baseTip) throw new MergeError('merge-branch', `${view.id}: branch or base is missing`);
    const paths = await this.git(['diff', '--no-renames', '--name-only', '-z', `${baseTip}...${head}`, '--']);
    return resumed(() => {
      if (paths === null) throw new MergeError('merge-git', 'cannot read task paths');
      return { head, base, baseTip, files: paths.split('\0').filter(Boolean) };
    });
  }

  enqueue(view: ItemView, head: string, base: string, actor: Actor): { item: string; queued: number } {
    this.reconcile();
    const queued = this.store.enqueueMerge({ item: view.id, branch: view.branch!, head, verdictBase: base, enqueued: this.clock.now().toISOString(), by: actor });
    return { item: view.id, queued };
  }
}
