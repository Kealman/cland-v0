// T-77 extends T-70/T-75 at the native boundary: tracker reads/mutations, serving-time scans,
// and the shared Sessions launch layer. T-78 covers territory requests; native adapters remain T-79.
import { onCleanup } from './process-cleanup.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp, { type ExecFileException, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { WebSocket } from 'ws';
import { join } from 'node:path';
import { Tracker, type TrackerFiles } from '../src/tracker/tracker.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessAdapter } from '../src/adapters/contract.ts';
import { connectWsUi, eventually, frameClient, startHub, tempProject, TEST_SECRET } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { removeTaskWorktree, territoryGitAsync } from '../src/territory.ts';
import { fixedRoles } from '../src/roles/config.ts';

async function territoryHub(t: TestContext, log?: (entry: Record<string, unknown>) => void, files?: TrackerFiles) {
  const root = await tempProject(t, 'cland-territory-native-');
  const git = (...args: string[]) => territoryGitAsync(root, args);
  await copyPreparedProject(root, 'native-territory');
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), ...(files ? { files } : {}) });
  const hub = await startHub({ tracker, roles: fixedRoles(), ...(log ? { log } : {}) });
  onCleanup(t, () => hub.close());
  onCleanup(t, () => tracker.stop());
  const ui = await connectWsUi(t, hub);
  return { root, tracker, ui, git, hub };
}

async function guarded(work: () => Promise<void>): Promise<void> {
  const savedFs = Object.fromEntries(Object.entries(fs).filter(([key, value]) => key.endsWith('Sync') && typeof value === 'function'));
  const savedCp = { spawnSync: cp.spawnSync, execFileSync: cp.execFileSync, execSync: cp.execSync };
  const calls: string[] = [];
  try {
    for (const [native, saved] of [[fs, savedFs], [cp, savedCp]] as const) {
      for (const key of Object.keys(saved)) Object.assign(native, { [key]: () => { calls.push(key); throw new Error(`synchronous ${key} on guarded path`); } });
    }
    syncBuiltinESMExports();
    await work();
    assert.deepEqual(calls, [], 'no synchronous native call, even when its error was caught');
  } finally { Object.assign(fs, savedFs); Object.assign(cp, savedCp); syncBuiltinESMExports(); }
}

