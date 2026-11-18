// T3: native Git worktree creation/removal through a recording Host, including territory lock exclusion.
import { connect } from 'node:net';
import { once } from 'node:events';
import { startGitDaemon } from '../src/host/git-daemon.ts';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import fs from 'node:fs';
import cp, { type ExecFileException, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localHost } from '../src/host/local.ts';
import { recordingHost } from './recording-host.ts';
import type { Host } from '../src/host/host.ts';
import { ensureTaskWorktree, removeTaskWorktree, withTerritoryLockAsync, territoryGitAsync, territoryPath } from '../src/territory.ts';
import { territoryLockHeld } from '../src/territory-lock-context.ts';
import { branchLeasePath, grantBranchLease, grantBranchLeaseLocked } from '../src/host/branch-leases.ts';
import { pruneHostTaskWorktree, addHostTaskWorktree, relaunchHostTaskWorktree, type HostWorktreeRecord } from '../src/host/task-worktrees.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { Store } from '../src/hub/store.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { fakeHarness } from './fakes/harness.ts';
import { preparedProject } from './prepared-project.ts';
import { eventually, tempProject, testWaitMs } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

// Exact behaviour bound for the simulated receive admission in lock-cycle regressions.
const RECEIVE_JOIN_BOUND_MS = 100;
const human = { id: 'human', name: 'human', role: null };
function recordingWorktreeHost(root: string, env: NodeJS.ProcessEnv): Host {
  const native = localHost(env);
  return recordingHost(root, {overrides: {
    run: native.run, worktreeAdd: native.worktreeAdd, worktreeRemove: native.worktreeRemove,
    occupants: native.occupants,
  }});
}
function recording(root: string, env: NodeJS.ProcessEnv) {
  const native = recordingWorktreeHost(root, env);
  const calls: string[] = [];
  const held = async () => assert.rejects(withTerritoryLockAsync(root, async () => {}), /another territory operation holds the lock/);
  const host: Host = { ...recordingHost(root),
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
  const sessions = new Sessions({ root, core, table, env, hosts: [host] });
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
    const native = recordingWorktreeHost(root, env);
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
          if (!err && options.cwd === root && args[0] === 'branch' && args[1] === '--no-track') { created = true; await proceed.promise; }
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
  const native = recordingWorktreeHost(root, env);
  const calls: Array<{ path: string; sessions: readonly { name: string; cwd: string }[] }> = [];
  const sessions = [{ name: 'remote-worker', cwd: '/host-only/alias' }];
  let removed = false;
  const host: Host = { ...native,
    realpath: async path => path === sessions[0]!.cwd ? path : native.realpath(path),
    statDirectory: async path => path === sessions[0]!.cwd ? {refusal: null, identity: null} : native.statDirectory(path),
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
    const native = recordingWorktreeHost(root, env);
    let checks = 0, removed = false;
    const host: Host = { ...native,
      realpath: async path => path === '/host-only/cwd' ? path : native.realpath(path),
      statDirectory: async path => path === '/host-only/cwd' ? {refusal: null, identity: null} : native.statDirectory(path),
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
    const native = recordingWorktreeHost(root, env);
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

test('host prune joins a pending territory push outside the lock before deleting its record', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const native = recordingWorktreeHost(root, env);
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'cycle', branch: null }, undefined, undefined, env);
  const tip = await territoryGitAsync(root, ['rev-parse', tree.branch], false, undefined, env);
  const row = { item: 'T-1', host: native.name, root, path: tree.path, branch: tree.branch, tip, createdBranch: true };
  let rows: HostWorktreeRecord[] = [row]; let joined = false, validations = 0;
  const store = { hostWorktrees: () => rows, saveHostWorktree: (value: HostWorktreeRecord) => { rows = [value]; }, deleteHostWorktree: () => { assert.equal(joined, true); rows = []; } };
  const host = { ...native, worktreeRemove: async (options: Parameters<Host['worktreeRemove']>[0]) => {
    // Agent removal joins an admitted receive: it must be able to take territory.lock.
    await withTerritoryLockAsync(root, async () => { joined = true; }, undefined, RECEIVE_JOIN_BOUND_MS);
    await native.worktreeRemove(options);
  } };
  await pruneHostTaskWorktree({ project: root, row, host, store, env, validate: async () => { validations++; } });
  assert.equal(joined, true);
  assert.ok(validations >= 2, 'prune revalidates after joining outside the lock');
  assert.deepEqual(rows, []);
  assert.equal(await native.fileType(tree.path), 'missing');
});

for (const operation of ['add', 'relaunch'] as const) test(`host ${operation} watch registration can join a pending territory receive without holding its lock`, async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env);
  const native = recordingWorktreeHost(root, env), branch = 't/T-1-watch-cycle';
  const tip = await territoryGitAsync(root, ['rev-parse', 'HEAD'], false, undefined, env);
  let rows: HostWorktreeRecord[] = [];
  if (operation === 'relaunch') {
    await territoryGitAsync(territoryPath(root), ['branch', branch, tip], false, undefined, env);
    rows = [{ item: 'T-1', host: 'source', root, path: join(root, 'source'), branch, tip, phase: 'ready' }];
  }
  const store = { hostWorktrees: () => rows, saveHostWorktree: (row: HostWorktreeRecord) => { rows = [row]; }, deleteHostWorktree: () => { rows = []; } };
  let joined = false;
  const host = { ...native, name: 'destination', worktreeAdd: async () => {
    await withTerritoryLockAsync(root, async () => { joined = true; }, undefined, RECEIVE_JOIN_BOUND_MS);
    return {};
  } };
  const common = { project: root, root, host, item: 'T-1', store, env, authorize: () => {} };
  if (operation === 'add') await addHostTaskWorktree({ ...common, branch });
  else await relaunchHostTaskWorktree({ ...common, from: 'source' });
  assert.equal(joined, true);
  assert.equal(rows[0]?.host, 'destination');
  assert.equal(rows[0]?.phase, operation === 'add' ? 'ready' : 'adding');
});

