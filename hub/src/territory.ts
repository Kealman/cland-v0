import { parseItemReference } from './tracker/prefixes.ts';
// The territory's Git commands live here. Init needs no hub; later hub operations use the same lock and runner.
import { execFile, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { access, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { MergeError } from './merge.ts';
import { lintHubShardTree, ShardManifestError } from './suite-shards.ts';
import { withCleanup, withCleanupAsync } from './cleanup.ts';
import { acquireLock, acquireLockAsync, HubLocked } from './hub/lock.ts';
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
  catch (err) { return withCleanup(() => { throw err; }, lock.release); }
  if (result instanceof Promise) return withCleanupAsync(() => result, async () => lock.release());
  lock.release();
  return result;
}

async function symlinkOnPathAsync(root: string, path: string, resumed: <R>(work: () => R) => R): Promise<string | null> {
  const rel = relative(root, path);
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) return rel;
  let at = root;
  for (const part of rel.split(sep)) {
    at = join(at, part);
    try {
      const stat = await lstat(at);
      const link = resumed(() => stat.isSymbolicLink() ? relative(root, at) : null);
      if (link !== null) return link;
    }
    catch (err) { return resumed(() => { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }); }
  }
  return null;
}

/**
 * `withTerritoryLock` for the hub's request path: the lock is taken without blocking the event loop (its `ps` probes
 * awaited, `acquireLockAsync`), held until `operation` settles. A live holder refuses, as there.
 */
export async function withTerritoryLockAsync<T>(root: string, operation: () => Promise<T>, resumed: <R>(work: () => R) => R = work => work()): Promise<T> {
  const path = lockPath(root);
  const link = await symlinkOnPathAsync(root, path, resumed);
  resumed(() => { if (link !== null) throw new Error(`territory lock: refusing symlink ${link}`); });
  await mkdir(join(root, '.cland'), { recursive: true });
  let lock;
  try {
    lock = await acquireLockAsync(path, resumed);
  } catch (err) {
    resumed(() => {
      if (err instanceof HubLocked) throw new Error(`another territory operation holds the lock (pid ${err.holder.pid})`);
      throw err;
    });
    throw err;
  }
  return withCleanupAsync(operation, lock.release, resumed);
}

