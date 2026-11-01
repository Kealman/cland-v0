import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { uploadOwner } from './web-upload-owner.ts';
import { FakeClock } from './fake-clock.ts';
// T2: sign-in mode CLI and frames against a disposable in-process project hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, open, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig, parseConfig } from '../src/init/config.ts';
import { cland, projectHub, tempProject, connectUi } from './harness.ts';

test('switch creates one first admin, reload preserves it, and reset retains it behind single-mode refusal', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  const config = defaultConfig('Auth');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(path, renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  const before = await cland(root, 'user', 'list');
  assert.equal(before.code, 1);
  assert.match(before.stderr, /cland auth mode users/);
  const initialClient = await connectUi(t, hub.discovery);
  const oldLink = (await initialClient.request({ type: 'web.link' })).value as { url: string };
  const response = await fetch(oldLink.url, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(((await initialClient.request({ type: 'web.sessions' })).value as { sessions: unknown[] }).sessions.length, 1);
  const switched = await cland(root, 'auth', 'mode', 'users');
  assert.equal(switched.code, 0, switched.stderr);
  assert.match(switched.stdout, /jane-doe.*admin/);
  assert.equal(parseConfig(await readFile(path, 'utf8'), 'Auth', {}).auth.mode, 'users');
  assert.deepEqual(((await initialClient.request({ type: 'web.sessions' })).value as { sessions: unknown[] }).sessions, []);
  const first = await cland(root, 'user', 'list');
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /jane-doe.*Jane Doe.*admin.*active/);
  assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 0);
  assert.equal((await cland(root, 'hub', 'reload')).code, 0);
  assert.equal((await cland(root, 'user', 'list')).stdout, first.stdout);
  const ui = await connectUi(t, hub.discovery);
  t.after(() => ui.close());
  const collision = await ui.request({ type: 'session.launch', name: 'jane-doe', role: 'implementer' });
  assert.equal(collision.ok, false);
  assert.match(String(collision.error), /user name/);
  await writeFile(path, renderConfig(config));
  const refused = await ui.request({ type: 'hub.reload' });
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /cland auth reset/);
  const resetLink = (await ui.request({ type: 'web.link' })).value as { url: string };
  assert.equal((await fetch(resetLink.url, { redirect: 'manual' })).status, 302);
  const pendingLink = (await ui.request({ type: 'web.link' })).value as { url: string };
  const reset = await cland(root, 'auth', 'reset');
  assert.equal(reset.code, 0, reset.stderr);
  assert.deepEqual(((await ui.request({ type: 'web.sessions' })).value as { sessions: unknown[] }).sessions, []);
  assert.equal((await fetch(pendingLink.url, { redirect: 'manual' })).status, 401);
  assert.equal((await cland(root, 'user', 'list')).code, 1);
  assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 0);
  assert.equal((await cland(root, 'user', 'list')).stdout, first.stdout);
  await ui.close();
  await initialClient.close();
  await hub.stop();
  const restarted = await projectHub(t, root);
  assert.equal((await cland(root, 'user', 'list')).stdout, first.stdout);
  await restarted.stop();
  await writeFile(path, renderConfig(config));
  await assert.rejects(projectHub(t, root), /auth.mode is single.*1 users.*set auth.mode = "users".*start the hub.*cland auth reset/);
});

test('hand-edited users mode is refused before startup or reload can skip the authorized switch', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Manual');
  config.verification.lockPath = join(root, 'suite.lock');
  const path = join(root, '.cland/config.toml');
  await writeFile(path, renderConfig(config));
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  config.auth.mode = 'users';
  await writeFile(path, renderConfig(config));
  const result = await ui.request({ type: 'hub.reload' });
  assert.equal(result.ok, false);
  assert.match(String(result.error), /cland auth mode users/);
  await ui.close();
  await hub.stop();
  await assert.rejects(projectHub(t, root), /cland auth mode users/);
});

