// The Coordinator's merge gate: one queued territory operation, provenance and cached freshness, then Git and
// the tracker's close. No check command runs here (D16); conflicts go back to the Implementer (D9).
import type { LogFn } from '../log.ts';
import { MergeError } from '../merge.ts';
import type { IndexedVerdict } from '../tracker/index-db.ts';
import { normalizeId } from '../tracker/item.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import { landedTask, squashTask, territoryGitAsync, territoryPath, withTerritoryLockAsync } from '../territory.ts';
import type { Resumed, TaskWorktrees } from './worktrees.ts';

type MergeResult = { item: string; commit: string; base: string; cleanup: string; followUp?: { step: string; error: string } };

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

  #view(id: string, evidence = true): ItemView {
    let view: ItemView;
    try { view = evidence ? this.tracker.mergeView(id) : this.tracker.view(id); }
    catch (err) { if (err instanceof MergeError) throw err; throw new MergeError('merge-item', err instanceof Error ? err.message : String(err)); }
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

  #incomplete(result: MergeResult, step: string, error: string, resumed: Resumed): MergeResult {
    const followUp = { step, error: `merged, follow-up failed: ${step}: ${error}` };
    // A failed record sink cannot erase the successful landing from the wire result.
    try { resumed(() => this.log({ event: 'merge-follow-up-failed', id: result.item, commit: result.commit, base: result.base, ...followUp })); } catch { /* reported in the returned follow-up */ }
    return { ...result, followUp };
  }

  merge(id: string, actor: Actor, resumed: Resumed, override?: string): Promise<MergeResult> {
    id = normalizeId(id) ?? id;
    return this.worktrees.serial(async (): Promise<MergeResult> => {
      const state: { landed: { commit: string; base: string } | null } = { landed: null };
      let reason = override;
      let recovered = false;
      let step = 'territory lock';
      try {
        await withTerritoryLockAsync(this.tracker.root, async () => {
          const prior = resumed(() => this.tracker.mergeReceipt(id));
          const existing = prior ? await landedTask(this.tracker.root, id, prior, resumed) : null;
          if (prior && existing) {
            resumed(() => {
              state.landed = { commit: prior.commit, base: prior.base };
              step = 'reconcile';
              if (!existing.current) throw new Error(`${id}: already landed, but the task branch changed since; reconcile the item before merging further work`);
              const view = this.tracker.view(id);
              if (view.branch !== prior.branch) throw new MergeError('merge-changed', `${id}: already landed, but the item's branch changed`);
              reason = prior.override;
              recovered = true;
            });
            if (!existing.published) {
              resumed(() => { step = 'publish'; });
              await territoryGitAsync(this.tracker.root, ['push', territoryPath(this.tracker.root), `refs/heads/${prior.base}:refs/heads/${prior.base}`], true);
            }
            return;
          }
          const view = resumed(() => this.#view(id, override === undefined));
          await this.tracker.refreshFreshness(resumed);
          resumed(() => this.#message(this.#view(id, override === undefined), override));
          const result = await squashTask(this.tracker.root, view.branch!, async (tip, base, baseTip) => {
            await this.tracker.refreshFreshness(resumed);
            return resumed(() => {
              const now = this.#view(id, override === undefined);
              if (now.branch !== view.branch || this.tracker.freshnessTip(now.branch) !== tip || this.tracker.freshnessTip(base) !== baseTip || now.verdictBase !== base) throw new MergeError('merge-changed', `${id}: task branch changed during preparation; try again`);
              return this.#message(now, override);
            });
          }, resumed, landing => this.tracker.recordMerge(id, { ...landing, branch: view.branch!, ...(override === undefined ? {} : { override }) }));
          resumed(() => { state.landed = result; });
        });
      } catch (err) {
        if (state.landed) return this.#incomplete({ item: id, ...state.landed, cleanup: 'pending' }, step, err instanceof Error ? err.message : String(err), resumed);
        resumed(() => this.log({ event: 'merge-refused', id, session: actor.name, code: err instanceof MergeError ? err.code : 'merge-failed', error: err instanceof Error ? err.message : String(err) }));
        throw err;
      }
      const result: MergeResult = { item: id, ...state.landed!, cleanup: 'pending' };
      try {
        resumed(() => this.log({ event: recovered ? 'merge-resumed' : 'task-merged', id, session: actor.name, ...state.landed!, ...(reason === undefined ? {} : { override: reason }) }));
      } catch (err) { return this.#incomplete(result, 'record', err instanceof Error ? err.message : String(err), resumed); }
      const failure = resumed(() => this.tracker.finishMerge(actor, id, `Merged ${result.commit} onto ${result.base}.${reason === undefined ? '' : `\nHuman override: ${reason}`}`));
      return failure ? this.#incomplete(result, failure.step, failure.error, resumed) : result;
    }).then(async result => {
      if (result.followUp) return result;
      try {
        const cleanup = await this.#cleanup(id, resumed);
        const finished = { ...result, cleanup };
        return cleanup === 'removed' || cleanup === 'waiting for sessions' || cleanup === 'pending' ? finished : this.#incomplete(finished, 'cleanup', cleanup, resumed);
      } catch (err) { return this.#incomplete(result, 'cleanup', err instanceof Error ? err.message : String(err), resumed); }
    });
  }

  async #cleanup(id: string, resumed: Resumed): Promise<string> {
    if (this.#stopped) return 'pending';
    const branch = resumed(() => this.tracker.mergeReceipt(id)?.branch);
    const pruned = branch ? await this.worktrees.pruneMerged(id, branch, resumed) : await this.worktrees.prune([id], resumed);
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