export const TERRITORY_HOOK = `#!/bin/sh
# managed by cland: only guarded cland operations may update the integration and release branches.
case "$1" in
  refs/heads/main|refs/heads/dev)
    if [ "$CLAND_TERRITORY_WRITE" != "1" ]; then
      echo "cland: main and dev are protected; use cland push for Coordinator dev commits, cland merge for tasks, and cland release (cland sync imports main)." >&2
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
    // origin's default branch is dev in the root too, so what branches from it (Claude Code's sub-agent worktrees,
    // `worktree.baseRef: fresh`) starts from dev (T-20 decision D8); fetched from the on-disk path, as the seeding
    const originHead = maybeGit(root, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
    const setHead = originHead !== 'refs/remotes/origin/dev' && ref(path, 'refs/heads/dev') !== null;
    if (setHead) {
      territoryGit(root, ['fetch', '--quiet', path, '+refs/heads/dev:refs/remotes/origin/dev']);
      territoryGit(root, ['remote', 'set-head', 'origin', 'dev']);
    }
    report.add(join(path, 'remotes/origin/HEAD'), setHead ? 'updated' : 'unchanged', originHead === 'refs/remotes/origin/dev' || setHead ? 'origin/HEAD is origin/dev' : 'no territory dev yet');

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
// Called from the hub's request path, so every Git command here is awaited (`execFile`), never `spawnSync`: a claim
// or a listing never holds the hub's event loop. The hub runs them one at a time (`src/hub/worktrees.ts`); the
// writes also hold the territory lock against other processes, taken without blocking (`withTerritoryLockAsync`).

/** `territoryGit`, awaited: trimmed stdout, or a rejection naming the command and Git's message. */
export class TerritoryGitError extends Error {
  readonly stdout: string;
  readonly code: number | string | null | undefined;
  constructor(message: string, stdout: string, code: number | string | null | undefined) { super(message); this.stdout = stdout; this.code = code; }
}

export function territoryGitAsync(cwd: string, args: string[], marked = false, input?: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = execFile('git', args, { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024, env: { ...env, CLAND_TERRITORY_WRITE: marked ? '1' : '' } }, (err, stdout, stderr) => {
      if (err) reject(new TerritoryGitError(`git ${args.join(' ')}: ${String(stderr).trim() || err.message}`, String(stdout), err.code));
      else resolvePromise(String(stdout).trim());
    });
    child.stdin?.on('error', () => {}); // an early Git refusal can close stdin before the input is consumed
    child.stdin?.end(input);
  });
}

const maybeGitAsync = (cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string | null> => territoryGitAsync(cwd, args, undefined, undefined, env).catch(() => null);
const refAsync = (cwd: string, name: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> => maybeGitAsync(cwd, ['rev-parse', '--verify', '--quiet', name], env);

export const worktreesPath = (root: string): string => join(root, '.cland', 'worktrees');
export const taskWorktreePath = (root: string, item: string): string => join(worktreesPath(root), item);

/** Whether the project has a cland-managed territory: the condition for task branches and worktrees. */
export async function hasTerritory(root: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const path = territoryPath(root);
  return (await maybeGitAsync(path, ['config', '--get', 'cland.managed'], env)) === 'true';
}

/**
 * The branch task branches start from: the territory's `cland.taskBase` when set, else `dev` when the project has
 * it, else `main`; null when none of them has a commit. The override names a local branch that must exist.
 */
export async function taskBase(root: string, tips?: ReadonlyMap<string, string>, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  // Read both values together, retaining Git's config/include/last-value rules.
  // Freshness supplies the branch tips it just read in this operation; other
  // callers still resolve their branches here. Nothing survives the operation.
  const config = await maybeGitAsync(territoryPath(root), ['config', '--null', '--get-regexp', '^cland\\.(managed|taskbase)$'], env);
  const values = new Map((config ?? '').split('\0').filter(Boolean).map(entry => {
    const newline = entry.indexOf('\n');
    return [entry.slice(0, newline).toLowerCase(), entry.slice(newline + 1).trim()];
  }));
  const configured = values.get('cland.managed') === 'true' ? values.get('cland.taskbase') : null;
  const exists = async (branch: string) => tips ? tips.has(branch) : (await refAsync(root, `refs/heads/${branch}`, env)) !== null;
  if (configured) {
    if (!await exists(configured)) throw new Error(`the territory's cland.taskBase names ${configured}, which has no local branch`);
    return configured;
  }
  for (const branch of ['dev', 'main']) if (await exists(branch)) return branch;
  return null;
}

/** A linked worktree of the project's own repository, as `git worktree list --porcelain` shows it. */
export type Worktree = { path: string; head: string | null; branch: string | null; prunable: boolean };

async function worktrees(root: string, env: NodeJS.ProcessEnv = process.env): Promise<Worktree[]> {
  const out: Worktree[] = [];
  for (const block of (await territoryGitAsync(root, ['worktree', 'list', '--porcelain'], undefined, undefined, env)).split('\n\n')) {
    const lines = block.split('\n');
    const path = lines.find((l) => l.startsWith('worktree '))?.slice('worktree '.length);
    if (!path) continue;
    const head = lines.find((l) => l.startsWith('HEAD '))?.slice('HEAD '.length) ?? null;
    const branch = lines.find((l) => l.startsWith('branch refs/heads/'))?.slice('branch refs/heads/'.length) ?? null;
    out.push({ path, head, branch, prunable: lines.some((l) => l.startsWith('prunable')) });
  }
  return out;
}

const samePath = async (a: string, b: string): Promise<boolean> => {
  try {
    return await realpath(a) === await realpath(b);
  } catch {
    return resolve(a) === resolve(b);
  }
};

/** The project's task worktrees: the linked worktrees under `.cland/worktrees/`, each named by its item. */
export async function listTaskWorktrees(root: string, env: NodeJS.ProcessEnv = process.env): Promise<Array<Worktree & { item: string }>> {
  if (!await access(join(root, '.git')).then(() => true, () => false)) return [];
  const dir = worktreesPath(root);
  const found: Array<Worktree & { item: string }> = [];
  for (const w of await worktrees(root, env)) {
    const parent = resolve(w.path, '..');
    const name = w.path.slice(parent.length + 1);
    if (parseItemReference(name) !== null && await samePath(parent, dir)) found.push({ ...w, item: name });
  }
  return found;
}

async function checkWorktreePath(root: string, path: string, resumed: <T>(work: () => T) => T): Promise<void> {
  const link = await symlinkOnPathAsync(root, path, resumed);
  resumed(() => { if (link !== null) throw new Error(`worktree: refusing symlink ${link}`); });
}

