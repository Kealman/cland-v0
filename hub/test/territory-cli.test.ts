// T3: native Git init/undo and protection hooks guard territory refs during real pushes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, tempProject, type CliResult } from './harness.ts';

import { runInit, runUpdate } from '../src/cli/init.ts';
import { runDoctor } from '../src/cli/doctor.ts';
import { captureCli } from './cli-in-process.ts';
import { INIT_GIT_IDENTITY, withInitGitIdentity } from './git-identity-fixture.ts';
import { commandIn, gitIn, initIn, masterClone, scratchMachine, snapshot } from './init-machine.ts';
import { listTaskWorktrees, territoryGit, territoryGitAsync } from '../src/territory.ts';
import { gitIn as verdictGit } from '../src/tracker/verdict-git.ts';
import { refusedOverridePaths } from '../src/merge-override.ts';

const git = (root: string, ...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, r.stderr);
  return r;
};
type Change = { path: string; action: string; note?: string };
const init = async (root: string, ...args: string[]): Promise<Change[]> =>
  withInitGitIdentity(async () => JSON.parse(ok(await captureCli(write => runInit([...args, '--json'], root, write))).stdout).changes);
const initCli = async (root: string, ...args: string[]): Promise<Change[]> =>
  JSON.parse(ok(await clandWithEnv(root, INIT_GIT_IDENTITY, 'init', ...args, '--json')).stdout).changes;

async function fixture(t: Parameters<typeof tempProject>[0], remote = true) {
  const root = await tempProject(t, 'cland-territory-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  const github = await tempProject(t, 'cland-github-');
  git(github, 'init', '-q', '--bare');
  if (remote) {
    git(root, 'remote', 'add', 'origin', github);
    git(root, 'push', '-qu', 'origin', 'main');
  }
  return { root, github, territory: join(root, '.cland', 'territory.git') };
}

// T3: the native Git adapter contract needs real Git's path quoting and delimiters; no hub starts.
test('Git runners preserve whitespace in delimited path output', async t => {
  const root = await tempProject(t);
  git(root, 'init', '-q', '-b', 'main');
  await mkdir(join(root, ' docs'));
  const paths = [' docs/input.ts', 'line\nbreak.ts', 'trailing.ts '];
  for (const path of paths) await writeFile(join(root, path), 'source');
  git(root, 'add', '--', ...paths);
  git(root, 'config', 'test.path', ' leading and trailing ');
  const runners = [
    (args: string[]) => territoryGit(root, args),
    (args: string[]) => territoryGitAsync(root, args),
    verdictGit(root),
  ];
  for (const run of runners) {
    const listing = await run(['ls-files', '-z']);
    assert.equal(listing, ' docs/input.ts\0line\nbreak.ts\0trailing.ts \0');
    assert.deepEqual(refusedOverridePaths(listing!.split('\0').filter(Boolean)), paths, 'path policy receives the original filename');
    assert.equal(await run(['config', '--null', '--get', 'test.path']), ' leading and trailing \0');
    assert.equal(await run(['symbolic-ref', '--short', 'HEAD']), 'main', 'scalar callers retain trimmed output');
  }
});

// T3: native worktree porcelain quotes paths without -z; no hub starts.
test('task worktree listings preserve whitespace in the project path', async t => {
  const parent = await tempProject(t);
  const root = join(parent, ' leading\ntrailing ');
  await mkdir(root);
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'Initial');
  const path = join(root, '.cland', 'worktrees', 'T-1');
  git(root, 'worktree', 'add', '-qb', 'task', path);
  assert.deepEqual(await listTaskWorktrees(root), [{ path, head: git(root, 'rev-parse', 'HEAD'), branch: 'task', prunable: false, item: 'T-1' }]);
});

