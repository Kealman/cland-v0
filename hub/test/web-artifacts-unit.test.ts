// T1: capability persistence and filesystem reads without socket edges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { WebAuth } from '../src/hub/web-auth.ts';
import { WebArtifacts } from '../src/hub/web-artifacts.ts';

test('capability rows persist only digests and cascade away with revoked or expired sessions', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-capabilities-'));
  const path = join(root, 'hub.db');
  let store = new Store(path);
  const reader = new DatabaseSync(path, { readOnly: true });
  t.after(() => { reader.close(); store.close(); rmSync(root, { recursive: true, force: true }); });
  let now = 1000;
  const auth = new WebAuth(root, store, () => now);
  const cookie = auth.redeem(auth.mint())!;
  const session = auth.session(`${auth.cookieName}=${cookie}`)!;
  const a = store.registerArtifact(id => ({ id, title: 'Persisted file', kind: 'page', path: '/fixture/page.html', creator: 'human', creatorKind: 'human', topic: 'general', status: 'shared', time: new Date(now).toISOString() }), () => {});
  const prefix = { path: root, realPath: root };
  const capabilities = new WebArtifacts(store, auth, prefix);
  const { url } = capabilities.mint(session, a.id, 'http://127.0.0.1:1234');
  const token = new URL(url).pathname.split('/')[2]!;
  const hash = createHash('sha256').update(token).digest('hex');
  const rows = () => reader.prepare('select * from web_capabilities').all().map(row => ({ ...row }));
  assert.deepEqual(rows(), [{ capability_hash: hash, session_id: session, artifact_id: a.id }]);
  assert.ok(!JSON.stringify(rows()).includes(token));
  store.close();
  store = new Store(path);
  assert.deepEqual(store.webCapability(hash), { session, artifact: a.id });
  const reopened = new WebAuth(root, store, () => now);
  assert.equal(reopened.revoke(session), true);
  assert.deepEqual(rows(), []);
  const nextCookie = reopened.redeem(reopened.mint())!;
  const nextSession = reopened.session(`${reopened.cookieName}=${nextCookie}`)!;
  new WebArtifacts(store, reopened, prefix).mint(nextSession, a.id, 'http://127.0.0.1:1234');
  assert.equal(rows().length, 1);
  now += 30 * 24 * 60 * 60 * 1000;
  assert.equal(reopened.active(nextSession), false);
  assert.deepEqual(rows(), []);
});

test('paths outside the trusted project prefix retain full-path no-follow confinement', async t => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'cland-capability-prefix-')));
  const store = new Store(':memory:');
  t.after(() => { store.close(); rmSync(scratch, { recursive: true, force: true }); });
  const root = join(scratch, 'project');
  const outside = join(scratch, 'project-sibling');
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(join(outside, 'file.txt'), 'legacy artifact bytes');
  const alias = join(scratch, 'project-sibling-alias');
  symlinkSync(outside, alias);
  const auth = new WebAuth(root, store, () => 1000);
  const cookie = auth.redeem(auth.mint())!;
  const session = auth.session(`${auth.cookieName}=${cookie}`)!;
  const capabilities = new WebArtifacts(store, auth, { path: root, realPath: root });
  const read = async (path: string) => {
    const artifact = store.registerArtifact(id => ({ id, title: 'Legacy artifact', kind: 'file', path, creator: 'human', creatorKind: 'human', topic: 'general', status: 'shared', time: new Date(1000).toISOString() }), () => {});
    const { url } = capabilities.mint(session, artifact.id, 'http://127.0.0.1:1234');
    return capabilities.read(new URL(url).pathname);
  };
  assert.equal((await read(join(outside, 'file.txt')))?.body.toString(), 'legacy artifact bytes');
  assert.equal(await read(join(alias, 'file.txt')), null, 'an outside-prefix ancestor symlink is never canonicalized');
});
