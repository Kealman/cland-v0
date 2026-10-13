import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { cland, flushProjectLogs, clandWithEnv, connectUi, connectWsUi, spawnSpoke, startDaemon, startHub, tempProject, type CliResult } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { pushDev, type PushResult } from '../src/territory-push.ts';
import { withTerritoryLockAsync } from '../src/territory.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { Store } from '../src/hub/store.ts';
import { fixedRoles } from '../src/roles/config.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };
const refs = (...repos: string[]) => repos.map(repo => git(repo, 'show-ref')).join('\n');
async function repository(t: TestContext) {
  const root = await tempProject(t, 'cland-push-');
  await copyPreparedProject(root);
  return { root, territory: join(root, '.cland', 'territory.git') };
}
async function project(t: TestContext) {
  const repo = await repository(t);
  const { discovery } = await startDaemon(t, repo.root);
  const ui = await connectUi(t, discovery);
  return { ...repo, ui };
}

test('human cland push publishes tracker commits, preserves dirty staged work, ignores push URLs and is idempotent', async t => {
  const { root, territory } = await project(t);
  ok(await cland(root, 'task', 'create', 'Tracker entry'));
  git(root, 'add', '.cland/tasks');
  git(root, 'commit', '-qm', 'Record tracker');
  const dev = git(root, 'rev-parse', 'dev');
  const previous = git(territory, 'rev-parse', 'dev');
  await fs.writeFile(join(root, 'README.md'), 'staged work\n');
  git(root, 'add', 'README.md');
  const index = git(root, 'write-tree');
  git(root, 'config', 'remote.origin.pushurl', '/nonexistent-push-destination');
  const result = JSON.parse(ok(await cland(root, 'push', '--json')).stdout) as PushResult;
  assert.deepEqual(result, { dev, previous });
  assert.equal(git(territory, 'rev-parse', 'dev'), dev);
  assert.equal(git(root, 'rev-parse', 'dev'), dev);
  assert.equal(git(root, 'write-tree'), index);
  assert.equal(await fs.readFile(join(root, 'README.md'), 'utf8'), 'staged work\n');
  const before = refs(root, territory);
  ok(await cland(root, 'push'));
  assert.equal(refs(root, territory), before);
});

test('only Coordinator and human shells push; role spoofing and unknown shell ids refuse, and no spoke push tool exists', async t => {
  const { root, territory, ui } = await project(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  for (const role of ['implementer', 'reviewer', 'qa', 'coordinator']) {
    const name = `caller-${role}`;
    const sessionId = `${role}-id`;
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, sessionId, role });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
    const before = refs(root, territory);
    const env = { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: sessionId, CLAND_ROLE: 'coordinator' };
    const result = await clandWithEnv(root, env, 'push');
    if (role === 'coordinator') {
      ok(result);
      // The identity model does not distinguish an inherited Coordinator shell: document its authority.
      ok(await clandWithEnv(root, env, 'push'));
      const denied = await ui.request({ type: 'push', as: { name, sessionId, shell: true } });
      assert.equal(denied.ok, false);
      assert.match(denied.error ?? '', /own shell/);
    } else {
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /may not use push/);
      assert.equal(refs(root, territory), before);
    }
    assert.equal((await spoke.client.listTools()).tools.some(tool => tool.name === 'push'), false);
  }
  const before = refs(root, territory);
  const result = await clandWithEnv(root, { CLAND_SESSION_NAME: 'coordinator', CLAND_SESSION_ID: 'unknown', CLAND_ROLE: 'coordinator' }, 'push');
  assert.notEqual(result.code, 0);
  assert.equal(refs(root, territory), before);
});

