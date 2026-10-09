// The territory's Git commands live here. Init needs no hub; later hub operations use the same lock and runner.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { acquireLock, HubLocked } from './hub/lock.ts';
import { readText, Report, symlinkOnPath, writeIfChanged } from './init/files.ts';

export const territoryPath = (root: string): string => join(root, '.cland', 'territory.git');
const lockPath = (root: string): string => join(root, '.cland', 'territory.lock');

/** Run Git locally; marked pushes are reserved for cland's guarded operations. Never invoke a shell. */
export function territoryGit(cwd: string, args: string[], marked = false, input?: string): string {
  const r = spawnSync('git', args, {
    cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
    env: { ...process.env, CLAND_TERRITORY_WRITE: marked ? '1' : '' },
  });
  if (r.error || r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.error?.message ?? r.stderr.trim()}`);
  return r.stdout.trim();
}

const maybeGit = (cwd: string, args: string[]): string | null => {
  try { return territoryGit(cwd, args); } catch { return null; }
};

/** Hold synchronous or asynchronous operations exclusively until they finish. A live holder refuses. */
export function withTerritoryLock<T>(root: string, operation: () => Promise<T>): Promise<T>;
export function withTerritoryLock<T>(root: string, operation: () => T): T;
export function withTerritoryLock<T>(root: string, operation: () => T | Promise<T>): T | Promise<T> {
  const path = lockPath(root);
  const link = symlinkOnPath(root, path);
  if (link !== null) throw new Error(`territory lock: refusing symlink ${link}`);
  mkdirSync(join(root, '.cland'), { recursive: true });
  let lock;
  try { lock = acquireLock(path); }
  catch (err) {
    if (err instanceof HubLocked) throw new Error(`another territory operation holds the lock (pid ${err.holder.pid})`);
    throw err;
  }
  let result;
  try { result = operation(); }
  catch (err) {
    lock.release();
    throw err;
  }
  if (result instanceof Promise) return result.finally(lock.release);
  lock.release();
  return result;
}

export const TERRITORY_HOOK = `#!/bin/sh
# managed by cland: only guarded cland operations may update the integration and release branches.
case "$1" in
  refs/heads/main|refs/heads/dev)
    if [ "$CLAND_TERRITORY_WRITE" != "1" ]; then
      echo "cland: main and dev are protected; use cland merge and cland release (cland sync imports main)." >&2
      exit 1
    fi
    ;;
