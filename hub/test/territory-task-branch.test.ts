// T3: native Git refs and linked worktree receipts across the territory/Host boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { preparedProject } from './prepared-project.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { localHost } from '../src/host/local.ts';
import { recordingHost } from './recording-host.ts';
import { ensureTaskWorktree, territoryGitAsync, territoryPath, withTerritoryLockAsync } from '../src/territory.ts';
import { pruneCase, observePruneGit } from './prune-case.ts';

const human = { id: 'human', name: 'human', role: null };
test('local baseline: root task branch, tip, worktree path and journal remain unchanged', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
  const tip = await git('rev-parse', 'dev');
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  t.after(() => tracker.stop());
  const item = await tracker.create(human, { title: 'Baseline', kind: 'task' });
  const records: Record<string, unknown>[] = [];
  const worktrees = new TaskWorktrees({ tracker, env, log: row => records.push(row) });
  const result = await worktrees.afterClaim(item.id, 'worker');
  assert.equal(result.worktree?.branch, 't/T-1-baseline');
  assert.equal(result.worktree?.path, join(root, '.cland/worktrees/T-1'));
  assert.equal(await git('rev-parse', 't/T-1-baseline'), tip);
  assert.equal(await territoryGitAsync(join(root, '.cland/worktrees/T-1'), ['rev-parse', 'HEAD'], undefined, undefined, env), tip);
  assert.deepEqual(records.filter(row => row.event === 'task-worktree'), [{ event: 'task-worktree', id: 'T-1', branch: 't/T-1-baseline', path: '.cland/worktrees/T-1', base: 'dev', createdBranch: true, session: 'worker' }]);
});

test('territory branch exists at territory dev before the launch Host adds its worktree under lock', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const remote = (...args: string[]) => territoryGitAsync(territoryPath(root), args, undefined, undefined, env);
  const tip = await remote('rev-parse', 'dev');
  const native = localHost(env);
  let observed = false;
  const host = { ...recordingHost(root, {overrides: {worktreeRemove: native.worktreeRemove}}), name: 'recording', worktreeAdd: async (options: Parameters<typeof native.worktreeAdd>[0]) => {
    assert.equal(await remote('rev-parse', 'refs/heads/t/T-1-first'), tip);
    await assert.rejects(withTerritoryLockAsync(root, async () => {}), /another territory operation holds the lock/);
    observed = true;
    return native.worktreeAdd(options);
  } };
  await ensureTaskWorktree(root, { id: 'T-1', slug: 'first', branch: null }, undefined, undefined, env, host);
  assert.equal(observed, true);
});

test('existing territory branch supplies its tip, including a root with a different tip', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const remote = (...args: string[]) => territoryGitAsync(territoryPath(root), args, undefined, undefined, env);
  const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
  const tip = await remote('commit-tree', await remote('rev-parse', 'dev^{tree}'), '-p', 'dev', '-m', 'Territory work');
  await remote('branch', 't/T-1-existing', tip);
  await git('branch', 't/T-1-existing', 'dev');
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'existing', branch: null }, undefined, undefined, env);
  assert.equal(await git('rev-parse', 't/T-1-existing'), tip);
  assert.equal(await territoryGitAsync(tree.path, ['rev-parse', 'HEAD'], undefined, undefined, env), tip);
});

test('failed Host add rolls back the newly created territory ref and root branch', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const native = localHost(env);
  const host = { ...recordingHost(root, {overrides: {worktreeRemove: native.worktreeRemove}}), worktreeAdd: async () => { throw new Error('injected add failure'); } };
  await assert.rejects(ensureTaskWorktree(root, { id: 'T-1', slug: 'failed', branch: null }, undefined, undefined, env, host), /injected add failure/);
  for (const cwd of [root, territoryPath(root)]) assert.equal(await territoryGitAsync(cwd, ['branch', '--list', 't/T-1-failed'], undefined, undefined, env), '');
});

