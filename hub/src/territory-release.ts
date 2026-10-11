// Release orchestration uses only the territory's async Git runner and lock. The annotated object is prepared
// without a tag ref, so a rejected atomic GitHub push leaves every local ref unchanged.
import { access } from 'node:fs/promises';
import { withCleanupAsync } from './cleanup.ts';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hasTerritory, territoryGitAsync as git, territoryPath } from './territory.ts';
import { ReleaseError, type ReleaseResult, type SyncResult } from './release.ts';
import type { Resumed } from './hub/worktrees.ts';
import { isSemverVersion } from './tracker/item.ts';

type Receipt = { version: string; commit: string; main: string; tag: string; notes: string; github: string };
const receiptPath = (root: string) => join(root, '.cland', 'release.tmp');
const ref = (root: string, name: string) => git(root, ['rev-parse', '--verify', '--quiet', name]).catch(() => null);
const ancestor = (root: string, older: string, newer: string) => git(root, ['merge-base', '--is-ancestor', older, newer]).then(() => true, () => false);

/** No Git operation in progress, no linked checkout of main, and a managed local territory. */
export async function releaseState(root: string, resumed: Resumed): Promise<{ main: string; dev: string }> {
  if (!await hasTerritory(root)) throw new ReleaseError('release-territory', 'this project has no managed territory');
  for (const state of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
    const path = await git(root, ['rev-parse', '--git-path', state]);
    const present = await access(resolve(root, path)).then(() => true, err => resumed(() => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; }));
    resumed(() => { if (present) throw new ReleaseError('release-state', `${state} is in progress; finish or abort it first`); });
  }
  const main = await ref(root, 'refs/heads/main');
  const dev = await ref(root, 'refs/heads/dev');
  const checkouts = await git(root, ['worktree', 'list', '--porcelain']);
  return resumed(() => {
    if (!main || !dev) throw new ReleaseError('release-state', 'main and dev must both exist');
    if (checkouts.includes('branch refs/heads/main\n')) throw new ReleaseError('release-state', 'main is checked out; use dev in the project root and free main in other worktrees');
    return { main, dev };
  });
}

/** Fetch objects without moving local or remote-tracking refs, including on a refusal or dry run. */
export async function fetchGithub(root: string, resumed: Resumed, publishing = false): Promise<{ url: string; main: string; tags: Map<string, string> }> {
  const urls = await git(root, ['remote', 'get-url', ...(publishing ? ['--push', '--all'] : []), 'github']).catch(() => null);
  const url = resumed(() => {
    if (publishing && urls?.includes('\n')) throw new ReleaseError('release-github', 'release needs exactly one push destination for its atomic transaction');
    if (!urls) throw new ReleaseError('release-github', 'no github remote; configure it before releasing or syncing');
    return urls;
  });
  const refs = await git(root, ['ls-remote', '--refs', '--', url, 'refs/heads/main', 'refs/tags/*']);
  const { found, main } = resumed(() => {
    const found = new Map(refs.split('\n').filter(Boolean).map(line => {
      const [sha, name] = line.split(/\s+/); return [name!, sha!];
    }));
    const sha = found.get('refs/heads/main');
    if (!sha) throw new ReleaseError('release-github', 'github has no main branch');
    return { found, main: sha };
  });
  await git(root, ['fetch', '--no-tags', '--no-write-fetch-head', '--refmap=', '--', url, main]);
  return resumed(() => ({ url, main, tags: found }));
}

