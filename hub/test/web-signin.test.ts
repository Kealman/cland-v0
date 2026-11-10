// T2: HTTP invite registration on a disposable in-process project hub; no native lifecycle assertions.
import test from 'node:test';
import { FakeClock } from './fake-clock.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { cland, projectHub, tempProject } from './harness.ts';

const httpFetch = (url: string | URL, init: Parameters<typeof fetch>[1] = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(5000) });

test('an invite registers a password and issues a user-bound cookie exactly once', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Sign in');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const logs: unknown[] = [];
  const hub = await projectHub(t, root, {}, { log: e => logs.push(e), git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  const switched = await cland(root, 'auth', 'mode', 'users');
  assert.equal(switched.code, 0, switched.stderr);
  const url = new URL(switched.stdout.trim().split('\n').at(-1)!);
  const token = url.searchParams.get('token')!;
  const details = await httpFetch(`${url.origin}/invite/details?token=${token}`, { method: 'POST', headers: { Origin: url.origin } });
  assert.equal(details.status, 200);
  assert.equal((await details.json()).name, 'jane-doe');
  const password = 'a long private password';
  const register = () => httpFetch(`${url.origin}/invite/register`, { method: 'POST', headers: { Origin: url.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }), redirect: 'manual' });
  const raced = await Promise.all([register(), register()]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 400]);
  const response = raced.find(r => r.status === 200)!;
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly; SameSite=Strict; Max-Age=2592000/);
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    assert.equal(db.prepare('select count(*) as n from web_sessions').get()!.n, 1);
    const user = db.prepare('select * from users').get()!;
    assert.equal(user.state, 'active');
    assert.equal(db.prepare('select user_id from web_sessions').get()!.user_id, user.id);
    const hash = String(db.prepare('select hash from user_passwords').get()!.hash);
    assert.match(hash, /^scrypt\$/);
    assert.equal(hash.includes(password), false);
  } finally { db.close(); }
  const reused = await register();
  assert.equal(reused.status, 400);
  assert.match(await reused.text(), /used invite/);
  assert.equal(reused.headers.get('set-cookie'), null);
  const usedDetails = await httpFetch(`${url.origin}/invite/details?token=${token}`, { method: 'POST', headers: { Origin: url.origin } });
  assert.equal(usedDetails.status, 400);
  assert.match(await usedDetails.text(), /used invite/);
  assert.equal(JSON.stringify(logs).includes(password), false);
  const events = await askHubFrame(hub.discovery, { type: 'events.list' }, 3000, {});
  assert.equal(JSON.stringify(events).includes(password), false);
});