async function findWorktree(root: string, path: string, env: NodeJS.ProcessEnv = process.env): Promise<Worktree | undefined> {
  for (const worktree of await worktrees(root, env)) if (await samePath(worktree.path, path)) return worktree;
  return undefined;
}

async function worktreeConfined(root: string, path: string, resumed: <T>(work: () => T) => T): Promise<boolean> {
  const runRoot = await realpath(root);
  const { paths, reading } = resumed(() => {
    const paths = [path, resolve(path, '..'), resolve(path, '../..')];
    return { paths, reading: Promise.all(paths.map(p => realpath(p))) };
  });
  const actual = await reading;
  return resumed(() => actual.every((p, i) => {
    const rel = relative(runRoot, p);
    return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) && p === resolve(runRoot, relative(root, paths[i]!));
  }));
}

/** Verify after Git creates the worktree; roll back only this call's registered worktree and new branch. */
async function verifyCreatedWorktree(root: string, path: string, branch: string | null, creationTip: string | null, createdBranch: boolean, resumed: <T>(work: () => T) => T, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const confined = await worktreeConfined(root, path, resumed).catch(() => false);
  if (resumed(() => confined)) return;
  const registered = branch === null ? [await findWorktree(root, path, env)] : await worktrees(root, env);
  const created = resumed(() => {
    const created = branch === null ? registered[0] : registered.find(w => w?.branch === branch);
    if (!created) throw new Error(`worktree: created worktree failed confinement; ownership of ${path} cannot be verified; kept for manual recovery`);
    if (branch !== null && creationTip && created.head !== creationTip) throw new Error(`worktree: created worktree failed confinement; branch ${branch} moved; kept worktree ${created.path} and branch for manual recovery`);
    return created;
  });
  if (resumed(() => branch === null)) {
    let head: string;
    try { head = await territoryGitAsync(created.path, ['rev-parse', 'HEAD'], undefined, undefined, env); }
    catch (err) { return resumed(() => { throw new Error(`worktree: created worktree failed confinement; kept escaped detached worktree ${created.path}; HEAD unreadable: ${err instanceof Error ? err.message : String(err)}`); }); }
    return resumed(() => { throw new Error(`worktree: created worktree failed confinement; kept escaped detached worktree ${created.path} at HEAD ${head} for manual recovery`); });
  }
  let removed = false;
  try {
    // Git checks for dirty work; use its registered path, never a resolved recursive delete.
    await territoryGitAsync(root, ['worktree', 'remove', created.path], undefined, undefined, env);
    await resumed(() => {
      removed = true;
      if (!createdBranch || !creationTip || !branch) return;
      return territoryGitAsync(root, ['update-ref', '--no-deref', '-d', `refs/heads/${branch}`, creationTip], undefined, undefined, env);
    });
    if (resumed(() => !createdBranch && creationTip !== null)) {
      const current = await refAsync(root, `refs/heads/${branch}`, env);
      resumed(() => { if (current !== creationTip) throw new Error(`branch ${branch} moved during rollback`); });
    }
  } catch (err) {
    const reading = resumed(() => removed ? refAsync(root, `refs/heads/${branch}`, env) : null);
    const current = await reading;
    try {
      await resumed(() => {
        if (!removed) return;
        return territoryGitAsync(root, current === null ? ['worktree', 'add', '--detach', created.path, creationTip!] : ['worktree', 'add', created.path, branch!], undefined, undefined, env);
      });
    } catch (recovery) {
      return resumed(() => { throw new Error(`worktree: created worktree failed confinement; branch ${branch} kept; could not restore worktree ${created.path}: ${recovery instanceof Error ? recovery.message : String(recovery)}`); });
    }
    return resumed(() => {
      throw new Error(`worktree: created worktree failed confinement; rollback refused; ${removed ? 'restored' : 'kept'} worktree ${created.path} and branch ${branch} for manual recovery: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
  resumed(() => { throw new Error('worktree: created worktree escaped confinement; creation rolled back'); });
}

/** The commits on `branch` that `base` does not have, newest first, as `<short sha> <subject>`. */
export async function commitsAhead(root: string, branch: string, base: string | null, env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  if ((await refAsync(root, `refs/heads/${branch}`, env)) === null) return [];
  const range = base !== null && (await refAsync(root, `refs/heads/${base}`, env)) !== null ? [`refs/heads/${base}..refs/heads/${branch}`] : [`refs/heads/${branch}`];
  return (await territoryGitAsync(root, ['log', '--format=%h %s', ...range, '--'], undefined, undefined, env)).split('\n').filter(Boolean);
}

export type TaskWorktree = { item: string; branch: string; path: string; base: string | null; createdBranch: boolean; createdWorktree: boolean };

/**
 * The item's task branch and worktree, made when missing (decision D7), reused when present: `branch` is the item's
 * own (its `branch` field), else `t/<id>-<slug>`, started at `taskBase`'s tip. The worktree is linked to the
 * project's own repository (decision D3). Under the territory lock; rejects with a reason meant for the asker.
 */
export async function ensureTaskWorktree(root: string, item: { id: string; slug: string; branch: string | null }, resumed: <T>(work: () => T) => T = work => work(), authorize: () => void = () => {}, env: NodeJS.ProcessEnv = process.env): Promise<TaskWorktree> {
  if (!(await hasTerritory(root, env))) throw new Error('the project has no territory (run cland init)');
  if (parseItemReference(item.id) === null) throw new Error(`not an item id: ${item.id}`);
  return withTerritoryLockAsync(root, async () => {
    const path = taskWorktreePath(root, item.id);
    await checkWorktreePath(root, path, resumed);
    let registered = await findWorktree(root, path, env);
    const present = await access(path).then(() => true, () => false);
    // a worktree whose folder was deleted by hand: Git forgets it before the path is used again
    if (registered && !present) {
      resumed(authorize);
      await territoryGitAsync(root, ['worktree', 'prune'], undefined, undefined, env);
      registered = undefined;
    }
    if (registered) {
      await checkWorktreePath(root, path, resumed);
      if (!await worktreeConfined(root, path, resumed)) throw new Error('worktree: reused worktree failed confinement');
      if (registered.branch === null) throw new Error(`${path} is a worktree on a detached HEAD: check out its task branch there first`);
      if (item.branch !== null && item.branch !== registered.branch) throw new Error(`${path} holds branch ${registered.branch}, but ${item.id} names ${item.branch}`);
      return { item: item.id, branch: registered.branch, path, base: null, createdBranch: false, createdWorktree: false };
    }
    if (present) throw new Error(`${path} exists and is not a worktree of this repository: move it aside`);
    const branch = item.branch ?? `t/${item.id}${item.slug ? `-${item.slug}` : ''}`;
    if ((await maybeGitAsync(root, ['check-ref-format', '--branch', branch], env)) === null) throw new Error(`${JSON.stringify(branch)} is not a valid branch name`);
    const existingTip = await refAsync(root, `refs/heads/${branch}`, env);
    if (existingTip !== null) {
      await checkWorktreePath(root, path, resumed);
      resumed(authorize);
      await mkdir(worktreesPath(root), { recursive: true });
      await checkWorktreePath(root, path, resumed);
      resumed(authorize);
      await territoryGitAsync(root, ['worktree', 'add', path, branch], undefined, undefined, env);
      await verifyCreatedWorktree(root, path, branch, existingTip, false, resumed, env);
      return { item: item.id, branch, path, base: null, createdBranch: false, createdWorktree: true };
    }
    const base = await taskBase(root, undefined, env);
    if (base === null) throw new Error('neither dev nor main has a commit to start the task branch from');
    const createdTip = await refAsync(root, `refs/heads/${base}`, env);
    if (createdTip === null) throw new Error(`${base} no longer has a commit to start the task branch from`);
    await checkWorktreePath(root, path, resumed);
    resumed(authorize);
    await mkdir(worktreesPath(root), { recursive: true });
    await checkWorktreePath(root, path, resumed);
    resumed(authorize);
    // Pin the creation tip: a later listing may already contain another writer's commit.
    await territoryGitAsync(root, ['worktree', 'add', '--no-track', '-b', branch, path, createdTip], undefined, undefined, env);
    await verifyCreatedWorktree(root, path, branch, createdTip, true, resumed, env);
    return { item: item.id, branch, path, base, createdBranch: true, createdWorktree: true };
  }, resumed);
}

/**
 * Remove a task worktree and its branch (the human's prune). Git refuses a worktree with changes. Under the lock;
 * `check` runs there right before the removal and refuses it by throwing (the caller's item state and sessions, which
 * may have changed while Git was read).
 */
/** Merged cleanup accepts the recorded tip or a tip contained in its base; deletion compares the observed tip. */
export type ExpectedBranch = { branch: string; tip: string; base?: string };
/** Preparation may return a final containment/live check, run after the last path check and before Git. */
type WorktreeValidation = () => void | Promise<void>;
export type WorktreeCheck = () => void | WorktreeValidation | Promise<void | WorktreeValidation>;

export async function removeTaskWorktree(root: string, item: string, check: WorktreeCheck = () => {}, expected?: ExpectedBranch, resumed: <T>(work: () => T) => T = work => work(), env: NodeJS.ProcessEnv = process.env): Promise<{ path: string; branch: string | null }> {
  return withTerritoryLockAsync(root, async () => {
    const path = taskWorktreePath(root, item);
    const matched = await findWorktree(root, path, env);
    const { found, branch } = resumed(() => {
      const found = matched;
      if (!found && !expected) throw new Error(`${item} has no worktree`);
      if (found && expected && found.branch !== expected.branch) throw new Error(`${item}: worktree branch changed since merge`);
      const branch = found?.branch ?? expected?.branch ?? null;
      if (branch === 'main' || branch === 'dev') throw new Error(`${item}: cannot prune the integration branch`);
      return { found, branch };
    });
    const tip = branch === null ? null : await refAsync(root, `refs/heads/${branch}`, env);
    const identityRead = resumed(() => found ? stat(found.path) : null);
    const identity = await identityRead;
    // Recreated task branches can differ from the squash source while containing no work
    // beyond dev. A failed ancestry check keeps the worktree, just like an unmerged commit.
    const contained = expected?.base && tip && tip !== expected.tip
      ? await maybeGitAsync(root, ['merge-base', '--is-ancestor', tip, `refs/heads/${expected.base}`], env) !== null
      : false;
    const gone = resumed(() => {
      if (expected && !found && tip === null) return true;
      if (expected && tip !== expected.tip && !contained) throw new Error(`${item}: branch moved since merge (${tip ?? 'none'}), kept; move unmerged work to a follow-up task`);
      return false;
    });
    if (gone) return { path, branch };
    await checkWorktreePath(root, path, resumed);
    const validate = await resumed(check);
    await checkWorktreePath(root, path, resumed);
    const checking = resumed(() => found && identity ? stat(found.path) : null);
    if (checking !== null && found && identity) {
      const current = await checking;
      const confined = await resumed(() => worktreeConfined(root, found.path, resumed));
      resumed(() => {
        if (current.dev !== identity.dev || current.ino !== identity.ino || !confined) throw new Error(`${item}: worktree identity or confinement changed during prune; kept`);
      });
    }
    await resumed(() => validate?.());
    if (found) await territoryGitAsync(root, ['worktree', 'remove', found.path], undefined, undefined, env);
    const validateBranch = await resumed(check);
    await resumed(() => validateBranch?.());
    if (branch !== null && tip !== null) {
      if (expected) {
        try {
          // --no-deref protects against a hand-replaced symbolic task ref; the old SHA is a compare-and-swap.
          await territoryGitAsync(root, ['update-ref', '--no-deref', '-d', `refs/heads/${branch}`, tip], undefined, undefined, env);
        } catch (err) {
          const current = await refAsync(root, `refs/heads/${branch}`, env);
          if (current !== tip) {
            // A writer moved the ref after the pre-removal check: preserve its branch and put its worktree back.
            if (found) {
              await checkWorktreePath(root, path, resumed);
              await territoryGitAsync(root, current === null ? ['worktree', 'add', '--detach', path, tip] : ['worktree', 'add', path, branch], undefined, undefined, env);
              await verifyCreatedWorktree(root, path, current === null ? null : branch, current ?? tip, false, resumed, env);
            }
            resumed(() => { throw new Error(`${item}: branch moved since merge (${current ?? 'none'}), kept`); });
          }
          throw err;
        }
      } else await territoryGitAsync(root, ['branch', '-D', branch], undefined, undefined, env);
    }
    return { path, branch };
  }, resumed);
}

// ---------------------------------------------------------------- the squash gate's Git work (T-59, D2/D9)
/** The guard owns the lock and calls `message` again after preparation, before any ref moves. */
export async function squashTask(
  root: string,
  branch: string,
  message: (tip: string, base: string, baseTip: string, files: readonly string[]) => Promise<string>,
  resumed: <T>(work: () => T) => T = (work) => work(),
  prepared: (landing: { commit: string; base: string; tip: string; checkout?: { before: string; after: string } }) => void = () => {},
  authorize: () => void = () => {},env: NodeJS.ProcessEnv = process.env,
): Promise<{ commit: string; base: string }> {
  const managed = await hasTerritory(root, env);
  resumed(() => { if (!managed) throw new MergeError('merge-territory', 'the project has no managed territory'); });
  const foundBase = await taskBase(root, undefined, env);
  const base = resumed(() => {
    if (!foundBase) throw new MergeError('merge-base', 'no task base');
    if (branch === foundBase || branch === 'main' || branch === 'dev') throw new MergeError('merge-branch', 'the task branch is the integration branch');
    return foundBase;
  });
  const foundBefore = await refAsync(root, `refs/heads/${base}`, env);
  const foundTip = await refAsync(root, `refs/heads/${branch}`, env);
  const { before, tip } = resumed(() => {
    if (!foundBefore || !foundTip) throw new MergeError('merge-branch', `no local branch ${branch}`);
    return { before: foundBefore, tip: foundTip };
  });
  const checkout = await maybeGitAsync(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  resumed(() => { if (checkout !== base) throw new MergeError('merge-checkout', `the project root must be on ${base}`); });
  const remoteTip = await refAsync(territoryPath(root), `refs/heads/${base}`, env);
  const ancestor = remoteTip ? await maybeGitAsync(root, ['merge-base', '--is-ancestor', remoteTip, before], env) : '';
  resumed(() => { if (ancestor === null) throw new MergeError('merge-base', `territory ${base} is not an ancestor of the root's ${base}`); });
  if (base === 'dev' && remoteTip !== before) {
    const unpublished = await territoryGitAsync(root, ['log', '--format=%h %s', remoteTip ? `${remoteTip}..${before}` : before, '--'], undefined, undefined, env);
    resumed(() => { throw new MergeError('merge-unpublished', `root ${base} has unpublished commits:\n${unpublished}\nrun cland push before cland merge`); });
  }
  let tree: string;
  try {
    const merged = await territoryGitAsync(root, ['merge-tree', '--write-tree', '--name-only', '-z', before, tip], undefined, undefined, env);
    tree = resumed(() => merged.split('\0')[0]!);
  } catch (err) {
    tree = resumed(() => {
      if (!(err instanceof TerritoryGitError) || err.code !== 1) throw err;
      const parts = err.stdout.split('\0').slice(1);
      const files = parts.slice(0, parts.indexOf(''));
      throw new MergeError('merge-conflict', `rebase ${branch} on ${base}; conflicts: ${files.join(', ')}`, files);
    });
  }
  try { await lintHubShardTree(root, tree, env); }
  catch (err) { resumed(() => { throw new MergeError('merge-tiers', err instanceof Error ? err.message : String(err), err instanceof ShardManifestError ? err.files : undefined); }); }
  // Include deleted rename sources as well as destinations for path-based merge gates and checkout safety.
  const touched = await territoryGitAsync(root, ['diff', '--no-renames', '--name-only', '-z', before, tree, '--'], undefined, undefined, env);
  const tracked = await territoryGitAsync(root, ['diff', '--name-only', '-z', 'HEAD', '--'], undefined, undefined, env);
  const untracked = await territoryGitAsync(root, ['ls-files', '--others', '--exclude-standard', '-z'], undefined, undefined, env);
  resumed(() => {
    const paths = touched.split('\0').filter(Boolean);
    const dirty = [...tracked.split('\0'), ...untracked.split('\0')].filter(Boolean);
    const overlap = dirty.filter((f) => paths.some((p) => f === p || f.startsWith(p + '/') || p.startsWith(f + '/')));
    if (overlap.length) throw new MergeError('merge-dirty', `uncommitted changes in ${overlap.join(', ')}`, overlap);
  });
  // Git's own index/worktree safety checks also catch directory obstructions and staged changes. No ref yet.
  try { await territoryGitAsync(root, ['read-tree', '--dry-run', '-m', '-u', before, tree], undefined, undefined, env); }
  catch (err) { resumed(() => { throw new MergeError('merge-dirty', err instanceof Error ? err.message : String(err)); }); }
  const text = await message(tip, base, before, touched.split('\0').filter(Boolean));
  const commit = await territoryGitAsync(root, ['commit-tree', tree, '-p', before], false, text + '\n', env);
  const latestText = await message(tip, base, before, touched.split('\0').filter(Boolean));
  resumed(() => { if (latestText !== text) throw new MergeError('merge-changed', 'the item or verdicts changed during preparation; try again'); });
  // These facts are read again after every preparation callback: a checkout or ref may move during its awaits.
  const currentTip = await refAsync(root, `refs/heads/${branch}`, env);
  const currentBase = await refAsync(root, `refs/heads/${base}`, env);
  const currentCheckout = await maybeGitAsync(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  resumed(() => {
    if (currentCheckout !== base) throw new MergeError('merge-checkout', `the project root moved off ${base} during preparation`);
    if (currentTip !== tip || currentBase !== before) throw new MergeError('merge-changed', 'a branch changed while the merge was prepared; try again');
  });
  // read-tree preserves unrelated local edits; update-ref is a compare-and-swap of the integration branch.
  const beforeIndex = await territoryGitAsync(root, ['write-tree'], undefined, undefined, env);
  // Include unrelated staged edits in the expected landed index, without touching the root checkout. This snapshot
  // must exist before read-tree: even the write-tree used to inspect its result may fail on a concurrent index lock.
  const indexCommit = await territoryGitAsync(root, ['commit-tree', beforeIndex, '-p', before], false, 'Merge index snapshot\n', env);
  const mergedIndex = await territoryGitAsync(root, ['merge-tree', '--write-tree', commit, indexCommit], undefined, undefined, env);
  const recovery = resumed(() => ({ before: beforeIndex, after: mergedIndex.split('\n')[0]! }));
  resumed(() => prepared({ commit, base, tip, checkout: recovery }));
  let advanced = false;
  let admissionError: unknown;
  const admit = () => { try { authorize(); } catch (err) { admissionError = err; throw err; } };
  try {
    resumed(admit);
    await territoryGitAsync(root, ['read-tree', '-m', '-u', before, commit], undefined, undefined, env);
    const afterIndex = await territoryGitAsync(root, ['write-tree'], undefined, undefined, env);
    resumed(() => {
      admit();
      if (afterIndex !== recovery.after) throw new Error('the index changed during landing; checkout recovery is required');
    });
    await territoryGitAsync(root, ['update-ref', `refs/heads/${base}`, commit, before], undefined, undefined, env);
    resumed(() => { advanced = true; prepared({ commit, base, tip }); });
    // Use the on-disk path, never origin's configurable push URL (and never github).
    await territoryGitAsync(root, ['push', territoryPath(root), `refs/heads/${base}:refs/heads/${base}`], true, undefined, env);
  } catch (err) {
    resumed(() => prepared({ commit, base, tip, checkout: recovery }));
    try {
      await restoreTaskCheckout(root, { commit, base, checkout: recovery }, resumed, undefined, env);
      if (advanced) await territoryGitAsync(root, ['update-ref', `refs/heads/${base}`, before, commit], undefined, undefined, env);
    } catch (restore) {
      resumed(() => { throw new MergeError('merge-recovery', `checkout recovery pending for prepared ${commit} on ${base}: ${restore instanceof Error ? restore.message : String(restore)}; initial failure: ${err instanceof Error ? err.message : String(err)}`, undefined, { commit, base }); });
    }
    resumed(() => { if (err === admissionError) throw err; throw new MergeError('merge-git', err instanceof Error ? err.message : String(err)); });
  }
  return { commit, base };
}

/** Restore an unlanded preparation, or roll back a failed landing, only from its recorded index states. */
export async function restoreTaskCheckout(root: string, receipt: { commit: string; base: string; checkout: { before: string; after: string } }, resumed: <T>(work: () => T) => T, authorize: () => void = () => {}, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const before = await refAsync(root, `${receipt.commit}^`, env);
  const branch = await maybeGitAsync(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  const index = await territoryGitAsync(root, ['write-tree'], undefined, undefined, env);
  resumed(() => {
    authorize();
    if (!before || branch !== receipt.base) throw new Error(`the root must be on ${receipt.base} for checkout recovery`);
    if (index !== receipt.checkout.before && index !== receipt.checkout.after) throw new Error('the index changed since merge preparation; staged work was kept');
  });
  await territoryGitAsync(root, ['read-tree', '-m', '-u', receipt.commit, before!], undefined, undefined, env);
  const restored = await territoryGitAsync(root, ['write-tree'], undefined, undefined, env);
  resumed(() => { if (restored !== receipt.checkout.before) throw new Error('the restored index differs from its durable snapshot'); });
}

/** A recorded Item commit on the local integration ref is landed; publication may still need finishing. */
export async function landedTask(root: string, id: string, receipt: { commit: string; base: string; branch: string; tip: string }, resumed: <T>(work: () => T) => T, options: { strict?: boolean } = {}, env: NodeJS.ProcessEnv = process.env): Promise<{ current: boolean; published: boolean } | null> {
  // Reopen must not mistake an unavailable Git inspection for a fully rolled-back receipt.
  const inspect = (cwd: string, args: string[]) => options.strict
    ? territoryGitAsync(cwd, args, undefined, undefined, env).catch(err => resumed(() => {
      if (err instanceof TerritoryGitError && err.code === 1 && (args[0] === 'merge-base' || args[0] === 'rev-parse')) return null;
      throw err;
    }))
    : maybeGitAsync(cwd, args, env);
  const message = await inspect(root, ['show', '-s', '--format=%B', receipt.commit]);
  if (!resumed(() => message?.split('\n').includes(`Item: ${id}`))) return null;
  const local = await inspect(root, ['merge-base', '--is-ancestor', receipt.commit, `refs/heads/${receipt.base}`]);
  // A rolled-back preparation may never have copied its commit object into the territory.
  const remoteObject = options.strict ? await inspect(territoryPath(root), ['rev-parse', '--verify', '--quiet', `${receipt.commit}^{commit}`]) : null;
  const remote = !options.strict || remoteObject ? await inspect(territoryPath(root), ['merge-base', '--is-ancestor', receipt.commit, `refs/heads/${receipt.base}`]) : null;
  if (local === null && remote === null) return null;
  const tip = await refAsync(root, `refs/heads/${receipt.branch}`, env);
  return resumed(() => ({ current: tip === null || tip === receipt.tip, published: remote !== null }));
}

/** Finish a recorded landing's root checkout after an interrupted or failed rollback. No local edits are forced. */
export async function reconcileTaskCheckout(root: string, receipt: { commit: string; base: string; checkout?: { before: string; after: string } }, resumed: <T>(work: () => T) => T, reconciled: () => void = () => {}, authorize: () => void = () => {}, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const before = await refAsync(root, `${receipt.commit}^`, env);
  const current = await refAsync(root, `refs/heads/${receipt.base}`, env);
  const checkout = await maybeGitAsync(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  resumed(() => {
    if (!before || !current) throw new Error('cannot resolve the recorded landing and its base');
    if (checkout !== receipt.base) throw new Error(`the project root must be on ${receipt.base} to finish its landed merge`);
  });
  const contains = await maybeGitAsync(root, ['merge-base', '--is-ancestor', receipt.commit, current!], env);
  const advances = contains === null ? await maybeGitAsync(root, ['merge-base', '--is-ancestor', current!, receipt.commit], env) : '';
  const target = resumed(() => {
    if (advances === null) throw new Error(`${receipt.base} diverged from the recorded landing; its checkout was kept`);
    return contains === null ? receipt.commit : current!;
  });
  const checkedTip = await refAsync(root, `refs/heads/${receipt.base}`, env);
  const checkedCheckout = await maybeGitAsync(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  resumed(() => {
    if (checkedTip !== current || checkedCheckout !== receipt.base) throw new Error('the root checkout or base changed before landing reconciliation; try again');
  });
  if (receipt.checkout) {
    const index = await territoryGitAsync(root, ['write-tree'], undefined, undefined, env);
    const rolledBack = resumed(() => {
      authorize();
      if (index !== receipt.checkout!.before && index !== receipt.checkout!.after) throw new Error('the index changed since merge rollback; staged work was kept');
      return index === receipt.checkout!.before;
    });
    if (rolledBack) await territoryGitAsync(root, ['read-tree', '-m', '-u', before!, target], undefined, undefined, env);
    // Record a coherent checkout before the ref repair; a ref failure can be retried without touching staged work.
    resumed(() => { authorize(); reconciled(); });
  }
  if (target !== current) {
    resumed(authorize);
    await territoryGitAsync(root, ['update-ref', `refs/heads/${receipt.base}`, target, current!], undefined, undefined, env);
  }
  const finalTip = await refAsync(root, `refs/heads/${receipt.base}`, env);
  const finalCheckout = await maybeGitAsync(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  resumed(() => {
    if (finalTip !== target || finalCheckout !== receipt.base) throw new Error('the root checkout or base changed during landing reconciliation; try again');
  });
}
