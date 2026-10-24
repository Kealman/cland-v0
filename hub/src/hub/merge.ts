// The Coordinator's merge gate: one queued territory operation, provenance and cached freshness, then Git and
// the tracker's close. No check command runs here (D16); conflicts go back to the Implementer (D9).
import type { Git } from '../tracker/verdict-git.ts';
import { requireMergeWorktree } from '../territory.ts';
import { refusedOverridePaths } from '../merge-override.ts';
import type { LogFn } from '../log.ts';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { MergeError } from '../merge.ts';
import { epicMergeFiles } from '../tracker/epic-surfaces.ts';
import { gateVerdicts, incompleteCriteria } from '../tracker/gate-verdicts.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import { landedTask, reconcileTaskCheckout, restoreTaskCheckout, squashTask, territoryGitAsync, territoryPath, withTerritoryLockAsync } from '../territory.ts';
import type { Resumed, TaskWorktrees } from './worktrees.ts';
import type { MergeQueue } from './merge-queue.ts';
import { ToolForbidden } from '../roles/permissions.ts';

type LandedResult = { item: string; commit: string; base: string; cleanup: string; budgetLines?: string[]; followUp?: { step: string; error: string } };

type MergeResult = LandedResult | { item: string; queued: number };

export class TaskMerges {
  readonly #env: NodeJS.ProcessEnv;
  #stopped = false;
  readonly #cleanupTimers = new Set<NodeJS.Timeout>();

  stop(): void {
    this.#stopped = true;
    for (const timer of this.#cleanupTimers) clearTimeout(timer);
    this.#cleanupTimers.clear();
  }

  readonly tracker: Tracker;
  readonly queue: MergeQueue | undefined;
  readonly worktrees: Pick<TaskWorktrees, 'serial' | 'prune' | 'pruneMerged'>;
  readonly #squash: typeof squashTask;
  readonly #git: typeof territoryGitAsync;
  readonly #rootGit: typeof territoryGitAsync;
  readonly log: LogFn;
  readonly #territoryLock: typeof withTerritoryLockAsync;
  readonly afterMerge: (item: string, resumed: Resumed) => Promise<void>;
  constructor(tracker: Tracker, worktrees: Pick<TaskWorktrees, 'serial' | 'prune' | 'pruneMerged'>, log: LogFn, afterMerge: (item: string, resumed: Resumed) => Promise<void> = async () => {}, env: NodeJS.ProcessEnv = process.env, territoryLock: typeof withTerritoryLockAsync = withTerritoryLockAsync, queue?: MergeQueue, squash: typeof squashTask = squashTask, git: typeof territoryGitAsync = territoryGitAsync, rootGit?: Git) {
    this.#git = git;
    // The admission fact shares the hub's read-only probe boundary. Recovery
    // and territory writes retain their separate native/injected Git runner.
    this.#rootGit = rootGit ? async (_cwd, args, _marked, input) => await rootGit(args, input) ?? '' : git;
    this.#squash = squash;
    this.queue = queue;
    this.#env = env;
    this.#territoryLock = territoryLock;
    this.tracker = tracker;
    this.worktrees = worktrees;
    this.log = log;
    this.afterMerge = afterMerge;
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

  async #laneHold(view: ItemView, files: readonly string[], dev: string, resumed: Resumed): Promise<() => void> {
    const revision = resumed(() => this.tracker.laneRevision(view.id));
    const holds: Array<{ id: string; files: string[] }> = [];
    for (const ancestor of view.ancestry.filter(a => this.tracker.isPlanContainer(a.kind))) {
      const epic = await this.tracker.viewAsync(ancestor.id, resumed);
      for (const id of epic.follows ?? []) {
        const predecessor = await this.tracker.viewAsync(id, resumed);
        const pending = () => predecessor.state === 'open' && this.tracker.followStatus(id).met
          && !predecessor.verdicts.some(v => v.verdict === 'qa' && v.stage === undefined && v.source === 'hub' && v.writer?.role === 'qa');
        if (!resumed(pending)) continue;
        const tasks = resumed(() => this.tracker.list({ under: id, kind: 'task' }).map(t => t.id));
        const surfaces = await epicMergeFiles(this.tracker.root, tasks, dev, this.#env, args => this.#git(this.tracker.root, args, undefined, undefined, this.#env));
        const overlap = resumed(() => files.filter(file => surfaces.includes(file)));
        if (overlap.length) holds.push({ id, files: [...overlap] });
      }
    }
    // Run beside the final verdict/message check: no added file or Git await can hide changed inputs.
    return () => {
      if (revision !== this.tracker.laneRevision(view.id)) throw new MergeError('merge-changed', `${view.id}: lane or gate inputs changed during lookup; try again`);
      const hold = holds[0];
      if (hold) throw new MergeError('merge-hold', `${view.id}: ${hold.id} demo pending; overlapping files: ${hold.files.join(', ')}. Wait for its demo verdict or closure.`, hold.files);
    };
  }

  #message(view: ItemView, override?: string): string {
    if (override !== undefined) {
      const criteria = incompleteCriteria(view);
      if (criteria.length) this.log({ event: 'merge-criteria-overridden', id: view.id, override, criteria });
    }
    const { review, qa } = override === undefined ? gateVerdicts(view) : { review: null, qa: null };
    return `${view.title} (${view.id})\n\nItem: ${view.id}${review ? `\nReviewed-by: ${review.author} (${review.run})` : ''}${qa ? `\nQA-by: ${qa.author} (${qa.run})` : ''}`;
  }

  #incomplete(result: LandedResult, step: string, error: string, resumed: Resumed): LandedResult {
    const followUp = { step, error: `merged, follow-up failed: ${step}: ${error}` };
    // A failed record sink cannot erase the successful landing from the wire result.
    try { resumed(() => this.log({ event: 'merge-follow-up-failed', id: result.item, commit: result.commit, base: result.base, ...followUp })); } catch { /* reported in the returned follow-up */ }
    return { ...result, followUp };
  }