test('rejected publication, pending recovery and wrong checkout leave all refs and root work untouched; retry publishes', async t => {
  const { root, territory } = await project(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  const before = refs(root, territory);
  const hook = join(territory, 'hooks', 'pre-receive');
  await fs.writeFile(hook, '#!/bin/sh\necho "fixture rejected dev" >&2\nexit 1\n', { mode: 0o755 });
  const rejected = await cland(root, 'push');
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /fixture rejected dev/);
  assert.equal(refs(root, territory), before);
  assert.equal(git(root, 'show', 'HEAD:README.md'), 'project');
  await fs.rm(hook);
  for (const operation of ['sync', 'release']) {
    const receipt = join(root, '.cland', `${operation}.tmp`);
    await fs.writeFile(receipt, 'pending');
    const result = await cland(root, 'push');
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, new RegExp(`finish pending cland ${operation}`));
    assert.equal(refs(root, territory), before);
    assert.equal(await fs.readFile(receipt, 'utf8'), 'pending');
    await fs.rm(receipt);
  }
  git(root, 'switch', '-q', 'main');
  assert.match((await cland(root, 'push')).stderr, /root must be on dev/);
  assert.equal(refs(root, territory), before);
  git(root, 'switch', '-q', 'dev');
  ok(await cland(root, 'push'));
  assert.equal(git(territory, 'rev-parse', 'dev'), git(root, 'rev-parse', 'dev'));
});

test('a non-fast-forward names territory commits even when their objects are absent locally, and never forces', async t => {
  const { root, territory } = await project(t);
  const clone = await tempProject(t, 'cland-push-collaborator-');
  git(clone, 'clone', '-q', territory, '.');
  git(clone, 'config', 'user.name', 'Other');
  git(clone, 'config', 'user.email', 'other@example.com');
  git(clone, 'commit', '--allow-empty', '-qm', 'Territory-only commit');
  // Fixture prepares a divergent territory; the command under test never uses the marker from the shell.
  execFileSync('git', ['push', '-q', 'origin', 'dev'], { cwd: clone, env: { ...process.env, CLAND_TERRITORY_WRITE: '1' } });
  const remote = git(clone, 'rev-parse', 'HEAD');
  git(root, 'commit', '--allow-empty', '-qm', 'Root-only commit');
  const before = refs(root, territory);
  const result = await cland(root, 'push');
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /push-behind/);
  assert.ok(result.stderr.includes(remote.slice(0, 7)));
  assert.match(result.stderr, /Territory-only commit/);
  assert.equal(refs(root, territory), before);
});

test('merge refuses unpublished root dev before preparation, preserving checkout, task and refs; explicit push then merge succeeds', async t => {
  const { root, territory } = await project(t);
  const { item } = JSON.parse(ok(await cland(root, 'task', 'create', 'Parser', '--json')).stdout);
  const { worktree } = JSON.parse(ok(await cland(root, 'task', 'claim', item.id, '--json')).stdout);
  await fs.writeFile(join(worktree.path, 'parser.txt'), 'done\n');
  git(worktree.path, 'add', 'parser.txt');
  git(worktree.path, 'commit', '-qm', 'Parser');
  git(root, 'add', '.cland/tasks');
  git(root, 'commit', '-qm', 'Record tracker');
  const local = git(root, 'rev-parse', 'dev');
  const before = refs(root, territory);
  const index = git(root, 'write-tree');
  const result = await cland(root, 'merge', item.id, '--override', 'fixture');
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /merge-unpublished/);
  assert.ok(result.stderr.includes(local.slice(0, 7)));
  assert.match(result.stderr, /Record tracker[\s\S]*run cland push/);
  assert.equal(refs(root, territory), before);
  assert.equal(git(root, 'write-tree'), index);
  const view = JSON.parse(ok(await cland(root, 'task', 'view', item.id, '--json')).stdout).item;
  assert.equal(view.state, 'open');
  assert.ok(view.claim);
  ok(await cland(root, 'push'));
  const merged = JSON.parse(ok(await cland(root, 'merge', item.id, '--override', 'fixture', '--json')).stdout);
  assert.equal(git(root, 'rev-parse', 'dev^'), local);
  assert.equal(git(territory, 'rev-parse', 'dev'), merged.commit);
});