// T3: native clone HEAD discovery and ref seeding require real Git; no hub or harness starts.
test('init seeds dev and the territory from a clone defaulting to master', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root, upstream } = await masterClone(machine);
  const readGit = async (folder: string, ...args: string[]) => ok(await gitIn(machine, folder, ...args)).stdout.trim();
  // A competing local main must not override origin/HEAD.
  const initial = await readGit(root, 'rev-parse', 'master');
  const other = await readGit(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Other main');
  await readGit(root, 'branch', 'main', other);
  const before = await readGit(upstream, 'show-ref');
  ok(await initIn(machine, root, 'init', '--json'));
  const territory = join(root, '.cland', 'territory.git');
  assert.equal(await readGit(root, 'branch', '--show-current'), 'dev');
  for (const branch of ['master', 'dev']) assert.equal(await readGit(territory, 'rev-parse', branch), initial);
  assert.equal(await readGit(root, 'rev-parse', 'dev'), initial);
  assert.equal(await readGit(territory, 'config', 'cland.defaultBranch'), 'master');
  assert.equal(await readGit(territory, 'config', 'cland.originalBranch'), 'master');
  assert.equal(await readGit(upstream, 'show-ref'), before);
  ok(await initIn(machine, root, 'init', '--json'));
  assert.equal(await readGit(territory, 'config', 'cland.defaultBranch'), 'master', 'rerun keeps the recorded default despite origin/HEAD now naming dev');
});

test('init seeds the remote default even when it has no local branch', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root } = await masterClone(machine);
  const initial = ok(await gitIn(machine, root, 'rev-parse', 'HEAD')).stdout.trim();
  ok(await gitIn(machine, root, 'switch', '-c', 'work'));
  ok(await gitIn(machine, root, 'branch', '-D', 'master'));
  ok(await initIn(machine, root, 'init', '--json'));
  const territory = join(root, '.cland', 'territory.git');
  for (const branch of ['master', 'dev']) {
    assert.equal(ok(await gitIn(machine, territory, 'rev-parse', branch)).stdout.trim(), initial);
  }
  assert.equal(ok(await gitIn(machine, root, 'branch', '--show-current')).stdout.trim(), 'work');
});

test('the territory protects its recorded default branch at hook runtime', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root } = await masterClone(machine);
  ok(await initIn(machine, root, 'init', '--json'));
  const initial = ok(await gitIn(machine, root, 'rev-parse', 'HEAD')).stdout.trim();
  ok(await gitIn(machine, root, 'commit', '--allow-empty', '-qm', 'Task work'));
  for (const target of ['HEAD:master', ':master', 'HEAD:dev', ':dev']) {
    const push = await gitIn(machine, root, 'push', 'origin', target);
    assert.notEqual(push.code, 0, target);
    assert.match(push.stderr, /master.*dev.*protected/);
  }
  ok(await gitIn(machine, root, 'push', 'origin', 'HEAD:refs/heads/t/T-1-work'));
  ok(await gitIn(machine, root, 'push', '--force', 'origin', `${initial}:refs/heads/t/T-1-work`));
  const territory = join(root, '.cland', 'territory.git');
  const hook = await readFile(join(territory, 'hooks', 'update'), 'utf8');
  ok(await gitIn(machine, territory, 'config', 'cland.defaultBranch', 't/T-1-work'));
  const push = await gitIn(machine, root, 'push', 'origin', ':t/T-1-work');
  assert.notEqual(push.code, 0);
  assert.match(push.stderr, /t\/T-1-work.*protected/);
  assert.equal(await readFile(join(territory, 'hooks', 'update'), 'utf8'), hook);
});

test('undo restores the recorded master default', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root, upstream } = await masterClone(machine);
  ok(await initIn(machine, root, 'init', '--json'));
  ok(await initIn(machine, root, 'init', '--undo', '--json'));
  assert.equal(ok(await gitIn(machine, root, 'branch', '--show-current')).stdout.trim(), 'master');
  assert.equal(ok(await gitIn(machine, root, 'remote', 'get-url', 'origin')).stdout.trim(), `file://${upstream}`);
});

test('doctor checks the recorded default branch ref', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root } = await masterClone(machine);
  ok(await initIn(machine, root, 'init', '--json'));
  const check = async () => {
    const r = await initIn(machine, root, 'doctor', '--json');
    return JSON.parse(r.stdout).checks.find((c: { name: string }) => c.name === 'territory') as { verdict: string; detail: string };
  };
  assert.equal((await check()).verdict, 'ok');
  ok(await gitIn(machine, join(root, '.cland', 'territory.git'), 'update-ref', '-d', 'refs/heads/master'));
  assert.match((await check()).detail, /territory master is missing/);
});

