import type { Tracker } from '../tracker/tracker.ts';
import { ReleaseError } from '../release.ts';
import type { LogFn } from '../log.ts';
import { clearPublicationReceipt, releaseGit, syncGit } from '../territory-release.ts';
import type { Store } from './store.ts';
import { landedTask, withTerritoryLockAsync } from '../territory.ts';
import type { Resumed, TaskWorktrees } from './worktrees.ts';

export class Releases {
  readonly tracker: Tracker;
  readonly worktrees: TaskWorktrees;
  readonly log: LogFn;
  readonly store: Store;
  constructor(tracker: Tracker, worktrees: TaskWorktrees, log: LogFn, store: Store) { this.tracker = tracker; this.worktrees = worktrees; this.log = log; this.store = store; }

  release(version: string | undefined, dryRun: boolean, resumed: Resumed, authorize: () => void) {
    return this.worktrees.serial(() => withTerritoryLockAsync(this.tracker.root, async () => {
      const result = await releaseGit(this.tracker.root, version, dryRun, id => {
        try { return this.tracker.view(id).title; } catch { return null; }
      }, resumed, authorize);
      try {
        resumed(() => this.log({ event: dryRun ? 'release-preview' : 'released', ...result }));
        if (!dryRun && !result.followUp) await clearPublicationReceipt(this.tracker.root, 'release');
      }
      catch (err) {
        if (dryRun) throw err;
        return { ...result, followUp: result.followUp ?? { step: 'record', error: `released; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } };
      }
      return result;
    })).catch((err: unknown) => {
      try { resumed(() => this.log({ event: 'release-refused', error: err instanceof Error ? err.message : String(err), code: err instanceof ReleaseError ? err.code : 'release-git' })); } catch { /* preserve the original error */ }
      throw err;
    });
  }

  sync(resumed: Resumed, authorize: () => void) {
    return this.worktrees.serial(() => withTerritoryLockAsync(this.tracker.root, async () => {
      const pending = resumed(() => {
        authorize();
        return this.tracker.list().flatMap(item => {
          const receipt = this.tracker.mergeReceipt(item.id);
          if (!receipt) return [];
          const view = this.tracker.view(item.id);
          const topic = view.topic ? this.store.topic(view.topic) : null;
          if (receipt.checkout) throw new ReleaseError('sync-recovery', `finish pending cland merge ${item.id} checkout recovery before sync`);
          return view.state !== 'closed' || view.claim || (topic && topic.status !== 'closed') ? [{ id: item.id, receipt }] : [];
        });
      });
      for (const item of pending) {
        const landed = await landedTask(this.tracker.root, item.id, item.receipt, resumed);
        resumed(() => { if (landed) throw new ReleaseError('sync-recovery', `finish pending cland merge ${item.id} before sync rewrites its landing`); });
      }
      const result = await syncGit(this.tracker.root, resumed, authorize);
      try {
        resumed(() => this.log({ event: 'synced', ...result }));
        if (!result.followUp) await clearPublicationReceipt(this.tracker.root, 'sync');
      }
      catch (err) { return { ...result, followUp: result.followUp ?? { step: 'record', error: `synced locally; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } }; }
      return result;
    })).catch((err: unknown) => {
      try { resumed(() => this.log({ event: 'sync-refused', error: err instanceof Error ? err.message : String(err), code: err instanceof ReleaseError ? err.code : 'sync-git' })); } catch { /* preserve the original error */ }
      throw err;
    });
  }
}
