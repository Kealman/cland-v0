// T3: native Git worktree creation/removal through a recording Host, including territory lock exclusion.
import test from 'node:test';
import fs from 'node:fs';
import cp, { type ExecFileException, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localHost } from '../src/host/local.ts';
import type { Host } from '../src/host/host.ts';
import { ensureTaskWorktree, removeTaskWorktree, withTerritoryLockAsync, territoryGitAsync } from '../src/territory.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { fakeHarness } from './fakes/harness.ts';
import { preparedProject } from './prepared-project.ts';
import { eventually, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

const human = { id: 'human', name: 'human', role: null };
function recording(root: string, env: NodeJS.ProcessEnv) {
  const native = localHost(env);
  const calls: string[] = [];
  const held = async () => assert.rejects(withTerritoryLockAsync(root, async () => {}), /another territory operation holds the lock/);
  const host: Host = { ...native,
    worktreeAdd: async options => { await held(); if (!options.reuseOnly) calls.push(`add:${options.branch}`); return { ...await native.worktreeAdd(options), warning: 'host install warning' }; },
    worktreeRemove: async options => { await held(); calls.push(`remove:${options.path}`); await native.worktreeRemove(options); },
  };
  return { host, calls };
}

test('territory add/remove use the supplied Host under lock and return its install warning', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const { host, calls } = recording(root, env);
  const item = { id: 'T-1', slug: 'host', branch: null };
  const tree = await ensureTaskWorktree(root, item, undefined, undefined, env, host);
  assert.equal(tree.warning, 'host install warning');
  assert.equal((await readFile(join(tree.path, '.git'), 'utf8')).startsWith('gitdir:'), true);
  await removeTaskWorktree(root, item.id, undefined, undefined, undefined, env, host);
  assert.deepEqual(calls, ['add:t/T-1-host', `remove:${tree.path}`]);
  await assert.rejects(access(tree.path));
});

test('default local Host shares root modules and reports a stale install', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  await mkdir(join(root, 'node_modules'));
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'install', branch: null }, undefined, undefined, env);
  assert.equal(await realpath(join(tree.path, 'node_modules')), await realpath(join(root, 'node_modules')));
  await writeFile(join(tree.path, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/example': { version: '1.0.0' } } }));
  const again = await ensureTaskWorktree(root, { id: 'T-1', slug: 'install', branch: null }, undefined, undefined, env);
  assert.match(again.warning ?? '', /stale worktree install/);
});

test('claim, item launch and prune route each created/removed worktree through Host under lock', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const { host, calls } = recording(root, env);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  const core = new HubCore();
  const table = new ProcessTable(':memory:', core.clock);
  const sessions = new Sessions({ root, core, table, env });
  sessions.register(fakeHarness('codex', { clock: core.clock }));
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); await tracker.stop(); });
  const worktrees = new TaskWorktrees({ tracker, env, host });
  const first = await tracker.create(human, { title: 'Claimed', kind: 'task' });
  await tracker.claim(human, first.id);
  const claimed = await worktrees.afterClaim(first.id, 'human');
  assert.equal(claimed.worktree?.warning, 'host install warning');
  await worktrees.afterClaim(first.id, 'human');
  const second = await tracker.create(human, { title: 'Launched', kind: 'task' });
  const launched = await worktrees.launch(sessions, { name: 'worker', harness: 'codex', role: 'implementer', item: second.id });
  assert.equal(launched.process.cwd, launched.worktree?.path);
  await sessions.stop('worker');
  await tracker.close(human, first.id);
  await tracker.close(human, second.id);
  const pruned = await worktrees.prune([first.id, second.id]);
  assert.deepEqual(pruned.failed, []);
  assert.deepEqual(calls, ['add:t/T-1-claimed', 'add:t/T-2-launched', `remove:${claimed.worktree!.path}`, `remove:${launched.worktree!.path}`]);
  assert.equal(pruned.removed.length, 2);
});

