// T2: native Unix listener allocation and close under a deep, multibyte TMPDIR; no child or hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, stat, access, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { tempProject } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { removeFixtureSockets, enableFixtureHostSockets, fixtureHostSocketDirectory } from '../../shared/fixture-sockets.ts';
import { dirname } from 'node:path';
import { hostPaths } from '../src/host/records.ts';

test('root disposal retires discarded nested host socket opt-ins before any allocation', async t => {
  const parent=await tempProject(t), nested=join(parent,'nested');
  await mkdir(nested);
  enableFixtureHostSockets(nested); // Deliberately discard the per-call disposer.
  await removeFixtureSockets(parent);
  assert.equal(fixtureHostSocketDirectory(nested,'unused'),undefined,'disposed opt-in cannot allocate new fixture storage');
});

test('a newer host socket opt-in survives completion of an older disposal', async t => {
  const parent=await tempProject(t),nested=join(parent,'replacement');
  await mkdir(nested);
  enableFixtureHostSockets(nested);
  const disposing=removeFixtureSockets(parent);
  enableFixtureHostSockets(nested);
  await disposing;
  assert.notEqual(fixtureHostSocketDirectory(nested,'fresh'),undefined,'old disposal must not retire the replacement grant');
});

test('suite disposal removes reciprocal aliases nested inside fake host storage', async t => {
  const root = await tempProject(t);
  const outer = fixtureSocketPath(root, 'outer');
  const nested = join(dirname(outer), 'machine');
  await mkdir(nested);
  const physical = await realpath(nested);
  const inner = fixtureSocketPath(physical, 'inner');
  await access(dirname(inner));
  try {
    await removeFixtureSockets(root);
    await assert.rejects(access(dirname(inner)), {code:'ENOENT'});
  } finally { await removeFixtureSockets(physical); }
});

test('scratch host sockets bind under deep roots within the shortest macOS path budget', async t => {
  const root = await tempProject(t), deep = join(root, 'é'.repeat(60));
  await mkdir(deep);
  enableFixtureHostSockets(deep);
  const paths = hostPaths(deep, 'host');
  assert.notEqual(paths.agentSocket, hostPaths(deep, 'other').agentSocket);
  await mkdir(paths.socketDirectory, {mode:0o700});
  for (const path of [paths.agentSocket, paths.gitSocket, paths.controlSocket, paths.sessionSocket('long'.repeat(100))]) {
    assert.ok(Buffer.byteLength(path)+1 <=104, path);
    const server = createServer();
    try {
      const listening = once(server,'listening'); server.listen(path); await listening;
      assert.equal((await stat(path)).isSocket(), true);
    } finally {
      if(server.listening){const closed=once(server,'close');server.close();await closed;}
    }
  }
  assert.ok(Buffer.byteLength(paths.controlSocket)+1+20 <=104, 'SSH control suffix budget');
});

test('fixture socket binds within the macOS byte budget under a deep multibyte TMPDIR', async t => {
  const root = await tempProject(t);
  const deep = join(root, 'é'.repeat(60));
  await mkdir(deep);
  assert.ok(Buffer.byteLength(deep) >= 90);
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = deep;
  const server = createServer();
  beforeDirectories(t, async () => {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    if (server.listening) {
      const closed = once(server, 'close', { signal: AbortSignal.timeout(5000) });
      server.close();
      await closed;
    }
  });
  const path = fixtureSocketPath(deep, '端'.repeat(60) + '.sock');
  assert.ok(Buffer.byteLength(path) + 1 < 104, path);
  assert.equal(fixtureSocketPath(deep, '端'.repeat(60) + '.sock'), path);
  assert.notEqual(fixtureSocketPath(deep, 'other.sock'), path);
  assert.notEqual(fixtureSocketPath(root, '端'.repeat(60) + '.sock'), path);
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(5000) });
  server.listen(path);
  await listening;
  assert.equal((await stat(path)).isSocket(), true);
});

test('fixture sockets have private directory ownership after normal listener close', async t => {
  const root = await tempProject(t);
  const path = fixtureSocketPath(root, 'private.sock');
  const { dirname } = await import('node:path');
  assert.equal((await stat(dirname(path))).mode & 0o777, 0o700);
});

test('fake host socket guard names oversized paths before native connect', async () => {
  const { fakeHostSocketPath } = await import('./fakes/fake-host-socket.ts');
  for (const home of ['/' + 'x'.repeat(104), '/' + 'é'.repeat(45)]) {
    const path = join(home, '.cland-host/run/agent.sock');
    assert.throws(() => fakeHostSocketPath(home), error => {
      assert.match((error as Error).message, /104-byte/);
      assert.ok((error as Error).message.includes(path));
      return true;
    });
  }
  const suffix = '/.cland-host/run/agent.sock';
  const home = '/' + 'x'.repeat(104 - 1 - suffix.length - 1);
  assert.equal(Buffer.byteLength(fakeHostSocketPath(home)) + 1, 104);
  assert.throws(() => fakeHostSocketPath(home + 'x'), /104-byte/);
});

test('fake host setup guards long names and retains short paths across independent readers', async t => {
  const { createFakeHost, fakeHost, hostDirectory, hostPath } = await import('./fakes/fake-host.ts');
  const root = await tempProject(t);
  const name = 'x'.repeat(104);
  const oversized = join(hostDirectory(root, name), 'home', '.cland-host/run/agent.sock');
  await assert.rejects(createFakeHost(root, name), error => {
    assert.ok((error as Error).message.includes(oversized));
    return true;
  });
  const host = await createFakeHost(root, 'one');
  assert.ok(Buffer.byteLength(join(host.run, 'agent.sock')) + 1 <= 104);
  const reader = await fakeHost({ CLAND_FAKE_HOST_ROOT: root, CLAND_FAKE_HOSTS: 'one' }, 'one');
  assert.equal(reader.home, host.home);
  assert.equal(await hostPath(host.home, '.cland-host/run/agent.sock'), join(host.run, 'agent.sock'));
  await assert.rejects(hostPath(host.home, '../escape'), /escapes home/);
});
