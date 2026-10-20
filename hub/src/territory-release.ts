import { committedTree } from './verification-tree.ts';
import { parseItemReference } from './tracker/prefixes.ts';
// Release orchestration uses only the territory's async Git runner and lock. The annotated object is prepared
// without a tag ref, so a rejected atomic GitHub push leaves every local ref unchanged.
import { access } from 'node:fs/promises';
import { withCleanupAsync } from './cleanup.ts';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { defaultBranch, hasTerritory, territoryGitAsync as git, territoryPath } from './territory.ts';
import { ReleaseError, type ReleaseResult, type SyncResult } from './release.ts';
import type { Resumed } from './hub/worktrees.ts';
import { isSemverVersion } from './tracker/item.ts';

type RunGit = typeof git;

type Receipt = { version: string; commit: string; main: string; tag: string; notes: string; github: string; item?: string };
// Keep receipt `main` as the default branch tip so older recovery files still resume.
const releaseBranch = async (root: string, env: NodeJS.ProcessEnv, run: RunGit = git): Promise<string> => {
  const recorded = await run(territoryPath(root), ['config', '--get', 'cland.defaultBranch'], undefined, undefined, env).catch(() => '');
  return defaultBranch(root, new Map([['cland.defaultbranch', recorded]]));
};
const receiptPath = (root: string) => join(root, '.cland', 'release.tmp');
const ref = (root: string, name: string, env: NodeJS.ProcessEnv = process.env, run: RunGit = git) => run(root, ['rev-parse', '--verify', '--quiet', name], undefined, undefined, env).catch(() => null);
const ancestor = (root: string, older: string, newer: string, env: NodeJS.ProcessEnv = process.env) => git(root, ['merge-base', '--is-ancestor', older, newer], undefined, undefined, env).then(() => true, () => false);

/** No Git operation in progress, no linked checkout of the default branch, and a managed local territory. */
export async function releaseState(root: string, resumed: Resumed, env: NodeJS.ProcessEnv = process.env, run: RunGit = git): Promise<{ main: string; dev: string }> {
  if (!await hasTerritory(root, env, run)) throw new ReleaseError('release-territory', 'this project has no managed territory');
  const states = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer'];
  const paths = (await run(root, ['rev-parse', ...states.flatMap(state => ['--git-path', state])], undefined, undefined, env)).split('\n');
  for (const [index, state] of states.entries()) {
    // A Git directory can contain a newline. Keep the original single-path
    // behavior when the batch's line boundaries are ambiguous.
    const path = paths.length === states.length ? paths[index]!.trim() : await run(root, ['rev-parse', '--git-path', state], undefined, undefined, env);
    const present = await access(resolve(root, path)).then(() => true, err => resumed(() => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; }));
    resumed(() => { if (present) throw new ReleaseError('release-state', `${state} is in progress; finish or abort it first`); });
  }
  const primary = await releaseBranch(root, env, run);
  const main = await ref(root, `refs/heads/${primary}`, env, run);
  const dev = await ref(root, 'refs/heads/dev', env, run);
  const checkouts = await run(root, ['worktree', 'list', '--porcelain', '-z'], undefined, undefined, env);
  return resumed(() => {
    if (!main || !dev) throw new ReleaseError('release-state', `${primary} and dev must both exist`);
    if (checkouts.split('\0').includes(`branch refs/heads/${primary}`)) throw new ReleaseError('release-state', `${primary} is checked out; use dev in the project root and free ${primary} in other worktrees`);
    return { main, dev };
  });
}

