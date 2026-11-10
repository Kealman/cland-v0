import { settledLogin } from './settled-login-fixture.ts';
// T2: pool placement through session frames with provided Hosts and fake harnesses; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onCleanup } from './process-cleanup.ts';
import { projectHub, tempProject, eventually, inProcessSpoke } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { sessionLine } from '../src/cli/session.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { Store } from '../src/hub/store.ts';

async function fixture(t: test.TestContext, log?: (entry: Record<string, unknown>) => void) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nslots=1\n[hosts.other]\nprovider="fake"\nslots=1\n');
  const roles = (pool: string) => writeFile(join(root, '.cland/roles.toml'), `[implementer.launch]\npool="${pool}"\n`);
  await roles('agents');
  const local = localHost(fixtureEnvironment(root, process.env));
  const hosts = ['a', 'b', 'c'].map(name => ({ ...testHost(name, () => {}), realpath: local.realpath, statDirectory: async () => ({ refusal: null, identity: null }) }));
  const hub = await projectHub(t, root, {}, { hosts, ...(log ? { log } : {}) });
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, () => store.close());
  for (const [id, pool] of [['a', 'agents'], ['b', 'agents'], ['c', 'other']] as const) {
    settledLogin(store.hosts.logins,id,'codex',{provider:'provided-fixture',region:'fake'});
    new HostSecretStore(root, store.hosts, () => {}).register({ id, address: id, user: 'fixture', clientKeyPath: '', knownHosts: '' });
    store.hosts.provisions.ready({ id, pool, provider: 'provided-fixture', size: 'fake', region: 'fake', created: new Date().toISOString(), state: 'ready', machine: { id, address: id, architecture: 'x86_64', created: new Date().toISOString() } });
  }
  await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n' + await readFile(join(root, '.cland/config.toml'), 'utf8'));
  const ui = await sessionUi(t, hub.discovery);
  const launch = (name: string, host?: string) => ui.request({ type: 'session.launch', name, role: 'implementer', harness: 'codex', ...(host ? { host } : {}) });
  return { root, hub, ui, roles, launch, store, hosts };
}
test('C1 pool launch uses a ready member and session list names its host', async t => {
  const f = await fixture(t);
  const result = await f.launch('worker');
  assert.equal(result.ok, true, result.error);
  assert.equal(f.hub.fakes.codex!.spawns[0]!.host, 'a');
  const list = await f.ui.request({ type: 'session.list' });
  const process = (list.value as { processes: import('../src/protocol.ts').HarnessProcessView[] }).processes[0]!;
  assert.equal(process.host, 'a');
  assert.match(sessionLine(process), /host a/);
  const { host: _host, login: _login, ...legacy } = process;
  assert.match(sessionLine(legacy), /host local/);
});

test('C2 legacy and explicit local pool launches stay local', async t => {
  const f = await fixture(t);
  for (const [name, source] of [['legacy', ''], ['local', '[implementer.launch]\npool="local"']]) {
    await writeFile(join(f.root, '.cland/roles.toml'), source!);
    const result = await f.launch(name!);
    assert.equal(result.ok, true, result.error);
    assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host, 'local');
  }
});

test('C3 dense fills the fuller host; live spread configuration uses the emptiest', async t => {
  const f = await fixture(t);
  for (const name of ['one', 'two', 'three']) assert.equal((await f.launch(name)).ok, true);
  assert.deepEqual(f.hub.fakes.codex!.spawns.map(p => p.host), ['a', 'a', 'b']);
  const changed = await f.ui.request({ type: 'config.set', key: 'hosts.agents.spread', value: true });
  assert.equal(changed.ok, true, changed.error);
  assert.equal((await f.launch('four')).ok, true);
  assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host, 'b');
});

test('C4 missing pool refuses before reservation/spawn and names configured pools', async t => {
  const f = await fixture(t);
  await f.roles('missing');
  const holders = (value: unknown) => (value as { roles: Array<{ holders: unknown[] }> }).roles.map(r => r.holders);
  const before = await f.ui.request({ type: 'role.list' });
  const refused = await f.launch('worker');
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /unknown host pool missing.*local.*agents.*other/);
  assert.equal(f.hub.fakes.codex!.spawns.length, 0);
  assert.deepEqual(holders((await f.ui.request({ type: 'role.list' })).value), holders(before.value));
  await f.roles('agents');
  assert.equal((await f.launch('worker')).ok, true);
});

test('C5 changing role pool moves the next launch without restart', async t => {
  const f = await fixture(t);
  assert.equal((await f.launch('first')).ok, true);
  await f.roles('other');
  assert.equal((await f.launch('second')).ok, true);
  assert.deepEqual(f.hub.fakes.codex!.spawns.map(p => p.host), ['a', 'c']);
});