test('hub tracker mutations, reads, scans, and shared launches use no synchronous filesystem or process call', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  const previousWatch = process.env.CLAND_TEST_WATCH_REFUSED;
  process.env.CLAND_TEST_WATCH_REFUSED = '1';
  try { tracker.start(); } finally {
    if (previousWatch === undefined) delete process.env.CLAND_TEST_WATCH_REFUSED;
    else process.env.CLAND_TEST_WATCH_REFUSED = previousWatch;
  }
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker });
  onCleanup(t, () => hub.close());
  const table = new ProcessTable();
  const sessions = new Sessions({ root, core: hub.core, table });
  onCleanup(t, () => sessions.close()); onCleanup(t, () => table.close());
  const adapter: HarnessAdapter = {
    harness: 'test',
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async r => ({ name: r.name, harness: 'test', role: r.role, model: r.model, cwd: r.cwd, pid: null, pidStarted: null, harnessId: null, sessionId: r.name, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' }),
    attachCommand: () => 'test', watch: () => {}, inject: async () => {}, confirm: () => {}, interpret: () => ({}), stop: async () => {}, resume: async p => ({ found: true, process: p, state: 'idle' }), close: () => {},
  };
  sessions.register(adapter);
  hub.dispatcher.useSessions(sessions);
  const ui = await connectWsUi(t, hub);
  await guarded(async () => {
    for (const frame of [
      { type: 'task.create', title: 'First', kind: 'spec' },
      { type: 'task.create', title: 'Second', kind: 'epic' },
      { type: 'task.create', title: 'Release', kind: 'release', version: '0.1.0' },
      { type: 'task.link', item: 'T-2', parent: 'T-3' },
      { type: 'task.rank', item: 'T-2', top: true },
      { type: 'task.list', under: 'T-3' },
      { type: 'task.view', item: 'T-1' },
      { type: 'task.edit', item: 'T-1', body: 'edited' },
      { type: 'task.link', item: 'T-1', parent: 'T-2' },
      { type: 'task.comment', item: 'T-1', text: 'plain' },
      { type: 'task.comment', item: 'T-1', text: 'checked', verdict: { verdict: 'review', result: 'clear', run: 'native-run' } },
      { type: 'task.claim', item: 'T-1' },
      { type: 'topic.create', title: 'Bound', item: 'T-1' },
      { type: 'session.launch', name: 'plain', harness: 'test' },
      { type: 'session.launch', name: 'impl', harness: 'test', role: 'implementer', item: 'T-1' },
      { type: 'task.close', item: 'T-1', comment: 'done' },
      { type: 'task.import', repo: 'test/project', issues: [{ number: 1, url: 'https://example.com/1', title: 'Imported', body: '', labels: [], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' }] },
    ]) {
      const result = await ui.request(frame);
      assert.equal(result.ok, true, `${frame.type}: ${String(result.error)}`);
    }
    const refused = await ui.request({ type: 'session.launch', name: 'missing', harness: 'test', cwd: join(root, 'absent') });
    assert.equal(refused.ok, false);
    await tracker.rescanAsync();
    await new Promise(done => setTimeout(done, 550)); // fallback polling also runs inside the native guard
  });
});

test('the guard rejects a planted native statSync even if a request swallows its error', async () => {
  await assert.rejects(guarded(async () => {
    try { fs.statSync('.'); } catch { /* catches cannot hide native calls */ }
  }), /no synchronous native call/);
});

test('worktree claim, listing and prune cross no synchronous native boundary', async t => {
  const { ui } = await territoryHub(t);
  await guarded(async () => {
    for (const frame of [
      { size: 'M', type: 'task.create', title: 'Prune me', kind: 'task' },
      { type: 'task.claim', item: 'T-1' },
      { type: 'worktree.list' },
      { type: 'task.close', item: 'T-1' },
      { type: 'worktree.prune', items: ['T-1'] },
    ]) {
      const result = await ui.request(frame, 30_000);
      assert.equal(result.ok, true, `${frame.type}: ${String(result.error)}`);
      if (frame.type === 'task.claim') assert.ok((result.value as { worktree?: unknown }).worktree);
      if (frame.type === 'worktree.prune') assert.deepEqual((result.value as { failed: unknown[] }).failed, []);
    }
  });
});

test('merge refusal, landing and recovery cross no synchronous native boundary', async t => {
  const { ui, root, git, tracker } = await territoryHub(t);
  await ui.request({ size: 'M', type: 'task.create', title: 'Ship it', kind: 'task' });
  await ui.request({ type: 'task.claim', item: 'T-1' });
  const view = await tracker.viewAsync('T-1');
  const path = join(root, '.cland', 'worktrees', 'T-1');
  await fs.promises.writeFile(join(path, 'shipped.txt'), 'shipped\n');
  await territoryGitAsync(path, ['add', '.']);
  await territoryGitAsync(path, ['commit', '-qm', 'Ship']);
  // Keep completion pending once so retry exercises the receipt path without another squash.
  const obstruction = join(root, '.cland', 'tasks', `.${view.file}.${process.pid}.tmp`);
  await fs.promises.mkdir(obstruction);
  await guarded(async () => {
    const refused = await ui.request({ type: 'merge', item: 'T-1' }, 30_000);
    assert.equal(refused.ok, false);
    assert.equal((refused as { code?: string }).code, 'review-missing');
    const first = await ui.request({ type: 'merge', item: 'T-1', override: 'native fixture' }, 30_000);
    assert.equal(first.ok, true, first.error);
    const landed = first.value as { commit: string; followUp?: { step: string } };
    assert.equal(landed.followUp?.step, 'close');
    await fs.promises.rm(obstruction, { recursive: true });
    const retry = await ui.request({ type: 'merge', item: 'T-1' }, 30_000);
    assert.equal(retry.ok, true, retry.error);
    assert.equal((retry.value as { commit: string }).commit, landed.commit);
    assert.equal((retry.value as { followUp?: unknown }).followUp, undefined);
    assert.equal(await git('rev-parse', 'dev'), landed.commit);
  });
});

test('release notes, publication and sync cross no synchronous native boundary', async t => {
  const { ui, root, git, tracker } = await territoryHub(t);
  const github = await tempProject(t, 'cland-native-github-');
  await git('clone', '-q', '--bare', '.', github);
  await git('remote', 'add', 'github', github);
  await tracker.create({ id: 'human', name: 'human', role: null }, { title: 'A tracker title', kind: 'task' });
  await git('commit', '--allow-empty', '-qm', 'A different subject\n\nItem: T-1');
  await git('commit', '--allow-empty', '-qm', 'A removed item\n\nItem: T-42');
  await guarded(async () => {
    const preview = await ui.request({ type: 'release', version: 'v0.1.0', dryRun: true }, 30_000);
    assert.equal(preview.ok, true, preview.error);
    assert.equal((preview.value as { notes: string }).notes, 'T-1 A tracker title\nT-42 A removed item');
    const released = await ui.request({ type: 'release', version: 'v0.1.0' }, 30_000);
    assert.equal(released.ok, true, released.error);
    assert.equal((released.value as { followUp?: unknown }).followUp, undefined);
    // A receipt makes sync re-read an item before deciding whether recovery is pending.
    const tip = await git('rev-parse', 'dev');
    tracker.recordMerge('T-1', { commit: tip, base: 'dev', branch: 't/T-1', tip });
    // Publish tracker files so sync has a clean root, as the product requires.
    await git('add', '-f', '.cland/tasks');
    await git('commit', '-qm', 'Tracker');
    const synced = await ui.request({ type: 'sync' }, 30_000);
    assert.equal(synced.ok, true, synced.error);
    assert.equal((synced.value as { followUp?: unknown }).followUp, undefined);
  });
});

test('each territory request guard rejects a planted statSync on its request path', async t => {
  for (const type of ['worktree', 'merge', 'release']) await t.test(type, async t => {
    let plant = false;
    const event = type === 'worktree' ? 'task-worktree' : type === 'merge' ? 'task-merged' : 'release-preview';
    const { ui, root, git } = await territoryHub(t, entry => {
      if (plant && entry.event === event) {
        try { fs.statSync(root); } catch { /* the guard still records a swallowed native call */ }
      }
    });
    await ui.request({ size: 'M', type: 'task.create', title: 'Native probe', kind: 'task' });
    if (type !== 'worktree') {
      await ui.request({ type: 'task.claim', item: 'T-1' });
      const path = join(root, '.cland', 'worktrees', 'T-1');
      await territoryGitAsync(path, ['commit', '--allow-empty', '-qm', 'Native probe']);
    }
    if (type === 'release') {
      const github = await tempProject(t, 'cland-native-plant-github-');
      await git('clone', '-q', '--bare', '.', github);
      await git('remote', 'add', 'github', github);
      await git('commit', '--allow-empty', '-qm', 'Release probe');
    }
    plant = true;
    await assert.rejects(guarded(async () => {
      await ui.request(type === 'worktree' ? { type: 'task.claim', item: 'T-1' }
        : type === 'merge' ? { type: 'merge', item: 'T-1', override: 'native probe' }
        : { type: 'release', version: 'v0.1.0', dryRun: true }, 30_000);
    }), /no synchronous native call/);
  });
});

test('a parent swapped to a symlink during the initial path check refuses worktree creation', async t => {
  const { root, ui, git } = await territoryHub(t);
  const outside = await tempProject(t, 'cland-worktree-escape-');
  const parent = join(root, '.cland', 'worktrees');
  const path = join(parent, 'T-1');
  await fs.promises.mkdir(parent);
  await ui.request({ size: 'M', type: 'task.create', title: 'Confined', kind: 'task' });
  const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  const lstat = fs.promises.lstat;
  let paused = false;
  t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
    try { return await lstat(...args); }
    catch (err) {
      if (args[0] === path && !paused) { paused = true; reached.resolve(); await proceed.promise; }
      throw err;
    }
  });
  syncBuiltinESMExports();
  onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports()); onCleanup(t, () => proceed.resolve());
  const claiming = ui.request({ type: 'task.claim', item: 'T-1' }, 30_000);
  await reached.promise;
  await fs.promises.rm(parent, { recursive: true });
  await fs.promises.symlink(outside, parent);
  proceed.resolve();
  const result = await claiming;
  assert.equal(result.ok, true, result.error); // worktree failure never undoes the claim
  const outcome = result.value as { worktree: unknown; reason: string };
  assert.equal(outcome.worktree, null);
  assert.match(outcome.reason, /worktree: refusing symlink \.cland\/worktrees/);
  assert.deepEqual(await fs.promises.readdir(outside), []);
  assert.equal(await git('branch', '--list', 't/T-1-confined'), '');
});

