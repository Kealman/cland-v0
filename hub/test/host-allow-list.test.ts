// T3: native Git update hooks and per-host Unix git sockets in disposable territories.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { eventually, testWaitMs } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { HOST_PUSH_TIMEOUT_MS, HOST_PUSH_LOCK_WAIT_MS, startGitDaemon } from '../src/host/git-daemon.ts';
import { grantBranchLease, revokeBranchLease } from '../src/host/branch-leases.ts';
import { TERRITORY_HOOK, refreshTerritoryHook, withTerritoryLockAsync } from '../src/territory.ts';
import { TerritoryBusy } from '../src/territory-lock-context.ts';
const exec = promisify(execFile);

async function fixture(t: test.TestContext, receiveLockWaitMs?: number) {
  const root = await mkdtemp(join(tmpdir(), 'cland-allow-'));
  const env = fixtureEnvironment(root, process.env, {});
  const closers: (() => Promise<void>)[] = [];
  t.after(async () => { for (const close of closers.reverse()) await close(); await rm(root, { recursive: true, force: true }); });
  await mkdir(env.HOME!, { recursive: true });
  const git = async (cwd: string, ...args: string[]) => (await exec('git', ['-c', 'gc.auto=0', ...args], { cwd, env: fixtureEnvironment(root, env, {}), timeout: 15_000 })).stdout.trim();
  const territory = join(root, '.cland/territory.git');
  await mkdir(join(root, '.cland'));
  await git(root, 'init', '--bare', '--initial-branch=main', territory);
  await writeFile(join(territory, 'hooks/update'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  await refreshTerritoryHook(root);
  assert.equal(await readFile(join(territory, 'hooks/update'), 'utf8'), TERRITORY_HOOK);
  const client = join(root, 'client');
  await git(root, 'init', '--initial-branch=main', client);
  await writeFile(join(client, 'file'), 'one');
  await git(client, 'add', '.'); await git(client, 'commit', '-m', 'seed');
  const events = new EventEmitter();
  const listener = await startGitDaemon({ host: 'host-a', ...(receiveLockWaitMs === undefined ? {} : { receiveLockWaitMs }), territory, socket: join(root, 'git.sock'), env, log: row => events.emit(String(row.event), row) });
  closers.push(() => listener.close());
  const proxy = join(root, 'proxy');
  const source = fileURLToPath(new URL('../src/host/git-proxy.ts', import.meta.url));
  await writeFile(proxy, `#!/bin/sh\nexec '${process.execPath}' '${source}' '${join(root, 'git.sock')}' "$@"\n`, { mode: 0o700 });
  const push = (ref: string) => git(client, '-c', `core.gitProxy=${proxy}`, 'push', 'git://territory/territory.git', ref);
  return { root, env, territory, client, git, push, closers, listener, events };
}

test('host socket accepts only its leased task refs; upgrade preserves hub push policy', async t => {
  const f = await fixture(t);
  await grantBranchLease(f.root, 'host-a', 't/allowed');
  await grantBranchLease(f.root, 'host-b', 't/other');
  await f.push('HEAD:refs/heads/t/allowed');
  assert.equal(await f.git(f.territory, 'rev-parse', 't/allowed'), await f.git(f.client, 'rev-parse', 'HEAD'));
  for (const ref of ['refs/heads/t/other', 'refs/heads/t/unleased', 'refs/t/other', 'refs/tags/tag', 'refs/heads/dev', 'refs/heads/main']) {
    await assert.rejects(f.push(`HEAD:${ref}`), /host-a/);
  }
  await assert.rejects(f.push(':refs/heads/t/allowed'), /deletion prohibited|host-a/);
  await revokeBranchLease(f.root, 'host-a', 't/allowed');
  await writeFile(join(f.client, 'file'), 'two'); await f.git(f.client, 'commit', '-am', 'two');
  await assert.rejects(f.push('HEAD:refs/heads/t/allowed'), /host-a/);
  await f.git(f.client, 'push', f.territory, 'HEAD:refs/heads/t/local');
  await assert.rejects(f.git(f.client, 'push', f.territory, 'HEAD:refs/heads/dev'), /protected/);
  await exec('git', ['-c', 'gc.auto=0', 'push', f.territory, 'HEAD:refs/heads/dev'], { cwd: f.client, env: fixtureEnvironment(f.root, f.env, { CLAND_TERRITORY_WRITE: '1' }) });
  assert.equal(await f.git(f.territory, 'rev-parse', 'dev'), await f.git(f.client, 'rev-parse', 'HEAD'));
});

test('grant and revoke cannot rewrite the allow list while another territory operation holds its lock', async t => {
  const f = await fixture(t);
  await grantBranchLease(f.root, 'host-a', 't/held');
  await assert.rejects(revokeBranchLeasesLocked(f.root, 't/held'), /requires the territory lock/);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const holder = withTerritoryLockAsync(f.root, async () => { entered.resolve(); await release.promise; });
  await entered.promise;
  try {
    const busy = (error: unknown) => {
      assert.ok(error instanceof TerritoryBusy);
      assert.match(error.message, /^another territory operation holds the lock(?: \(pid \d+\))?$/);
      return true;
    };
    const knownHolder = (error: unknown) => {
      busy(error);
      assert.equal((error as Error).message, `another territory operation holds the lock (pid ${process.pid})`);
      return true;
    };
    await assert.rejects(grantBranchLease(f.root, 'host-b', 't/blocked'), knownHolder);
    await assert.rejects(revokeBranchLease(f.root, 'host-a', 't/held', { waitMs: 0 }), knownHolder);
    await assert.rejects(revokeBranchLease(f.root, 'host-a', 't/held', { waitMs: 50 }), busy);
    // Smaller than the timestamp's precision: deadline exhaustion before any probe.
    await assert.rejects(revokeBranchLease(f.root, 'host-a', 't/held', { waitMs: Number.EPSILON }), busy);
  } finally { release.resolve(); await holder; }
  await f.push('HEAD:refs/heads/t/held');
  await assert.rejects(f.push('HEAD:refs/heads/t/blocked'), /host-a/);
});

import { connect } from 'node:net';
import { once } from 'node:events';
import { EventEmitter } from 'node:events';
import { prepareMergeBatch } from '../src/hub/merge-batch-territory.ts';
import { revokeBranchLeasesLocked } from '../src/host/branch-leases.ts';
import type { MergeQueueEntry } from '../src/protocol.ts';

function request(service: string): Buffer {
  const body = `${service} /territory.git\0host=territory\0`;
  return Buffer.from((Buffer.byteLength(body) + 4).toString(16).padStart(4, '0') + body);
}

test('admitted push fences revoke until native exit; held revoke refuses push while fetch completes', async t => {
  const f = await fixture(t, 100);
  await grantBranchLease(f.root, 'host-a', 't/race');
  await f.push('HEAD:refs/heads/t/race');
  const events = new EventEmitter();
  const listener = await startGitDaemon({ host: 'host-a', territory: f.territory, socket: join(f.root, 'race.sock'), env: f.env, log: row => events.emit(String(row.event), row) });
  const client = connect({ path: join(f.root, 'race.sock'), allowHalfOpen: true });
  f.closers.push(async () => { client.destroy(); await listener.close(); });
  const advertised = once(client, 'data', { signal: AbortSignal.timeout(5_000) });
  client.write(request('git-receive-pack'));
  await advertised; // Receive-pack's advertised refs prove admission under territory.lock.
  await assert.rejects(revokeBranchLease(f.root, 'host-a', 't/race', { waitMs: 0 }), /territory operation holds/);
  const exited = once(events, 'host-git-exit', { signal: AbortSignal.timeout(5_000) });
  client.end();
  await exited;
  // close joins the admission's lock release after its native exit.
  await listener.close();
  await withTerritoryLockAsync(f.root, async () => {
    await revokeBranchLeasesLocked(f.root, 't/race');
    await writeFile(join(f.client, 'file'), 'after revoke'); await f.git(f.client, 'commit', '-am', 'after');
    await assert.rejects(f.push('HEAD:refs/heads/t/race'), /host-a.*retry.*territory operation holds/s);
    await f.git(f.client, '-c', `core.gitProxy=${join(f.root, 'proxy')}`, 'fetch', '--no-auto-maintenance', 'git://territory/territory.git', 't/race');
  });
  await assert.rejects(f.push('HEAD:refs/heads/t/race'), /host-a/);
});

test('batch revokes every host and builds the pinned member head; later pushes are refused', async t => {
  const f = await fixture(t);
  await f.git(f.root, 'init', '--initial-branch=dev');
  await f.git(f.root, 'fetch', '--no-auto-maintenance', f.client, 'main');
  await f.git(f.root, 'reset', '--hard', 'FETCH_HEAD');
  await grantBranchLease(f.root, 'host-a', 't/batch');
  await grantBranchLease(f.root, 'host-b', 't/batch');
  await writeFile(join(f.client, 'file'), 'batch'); await f.git(f.client, 'commit', '-am', 'batch');
  await f.push('HEAD:refs/heads/t/batch');
  await f.git(f.root, 'fetch', '--no-auto-maintenance', f.territory, 'refs/heads/t/batch:refs/heads/t/batch');
  const head = await f.git(f.client, 'rev-parse', 'HEAD');
  const entry = { item: 'T-1', branch: 't/batch', head, verdictBase: 'dev' } as MergeQueueEntry;
  const listener = await startGitDaemon({ host: 'host-a', territory: f.territory, socket: join(f.root, 'batch.sock'), env: f.env, log: () => {} });
  const stalled = connect({ path: join(f.root, 'batch.sock'), allowHalfOpen: true });
  f.closers.push(async () => { stalled.destroy(); await listener.close(); });
  const advertised = once(stalled, 'data', { signal: AbortSignal.timeout(5_000) });
  stalled.write(request('git-receive-pack'));
  await advertised;
  await assert.rejects(prepareMergeBatch(f.root, 'batch', [entry], f.env), /territory operation holds/);
  await listener.close(); // Native close and lock release before retrying batch preparation.
  const candidate = await prepareMergeBatch(f.root, 'batch', [entry], f.env);
  assert.equal(await f.git(f.root, 'show', `${candidate.head}:file`), 'batch');
  assert.equal(await readFile(join(f.territory, 'cland-branch-leases'), 'utf8'), '');
  await writeFile(join(f.client, 'file'), 'late'); await f.git(f.client, 'commit', '-am', 'late');
  await assert.rejects(f.push('HEAD:refs/heads/t/batch'), /host-a/);
  assert.equal(await f.git(f.territory, 'rev-parse', 't/batch'), head);
});

import { project, git, review } from './merge-native-support.ts';
import { onCleanup } from './process-cleanup.ts';
test('immediate merge revokes every host lease before landing the task', async t => {
  const { root, ui, rev } = await project(t);
  // This seam proves native landing and lease revocation, not CLI startup.
  const created = await ui.request({ type: 'task.create', title: 'Ship the parser', size: 'M' });
  assert.equal(created.ok, true, created.error);
  const { item } = created.value as { item: { id: string } };
  const claimed = await ui.request({ type: 'task.claim', item: item.id });
  assert.equal(claimed.ok, true, claimed.error);
  const { worktree } = claimed.value as { worktree: { path: string; branch: string } };
  const work = { id: item.id, ...worktree };
  await writeFile(join(work.path, 'parser.txt'), 'first\n');
  git(work.path, 'add', 'parser.txt');
  git(work.path, 'commit', '-qm', 'First step');
  await writeFile(join(work.path, 'parser.txt'), 'finished\n');
  git(work.path, 'commit', '-qam', 'Second step');
  const env = fixtureEnvironment(root, process.env, {});
  const listener = await startGitDaemon({ host: 'host-a', territory: join(root, '.cland/territory.git'), socket: join(root, 'merge.sock'), env, log: () => {} });
  onCleanup(t, () => listener.close());
  const proxy = join(root, 'merge-proxy');
  const source = fileURLToPath(new URL('../src/host/git-proxy.ts', import.meta.url));
  await writeFile(proxy, `#!/bin/sh\nexec '${process.execPath}' '${source}' '${join(root, 'merge.sock')}' "$@"\n`, { mode: 0o700 });
  await grantBranchLease(root, 'host-a', work.branch);
  await grantBranchLease(root, 'host-b', work.branch);
  await review(rev, work.id);
  const merged = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  const result = merged.value as { commit: string };
  assert.ok(result.commit);
  assert.equal(await readFile(join(root, '.cland/territory.git/cland-branch-leases'), 'utf8'), '');
  await assert.rejects(exec('git', ['-c', 'gc.auto=0', '-c', `core.gitProxy=${proxy}`, 'push', 'git://territory/territory.git', `HEAD:refs/heads/${work.branch}`], { cwd: root, env: fixtureEnvironment(root, env, {}) }), /host-a/);
  await listener.close();
});

import { preparedProject } from './prepared-project.ts';
import { nativeProjectHub } from './harness.ts';
test('hub startup upgrades an existing territory update hook', async t => {
  const root = await preparedProject(t, 'territory', 'cland-old-hook-');
  const path = join(root, '.cland/territory.git/hooks/update');
  await writeFile(path, '#!/bin/sh\n# previous cland hook\nexit 0\n', { mode: 0o755 });
  const hub = await nativeProjectHub(t, root, {}, { harnesses: 'fake' });
  assert.equal(await readFile(path, 'utf8'), TERRITORY_HOOK);
  await hub.stop();
});

test('a stalled receive releases its write fence after the injected cap and native close', { timeout: 10_000 }, async t => {
  assert.equal(HOST_PUSH_TIMEOUT_MS, 30_000);
  assert.equal(HOST_PUSH_LOCK_WAIT_MS, 30_000);
  const f = await fixture(t);
  const events = new EventEmitter();
  const listener = await startGitDaemon({ host: 'host-a', territory: f.territory, socket: join(f.root, 'timeout.sock'), env: f.env, receiveTimeoutMs: 500, log: row => events.emit(String(row.event), row) });
  const client = connect({ path: join(f.root, 'timeout.sock'), allowHalfOpen: true });
  f.closers.push(async () => { client.destroy(); await listener.close(); });
  const advertised = once(client, 'data', { signal: AbortSignal.timeout(5_000) });
  const exited = once(events, 'host-git-exit', { signal: AbortSignal.timeout(5_000) });
  client.write(request('git-receive-pack'));
  await advertised;
  await assert.rejects(grantBranchLease(f.root, 'host-a', 't/timeout'), /territory operation holds/);
  const [exit] = await exited;
  assert.equal(exit.host, 'host-a');
  assert.ok(exit.signal || exit.code !== 0, 'stalled receive terminated rather than completing a push');
  await listener.close();
  await grantBranchLease(f.root, 'host-a', 't/timeout');
  assert.match(await readFile(join(f.territory, 'cland-branch-leases'), 'utf8'), /host-a\tt\/timeout/);
});


import fs from 'node:fs/promises';
test('failed write-lock release fences admission and makes listener close report incomplete cleanup', async t => {
  const f = await fixture(t);
  await grantBranchLease(f.root, 'host-a', 't/release');
  const original = fs.rm;
  let failRelease = true;
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (failRelease && args[0] === join(f.root, '.cland/territory.lock')) throw new Error('injected release failure');
    return original(...args);
  });
  const incomplete = once(f.events, 'host-git-stop-incomplete', { signal: AbortSignal.timeout(5_000) });
  await f.push('HEAD:refs/heads/t/release');
  const [receipt] = await incomplete;
  assert.equal(receipt.reason, 'write-ownership');
  failRelease = false;
  await assert.rejects(f.listener.close(), /write ownership cleanup incomplete/);
  f.closers[0] = async () => { await assert.rejects(f.listener.close(), /write ownership cleanup incomplete/); };
});

