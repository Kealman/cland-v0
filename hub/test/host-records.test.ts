import { testHost } from '../src/host/test-host.ts';
// T2: host records, private secret files and real project startup; no native SSH.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { remoteRedactor } from '../src/remote/redact.ts';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, statSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFakeHost } from './fakes/fake-host.ts';
import { fakeHostSocketPath } from './fakes/fake-host-socket.ts';
import { beforeDirectories, ownDirectory } from './process-cleanup.ts';
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
for (const both of [true, false, 'root-only', 'suite-tmpdir'] as const) test(`C3 fake registration requires both variables: ${both}`, async t => {
  if (both === 'suite-tmpdir') {
    const suite = join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), `cland-suite-${randomUUID()}`);
    mkdirSync(suite, { mode: 0o700 });
    ownDirectory(t, suite);
    const previous = process.env.TMPDIR;
    process.env.TMPDIR = suite;
    beforeDirectories(t, () => {
      if (previous === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previous;
    });
  }
  const enabled = both === true || both === 'suite-tmpdir';
  const root = await hostProject(t), fakeRoot = join(root, 'fake');
  mkdirSync(fakeRoot);
  const hosts = await Promise.all(['f1', 'f2'].map(id => createFakeHost(fakeRoot, id)));
  const hub = await projectHub(t, root, { ...(both !== 'root-only' ? { CLAND_FAKE_HOSTS: 'f1,f2' } : {}), ...(both !== false ? { CLAND_FAKE_HOST_ROOT: fakeRoot } : {}) }, { hosts: enabled ? ['f1', 'f2'].map(id => testHost(id, () => {})) : [] });
  const ui = await connectUi(t, hub.discovery);
  const db = new DatabaseSync(join(root, '.cland', 'hub.db')); t.after(() => db.close());
  const rows = db.prepare('select * from hosts order by id').all();
  assert.equal(rows.length, enabled ? 2 : 0);
  if (!enabled) return;
  assert.deepEqual(rows.map(row => row.id), ['f1', 'f2']);
  const secret = readFileSync(hostPaths(root, 'f1').secret, 'utf8');
  assert.equal(rows[0]!.transport, 'ssh');
  for (const [index, id] of ['f1', 'f2'].entries()) {
    const host = hosts[index]!;
    const paths = hostPaths(root, id);
    assert.equal(readFileSync(paths.knownHosts, 'utf8'), `${id} ${host.key}\n`);
    const clientKey = readFileSync(paths.clientKeyPath, 'utf8');
    assert.equal(clientKey, join(host.directory, 'client-key'));
    assert.equal(readFileSync(clientKey, 'utf8'), 'FAKE CLIENT KEY\n');
    for (const socket of [fakeHostSocketPath(host.home), paths.agentSocket, paths.gitSocket, paths.controlSocket, paths.sessionSocket('session')]) {
      assert.ok(Buffer.byteLength(socket) + 1 <= 104, socket);
    }
  }
  const reply = await ui.request({ type: 'hub.status' });
  assert.equal(JSON.stringify(reply).includes(secret), false);
  await flushProjectLogs(t, root);
  for (const path of [join(root, '.cland/log/hub.log'), join(root, '.cland/journal.jsonl')]) if (existsSync(path)) assert.equal(readFileSync(path, 'utf8').includes(secret), false);
});

for (const existingHost of [false, true]) test(`Store upgrades existing remote tables alongside host records (existing host: ${existingHost})`, async t => {
  const root = await tempProject(t), path = join(root, 'hub.db');
  const legacy = new DatabaseSync(path);
  legacy.exec(`create table sentinel (value text); insert into sentinel values ('kept');
    create table remote_pairings (messenger text primary key, user_id text not null, chat_id text not null, guild_id text, name text not null);
    insert into remote_pairings values ('telegram','101','101',null,'Legacy Alice');
    create table remote_status (messenger text primary key, disabled integer not null, reason text);
    insert into remote_status values ('telegram',0,null);
    create table remote_outbox (messenger text not null, id text not null, kind text not null, source text, state text not null,
      payload text not null, created text not null, updated text not null, primary key(messenger,id));`);
  if (existingHost) {
    legacy.exec(`create table hosts (id text primary key, transport text not null, address text not null, user text not null, state text not null, secret_digest text not null)`);
    legacy.prepare('insert into hosts values (?,?,?,?,?,?)').run('f1', 'ssh', 'f1', 'agent', 'registered', createHash('sha256').update('synthetic-host-proof').digest('hex'));
  }
  legacy.close();
  let store = new Store(path); t.after(() => store.close());
  if (!existingHost) store.hosts.insert(input('f1'), 'synthetic-host-proof');
  const alice = store.users.firstAdmin('Alice', [], 1), bob = store.users.add('bob', 'Bob', [], 2);
  store.users.setMode('users', 3);
  const remote = store.remotes.forMessenger('telegram');
  assert.equal(remote.userPairing(alice.id)?.chatId, '101');
  remote.setUserPairing(bob.id, { userId: '202', chatId: '202', guildId: null, name: 'Bob' });
  store.close(); store = new Store(path);
  assert.equal(store.hosts.matches('f1', 'synthetic-host-proof'), true);
  assert.equal(store.remotes.forMessenger('telegram').userPairing(bob.id)?.chatId, '202');
  store.users.reset(4);
  assert.equal(store.remotes.forMessenger('telegram').pairing()?.chatId, '101');
  assert.equal(store.remotes.forMessenger('telegram').userPairing(bob.id), null);
  assert.equal(store.hosts.matches('f1', 'synthetic-host-proof'), true, 'user reset preserves host records');
  const db = new DatabaseSync(path); t.after(() => db.close());
  assert.equal(db.prepare('select value from sentinel').get()!.value, 'kept');
  assert.ok(db.prepare('pragma table_info(remote_outbox)').all().some(row => row.name === 'target'));
  assert.ok(db.prepare('pragma table_info(remote_status)').all().some(row => row.name === 'stop_cause'));
  assert.deepEqual(db.prepare('select user_id,chat_id,name from remote_pairings').all().map(row => ({ ...row })), [{ user_id: '101', chat_id: '101', name: 'Legacy Alice' }]);
});