test('merge waits for an admitted verdict write and refuses its latest not-clear result', async t => {
  const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  let hold = false;
  onCleanup(t, () => proceed.resolve());
  const { root, ui, tracker, git } = await territoryHub(t, undefined, {
    ...fs.promises,
    rename: async (from, to) => {
      if (hold && String(to).includes('T-1-')) { hold = false; reached.resolve(); await proceed.promise; }
      return fs.promises.rename(from, to);
    },
  });
  await ui.request({ size: 'M', type: 'task.create', title: 'Latest verdict', kind: 'task' });
  await ui.request({ type: 'task.claim', item: 'T-1' });
  await territoryGitAsync(join(root, '.cland', 'worktrees', 'T-1'), ['commit', '--allow-empty', '-qm', 'Reviewed']);
  const reviewer = { id: 'native-reviewer', name: 'rev', role: 'reviewer' };
  await tracker.comment(reviewer, 'T-1', '', { verdict: 'review', result: 'clear', run: 'clear-before-wait' });
  await tracker.refreshFreshness();
  const before = await git('rev-parse', 'dev');
  hold = true;
  const writing = tracker.comment(reviewer, 'T-1', '', { verdict: 'review', result: 'not clear', run: 'not-clear-during-wait' });
  await reached.promise;
  let answered = false;
  const merging = ui.request({ type: 'merge', item: 'T-1' }, 30_000).then(r => { answered = true; return r; });
  await eventually('merge holds territory lock', async () => fs.promises.access(join(root, '.cland', 'territory.lock')).then(() => true, () => undefined));
  assert.equal(answered, false);
  assert.equal(await git('rev-parse', 'dev'), before);
  proceed.resolve();
  await writing;
  const refused = await merging;
  assert.equal(refused.ok, false);
  assert.equal((refused as { code?: string }).code, 'review-not-clear');
  assert.equal(await git('rev-parse', 'dev'), before);
});

