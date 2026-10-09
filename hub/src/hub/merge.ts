// The Coordinator's merge gate: one queued territory operation, provenance and cached freshness, then Git and
// the tracker's close. No check command runs here (D16); conflicts go back to the Implementer (D9).
import type { LogFn } from '../log.ts';
import { MergeError } from '../merge.ts';
import type { IndexedVerdict } from '../tracker/index-db.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import { squashTask, withTerritoryLockAsync } from '../territory.ts';
import type { Resumed, TaskWorktrees } from './worktrees.ts';

export class TaskMerges {
  #stopped = false;
  readonly #cleanupTimers = new Set<NodeJS.Timeout>();

  stop(): void {
    this.#stopped = true;
    for (const timer of this.#cleanupTimers) clearTimeout(timer);
    this.#cleanupTimers.clear();
  }

  readonly tracker: Tracker;
  readonly worktrees: TaskWorktrees;
  readonly log: LogFn;
  constructor(tracker: Tracker, worktrees: TaskWorktrees, log: LogFn) {
    this.tracker = tracker;
    this.worktrees = worktrees;
    this.log = log;
  }

  #view(id: string): ItemView {
    let view: ItemView;
    try { view = this.tracker.mergeView(id); }
    catch (err) { throw new MergeError('merge-item', err instanceof Error ? err.message : String(err)); }
    if (view.kind !== 'task' || view.state !== 'open') throw new MergeError('merge-item', `${view.id} must be an open task`);
    if (!view.branch) throw new MergeError('merge-branch', `${view.id} has no branch`);
    return view;
  }

  #verdict(view: ItemView, kind: 'review' | 'qa'): IndexedVerdict {
    const all = view.verdicts.filter((v) => v.verdict === kind);
    const v = all.filter((v) => v.source === 'hub').at(-1);
    if (!v) throw new MergeError(all.length ? `${kind}-provenance` : `${kind}-missing`, `${view.id}: no hub-written ${kind} verdict`);
    const role = kind === 'review' ? 'reviewer' : 'qa';
    if (v.writer?.role !== role || v.writer.sessionId === 'human' || v.writer.sessionId.startsWith('cli:')) throw new MergeError(`${kind}-role`, `${view.id}: the ${kind} writer did not hold ${role}`);
    if (view.claim?.sessionId === v.writer.sessionId) throw new MergeError(`${kind}-claimant`, `${view.id}: its claiming session cannot supply ${kind}`);
    if (v.result !== 'clear') throw new MergeError(`${kind}-not-clear`, `${view.id}: ${kind} is not clear`);
    // mergeView annotates the latest hub verdict even when a later file-only header exists.
    const current = v.current;
    if (current !== true) throw new MergeError(current === undefined ? `${kind}-pending` : `${kind}-stale`, `${view.id}: ${kind} is ${current === undefined ? 'still checking freshness; try again' : 'stale'}`);
    return v;
  }

  #message(view: ItemView, override?: string): string {
    const review = override === undefined ? this.#verdict(view, 'review') : null;
    const qa = override === undefined && view.labels.includes('qa-required') ? this.#verdict(view, 'qa') : null;
    return `${view.title} (${view.id})\n\nItem: ${view.id}${review ? `\nReviewed-by: ${review.author} (${review.run})` : ''}${qa ? `\nQA-by: ${qa.author} (${qa.run})` : ''}`;
  }

  merge(id: string, actor: Actor, resumed: Resumed, override?: string): Promise<{ item: string; commit: string; base: string; cleanup: string }> {
    return this.worktrees.serial(async () => {
      try {
        const landed = await withTerritoryLockAsync(this.tracker.root, async () => {
          const view = resumed(() => this.#view(id));
          await this.tracker.refreshFreshness();
          resumed(() => this.#message(this.#view(id), override));
          return squashTask(this.tracker.root, view.branch!, async (tip) => {
            await this.tracker.refreshFreshness();
            return resumed(() => {
              const now = this.#view(id);
              if (now.branch !== view.branch || this.tracker.freshnessTip(now.branch) !== tip) throw new MergeError('merge-changed', `${id}: task branch changed during preparation; try again`);
              return this.#message(now, override);
            });
          });
        });
        resumed(() => {
          this.tracker.close(actor, id, `Merged ${landed.commit} onto ${landed.base}.${override === undefined ? '' : `\nHuman override: ${override}`}`);
          this.log({ event: 'task-merged', id, session: actor.name, ...landed, ...(override === undefined ? {} : { override }) });
        });
        // Cleanup joins the same queue after this merge releases it, rather than nesting its territory lock.
        return { item: id, ...landed, cleanup: 'pending' };
      } catch (err) {
        resumed(() => this.log({ event: 'merge-refused', id, session: actor.name, code: err instanceof MergeError ? err.code : 'merge-failed', error: err instanceof Error ? err.message : String(err) }));
        throw err;
      }
    }).then(async (result) => ({ ...result, cleanup: await this.#cleanup(id, resumed) }));
  }

  async #cleanup(id: string, resumed: Resumed): Promise<string> {
    if (this.#stopped) return 'pending';
    const pruned = await this.worktrees.prune([id], resumed);
    const failure = pruned.failed[0];
    if (!failure) return 'removed';
    if (/stands? inside|being launched/.test(failure.error)) {
      resumed(() => {
        if (this.#stopped) return;
        const timer = setTimeout(() => {
          this.#cleanupTimers.delete(timer);
          void this.#cleanup(id, resumed).catch((err: unknown) => {
            resumed(() => this.log({ event: 'merge-cleanup-failed', id, error: err instanceof Error ? err.message : String(err) }));
          });
        }, 500);
        this.#cleanupTimers.add(timer);
        timer.unref();
      });
      return 'waiting for sessions';
    }
    resumed(() => this.log({ event: 'merge-cleanup-failed', id, error: failure.error }));
    return failure.error;
  }
}