for (const change of ['row', 'tip', 'lease'] as const) test(`host prune retains changed ${change} state after its unlocked removal window`, async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env);
  const native = recordingWorktreeHost(root, env);
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'changed', branch: null }, undefined, undefined, env);
  const tip = await territoryGitAsync(root, ['rev-parse', tree.branch], false, undefined, env);
  const row: HostWorktreeRecord = { item: 'T-1', host: native.name, root, path: tree.path, branch: tree.branch, tip, createdBranch: true, phase: 'ready' };
  let rows = [row], after: HostWorktreeRecord | undefined, movedTip = tip;
  const store = { hostWorktrees: () => rows, saveHostWorktree: (value: HostWorktreeRecord) => { rows = [value]; }, deleteHostWorktree: () => { assert.fail('changed state must not be deleted'); } };
  const host = { ...native, worktreeRemove: async (options: Parameters<Host['worktreeRemove']>[0]) => {
    assert.equal(rows[0]?.phase, 'removing');
    // Even direct concurrent callers cannot reuse the half-removed checkout.
    const common = { project: root, root, host: native, item: row.item, store, env, authorize: () => {} };
    await assert.rejects(addHostTaskWorktree({ ...common, branch: row.branch }), /needs reconciliation/);
    await assert.rejects(relaunchHostTaskWorktree({ ...common, from: native.name }), /needs reconciliation/);
    await native.worktreeRemove(options);
    await withTerritoryLockAsync(root, async () => {
      if (change === 'row') store.saveHostWorktree({ ...rows[0]!, host: 'replacement' });
      if (change === 'lease') await grantBranchLeaseLocked(root, 'replacement', row.branch);
      if (change === 'tip') {
        const treeId = await territoryGitAsync(root, ['rev-parse', 'HEAD^{tree}'], false, undefined, env);
        movedTip = await territoryGitAsync(root, ['commit-tree', treeId, '-p', tip, '-m', 'concurrent published tip'], false, undefined, env);
        await territoryGitAsync(territoryPath(root), ['fetch', '--no-auto-maintenance', root, movedTip], false, undefined, env);
        await territoryGitAsync(territoryPath(root), ['update-ref', `refs/heads/${row.branch}`, movedTip, tip], false, undefined, env);
      }
      after = structuredClone(rows[0]);
    });
  } };
  await assert.rejects(pruneHostTaskWorktree({ project: root, row, host, store, env, validate: async () => {} }), /host-prune-changed:.*(?:row changed|branch moved|lease changed)/);
  assert.deepEqual(rows, [after]);
  assert.equal(await territoryGitAsync(territoryPath(root), ['rev-parse', row.branch], false, undefined, env), movedTip);
  if (change === 'lease') assert.match(await readFile(branchLeasePath(root), 'utf8'), /replacement/);
});

async function admittedReceive(t: test.TestContext, root: string, env: NodeJS.ProcessEnv, label: string) {
  const socket = fixtureSocketPath(root, label);
  const daemon = await startGitDaemon({ host: label, socket, territory: territoryPath(root), env, log: () => {} });
  let client: ReturnType<typeof connect> | undefined, closed = Promise.resolve();
  onCleanup(t, async () => { client?.destroy(); await closed; await daemon.close(); });
  client = connect({ path: socket, allowHalfOpen: true });
  client.on('error', () => {});
  closed = new Promise<void>(done => client!.once('close', () => done()));
  const advertised = once(client, 'data', { signal: AbortSignal.timeout(testWaitMs(5_000)) });
  const body = 'git-receive-pack /territory.git\0host=territory\0';
  client.write(Buffer.from((Buffer.byteLength(body) + 4).toString(16).padStart(4, '0') + body));
  await advertised;
  return client;
}