test('an item reopened during the final path check keeps its worktree and branch', async t => {
  let watch = false, prepared = false;
  const { root, ui, git } = await territoryHub(t, undefined, {
    ...fs.promises,
    readFile: async (path, encoding) => {
      const text = await fs.promises.readFile(path, encoding);
      if (watch && String(path).includes('T-1-') && await fs.promises.access(join(root, '.cland', 'territory.lock')).then(() => true, () => false)) prepared = true;
      return text;
    },
  });
  await ui.request({ size: 'M', type: 'task.create', title: 'Reopened during path check', kind: 'task' });
  await ui.request({ type: 'task.claim', item: 'T-1' });
  await ui.request({ type: 'task.close', item: 'T-1' });
  const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  const lstat = fs.promises.lstat;
  t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
    const stat = await lstat(...args);
    if (prepared) { prepared = false; watch = false; reached.resolve(); await proceed.promise; }
    return stat;
  });
  syncBuiltinESMExports();
  onCleanup(t, () => proceed.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
  watch = true;
  const pruning = ui.request({ type: 'worktree.prune', items: ['T-1'] }, 30_000);
  await reached.promise;
  const reopened = await ui.request({ type: 'task.edit', item: 'T-1', state: 'open' });
  assert.equal(reopened.ok, true, reopened.error);
  proceed.resolve();
  const result = await pruning;
  assert.equal(result.ok, true, result.error);
  const pruned = result.value as { removed: unknown[]; failed: Array<{ error: string }> };
  assert.deepEqual(pruned.removed, []);
  assert.match(pruned.failed[0]?.error ?? '', /changed during prune/);
  await fs.promises.access(join(root, '.cland', 'worktrees', 'T-1'));
  assert.notEqual(await git('branch', '--list', 't/T-1-reopened-during-path-check'), '');
});

