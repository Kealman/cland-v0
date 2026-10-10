// The Coordinator's merge gate: one queued territory operation, provenance and cached freshness, then Git and
// the tracker's close. No check command runs here (D16); conflicts go back to the Implementer (D9).
import type { LogFn } from '../log.ts';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { MergeError } from '../merge.ts';
import { gateVerdicts } from '../tracker/gate-verdicts.ts';
import { normalizeId } from '../tracker/item.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import { landedTask, reconcileTaskCheckout, restoreTaskCheckout, squashTask, territoryGitAsync, territoryPath, withTerritoryLockAsync } from '../territory.ts';
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

  async #view(id: string, resumed: Resumed, evidence = true): Promise<ItemView> {
    let view: ItemView;
    try { view = await (evidence ? this.tracker.mergeViewAsync(id, resumed) : this.tracker.viewAsync(id, resumed)); }
    catch (err) { return resumed(() => { if (err instanceof MergeError) throw err; throw new MergeError('merge-item', err instanceof Error ? err.message : String(err)); }); }
    return resumed(() => {
      if (view.kind !== 'task' || view.state !== 'open') throw new MergeError('merge-item', `${view.id} must be an open task`);
      if (!view.branch) throw new MergeError('merge-branch', `${view.id} has no branch`);
      return view;
    });
  }

  #message(view: ItemView, override?: string): string {
    const { review, qa } = override === undefined ? gateVerdicts(view) : { review: null, qa: null };
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
      let landingFailure: { step: string; error: string } | undefined;
      try {
        await withTerritoryLockAsync(this.tracker.root, async () => {
          const pendingSync = await access(join(this.tracker.root, '.cland', 'sync.tmp')).then(() => true, err => resumed(() => {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw err;
          }));
          const prior = resumed(() => {
            if (pendingSync) throw new MergeError('merge-recovery', `finish pending cland sync before merging ${id}`);
            return this.tracker.mergeReceipt(id);
          });
          const existing = prior ? await landedTask(this.tracker.root, id, prior, resumed) : null;
          if (prior && existing) {
            resumed(() => {
              state.landed = { commit: prior.commit, base: prior.base };
              step = 'reconcile';
              if (!existing.current) throw new Error(`${id}: already landed, but the task branch changed since; reconcile the item before merging further work`);
            });
            const view = await this.tracker.viewAsync(id, resumed);
            resumed(() => {
              if (view.branch !== prior.branch) throw new MergeError('merge-changed', `${id}: already landed, but the item's branch changed`);
              reason = prior.override;
              recovered = true;
            });
            resumed(() => { step = 'checkout'; });
            await reconcileTaskCheckout(this.tracker.root, prior, resumed, () => {
              const { checkout: _checkout, ...coherent } = prior;
              this.tracker.recordMerge(id, coherent);
            });
            if (!existing.published) {
              resumed(() => { step = 'publish'; });
              await territoryGitAsync(this.tracker.root, ['push', territoryPath(this.tracker.root), `refs/heads/${prior.base}:refs/heads/${prior.base}`], true);
            }
            return;
          }
          if (prior?.checkout) {
            try {
              const parent = await territoryGitAsync(this.tracker.root, ['rev-parse', `${prior.commit}^`]);
              const base = await territoryGitAsync(this.tracker.root, ['rev-parse', `refs/heads/${prior.base}`]);
              resumed(() => { if (base !== parent) throw new Error('the integration ref moved since preparation; its checkout was kept'); });
              await restoreTaskCheckout(this.tracker.root, { ...prior, checkout: prior.checkout }, resumed);
              resumed(() => {
                const { checkout: _checkout, ...restored } = prior;
                this.tracker.recordMerge(id, restored);
              });
            } catch (err) {
              resumed(() => { throw new MergeError('merge-recovery', `checkout recovery pending for prepared ${prior.commit} on ${prior.base}: ${err instanceof Error ? err.message : String(err)}`, undefined, { commit: prior.commit, base: prior.base }); });
            }
          }
          const view = await this.#view(id, resumed, override === undefined);
          await this.tracker.refreshFreshness(resumed);
          const checked = await this.#view(id, resumed, override === undefined);
          resumed(() => this.#message(checked, override));
          try {
            const result = await squashTask(this.tracker.root, view.branch!, async (tip, base, baseTip) => {
              await this.tracker.refreshFreshness(resumed);
              const now = await this.#view(id, resumed, override === undefined);
              return resumed(() => {
                if (now.branch !== view.branch || this.tracker.freshnessTip(now.branch) !== tip || this.tracker.freshnessTip(base) !== baseTip || now.verdictBase !== base) throw new MergeError('merge-changed', `${id}: task branch changed during preparation; try again`);
                return this.#message(now, override);
              });
            }, resumed, landing => this.tracker.recordMerge(id, { ...landing, branch: view.branch!, ...(override === undefined ? {} : { override }) }));
            resumed(() => { state.landed = result; });
          } catch (err) {
            // The failing step alone cannot decide the outcome: a failed rollback can leave either ref landed.
            const receipt = resumed(() => this.tracker.mergeReceipt(id));
            const observed = receipt ? await landedTask(this.tracker.root, id, receipt, resumed) : null;
            resumed(() => {
              if (!receipt || !observed) {
                // A complete prelanding rollback needs no further checkout recovery. Later user staging is ordinary
                // root work, rather than an edit to a still-pending restoration snapshot.
                if (receipt && err instanceof MergeError && err.code === 'merge-git') {
                  const { checkout: _checkout, ...restored } = receipt;
                  this.tracker.recordMerge(id, restored);
                }
                throw err;
              }
              state.landed = { commit: receipt.commit, base: receipt.base };
              reason = receipt.override;
              const error = err instanceof Error ? err.message : String(err);
              landingFailure = observed.published ? { step: 'checkout', error: `checkout reconciliation pending: ${error}` } : { step: 'rollback', error: `rollback failed: ${error}; publish pending` };
            });
          }
        }, resumed);
      } catch (err) {
        return resumed(() => {
          if (state.landed) return this.#incomplete({ item: id, ...state.landed, cleanup: 'pending' }, step, err instanceof Error ? err.message : String(err), resumed);
          this.log({ event: err instanceof MergeError && err.code === 'merge-recovery' ? 'merge-recovery-pending' : 'merge-refused', id, session: actor.name, code: err instanceof MergeError ? err.code : 'merge-failed', error: err instanceof Error ? err.message : String(err), ...(err instanceof MergeError && err.recovery ? err.recovery : {}) });
          throw err;
        });
      }
      const result: MergeResult = { item: id, ...state.landed!, cleanup: 'pending' };
      try {
        resumed(() => this.log({ event: recovered ? 'merge-resumed' : 'task-merged', id, session: actor.name, ...state.landed!, ...(reason === undefined ? {} : { override: reason }) }));
      } catch (err) { return this.#incomplete(result, 'record', err instanceof Error ? err.message : String(err), resumed); }
      if (landingFailure) return this.#incomplete(result, landingFailure.step, landingFailure.error, resumed);
      const failure = await resumed(() => this.tracker.finishMerge(actor, id, `Merged ${result.commit} onto ${result.base}.${reason === undefined ? '' : `\nHuman override: ${reason}`}`, resumed));
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
    const receipt = resumed(() => this.tracker.mergeReceipt(id));
    const pruned = receipt ? await this.worktrees.pruneMerged(id, receipt, resumed) : await this.worktrees.prune([id], resumed);
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
