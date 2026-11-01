// T2: user invites through disposable projectHub frames and the human CLI; no native lifecycle assertion.
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { createServer, type Socket } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { uploadOwner } from './web-upload-owner.ts';
import { Users } from '../src/hub/users.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { cland, clandWithEnv, projectHub, tempProject, connectUi } from './harness.ts';

test('user add prints an edge invite for an invited admin', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Invites');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const logs: unknown[] = [];
  const hub = await projectHub(t, root, {}, { log: entry => { logs.push(entry); }, git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  const ui = await connectUi(t, hub.discovery);
  t.after(() => ui.close());
  const switched = await cland(root, 'auth', 'mode', 'users');
  assert.equal(switched.code, 0, switched.stderr);
  assert.match(switched.stdout, /\/invite\?token=[a-f0-9]{64}/);
  const added = await cland(root, 'user', 'add', 'alex', '--display', 'Alex Smith');
  assert.equal(added.code, 0, added.stderr);
  const url = new URL(added.stdout.trim().split('\n').at(-1)!);
  assert.equal(url.pathname, '/invite');
  const refused = await cland(root, 'user', 'add', 'reviewer');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /role/);
  const renewed = await cland(root, 'user', 'invite', 'alex');
  assert.equal(renewed.code, 0, renewed.stderr);
  assert.notEqual(renewed.stdout.trim().split('\n').at(-1), url.href);
  for (const output of [added.stdout, renewed.stdout, switched.stdout]) {
    const token = new URL(output.trim().split('\n').at(-1)!).searchParams.get('token')!;
    assert.equal(JSON.stringify(logs).includes(token), false);
    const journal = await ui.request({ type: 'events.list' });
    assert.equal(journal.ok, true);
    assert.equal(JSON.stringify(journal).includes(token), false);
  }
  const status = (await ui.request({ type: 'hub.status' })).value as { web: { port: number } };
  assert.equal(url.port, String(status.web.port));
  const result = (await ui.request({ type: 'user.list' })).value as { users: Array<{ name: string; displayName: string; role: string; state: string }> };
  assert.deepEqual(result.users.map(({ name, displayName, role, state }) => ({ name, displayName, role, state })).at(-1), { name: 'alex', displayName: 'Alex Smith', role: 'admin', state: 'invited' });
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    const users = new Users(db);
    assert.throws(() => users.checkInvite(url.searchParams.get('token')!, Date.now()), /revoked invite/);
    const fresh = new URL(renewed.stdout.trim().split('\n').at(-1)!).searchParams.get('token')!;
    assert.equal(users.checkInvite(fresh, Date.now()).name, 'alex');
    assert.equal((await cland(root, 'auth', 'reset')).code, 0);
    assert.throws(() => users.checkInvite(fresh, Date.now()), /revoked invite/);
  } finally { db.close(); }
});

test('auth switch CLI accepts the previous hub result without an invite URL', async t => {
  const root = await tempProject(t);
  const socket = fixtureSocketPath(root, 'old-hub.sock');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/hub.json'), JSON.stringify({ root, socket, port: 0, secret: 'test', pid: process.pid, version: 'test' }));
  const peers = new Set<Socket>();
  const server = createServer(peer => {
    peers.add(peer); peer.on('close', () => peers.delete(peer));
    let buffer = ''; peer.setEncoding('utf8');
    peer.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\n')) {
        const nl = buffer.indexOf('\n');
        const frame = JSON.parse(buffer.slice(0, nl)) as { type: string; id?: string };
        buffer = buffer.slice(nl + 1);
        if (frame.type === 'hello') peer.write(JSON.stringify({ type: 'welcome', name: 'cli', presence: [] }) + '\n');
        else peer.write(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { mode: 'users', user: { id: 'u', name: 'jane', displayName: 'Jane', role: 'admin', state: 'active', created: 1 } } }) + '\n');
      }
    });
  });
  beforeDirectories(t, async () => {
    for (const peer of peers) peer.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  await new Promise<void>(resolve => server.listen(socket, resolve));
  const result = await cland(root, 'auth', 'mode', 'users');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'jane  admin\n');
});