test('session aliases swapped inside across cleanup awaits refuse prune', async t => {
  for (const phase of ['queued item I/O', 'final path check']) await t.test(phase, async t => {
    const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
    let hold = false, prepared = false;
    const { root, ui, hub } = await territoryHub(t, undefined, {
      ...fs.promises,
      readFile: async (path, encoding) => {
        const text = await fs.promises.readFile(path, encoding);
        if (hold && String(path).includes('T-1-') && await fs.promises.access(join(root, '.cland', 'territory.lock')).then(() => true, () => false)) {
          hold = false;
          if (phase === 'queued item I/O') { reached.resolve(); await proceed.promise; }
          else prepared = true;
        }
        return text;
      },
    });
    onCleanup(t, () => proceed.resolve());
    const lstat = fs.promises.lstat;
    t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
      const stat = await lstat(...args);
      if (prepared) { prepared = false; reached.resolve(); await proceed.promise; }
      return stat;
    });
    syncBuiltinESMExports();
    onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
    await ui.request({ size: 'M', type: 'task.create', title: 'Alias containment', kind: 'task' });
    await ui.request({ type: 'task.claim', item: 'T-1' });
    await ui.request({ type: 'task.close', item: 'T-1' });
    const outside = await tempProject(t, 'cland-session-alias-');
    const alias = join(root, 'session-alias');
    await fs.promises.symlink(outside, alias);
    await ui.request({ type: 'role.set', session: 'impl-alias', role: 'implementer' });
    const socket = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
    onCleanup(t, () => socket.terminate());
    const session = frameClient(line => socket.send(line), fn => socket.on('message', data => fn(`${String(data)}\n`)), () => socket.terminate());
    await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    session.send({ type: 'hello', protocol: 2, cwd: alias, name: 'impl-alias', sessionId: 'alias-session' });
    assert.equal((await session.waitFor(f => f.type === 'welcome' || f.type === 'error')).type, 'welcome');
    hold = true;
    const pruning = ui.request({ type: 'worktree.prune', items: ['T-1'] }, 30_000);
    await reached.promise;
    await fs.promises.rm(alias);
    await fs.promises.symlink(join(root, '.cland', 'worktrees', 'T-1'), alias);
    proceed.resolve();
    const result = await pruning;
    assert.equal(result.ok, true, result.error);
    const pruned = result.value as { removed: unknown[]; failed: Array<{ error: string }> };
    assert.deepEqual(pruned.removed, []);
    assert.match(pruned.failed[0]?.error ?? '', /impl-alias now stands inside/);
    await fs.promises.access(join(root, '.cland', 'worktrees', 'T-1'));
  });
});

test('a parent swapped during the final leaf scan leaves no escaped creation', async t => {
  for (const existingBranch of [false, true]) await t.test(existingBranch ? 'existing branch' : 'new branch', async t => {
    const { root, ui, git } = await territoryHub(t);
    const branch = 't/T-1-final-escape';
    if (existingBranch) await git('branch', branch);
    await ui.request({ size: 'M', type: 'task.create', title: 'Final escape', kind: 'task' });
    const outside = await tempProject(t, 'cland-final-escape-');
    await fs.promises.writeFile(join(outside, 'keep.txt'), 'untouched\n');
    const parent = join(root, '.cland', 'worktrees'), path = join(parent, 'T-1');
    await fs.promises.mkdir(parent);
    const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
    const lstat = fs.promises.lstat;
    let scans = 0;
    t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
      try { return await lstat(...args); }
      catch (err) {
        if (args[0] === path && ++scans === 3) { reached.resolve(); await proceed.promise; }
        throw err;
      }
    });
    syncBuiltinESMExports();
    onCleanup(t, () => proceed.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
    const claiming = ui.request({ type: 'task.claim', item: 'T-1' }, 30_000);
    await reached.promise;
    await fs.promises.rm(parent, { recursive: true });
    await fs.promises.symlink(outside, parent);
    proceed.resolve();
    const result = await claiming;
    assert.equal(result.ok, true, result.error);
    const outcome = result.value as { worktree: unknown; reason: string };
    assert.equal(outcome.worktree, null);
    assert.match(outcome.reason, /created worktree.*confinement|created worktree.*escaped/);
    assert.deepEqual(await fs.promises.readdir(outside), ['keep.txt']);
    assert.equal(await fs.promises.readFile(join(outside, 'keep.txt'), 'utf8'), 'untouched\n');
    assert.equal(await git('branch', '--list', branch), existingBranch ? branch : '');
    assert.doesNotMatch(await git('worktree', 'list', '--porcelain'), new RegExp(outside));
  });
});

