// Marketing publication prepares both histories before the atomic GitHub push. The durable
// receipt pins recovery, including the ancestry-preserving sync into dev (D59).
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withCleanupAsync } from './cleanup.ts';
import { defaultBranch, territoryGitAsync as git, territoryPath, TerritoryGitError } from './territory.ts';
import { fetchGithub, finishSync, releaseState, type SyncReceipt } from './territory-release.ts';
import type { Resumed } from './hub/worktrees.ts';

export type PublishCode = 'publish-state' | 'publish-path' | 'publish-empty' | 'publish-changed' | 'publish-behind' | 'publish-git';
export class PublishError extends Error {
  readonly code: PublishCode;
  constructor(code: PublishCode, message: string) { super(`${code}: ${message}`); this.code = code; }
}
export type PublishResult = { branch: string; source: string; item: string; commits: Array<{ commit: string; subject: string }>; paths: string[]; main: string; site: string; dev: string; dryRun: boolean; followUp?: { step: string; error: string } };
type Receipt = { result: PublishResult; github: string; oldMain: string; oldSite: string | null; sync: SyncReceipt };
export const publishReceiptPath = (root: string) => join(root, '.cland', 'publish.tmp');
const exists = (path: string) => access(path).then(() => true, err => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; });

export async function publishGit(root: string, branch: string, item: string, dryRun: boolean, allowPaths: string[], resumed: Resumed, authorize: () => void, env: NodeJS.ProcessEnv = process.env, runGit: typeof git = git): Promise<PublishResult> {
  const run = (cwd: string, args: string[], marked?: boolean, input?: string, extra: NodeJS.ProcessEnv = {}) => runGit(cwd, args, marked, input, { ...env, ...extra });
  const ancestor = (older: string, newer: string) => run(root, ['merge-base', '--is-ancestor', older, newer]).then(() => true, err => { if (err instanceof TerritoryGitError && err.code === 1) return false; throw err; });
  resumed(authorize);
  for (const operation of ['release', 'sync']) if (await exists(join(root, '.cland', `${operation}.tmp`))) throw new PublishError('publish-state', `finish pending cland ${operation} first`);
  const state = await releaseState(root, resumed, env, runGit);
  const recordedBranch = await run(territoryPath(root), ['config', '--get', 'cland.defaultBranch']).catch(err => { if (err instanceof TerritoryGitError && err.code === 1) return ''; throw err; });
  const primary = defaultBranch(root, new Map([['cland.defaultbranch', recordedBranch]]));
  if (primary === 'site') throw new PublishError('publish-state', 'the default branch and site must be distinct');
  if (await run(root, ['symbolic-ref', '--short', 'HEAD']) !== 'dev') throw new PublishError('publish-state', 'publish needs the project root on dev');
  await run(root, ['check-ref-format', '--branch', branch]);
  if (['dev', primary, 'site'].includes(branch)) throw new PublishError('publish-state', 'give a marketing task branch, distinct from dev, the default branch and site');
  const source = await run(root, ['rev-parse', '--verify', `refs/heads/${branch}`]);
  const github = await fetchGithub(root, resumed, true, env, runGit);
  const siteRefs = await run(root, ['ls-remote', '--refs', '--', github.url, 'refs/heads/site']);
  const oldSite = siteRefs.split(/\s/)[0] || null;
  if (oldSite) await run(root, ['fetch', '--no-tags', '--no-write-fetch-head', '--refmap=', '--', github.url, oldSite]);
  let receipt = await readFile(publishReceiptPath(root), 'utf8').then(text => JSON.parse(text) as Receipt, err => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; });
  const synced = receipt !== null && state.main === receipt.sync.main && state.dev === receipt.sync.dev;
  if (!synced && await run(root, ['status', '--porcelain'])) throw new PublishError('publish-state', 'publish needs a clean project root on dev');
  if (receipt) {
    if (receipt.result.branch !== branch || receipt.result.item !== item || receipt.github !== github.url || receipt.result.source !== source) throw new PublishError('publish-changed', 'finish the pending publish with the same branch, source and item');
    if (![receipt.oldMain, receipt.result.main].includes(github.main) || (oldSite !== receipt.oldSite && oldSite !== receipt.result.site)) throw new PublishError('publish-changed', 'GitHub moved since preparation; preserve publish.tmp and reconcile it');
  } else {
    if (!await ancestor(state.main, github.main) || !await ancestor(state.main, state.dev)) throw new PublishError('publish-behind', 'local default branch must be an ancestor of GitHub and dev; reconcile first');
    if (oldSite && !await ancestor(oldSite, github.main)) throw new PublishError('publish-behind', 'GitHub site contains work main lacks; reconcile before publishing');
    const list = await run(root, ['rev-list', '--reverse', '--topo-order', `${state.dev}..${source}`, '--']);
    const commits: PublishResult['commits'] = [], paths = new Set<string>();
    for (const commit of list.split('\n').filter(Boolean)) {
      const parents = (await run(root, ['show', '-s', '--format=%P', commit])).split(' ').filter(Boolean);
      if (parents.length !== 1) throw new PublishError('publish-state', `marketing commits must be linear; ${commit} has ${parents.length} parents`);
      const changed = (await run(root, ['diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', commit])).split('\0').filter(Boolean);
      for (const path of changed) {
        if (!allowPaths.some(pattern => pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern)) throw new PublishError('publish-path', `${commit} touches disallowed path ${path}`);
        paths.add(path);
      }
      commits.push({ commit, subject: await run(root, ['show', '-s', '--format=%s', commit]) });
    }
    if (!commits.length) throw new PublishError('publish-empty', 'no branch-only commits dev lacks; publish before merging the marketing branch');
    const territoryMain = await run(territoryPath(root), ['rev-parse', '--verify', `refs/heads/${primary}`]);
    const territoryDev = await run(territoryPath(root), ['rev-parse', '--verify', 'refs/heads/dev']);
    await run(root, ['fetch', '--no-tags', '--no-write-fetch-head', territoryPath(root), territoryMain, territoryDev]);
    if (!await ancestor(territoryMain, github.main) || !await ancestor(territoryDev, state.dev)) throw new PublishError('publish-behind', 'territory has unpublished work; reconcile dev and the default branch first');
    await mkdir(join(root, '.cland', 'worktrees'), { recursive: true });
    const scratch = await mkdtemp(join(root, '.cland', 'worktrees', 'publish-'));
    const prepared = await withCleanupAsync(async () => {
      await run(root, ['worktree', 'add', '--detach', scratch, github.main], true);
      // Deterministic commit dates make preview and execution produce the same tips.
      const date = await run(root, ['show', '-s', '--format=%cI', source]);
      for (const { commit } of commits) await run(scratch, ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'cherry-pick', commit], true, undefined, { GIT_COMMITTER_DATE: date });
      const main = await run(scratch, ['rev-parse', 'HEAD']);
      await run(scratch, ['checkout', '--detach', state.dev], true);
      for (const tip of [source, main]) await run(scratch, ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'merge', '--no-edit', '--no-ff', '-m', `Publish marketing ${branch}\n\nItem: ${item}`, tip], true, undefined, { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
      return { main, dev: await run(scratch, ['rev-parse', 'HEAD']) };
    }, async () => {
      await run(root, ['worktree', 'remove', '--force', scratch], true);
    }, resumed);
    receipt = { result: { branch, source, item, commits, paths: [...paths].sort(), main: prepared.main, site: prepared.main, dev: prepared.dev, dryRun: false }, github: github.url, oldMain: github.main, oldSite, sync: { oldMain: state.main, oldDev: state.dev, main: prepared.main, dev: prepared.dev, territoryMain, territoryDev } };
  }
  const result = { ...receipt.result, dryRun };
  const needsPush = github.main !== result.main || oldSite !== result.site;
  // A receipt pins the prepared commits, not permission to bypass today's policy.
  // Already-published receipts may still finish local synchronization after a policy change.
  if (needsPush) for (const path of result.paths) {
    if (!allowPaths.some(pattern => pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern)) throw new PublishError('publish-path', `${result.source} touches disallowed path ${path}; pending publication must satisfy the current allow-list`);
  }
  if (dryRun) return resumed(() => result);
  const current = await releaseState(root, resumed, env, runGit);
  if ((current.dev !== receipt.sync.oldDev && current.dev !== receipt.sync.dev) || (current.main !== receipt.sync.oldMain && current.main !== receipt.sync.main) || await run(root, ['rev-parse', `refs/heads/${branch}`]) !== source || (!synced && await run(root, ['status', '--porcelain']))) throw new PublishError('publish-changed', 'the root or source changed; preview again before publication');
  resumed(authorize);
  await writeFile(`${publishReceiptPath(root)}.write.tmp`, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
  await rename(`${publishReceiptPath(root)}.write.tmp`, publishReceiptPath(root));
  // Ancestry was checked above. Leases add compare-and-swap protection against remote races.
  if (needsPush) {
    try { await run(root, ['push', '--atomic', `--force-with-lease=refs/heads/${primary}:${receipt.oldMain}`, `--force-with-lease=refs/heads/site:${receipt.oldSite ?? ''}`, '--', github.url, `${result.main}:refs/heads/${primary}`, `${result.site}:refs/heads/site`], true); }
    catch (err) { throw new PublishError('publish-git', `push failed or its reply was lost; preserve publish.tmp and retry the same branch and item: ${String(err)}`); }
  }
  try {
    resumed(authorize);
    // Once checkout and refs are installed, recovery must leave later tracker writes alone.
    const territorySynced = synced && await run(territoryPath(root), ['rev-parse', `refs/heads/${primary}`]) === result.main && await run(territoryPath(root), ['rev-parse', 'refs/heads/dev']) === result.dev;
    const sync = territorySynced ? { main: result.main, dev: result.dev } : await finishSync(root, receipt.sync, resumed, authorize, env, runGit);
    if (sync.followUp) return { ...result, followUp: sync.followUp };
    await run(root, ['update-ref', 'refs/remotes/origin/dev', result.dev]);
    return resumed(() => result);
  } catch (err) { return { ...result, followUp: { step: 'sync', error: `published; follow-up failed: ${String(err)}; preserve publish.tmp and retry the same branch and item` } }; }
}

export const clearPublishReceipt = (root: string): Promise<void> => rm(publishReceiptPath(root), { force: true });