test('authorization revoked after async inspection refuses publication without moving refs', async t => {
  const { root, territory } = await repository(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  const before = refs(root, territory);
  let calls = 0;
  await assert.rejects(withTerritoryLockAsync(root, () => pushDev(root, work => work(), () => {
    if (++calls === 2) throw new Error('Coordinator revoked');
  })), /Coordinator revoked/);
  assert.equal(refs(root, territory), before);
  assert.equal(calls, 2);
});

test('record and lock-release failures after publication report successful push with follow-up; retry remains idempotent', async t => {
  const { root, territory } = await repository(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  let failRecord = true;
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), log: entry => {
    if (entry.event === 'dev-pushed' && failRecord) throw new Error('record unavailable');
  } });
  t.after(async () => { await hub.close(); await tracker.stop(); });
  const ui = await connectWsUi(t, hub);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  const dev = git(root, 'rev-parse', 'dev');
  const recorded = await ui.request({ type: 'push' }, 30_000);
  assert.equal(recorded.ok, true, recorded.error);
  assert.equal((recorded.value as PushResult).followUp?.step, 'record');
  assert.equal(git(territory, 'rev-parse', 'dev'), dev);
  failRecord = false;
  const rm = fs.rm;
  let failRelease = true;
  t.mock.method(fs, 'rm', async (path: string, options: Parameters<typeof fs.rm>[1]) => {
    if (path === join(root, '.cland', 'territory.lock') && failRelease) throw new Error('lock unlink unavailable');
    return rm(path, options);
  });
  const released = await ui.request({ type: 'push' }, 30_000);
  assert.equal(released.ok, true, released.error);
  assert.equal((released.value as PushResult).followUp?.step, 'lock-release');
  assert.equal(git(territory, 'rev-parse', 'dev'), dev);
  failRelease = false;
  await fs.rm(join(root, '.cland', 'territory.lock'));
  const retry = await ui.request({ type: 'push' }, 30_000);
  assert.equal(retry.ok, true, retry.error);
  assert.equal((retry.value as PushResult).followUp, undefined);
  assert.equal(git(territory, 'rev-parse', 'dev'), dev);
});

test('failures in each Git inspection/publication step preserve refs; a lost accepted push reply is confirmed', async t => {
  const { territoryGitAsync } = await import('../src/territory.ts');
  const { root, territory } = await repository(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  const before = refs(root, territory);
  for (const command of ['symbolic-ref', 'rev-parse', 'fetch', 'merge-base', 'push']) {
    let injected = false;
    await assert.rejects(withTerritoryLockAsync(root, () => pushDev(root, work => work(), () => {}, async (cwd, args, marked, input) => {
      if (args[0] === command && !injected) { injected = true; throw new Error(`fixture ${command} failure`); }
      return territoryGitAsync(cwd, args, marked, input);
    })), new RegExp(`fixture ${command} failure`));
    assert.ok(injected);
    assert.equal(refs(root, territory), before, command);
    assert.equal(await fs.readFile(join(root, 'README.md'), 'utf8'), 'project\n');
  }
  const result = await withTerritoryLockAsync(root, () => pushDev(root, work => work(), () => {}, async (cwd, args, marked, input) => {
    const answer = await territoryGitAsync(cwd, args, marked, input);
    if (args[0] === 'push') throw new Error('reply lost after acceptance');
    return answer;
  }));
  assert.equal(result.dev, git(territory, 'rev-parse', 'dev'));
});

test('a root ref moved during inspection refuses rather than publishing unchecked later work', async t => {
  const { territoryGitAsync } = await import('../src/territory.ts');
  const { root, territory } = await repository(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  const ready = Promise.withResolvers<void>();
  const proceed = Promise.withResolvers<void>();
  const operation = withTerritoryLockAsync(root, () => pushDev(root, work => work(), () => {}, async (cwd, args, marked, input) => {
    const answer = await territoryGitAsync(cwd, args, marked, input);
    if (args[0] === 'fetch') { ready.resolve(); await proceed.promise; }
    return answer;
  }));
  await ready.promise;
  git(root, 'commit', '--allow-empty', '-qm', 'Concurrent later commit');
  const before = refs(root, territory);
  proceed.resolve();
  await assert.rejects(operation, /push-changed/);
  assert.equal(refs(root, territory), before);
});

test('push refuses pending landed merge or checkout recovery but permits a fully rolled-back preparation', async t => {
  const { root, territory } = await repository(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles() });
  t.after(async () => { await hub.close(); await tracker.stop(); });
  const ui = await connectWsUi(t, hub);
  const human = { id: 'human', name: 'human', role: null };
  const item = await tracker.create(human, { title: 'Prepared task' });
  const tree = git(root, 'write-tree');
  const before = git(root, 'rev-parse', 'dev');
  const commit = git(root, 'commit-tree', tree, '-p', before, '-m', `Prepared task\n\nItem: ${item.id}`);
  const receipt = { commit, base: 'dev', branch: 't/prepared', tip: before };
  git(root, 'branch', receipt.branch, before);
  tracker.recordMerge(item.id, { ...receipt, checkout: { before: tree, after: tree } });
  let snapshot = refs(root, territory);
  let result = await ui.request({ type: 'push' }, 30_000);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /checkout recovery/);
  assert.equal(refs(root, territory), snapshot);
  tracker.recordMerge(item.id, { ...receipt, commit: tree }); // a tree is not a verifiable landing commit
  snapshot = refs(root, territory);
  result = await ui.request({ type: 'push' }, 30_000);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /cannot verify pending cland merge/);
  assert.equal(refs(root, territory), snapshot);
  tracker.recordMerge(item.id, receipt);
  // No integration ref contains the prepared commit: rollback finished, so ordinary tracker publication is safe.
  await tracker.close(human, item.id);
  const reopened = await ui.request({ type: 'task.edit', item: item.id, state: 'open' });
  assert.equal(reopened.ok, true, reopened.error);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker after rollback');
  result = await ui.request({ type: 'push' }, 30_000);
  assert.equal(result.ok, true, result.error);
  // A pending prepared landing must finish through merge, including its item and topic follow-up.
  git(root, 'update-ref', 'refs/heads/dev', commit);
  snapshot = refs(root, territory);
  result = await ui.request({ type: 'push' }, 30_000);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /finish pending cland merge/);
  assert.equal(refs(root, territory), snapshot);
});