test('init discovers the sole trunk branch without an origin HEAD', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root } = await masterClone(machine);
  ok(await gitIn(machine, root, 'remote', 'remove', 'origin'));
  ok(await gitIn(machine, root, 'branch', '-m', 'trunk'));
  const initial = ok(await gitIn(machine, root, 'rev-parse', 'HEAD')).stdout.trim();
  ok(await initIn(machine, root, 'init', '--json'));
  const territory = join(root, '.cland', 'territory.git');
  assert.equal(ok(await gitIn(machine, territory, 'config', 'cland.defaultBranch')).stdout.trim(), 'trunk');
  assert.equal(ok(await gitIn(machine, root, 'rev-parse', 'dev')).stdout.trim(), initial);
  assert.equal(ok(await gitIn(machine, territory, 'rev-parse', 'trunk')).stdout.trim(), initial);
});

test('init refuses ambiguous local branches before any write', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root } = await masterClone(machine);
  ok(await gitIn(machine, root, 'remote', 'remove', 'origin'));
  ok(await gitIn(machine, root, 'branch', '-m', 'trunk'));
  ok(await gitIn(machine, root, 'branch', 'other'));
  const before = await snapshot(root);
  const result = await initIn(machine, root, 'init', '--json');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /other.*trunk/);
  assert.match(result.stderr, /git symbolic-ref.*origin\/HEAD.*main/);
  assert.deepEqual(await snapshot(root), before);
});