esac
exit 0
`;

/** Is this folder itself a Git project? An initialized child of a repository is not its parent. */
function gitProject(root: string): boolean {
  const top = maybeGit(root, ['rev-parse', '--show-toplevel']);
  return top !== null && realpathSync(top) === realpathSync(root);
}

const ref = (cwd: string, name: string): string | null => maybeGit(cwd, ['rev-parse', '--verify', name]);
const remote = (root: string, name: string): string | null => maybeGit(root, ['remote', 'get-url', name]);
const pointsAtTerritory = (root: string, url: string | null): boolean => url !== null && resolve(root, url) === territoryPath(root);
const originUrlsAreLocal = (root: string, push = false): boolean => {
  const urls = maybeGit(root, ['remote', 'get-url', ...(push ? ['--push'] : []), '--all', 'origin']);
  return urls !== null && urls.split('\n').every((url) => pointsAtTerritory(root, url));
};

type RepositoryRef = { name: string; oid: string; target: string };
const repositoryRefs = (root: string): RepositoryRef[] =>
  territoryGit(root, ['for-each-ref', '--format=%(refname) %(objectname) %(symref)']).split('\n').filter(Boolean).map((line) => {
    const [name, oid, target = ''] = line.split(' ');
    if (!name || !oid) throw new Error(`cannot read repository ref: ${line}`);
    return { name, oid, target };
  });

/** Git fetch destinations can be exact refs or wildcard patterns, in any tracking namespace. */
function matchesDestination(name: string, pattern: string): boolean {
  const wildcard = pattern.indexOf('*');
  if (wildcard === -1) return name === pattern;
  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  return name.length >= prefix.length + suffix.length && name.startsWith(prefix) && name.endsWith(suffix);
}

/** Tips being dropped must remain reachable from refs that survive remote removal, regardless of their names. */
function unpreservedUndoRefs(root: string, territory: string): string[] {
  const fetch = maybeGit(root, ['config', '--get-all', 'remote.origin.fetch']) ?? '';
  const destinations = fetch.split('\n').flatMap((spec) => {
    const colon = spec.indexOf(':');
    return colon === -1 || colon === spec.length - 1 ? [] : [spec.slice(colon + 1)];
  });
  const removedByOrigin = (name: string): boolean => destinations.some((pattern) => matchesDestination(name, pattern));
  const refs = repositoryRefs(root);
  const dropped = refs.filter((r) => removedByOrigin(r.name));
  // Symbolic aliases are not independent copies; their concrete targets must survive instead.
  const survivingTips = refs.filter((r) => !removedByOrigin(r.name) && !r.target).map((r) => r.oid);
  const headTarget = maybeGit(root, ['symbolic-ref', '--quiet', 'HEAD']);
  const head = ref(root, 'HEAD');
  if (head !== null && (headTarget === null || !removedByOrigin(headTarget))) survivingTips.push(head);
  const reachable = new Set(survivingTips.length ? territoryGit(root, ['rev-list', '--objects', '--no-object-names', '--stdin'], false, `${survivingTips.join('\n')}\n`).split('\n') : []);
  return [...new Set([...dropped, ...repositoryRefs(territory)].filter((r) => !reachable.has(r.oid)).map((r) => `${r.name} ${r.oid}`))];
}

/** Provision remotes, refs and the protection hook, under the shared lock; report even unchanged Git steps. */
export function provisionTerritory(report: Report, root: string): void {
  const path = territoryPath(root);
  if (!gitProject(root)) {
    report.add(path, 'unchanged', 'not a git repository: no territory');
    return;
  }
  const clean = territoryGit(root, ['status', '--porcelain']) === '';
  withTerritoryLock(root, () => {
    const link = symlinkOnPath(root, path);
    if (link !== null) throw new Error(`territory: refusing symlink ${link}`);
    const origin = remote(root, 'origin');
    const ours = pointsAtTerritory(root, origin);
    if (origin !== null && !ours && remote(root, 'github') !== null) throw new Error('origin and github both exist: rename github before cland init');
    const present = existsSync(path);
    if (present && maybeGit(path, ['config', '--get', 'cland.managed']) !== 'true') throw new Error(`${path} is not a cland-managed territory: move it aside before cland init`);
    if (!present) {
      territoryGit(root, ['init', '--bare', path]);
      territoryGit(path, ['config', 'cland.managed', 'true']);
    }
    for (const part of ['config', 'HEAD', 'hooks/update', 'refs/heads/main', 'refs/heads/dev', 'objects']) {
      const unsafe = symlinkOnPath(root, join(path, part));
      if (unsafe !== null) throw new Error(`territory: refusing symlink ${unsafe}`);
    }
    report.add(path, present ? 'unchanged' : 'created', 'local bare repository; nothing is sent to GitHub');

    if (origin !== null && !ours) {
      territoryGit(path, ['config', 'cland.originRenamed', 'true']);
      territoryGit(root, ['remote', 'rename', 'origin', 'github']);
      report.add(join(path, 'remotes/github'), 'updated', 'renamed origin to github, including branch upstreams');
    } else report.add(join(path, 'remotes/github'), 'unchanged', remote(root, 'github') === null ? 'no GitHub remote' : 'already github');
    if (!ours) territoryGit(root, ['remote', 'add', 'origin', path]);
    const safeUrls = originUrlsAreLocal(root) && originUrlsAreLocal(root, true);
    if (!safeUrls) {
      territoryGit(root, ['config', '--replace-all', 'remote.origin.url', path]);
      territoryGit(root, ['config', '--replace-all', 'remote.origin.pushurl', path]);
      if (!originUrlsAreLocal(root) || !originUrlsAreLocal(root, true)) throw new Error('origin URLs are rewritten outside the territory: fix Git url.*.insteadOf rules before cland init');
    }
    report.add(join(path, 'remotes/origin'), !ours ? 'created' : safeUrls ? 'unchanged' : 'updated', safeUrls ? 'origin is the local territory' : 'repaired origin fetch and push destinations to the local territory');

    const hook = join(path, 'hooks', 'update');
    writeIfChanged(report, hook, TERRITORY_HOOK);
    if ((statSync(hook).mode & 0o111) !== 0o111) {
      chmodSync(hook, 0o755);
      const change = report.changes.at(-1);
      if (change?.action === 'unchanged') change.action = 'updated';
    }
    const hooksPath = maybeGit(path, ['config', '--get', 'core.hooksPath']);
    if (hooksPath !== 'hooks') territoryGit(path, ['config', 'core.hooksPath', 'hooks']);
    // Let the update hook explain every protected deletion, including HEAD's branch.
    const deleteCurrent = maybeGit(path, ['config', '--get', 'receive.denyDeleteCurrent']);
    if (deleteCurrent !== 'ignore') territoryGit(path, ['config', 'receive.denyDeleteCurrent', 'ignore']);
    report.add(join(path, 'config'), hooksPath === 'hooks' && deleteCurrent === 'ignore' ? 'unchanged' : 'updated', 'use the territory protection hook for all branch updates and deletions');

    const main = ref(root, 'refs/heads/main');
    const dev = ref(root, 'refs/heads/dev');
    if (dev === null && main !== null) territoryGit(root, ['branch', 'dev', 'main']);
    report.add(join(path, 'local-dev'), dev === null && main !== null ? 'created' : 'unchanged', main === null && dev === null ? 'main has no commit yet: create main, then run cland init' : 'dev starts from main when absent');
    for (const branch of ['main', 'dev']) {
      const local = ref(root, `refs/heads/${branch}`);
      const seeded = ref(path, `refs/heads/${branch}`) !== null;
      // Use the on-disk path, so a changed remote pushurl can never make provisioning reach GitHub.
      if (!seeded && local !== null) territoryGit(root, ['push', path, `refs/heads/${branch}:refs/heads/${branch}`], true);
      report.add(join(path, `refs/heads/${branch}`), !seeded && local !== null ? 'created' : 'unchanged', local === null ? `no local ${branch} commit to seed` : 'seeded locally; existing territory refs are kept');
    }
    const head = maybeGit(path, ['symbolic-ref', 'HEAD']);
    if (head !== 'refs/heads/dev') territoryGit(path, ['symbolic-ref', 'HEAD', 'refs/heads/dev']);
    report.add(join(path, 'HEAD'), head === 'refs/heads/dev' ? 'unchanged' : 'updated', 'default branch dev');

    const branch = maybeGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (branch === 'main' && clean && ref(root, 'refs/heads/dev') !== null) {
      territoryGit(path, ['config', 'cland.originalBranch', 'main']);
      territoryGit(root, ['switch', 'dev']);
      report.add(join(path, 'root-branch'), 'updated', 'clean root switched from main to dev');
    } else report.add(join(path, 'root-branch'), 'unchanged', `${branch === 'dev' ? 'root already on dev' : `root left on ${branch ?? 'detached HEAD'}`}${clean ? '' : ': uncommitted changes'}`);
  });
}

/** Undo only the territory step. A ref that would disappear needs explicit --force, even if its objects exist. */
export function undoTerritory(root: string, force = false): Report {
  const report = new Report(root);
  const path = territoryPath(root);
  if (!existsSync(path)) {
    report.add(path, 'unchanged', 'no territory to undo');
    return report;
  }
  withTerritoryLock(root, () => {
    if (symlinkOnPath(root, path) !== null) throw new Error('territory undo: refusing symlink');
    if (maybeGit(path, ['config', '--get', 'cland.managed']) !== 'true') throw new Error('territory undo: not a cland-managed repository');
    if (!pointsAtTerritory(root, remote(root, 'origin'))) throw new Error('territory undo: origin is not the territory; restore it before undo');
    const renamed = maybeGit(path, ['config', '--get', 'cland.originRenamed']) === 'true';
    if (renamed && remote(root, 'github') === null) throw new Error('territory undo: github is missing; restore it before undo');
    const unique = unpreservedUndoRefs(root, path);
    if (unique.length && !force) throw new Error(`territory or origin tracking refs hold work unreachable from surviving local refs: ${unique.join(', ')}; preserve it locally or use cland init --undo --force`);
    const original = maybeGit(path, ['config', '--get', 'cland.originalBranch']);
    const branch = maybeGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    // Generated, untracked init files do not prevent restoration; Git itself refuses an overlapping checkout.
    const clean = territoryGit(root, ['status', '--porcelain', '--untracked-files=no']) === '';
    if (original === 'main' && branch === 'dev' && clean) {
      territoryGit(root, ['switch', 'main']);
      report.add(join(path, 'root-branch'), 'updated', 'root restored to main; dev kept');
    } else report.add(join(path, 'root-branch'), 'unchanged', `root left on ${branch ?? 'detached HEAD'}${clean ? '' : ': uncommitted changes'}; dev kept`);
    territoryGit(root, ['remote', 'remove', 'origin']);
    report.add(join(path, 'remotes/origin'), 'removed');
    if (renamed) {
      territoryGit(root, ['remote', 'rename', 'github', 'origin']);
      report.add(join(path, 'remotes/github'), 'updated', 'github restored to origin, including upstreams');
    }
    rmSync(path, { recursive: true });
    report.add(path, 'removed', unique.length ? `--force discarded: ${unique.join(', ')}` : 'all dropped refs remain reachable from surviving local refs');
  });
  return report;
}

/** Read-only doctor findings, kept here so Git state has one owner. */
export function territoryProblems(root: string): string[] | null {
  const path = territoryPath(root);
  if (!existsSync(path)) return gitProject(root) ? ['territory missing'] : null;
  const problems: string[] = [];
  if (!originUrlsAreLocal(root)) problems.push('origin is not the territory');
  if (!originUrlsAreLocal(root, true)) problems.push('origin push URL is not the territory');
  if (maybeGit(path, ['rev-parse', '--is-bare-repository']) !== 'true') problems.push('territory is not a bare repository');
  for (const branch of ['main', 'dev']) {
    if (ref(path, `refs/heads/${branch}`) === null) problems.push(`territory ${branch} is missing`);
  }
  if (maybeGit(path, ['symbolic-ref', 'HEAD']) !== 'refs/heads/dev') problems.push('territory HEAD is not dev');
  const base = maybeGit(path, ['config', '--get', 'cland.taskBase']);
  if (base && ref(root, `refs/heads/${base}`) === null) problems.push(`cland.taskBase names ${base}, which has no local branch: task branches cannot start`);
  const hook = join(path, 'hooks', 'update');
  if (readText(hook) !== TERRITORY_HOOK || !existsSync(hook) || (statSync(hook).mode & 0o111) !== 0o111 || maybeGit(path, ['config', '--get', 'core.hooksPath']) !== 'hooks') problems.push('territory protection hook is missing, changed or not executable');
  return problems;
}

// ---------------------------------------------------------------- task worktrees (T-58, decisions D3, D7)

export const worktreesPath = (root: string): string => join(root, '.cland', 'worktrees');
export const taskWorktreePath = (root: string, item: string): string => join(worktreesPath(root), item);

/** Whether the project has a cland-managed territory: the condition for task branches and worktrees. */
export function hasTerritory(root: string): boolean {
  const path = territoryPath(root);
  return existsSync(path) && maybeGit(path, ['config', '--get', 'cland.managed']) === 'true';
}

/**
 * The branch task branches start from: the territory's `cland.taskBase` when set, else `dev` when the project has
 * it, else `main`; null when none of them has a commit. The override names a local branch that must exist.
 */
export function taskBase(root: string): string | null {
  const configured = hasTerritory(root) ? maybeGit(territoryPath(root), ['config', '--get', 'cland.taskBase']) : null;
  if (configured) {
    if (ref(root, `refs/heads/${configured}`) === null) throw new Error(`the territory's cland.taskBase names ${configured}, which has no local branch`);
    return configured;
  }
  for (const branch of ['dev', 'main']) if (ref(root, `refs/heads/${branch}`) !== null) return branch;
  return null;
}