test('all auth and user commands refuse authenticated session shells before mutation', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Authority');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  const ui = await connectUi(t, hub.discovery);
  t.after(() => ui.close());
  assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 0);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  assert.equal(launched.ok, true, launched.error);
  const session = (launched.value as { process: { name: string; sessionId: string } }).process;
  const shell = { CLAND_SESSION_NAME: session.name, CLAND_SESSION_ID: session.sessionId, CLAND_LAUNCH_TOKEN: hub.fakes.codex!.spawns.at(-1)!.launchToken! };
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    const snapshot = () => [db.prepare('select * from users').all(), db.prepare('select * from user_invites').all(), db.prepare('select * from auth_state').all()];
    for (const args of [['user', 'add', 'alex'], ['user', 'invite', 'alex'], ['user', 'list'], ['auth', 'mode', 'users'], ['auth', 'reset']]) {
      const before = snapshot();
      const refused = await clandWithEnv(root, shell, ...args);
      assert.equal(refused.code, 1, args.join(' '));
      assert.match(refused.stderr, /local human shell/);
      assert.doesNotMatch(refused.stdout + refused.stderr, /\/invite\?token=/);
      assert.deepEqual(snapshot(), before, 'refusal retains users, invites and mode');
      const human = await cland(root, ...args);
      assert.equal(human.code, 0, human.stderr);
    }
  } finally { db.close(); }
});

test('failed auth reload fences invite commands until successful recovery', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Fence');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 0);
  const rolesPath = join(root, '.cland/roles.toml');
  const original = await readFile(rolesPath, 'utf8');
  await writeFile(rolesPath, '[broken');
  assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 1);
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    const before = db.prepare('select * from user_invites').all();
    for (const frame of [{ type: 'user.add', name: 'alex' }, { type: 'user.invite', name: 'jane-doe' }]) {
      await assert.rejects(askHubFrame(hub.discovery, frame, 5000, {}), /sign-in transition/);
      assert.deepEqual(db.prepare('select * from user_invites').all(), before);
      assert.equal(db.prepare("select count(*) as n from users where name='alex'").get()!.n, 0);
    }
    await writeFile(rolesPath, original);
    assert.equal((await cland(root, 'hub', 'reload')).code, 0);
    assert.equal((await cland(root, 'user', 'invite', 'jane-doe')).code, 0);
  } finally { db.close(); }
});

test('held reset refuses invite commands before users or invites change', async t => {
  const root = await tempProject(t);
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const uploadOpen: typeof open = async (...args) => {
    const handle = await open(...args), write = handle.writeFile.bind(handle);
    handle.writeFile = async (...args) => { entered.resolve(); await release.promise; return write(...args); };
    return handle;
  };
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Held');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { uploadOpen, git: async args => args.includes('user.name') ? 'Jane Doe\n' : '', log: entry => {
    if (entry.event === 'web-upload-cancelled') cancelled.resolve();
  } });
  const owner = uploadOwner(t, () => hub.stop(), () => release.resolve());
  let resetting: Promise<unknown> | undefined;
  const call = (frame: Parameters<typeof askHubFrame>[1]) => owner.track(askHubFrame(hub.discovery, frame, 5000, {}));
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    await call({ type: 'auth.mode', mode: 'users' });
    const { url } = await call({ type: 'web.link' }) as { url: string };
    const origin = new URL(url).origin;
    const response = await fetch(url, { redirect: 'manual' });
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const body = new FormData(); body.set('topic', 'general'); body.append('files', new Blob(['held']), 'held.txt');
    const upload = owner.post(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body });
    await owner.setup(entered.promise);
    resetting = call({ type: 'auth.reset' });
    await owner.setup(cancelled.promise);
    const before = db.prepare('select * from user_invites').all();
    for (const frame of [{ type: 'user.add', name: 'alex' }, { type: 'user.invite', name: 'jane-doe' }]) {
      await assert.rejects(call(frame), /sign-in transition/);
      assert.deepEqual(db.prepare('select * from user_invites').all(), before);
      assert.equal(db.prepare("select count(*) as n from users where name='alex'").get()!.n, 0);
    }
    release.resolve();
    await owner.join(resetting);
    await owner.join(upload);
    assert.equal(db.prepare("select count(*) as n from user_invites where state='open'").get()!.n, 0);
  } finally { release.resolve(); await resetting?.catch(() => {}); await owner.dispose(); db.close(); }
});