test('host prune preflight waits for an admitted receive to release its territory lock', async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env);
  const native = recordingWorktreeHost(root, env);
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'preflight', branch: null }, undefined, undefined, env);
  const tip = await territoryGitAsync(root, ['rev-parse', tree.branch], false, undefined, env);
  const row: HostWorktreeRecord = { item: 'T-1', host: native.name, root, path: tree.path, branch: tree.branch, tip, createdBranch: true };
  let rows = [row];
  const store = { hostWorktrees: () => rows, saveHostWorktree: (value: HostWorktreeRecord) => { rows = [value]; }, deleteHostWorktree: () => { rows = []; } };
  let pending: Promise<void> | undefined;
  beforeDirectories(t, async () => { await pending?.catch(() => {}); });
  const client = await admittedReceive(t, root, env, 'prune-receive');
  const promises = (await import('node:fs/promises')).default, read = promises.readFile.bind(promises);
  let observed = false;
  t.mock.method(promises, 'readFile', async (...args: Parameters<typeof promises.readFile>) => {
    const result = await read(...args);
    if (args[0] === join(root, '.cland/territory.lock')) { observed = true; client.end(); }
    return result;
  });
  pending = pruneHostTaskWorktree({ project: root, row, host: native, store, env, validate: async () => {} });
  await pending;
  assert.equal(observed, true, 'preflight observed the admitted receive before its native close/release');
  assert.deepEqual(rows, []);
  assert.equal(await native.fileType(tree.path), 'missing');
});

for (const operation of ['add', 'relaunch', 'prune'] as const) test(`host ${operation} rejects a caller already holding its territory lock`, async t => {
  const root = await tempProject(t), env = fixtureEnvironment(root, process.env), host = localHost(env);
  const store = { hostWorktrees: (): HostWorktreeRecord[] => { assert.fail('nested caller must refuse before observing checkout state'); }, saveHostWorktree: () => { assert.fail('must not write'); }, deleteHostWorktree: () => { assert.fail('must not delete'); } };
  const row: HostWorktreeRecord = { item: 'T-1', host: host.name, root, path: join(root, 'tree'), branch: 't/T-1-nested', tip: '0'.repeat(40) };
  await withTerritoryLockAsync(root, async () => {
    const common = { project: root, root, host, item: row.item, store, env, authorize: () => {} };
    const work = operation === 'add' ? addHostTaskWorktree({ ...common, branch: row.branch })
      : operation === 'relaunch' ? relaunchHostTaskWorktree({ ...common, from: host.name })
      : pruneHostTaskWorktree({ project: root, row, host, store, env, validate: async () => {} });
    await assert.rejects(work, /host-worktree-lock-order: checkout requires an unlocked caller/);
    assert.equal(territoryLockHeld(root), true, 'the original owner remains active after refusal');
  });
});

test('host prune retains its branch and row when the item reopens during final occupants observation', async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  const store = new Store(join(root, '.cland/hub.db'));
  const release = Promise.withResolvers<void>();
  let pending: ReturnType<TaskWorktrees['prune']> | undefined;
  beforeDirectories(t, async () => { release.resolve(); await pending?.catch(() => {}); await tracker.stop(); store.close(); });
  const item = await tracker.create(human, { title: 'reopen during prune', kind: 'task' });
  const tree = await ensureTaskWorktree(root, { id: item.id, slug: 'reopen', branch: null }, undefined, undefined, env);
  const tip = await territoryGitAsync(root, ['rev-parse', tree.branch], false, undefined, env);
  const native = recordingWorktreeHost(root, env);
  let removed = false, held = false;
  const host = { ...native, name: 'remote', worktreeRemove: async (options: Parameters<Host['worktreeRemove']>[0]) => { await native.worktreeRemove(options); removed = true; }, occupants: async () => { if (removed && !held) { held = true; await release.promise; } return []; } };
  store.hosts.insert({ id: host.name, address: 'fixture', user: 'agent', clientKeyPath: 'unused', knownHosts: 'unused' }, 'synthetic');
  store.saveHostWorktree({ item: item.id, host: host.name, root, path: tree.path, branch: tree.branch, tip, createdBranch: true, phase: 'ready' });
  await grantBranchLease(root, host.name, tree.branch);
  const leases = await readFile(branchLeasePath(root), 'utf8');
  await tracker.close(human, item.id);
  const worktrees = new TaskWorktrees({ tracker, store, resolveHost: () => host, env });
  pending = worktrees.prune([item.id]);
  await eventually('final occupants observation held after native removal', () => held || undefined, testWaitMs(5_000));
  await tracker.edit(human, item.id, { state: 'open' });
  release.resolve();
  const result = await pending;
  assert.deepEqual(result.removed, []);
  assert.match(result.failed[0]?.error ?? '', /host-prune-changed:.*no longer prunable/);
  assert.equal(tracker.summary(item.id)?.state, 'open');
  assert.equal(store.hostWorktrees()[0]?.phase, 'removing');
  assert.equal(await territoryGitAsync(territoryPath(root), ['rev-parse', tree.branch], false, undefined, env), tip);
  assert.equal(await readFile(branchLeasePath(root), 'utf8'), leases);
});