test('creation rollback preserves a branch advanced during confinement verification', async t => {
  const { root, ui, git } = await territoryHub(t);
  const branch = 't/T-1-advanced-escape';
  await ui.request({ size: 'M', type: 'task.create', title: 'Advanced escape', kind: 'task' });
  const outside = await tempProject(t, 'cland-advanced-escape-');
  const parent = join(root, '.cland', 'worktrees'), path = join(parent, 'T-1');
  await fs.promises.mkdir(parent);
  const scanned = Promise.withResolvers<void>(), swapped = Promise.withResolvers<void>();
  const verifying = Promise.withResolvers<void>(), advanced = Promise.withResolvers<void>();
  const lstat = fs.promises.lstat, realpath = fs.promises.realpath;
  let scans = 0, held = false;
  t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
    try { return await lstat(...args); }
    catch (err) {
      if (args[0] === path && ++scans === 3) { scanned.resolve(); await swapped.promise; }
      throw err;
    }
  });
  t.mock.method(fs.promises, 'realpath', async (...args: Parameters<typeof realpath>) => {
    const actual = await realpath(...args);
    if (args[0] === path && !held) { held = true; verifying.resolve(); await advanced.promise; }
    return actual;
  });
  syncBuiltinESMExports();
  onCleanup(t, () => swapped.resolve()); onCleanup(t, () => advanced.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
  const claiming = ui.request({ type: 'task.claim', item: 'T-1' }, 30_000);
  await scanned.promise;
  await fs.promises.rm(parent, { recursive: true });
  await fs.promises.symlink(outside, parent);
  swapped.resolve();
  await verifying.promise;
  await territoryGitAsync(path, ['commit', '--allow-empty', '-qm', 'Concurrent writer']);
  const writerTip = await git('rev-parse', `refs/heads/${branch}`);
  await fs.promises.writeFile(join(path, 'writer.txt'), 'uncommitted work\n');
  advanced.resolve();
  const result = await claiming;
  assert.equal(result.ok, true, result.error);
  const outcome = result.value as { worktree: unknown; reason: string };
  assert.equal(outcome.worktree, null);
  assert.match(outcome.reason, /branch.*moved.*kept worktree/);
  assert.ok(outcome.reason.includes(branch));
  assert.ok(outcome.reason.includes(join(outside, 'T-1')));
  assert.equal(await git('rev-parse', `refs/heads/${branch}`), writerTip);
  assert.equal(await fs.promises.readFile(join(path, 'writer.txt'), 'utf8'), 'uncommitted work\n');
  await fs.promises.access(join(path, '.git'));
  assert.match(await git('worktree', 'list', '--porcelain'), new RegExp(outside));
});

test('cached rollback listings preserve later commits and dirty work', async t => {
  for (const [existing, dirty] of [[false, false], [false, true], [true, false], [true, true]]) await t.test(`${existing ? 'existing' : 'new'} branch: ${dirty ? 'dirty worktree' : 'clean worktree restored'}`, async t => {
    const { root, ui, git } = await territoryHub(t);
    const branch = 't/T-1-cached-listing';
    if (existing) await git('branch', branch);
    await ui.request({ size: 'M', type: 'task.create', title: 'Cached listing', kind: 'task' });
    const outside = await tempProject(t, 'cland-cached-listing-');
    const parent = join(root, '.cland', 'worktrees'), path = join(parent, 'T-1');
    await fs.promises.mkdir(parent);
    const scanned = Promise.withResolvers<void>(), swapped = Promise.withResolvers<void>();
    const listed = Promise.withResolvers<void>(), advanced = Promise.withResolvers<void>();
    const lstat = fs.promises.lstat, execFile = cp.execFile;
    let scans = 0, escaped = false, held = false;
    t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
      try { return await lstat(...args); }
      catch (err) {
        if (args[0] === path && ++scans === 3) { scanned.resolve(); await swapped.promise; }
        throw err;
      }
    });
    t.mock.method(cp, 'execFile', (file: string, args: string[], options: ExecFileOptionsWithStringEncoding, callback: (err: ExecFileException | null, stdout: string, stderr: string) => void) =>
      execFile(file, args, options, (err, stdout, stderr) => {
        void (async () => {
          if (escaped && args[0] === 'worktree' && args[1] === 'list' && !held) { held = true; listed.resolve(); await advanced.promise; }
          callback(err, stdout, stderr);
        })();
      }));
    syncBuiltinESMExports();
    onCleanup(t, () => swapped.resolve()); onCleanup(t, () => advanced.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
    const claiming = ui.request({ type: 'task.claim', item: 'T-1' }, 30_000);
    await scanned.promise;
    await fs.promises.rm(parent, { recursive: true });
    await fs.promises.symlink(outside, parent);
    escaped = true;
    swapped.resolve();
    await listed.promise;
    await territoryGitAsync(path, ['commit', '--allow-empty', '-qm', 'Writer after listing']);
    const writerTip = await git('rev-parse', `refs/heads/${branch}`);
    if (dirty) await fs.promises.writeFile(join(path, 'writer.txt'), 'uncommitted after listing\n');
    advanced.resolve();
    const result = await claiming;
    assert.equal(result.ok, true, result.error);
    const outcome = result.value as { worktree: unknown; reason: string };
    assert.equal(outcome.worktree, null);
    assert.match(outcome.reason, /confinement.*(kept|restored)/);
    assert.ok(outcome.reason.includes(branch));
    assert.ok(outcome.reason.includes(join(outside, 'T-1')));
    assert.equal(await git('rev-parse', `refs/heads/${branch}`), writerTip);
    assert.equal(await territoryGitAsync(path, ['rev-parse', 'HEAD']), writerTip);
    if (dirty) assert.equal(await fs.promises.readFile(join(path, 'writer.txt'), 'utf8'), 'uncommitted after listing\n');
    assert.match(await git('worktree', 'list', '--porcelain'), new RegExp(outside));
  });
});

