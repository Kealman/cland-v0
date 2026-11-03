// T1: token storage and expiry under an injected clock; no sockets or real time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { WebAuth, webSessionCookie } from '../src/hub/web-auth.ts';

test('links retain only a SHA-256 digest, spend once, and expire at five minutes', t => {
  const store = new Store();
  t.after(() => store.close());
  let now = 0;
  const links = new Map<string, number>();
  const auth = new WebAuth('/fixture/project', store, () => now, links);
  const token = auth.mint();
  assert.equal(Buffer.from(token, 'hex').length, 32);
  assert.deepEqual([...links], [[createHash('sha256').update(token).digest('hex'), 300_000]]);
  assert.ok(!links.has(token));
  now = 299_999;
  assert.ok(auth.redeem(token));
  assert.equal(auth.redeem(token), null);
  const expired = auth.mint();
  now += 300_000;
  assert.equal(auth.redeem(expired), null);
  assert.equal(auth.redeem('unknown'), null);
  assert.equal(links.size, 0);
});

test('cookie sessions last thirty days and use a project-specific name', t => {
  const store = new Store();
  t.after(() => store.close());
  let now = 0;
  const auth = new WebAuth('/fixture/project', store, () => now);
  assert.equal(auth.cookieName, 'cland_4c92ce3babb5');
  const cookie = auth.redeem(auth.mint())!;
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}`), true);
  assert.equal(auth.accepts(`other=${cookie}`), false);
  assert.equal(auth.accepts(`${auth.cookieName}=unknown`), false);
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}; ${auth.cookieName}=unknown`), false);
  now = 30 * 24 * 60 * 60 * 1000 - 1;
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}`), true);
  now++;
  assert.equal(auth.accepts(`${auth.cookieName}=${cookie}`), false);
});

// Persistence and digest-only storage are explicit acceptance seams (C1/C2).
test('cookie rows contain only a hash and timestamps and survive reopening the store', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-web-store-'));
  const path = join(root, 'hub.db');
  let store = new Store(path);
  let reader: DatabaseSync;
  t.after(() => { reader?.close(); store.close(); rmSync(root, { recursive: true, force: true }); });
  let now = 1000;
  const auth = new WebAuth(root, store, () => now);
  const token = auth.redeem(auth.mint())!;
  const cookie = `${auth.cookieName}=${token}`;
  reader = new DatabaseSync(path, { readOnly: true });
  const row = () => ({ ...reader.prepare('select * from web_sessions').get() });
  const original = row();
  assert.deepEqual(original, { id: original.id, cookie_hash: createHash('sha256').update(token).digest('hex'), created_at: 1000, last_used_at: 1000, user_id: null });
  assert.match(String(original.id), /^[a-f0-9-]{36}$/);
  assert.ok(!JSON.stringify(original).includes(token));
  store.close();
  store = new Store(path);
  const restarted = new WebAuth(root, store, () => now);
  now = 2000;
  assert.equal(restarted.accepts(cookie), true);
  assert.deepEqual(row(), { ...original, last_used_at: 2000 });
  now = 1000 + 30 * 24 * 60 * 60 * 1000;
  assert.equal(restarted.accepts(cookie), false, 'last use must not renew the original lifetime');
  assert.deepEqual(restarted.sessions(), []);
});

test('a user-bound link persists its user across store restart and profile reads', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-web-user-'));
  const path = join(root, 'hub.db');
  let store = new Store(path);
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const user = store.users.firstAdmin('Jane Doe', [], 1000);
  store.users.setMode('users', 1000);
  const auth = new WebAuth(root, store, () => 2000);
  const token = auth.redeem(auth.mint(user.id))!;
  const cookie = `${auth.cookieName}=${token}`;
  const id = auth.session(cookie)!;
  assert.equal(store.webSession(id)?.userId, user.id);
  store.close();
  store = new Store(path);
  const restored = new WebAuth(root, store, () => 3000);
  assert.equal(restored.session(cookie), id);
  assert.deepEqual(restored.profile(id).user, { id: user.id, name: 'jane-doe', displayName: 'Jane Doe', role: 'admin' });
  assert.throws(() => restored.mint('unknown'), /user/);
});


test('single-mode profile keeps the previous wire shape without a user', t => {
  const store = new Store();
  t.after(() => store.close());
  const auth = new WebAuth('/fixture/project', store, () => 1000);
  const cookie = `${auth.cookieName}=${auth.redeem(auth.mint())!}`;
  assert.deepEqual(auth.profile(auth.session(cookie)!), {
    createdAt: '1970-01-01T00:00:01.000Z', lastUsedAt: '1970-01-01T00:00:01.000Z', expiresAt: '1970-01-31T00:00:01.000Z',
  });
});


test('the cookie policy uses only configured origin and Host, including port', t => {
  const store = new Store();
  t.after(() => store.close());
  const auth = new WebAuth('/fixture/project', store, () => 0);
  for (const [origin, host, secure] of [
    ['', 'phone.example:8443', false],
    ['https://phone.example:8443', 'phone.example:8443', true],
    ['https://phone.example:8443', 'PHONE.EXAMPLE:8443', true],
    ['https://phone.example:8443', '127.0.0.1:8443', false],
    ['https://phone.example:8443', 'localhost:8443', false],
    ['https://phone.example:8443', '[::1]:8443', false],
    ['https://phone.example:8443', '192.0.2.10:8443', false],
    ['https://phone.example:8443', 'other.example:8443', false],
    ['https://phone.example:8443', 'phone.example', false],
    ['https://phone.example:8443', 'phone.example:9443', false],
    ['https://phone.example:8443', undefined, false],
  ] as const) {
    for (const requestOrigin of [undefined, 'https://foreign.example', origin]) {
      const req = { headers: { host, origin: requestOrigin, 'x-forwarded-host': 'phone.example:8443', 'x-forwarded-proto': 'https', forwarded: 'host=phone.example:8443;proto=https' } } as unknown as import('node:http').IncomingMessage;
      assert.equal(webSessionCookie(auth, 'fixture-token', req, origin), `${auth.cookieName}=fixture-token; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`);
    }
  }
});
