// T3: native Git over a Unix socket; scratch bare repositories only, no SSH or TCP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gitDaemonEnvironment } from '../src/host/git-daemon.ts';

test('daemon environment removes inherited write authority and pins receive policy', () => {
  const env = gitDaemonEnvironment('host-a', { PATH: '/bin', HOME: '/unused', CLAND_TERRITORY_WRITE: '1', GIT_DIR: '/wrong', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'receive.denyDeletes', GIT_CONFIG_VALUE_0: 'false', OPENAI_API_KEY: 'sentinel' });
  assert.equal(env.CLAND_TERRITORY_WRITE, undefined);
  assert.equal(env.CLAND_PUSH_HOST, 'host-a');
  assert.equal(env.GIT_DIR, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.GIT_CONFIG_COUNT, '4');
  const settings = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [env[`GIT_CONFIG_KEY_${i}`], env[`GIT_CONFIG_VALUE_${i}`]]));
  assert.deepEqual(settings, { 'receive.fsckObjects': 'true', 'receive.autogc': 'false', 'receive.denyDeletes': 'true', 'receive.maxInputSize': '134217728' });
});

import { mkdtemp, mkdir, writeFile, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fixtureEnvironment } from './fixture-environment.ts';
import { startGitDaemon } from '../src/host/git-daemon.ts';
import { grantBranchLease } from '../src/host/branch-leases.ts';
import { TERRITORY_HOOK } from '../src/territory.ts';
const exec = promisify(execFile);

test('proxy clones, pushes and fetches a large pack; protected refs and deletes stay guarded', { timeout: 60_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-git-'));
  let cleanup = async () => {};
  t.after(async () => { await cleanup(); await rm(root, { recursive: true, force: true }); });
  const env = fixtureEnvironment(root, process.env, {});
  await mkdir(env.HOME!, { recursive: true });
  const git = async (cwd: string, ...args: string[]) => (await exec('git', ['-c', 'gc.auto=0', ...args], { cwd, env: fixtureEnvironment(root, env, {}), timeout: 20_000, maxBuffer: 1024 * 1024 })).stdout.trim();
  await mkdir(join(root, '.cland'), { recursive: true });
  const territory = join(root, '.cland/territory.git');
  await git(root, 'init', '--bare', '--initial-branch=main', territory);
  await writeFile(join(territory, 'hooks/update'), TERRITORY_HOOK.replace('#!/bin/sh', `#!/bin/sh
printf '%s\\n' "\${CLAND_TERRITORY_WRITE-unset}" "$CLAND_PUSH_HOST" > hook-environment
git config --get-regexp '^receive[.]' >> hook-environment
echo private-hook-sentinel >&2`), { mode: 0o700 });
  const seed = join(root, 'seed');
  await git(root, 'init', '--initial-branch=main', seed);
  await writeFile(join(seed, 'one'), 'first');
  await git(seed, 'add', '.'); await git(seed, 'commit', '-m', 'seed');
  await git(seed, 'push', territory, 'HEAD:refs/heads/t/seed');
  await git(territory, 'symbolic-ref', 'HEAD', 'refs/heads/t/seed');
  const rows: Record<string, unknown>[] = [];
  const socket = join(root, 'git.sock');
  const listener = await startGitDaemon({ host: 'host-a', socket, territory, env: { ...env, CLAND_TERRITORY_WRITE: '1' }, log: row => rows.push(row) });
  cleanup = () => listener.close();
  const info = await stat(socket);
  assert.equal(info.isSocket(), true); assert.equal(info.mode & 0o777, 0o600);
  assert.equal(listener.address(), socket);
  const proxy = join(root, 'proxy');
  const source = fileURLToPath(new URL('../src/host/git-proxy.ts', import.meta.url));
  await writeFile(proxy, `#!/bin/sh\nexec '${process.execPath}' '${source}' '${socket}' "$@"\n`, { mode: 0o700 });
  const client = join(root, 'client');
  const url = 'git://territory/territory.git';
  await git(root, '-c', `core.gitProxy=${proxy}`, 'clone', url, client);
  await git(client, 'config', 'core.gitProxy', proxy);
  await git(client, 'checkout', '-b', 't/task');
  await writeFile(join(client, 'two'), 'task');
  await git(client, 'add', '.'); await git(client, 'commit', '-m', 'task');
  await grantBranchLease(root, 'host-a', 't/task');
  await git(client, 'push', 'origin', 't/task');
  const receipt = await readFile(join(territory, 'hook-environment'), 'utf8');
  assert.match(receipt, /^unset\nhost-a\n/);
  for (const setting of ['receive.fsckobjects true', 'receive.autogc false', 'receive.denydeletes true', 'receive.maxinputsize 134217728']) assert.ok(receipt.includes(setting));
  assert.equal(await git(territory, 'rev-parse', 't/task'), await git(client, 'rev-parse', 'HEAD'));
  for (const target of ['dev', 'main']) await assert.rejects(git(client, 'push', 'origin', `HEAD:refs/heads/${target}`), /host-a|protected|hook declined/);
  await assert.rejects(git(client, 'push', 'origin', ':refs/heads/t/task'), /deletion prohibited/);
  assert.equal(await git(territory, 'rev-parse', 't/task'), await git(client, 'rev-parse', 'HEAD'));
  const { randomBytes } = await import('node:crypto');
  const large = randomBytes(8 * 1024 * 1024);
  await writeFile(join(seed, 'large'), large);
  await git(seed, 'add', '.'); await git(seed, 'commit', '-m', 'large pack');
  await git(seed, 'push', territory, 'HEAD:refs/heads/t/large');
  await git(client, 'fetch', '--no-auto-maintenance', 'origin');
  await git(client, 'checkout', 'origin/t/large', '--', 'large');
  assert.deepEqual(await readFile(join(client, 'large')), large);
  await listener.close();
  assert.ok(rows.some(row => row.event === 'host-git-exit' && row.host === 'host-a' && row.code === 0 && typeof row.durationMs === 'number'));
  assert.equal(JSON.stringify(rows).includes('CLAND_TERRITORY_WRITE'), false);
  assert.equal(JSON.stringify(rows).includes('private-hook-sentinel'), false);
});