test('revoke joins a receive whose Git client exited before asynchronous lock release', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  await grantBranchLease(f.root, 'host-a', 't/release-boundary');
  const released = Promise.withResolvers<void>();
  const releaseEntered = Promise.withResolvers<void>();
  const remove = fs.rm, read = fs.readFile;
  let hold = true;
  let revoke: Promise<unknown> | undefined;
  f.closers.push(async () => { hold = false; released.resolve(); await revoke; });
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (hold && args[0] === join(f.root, '.cland/territory.lock')) {
      releaseEntered.resolve();
      await released.promise;
    }
    return remove(...args);
  });
  await f.push('HEAD:refs/heads/t/release-boundary');
  await releaseEntered.promise;
  // The next held-lock read belongs to the revoke contender.
  const attempted = Promise.withResolvers<void>();
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    const result = await read(...args);
    if (hold && args[0] === join(f.root, '.cland/territory.lock')) attempted.resolve();
    return result;
  });
  revoke = revokeBranchLease(f.root, 'host-a', 't/release-boundary').catch(error => error);
  await attempted.promise;
  hold = false;
  released.resolve();
  const outcome = await revoke;
  assert.equal(outcome, undefined, 'revoke waits for the admitted receive owner to release');
  assert.equal(await readFile(join(f.territory, 'cland-branch-leases'), 'utf8'), '');
});