async function readReceipt(root: string, resumed: Resumed): Promise<Receipt | null> {
  try { const text = await readFile(receiptPath(root), 'utf8'); return resumed(() => JSON.parse(text) as Receipt); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
}
async function record(root: string, text: string): Promise<void> {
  const path = receiptPath(root);
  await writeFile(`${path}.write.tmp`, text, { mode: 0o600 });
  await rename(`${path}.write.tmp`, path);
}

async function finish(root: string, receipt: Receipt, resumed: Resumed): Promise<void> {
  await releaseState(root, resumed);
  const main = await ref(root, 'refs/heads/main');
  const tag = await ref(root, `refs/tags/${receipt.version}`);
  const commands = resumed(() => {
    if (main !== receipt.main && main !== receipt.commit) throw new ReleaseError('release-changed', 'main moved since the GitHub push; keep the receipt and reconcile main');
    if (tag !== null && tag !== receipt.tag) throw new ReleaseError('release-changed', 'the local tag differs from the published release');
    return `start\nupdate refs/heads/main ${receipt.commit} ${main}\n${tag ? `verify refs/tags/${receipt.version} ${tag}` : `create refs/tags/${receipt.version} ${receipt.tag}`}\nprepare\ncommit\n`;
  });
  await git(root, ['update-ref', '--stdin'], true, commands);
  // Sync can rewrite dev; publishing main here does not accidentally republish a later dev tip.
  await git(root, ['push', '--atomic', territoryPath(root), `${receipt.commit}:refs/heads/main`, `${receipt.tag}:refs/tags/${receipt.version}`], true);
}

/** Remove recovery state only after the hub has recorded the successful result. */
export const clearPublicationReceipt = (root: string, kind: 'release' | 'sync'): Promise<void> => rm(kind === 'release' ? receiptPath(root) : syncReceiptPath(root), { force: true });

export async function releaseGit(root: string, version: string | undefined, dryRun: boolean, title: (id: string) => Promise<string | null>, resumed: Resumed, authorize: () => void, notesPrefix?: string): Promise<ReleaseResult> {
  const pendingSync = await access(syncReceiptPath(root)).then(() => true, err => resumed(() => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; }));
  resumed(() => { if (pendingSync) throw new ReleaseError('sync-recovery', 'finish the pending cland sync before releasing'); });
  const state = await releaseState(root, resumed);
  const github = await fetchGithub(root, resumed, true);
  resumed(() => {
    authorize();
    // An item version is already validated as SemVer by the tracker; keep the legacy CLI version rule.
    const valid = version && (notesPrefix === undefined
      ? /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
      : version.startsWith('v') && isSemverVersion(version.slice(1)));
    if (!valid) throw new ReleaseError('release-version', 'give a version as vX.Y.Z (for example v0.1.0)');
  });
  const name = version!;
  const prior = await readReceipt(root, resumed);
  const result = (receipt: Receipt): ReleaseResult => ({ version: name, commit: receipt.commit, notes: receipt.notes, refs: [`${receipt.commit}:refs/heads/main`, `${receipt.tag}:refs/tags/${name}`], dryRun });
  // A retry after a lost push reply or a failed local follow-up recognizes the exact annotated object.
  if (prior && github.tags.get(`refs/tags/${prior.version}`) === prior.tag) {
    resumed(() => {
      if (prior.version !== name || prior.github !== github.url) throw new ReleaseError('release-changed', `finish pending release ${prior.version} to ${prior.github} first`);
    });
    if (!await ancestor(root, prior.commit, github.main)) throw new ReleaseError('release-changed', 'GitHub main no longer contains the published release; reconcile GitHub before completing local refs');
    if (dryRun) return resumed(() => result(prior));
    // The tag object is unreferenced locally until follow-up; GC may have pruned it after a lost reply.
    await git(root, ['fetch', '--no-tags', '--no-write-fetch-head', '--refmap=', '--', github.url, prior.tag]);
    try { resumed(authorize); await finish(root, prior, resumed); return resumed(() => result(prior)); }
    catch (err) { return resumed(() => ({ ...result(prior), followUp: { step: 'local refs', error: `released; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } })); }
  }
  const localTag = await ref(root, `refs/tags/${name}`);
  resumed(() => { if (localTag || github.tags.has(`refs/tags/${name}`)) throw new ReleaseError('release-tag', `${name} already exists`); });
  if (!await ancestor(root, state.main, state.dev)) throw new ReleaseError('release-state', 'main is not an ancestor of dev; run `cland sync`');
  if (!await ancestor(root, github.main, state.dev)) {
    const missing = await git(root, ['log', '--format=%h %s', `${state.dev}..${github.main}`, '--']);
    throw new ReleaseError('release-behind', `github/main has commits dev lacks:\n${missing}\nrun \`cland sync\``);
  }
  const history = await git(root, ['log', '--reverse', '--format=%s%x00%(trailers:key=Item,valueonly)%x00%x1e', `${state.main}..${state.dev}`, '--']);
  const { items, other } = resumed(() => {
    if (state.main === state.dev) throw new ReleaseError('release-empty', 'nothing in main..dev to release');
    const items: Array<{ id: string; subject: string }> = [], other: string[] = [];
    for (const message of history.split('\x1e').map(s => s.trim()).filter(Boolean)) {
      const [subject, trailers = ''] = message.split('\0');
      const ids = trailers.split('\n').map(s => s.trim()).filter(s => /^T-\d+$/.test(s));
      if (ids.length) for (const id of ids) items.push({ id, subject: subject! });
      else other.push(subject!);
    }
    return { items, other };
  });
  const titled: string[] = [];
  for (const item of items) {
    const found = await title(item.id);
    resumed(() => titled.push(`${item.id} ${found ?? item.subject}`));
  }
  const { notes, preview } = resumed(() => {
    const commits = [...titled, ...other].join('\n');
    const notes = notesPrefix === undefined ? commits : [notesPrefix, commits].filter(Boolean).join('\n\n');
    return { notes, preview: dryRun ? { version: name, commit: state.dev, notes, refs: [`${state.dev}:refs/heads/main`, `refs/tags/${name}:refs/tags/${name}`], dryRun } : null };
  });
  if (preview) return preview;
  const ident = await git(root, ['var', 'GIT_COMMITTER_IDENT']);
  const tag = await git(root, ['mktag'], false, `object ${state.dev}\ntype commit\ntag ${name}\ntagger ${ident}\n\n${notes}\n`);
  const receipt: Receipt = resumed(() => ({ version: name, commit: state.dev, main: state.main, tag, notes, github: github.url }));
  const current = await releaseState(root, resumed);
  const text = resumed(() => {
    if (current.main !== state.main || current.dev !== state.dev) throw new ReleaseError('release-changed', 'main or dev moved while preparing the release; preview again');
    return `${JSON.stringify(receipt)}\n`;
  });
  await record(root, text);
  resumed(authorize);
  try { await git(root, ['push', '--atomic', `--force-with-lease=refs/heads/main:${github.main}`, `--force-with-lease=refs/tags/${name}:`, '--', github.url, `${state.dev}:refs/heads/main`, `${tag}:refs/tags/${name}`], true); }
  catch (err) {
    // Preserve the prepared receipt: a transport error can follow a successful receive. No local ref moved.
    throw err;
  }
  try { await finish(root, receipt, resumed); return resumed(() => result(receipt)); }
  catch (err) { return resumed(() => ({ ...result(receipt), followUp: { step: 'local refs', error: `released; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } })); }
}

type SyncReceipt = { oldMain: string; oldDev: string; main: string; dev: string; territoryMain: string | null; territoryDev: string | null };
const syncReceiptPath = (root: string) => join(root, '.cland', 'sync.tmp');

async function finishSync(root: string, receipt: SyncReceipt, resumed: Resumed, authorize: () => void): Promise<SyncResult> {
  const main = await ref(root, 'refs/heads/main');
  const dev = await ref(root, 'refs/heads/dev');
  const branch = await git(root, ['symbolic-ref', '--quiet', 'HEAD']);
  const index = await git(root, ['write-tree']);
  const oldTree = await git(root, ['rev-parse', `${receipt.oldDev}^{tree}`]);
  const newTree = await git(root, ['rev-parse', `${receipt.dev}^{tree}`]);
  const changed = await git(root, ['diff-files', '--name-only']);
  const untracked = await git(root, ['ls-files', '--others', '--exclude-standard']);
  resumed(() => {
    authorize();
    if (branch !== 'refs/heads/dev' || !((main === receipt.oldMain && dev === receipt.oldDev) || (main === receipt.main && dev === receipt.dev))) throw new ReleaseError('sync-recovery', 'refs or the root checkout changed since sync preparation; preserve sync.tmp and reconcile them');
    if ((index !== oldTree && index !== newTree) || changed || untracked) throw new ReleaseError('sync-recovery', 'the root changed since sync preparation; preserve its work and sync.tmp before retrying');
  });
  if (index !== newTree) {
    await git(root, ['read-tree', '-u', '-m', receipt.oldDev, receipt.dev], true);
  }
  if (main !== receipt.main || dev !== receipt.dev) {
    try {
      if (index !== newTree) resumed(authorize);
      await git(root, ['update-ref', '--stdin'], true, `start\nupdate refs/heads/main ${receipt.main} ${main}\nupdate refs/heads/dev ${receipt.dev} ${dev}\nprepare\ncommit\n`);
    } catch (err) {
      // Both refs are atomic. Restore the clean checkout if their transaction was refused.
      try { await git(root, ['read-tree', '-u', '-m', receipt.dev, receipt.oldDev], true); }
      catch { throw new ReleaseError('sync-recovery', `checkout restoration pending; retry sync with sync.tmp intact: ${err instanceof Error ? err.message : String(err)}`); }
      throw err;
    }
  }
  try {
    const territory = territoryPath(root);
    const territoryMain = await ref(territory, 'refs/heads/main');
    const territoryDev = await ref(territory, 'refs/heads/dev');
    resumed(() => {
      if ((territoryMain !== receipt.territoryMain && territoryMain !== receipt.main) || (territoryDev !== receipt.territoryDev && territoryDev !== receipt.dev)) throw new ReleaseError('sync-recovery', 'territory refs changed since preparation; preserve sync.tmp and reconcile them');
      authorize();
    });
    await git(root, ['push', '--atomic', `--force-with-lease=refs/heads/dev:${territoryDev ?? ''}`, `--force-with-lease=refs/heads/main:${territoryMain ?? ''}`, territory,
      `${receipt.main}:refs/heads/main`, `${receipt.dev}:refs/heads/dev`], true);
    return resumed(() => ({ main: receipt.main, dev: receipt.dev }));
  } catch (err) {
    return resumed(() => ({ main: receipt.main, dev: receipt.dev, followUp: { step: 'territory', error: `synced locally; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } }));
  }
}

/** Prepare the replay in an isolated checkout, then install its tree and refs in the clean dev root. */
export async function syncGit(root: string, resumed: Resumed, authorize: () => void): Promise<SyncResult> {
  const state = await releaseState(root, resumed);
  resumed(authorize);
  const release = await readReceipt(root, resumed);
  if (release) {
    const remote = await fetchGithub(root, resumed, true);
    resumed(() => { if (remote.tags.get(`refs/tags/${release.version}`) === release.tag) throw new ReleaseError('release-changed', `finish release ${release.version} before syncing`); });
  }
  const prior = await readFile(syncReceiptPath(root), 'utf8').then(text => resumed(() => JSON.parse(text) as SyncReceipt), err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err;
  });
  if (prior) return finishSync(root, prior, resumed, authorize);
  const branch = await git(root, ['symbolic-ref', '--quiet', 'HEAD']);
  const dirty = await git(root, ['status', '--porcelain']);
  resumed(() => {
    if (branch !== 'refs/heads/dev') throw new ReleaseError('release-state', 'sync needs the project root checked out on dev');
    if (dirty) throw new ReleaseError('sync-dirty', `the project root is dirty; commit or preserve its work first:\n${dirty}`);
  });
  const github = await fetchGithub(root, resumed);
  if (!await ancestor(root, state.main, github.main)) throw new ReleaseError('sync-behind', 'github/main does not fast-forward local main; reconcile the divergent history first');
  if (!await ancestor(root, state.main, state.dev)) throw new ReleaseError('sync-behind', 'local main is not an ancestor of dev; reconcile the divergent history first');
  const territory = territoryPath(root);
  const territoryMain = await ref(territory, 'refs/heads/main');
  const territoryDev = await ref(territory, 'refs/heads/dev');
  if (territoryMain && !await ancestor(root, territoryMain, github.main)) throw new ReleaseError('sync-behind', 'territory main contains work GitHub main lacks; reconcile the territory before syncing');
  if (territoryDev && !await ancestor(root, territoryDev, state.dev)) throw new ReleaseError('sync-behind', 'territory dev contains work local dev lacks; reconcile the territory before syncing');
  await mkdir(join(root, '.cland', 'worktrees'), { recursive: true });
  const scratch = await mkdtemp(join(root, '.cland', 'worktrees', 'sync-'));
  const replayed = await withCleanupAsync(async () => {
    await git(root, ['worktree', 'add', '--detach', scratch, state.dev], true);
    try { await git(scratch, ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'rebase', '--rebase-merges', '--onto', github.main, state.main], true); }
    catch (err) {
      const files = await git(scratch, ['diff', '--name-only', '--diff-filter=U']);
      if (files) throw new ReleaseError('sync-conflict', `dev was kept; replay conflicts in:\n${files}`, resumed(() => files.split('\n')));
      throw err;
    }
    return git(scratch, ['rev-parse', 'HEAD']);
  }, async () => {
    await git(scratch, ['rebase', '--abort'], true).catch(() => {});
    await git(root, ['worktree', 'remove', '--force', scratch], true).catch(async () => {
      await rm(scratch, { recursive: true, force: true });
      await git(root, ['worktree', 'prune'], true);
    });
  }, resumed);
  const { receipt, path, text } = resumed(() => {
    const receipt = { oldMain: state.main, oldDev: state.dev, main: github.main, dev: replayed, territoryMain, territoryDev };
    return { receipt, path: syncReceiptPath(root), text: `${JSON.stringify(receipt)}\n` };
  });
  await writeFile(`${path}.write.tmp`, text, { mode: 0o600 });
  await rename(`${path}.write.tmp`, path);
  return finishSync(root, receipt, resumed, authorize);
}
