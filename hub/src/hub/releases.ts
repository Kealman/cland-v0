import { pushDev, PushError, type PushResult } from '../territory-push.ts';
import type { Tracker } from '../tracker/tracker.ts';
import { ReleaseError } from '../release.ts';
import type { LogFn } from '../log.ts';
import { clearPublicationReceipt, releaseGit, syncGit } from '../territory-release.ts';
import type { Store } from './store.ts';
import { landedTask, withTerritoryLockAsync, territoryGitAsync, territoryPath, TerritoryGitError } from '../territory.ts';
import type { Resumed, TaskWorktrees } from './worktrees.ts';

/** Read a level-two section, keeping nested headings and ignoring headings inside code fences. */
function section(body: string, name: string): string {
  const lines = body.split(/\r?\n/);
  let start = -1, fence: { char: string; size: number } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1]![0] === fence.char && marker[1]!.length >= fence.size && !marker[2]!.trim()) fence = undefined;
      continue;
    }
    if (marker) { fence = { char: marker[1]![0]!, size: marker[1]!.length }; continue; }
    const heading = /^ {0,3}(#{1,2})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    if (start >= 0) return lines.slice(start, i).join('\n').trim();
    if (heading[1] === '##' && heading[2] === name) start = i + 1;
  }
  return start < 0 ? '' : lines.slice(start).join('\n').trim();
}

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

  release(version: string | undefined, dryRun: boolean, resumed: Resumed, authorize: () => void, item?: string) {
    return this.worktrees.serial(() => withTerritoryLockAsync(this.tracker.root, async () => {
      let notesPrefix: string | undefined;
      if (item !== undefined) {
        resumed(authorize);
        const view = await this.tracker.viewAsync(item, resumed);
        version = resumed(() => {
          authorize();
          if (view.kind !== this.tracker.levels[0]) throw new ReleaseError('release-item', `${view.id} is not a release item (kind: ${view.kind})`);
          if (!view.version) throw new ReleaseError('release-version', `${view.id} has no version; set its release version first`);
          if (version !== undefined && version !== `v${view.version}`) throw new ReleaseError('release-version', `${version} disagrees with ${view.id}'s version v${view.version}`);
          const open = this.tracker.list({ under: view.id, state: 'open' });
          if (open.length) throw new ReleaseError('release-item', `${view.id} has open children: ${open.map(child => `${child.id} ${child.title}`).join(', ')}; close or move them first`);
          if (!dryRun) throw new ReleaseError('release-item', `${view.id}: item releases currently require --dry-run; publication and close are not available yet`);
          return `v${view.version}`;
        });
        const epics = resumed(() => this.tracker.list().filter(child => child.parent === view.id && child.kind === this.tracker.levels[1]));
        const deliverables: string[] = [];
        for (const epic of epics) {
          const child = await this.tracker.viewAsync(epic.id, resumed);
          resumed(() => {
            const goal = section(child.body, 'Goal').replace(/\s+/g, ' ').trim();
            const sentence = goal.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? goal;
            deliverables.push(`${child.id} ${child.title}${sentence ? `: ${sentence}` : ''}`);
          });
        }
        notesPrefix = resumed(() => [section(view.body, 'Notes'), deliverables.join('\n')].filter(Boolean).join('\n\n'));
      }
      const result = await releaseGit(this.tracker.root, version, dryRun, async id => {
        try { const view = await this.tracker.viewAsync(id, resumed); return resumed(() => view.title); }
        catch { return null; }
      }, resumed, authorize, notesPrefix);
      try {
        resumed(() => this.log({ event: dryRun ? 'release-preview' : 'released', ...(item === undefined ? {} : { item }), ...result }));
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