for (const expired of [false, true]) test(`reset fences admission and drains ${expired ? 'expired' : 'active'} native web owners`, async t => {
  const root = await tempProject(t);
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  let writerClosed = false;
  const uploadOpen: typeof open = async (...args) => {
    const handle = await open(...args), write = handle.writeFile.bind(handle), close = handle.close.bind(handle);
    handle.writeFile = async (...args) => { entered.resolve(); await release.promise; return write(...args); };
    handle.close = async () => { await close(); writerClosed = true; };
    return handle;
  };
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Drain');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const clock = new FakeClock(Date.now());
  const hub = await projectHub(t, root, {}, { clock, uploadOpen, log: entry => {
    if (entry.event === 'web-upload-cancelled') cancelled.resolve();
  } });
  const call = (frame: Parameters<typeof askHubFrame>[1]) => askHubFrame(hub.discovery, frame, 5000, {});
  const { url } = await call({ type: 'web.link' }) as { url: string };
  const origin = new URL(url).origin;
  const response = await fetch(url, { redirect: 'manual' });
  const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
  const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  const socketClosed = once(socket, 'close');
  t.after(() => socket.terminate());
  const owner = uploadOwner(t, () => hub.stop(), () => release.resolve());
  await owner.setup(once(socket, 'open'));
  const sessions = await call({ type: 'web.sessions' }) as { sessions: { sockets: number }[] };
  assert.equal(sessions.sessions[0]!.sockets, 1);
  const pending = await call({ type: 'web.link' }) as { url: string };
  const body = new FormData(); body.set('topic', 'general'); body.append('files', new Blob(['held']), 'held.txt');
  const upload = owner.post(`${origin}/upload`, { method: 'POST', headers: { cookie, origin }, body });
  try {
    await owner.setup(entered.promise);
    if (expired) {
      clock.block(31 * 24 * 60 * 60 * 1000);
      assert.deepEqual((await call({ type: 'web.sessions' }) as { sessions: unknown[] }).sessions, []);
    }
    let finished = false;
    const resetting = owner.track(call({ type: 'auth.reset' }).then(value => { finished = true; return value; }));
    await owner.setup(cancelled.promise);
    assert.equal(finished, false, 'the stopped upload is still owned while its writer is held');
    await assert.rejects(call({ type: 'web.link' }), /sign-in.*transition|reset/);
    assert.equal((await fetch(pending.url, { redirect: 'manual' })).status, 401);
    release.resolve();
    await owner.join(resetting);
    await owner.join(socketClosed);
    await owner.join(upload);
    assert.equal(writerClosed, true);
    assert.deepEqual((await call({ type: 'web.sessions' }) as { sessions: unknown[] }).sessions, []);
  } finally { await owner.dispose(); }
});

for (const mode of ['single', 'users'] as const) test(`failed ${mode} transition keeps admission fenced until a successful recovery reload`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Recovery');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  if (mode === 'single') assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 0);
  const rolesPath = join(root, '.cland/roles.toml');
  const original = await readFile(rolesPath, 'utf8');
  await writeFile(rolesPath, '[broken');
  const failed = await cland(root, 'auth', ...(mode === 'single' ? ['reset'] : ['mode', 'users']));
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /roles.toml/);
  await assert.rejects(askHubFrame(hub.discovery, { type: 'web.link' }, 2000, {}), /sign-in transition/);
  await writeFile(rolesPath, original);
  assert.equal((await cland(root, 'hub', 'reload')).code, 0);
  const link = await askHubFrame(hub.discovery, { type: 'web.link' }, 2000, {}) as { url: string };
  assert.equal((await fetch(link.url, { redirect: 'manual' })).status, 302);
  assert.equal(parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'Recovery', {}).auth.mode, mode);
});

test('local and cookie-authenticated human requests audit their user, including web impersonation refusal', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('User audit');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const audits: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '', log: entry => { if (entry.event === 'audit') audits.push(entry); } });
  const local = await connectUi(t, hub.discovery);
  t.after(() => local.close());
  await local.request({ type: 'hub.status' });
  assert.equal(audits.at(-1)?.userId, undefined);
  assert.equal((await cland(root, 'auth', 'mode', 'users')).code, 0);
  const users = (await local.request({ type: 'user.list' })).value as { users: Array<{ id: string }> };
  const userId = users.users[0]!.id;
  await local.request({ type: 'hub.status' });
  assert.equal(audits.at(-1)?.userId, userId);
  assert.equal((await cland(root, 'hub', 'status')).code, 0);
  assert.equal(audits.at(-1)?.userId, userId);
  const link = await cland(root, 'web', '--no-open');
  assert.equal(link.code, 0, link.stderr);
  const url = link.stdout.trim();
  const response = await fetch(url, { redirect: 'manual' });
  const origin = new URL(url).origin;
  // Seed a second sign-in at the persisted authentication boundary; invite creation is another item.
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    db.prepare('insert into users values (?,?,?,?,?,?)').run('second-user', 'alex', 'Alex Smith', 'admin', 'active', Date.now());
    db.prepare('insert into web_sessions (id,cookie_hash,created_at,last_used_at,user_id) values (?,?,?,?,?)')
      .run('second-session', createHash('sha256').update('second-cookie').digest('hex'), Date.now(), Date.now(), 'second-user');
  } finally { db.close(); }
  assert.equal(response.status, 302);
  const cookieName = response.headers.get('set-cookie')!.split('=')[0]!;
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: `${cookieName}=second-cookie` } });
  t.after(() => ws.terminate());
  const { frameClient } = await import('./harness.ts');
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(3000) });
  const welcomed = client.waitFor(f => f.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web', userId: 'forged' });
  assert.equal((await welcomed).name, 'alex');
  const profile = (await client.request({ type: 'web.session', userId: 'forged' })).value as { user: unknown };
  assert.deepEqual(profile.user, { id: 'second-user', name: 'alex', displayName: 'Alex Smith', role: 'admin' });
  assert.equal(audits.at(-1)?.userId, 'second-user');
  assert.equal((await client.request({ type: 'hub.status', as: { name: 'forged' } })).ok, false);
  assert.equal(audits.at(-1)?.userId, 'second-user');
});
