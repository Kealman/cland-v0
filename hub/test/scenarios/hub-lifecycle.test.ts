// T3 scenario: start, discovery, stop grace, restart and orphan sweep.
// Rule coverage (T1/T2): hub/test/project-probes.test.ts, hub/test/bridge-grace.test.ts.
// Hub process starts: 11: skeleton 1, fallback 1, stop 1, grace 2, spoke restart 2, sweep modes 4; discovery uses projectHub. Only one hub is live at a time.
import { beforeDirectories, ownProcess } from '../process-cleanup.ts';
import { test } from 'node:test';
import { Socket } from 'node:net';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fixtureWork } from '../fixture-work.ts';
import { testWaitMs } from '../until.ts';
import { within } from '../../src/executor/droplet/deadline.ts';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PROTOCOL_VERSION } from '../../src/protocol.ts';
import { SOCKET_PATH_MAX } from '../../src/project.ts';
import { cland, clandWithEnv, connectSocket, killDaemon, pidAlive, nativeProjectHub as projectHub, readDiscovery, eventually, spawnSpoke, startDaemon, tempProject } from '../harness.ts';

test('cland hub start creates the .cland skeleton and the discovery file', async (t) => {
  const root = await tempProject(t);
  const { result, discovery } = await startDaemon(t, root, {}, { sweep: true });
  assert.match(result.stdout, new RegExp(`hub started for ${root}`));

  assert.deepEqual(Object.keys(discovery).sort(), ['pid', 'port', 'root', 'secret', 'socket', 'version', 'webPort']);
  assert.equal(discovery.root, root);
  assert.equal(typeof discovery.port, 'number');
  assert.match(discovery.secret, /^[0-9a-f]{64}$/);
  assert.equal(typeof discovery.socket, 'string');
  assert.equal((await stat(discovery.socket)).isSocket(), true);

  const secretFile = join(root, '.cland', 'secret');
  assert.equal((await readFile(secretFile, 'utf8')).trim(), discovery.secret);
  assert.equal((await stat(secretFile)).mode & 0o777, 0o600);
  assert.equal((await stat(join(root, '.cland', 'hub.json'))).mode & 0o777, 0o600);
  assert.equal((await stat(join(root, '.cland', 'hub.db'))).isFile(), true);

  const gitignore = await readFile(join(root, '.cland', '.gitignore'), 'utf8');
  assert.match(gitignore.split('\n')[0] ?? '', /^# managed by cland/);
  const patterns = gitignore.split('\n').filter((l) => l && !l.startsWith('#'));
  const recoveryPatterns = ['tasks/*.conflict', 'tasks/.criterion-capture-*.json'];
  for (const p of ['hub.db*', 'hub.json', 'hub.sock', 'secret', 'journal.jsonl', 'log/', 'artifacts/', 'worktrees/', 'territory.git/', 'scratch/', 'qa/', ...recoveryPatterns]) assert.ok(patterns.includes(p), `ignores ${p}`);
  for (const kept of ['tasks', 'roles.toml', 'config.toml', '.gitignore']) assert.ok(!patterns.some((p) => p.startsWith(kept) && !recoveryPatterns.includes(p)), `does not ignore ${kept}`);
  assert.ok(pidAlive(discovery.pid), 'the daemon outlives the `cland hub start` that spawned it');
});

function socketResource() {
  const socket = new Socket();
  const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
  socket.on('error', () => {});
  return { socket, closed };
}

async function closeSocket(resource: ReturnType<typeof socketResource>) {
  resource.socket.destroy();
  await resource.closed;
}

test('cland hub start publishes and serves a fallback socket when the project and TMPDIR paths exceed the limit', async t => {
  await fixtureWork(t).run(async work => {
    const root = await work.root(() => tempProject(t, `cland-fallback-${'a'.repeat(SOCKET_PATH_MAX)}-`));
    const primary = join(root, '.cland', 'hub.sock');
    assert.ok(Buffer.byteLength(primary) > SOCKET_PATH_MAX);
    assert.ok(Buffer.byteLength(root) > SOCKET_PATH_MAX, 'the child TMPDIR also forces the /tmp fallback');
    const { discovery } = await work.acquire(() => startDaemon(t, root, { TMPDIR: root }), daemon => killDaemon(daemon.discovery.pid));
    assert.notEqual(discovery.socket, primary);
    assert.equal(dirname(discovery.socket), '/tmp');
    assert.ok(Buffer.byteLength(discovery.socket) <= SOCKET_PATH_MAX);
    assert.equal((await work.step(() => stat(discovery.socket))).isSocket(), true);
    await work.step(() => assert.rejects(stat(primary), { code: 'ENOENT' }));

    // Own the native socket before starting setup, so an aborted connect is destroyed and joined.
    const { socket } = await work.acquire(async () => socketResource(), closeSocket);
    await work.step(async () => {
      const signal = AbortSignal.any([work.signal, AbortSignal.timeout(testWaitMs(5000))]);
      const connected = once(socket, 'connect', { signal });
      socket.connect(discovery.socket);
      try { await connected; }
      catch (cause) { throw new Error('fallback socket setup failed or exceeded its deadline', { cause }); }
    });
    const lines = await work.acquire(async () => createInterface({ input: socket }), async reader => reader.close());
    await work.step(async () => {
      const welcome = once(lines, 'line', { signal: AbortSignal.any([work.signal, AbortSignal.timeout(testWaitMs(5000))]) });
      socket.write(`${JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'nvim' })}\n`);
      assert.equal(JSON.parse((await welcome)[0]).type, 'welcome', 'the published fallback serves the authenticated hub protocol');
    });
  });
});

test('fallback socket fixture cancellation adopts a late client before removing its root', async t => {
  const entered = Promise.withResolvers<void>(), released = Promise.withResolvers<void>();
  const draining = Promise.withResolvers<void>(), finish = Promise.withResolvers<void>();
  let root: string | undefined;
  let client: ReturnType<typeof socketResource> | undefined;
  let laterAdmission = false;
  let running: Promise<void> | undefined;
  let owner: ReturnType<typeof fixtureWork> | undefined;
  const releaseAndJoin = async () => {
    released.resolve(); finish.resolve();
    await owner?.dispose();
    await running?.catch(() => {});
  };
  beforeDirectories(t, releaseAndJoin);
  owner = fixtureWork(t);
  owner.release(() => released.resolve());
  running = owner.run(async work => {
    root = await work.root(() => tempProject(t));
    await work.acquire(async () => {
      client = socketResource();
      entered.resolve();
      await released.promise;
      draining.resolve();
      await finish.promise;
      return client;
    }, closeSocket);
    laterAdmission = true;
  });
  const failed = assert.rejects(running, /fixture work admission closed/);
  void failed.catch(() => {});
  try {
    await within(entered.promise, testWaitMs(5000));
    const removing = owner.dispose();
    void removing.catch(() => {});
    await within(draining.promise, testWaitMs(5000));
    assert.ok(root);
    assert.equal((await stat(root)).isDirectory(), true, 'pending acquisition retains the root');
    finish.resolve();
    await within(Promise.all([failed, removing]), testWaitMs(5000));
    assert.ok(client);
    await client.closed;
    assert.equal(client.socket.destroyed, true, 'late socket is closed and joined');
    assert.equal(laterAdmission, false, 'cancellation fences subsequent steps');
    await assert.rejects(stat(root), { code: 'ENOENT' });
  } finally { await releaseAndJoin(); }
});

test('a spoke started in the project with no hub environment connects through the discovery file; status shows it from another process', async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root);
  // a session started deeper in the tree walks up to the project's .cland/
  const sub = join(root, 'src', 'deep');
  await mkdir(sub, { recursive: true });
  const spoke = await spawnSpoke({ discover: true, cwd: sub, name: 'alpha', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['alpha']);
  assert.match(spoke.log(), /found the hub through .*\.cland\/hub\.json/);

  const json = await cland(root, 'hub', 'status', '--json');
  assert.equal(json.code, 0, json.stderr);
  const status = JSON.parse(json.stdout) as { pid: number; sessions: Array<{ name: string; role: string | null; cwd: string }> };
  assert.deepEqual(status.sessions.map((p) => [p.name, p.role, p.cwd]), [['alpha', 'implementer', sub]]);

  const human = await cland(sub, 'hub', 'status');
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, new RegExp(`^hub running for ${root}\\n`));
  assert.match(human.stdout, new RegExp(`pid +${status.pid}\\n`));
  assert.match(human.stdout, /uptime +\d+s/);
  assert.match(human.stdout, /version +[^\n]+\n {2}web +http:\/\/127\.0\.0\.1:\d+\/\nsessions: 1\n/);
  // the name shows with its role, as everywhere (spec 4.4)
  assert.match(human.stdout, /sessions: 1\n {2}alpha \[Implementer\] {2}\[unknown\]\n/);
  assert.match(human.stdout, /\nno coordinator\n/);
});