test('C6 explicit host bypasses missing role pool but refuses a full pinned host', async t => {
  const f = await fixture(t);
  await f.roles('missing');
  for (const name of ['first', 'second']) assert.equal((await f.launch(name, 'c')).ok, true);
  const full = await f.launch('third', 'c');
  assert.equal(full.ok, false);
  assert.match(String(full.error), /host c has no room/);
  assert.deepEqual(f.hub.fakes.codex!.spawns.map(p => p.host), ['c', 'c']);
  assert.equal((await f.launch('third', 'local')).ok, true);
});

test('pool with no ready member waits without spawning', async t => {
  const f = await fixture(t);
  for (const id of ['a', 'b']) f.store.hosts.revoke(id);
  const result = await f.launch('worker');
  assert.equal(result.ok, true, result.error);
  assert.equal((result.value as { waiting: { reason: string } }).waiting.reason, 'waiting for a host');
  assert.equal(f.hub.fakes.codex!.spawns.length, 0);
});

test('concurrent launches promise capacity and stop releases used weight', async t => {
  const f = await fixture(t);
  const results = await Promise.all(['one', 'two', 'three', 'four', 'five'].map(name => f.launch(name)));
  assert.equal(results.filter(r => r.ok).length, 5);
  assert.equal(results.filter(r => (r.value as { waiting?: unknown }).waiting).length, 1);
  const stopped = await f.ui.request({ type: 'session.stop', session: 'one' });
  assert.equal(stopped.ok, true, stopped.error);
  await eventually('waiting fifth launch placed', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { waiting: unknown[] };
    return list.waiting.length === 0 ? true : undefined;
  });
  assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host, 'a');
});

test('failed adapter spawn releases its promised capacity for a subsequent launch', async t => {
  const f = await fixture(t);
  const adapter = f.hub.fakes.codex!;
  const spawn = adapter.spawn.bind(adapter);
  adapter.spawn = async () => { throw new Error('fixture spawn refused'); };
  const failed = await f.launch('failed', 'c');
  assert.equal(failed.ok, false);
  assert.match(String(failed.error), /fixture spawn refused/);
  adapter.spawn = spawn;
  for (const name of ['next', 'last']) assert.equal((await f.launch(name, 'c')).ok, true);
  assert.deepEqual(adapter.spawns.map(p => p.host), ['c', 'c']);
});

test('a host leaving ready between launches is excluded from the next decision', async t => {
  const f = await fixture(t);
  assert.equal((await f.launch('first')).ok, true);
  assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host, 'a');
  f.store.hosts.provisions.save({ ...f.store.hosts.provisions.get('a')!, state: 'destroying' });
  assert.equal((await f.launch('second')).ok, true);
  assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host, 'b');
  const pin = await f.launch('pinned', 'a');
  assert.equal(pin.ok, false);
  assert.match(String(pin.error), /host a has no room/);
});

test('a host losing readiness during stat preparation never reaches native spawn', async t => {
  const f = await fixture(t);
  const gate = Promise.withResolvers<void>();
  let entered = false;
  let launch: ReturnType<typeof f.launch> | undefined;
  onCleanup(t, async () => { gate.resolve(); await launch; });
  f.hosts[0]!.statDirectory = async () => { entered = true; await gate.promise; return { refusal: null, identity: null }; };
  launch = f.launch('held');
  await eventually('selected host stat entered', () => entered ? true : undefined);
  f.store.hosts.provisions.save({ ...f.store.hosts.provisions.get('a')!, state: 'destroying' });
  gate.resolve();
  const result = await launch;
  assert.equal(result.ok, false);
  assert.match(String(result.error), /placement.*changed|not ready/);
  assert.equal(f.hub.fakes.codex!.spawns.length, 0);
});