/** A linked worktree of the project's own repository, as `git worktree list --porcelain` shows it. */
export type Worktree = { path: string; head: string | null; branch: string | null; prunable: boolean };

function worktrees(root: string): Worktree[] {
  const out: Worktree[] = [];
  for (const block of territoryGit(root, ['worktree', 'list', '--porcelain']).split('\n\n')) {
    const lines = block.split('\n');
    const path = lines.find((l) => l.startsWith('worktree '))?.slice('worktree '.length);
    if (!path) continue;
    const head = lines.find((l) => l.startsWith('HEAD '))?.slice('HEAD '.length) ?? null;
    const branch = lines.find((l) => l.startsWith('branch refs/heads/'))?.slice('branch refs/heads/'.length) ?? null;
    out.push({ path, head, branch, prunable: lines.some((l) => l.startsWith('prunable')) });
  }
  return out;
}

const samePath = (a: string, b: string): boolean => {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
};

/** The project's task worktrees: the linked worktrees under `.cland/worktrees/`, each named by its item. */
export function listTaskWorktrees(root: string): Array<Worktree & { item: string }> {
  if (!gitProject(root)) return [];
  const dir = worktreesPath(root);
  return worktrees(root).flatMap((w) => {
    const parent = resolve(w.path, '..');
    const name = w.path.slice(parent.length + 1);
    return samePath(parent, dir) && /^T-\d+$/.test(name) ? [{ ...w, item: name }] : [];
  });
}