test('cland hub stop ends the daemon and removes hub.json and the socket', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, {}, { sweep: true });
  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.match(stopped.stdout, new RegExp(`hub stopped for ${root} \\(pid ${discovery.pid}\\)`));
  await eventually('stopped daemon PID is gone', () => !pidAlive(discovery.pid), 3000);
  assert.equal(pidAlive(discovery.pid), false);
  await assert.rejects(stat(join(root, '.cland', 'hub.json')), { code: 'ENOENT' });
  await assert.rejects(stat(discovery.socket), { code: 'ENOENT' });
  // what is meant to stay, stays
  assert.equal((await readFile(join(root, '.cland', 'secret'), 'utf8')).trim(), discovery.secret);
  assert.equal((await stat(join(root, '.cland', 'hub.db'))).isFile(), true);

  const status = await cland(root, 'hub', 'status');
  assert.equal(status.code, 1);
  assert.equal(status.stdout, `no hub running for ${root}\n`);
  const again = await cland(root, 'hub', 'stop');
  assert.equal(again.code, 0);
  assert.equal(again.stdout, `no hub running for ${root}\n`);
});

test('a deliberate stop defers an attached Neovim autostarter so the CLI restart serves first', async t => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root);
  const client = await connectSocket(first.discovery.socket);
  t.after(() => client.close());
  client.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: first.discovery.secret, client: 'nvim' });
  assert.equal((await client.next()).type, 'welcome');
  // The fake workbench reacts at the earliest possible boundary: the socket closing during shutdown.
  const autostart = client.closed.then(() => cland(root, 'hub', 'start', '--autostart', '--client', 'nvim'));
  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  const automatic = await autostart;
  assert.equal(automatic.code, 0, automatic.stderr);
  assert.match(automatic.stdout, /autostart deferred/);
  const inFlight = await cland(root, 'hub', 'serve', '--autostart', '--client', 'nvim');
  assert.equal(inFlight.code, 0, inFlight.stderr);
  assert.match(inFlight.stdout, /autostart deferred/, 'the daemon also checks grace under its startup lock');
  await assert.rejects(readDiscovery(root), { code: 'ENOENT' });
  const restart = await startDaemon(t, root);
  assert.match(restart.result.stdout, /hub started for/);
  assert.notEqual(restart.discovery.pid, first.discovery.pid);
  await assert.rejects(stat(join(root, '.cland', 'run', 'hub-stop.json')), { code: 'ENOENT' }, 'explicit restart clears grace');
  const journal = await cland(root, 'hub', 'journal', '--kind', 'hub-started', '--json');
  const starts = journal.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(starts.length, 2, 'only the original hub and the explicit CLI restart served');
  assert.deepEqual(starts[1].starter, { client: 'cli', parentPid: process.pid, cwd: root });
});