test('branch readers use the recorded default with a main fallback for legacy territories', async (t) => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root } = await masterClone(machine);
  ok(await initIn(machine, root, 'init', '--json'));
  ok(await gitIn(machine, root, 'switch', 'master'));
  ok(await gitIn(machine, root, 'branch', '-D', 'dev'));
  const territory = join(root, '.cland', 'territory.git');
  const check = async (expected: string) => ok(await commandIn(machine, root, process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { defaultBranch, taskBase } from ${JSON.stringify(new URL('../src/territory.ts', import.meta.url).href)};
    assert.equal(defaultBranch(process.cwd()), process.argv[1]);
    assert.equal(await taskBase(process.cwd()), process.argv[1]);
  `, expected]));
  await check('master');
  ok(await gitIn(machine, root, 'branch', 'main'));
  ok(await gitIn(machine, territory, 'config', '--unset', 'cland.defaultBranch'));
  await check('main');
  const push = await gitIn(machine, root, 'push', 'origin', 'HEAD:main');
  assert.notEqual(push.code, 0);
  assert.match(push.stderr, /main.*dev.*protected/);
});

test('init redirects origin locally, preserves GitHub and upstreams, seeds main/dev and switches the clean root', async (t) => {
  const { root, github, territory } = await fixture(t);
  const before = git(github, 'show-ref');
  const changes = await initCli(root);
  assert.ok(changes.some((c) => c.path === '.cland/territory.git' && c.action === 'created'));
  assert.equal(git(root, 'remote', 'get-url', 'origin'), territory);
  assert.equal(git(root, 'remote', 'get-url', 'github'), github);
  assert.equal(git(root, 'config', 'branch.main.remote'), 'github');
  assert.equal(git(root, 'branch', '--show-current'), 'dev');
  assert.equal(git(territory, 'rev-parse', 'main'), git(root, 'rev-parse', 'main'));
  assert.equal(git(territory, 'rev-parse', 'dev'), git(root, 'rev-parse', 'dev'));
  assert.equal(git(territory, 'symbolic-ref', 'HEAD'), 'refs/heads/dev');
  // origin's default branch in the root is dev: Claude Code's sub-agent worktrees start there (T-58, D8)
  assert.equal(git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD'), 'refs/remotes/origin/dev');
  assert.equal(git(root, 'rev-parse', 'origin/dev'), git(root, 'rev-parse', 'dev'));
  assert.equal(git(github, 'show-ref'), before);
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /only `cland release` pushes to `github`/);
  const again = (await init(root)).filter((c) => c.path.startsWith('.cland/territory.git'));
  assert.ok(again.length >= 6);
  assert.ok(again.every((c) => c.action === 'unchanged'), JSON.stringify(again));
  assert.match(ok(await clandWithEnv(root, {}, 'init')).stdout, /unchanged.*territory/);
});

test('the territory refuses updates and deletion of main/dev while task pushes and force pushes stay free', async (t) => {
  const { root, territory } = await fixture(t);
  await init(root);
  const initial = git(root, 'rev-parse', 'HEAD');
  git(root, 'commit', '--allow-empty', '-qm', 'Task work');
  for (const target of ['HEAD:dev', 'HEAD:main', ':main', ':dev']) {
    const push = spawnSync('git', ['push', 'origin', target], { cwd: root, encoding: 'utf8' });
    assert.notEqual(push.status, 0, target);
    assert.match(push.stderr, /cland merge.*cland release/);
  }
  git(root, 'push', 'origin', 'HEAD:refs/heads/t/T-1-x');
  git(root, 'push', '--force', 'origin', `${initial}:refs/heads/t/T-1-x`);
  assert.equal(git(territory, 'rev-parse', 'refs/heads/t/T-1-x'), initial);
  assert.equal(git(territory, 'rev-parse', 'main'), initial);
  assert.equal(git(territory, 'rev-parse', 'dev'), initial);
});

test('undo restores the remotes, upstream and main, keeps dev, and reinstates the non-territory instructions', async (t) => {
  const { root, github, territory } = await fixture(t);
  await init(root);
  await initCli(root, '--undo');
  assert.equal(git(root, 'branch', '--show-current'), 'main');
  assert.equal(git(root, 'remote'), 'origin');
  assert.equal(git(root, 'remote', 'get-url', 'origin'), github);
  assert.equal(git(root, 'config', 'branch.main.remote'), 'origin');
  assert.equal(git(root, 'rev-parse', 'dev'), git(root, 'rev-parse', 'main'));
  await assert.rejects(readFile(join(territory, 'HEAD')));
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /Push to GitHub only on the Coordinator/);
  assert.ok((await init(root, '--undo')).every((c) => c.action === 'unchanged'));
});

test('undo names territory-only refs and differing tips, mutates nothing on refusal, and accepts --force', async (t) => {
  const { root, territory } = await fixture(t);
  await init(root);
  const unique = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Only the territory holds this work');
  git(root, 'push', '-q', 'origin', `${unique}:refs/heads/t/T-99-only`);
  const denied = await captureCli(write => runInit(['--undo'], root, write));
  assert.equal(denied.code, 1);
  assert.match(denied.stderr, /refs\/heads\/t\/T-99-only.*--force/);
  assert.equal(git(root, 'remote', 'get-url', 'origin'), territory);
  assert.equal(git(root, 'branch', '--show-current'), 'dev');
  git(territory, 'update-ref', '-d', 'refs/heads/t/T-99-only');
  git(root, 'update-ref', '-d', 'refs/remotes/origin/t/T-99-only');
  git(root, 'commit', '--allow-empty', '-qm', 'New local dev');
  git(territory, 'update-ref', 'refs/heads/dev', unique);
  const different = await captureCli(write => runInit(['--undo'], root, write));
  assert.equal(different.code, 1);
  assert.match(different.stderr, /refs\/heads\/dev/);
  await init(root, '--undo', '--force');
  await assert.rejects(readFile(join(territory, 'HEAD')));
});

test('undo refuses refs preserved only by origin tracking refs, then permits their loss with --force', async (t) => {
  const { root, github, territory } = await fixture(t);
  await init(root);
  const oid = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Only the territory and tracking ref hold this');
  const name = 'refs/remotes/origin/review-copy';
  git(root, 'update-ref', name, oid);
  git(root, 'push', '-q', 'origin', `${name}:${name}`);
  const before = git(root, 'for-each-ref', '--format=%(refname) %(objectname)');
  const denied = await captureCli(write => runInit(['--undo'], root, write));
  assert.equal(denied.code, 1, 'undo must refuse before deleting both copies');
  assert.match(denied.stderr, /refs\/remotes\/origin\/review-copy.*--force/);
  assert.equal(git(root, 'for-each-ref', '--format=%(refname) %(objectname)'), before);
  assert.equal(git(root, 'remote', 'get-url', 'origin'), territory);
  assert.equal(git(root, 'remote', 'get-url', 'github'), github);
  assert.equal(git(root, 'branch', '--show-current'), 'dev');
  assert.equal(git(territory, 'rev-parse', name), oid);
  await init(root, '--undo', '--force');
  assert.ok(!git(root, 'for-each-ref', '--format=%(objectname)').split('\n').includes(oid));
  await assert.rejects(readFile(join(territory, 'HEAD')));
});

test('undo refuses unique work under every custom origin fetch destination before mutation', async (t) => {
  for (const mapping of ['+refs/remotes/cache/*:refs/remotes/cache/*', '+refs/heads/work:refs/remotes/cache/review-copy']) {
    const { root, territory } = await fixture(t);
    await init(root);
    const oid = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Custom tracking work');
    const name = 'refs/remotes/cache/review-copy';
    git(root, 'config', '--add', 'remote.origin.fetch', mapping);
    git(root, 'update-ref', name, oid);
    git(root, 'push', '-q', 'origin', `${name}:${name}`);
    const before = git(root, 'for-each-ref', '--format=%(refname) %(objectname)');
    const denied = await captureCli(write => runInit(['--undo'], root, write));
    assert.equal(denied.code, 1, mapping);
    assert.match(denied.stderr, /refs\/remotes\/cache\/review-copy.*--force/);
    assert.equal(git(root, 'for-each-ref', '--format=%(refname) %(objectname)'), before);
    assert.equal(git(territory, 'rev-parse', name), oid);
    assert.equal(git(root, 'branch', '--show-current'), 'dev');
    await init(root, '--undo', '--force');
    assert.ok(!git(root, 'for-each-ref', '--format=%(objectname)').split('\n').includes(oid));
    await assert.rejects(readFile(join(territory, 'HEAD')));
  }
});

test('undo refuses unique commits held only by root tracking refs even without a territory copy', async (t) => {
  const { root, territory } = await fixture(t);
  await init(root);
  const oid = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Root tracking only');
  const name = 'refs/remotes/origin/review-copy';
  git(root, 'update-ref', name, oid);
  const before = git(root, 'for-each-ref', '--format=%(refname) %(objectname)');
  const denied = await captureCli(write => runInit(['--undo'], root, write));
  assert.equal(denied.code, 1);
  assert.match(denied.stderr, /refs\/remotes\/origin\/review-copy.*--force/);
  assert.equal(git(root, 'for-each-ref', '--format=%(refname) %(objectname)'), before);
  assert.equal(git(root, 'remote', 'get-url', 'origin'), territory);
  await init(root, '--undo', '--force');
  assert.ok(!git(root, 'for-each-ref', '--format=%(objectname)').split('\n').includes(oid));
});

test('undo allows dropped refs whose commits survive through another ref or its history', async (t) => {
  const { root } = await fixture(t);
  await init(root);
  const oid = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Preserved in history');
  git(root, 'push', '-q', 'origin', `${oid}:refs/heads/t/T-99-history`);
  const descendant = git(root, 'commit-tree', 'HEAD^{tree}', '-p', oid, '-m', 'Durable descendant');
  git(root, 'update-ref', 'refs/tags/keep-work', descendant);
  await init(root, '--undo');
  assert.equal(git(root, 'rev-parse', 'refs/tags/keep-work^'), oid);
});

test('dirty roots and other branches stay in place, with a reason in the init report', async (t) => {
  for (const mode of ['tracked', 'untracked', 'branch', 'detached']) {
    const { root } = await fixture(t);
    if (mode === 'tracked') await writeFile(join(root, 'README.md'), 'dirty\n');
    if (mode === 'untracked') await writeFile(join(root, 'scratch'), 'dirty\n');
    if (mode === 'branch') git(root, 'switch', '-c', 'work');
    if (mode === 'detached') git(root, 'switch', '--detach');
    const before = git(root, 'rev-parse', 'HEAD');
    const report = await init(root);
    assert.equal(git(root, 'branch', '--show-current'), mode === 'branch' ? 'work' : mode === 'detached' ? '' : 'main');
    assert.equal(git(root, 'rev-parse', 'HEAD'), before);
    assert.match(report.find((c) => c.path.endsWith('root-branch'))?.note ?? '', /root left on/);
    if (mode === 'tracked' || mode === 'untracked') assert.match(report.find((c) => c.path.endsWith('root-branch'))?.note ?? '', /uncommitted changes/);
  }
});

test('projects without a remote get only origin; non-Git folders get a first commit', async (t) => {
  const { root, territory } = await fixture(t, false);
  await init(root);
  assert.equal(git(root, 'remote'), 'origin');
  assert.equal(git(root, 'remote', 'get-url', 'origin'), territory);
  await init(root, '--undo');
  assert.equal(git(root, 'remote'), '');
  const folder = await tempProject(t);
  await writeFile(join(folder, 'README.md'), 'The human\'s non-Git project\n');
  const report = await init(folder);
  assert.equal(report.find((c) => c.path === '.git')?.action, 'created');
  assert.equal(git(folder, 'branch', '--show-current'), 'dev');
  assert.equal(git(folder, 'ls-tree', '--name-only', 'HEAD', '--', 'README.md'), '');
  assert.equal(git(folder, 'status', '--porcelain'), '?? README.md');
  const agents = await readFile(join(folder, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Only cland release pushes to GitHub/);
  ok(await captureCli(write => runUpdate([], folder, write)));
  assert.equal(await readFile(join(folder, 'AGENTS.md'), 'utf8'), agents);
});

test('update refreshes territory instructions but leaves a Git project without a territory opted out', async (t) => {
  const { root } = await fixture(t);
  await init(root);
  const agentsPath = join(root, 'AGENTS.md');
  await writeFile(agentsPath, (await readFile(agentsPath, 'utf8')).replace('only `cland release` pushes to `github`', 'old rule'));
  ok(await captureCli(write => runUpdate([], root, write)));
  assert.match(await readFile(agentsPath, 'utf8'), /only `cland release` pushes to `github`/);
  await init(root, '--undo');
  ok(await captureCli(write => runUpdate([], root, write)));
  assert.match(await readFile(agentsPath, 'utf8'), /Push to GitHub only on the Coordinator/);
  assert.equal(git(root, 'remote'), 'origin');
});

test('doctor checks the territory and names corrupted origin, missing dev, HEAD and protection hook', async (t) => {
  const { root, github, territory } = await fixture(t);
  await init(root);
  const check = async () => {
    // Exercise project checks without invoking any installed harness or network-facing gh.
    const r = await captureCli(write => runDoctor(['--json'], root, { PATH: '/usr/bin:/bin', CLAND_NVIM: '/missing-nvim', CLAND_CLAUDE_BIN: '/missing-claude', CLAND_CODEX_BIN: '/missing-codex', CLAND_OPENCODE_BIN: '/missing-opencode' }, write));
    return JSON.parse(r.stdout).checks.find((c: { name: string }) => c.name === 'territory') as { verdict: string; detail: string; fix?: string };
  };
  assert.equal((await check()).verdict, 'ok');
  // the task branches' base override (T-58) must name a local branch
  git(territory, 'config', 'cland.taskBase', 'main');
  assert.equal((await check()).verdict, 'ok');
  git(territory, 'config', 'cland.taskBase', 'gone');
  assert.match((await check()).detail, /cland\.taskBase names gone, which has no local branch/);
  git(territory, 'config', '--unset', 'cland.taskBase');
  await chmod(join(territory, 'hooks', 'update'), 0o641);
  assert.match((await check()).detail, /not executable/);
  await chmod(join(territory, 'hooks', 'update'), 0o755);
  git(root, 'config', 'remote.origin.pushurl', github);
  assert.match((await check()).detail, /origin push URL is not the territory/);
  git(root, 'config', '--unset-all', 'remote.origin.pushurl');
  git(root, 'remote', 'set-url', 'origin', github);
  git(territory, 'update-ref', '-d', 'refs/heads/dev');
  git(territory, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  await writeFile(join(territory, 'hooks', 'update'), '#!/bin/sh\nexit 0\n');
  const broken = await check();
  assert.equal(broken.verdict, 'fail');
  for (const text of ['origin is not the territory', 'dev is missing', 'HEAD is not dev', 'protection hook']) assert.ok(broken.detail.includes(text), broken.detail);
  assert.match(broken.fix ?? '', /cland init/);
});

test('an origin/github name collision refuses before modifying remotes or creating a territory', async (t) => {
  const { root, github, territory } = await fixture(t);
  git(root, 'remote', 'add', 'github', github);
  const r = await captureCli(write => runInit([], root, write));
  assert.equal(r.code, 1);
  assert.match(r.stderr, /origin and github both exist/);
  assert.equal(git(root, 'remote', 'get-url', 'origin'), github);
  await assert.rejects(readFile(join(territory, 'HEAD')));
});

test('init repairs origin push overrides and extra URLs so ordinary pushes cannot reach GitHub', async (t) => {
  const { root, github, territory } = await fixture(t);
  await init(root);
  const before = git(github, 'show-ref');
  git(root, 'config', '--add', 'remote.origin.pushurl', github);
  git(root, 'config', '--add', 'remote.origin.url', github);
  const changes = await init(root);
  assert.equal(changes.find((c) => c.path.endsWith('remotes/origin'))?.action, 'updated');
  assert.equal(git(root, 'remote', 'get-url', '--all', 'origin'), territory);
  assert.equal(git(root, 'remote', 'get-url', '--push', '--all', 'origin'), territory);
  git(root, 'push', '-q', 'origin', 'HEAD:refs/heads/t/T-1-local');
  assert.equal(git(github, 'show-ref'), before);
});
