// T2: host records, private secret files and real project startup; no native SSH.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { remoteRedactor } from '../src/remote/redact.ts';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, statSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { HostSecretStore, hostPaths } from '../src/host/records.ts';
import { tempProject, projectHub, connectUi, flushProjectLogs } from './harness.ts';

async function hostProject(t: TestContext): Promise<string> {
  const root = await tempProject(t);
  t.after(() => {
    for (const id of ['f1', 'f2']) {
      const paths = hostPaths(root, id);
      if (paths.socketDirectory !== paths.directory) rmSync(paths.socketDirectory, { recursive: true, force: true });
    }
  });
  return root;
}

const input = (id: string) => ({ id, address: id, user: 'agent', clientKeyPath: '/synthetic/client-key', knownHosts: `${id} ssh-ed25519 synthetic-${id}\n` });
test('C1 hosts table is additive and survives reopen with existing data', async t => {
  const root = await hostProject(t), path = join(root, 'hub.db');
  const legacy = new DatabaseSync(path);
  legacy.exec("create table sentinel (value text); insert into sentinel values ('kept')"); legacy.close();
  let store = new Store(path);
  new HostSecretStore(root, store.hosts).register(input('f1'));
  store.close(); store = new Store(path); t.after(() => store.close());
  assert.equal(store.hosts.get('f1')?.transport, 'ssh');
  const db = new DatabaseSync(path); t.after(() => db.close());
  assert.equal(db.prepare('select value from sentinel').get()?.value, 'kept');
});
test('C2 private files contain plaintext; database and public records contain only digest', async t => {
  const root = await hostProject(t), path = join(root, 'hub.db'), store = new Store(path);
  t.after(() => store.close());
  const redactor = remoteRedactor();
  const secrets = new HostSecretStore(root, store.hosts, redactor.register), record = secrets.register(input('f1'));
  const paths = hostPaths(root, 'f1'), secret = secrets.readSecret('f1');
  assert.equal(/^[a-f0-9]{64}$/.test(secret), true);
  assert.equal(statSync(paths.directory).mode & 0o777, 0o700);
  for (const file of [paths.secret, paths.knownHosts, paths.clientKeyPath]) assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(readFileSync(paths.knownHosts, 'utf8'), input('f1').knownHosts);
  assert.equal(JSON.stringify(record).includes(secret), false);
  const db = new DatabaseSync(path); t.after(() => db.close());
  assert.equal(JSON.stringify(db.prepare('select * from hosts').all()).includes(secret), false);
  assert.equal(db.prepare('select secret_digest from hosts where id=?').get('f1')?.secret_digest, createHash('sha256').update(secret).digest('hex'));
  assert.equal(store.hosts.matches('f1', secret), true);
  assert.equal(redactor(secret) === '[redacted]', true);
  const restored = remoteRedactor();
  assert.equal(restored(secret) === secret, true); // Positive control before loading private values.
  new HostSecretStore(root, store.hosts, restored.register).restore();
  assert.equal(restored(secret) === '[redacted]', true);
  assert.throws(() => secrets.register(input('f1')), /already registered/);
  assert.throws(() => hostPaths(root, '../escape'), /host id/);
});
test('C5 secrets are host-bound and revocation persists without automatic remint', async t => {
  const root = await hostProject(t), store = new Store(); t.after(() => store.close());
  const secrets = new HostSecretStore(root, store.hosts);
  secrets.register(input('f1')); secrets.register(input('f2'));
  const secret = secrets.readSecret('f1');
  assert.equal(store.hosts.matches('f2', secret), false);
  assert.equal(store.hosts.matches('missing', secret), false);
  store.hosts.revoke('f1');
  assert.equal(store.hosts.matches('f1', secret), false);
  assert.throws(() => secrets.readSecret('f1'), /unavailable/);
  assert.throws(() => secrets.register(input('f1')), /already registered/);
});
test('C4 deep project roots use deterministic short private socket paths', async t => {
  const root = await hostProject(t), deep = join(root, 'deep'.repeat(45));
  const paths = hostPaths(deep, 'f1');
  for (const path of [paths.agentSocket, paths.gitSocket, paths.controlSocket, paths.sessionSocket('session'.repeat(40))]) assert.ok(Buffer.byteLength(path) <= 100);
  assert.equal(paths.agentSocket, hostPaths(deep, 'f1').agentSocket);
  assert.notEqual(paths.agentSocket, hostPaths(deep, 'f2').agentSocket);
  assert.notEqual(paths.agentSocket, hostPaths(deep + 'x', 'f1').agentSocket);
});
for (const both of [true, false, 'root-only'] as const) test(`C3 fake registration requires both variables: ${both}`, async t => {
  const root = await hostProject(t), fakeRoot = join(root, 'fake');
  for (const id of ['f1', 'f2']) { mkdirSync(join(fakeRoot, id), { recursive: true }); writeFileSync(join(fakeRoot, id, 'host-key.pub'), `ssh-ed25519 synthetic-${id}\n`); }
  const hub = await projectHub(t, root, { ...(both !== 'root-only' ? { CLAND_FAKE_HOSTS: 'f1,f2' } : {}), ...(both !== false ? { CLAND_FAKE_HOST_ROOT: fakeRoot } : {}) });
  const ui = await connectUi(t, hub.discovery);
  const db = new DatabaseSync(join(root, '.cland', 'hub.db')); t.after(() => db.close());
  const rows = db.prepare('select * from hosts order by id').all();
  assert.equal(rows.length, both === true ? 2 : 0);
  if (both !== true) return;
  const secret = readFileSync(hostPaths(root, 'f1').secret, 'utf8');
  assert.equal(rows[0]!.transport, 'ssh');
  assert.equal(readFileSync(hostPaths(root, 'f1').knownHosts, 'utf8'), 'f1 ssh-ed25519 synthetic-f1\n');
  const reply = await ui.request({ type: 'hub.status' });
  assert.equal(JSON.stringify(reply).includes(secret), false);
  await flushProjectLogs(t, root);
  for (const path of [join(root, '.cland/log/hub.log'), join(root, '.cland/journal.jsonl')]) if (existsSync(path)) assert.equal(readFileSync(path, 'utf8').includes(secret), false);
});
