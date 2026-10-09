// The territory's Git commands live here. Init needs no hub; later hub operations use the same lock and runner.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { acquireLock, HubLocked } from './hub/lock.ts';
import { readText, Report, symlinkOnPath, writeIfChanged } from './init/files.ts';

export const territoryPath = (root: string): string => join(root, '.cland', 'territory.git');
const lockPath = (root: string): string => join(root, '.cland', 'territory.lock');

/** Run Git locally; marked pushes are reserved for cland's guarded operations. Never invoke a shell. */
export function territoryGit(cwd: string, args: string[], marked = false): string {
  const r = spawnSync('git', args, {
    cwd, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, CLAND_TERRITORY_WRITE: marked ? '1' : '' },
  });
  if (r.error || r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.error?.message ?? r.stderr.trim()}`);
  return r.stdout.trim();
}

const maybeGit = (cwd: string, args: string[]): string | null => {
  try { return territoryGit(cwd, args); } catch { return null; }
};

/** Serialize synchronous Git operations across init and the hub. A live holder refuses; stale locks recover. */
export function withTerritoryLock<T>(root: string, operation: () => T): T {
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
  try { return operation(); } finally { lock.release(); }
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
    report.add(join(path, 'remotes/origin'), ours ? 'unchanged' : 'created', 'origin is the local territory');

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
    const unique = territoryGit(path, ['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).filter((line) => {
      const [name, oid] = line.split(' ');
      return name === undefined || ref(root, name) !== oid;
    });
    if (unique.length && !force) throw new Error(`territory holds refs the project lacks (or at different commits): ${unique.join(', ')}; preserve them locally or use cland init --undo --force`);
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
    report.add(path, 'removed', unique.length ? `--force discarded: ${unique.join(', ')}` : 'every territory ref is preserved locally');
  });
  return report;
}

/** Read-only doctor findings, kept here so Git state has one owner. */
export function territoryProblems(root: string): string[] | null {
  const path = territoryPath(root);
  if (!existsSync(path)) return gitProject(root) ? ['territory missing'] : null;
  const problems: string[] = [];
  if (!pointsAtTerritory(root, remote(root, 'origin'))) problems.push('origin is not the territory');
  if (maybeGit(path, ['rev-parse', '--is-bare-repository']) !== 'true') problems.push('territory is not a bare repository');
  for (const branch of ['main', 'dev']) {
    if (ref(path, `refs/heads/${branch}`) === null) problems.push(`territory ${branch} is missing`);
  }
  if (maybeGit(path, ['symbolic-ref', 'HEAD']) !== 'refs/heads/dev') problems.push('territory HEAD is not dev');
  const hook = join(path, 'hooks', 'update');
  if (readText(hook) !== TERRITORY_HOOK || !existsSync(hook) || (statSync(hook).mode & 0o111) === 0 || maybeGit(path, ['config', '--get', 'core.hooksPath']) !== 'hooks') problems.push('territory protection hook is missing or changed');
  return problems;
}