for (const failCleanup of [false, true]) test(`lost publication and failed confirmation preserve CLI exit 2, event and retry guidance (release failure: ${failCleanup})`, async t => {
  const { root, territory } = await repository(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Tracker commit');
  const dev = git(root, 'rev-parse', 'dev');
  const bin = join(root, '.cland', 'fake-bin');
  await fs.mkdir(bin);
  const marker = join(bin, 'accepted'), repaired = join(bin, 'repaired');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  await fs.writeFile(join(bin, 'git'), `#!/bin/sh
if [ "$1" = push ] && [ ! -f ${quote(repaired)} ]; then
  ${quote(realGit)} "$@" || exit $?
  touch ${quote(marker)}
  echo 'fixture reply lost after acceptance' >&2
  exit 1
fi
if [ "$1" = rev-parse ] && [ "$PWD" = ${quote(territory)} ] && [ -f ${quote(marker)} ]; then
  ${failCleanup ? `rm ${quote(join(root, '.cland', 'territory.lock'))}; mkdir ${quote(join(root, '.cland', 'territory.lock'))}` : ''}
  echo 'fixture confirmation unavailable' >&2
  exit 1
fi
exec ${quote(realGit)} "$@"
`, { mode: 0o755 });
  await startDaemon(t, root, { PATH: `${bin}:${process.env.PATH}` });
  const result = await cland(root, 'push');
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /push-outcome-unknown/);
  assert.ok(result.stderr.includes(dev));
  assert.match(result.stderr, /verify territory dev and retry cland push/);
  if (failCleanup) assert.match(result.stderr, /cleanup failed:.*EISDIR/);
  assert.equal(git(territory, 'rev-parse', 'dev'), dev);
  await flushProjectLogs(t, root);
  const log = await fs.readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
  assert.match(log, /"event":"push-outcome-unknown"/);
  assert.doesNotMatch(log, /"event":"push-refused"/);
  if (failCleanup) await fs.rm(join(root, '.cland', 'territory.lock'), { recursive: true });
  await fs.rm(marker);
  await fs.writeFile(repaired, 'ready');
  ok(await cland(root, 'push'));
  assert.equal(git(territory, 'rev-parse', 'dev'), dev);
});
