import { pushDev, PushError, type PushResult } from '../territory-push.ts';
import type { Tracker } from '../tracker/tracker.ts';
import { ReleaseError } from '../release.ts';
import type { LogFn } from '../log.ts';
import { clearPublicationReceipt, releaseGit, syncGit } from '../territory-release.ts';
import type { Store } from './store.ts';
import { landedTask, withTerritoryLockAsync, territoryGitAsync, territoryPath, TerritoryGitError } from '../territory.ts';
import type { Resumed, TaskWorktrees } from './worktrees.ts';

export class Releases {
  readonly tracker: Tracker;
  readonly worktrees: TaskWorktrees;
  readonly log: LogFn;
  readonly store: Store;
  constructor(tracker: Tracker, worktrees: TaskWorktrees, log: LogFn, store: Store) { this.tracker = tracker; this.worktrees = worktrees; this.log = log; this.store = store; }

  push(resumed: Resumed, authorize: () => void): Promise<PushResult> {
    let published: PushResult | undefined;
    return this.worktrees.serial(() => withTerritoryLockAsync(this.tracker.root, async () => {
      const pending = resumed(() => {
        authorize();
        return this.tracker.list().flatMap(item => {
          const receipt = this.tracker.mergeReceipt(item.id);
          if (!receipt) return [];
          if (receipt.checkout) throw new PushError('push-state', `finish pending cland merge ${item.id} checkout recovery before pushing dev`);
          const topic = item.topic ? this.store.topic(item.topic) : null;
          return item.state !== 'closed' || item.claim || (topic && topic.status !== 'closed') ? [{ id: item.id, receipt }] : [];
        });
      });
      for (const item of pending) {
        const localTip = await territoryGitAsync(this.tracker.root, ['rev-parse', '--verify', `refs/heads/${item.receipt.base}`]);
        const remoteTip = await territoryGitAsync(territoryPath(this.tracker.root), ['rev-parse', '--verify', `refs/heads/${item.receipt.base}`]);
        await territoryGitAsync(this.tracker.root, ['fetch', '--no-write-fetch-head', '--no-tags', territoryPath(this.tracker.root), remoteTip]);
        for (const tip of [localTip, remoteTip]) {
          const landed = await territoryGitAsync(this.tracker.root, ['merge-base', '--is-ancestor', item.receipt.commit, tip]).then(() => true, err => resumed(() => {
            if (err instanceof TerritoryGitError && err.code === 1) return false;
            throw new PushError('push-state', `cannot verify pending cland merge ${item.id}; preserve its receipt and retry: ${String(err)}`);
          }));
          resumed(() => { if (landed) throw new PushError('push-state', `finish pending cland merge ${item.id} before pushing dev`); });
        }
      }
      const result = await pushDev(this.tracker.root, resumed, authorize);
      return resumed(() => {
        published = result;
        try { this.log({ event: 'dev-pushed', ...result }); }
        catch (err) { published = { ...result, followUp: { step: 'record', error: `pushed; follow-up failed: ${String(err)}` } }; }
        return published;
      });
    }, resumed)).catch((err: unknown) => resumed(() => {
      if (published) return { ...published, followUp: published.followUp ?? { step: 'lock-release', error: `pushed; follow-up failed: ${String(err)}` } };
      try { this.log({ event: err instanceof PushError && err.code === 'push-outcome-unknown' ? 'push-outcome-unknown' : 'push-refused', error: String(err) }); } catch { /* preserve the original error */ }
      throw err;
    }));
  }

  release(version: string | undefined, dryRun: boolean, resumed: Resumed, authorize: () => void) {
    return this.worktrees.serial(() => withTerritoryLockAsync(this.tracker.root, async () => {
      const result = await releaseGit(this.tracker.root, version, dryRun, async id => {
        try { const view = await this.tracker.viewAsync(id, resumed); return resumed(() => view.title); }
        catch { return null; }
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
    }, resumed)).catch((err: unknown) => resumed(() => {
      try { this.log({ event: 'release-refused', error: err instanceof Error ? err.message : String(err), code: err instanceof ReleaseError ? err.code : 'release-git' }); } catch { /* preserve the original error */ }
      throw err;
    }));
  }

  sync(resumed: Resumed, authorize: () => void) {
    return this.worktrees.serial(() => withTerritoryLockAsync(this.tracker.root, async () => {
      const items = resumed(() => {
        authorize();
        return this.tracker.list().filter(item => this.tracker.mergeReceipt(item.id));
      });
      const pending = [];
      for (const item of items) {
        const view = await this.tracker.viewAsync(item.id, resumed);
        const next = resumed(() => {
          // Re-read the receipt, topic and claim after queued file I/O, before testing pending recovery.
          authorize();
          const receipt = this.tracker.mergeReceipt(item.id);
          if (!receipt) return null;
          const topic = view.topic ? this.store.topic(view.topic) : null;
          if (receipt.checkout) throw new ReleaseError('sync-recovery', `finish pending cland merge ${item.id} checkout recovery before sync`);
          return view.state !== 'closed' || this.tracker.claimOf(item.id) || (topic && topic.status !== 'closed') ? { id: item.id, receipt } : null;
        });
        if (next) pending.push(next);
      }
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
    }, resumed)).catch((err: unknown) => resumed(() => {
      try { this.log({ event: 'sync-refused', error: err instanceof Error ? err.message : String(err), code: err instanceof ReleaseError ? err.code : 'sync-git' }); } catch { /* preserve the original error */ }
      throw err;
    }));
  }
}