/** Fetch objects without moving local or remote-tracking refs, including on a refusal or dry run. */
export async function fetchGithub(root: string, resumed: Resumed, publishing = false, env: NodeJS.ProcessEnv = process.env, run: RunGit = git): Promise<{ url: string; main: string; tags: Map<string, string> }> {
  const primary = await releaseBranch(root, env, run);
  const urls = await run(root, ['remote', 'get-url', ...(publishing ? ['--push', '--all'] : []), 'github'], undefined, undefined, env).catch(() => null);
  const url = resumed(() => {
    if (publishing && urls?.includes('\n')) throw new ReleaseError('release-github', 'release needs exactly one push destination for its atomic transaction');
    if (!urls) throw new ReleaseError('release-github', 'no github remote; configure it before releasing or syncing');
    return urls;
  });
  const refs = await run(root, ['ls-remote', '--refs', '--', url, `refs/heads/${primary}`, 'refs/tags/*'], undefined, undefined, env);
  const { found, main } = resumed(() => {
    const found = new Map(refs.split('\n').filter(Boolean).map(line => {
      const [sha, name] = line.split(/\s+/); return [name!, sha!];
    }));
    const sha = found.get(`refs/heads/${primary}`);
    if (!sha) throw new ReleaseError('release-github', `github has no ${primary} branch`);
    return { found, main: sha };
  });
  await run(root, ['fetch', '--no-tags', '--no-write-fetch-head', '--refmap=', '--', url, main], undefined, undefined, env);
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

async function finish(root: string, receipt: Receipt, resumed: Resumed, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await releaseState(root, resumed, env);
  const primary = await releaseBranch(root, env);
  const main = await ref(root, `refs/heads/${primary}`, env);
  const tag = await ref(root, `refs/tags/${receipt.version}`, env);
  const commands = resumed(() => {
    if (main !== receipt.main && main !== receipt.commit) throw new ReleaseError('release-changed', `${primary} moved since the GitHub push; keep the receipt and reconcile ${primary}`);
    if (tag !== null && tag !== receipt.tag) throw new ReleaseError('release-changed', 'the local tag differs from the published release');
    return `start\nupdate refs/heads/${primary} ${receipt.commit} ${main}\n${tag ? `verify refs/tags/${receipt.version} ${tag}` : `create refs/tags/${receipt.version} ${receipt.tag}`}\nprepare\ncommit\n`;
  });
  await git(root, ['update-ref', '--stdin'], true, commands, env);
  // Sync can rewrite dev; publishing the default branch here does not accidentally republish a later dev tip.
  await git(root, ['push', '--atomic', territoryPath(root), `${receipt.commit}:refs/heads/${primary}`, `${receipt.tag}:refs/tags/${receipt.version}`], true, undefined, env);
}

/** Remove recovery state only after the hub has recorded the successful result. */
export const clearPublicationReceipt = (root: string, kind: 'release' | 'sync'): Promise<void> => rm(kind === 'release' ? receiptPath(root) : syncReceiptPath(root), { force: true });

export async function releaseGit(root: string, version: string | undefined, dryRun: boolean, title: (id: string) => Promise<string | null>, resumed: Resumed, authorize: () => void, itemRelease?: { item: string; notesPrefix: string }, env: NodeJS.ProcessEnv = process.env, requireT3?: (head: string, tree: string) => void): Promise<ReleaseResult> {
  if (await access(join(root, '.cland', 'publish.tmp')).then(() => true, err => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; })) throw new ReleaseError('release-state', 'finish pending cland publish first');
  const pendingSync = await access(syncReceiptPath(root)).then(() => true, err => resumed(() => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; }));
  resumed(() => { if (pendingSync) throw new ReleaseError('sync-recovery', 'finish the pending cland sync before releasing'); });
  const primary = await releaseBranch(root, env);
  const state = await releaseState(root, resumed, env);
  const github = await fetchGithub(root, resumed, true, env);
  resumed(() => {
    authorize();
    // An item version is already validated as SemVer by the tracker; keep the legacy CLI version rule.
    const valid = version && (itemRelease === undefined
      ? /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
      : version.startsWith('v') && isSemverVersion(version.slice(1)));
    if (!valid) throw new ReleaseError('release-version', 'give a version as vX.Y.Z (for example v0.1.0)');
  });
  const name = version!;
  const prior = await readReceipt(root, resumed);
  resumed(() => {
    if (prior && prior.item !== itemRelease?.item) {
      throw new ReleaseError('release-changed', `finish pending release ${prior.version}${prior.item ? ` from ${prior.item}` : ' without --item'} first`);
    }
  });
  const result = (receipt: Receipt): ReleaseResult => ({ version: name, commit: receipt.commit, notes: receipt.notes, refs: [`${receipt.commit}:refs/heads/${primary}`, `${receipt.tag}:refs/tags/${name}`], dryRun });
  // A retry after a lost push reply or a failed local follow-up recognizes the exact annotated object.
  if (prior && github.tags.get(`refs/tags/${prior.version}`) === prior.tag) {
    resumed(() => {
      if (prior.version !== name || prior.github !== github.url) throw new ReleaseError('release-changed', `finish pending release ${prior.version} to ${prior.github} first`);
    });
    if (!await ancestor(root, prior.commit, github.main, env)) throw new ReleaseError('release-changed', `GitHub ${primary} no longer contains the published release; reconcile GitHub before completing local refs`);
    if (dryRun) return resumed(() => result(prior));
    // The tag object is unreferenced locally until follow-up; GC may have pruned it after a lost reply.
    await git(root, ['fetch', '--no-tags', '--no-write-fetch-head', '--refmap=', '--', github.url, prior.tag], undefined, undefined, env);
    try { resumed(authorize); await finish(root, prior, resumed, env); return resumed(() => result(prior)); }
    catch (err) { return resumed(() => ({ ...result(prior), followUp: { step: 'local refs', error: `released; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } })); }
  }
  // Read the pinned build, never an uncommitted bump in the checkout. Published
  // receipt recovery above finishes its original build even if dev has moved on.
  const packagePath = await git(root, ['ls-tree', '--name-only', state.dev, '--', 'package.json'], undefined, undefined, env);
  if (packagePath) {
    const text = await git(root, ['show', `${state.dev}:package.json`], undefined, undefined, env);
    resumed(() => {
      const pkg = JSON.parse(text) as { version?: unknown } | null;
      if (pkg && Object.hasOwn(pkg, 'version') && pkg.version !== name.slice(1)) {
        throw new ReleaseError('release-version', `dev's package.json says ${pkg.version}, the release is ${name}: commit the bump on dev, merge it, then preview again`);
      }
    });
  }
  const localTag = await ref(root, `refs/tags/${name}`, env);
  resumed(() => { if (localTag || github.tags.has(`refs/tags/${name}`)) throw new ReleaseError('release-tag', `${name} already exists`); });
  if (!await ancestor(root, state.main, state.dev, env)) throw new ReleaseError('release-state', `${primary} is not an ancestor of dev; run \`cland sync\``);
  if (!await ancestor(root, github.main, state.dev, env)) {
    const missing = await git(root, ['log', '--format=%h %s', `${state.dev}..${github.main}`, '--'], undefined, undefined, env);
    throw new ReleaseError('release-behind', `github/${primary} has commits dev lacks:\n${missing}\nrun \`cland sync\``);
  }
  const history = await git(root, ['log', '--reverse', '--format=%s%x00%(trailers:key=Item,valueonly)%x00%x1e', `${state.main}..${state.dev}`, '--'], undefined, undefined, env);
  const { items, other } = resumed(() => {
    if (state.main === state.dev) throw new ReleaseError('release-empty', `nothing in ${primary}..dev to release`);
    const items: Array<{ id: string; subject: string }> = [], other: string[] = [];
    for (const message of history.split('\x1e').map(s => s.trim()).filter(Boolean)) {
      const [subject, trailers = ''] = message.split('\0');
      const ids = trailers.split('\n').map(s => s.trim()).filter(s => parseItemReference(s) !== null);
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
    const notes = itemRelease === undefined ? commits : [itemRelease.notesPrefix, commits].filter(Boolean).join('\n\n');
    return { notes, preview: dryRun ? { version: name, commit: state.dev, notes, refs: [`${state.dev}:refs/heads/${primary}`, `refs/tags/${name}:refs/tags/${name}`], dryRun } : null };
  });
  if (requireT3) {
    const tree = await committedTree(root, state.dev, env);
    resumed(() => {
      authorize();
      if (!tree) throw new ReleaseError('release-t3', `cannot establish verification tree for release head ${state.dev}; retry before releasing`);
      requireT3(state.dev, tree);
    });
  }
  if (preview) return preview;
  const ident = await git(root, ['var', 'GIT_COMMITTER_IDENT'], undefined, undefined, env);
  const tag = await git(root, ['mktag'], false, `object ${state.dev}\ntype commit\ntag ${name}\ntagger ${ident}\n\n${notes}\n`, env);
  const receipt: Receipt = resumed(() => ({ version: name, commit: state.dev, main: state.main, tag, notes, github: github.url, ...(itemRelease ? { item: itemRelease.item } : {}) }));
  const current = await releaseState(root, resumed, env);
  const text = resumed(() => {
    if (current.main !== state.main || current.dev !== state.dev) throw new ReleaseError('release-changed', `${primary} or dev moved while preparing the release; preview again`);
    return `${JSON.stringify(receipt)}\n`;
  });
  await record(root, text);
  resumed(authorize);
  try { await git(root, ['push', '--atomic', `--force-with-lease=refs/heads/${primary}:${github.main}`, `--force-with-lease=refs/tags/${name}:`, '--', github.url, `${state.dev}:refs/heads/${primary}`, `${tag}:refs/tags/${name}`], true, undefined, env); }
  catch (err) {
    // Preserve the prepared receipt: a transport error can follow a successful receive. No local ref moved.
    throw err;
  }
  try { await finish(root, receipt, resumed, env); return resumed(() => result(receipt)); }
  catch (err) { return resumed(() => ({ ...result(receipt), followUp: { step: 'local refs', error: `released; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } })); }
}

export type SyncReceipt = { oldMain: string; oldDev: string; main: string; dev: string; territoryMain: string | null; territoryDev: string | null };
const syncReceiptPath = (root: string) => join(root, '.cland', 'sync.tmp');

export async function finishSync(root: string, receipt: SyncReceipt, resumed: Resumed, authorize: () => void, env: NodeJS.ProcessEnv = process.env, run: RunGit = git): Promise<SyncResult> {
  const primary = await releaseBranch(root, env, run);
  const main = await ref(root, `refs/heads/${primary}`, env, run);
  const dev = await ref(root, 'refs/heads/dev', env, run);
  const branch = await run(root, ['symbolic-ref', '--quiet', 'HEAD'], undefined, undefined, env);
  const index = await run(root, ['write-tree'], undefined, undefined, env);
  const oldTree = await run(root, ['rev-parse', `${receipt.oldDev}^{tree}`], undefined, undefined, env);
  const newTree = await run(root, ['rev-parse', `${receipt.dev}^{tree}`], undefined, undefined, env);
  const changed = await run(root, ['diff-files', '--name-only'], undefined, undefined, env);
  const untracked = await run(root, ['ls-files', '--others', '--exclude-standard'], undefined, undefined, env);
  resumed(() => {
    authorize();
    if (branch !== 'refs/heads/dev' || !((main === receipt.oldMain && dev === receipt.oldDev) || (main === receipt.main && dev === receipt.dev))) throw new ReleaseError('sync-recovery', 'refs or the root checkout changed since sync preparation; preserve sync.tmp and reconcile them');
    if ((index !== oldTree && index !== newTree) || changed || untracked) throw new ReleaseError('sync-recovery', 'the root changed since sync preparation; preserve its work and sync.tmp before retrying');
  });
  if (index !== newTree) {
    await run(root, ['read-tree', '-u', '-m', receipt.oldDev, receipt.dev], true, undefined, env);
  }
  if (main !== receipt.main || dev !== receipt.dev) {
    try {
      if (index !== newTree) resumed(authorize);
      await run(root, ['update-ref', '--stdin'], true, `start\nupdate refs/heads/${primary} ${receipt.main} ${main}\nupdate refs/heads/dev ${receipt.dev} ${dev}\nprepare\ncommit\n`, env);
    } catch (err) {
      // Both refs are atomic. Restore the clean checkout if their transaction was refused.
      try { await run(root, ['read-tree', '-u', '-m', receipt.dev, receipt.oldDev], true, undefined, env); }
      catch { throw new ReleaseError('sync-recovery', `checkout restoration pending; retry sync with sync.tmp intact: ${err instanceof Error ? err.message : String(err)}`); }
      throw err;
    }
  }
  try {
    const territory = territoryPath(root);
    const territoryMain = await ref(territory, `refs/heads/${primary}`, env, run);
    const territoryDev = await ref(territory, 'refs/heads/dev', env, run);
    resumed(() => {
      if ((territoryMain !== receipt.territoryMain && territoryMain !== receipt.main) || (territoryDev !== receipt.territoryDev && territoryDev !== receipt.dev)) throw new ReleaseError('sync-recovery', 'territory refs changed since preparation; preserve sync.tmp and reconcile them');
      authorize();
    });
    await run(root, ['push', '--atomic', `--force-with-lease=refs/heads/dev:${territoryDev ?? ''}`, `--force-with-lease=refs/heads/${primary}:${territoryMain ?? ''}`, territory,
      `${receipt.main}:refs/heads/${primary}`, `${receipt.dev}:refs/heads/dev`], true, undefined, env);
    return resumed(() => ({ main: receipt.main, dev: receipt.dev }));
  } catch (err) {
    return resumed(() => ({ main: receipt.main, dev: receipt.dev, followUp: { step: 'territory', error: `synced locally; follow-up failed: ${err instanceof Error ? err.message : String(err)}` } }));
  }
}

/** Prepare the replay in an isolated checkout, then install its tree and refs in the clean dev root. */
export async function syncGit(root: string, resumed: Resumed, authorize: () => void, env: NodeJS.ProcessEnv = process.env): Promise<SyncResult> {
  if (await access(join(root, '.cland', 'publish.tmp')).then(() => true, err => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false; throw err; })) throw new ReleaseError('release-state', 'finish pending cland publish first');
  const primary = await releaseBranch(root, env);
  const state = await releaseState(root, resumed, env);
  resumed(authorize);
  const release = await readReceipt(root, resumed);
  if (release) {
    const remote = await fetchGithub(root, resumed, true, env);
    resumed(() => { if (remote.tags.get(`refs/tags/${release.version}`) === release.tag) throw new ReleaseError('release-changed', `finish release ${release.version} before syncing`); });
  }
  const prior = await readFile(syncReceiptPath(root), 'utf8').then(text => resumed(() => JSON.parse(text) as SyncReceipt), err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err;
  });
  if (prior) return finishSync(root, prior, resumed, authorize, env);
  const branch = await git(root, ['symbolic-ref', '--quiet', 'HEAD'], undefined, undefined, env);
  const dirty = await git(root, ['status', '--porcelain'], undefined, undefined, env);
  resumed(() => {
    if (branch !== 'refs/heads/dev') throw new ReleaseError('release-state', 'sync needs the project root checked out on dev');
    if (dirty) throw new ReleaseError('sync-dirty', `the project root is dirty; commit or preserve its work first:\n${dirty}`);
  });
  const github = await fetchGithub(root, resumed, undefined, env);
  if (!await ancestor(root, state.main, github.main, env)) throw new ReleaseError('sync-behind', `github/${primary} does not fast-forward local ${primary}; reconcile the divergent history first`);
  if (!await ancestor(root, state.main, state.dev, env)) throw new ReleaseError('sync-behind', `local ${primary} is not an ancestor of dev; reconcile the divergent history first`);
  const territory = territoryPath(root);
  const territoryMain = await ref(territory, `refs/heads/${primary}`, env);
  const territoryDev = await ref(territory, 'refs/heads/dev', env);
  if (territoryMain && !await ancestor(root, territoryMain, github.main, env)) throw new ReleaseError('sync-behind', `territory ${primary} contains work GitHub ${primary} lacks; reconcile the territory before syncing`);
  if (territoryDev && !await ancestor(root, territoryDev, state.dev, env)) throw new ReleaseError('sync-behind', 'territory dev contains work local dev lacks; reconcile the territory before syncing');
  await mkdir(join(root, '.cland', 'worktrees'), { recursive: true });
  const scratch = await mkdtemp(join(root, '.cland', 'worktrees', 'sync-'));
  const replayed = await withCleanupAsync(async () => {
    await git(root, ['worktree', 'add', '--detach', scratch, state.dev], true, undefined, env);
    try { await git(scratch, ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'rebase', '--rebase-merges', '--onto', github.main, state.main], true, undefined, env); }
    catch (err) {
      const files = (await git(scratch, ['diff', '--name-only', '-z', '--diff-filter=U'], undefined, undefined, env)).split('\0').filter(Boolean);
      if (files.length) throw new ReleaseError('sync-conflict', `dev was kept; replay conflicts in:\n${files.join('\n')}`, resumed(() => files));
      throw err;
    }
    return git(scratch, ['rev-parse', 'HEAD'], undefined, undefined, env);
  }, async () => {
    await git(scratch, ['rebase', '--abort'], true, undefined, env).catch(() => {});
    await git(root, ['worktree', 'remove', '--force', scratch], true, undefined, env).catch(async () => {
      await rm(scratch, { recursive: true, force: true });
      await git(root, ['worktree', 'prune'], true, undefined, env);
    });
  }, resumed);
  const { receipt, path, text } = resumed(() => {
    const receipt = { oldMain: state.main, oldDev: state.dev, main: github.main, dev: replayed, territoryMain, territoryDev };
    return { receipt, path: syncReceiptPath(root), text: `${JSON.stringify(receipt)}\n` };
  });
  await writeFile(`${path}.write.tmp`, text, { mode: 0o600 });
  await rename(`${path}.write.tmp`, path);
  return finishSync(root, receipt, resumed, authorize, env);
}