test('accepted failed-launch native ownership counts until positive cleanup, including restart', async t => {
  const f = await fixture(t, e => { if (e.event === 'session-launched' && e.session === 'failed') throw new Error('fixture publication fault'); });
  assert.equal((await f.ui.request({ type: 'config.set', key: 'hosts.other.slots', value: 0.5 })).ok, true);
  const adapter = f.hub.fakes.codex!;
  const stop = adapter.stop.bind(adapter);
  adapter.stop = async () => { throw new Error('fixture native stop unknown'); };
  onCleanup(t, () => { adapter.stop = stop; });
  const failed = await f.launch('failed', 'c');
  assert.equal(failed.ok, false);
  assert.match(String(failed.error), /cleanup is pending/);
  const listed = await f.ui.request({ type: 'session.list' });
  assert.equal((listed.value as { pendingStops: unknown[] }).pendingStops.length, 1);
  const full = await f.launch('overfill', 'c');
  assert.equal(full.ok, false);
  assert.match(String(full.error), /host c has no room/);
  await f.hub.stop();
  const reopened = await projectHub(t, f.root, {}, { hosts: f.hosts });
  const ui = await sessionUi(t, reopened.discovery);
  const afterRestart = await ui.request({ type: 'session.launch', name: 'overfill', role: 'implementer', harness: 'codex', host: 'c' });
  assert.equal(afterRestart.ok, false);
  assert.match(String(afterRestart.error), /host c has no room/);
});

test('an idle retained worker on a full remote host is reused without another slot', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, '.cland/roles.toml'), '[reviewer.launch]\npool="other"\n');
  assert.equal((await f.ui.request({ type: 'crew.set', key: 'reviewer.keep_context', value: true })).ok, true);
  assert.equal((await f.ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const create = await f.ui.request({ type: 'task.create', kind: 'epic', title: 'Review capacity' });
  assert.equal(create.ok, true, create.error);
  const item = (create.value as { item: { id: string } }).item.id;
  const launch = (name: string, item?: string) => f.ui.request({ type: 'session.launch', name, role: 'reviewer', harness: 'codex', ...(item ? { item } : {}) });
  const first = await launch('review-one');
  assert.equal(first.ok, true, first.error);
  const process = (first.value as { process: import('../src/protocol.ts').HarnessProcessView }).process;
  assert.equal((await launch('review-two')).ok, true);
  const peer = await inProcessSpoke(t, { cwd: f.root, discover: true, name: process.name, role: 'reviewer', sessionId: process.sessionId, assignRole: false });
  await peer.waitForPresence([process.name]);
  f.hub.fakes.codex!.idle(process.name);
  const reused = await launch('review-new', item);
  assert.equal(reused.ok, true, reused.error);
  const row = (reused.value as { process: import('../src/protocol.ts').HarnessProcessView }).process;
  assert.equal(row.sessionId, process.sessionId);
  assert.equal(row.name, process.name);
  assert.equal(row.host, 'c');
  assert.equal(f.hub.fakes.codex!.spawns.length, 2);
});

test('a failed generation is counted once with a visible row and releases after positive native absence', async t => {
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const f = await fixture(t, e => { if (e.event === 'session-launched' && e.session === 'failed') throw new Error('fixture publication fault'); });
  const adapter = f.hub.fakes.codex!;
  const spawn = adapter.spawn.bind(adapter), stop = adapter.stop.bind(adapter);
  let present = true;
  f.hosts[2]!.processes = async () => present ? [{ pid: 4242, parent: 1, rssBytes: 0, cpuPercent: 0 }] : [];
  adapter.spawn = async (...args) => ({ ...await spawn(...args), pid: 4242, pidStarted: null, pidIdentity: 'linux:test-c:4242' });
  adapter.stop = async () => { throw new Error('fixture stop unknown'); };
  onCleanup(t, () => { adapter.spawn = spawn; adapter.stop = stop; });
  assert.equal((await f.launch('failed', 'c')).ok, false);
  const table = new ProcessTable(join(f.root, '.cland/hub.db'));
  onCleanup(t, () => table.close());
  const pending = table.pendingStops()[0]!;
  table.put({ ...pending.process, status: 'running' }); // interrupted quarantine may leave both owners visible
  adapter.spawn = spawn;
  assert.equal((await f.launch('next', 'c')).ok, true, 'visible and pending copies consume one half slot');
  assert.equal((await f.launch('overfill', 'c')).ok, false);
  let cancelled = false, closed: Promise<unknown> | undefined;
  onCleanup(t, async () => { cancelled = true; await closed; });
  closed = eventually('failed generation cleanup persisted', async () => {
    if (cancelled) return true;
    const listed = await f.ui.request({ type: 'session.list' });
    return (listed.value as { pendingStops: unknown[] }).pendingStops.length === 0 ? true : undefined;
  });
  present = false;
  adapter.exit('failed');
  await closed;
  assert.equal(table.pendingStops().length, 0);
  assert.equal((await f.launch('after-closure', 'c')).ok, true);
});