test('prune deletes only an unchanged launch-created territory branch', async t => {
  const { removeTaskWorktree } = await import('../src/territory.ts');
  for (const advanced of [false, true]) await t.test(advanced ? 'pushed work kept' : 'unchanged launch ref removed', async t => {
    const root = await preparedProject(t);
    const env = fixtureEnvironment(root, process.env);
    const remote = (...args: string[]) => territoryGitAsync(territoryPath(root), args, undefined, undefined, env);
    await ensureTaskWorktree(root, { id: 'T-1', slug: 'prune', branch: null }, undefined, undefined, env);
    const launchTip = await remote('rev-parse', 't/T-1-prune');
    if (advanced) {
      const tip = await remote('commit-tree', await remote('rev-parse', 'dev^{tree}'), '-p', launchTip, '-m', 'Pushed work');
      await remote('update-ref', 'refs/heads/t/T-1-prune', tip, launchTip);
    }
    await removeTaskWorktree(root, 'T-1', undefined, undefined, undefined, env);
    assert.equal(await remote('branch', '--list', 't/T-1-prune'), advanced ? 't/T-1-prune' : '');
  });
});

test('root-only branches keep their tip and do not create a territory ref', async t => {
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
  const tip = await git('commit-tree', await git('rev-parse', 'dev^{tree}'), '-p', 'dev', '-m', 'Local work');
  await git('branch', 't/T-1-root', tip);
  const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'root', branch: null }, undefined, undefined, env);
  assert.equal(await territoryGitAsync(tree.path, ['rev-parse', 'HEAD'], undefined, undefined, env), tip);
  assert.equal(await territoryGitAsync(territoryPath(root), ['branch', '--list', 't/T-1-root'], undefined, undefined, env), '');
});


test('divergent dev tips: local starts at root and nonlocal starts at territory', async t => {
  for (const name of ['local', 'recording']) await t.test(name, async t => {
    const root = await preparedProject(t);
    const env = fixtureEnvironment(root, process.env);
    const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
    const remoteTip = await territoryGitAsync(territoryPath(root), ['rev-parse', 'dev'], undefined, undefined, env);
    await git('commit', '--allow-empty', '-m', 'Unpublished root work');
    const rootTip = await git('rev-parse', 'dev');
    assert.notEqual(rootTip, remoteTip);
    const native = localHost(env);
    const expected = name === 'local' ? rootTip : remoteTip;
    const host = { ...recordingHost(root, {overrides: {worktreeRemove: native.worktreeRemove}}), name, worktreeAdd: async (options: Parameters<typeof native.worktreeAdd>[0]) => {
      assert.equal(await territoryGitAsync(territoryPath(root), ['rev-parse', 't/T-1-divergent'], undefined, undefined, env), expected);
      return native.worktreeAdd(options);
    } };
    const tree = await ensureTaskWorktree(root, { id: 'T-1', slug: 'divergent', branch: null }, undefined, undefined, env, host);
    assert.equal(await territoryGitAsync(tree.path, ['rev-parse', 'HEAD'], undefined, undefined, env), expected);
  });
});

test('item launch calls the admitted Host rather than the worktree service default', async t => {
  const { Sessions } = await import('../src/adapters/sessions.ts');
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const { HubCore } = await import('../src/hub/core.ts');
  const { fakeHarness } = await import('./fakes/harness.ts');
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const native = localHost(env);
  let called = false;
  const host = { ...recordingHost(root, {overrides: {worktreeRemove: native.worktreeRemove}}), name: 'recording', worktreeAdd: async (options: Parameters<typeof native.worktreeAdd>[0]) => {
    assert.equal(await territoryGitAsync(territoryPath(root), ['rev-parse', 't/T-1-launch'], undefined, undefined, env), await territoryGitAsync(territoryPath(root), ['rev-parse', 'dev'], undefined, undefined, env));
    called = true;
    return native.worktreeAdd(options);
  } };
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), env });
  const core = new HubCore();
  const table = new ProcessTable(':memory:', core.clock);
  const sessions = new Sessions({ root, core, table, env, hosts: [host] });
  sessions.register(fakeHarness('codex', { clock: core.clock }));
  t.after(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); await tracker.stop(); });
  const item = await tracker.create(human, { title: 'Launch', kind: 'task' });
  const worktrees = new TaskWorktrees({ tracker, env });
  const result = await worktrees.launch(sessions, { name: 'worker', role: 'implementer', harness: 'codex', item: item.id, host: 'recording' });
  assert.equal(called, true);
  assert.equal(result.process.cwd, join(root, '.cland/worktrees/T-1'));
});