test('public revoke reuses its active territory lock without waiting on itself', async t => {
  const f = await fixture(t);
  await grantBranchLease(f.root, 'host-a', 't/reentrant');
  await withTerritoryLockAsync(f.root, async () => {
    await revokeBranchLease(f.root, 'host-a', 't/reentrant', { waitMs: 0 });
    assert.equal(await readFile(join(f.territory, 'cland-branch-leases'), 'utf8'), '');
    await assert.rejects(grantBranchLease(f.root, 'host-b', 't/not-released'), /territory operation holds/);
  });
});


test('territory push waits for the previous receive release and publishes its tip', { timeout: testWaitMs(15_000) }, async t => {
  const f = await fixture(t);
  await grantBranchLease(f.root, 'host-a', 't/wait');
  const released = Promise.withResolvers<void>();
  const releaseEntered = Promise.withResolvers<void>();
  const remove = fs.rm, read = fs.readFile;
  let hold = true;
  f.closers.push(async () => { hold = false; released.resolve(); });
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (hold && args[0] === join(f.root, '.cland/territory.lock')) {
      releaseEntered.resolve();
      await released.promise;
    }
    return remove(...args);
  });
  await f.push('HEAD:refs/heads/t/wait');
  let releaseObserved = false;
  void releaseEntered.promise.then(() => { releaseObserved = true; });
  await eventually('previous receive reached asynchronous lock release', () => releaseObserved || undefined, testWaitMs(5_000));
  await writeFile(join(f.client, 'file'), 'second tip');
  await f.git(f.client, 'commit', '-am', 'second');
  let observed = false;
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    const result = await read(...args);
    if (hold && args[0] === join(f.root, '.cland/territory.lock')) {
      observed = true; hold = false; released.resolve();
    }
    return result;
  });
  try {
    await f.push('HEAD:refs/heads/t/wait');
    assert.equal(observed, true, 'second push observed the previous receive release');
    assert.equal(await f.git(f.territory, 'rev-parse', 't/wait'), await f.git(f.client, 'rev-parse', 'HEAD'));
  } finally { hold = false; released.resolve(); }
});