test('final adapter authorization rechecks ready identity after adapter preparation', async t => {
  const f = await fixture(t);
  const gate = Promise.withResolvers<void>();
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter);
  let entered = false, nativeAdmissions = 0, launch: ReturnType<typeof f.launch> | undefined;
  onCleanup(t, async () => { gate.resolve(); try { await launch; } finally { adapter.spawn = spawn; } });
  adapter.spawn = async (...args) => { entered = true; await gate.promise; args[2]?.(); nativeAdmissions++; return spawn(...args); };
  launch = f.launch('held');
  await eventually('adapter preparation held', () => entered ? true : undefined);
  f.store.hosts.provisions.save({ ...f.store.hosts.provisions.get('a')!, state: 'destroying' });
  gate.resolve();
  const result = await launch;
  assert.equal(result.ok, false);
  assert.match(String(result.error), /placement.*changed|not ready/);
  assert.equal(nativeAdmissions, 0);
  assert.equal(adapter.spawns.length, 0);
});

test('a moved current row leaves unknown retained native capacity on its source through restart', async t => {
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const f = await fixture(t);
  assert.equal((await f.ui.request({ type: 'config.set', key: 'hosts.other.slots', value: 0.5 })).ok, true);
  assert.equal((await f.launch('moving', 'c')).ok, true);
  const table = new ProcessTable(join(f.root, '.cland/hub.db'));
  onCleanup(t, () => table.close());
  const source = table.get('moving')!;
  table.retainHostGeneration(source, 'unknown');
  table.put({ ...source, host: 'a' });
  const before = await f.launch('new-source', 'c');
  assert.equal(before.ok, false);
  assert.match(String(before.error), /host c has no room/);
  await f.hub.stop();
  const reopened = await projectHub(t, f.root, {}, { hosts: f.hosts });
  const ui = await sessionUi(t, reopened.discovery);
  const launch = () => ui.request({ type: 'session.launch', name: 'new-source', role: 'implementer', harness: 'codex', host: 'c' });
  assert.equal((await launch()).ok, false);
  // Inject the lifecycle owner's durable positive closure checkpoint at its store seam.
  table.retainHostGeneration(source, 'confirmed');
  const released = await launch();
  assert.equal(released.ok, true, released.error);
});

test('an implicit preassigned role changing during fresh I/O cannot launch on its old pool', async t => {
  const files = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const f = await fixture(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'implicit', role: 'implementer' })).ok, true);
  const path = join(f.root, '.cland/roles.toml');
  await writeFile(path, '[implementer.launch]\npool="agents"\n[reviewer.launch]\npool="other"\n');
  const read = files.readFile, gate = Promise.withResolvers<void>();
  let entered = false, launch: ReturnType<typeof f.ui.request> | undefined;
  onCleanup(t, async () => { gate.resolve(); try { await launch; } finally { files.readFile = read; syncBuiltinESMExports(); } });
  files.readFile = (async (...args: Parameters<typeof read>) => {
    if (String(args[0]) === path && !entered) { entered = true; await gate.promise; }
    return read(...args);
  }) as typeof read;
  syncBuiltinESMExports();
  launch = f.ui.request({ type: 'session.launch', name: 'implicit', harness: 'codex' });
  await eventually('placement fresh read held', () => entered ? true : undefined);
  f.store.rememberRole('implicit', 'reviewer');
  gate.resolve();
  const result = await launch;
  assert.equal(result.ok, false);
  assert.match(String(result.error), /changed role.*launch|role.*changed/);
  assert.equal(f.hub.fakes.codex!.spawns.length, 0);
  assert.equal(f.store.roleOf('implicit'), 'reviewer');
});