import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
async function until(predicate: () => boolean, label: string) {
  const deadline = Date.now() + 10_000;
  while (!predicate() && Date.now() < deadline) await delay(10); // lint-allow-wall-clock: bounded observation of native spawn/Unix EOF receipts; fake time cannot drive Git.
  assert.ok(predicate(), label);
}

test('eight admitted daemons per host; excess is refused, logged and close joins native exits', { timeout: 30_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-git-cap-'));
  const env = fixtureEnvironment(root, process.env, {});
  await mkdir(join(root, '.cland'), { recursive: true });
  const territory = join(root, '.cland/territory.git');
  await exec('git', ['-c', 'gc.auto=0', 'init', '--bare', territory], { env: fixtureEnvironment(root, env, {}), timeout: 10_000 });
  const rows: Record<string, unknown>[] = [];
  const socket = join(root, 'git.sock');
  const listener = await startGitDaemon({ host: 'host-cap', socket, territory, env, log: row => rows.push(row) });
  const clients: ReturnType<typeof connect>[] = [];
  t.after(async () => {
    for (const client of clients) client.destroy();
    await listener.close();
    await rm(root, { recursive: true, force: true });
  });
  for (let i = 0; i < 8; i++) {
    const client = connect({ path: socket, allowHalfOpen: true });
    client.write(gitRequest('git-upload-pack'));
    clients.push(client);
  }
  await until(() => rows.filter(row => row.event === 'host-git-start').length === 8, 'eight native launches observed');
  const extra = connect({ path: socket, allowHalfOpen: true }); clients.push(extra);
  let refused = false;
  extra.once('end', () => { refused = true; extra.end(); });
  extra.on('error', () => {});
  extra.resume();
  await until(() => refused, 'excess connection received EOF');
  assert.ok(rows.some(row => row.event === 'host-git-refused' && row.reason === 'capacity' && row.host === 'host-cap'));
  assert.equal(rows.filter(row => row.event === 'host-git-start').length, 8);
  await listener.close();
  const exits = rows.filter(row => row.event === 'host-git-exit');
  assert.equal(exits.length, 8);
  for (const row of exits) {
    assert.equal(row.host, 'host-cap');
    assert.equal(typeof row.durationMs, 'number');
    assert.ok(row.code === null || typeof row.code === 'number');
  }
  for (const row of rows.filter(row => row.event === 'host-git-start')) assert.throws(() => process.kill(row.pid as number, 0), /ESRCH/);
});

test('failed socket permissions drain admitted native children before reporting the original startup error', { timeout: 30_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-git-acquire-'));
  const env = fixtureEnvironment(root, process.env, {});
  await mkdir(join(root, '.cland'), { recursive: true });
  const territory = join(root, '.cland/territory.git');
  await exec('git', ['-c', 'gc.auto=0', 'init', '--bare', territory], { env: fixtureEnvironment(root, env, {}), timeout: 10_000 });
  const socket = join(root, 'git.sock');
  const rows: Record<string, unknown>[] = [];
  let modeEntered = false;
  let failMode!: () => void;
  const held = new Promise<void>((_done, fail) => { failMode = () => fail(new Error('injected chmod failure')); });
  let outcome: unknown;
  let settled = false;
  const startup = startGitDaemon({ host: 'host-fault', socket, territory, env, log: row => rows.push(row) }, async () => {
    modeEntered = true;
    await held;
  }).then(value => { outcome = value; settled = true; }, error => { outcome = error; settled = true; });
  let client: ReturnType<typeof connect> | undefined;
  t.after(async () => {
    failMode(); client?.destroy();
    await startup;
    if (!(outcome instanceof Error)) await (outcome as Awaited<ReturnType<typeof startGitDaemon>>).close();
    // Retain the scratch root if native drainage has no receipt, even on red.
    await until(() => rows.filter(row => row.event === 'host-git-start').length === rows.filter(row => row.event === 'host-git-exit').length, 'cleanup joins every admitted native child');
    await rm(root, { recursive: true, force: true });
  });
  await until(() => modeEntered, 'socket publication reached held permissions');
  client = connect({ path: socket, allowHalfOpen: true });
  client.write(gitRequest('git-upload-pack'));
  client.on('error', () => {}); client.resume();
  await until(() => rows.some(row => row.event === 'host-git-start' && typeof row.pid === 'number'), 'admitted native child before permission failure');
  failMode();
  await until(() => settled, 'failed acquisition reports after owned cleanup');
  assert.ok(outcome instanceof Error);
  assert.equal(outcome.message, 'injected chmod failure');
  const launched = rows.filter(row => row.event === 'host-git-start');
  const exits = rows.filter(row => row.event === 'host-git-exit');
  assert.equal(launched.length, 1); assert.equal(exits.length, 1);
  assert.equal(exits[0]!.connection, launched[0]!.connection);
  assert.equal(exits[0]!.host, 'host-fault');
  assert.throws(() => process.kill(launched[0]!.pid as number, 0), /ESRCH/);
  await assert.rejects(stat(socket), /ENOENT/);
});

function gitRequest(service: string): Buffer {
  const body = `${service} /territory.git\0host=territory\0`;
  return Buffer.from((Buffer.byteLength(body) + 4).toString(16).padStart(4, '0') + body);
}