test('detached cleanup recovery always preserves escaped worktrees', async t => {
  for (const at of ['confinement', 'cached listing']) await t.test(at, async t => {
    const { root, ui, git } = await territoryHub(t);
    const branch = 't/T-1-detached-recovery';
    await ui.request({ size: 'M', type: 'task.create', title: 'Detached recovery', kind: 'task' });
    await ui.request({ type: 'task.claim', item: 'T-1' });
    const tip = await git('rev-parse', `refs/heads/${branch}`);
    const outside = await tempProject(t, 'cland-detached-recovery-');
    const parent = join(root, '.cland', 'worktrees'), path = join(parent, 'T-1');
    const scanned = Promise.withResolvers<void>(), swapped = Promise.withResolvers<void>();
    const verifying = Promise.withResolvers<void>(), advanced = Promise.withResolvers<void>();
    const lstat = fs.promises.lstat, realpath = fs.promises.realpath, execFile = cp.execFile;
    let checks = 0, escaped = false, held = false;
    t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
      try { return await lstat(...args); }
      catch (err) {
        if (args[0] === path && checks === 2) { scanned.resolve(); await swapped.promise; }
        throw err;
      }
    });
    t.mock.method(fs.promises, 'realpath', async (...args: Parameters<typeof realpath>) => {
      const actual = await realpath(...args);
      if (at === 'confinement' && escaped && args[0] === path && !held) { held = true; verifying.resolve(); await advanced.promise; }
      return actual;
    });
    t.mock.method(cp, 'execFile', (file: string, args: string[], options: ExecFileOptionsWithStringEncoding, callback: (err: ExecFileException | null, stdout: string, stderr: string) => void) =>
      execFile(file, args, options, (err, stdout, stderr) => {
        void (async () => {
          if (at === 'cached listing' && escaped && args[0] === 'worktree' && args[1] === 'list' && !held) { held = true; verifying.resolve(); await advanced.promise; }
          callback(err, stdout, stderr);
        })();
      }));
    syncBuiltinESMExports();
    onCleanup(t, () => swapped.resolve()); onCleanup(t, () => advanced.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
    const removing = assert.rejects(removeTaskWorktree(root, 'T-1', async () => {
      if (++checks === 2) await git('update-ref', '-d', `refs/heads/${branch}`, tip);
    }, { branch, tip }), err => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /created worktree failed confinement.*kept escaped detached worktree/);
      assert.ok(err.message.includes(join(outside, 'T-1')));
      assert.ok(err.message.includes(writerTip));
      return true;
    });
    await scanned.promise;
    await fs.promises.rm(parent, { recursive: true });
    await fs.promises.symlink(outside, parent);
    escaped = true;
    swapped.resolve();
    await verifying.promise;
    await territoryGitAsync(path, ['commit', '--allow-empty', '-qm', 'Detached writer']);
    const writerTip = await territoryGitAsync(path, ['rev-parse', 'HEAD']);
    if (at === 'confinement') await fs.promises.writeFile(join(path, 'writer.txt'), 'uncommitted detached work\n');
    advanced.resolve();
    await removing;
    assert.equal(await territoryGitAsync(path, ['rev-parse', 'HEAD']), writerTip);
    if (at === 'confinement') assert.equal(await fs.promises.readFile(join(path, 'writer.txt'), 'utf8'), 'uncommitted detached work\n');
    assert.equal(await git('branch', '--list', branch), '');
    assert.match(await git('worktree', 'list', '--porcelain'), new RegExp(outside));
  });
});