test('a spoke follows its hub through a restart: the discovery file is read again on reconnect', async (t) => {
  const root = await tempProject(t);
  const first = await startDaemon(t, root, {}, { sweep: true });
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'alpha' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['alpha']);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const second = await startDaemon(t, root, {}, { sweep: true });
  assert.notEqual(second.discovery.pid, first.discovery.pid);
  assert.equal(second.discovery.secret, first.discovery.secret, 'the secret is kept across restarts');
  await spoke.waitForPresence(['alpha']);
  const status = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout) as { sessions: Array<{ name: string }> };
  assert.deepEqual(status.sessions.map((p) => p.name), ['alpha']);
});

test('fixture startup skips orphan inspection by default; opt-in and production startup still sweep', async t => {
  for (const mode of ['fixture', 'opt-in', 'production', 'override'] as const) {
    const root = await tempProject(t);
    const trace = join(root, 'inspection.jsonl');
    await writeFile(trace, '');
    const preload = join(root, 'inspection.mjs');
    await writeFile(preload, `import cp from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const spawn = cp.spawn;
cp.spawn = function(command, args, options) {
  if (['ps', 'lsof'].includes(command)) appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ command, args }) + '\\n');
  return spawn(command, args, options);
};
syncBuiltinESMExports();
`);
    const env = { NODE_OPTIONS: `--import=${preload}` };
    const { discovery } = mode === 'production'
      ? await (async () => {
        const { clandWithEnv } = await import('../harness.ts');
        const result = await clandWithEnv(root, env, 'hub', 'start');
        assert.equal(result.code, 0, result.stderr);
        const discovery = await readDiscovery(root);
        ownProcess(t, discovery.pid);
        return { discovery };
      })()
      : await startDaemon(t, root, mode === 'override' ? { ...env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1' } : env, { sweep: mode !== 'fixture' });
    const skipped = mode === 'fixture' || mode === 'override';
    await eventually('startup sweep decision is logged', async () => {
      const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
      return log.includes(`"event":"orphan-sweep-${skipped ? 'skipped' : 'completed'}"`) ? true : undefined;
    });
    const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
    assert.equal(log.includes('"event":"orphan-sweep-started"'), !skipped);
    const inspections = (await readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { command: string; args: string[] });
    const scans = inspections.filter(row => row.command === 'lsof' || row.args.includes('-e') || row.args.some(arg => arg.includes('-ax')));
    assert.equal(scans.length > 0, !skipped, JSON.stringify(inspections));
    await killDaemon(discovery.pid);
  }
});