test('a concurrent territory ref is never adopted or assigned launch provenance', async t => {
  for (const sameTip of [false, true]) await t.test(sameTip ? 'equal tip' : 'ancestor tip', t => pruneCase(t, async (scope, step) => {
    const { eventually } = await import('./harness.ts');
    const proceed = Promise.withResolvers<void>();
    scope.releaseOnClose(() => proceed.resolve());
    let root = '', held = false;
    observePruneGit(scope, async ([cwd, args], run) => {
      if (root && cwd === root && args[0] === 'push' && args.at(-1)?.includes('refs/heads/t/T-1-raced')) {
        held = true;
        await proceed.promise;
      }
      return run();
    });
    root = await step('prepared disposable project', () => preparedProject(scope.fixtures)); scope.adoptRoot(root);
    const env = fixtureEnvironment(root, process.env);
    const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
    const remote = (...args: string[]) => territoryGitAsync(territoryPath(root), args, undefined, undefined, env);
    const ancestor = await git('rev-parse', 'dev');
    await git('commit', '--allow-empty', '-m', 'Root work');
    const tip = sameTip ? await git('rev-parse', 'dev') : ancestor;
    // Transfer the writer's object without creating our target branch.
    await git('push', territoryPath(root), `${tip}:refs/heads/t/T-9-writer`);
    const making = scope.wait('original worktree creation', () => ensureTaskWorktree(root, { id: 'T-1', slug: 'raced', branch: null }, undefined, undefined, env).then(() => 'unexpected success', error => String(error)), 30_000);
    try {
      await eventually('publication held before native push', () => held || undefined);
      assert.equal(held, true, 'the pre-publication admission hold engaged');
      await remote('branch', 't/T-1-raced', tip);
      await remote('config', 'branch.t/T-1-raced.clandLaunchBase', 'writer-owned');
      proceed.resolve();
      assert.notEqual(await making, 'unexpected success');
      assert.equal(await remote('rev-parse', 't/T-1-raced'), tip);
      assert.equal(await remote('config', 'branch.t/T-1-raced.clandLaunchBase'), 'writer-owned');
      assert.equal(await git('branch', '--list', 't/T-1-raced'), '');
    } finally {
      proceed.resolve(); await making;
    }
  }, true));
});

test('Host checkout uses its own fetched tip when another fetch replaces FETCH_HEAD', async t => {
  const { default: cp } = await import('node:child_process');
  const { syncBuiltinESMExports } = await import('node:module');
  const { eventually } = await import('./harness.ts');
  const root = await preparedProject(t);
  const env = fixtureEnvironment(root, process.env);
  const remote = (...args: string[]) => territoryGitAsync(territoryPath(root), args, undefined, undefined, env);
  const git = (...args: string[]) => territoryGitAsync(root, args, undefined, undefined, env);
  const tip = await remote('rev-parse', 'dev');
  await remote('branch', 't/T-1-pinned', tip);
  const other = await remote('commit-tree', await remote('rev-parse', 'dev^{tree}'), '-p', tip, '-m', 'Unrelated fetch');
  await remote('branch', 't/T-9-other', other);
  const proceed = Promise.withResolvers<void>();
  let held = false;
  const spawn = cp.spawn;
  t.mock.method(cp, 'spawn', (file: string, args: readonly string[], options: import('node:child_process').SpawnOptions) => {
    // cland-allow-child-env: the native spy forwards Host options unchanged and holds only its native-close notification
    const child = spawn(file, args, options);
    if (file === 'git' && args.includes('fetch')) {
      const emit = child.emit.bind(child);
      child.emit = (event: string, ...values: unknown[]) => {
        if (event === 'close' && !held) {
          held = true;
          void proceed.promise.then(() => emit(event, ...values));
          return true;
        }
        return emit(event, ...values);
      };
    }
    return child;
  });
  syncBuiltinESMExports();
  const making = ensureTaskWorktree(root, { id: 'T-1', slug: 'pinned', branch: null }, undefined, undefined, env).then(value => ({ value, error: null }), error => ({ value: null, error }));
  try {
    await eventually('Host fetch completed before ref selection', () => held || undefined);
    await git('fetch', '--no-auto-maintenance', '--no-tags', territoryPath(root), 'refs/heads/t/T-9-other');
    assert.equal(await git('rev-parse', 'FETCH_HEAD'), other);
    proceed.resolve();
    const result = await making;
    assert.equal(result.error, null);
    assert.equal(await git('rev-parse', 't/T-1-pinned'), tip);
    assert.equal(await territoryGitAsync(result.value!.path, ['rev-parse', 'HEAD'], undefined, undefined, env), tip);
  } finally {
    proceed.resolve(); await making;
    t.mock.restoreAll(); syncBuiltinESMExports();
  }
});
