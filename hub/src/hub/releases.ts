import { webReleaseDescription } from '../release-web.ts';
import { homebrewDescription } from '../homebrew.ts';
import { publishGit, clearPublishReceipt, type PublishResult } from '../territory-publish.ts';
import { pushDev, PushError, type PushResult } from '../territory-push.ts';
import type { Actor, Tracker } from '../tracker/tracker.ts';
import { ReleaseError, type ReleaseResult } from '../release.ts';
import type { LogFn } from '../log.ts';
import { clearPublicationReceipt, releaseGit, syncGit } from '../territory-release.ts';
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
  readonly #env: NodeJS.ProcessEnv;
  readonly tracker: Tracker;
  readonly worktrees: TaskWorktrees;
  readonly log: LogFn;
  readonly #publish: typeof releaseGit;
  readonly #lock: typeof withTerritoryLockAsync;
  readonly requireT3: ((head: string, tree: string) => void) | undefined;
  constructor(tracker: Tracker, worktrees: TaskWorktrees, log: LogFn, env: NodeJS.ProcessEnv = process.env, requireT3?: (head: string, tree: string) => void, boundary: { publish?: typeof releaseGit; lock?: typeof withTerritoryLockAsync } = {}) { this.#publish = boundary.publish ?? releaseGit; this.#lock = boundary.lock ?? withTerritoryLockAsync; this.requireT3 = requireT3; this.#env = env; this.tracker = tracker; this.worktrees = worktrees; this.log = log; }

  publish(branch: string, item: string, dryRun: boolean, allowPaths: string[], resumed: Resumed, authorize: () => void, actor: Actor): Promise<PublishResult> {
    return this.worktrees.serial(async () => {
      let published: PublishResult | undefined;
      try {
        const result = await this.#lock(this.tracker.root, async () => {
          resumed(authorize);
          for (const entry of this.tracker.list()) {
            const receipt = this.tracker.mergeReceipt(entry.id);
            if (!receipt) continue;
            if (receipt.checkout || ((entry.state !== 'closed' || entry.claim) && await landedTask(this.tracker.root, entry.id, receipt, resumed, undefined, this.#env))) throw new Error(`publish-state: finish pending cland merge ${entry.id} first`);
          }
          // Validate the audit destination before anything can reach GitHub.
          const view = await this.tracker.viewAsync(item, resumed);
          const result = await publishGit(this.tracker.root, branch, view.id, dryRun, allowPaths, resumed, authorize, this.#env);
          if (!dryRun) published = result;
          if (!dryRun && !result.followUp) {
            const text = `Published marketing ${branch} at ${result.main} (GitHub default branch and site); dev ${result.dev}.`;
            if (!view.comments.some(comment => comment.text === text)) await this.tracker.comment(actor, view.id, text, undefined, resumed, () => { authorize(); return actor; });
          }
          resumed(() => this.log({ event: dryRun ? 'publish-preview' : 'marketing-published', ...result }));
          return result;
        }, resumed);
        if (!dryRun && !result.followUp) await clearPublishReceipt(this.tracker.root);
        return result;
      } catch (err) {
        if (published) return { ...published, followUp: published.followUp ?? { step: 'record', error: `published; follow-up failed: ${String(err)}; retry the same branch and item` } };
        throw err;
      }
    });
  }

  push(resumed: Resumed, authorize: () => void): Promise<PushResult> {
    let published: PushResult | undefined;
    return this.worktrees.serial(() => this.#lock(this.tracker.root, async () => {
      const pending = resumed(() => {
        authorize();
        return this.tracker.list().flatMap(item => {
          const receipt = this.tracker.mergeReceipt(item.id);
          if (!receipt) return [];
          if (receipt.checkout) throw new PushError('push-state', `finish pending cland merge ${item.id} checkout recovery before pushing dev`);
          // Discussion can reopen a topic after landing. Only unfinished item/claim follow-ups
          // represent merge recovery; topic activity cannot undo a completed merge.
          return item.state !== 'closed' || item.claim ? [{ id: item.id, receipt }] : [];
        });
      });
      for (const item of pending) {
        const localTip = await territoryGitAsync(this.tracker.root, ['rev-parse', '--verify', `refs/heads/${item.receipt.base}`], undefined, undefined, this.#env);
        const remoteTip = await territoryGitAsync(territoryPath(this.tracker.root), ['rev-parse', '--verify', `refs/heads/${item.receipt.base}`], undefined, undefined, this.#env);
        await territoryGitAsync(this.tracker.root, ['fetch', '--no-write-fetch-head', '--no-tags', territoryPath(this.tracker.root), remoteTip], undefined, undefined, this.#env);
        for (const tip of [localTip, remoteTip]) {
          const landed = await territoryGitAsync(this.tracker.root, ['merge-base', '--is-ancestor', item.receipt.commit, tip], undefined, undefined, this.#env).then(() => true, err => resumed(() => {
            if (err instanceof TerritoryGitError && err.code === 1) return false;
            throw new PushError('push-state', `cannot verify pending cland merge ${item.id}; preserve its receipt and retry: ${String(err)}`);
          }));
          resumed(() => { if (landed) throw new PushError('push-state', `finish pending cland merge ${item.id} before pushing dev`); });
        }
      }
      const result = await pushDev(this.tracker.root, resumed, authorize, undefined, this.#env);
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

  release(version: string | undefined, dryRun: boolean, resumed: Resumed, authorize: () => void, actor: Actor, item?: string) {
    let published: ReleaseResult | undefined;
    return this.worktrees.serial(async () => {
      const result = await this.#lock(this.tracker.root, async () => {
        let notesPrefix: string | undefined;
        let releaseItem = item;
        if (item !== undefined) {
          resumed(authorize);
          const view = await this.tracker.viewAsync(item, resumed);
          version = resumed(() => {
            authorize();
            if (view.kind !== this.tracker.ladder.top) throw new ReleaseError('release-item', `${view.id} is not a release item (kind: ${view.kind})`);
            if (!view.version) throw new ReleaseError('release-version', `${view.id} has no version; set its release version first`);
            if (version !== undefined && version !== `v${view.version}`) throw new ReleaseError('release-version', `${version} disagrees with ${view.id}'s version v${view.version}`);
            const open = this.tracker.list({ under: view.id, state: 'open' });
            if (open.length) throw new ReleaseError('release-item', `${view.id} has open children: ${open.map(child => `${child.id} ${child.title}`).join(', ')}; close or move them first`);
            releaseItem = view.id;
            return `v${view.version}`;
          });
          const epics = resumed(() => this.tracker.list().filter(child => child.parent === view.id && this.tracker.isPlanContainer(child.kind)));
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
        const result = await this.#publish(this.tracker.root, version, dryRun, async id => {
          try { const view = await this.tracker.viewAsync(id, resumed); return resumed(() => view.title); }
          catch { return null; }
        }, resumed, authorize, releaseItem === undefined ? undefined : { item: releaseItem, notesPrefix: notesPrefix! }, this.#env, this.requireT3);
        if (!dryRun) published = result;
        let step = 'record';
        try {
          resumed(() => this.log({ event: dryRun ? 'release-preview' : 'released', ...(item === undefined ? {} : { item }), ...result }));
          if (!dryRun && !result.followUp) {
            if (releaseItem !== undefined) {
              step = 'close';
              const comment = `Released ${result.version} at ${result.commit}.${result.homebrew ? `\n${homebrewDescription(result.homebrew)}` : ''}${result.webBundle ? `\n${webReleaseDescription(result.webBundle, result.version)}` : ''}`;
              const view = await this.tracker.viewAsync(releaseItem, resumed);
              if (view.state !== 'closed' || !view.comments.some(entry => entry.text === comment)) {
                await this.tracker.close(actor, releaseItem, comment, resumed, authorize);
              }
            }
          }
        }
        catch (err) {
          if (dryRun) throw err;
          published = { ...result, followUp: result.followUp ?? { step, error: `released; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } };
          return published;
        }
        return result;
      }, resumed);
      // Keep recovery identity until lock cleanup succeeds, still inside the hub's territory-operation queue.
      if (!dryRun && !result.followUp) {
        try { await clearPublicationReceipt(this.tracker.root, 'release'); }
        catch (err) {
          return resumed(() => ({ ...result, followUp: { step: 'receipt', error: `released; follow-up failed: ${String(err)}` } }));
        }
      }
      return result;
    }).catch((err: unknown) => resumed(() => {
      if (published) return { ...published, followUp: published.followUp ?? { step: 'lock-release', error: `released; follow-up failed: ${String(err)}` } };
      try { this.log({ event: 'release-refused', error: err instanceof Error ? err.message : String(err), code: err instanceof ReleaseError ? err.code : 'release-git' }); } catch { /* preserve the original error */ }
      throw err;
    }));
  }

  sync(resumed: Resumed, authorize: () => void) {
    return this.worktrees.serial(() => this.#lock(this.tracker.root, async () => {
      const items = resumed(() => {
        authorize();
        return this.tracker.list().filter(item => this.tracker.mergeReceipt(item.id));
      });
      const pending = [];
      for (const item of items) {
        const view = await this.tracker.viewAsync(item.id, resumed);
        const next = resumed(() => {
          // Re-read the receipt and claim after queued file I/O, before testing pending recovery.
          authorize();
          const receipt = this.tracker.mergeReceipt(item.id);
          if (!receipt) return null;
          if (receipt.checkout) throw new ReleaseError('sync-recovery', `finish pending cland merge ${item.id} checkout recovery before sync`);
          return view.state !== 'closed' || this.tracker.claimOf(item.id) ? { id: item.id, receipt } : null;
        });
        if (next) pending.push(next);
      }
      for (const item of pending) {
        const landed = await landedTask(this.tracker.root, item.id, item.receipt, resumed, undefined, this.#env);
        resumed(() => { if (landed) throw new ReleaseError('sync-recovery', `finish pending cland merge ${item.id} before sync rewrites its landing`); });
      }
      const result = await syncGit(this.tracker.root, resumed, authorize, this.#env);
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