test('host prune retains replacement ownership arriving during final validation', async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env), native = recordingWorktreeHost(root, env);
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'last-check', branch: null }, undefined, undefined, env);
  const tip = await territoryGitAsync(root, ['rev-parse', tree.branch], false, undefined, env);
  const row: HostWorktreeRecord = { item: 'T-1', host: native.name, root, path: tree.path, branch: tree.branch, tip, createdBranch: true };
  let rows = [row], validations = 0, held = false;
  const store = { hostWorktrees: () => rows, saveHostWorktree: (value: HostWorktreeRecord) => { rows = [value]; }, deleteHostWorktree: () => { rows = []; } };
  const release = Promise.withResolvers<void>();
  let pending: Promise<void> | undefined;
  beforeDirectories(t, async () => { release.resolve(); await pending?.catch(() => {}); });
  pending = pruneHostTaskWorktree({ project: root, row, host: native, store, env, validate: async () => { if (++validations === 2) { held = true; await release.promise; } } });
  await eventually('final validation held', () => held || undefined, testWaitMs(5_000));
  const replacement: HostWorktreeRecord = { ...rows[0]!, host: 'replacement', phase: 'ready' };
  store.saveHostWorktree(replacement);
  release.resolve();
  await assert.rejects(pending, /host-prune-changed:.*row changed/);
  assert.deepEqual(rows, [replacement]);
  assert.equal(await territoryGitAsync(territoryPath(root), ['rev-parse', tree.branch], false, undefined, env), tip);
});

for (const afterWait of ['open', 'closed'] as const) test(`public relaunch admission waits for an admitted receive and refreshes ${afterWait} eligibility`, async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  const store = new Store(join(root, '.cland/hub.db'));
  let pending: Promise<void> | undefined;
  beforeDirectories(t, async () => { await pending?.catch(() => {}); await tracker.stop(); store.close(); });
  const item = await tracker.create(human, { title: 'admission wait', kind: 'task' });
  const host = { ...localHost(env), name: 'destination' };
  store.hosts.insert({ id: host.name, address: 'fixture', user: 'agent', clientKeyPath: 'unused', knownHosts: 'unused' }, 'synthetic');
  const row: HostWorktreeRecord = { item: item.id, host: 'source', root, path: join(root, 'source'), branch: 't/T-1-admit', tip: 'a'.repeat(40), phase: 'ready' };
  store.saveHostWorktree(row);
  const client = await admittedReceive(t, root, env, 'admission-receive');
  const promises = (await import('node:fs/promises')).default, read = promises.readFile.bind(promises);
  let observed = false, admitted = false;
  t.mock.method(promises, 'readFile', async (...args: Parameters<typeof promises.readFile>) => {
    const result = await read(...args);
    if (!observed && args[0] === join(root, '.cland/territory.lock')) {
      observed = true;
      if (afterWait === 'closed') await tracker.close(human, item.id);
      client.end();
    }
    return result;
  });
  const worktrees = new TaskWorktrees({ tracker, store, resolveHost: () => host, env });
  pending = worktrees.admitRelaunch(item.id, 'source', host, () => { admitted = true; });
  if (afterWait === 'open') { await pending; assert.equal(admitted, true); }
  else { await assert.rejects(pending, /requires an open task/); assert.equal(admitted, false); }
  assert.equal(observed, true);
  assert.deepEqual(store.hostWorktrees(), [row]);
});

test('public relaunch admission refuses a nested territory owner before joining its serial queue', async t => {
  const root = await preparedProject(t), env = fixtureEnvironment(root, process.env);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  beforeDirectories(t, () => tracker.stop());
  const worktrees = new TaskWorktrees({ tracker, env });
  const host = localHost(env);
  t.mock.method(tracker, 'viewAsync', async () => { assert.fail('nested admission must refuse before reading eligibility'); });
  await withTerritoryLockAsync(root, async () => {
    await assert.rejects(async () => worktrees.admitRelaunch('T-1', 'source', host, () => assert.fail('must not admit')), /host-worktree-lock-order/);
    assert.equal(territoryLockHeld(root), true);
  });
});