test('an alias moved inside while a sibling final realpath awaits keeps the worktree and branch', async t => {
  const { root, ui, hub, git } = await territoryHub(t);
  await ui.request({ size: 'M', type: 'task.create', title: 'Sibling alias', kind: 'task' });
  await ui.request({ type: 'task.claim', item: 'T-1' });
  await ui.request({ type: 'task.close', item: 'T-1' });
  const outside = await tempProject(t, 'cland-sibling-alias-');
  await fs.promises.writeFile(join(outside, 'keep.txt'), 'untouched\n');
  const slow = join(outside, 'slow'), alias = join(root, 'session-alias');
  await fs.promises.mkdir(slow);
  await fs.promises.symlink(outside, alias);
  for (const [name, cwd] of [['impl-alias', alias], ['impl-slow', slow]]) {
    await ui.request({ type: 'role.set', session: name, role: 'implementer' });
    const socket = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
    onCleanup(t, () => socket.terminate());
    const session = frameClient(line => socket.send(line), fn => socket.on('message', data => fn(`${String(data)}\n`)), () => socket.terminate());
    await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    session.send({ type: 'hello', protocol: 2, cwd, name, sessionId: name });
    assert.equal((await session.waitFor(f => f.type === 'welcome' || f.type === 'error')).type, 'welcome');
  }
  const aliasRead = Promise.withResolvers<void>(), reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  const realpath = fs.promises.realpath;
  let aliases = 0, siblings = 0;
  t.mock.method(fs.promises, 'realpath', async (...args: Parameters<typeof realpath>) => {
    const actual = await realpath(...args);
    if (args[0] === alias && ++aliases === 3) aliasRead.resolve();
    if (args[0] === slow && ++siblings === 3) { await aliasRead.promise; reached.resolve(); await proceed.promise; }
    return actual;
  });
  syncBuiltinESMExports();
  onCleanup(t, () => proceed.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
  const pruning = ui.request({ type: 'worktree.prune', items: ['T-1'] }, 30_000);
  await reached.promise;
  await fs.promises.rm(alias);
  await fs.promises.symlink(join(root, '.cland', 'worktrees', 'T-1'), alias);
  proceed.resolve();
  const result = await pruning;
  assert.equal(result.ok, true, result.error);
  const pruned = result.value as { removed: unknown[]; failed: Array<{ error: string }> };
  assert.deepEqual(pruned.removed, []);
  assert.match(pruned.failed[0]?.error ?? '', /session path identity changed/);
  await fs.promises.access(join(root, '.cland', 'worktrees', 'T-1', '.git'));
  assert.notEqual(await git('branch', '--list', 't/T-1-sibling-alias'), '');
  assert.equal(await fs.promises.readFile(join(outside, 'keep.txt'), 'utf8'), 'untouched\n');
});

test('a replaced target inode during the final path check refuses cleanup', async t => {
  let watch = false, prepared = false;
  const { root, ui, git } = await territoryHub(t, undefined, {
    ...fs.promises,
    readFile: async (path, encoding) => {
      const text = await fs.promises.readFile(path, encoding);
      if (watch && String(path).includes('T-1-') && await fs.promises.access(join(root, '.cland', 'territory.lock')).then(() => true, () => false)) prepared = true;
      return text;
    },
  });
  await ui.request({ size: 'M', type: 'task.create', title: 'Target identity', kind: 'task' });
  await ui.request({ type: 'task.claim', item: 'T-1' });
  await ui.request({ type: 'task.close', item: 'T-1' });
  const path = join(root, '.cland', 'worktrees', 'T-1'), kept = join(root, '.cland', 'kept-worktree');
  const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  const lstat = fs.promises.lstat;
  t.mock.method(fs.promises, 'lstat', async (...args: Parameters<typeof lstat>) => {
    const value = await lstat(...args);
    if (prepared && args[0] === path) { prepared = false; watch = false; reached.resolve(); await proceed.promise; }
    return value;
  });
  syncBuiltinESMExports();
  onCleanup(t, () => proceed.resolve()); onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
  watch = true;
  const pruning = ui.request({ type: 'worktree.prune', items: ['T-1'] }, 30_000);
  await reached.promise;
  await fs.promises.rename(path, kept);
  await fs.promises.mkdir(path);
  await fs.promises.writeFile(join(path, 'replacement.txt'), 'untouched\n');
  proceed.resolve();
  const result = await pruning;
  assert.equal(result.ok, true, result.error);
  const pruned = result.value as { removed: unknown[]; failed: Array<{ error: string }> };
  assert.deepEqual(pruned.removed, []);
  assert.match(pruned.failed[0]?.error ?? '', /worktree identity or confinement changed/);
  await fs.promises.access(join(kept, '.git'));
  assert.equal(await fs.promises.readFile(join(path, 'replacement.txt'), 'utf8'), 'untouched\n');
  assert.notEqual(await git('branch', '--list', 't/T-1-target-identity'), '');
});