  merge(id: string, actor: Actor, resumed: Resumed, override?: string, authorize: () => void = () => {}, queuedCandidate?: { head: string; base: string }): Promise<MergeResult> {
    id = this.tracker.resolveId(id) ?? id;
    return this.worktrees.serial(async (): Promise<MergeResult> => {
      const state: { landed: { commit: string; base: string; budgetLines?: string[] } | null } = { landed: null };
      let queued: { item: string; queued: number } | undefined;
      let reason = override;
      let recovered = false;
      let step = 'territory lock';
      let landingFailure: { step: string; error: string } | undefined;
      try {
        await this.#territoryLock(this.tracker.root, async () => {
          resumed(authorize);
          await requireMergeWorktree(this.tracker.root, resumed, this.#env, this.#rootGit);
          const pendingPublish = await access(join(this.tracker.root, '.cland', 'publish.tmp')).then(() => true, err => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; });
          if (pendingPublish) throw new MergeError('merge-recovery', `finish pending cland publish before merging ${id}`);
          const pendingSync = await access(join(this.tracker.root, '.cland', 'sync.tmp')).then(() => true, err => resumed(() => {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw err;
          }));
          const prior = resumed(() => {
            if (pendingSync) throw new MergeError('merge-recovery', `finish pending cland sync before merging ${id}`);
            return this.tracker.mergeReceipt(id);
          });
          const existing = prior ? await landedTask(this.tracker.root, id, prior, resumed, undefined, this.#env, this.#git) : null;
          if (prior && existing) {
            resumed(() => {
              state.landed = { commit: prior.commit, base: prior.base };
              step = 'reconcile';
            });
            const view = await this.tracker.viewAsync(id, resumed);
            resumed(() => {
              // A closed landing may have a recreated stale branch from dev. Cleanup checks
              // containment before deleting it; an open recovery still requires the original tip.
              if (!existing.current && (view.state !== 'closed' || view.claim || prior.checkout || !existing.published)) throw new Error(`${id}: already landed, but the task branch changed since; reconcile the item before merging further work`);
              if (view.branch !== prior.branch) throw new MergeError('merge-changed', `${id}: already landed, but the item's branch changed`);
              reason = prior.override;
              recovered = true;
            });
            resumed(() => { step = 'checkout'; });
            resumed(authorize);
            await reconcileTaskCheckout(this.tracker.root, prior, resumed, () => {
              const { checkout: _checkout, ...coherent } = prior;
              this.tracker.recordMerge(id, coherent);
            }, authorize, this.#env, this.#git);
            if (!existing.published) {
              resumed(authorize);
              resumed(() => { step = 'publish'; });
              await this.#git(this.tracker.root, ['push', territoryPath(this.tracker.root), `refs/heads/${prior.base}:refs/heads/${prior.base}`], true, undefined, this.#env);
            }
            return;
          }
          if (prior?.checkout) {
            try {
              const parent = await this.#git(this.tracker.root, ['rev-parse', `${prior.commit}^`], undefined, undefined, this.#env);
              const base = await this.#git(this.tracker.root, ['rev-parse', `refs/heads/${prior.base}`], undefined, undefined, this.#env);
              resumed(() => { if (base !== parent) throw new Error('the integration ref moved since preparation; its checkout was kept'); });
              await restoreTaskCheckout(this.tracker.root, { ...prior, checkout: prior.checkout }, resumed, authorize, this.#env, this.#git);
              resumed(() => {
                const { checkout: _checkout, ...restored } = prior;
                this.tracker.recordMerge(id, restored);
              });
            } catch (err) {
              if (err instanceof ToolForbidden) throw err;
              resumed(() => { throw new MergeError('merge-recovery', `checkout recovery pending for prepared ${prior.commit} on ${prior.base}: ${err instanceof Error ? err.message : String(err)}`, undefined, { commit: prior.commit, base: prior.base }); });
            }
          }
          const view = await this.#view(id, resumed, override === undefined);
          await this.tracker.refreshFreshness(resumed);
          const checked = await this.#view(id, resumed, override === undefined);
          resumed(() => this.#message(checked, override));
          if (!queuedCandidate && this.queue?.enabled() && override === undefined) {
            const candidate = await this.queue.candidate(checked, resumed);
            if (refusedOverridePaths(candidate.files).length) {
              const validateLane = await this.#laneHold(checked, candidate.files, candidate.baseTip, resumed);
              await this.tracker.refreshFreshness(resumed);
              const finalView = await this.#view(id, resumed);
              resumed(() => {
                validateLane();
                authorize();
                this.#message(finalView);
                if (!this.queue?.enabled()) throw new MergeError('merge-changed', 'merge queue setting changed during enqueue; try again');
                if (finalView.branch !== checked.branch || this.tracker.freshnessTip(finalView.branch) !== candidate.head || this.tracker.freshnessTip(candidate.base) !== candidate.baseTip || finalView.verdictBase !== candidate.base) throw new MergeError('merge-changed', `${id}: task branch changed during enqueue; try again`);
                queued = this.queue!.enqueue(finalView, candidate.head, candidate.base, actor);
              });
              return;
            }
          }
          try {
            const result = await this.#squash(this.tracker.root, view.branch!, async (tip, base, baseTip, files) => {
              resumed(() => {
                if (queuedCandidate && baseTip !== queuedCandidate.base) throw new MergeError('merge-changed', 'batch base moved before landing');
                if (queuedCandidate && tip !== queuedCandidate.head) throw new MergeError('merge-changed', `${id}: queued task branch changed before landing; prepared head ${queuedCandidate.head}, current head ${tip}`);
                if (queuedCandidate && !this.queue?.entries().some(entry => entry.item === id && entry.head === tip)) throw new MergeError('merge-changed', 'queued candidate removed before landing');
                if (!queuedCandidate && override === undefined && this.queue?.enabled() && refusedOverridePaths(files).length) throw new MergeError('merge-changed', 'task requires the merge queue; try again');
                if (override === undefined) return;
                const refused = refusedOverridePaths(files);
                if (refused.length) throw new MergeError('merge-override-scope', `override is limited to tracker and documentation changes; review required for: ${refused.join(', ')}`, refused);
              });
              await this.tracker.refreshFreshness(resumed);
              const now = await this.#view(id, resumed, override === undefined);
              const validateLane = await this.#laneHold(now, files, baseTip, resumed);
              const finalView = await this.#view(id, resumed, override === undefined);
              return resumed(() => {
                validateLane();
                authorize();
                const currentHead = this.tracker.freshnessTip(finalView.branch);
                if (finalView.branch !== view.branch || currentHead !== tip) throw new MergeError('merge-changed', `${id}: task branch changed during preparation; prepared head ${tip}, current head ${currentHead ?? 'missing'}; try again`);
                if (finalView.verdictBase !== base) throw new MergeError('merge-changed', `${id}: integration base changed from ${base} to ${finalView.verdictBase ?? 'missing'} during preparation; try again`);
                const currentBase = this.tracker.freshnessTip(base);
                if (currentBase !== baseTip) throw new MergeError('merge-changed', `${id}: ${queuedCandidate ? 'batch' : 'integration'} base moved during preparation; prepared head ${baseTip}, current head ${currentBase ?? 'missing'}; try again`);
                return this.#message(finalView, override);
              });
            }, resumed, landing => this.tracker.recordMerge(id, { ...landing, branch: view.branch!, ...(override === undefined ? {} : { override }) }), authorize, this.#env);
            resumed(() => { state.landed = result; });
          } catch (err) {
            // The failing step alone cannot decide the outcome: a failed rollback can leave either ref landed.
            const receipt = resumed(() => this.tracker.mergeReceipt(id));
            const observed = receipt ? await landedTask(this.tracker.root, id, receipt, resumed, undefined, this.#env, this.#git) : null;
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
      if (queued) return queued;
      const result: LandedResult = { item: id, ...state.landed!, cleanup: 'pending' };
      try {
        resumed(() => this.log({ event: recovered ? 'merge-resumed' : 'task-merged', id, session: actor.name, ...state.landed!, ...(reason === undefined ? {} : { override: reason }) }));
      } catch (err) { return this.#incomplete(result, 'record', err instanceof Error ? err.message : String(err), resumed); }
      if (landingFailure) return this.#incomplete(result, landingFailure.step, landingFailure.error, resumed);
      const failure = await resumed(() => this.tracker.finishMerge(actor, id, `Merged ${result.commit} onto ${result.base}.${reason === undefined ? '' : `\nHuman override: ${reason}`}`, resumed, authorize));
      return resumed(() => failure ? this.#incomplete(result, failure.step, failure.error, resumed) : result);
    }).then(async result => {
      if ('queued' in result || result.followUp) return result;
      try {
        await resumed(() => this.afterMerge(id, resumed));
      } catch (err) { return this.#incomplete(result, 'stop sessions', err instanceof Error ? err.message : String(err), resumed); }
      try {
        const cleanup = await resumed(() => this.#cleanup(id, resumed));
        return resumed(() => {
          const finished = { ...result, cleanup };
          return cleanup === 'removed' || cleanup === 'waiting for sessions' || cleanup === 'pending' ? finished : this.#incomplete(finished, 'cleanup', cleanup, resumed);
        });
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