for (const boundary of ['preparation', 'stop']) test(`a duplicate worker name refuses before touching a held handoff reservation (${boundary})`, async t => {
  const f = await fixture(t);
  assert.equal((await f.ui.request({ type: 'crew.set', key: 'implementer.policy', value: 'pool' })).ok, true);
  assert.equal((await f.ui.request({ type: 'crew.set', key: 'implementer.keep_context', value: false })).ok, true);
  const made = await f.ui.request({ type: 'task.create', title: 'Handoff ownership', size: 'M' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const first = await f.launch('worker', 'a');
  assert.equal(first.ok, true, first.error);
  const initial = (first.value as { process: import('../src/protocol.ts').HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'worker', role: 'implementer', sessionId: initial.sessionId, assignRole: false });
  await peer.waitForPresence(['worker']);
  const adapter = f.hub.fakes.codex!, stop = adapter.stop.bind(adapter), gate = Promise.withResolvers<void>();
  let entered = false, handoff: ReturnType<typeof f.ui.request> | undefined;
  onCleanup(t, async () => { gate.resolve(); try { await handoff; } finally { adapter.stop = stop; } });
  if (boundary === 'preparation') f.hosts[0]!.statDirectory = async () => { entered = true; await gate.promise; return { refusal: null, identity: null }; };
  adapter.stop = async (...args) => { await stop(...args); await peer.close(); if (boundary === 'stop') { entered = true; await gate.promise; } };
  adapter.idle('worker');
  handoff = f.ui.request({ type: 'session.launch', name: 'new-worker', role: 'implementer', harness: 'codex', item });
  await eventually('pool handoff stop held', () => entered ? true : undefined);
  const duplicate = await f.launch('worker', 'a');
  assert.equal(duplicate.ok, false);
  assert.match(String(duplicate.error), /reserved for a pool handoff/);
  gate.resolve();
  const result = await handoff;
  assert.equal(result.ok, true, result.error);
  const process = (result.value as { process: import('../src/protocol.ts').HarnessProcessView }).process;
  assert.equal(process.name, 'worker');
  assert.notEqual(process.sessionId, initial.sessionId);
  assert.equal(adapter.spawns.length, 2);
});

test('a later handoff cannot select a worker whose name an earlier placement owns', async t => {
  const files = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const f = await fixture(t);
  for (const [key, value] of [['implementer.policy', 'pool'], ['implementer.keep_context', false], ['implementer.size', 1]] as const)
    assert.equal((await f.ui.request({ type: 'crew.set', key, value })).ok, true);
  const made = await f.ui.request({ type: 'task.create', title: 'Reverse handoff ownership', size: 'M' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const first = await f.launch('worker', 'a');
  assert.equal(first.ok, true, first.error);
  const initial = (first.value as { process: import('../src/protocol.ts').HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'worker', role: 'implementer', sessionId: initial.sessionId, assignRole: false });
  await peer.waitForPresence(['worker']);
  const adapter = f.hub.fakes.codex!, stop = adapter.stop.bind(adapter);
  adapter.stop = async (...args) => { await stop(...args); await peer.close(); };
  adapter.idle('worker');
  const registry = (await (await import('../src/accounts/registry.ts')).readAccounts(f.hub.hostEnvironment)).registry;
  const read = files.readFile, gate = Promise.withResolvers<void>();
  let entered = false, pending: ReturnType<typeof f.ui.request> | undefined;
  onCleanup(t, async () => { gate.resolve(); try { await pending; } finally { files.readFile = read; adapter.stop = stop; syncBuiltinESMExports(); } });
  files.readFile = (async (...args: Parameters<typeof read>) => {
    if (String(args[0]) === registry && !entered) { entered = true; await gate.promise; }
    return read(...args);
  }) as typeof read;
  syncBuiltinESMExports();
  pending = f.ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex', host:'local', account: 'missing' });
  await eventually('early local account read held', () => entered ? true : undefined);
  const handoff = await f.ui.request({ type: 'session.launch', name: 'later', role: 'implementer', harness: 'codex', item });
  assert.equal(handoff.ok, false);
  assert.equal(adapter.stops.length, 0);
  assert.equal(adapter.spawns.length, 1);
  gate.resolve();
  assert.equal((await pending).ok, false);
  const listed = await f.ui.request({ type: 'session.list' });
  assert.equal((listed.value as { processes: import('../src/protocol.ts').HarnessProcessView[] }).processes[0]!.sessionId, initial.sessionId);
});

test('a later item launch cannot take a new roleless name held by earlier placement', async t => {
  const files = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { readAccounts } = await import('../src/accounts/registry.ts');
  const f = await fixture(t);
  const made = await f.ui.request({ type: 'task.create', title: 'Early name ownership', size: 'M' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const registry = (await readAccounts(f.hub.hostEnvironment)).registry;
  const read = files.readFile, gate = Promise.withResolvers<void>();
  let entered = false, pending: ReturnType<typeof f.ui.request> | undefined;
  onCleanup(t, async () => { gate.resolve(); try { await pending; } finally { files.readFile = read; syncBuiltinESMExports(); } });
  files.readFile = (async (...args: Parameters<typeof read>) => {
    if (String(args[0]) === registry && !entered) { entered = true; await gate.promise; }
    return read(...args);
  }) as typeof read;
  syncBuiltinESMExports();
  pending = f.ui.request({ type: 'session.launch', name: 'new-name', harness: 'codex', account: 'missing' });
  await eventually('roleless placement owns new name', () => entered ? true : undefined);
  const later = await f.ui.request({ type: 'session.launch', name: 'new-name', role: 'implementer', harness: 'codex', item });
  assert.equal(later.ok, false);
  assert.match(String(later.error), /being launched/);
  assert.equal(f.hub.fakes.codex!.spawns.length, 0);
  gate.resolve();
  assert.equal((await pending).ok, false);
});