test('territory push retains the named refusal after its lock wait bound', async t => {
  const f = await fixture(t, 500);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const holder = withTerritoryLockAsync(f.root, async () => { entered.resolve(); await release.promise; });
  let client: ReturnType<typeof connect> | undefined;
  const cleanup = async () => {
    const closed = client && !client.closed ? new Promise<void>(done => client!.once('close', () => done())) : undefined;
    client?.destroy();
    release.resolve();
    await holder;
    await closed;
  };
  f.closers.push(cleanup); // Own the holder and any later client before setup can fail.
  let enteredObserved = false;
  void entered.promise.then(() => { enteredObserved = true; });
  await eventually('independent territory holder entered', () => enteredObserved || undefined, testWaitMs(5_000));
  client = connect({ path: join(f.root, 'git.sock'), allowHalfOpen: true });
  await once(client, 'connect', { signal: AbortSignal.timeout(testWaitMs(5_000)) });
  const reply = once(client, 'data', { signal: AbortSignal.timeout(testWaitMs(5_000)) });
  const started = Date.now();
  client.write(request('git-receive-pack'));
  try {
    const [packet] = await reply;
    assert.match(packet.toString(), /host-a: push retry required: another territory operation holds the lock(?: \(pid \d+\))?/);
    assert.ok(Date.now() - started >= 500, 'named 500 ms acquisition bound expires before refusal'); // lint-allow-wall-clock: native socket acquisition expiry is the behaviour under test; setup is separately bounded.
  } finally { await cleanup(); }
});