test('post-Git confinement precedes every install read, including an install failure', async t => {
  for (const existing of [false, true]) await t.test(existing ? 'existing branch' : 'new branch', async t => {
    const root = await preparedProject(t);
    const outside = await tempProject(t);
    const env = fixtureEnvironment(root, process.env);
    const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
    const branch = 't/T-1-escape';
    if (existing) await git('branch', branch);
    const parent = join(root, '.cland/worktrees'), path = join(parent, 'T-1');
    const native = localHost(env);
    const proceed = Promise.withResolvers<void>();
    let created = false, installRead = false;
    const host: Host = { ...native, worktreeAdd: async options => {
      await git('worktree', 'add', '--', options.path, options.branch);
      created = true;
      await proceed.promise;
      return native.worktreeAdd({ ...options, reuseOnly: true });
    } };
    const lstat = fs.promises.lstat;
    t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
      if (args[0] === join(path, 'node_modules')) { installRead = true; throw new Error('injected install read failure'); }
      return lstat(...args);
    });
    syncBuiltinESMExports();
    const making = ensureTaskWorktree(root, { id: 'T-1', slug: 'escape', branch: null }, undefined, undefined, env, host).then(() => 'unexpected success', err => String(err));
    try {
      await eventually('native worktree registration completed', () => created || undefined);
      await fs.promises.rename(parent, `${parent}-held`);
      // Move the registered worktree outside before the post-Git continuation.
      await fs.promises.rename(`${parent}-held/T-1`, join(outside, 'T-1'));
      await fs.promises.symlink(outside, parent);
      proceed.resolve();
      assert.match(await making, /created worktree.*confinement|created worktree.*escaped/);
      assert.equal(installRead, false, 'no install read may precede the confinement barrier');
      assert.equal(await git('branch', '--list', branch), existing ? branch : '');
      await assert.rejects(access(join(outside, 'T-1')));
    } finally {
      proceed.resolve();
      await making;
      t.mock.restoreAll(); syncBuiltinESMExports();
    }
  });
});

test('revocation after durable branch creation removes only its captured tip', async t => {
  for (const advanced of [false, true]) await t.test(advanced ? 'concurrent writer kept' : 'unmodified branch removed', async t => {
    const root = await preparedProject(t);
    const env = fixtureEnvironment(root, process.env);
    const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
    const branch = 't/T-1-revoked';
    const proceed = Promise.withResolvers<void>();
    let created = false, revoked = false;
    const execFile = cp.execFile;
    t.mock.method(cp, 'execFile', (file: string, args: string[], options: ExecFileOptionsWithStringEncoding, callback: (err: ExecFileException | null, stdout: string, stderr: string) => void) =>
      // cland-allow-child-env: native Git spy forwards production options unchanged at the durable branch receipt
      execFile(file, args, options, (err, stdout, stderr) => {
        void (async () => {
          if (!err && args[0] === 'branch' && args[1] === '--no-track') { created = true; await proceed.promise; }
          callback(err, stdout, stderr);
        })();
      }));
    syncBuiltinESMExports();
    const making = ensureTaskWorktree(root, { id: 'T-1', slug: 'revoked', branch: null }, undefined, () => { if (revoked) throw new Error('authority revoked'); }, env).then(() => 'unexpected success', err => String(err));
    let writerTip: string | undefined;
    try {
      await eventually('durable branch creation before authorization resumes', () => created || undefined);
      const tip = await git('rev-parse', branch);
      if (advanced) {
        writerTip = await git('commit-tree', await git('rev-parse', `${branch}^{tree}`), '-p', tip, '-m', 'Concurrent writer');
        await git('update-ref', `refs/heads/${branch}`, writerTip, tip);
      }
      revoked = true;
      proceed.resolve();
      assert.match(await making, /authority revoked/);
      assert.equal(await git('branch', '--list', branch), advanced ? branch : '');
      if (advanced) assert.equal(await git('rev-parse', branch), writerTip);
      await assert.rejects(access(join(root, '.cland/worktrees/T-1')));
    } finally {
      proceed.resolve(); await making;
      t.mock.restoreAll(); syncBuiltinESMExports();
    }
  });
});

test('an install failure after confinement retains the registered worktree and branch', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const path = join(root, '.cland/worktrees/T-1');
  const proceed = Promise.withResolvers<void>();
  let installing = false;
  const lstat = fs.promises.lstat;
  t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
    if (args[0] === join(path, 'node_modules')) { installing = true; await proceed.promise; throw new Error('install unavailable'); }
    return lstat(...args);
  });
  syncBuiltinESMExports();
  const making = ensureTaskWorktree(root, { id: 'T-1', slug: 'install-error', branch: null }, undefined, undefined, env).then(() => 'unexpected success', err => String(err));
  try {
    await eventually('install read after native registration', () => installing || undefined);
    assert.equal(await realpath(path), path);
    assert.match(await territoryGitAsync(root, ['worktree', 'list', '--porcelain'], undefined, undefined, env), /refs\/heads\/t\/T-1-install-error/);
    proceed.resolve();
    assert.match(await making, /install unavailable/);
    await access(join(path, '.git'));
    assert.equal(await territoryGitAsync(root, ['branch', '--format=%(refname:short)', '--list', 't/T-1-install-error'], undefined, undefined, env), 't/T-1-install-error');
  } finally {
    proceed.resolve(); await making;
    t.mock.restoreAll(); syncBuiltinESMExports();
  }
});