test('invite admission refuses foreign origins, wrong methods, short passwords and unknown tokens without cookies', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Sign in'); config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '' });
  const switched = await cland(root, 'auth', 'mode', 'users');
  const invite = new URL(switched.stdout.trim().split('\n').at(-1)!);
  const token = invite.searchParams.get('token')!;
  for (const path of ['/invite?token=' + token, '/invite/details?token=' + token, '/invite/register']) {
    const response = await httpFetch(invite.origin + path, { method: path.includes('/invite?') ? 'GET' : 'POST', headers: { Origin: 'https://foreign.example' } });
    assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null);
  }
  const register = (password: string) => httpFetch(invite.origin + '/invite/register', { method: 'POST', headers: { Origin: invite.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
  const short = await register('short'); assert.equal(short.status, 400); assert.match(await short.text(), /12 characters/);
  const details = await httpFetch(`${invite.origin}/invite/details?token=${token}`, { method: 'POST', headers: { Origin: invite.origin } });
  assert.equal(details.status, 200, 'short password did not consume the invite');
  assert.equal((await details.json()).name, 'jane-doe');
  const unknown = await httpFetch(invite.origin + '/invite?token=unknown');
  assert.equal(unknown.status, 400); assert.match(await unknown.text(), /unknown invite/); assert.equal(unknown.headers.get('set-cookie'), null);
  const missingOrigin = await httpFetch(invite.origin + '/invite/register', { method: 'POST' }); assert.equal(missingOrigin.status, 403);
  const wrongHost = await new Promise<number>((resolve, reject) => {
    const req = request(invite.href, { headers: { Host: 'foreign.example' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
    req.setTimeout(2000, () => req.destroy(new Error('HTTP timeout'))); req.on('error', reject); req.end();
  }); assert.equal(wrongHost, 403);
  const renewed = await cland(root, 'user', 'invite', 'jane-doe'); assert.equal(renewed.code, 0);
  const revoked = await httpFetch(invite.href); assert.match(await revoked.text(), /revoked invite/);
  const fresh = new URL(renewed.stdout.trim().split('\n').at(-1)!);
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try { db.prepare('update user_invites set expires=0').run(); } finally { db.close(); }
  const expired = await httpFetch(fresh.href);
  assert.equal(expired.status, 400); assert.match(await expired.text(), /expired invite/); assert.equal(expired.headers.get('set-cookie'), null);
  const method = await httpFetch(invite.origin + '/invite/register', { headers: { Origin: invite.origin } });
  assert.equal(method.status, 405);
  assert.equal((await cland(root, 'auth', 'reset')).code, 0);
  for (const path of ['/invite', '/invite/details', '/invite/register']) assert.equal((await httpFetch(invite.origin + path, { method: 'POST' })).status, 404);
});

test('password sign-in hides credential failures and sign-out revokes only its browser', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Sign in'); config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const clock = new FakeClock(Date.now());
  const hub = await projectHub(t, root, {}, { clock, git: async () => 'Jane Doe\n' });
  const switched = await cland(root, 'auth', 'mode', 'users');
  const invite = new URL(switched.stdout.trim().split('\n').at(-1)!);
  const post = (path: string, body: unknown, cookie = '', origin = invite.origin) => httpFetch(invite.origin + path, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const password = 'private password for signin';
  assert.equal((await post('/invite/register', { token: invite.searchParams.get('token'), password })).status, 200);
  await askHubFrame(hub.discovery, { type: 'user.add', name: 'invited' }, 3000, {});
  assert.equal((await httpFetch(invite.origin, { redirect: 'manual' })).headers.get('location'), '/signin');
  const failures = [];
  for (const name of ['jane-doe', 'unknown', 'invited']) {
    const response = await post('/signin/password', { name, password: 'wrong' });
    assert.equal(response.status, 401); assert.equal(response.headers.get('set-cookie'), null);
    failures.push(await response.text());
  }
  assert.equal(new Set(failures).size, 1);
  assert.equal((await post('/signin/password', { name: 'jane-doe', password }, '', 'https://foreign.example')).status, 403);
  const login = async () => {
    const response = await post('/signin/password', { name: 'jane-doe', password });
    assert.equal(response.status, 200); return response.headers.get('set-cookie')!.split(';')[0]!;
  };
  const first = await login(); const second = await login();
  assert.equal((await post('/signout', {}, first, 'https://foreign.example')).status, 403);
  assert.equal((await post('/signout', {}, first)).status, 200);
  const status = async (cookie: string) => (await httpFetch(invite.origin + '/signin/status', { headers: { Cookie: cookie } })).json();
  assert.equal((await status(first)).required, true);
  assert.equal((await status(second)).required, false);
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await post('/signin/password', { name: 'jane-doe', password: 'wrong' })).status, 401);
  assert.equal((await post('/signin/password', { name: 'jane-doe', password })).status, 401, 'correct credential is delayed after five failures');
  assert.equal((await post('/signin/password', { name: 'another-name', password })).status, 401, 'address delay covers other names');
  clock.block(1000);
  await login();
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try { assert.equal(db.prepare('select count(*) as n from web_sessions').get()!.n, 3); } finally { db.close(); }
});