/** The commits on `branch` that `base` does not have, newest first, as `<short sha> <subject>`. */
export function commitsAhead(root: string, branch: string, base: string | null): string[] {
  if (ref(root, `refs/heads/${branch}`) === null) return [];
  const range = base !== null && ref(root, `refs/heads/${base}`) !== null ? [`refs/heads/${base}..refs/heads/${branch}`] : [`refs/heads/${branch}`];
  return territoryGit(root, ['log', '--format=%h %s', ...range, '--']).split('\n').filter(Boolean);
}

export type TaskWorktree = { item: string; branch: string; path: string; base: string | null; createdBranch: boolean; createdWorktree: boolean };

/**
 * The item's task branch and worktree, made when missing (decision D7), reused when present: `branch` is the item's
 * own (its `branch` field), else `t/<id>-<slug>`, started at `taskBase`'s tip. The worktree is linked to the
 * project's own repository (decision D3). Under the territory lock; throws a reason meant for the asker.
 */
export function ensureTaskWorktree(root: string, item: { id: string; slug: string; branch: string | null }): TaskWorktree {
  if (!hasTerritory(root)) throw new Error('the project has no territory (run cland init)');
  if (!/^T-\d+$/.test(item.id)) throw new Error(`not an item id: ${item.id}`);
  return withTerritoryLock(root, () => {
    const path = taskWorktreePath(root, item.id);
    const link = symlinkOnPath(root, path);
    if (link !== null) throw new Error(`worktree: refusing symlink ${link}`);
    let registered = worktrees(root).find((w) => samePath(w.path, path));
    // a worktree whose folder was deleted by hand: Git forgets it before the path is used again
    if (registered && !existsSync(path)) {
      territoryGit(root, ['worktree', 'prune']);
      registered = undefined;
    }
    if (registered) {
      if (registered.branch === null) throw new Error(`${path} is a worktree on a detached HEAD: check out its task branch there first`);
      if (item.branch !== null && item.branch !== registered.branch) throw new Error(`${path} holds branch ${registered.branch}, but ${item.id} names ${item.branch}`);
      return { item: item.id, branch: registered.branch, path, base: null, createdBranch: false, createdWorktree: false };
    }
    if (existsSync(path)) throw new Error(`${path} exists and is not a worktree of this repository: move it aside`);
    const branch = item.branch ?? `t/${item.id}${item.slug ? `-${item.slug}` : ''}`;
    try {
      territoryGit(root, ['check-ref-format', '--branch', branch]);
    } catch {
      throw new Error(`${JSON.stringify(branch)} is not a valid branch name`);
    }
    mkdirSync(worktreesPath(root), { recursive: true });
    if (ref(root, `refs/heads/${branch}`) !== null) {
      territoryGit(root, ['worktree', 'add', path, branch]);
      return { item: item.id, branch, path, base: null, createdBranch: false, createdWorktree: true };
    }
    const base = taskBase(root);
    if (base === null) throw new Error('neither dev nor main has a commit to start the task branch from');
    territoryGit(root, ['worktree', 'add', '--no-track', '-b', branch, path, `refs/heads/${base}`]);
    return { item: item.id, branch, path, base, createdBranch: true, createdWorktree: true };
  });
}

/** Remove a task worktree and its branch (the human's prune). Git refuses a worktree with changes. Under the lock. */
export function removeTaskWorktree(root: string, item: string): { path: string; branch: string | null } {
  return withTerritoryLock(root, () => {
    const path = taskWorktreePath(root, item);
    const found = worktrees(root).find((w) => samePath(w.path, path));
    if (!found) throw new Error(`${item} has no worktree`);
    territoryGit(root, ['worktree', 'remove', path]);
    if (found.branch !== null && ref(root, `refs/heads/${found.branch}`) !== null) territoryGit(root, ['branch', '-D', found.branch]);
    return { path, branch: found.branch };
  });
}