test('Host occupants govern list and prune even with a different recorded cwd', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  t.after(() => tracker.stop());
  const item = await tracker.create(human, { title: 'Occupied', kind: 'task' });
  const native = localHost(env);
  const calls: Array<{ path: string; sessions: readonly { name: string; cwd: string }[] }> = [];
  const sessions = [{ name: 'remote-worker', cwd: '/host-only/alias' }];
  let removed = false;
  const host: Host = { ...native,
    occupants: async (path, candidates) => { calls.push({ path, sessions: candidates }); return ['remote-worker']; },
    worktreeRemove: async () => { removed = true; },
  };
  const worktrees = new TaskWorktrees({ tracker, env, host, sessions: () => sessions });
  const tree = (await worktrees.afterClaim(item.id, null)).worktree!;
  await tracker.close(human, item.id);
  assert.deepEqual((await worktrees.list())[0]!.sessions, ['remote-worker']);
  const result = await worktrees.prune([item.id]);
  assert.match(result.failed[0]!.error, /remote-worker still stands inside/);
  assert.equal(removed, false);
  assert.ok(calls.length >= 2);
  assert.deepEqual(calls[0], { path: tree.path, sessions });
  await access(tree.path);
});

test('prune rechecks Host occupants at both locked admission and the last pre-Git boundary', async t => {
  for (const boundary of [2, 4]) await t.test(`occupant appears at check ${boundary}`, async t => {
    const root = await preparedProject(t);
    const env = fixtureEnvironment(root, process.env);
    const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
    t.after(() => tracker.stop());
    const item = await tracker.create(human, { title: 'Late occupant', kind: 'task' });
    const native = localHost(env);
    let checks = 0, removed = false;
    const host: Host = { ...native,
      occupants: async () => ++checks >= boundary ? ['late-worker'] : [],
      worktreeRemove: async options => { removed = true; await native.worktreeRemove(options); },
    };
    const worktrees = new TaskWorktrees({ tracker, env, host, sessions: () => [{ name: 'late-worker', cwd: '/host-only/cwd' }] });
    const tree = (await worktrees.afterClaim(item.id, null)).worktree!;
    await tracker.close(human, item.id);
    const result = await worktrees.prune([item.id]);
    assert.match(result.failed[0]!.error, /late-worker now stands inside/);
    assert.equal(checks, boundary);
    assert.equal(removed, false);
    await access(tree.path);
  });
});

test('prune retains a directory when the Host reports a changed worktree or session identity', async t => {
  for (const target of ['worktree', 'session']) await t.test(target, async t => {
    const root = await preparedProject(t);
    const env = fixtureEnvironment(root, process.env);
    const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
    t.after(() => tracker.stop());
    const item = await tracker.create(human, { title: 'Host identity', kind: 'task' });
    const native = localHost(env);
    const cwd = '/host-only/session';
    const stats: string[] = [], paths: string[] = [];
    let checks = 0, removed = false;
    const host: Host = { ...native,
      occupants: async () => { checks++; return []; },
      realpath: async path => { paths.push(path); return path; },
      statDirectory: async path => {
        stats.push(path);
        const changed = checks >= 3 && (target === 'session' ? path === cwd : path !== cwd);
        return { refusal: null, identity: { dev: 42, ino: changed ? 2 : 1 } };
      },
      worktreeRemove: async options => { removed = true; await native.worktreeRemove(options); },
    };
    const worktrees = new TaskWorktrees({ tracker, env, host, sessions: () => [{ name: 'worker', cwd }] });
    const tree = (await worktrees.afterClaim(item.id, null)).worktree!;
    await tracker.close(human, item.id);
    const result = await worktrees.prune([item.id]);
    assert.equal(result.removed.length, 0);
    assert.match(result.failed[0]!.error, target === 'session' ? /session path identity changed/ : /worktree identity or containment changed/);
    assert.equal(removed, false);
    for (const path of [cwd, tree.path]) { assert.ok(stats.includes(path)); assert.ok(paths.includes(path)); }
    await access(tree.path);
  });
});
