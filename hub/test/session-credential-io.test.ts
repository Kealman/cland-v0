// T2: real hub frames, held owned filesystem I/O, no native harness processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import files from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { connectSocket, connectUi, startHub, tempProject, TEST_SECRET } from './harness.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { Store } from '../src/hub/store.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { FAKE_FLAVOURS, fakeHarness, type FakeHarness } from './fakes/harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { sessionCredentialFile, sessionRunDirectory } from '../../shared/session-credential.ts';
import { value } from './validation-support.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

// The fixed-role public seam matches tracker-native-boundary.test.ts. It keeps the
// unrelated ProjectConfiguration skill-directory scanner out of this I/O contract.
async function credentialHub(t: import('node:test').TestContext, root: string) {
  const clock = new FakeClock();
  const socket = join(root, 'hub.sock');
  const env = fixtureEnvironment(root, process.env);
  await files.mkdir(join(root, '.cland'), { recursive: true });
  const hub = await startHub({ secret: TEST_SECRET, roles: fixedRoles(), clock, store: new Store(join(root, '.cland/hub.db')), env,
    control: { status: () => ({ root, pid: process.pid, port: 0, socket, version: 'test', startedAt: clock.now().toISOString(), uptimeMs: 0 }), stop() {} } });
  const fakes = {} as Record<typeof FAKE_FLAVOURS[number], FakeHarness>;
  const project = projectSessions({ core: hub.core, root, db: join(root, '.cland/hub.db'), discoveryFile: join(root, '.cland/hub.json'), env, log: () => {},
    adapters: FAKE_FLAVOURS.map(flavour => (host, clock) => fakes[flavour] = fakeHarness(flavour, { host, clock })) });
  hub.dispatcher.useSessions(project.sessions);
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  let closingProject: Promise<void> | undefined;
  const closeProject = () => closingProject ??= Promise.resolve(project.close());
  onCleanup(t, async () => { await edge.close(); await closeProject(); await hub.close(); });
  return { discovery: { root, socket, secret: TEST_SECRET }, fakes, closeProject };
}

function noSync(t: import('node:test').TestContext) {
  const originals = Object.fromEntries(Object.entries(fs).filter(([name, fn]) => name.endsWith('Sync') && typeof fn === 'function'));
  const calls: string[] = [];
  for (const name of Object.keys(originals)) Object.assign(fs, { [name]: () => { calls.push(`${name}: ${new Error().stack}`); throw new Error(`synchronous ${name} on serving path`); } });
  syncBuiltinESMExports();
  let restored = false;
  const restore = () => { if (restored) return; restored = true; Object.assign(fs, originals); syncBuiltinESMExports(); };
  t.after(restore);
  return { calls, restore };
}

async function receipt<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`missing ${label} receipt`)), 2000); // lint-allow-wall-clock: bounded native I/O receipt, not a scheduler wait
    })]);
  } finally { clearTimeout(timer); }
}

test('credential persistence keeps welcome behind its async receipt while the hub continues serving', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: launched } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'plain', role: 'implementer', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const peer = await connectSocket(hub.discovery.socket); t.after(() => peer.close());
  const file = sessionCredentialFile(join(root, '.cland'), launched.sessionId);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const rename = files.rename;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (args[1] === file) { entered.resolve(); await release.promise; }
    return rename(...args);
  });
  syncBuiltinESMExports();
  t.after(() => release.resolve());
  const guard = noSync(t);
  const welcomed = peer.next(); // Observe before triggering the hello.
  let delivered = false; void welcomed.then(() => { delivered = true; }, () => {});
  try {
    peer.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, name: 'plain', sessionId: launched.sessionId, launchToken: credential, cwd: root });
    const boundary = await receipt(Promise.race([entered.promise.then(() => 'held'), welcomed.then(() => 'early-welcome')]), 'held credential persistence');
    assert.equal(boundary, 'held', 'welcome requires the asynchronous credential receipt');
    const status = await ui.request({ type: 'hub.status' });
    assert.equal(status.ok, true, status.error);
    assert.equal(delivered, false, 'an unrelated serving receipt cannot release welcome');
    release.resolve();
    assert.equal((await receipt(welcomed, 'credential-ready welcome')).type, 'welcome');
    assert.equal((await files.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(guard.calls, []);
  } finally { release.resolve(); guard.restore(); }
});

test('archive drains an owned credential writer after stop and publishes only after async removal', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: launched } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const peer = await connectSocket(hub.discovery.socket); t.after(() => peer.close());
  const file = sessionCredentialFile(join(root, '.cland'), launched.sessionId);
  const directory = sessionRunDirectory(join(root, '.cland'), launched.sessionId);
  const writeEntered = Promise.withResolvers<void>(), writeRelease = Promise.withResolvers<void>();
  const removeEntered = Promise.withResolvers<void>(), removeRelease = Promise.withResolvers<void>();
  const rename = files.rename, remove = files.rm;
  let removing = false;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (args[1] === file) { writeEntered.resolve(); await writeRelease.promise; }
    return rename(...args);
  });
  t.mock.method(files, 'rm', async (...args: Parameters<typeof files.rm>) => {
    if (args[0] === directory) { removing = true; removeEntered.resolve(); await removeRelease.promise; }
    return remove(...args);
  });
  syncBuiltinESMExports();
  t.after(() => { writeRelease.resolve(); removeRelease.resolve(); });
  const guard = noSync(t);
  const welcome = peer.next(); void welcome.catch(() => {});
  try {
    peer.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, name: 'worker', sessionId: launched.sessionId, launchToken: credential, cwd: root });
    const boundary = await receipt(Promise.race([writeEntered.promise.then(() => 'held'), welcome.then(() => 'early-welcome')]), 'owned writer');
    assert.equal(boundary, 'held');
    await value(ui, { type: 'session.stop', session: 'worker' });
    assert.equal(hub.fakes.codex!.stops.at(-1)!.sessionId, launched.sessionId, 'the stop receipt precedes cleanup');
    const archived = ui.request({ type: 'session.archive', session: 'worker' });
    const before = await value<{ archived: number }>(ui, { type: 'session.list', archived: true });
    assert.equal(before.archived, 0);
    assert.equal(removing, false, 'removal cannot overtake the outstanding writer');
    writeRelease.resolve();
    await receipt(removeEntered.promise, 'async removal entered');
    const during = await value<{ archived: number }>(ui, { type: 'session.list', archived: true });
    assert.equal(during.archived, 0, 'archive publication waits for removal');
    removeRelease.resolve();
    assert.equal((await receipt(archived, 'archive completion')).ok, true);
    await assert.rejects(files.stat(directory), { code: 'ENOENT' });
    await value(ui, { type: 'hub.status' });
    await assert.rejects(files.stat(directory), { code: 'ENOENT' });
    assert.deepEqual(guard.calls, []);
  } finally { writeRelease.resolve(); removeRelease.resolve(); guard.restore(); }
});

test('relaunch waits for async credential rotation before entering the native adapter', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: launched } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  const previous = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  await value(ui, { type: 'session.stop', session: 'worker' });
  const file = sessionCredentialFile(join(root, '.cland'), launched.sessionId);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const rename = files.rename;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (args[1] === file) { entered.resolve(); await release.promise; }
    return rename(...args);
  });
  syncBuiltinESMExports();
  t.after(() => release.resolve());
  const guard = noSync(t);
  try {
    const resumed = ui.request({ type: 'session.resume', session: 'worker', relaunch: true });
    const boundary = await receipt(Promise.race([entered.promise.then(() => 'held'), resumed.then(() => 'early-result')]), 'rotation write');
    assert.equal(boundary, 'held');
    const during = await value<{ processes: HarnessProcessView[] }>(ui, { type: 'session.list' });
    assert.equal(during.processes.find(p => p.sessionId === launched.sessionId)?.status, 'stopped');
    assert.equal(hub.fakes.codex!.resumes.length, 0, 'native launch cannot overtake credential persistence');
    release.resolve();
    assert.equal((await receipt(resumed, 'relaunch completion')).ok, true);
    const credential = hub.fakes.codex!.resumes.at(-1)!.options!.launchToken!;
    assert.equal(typeof credential === 'string' && credential !== previous, true);
    assert.equal((await files.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(guard.calls, []);
  } finally { release.resolve(); guard.restore(); }
});

test('project disposal drains an outstanding credential writer before closing its session table', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: launched } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const peer = await connectSocket(hub.discovery.socket); t.after(() => peer.close());
  const file = sessionCredentialFile(join(root, '.cland'), launched.sessionId);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const rename = files.rename;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (args[1] === file) { entered.resolve(); await release.promise; }
    return rename(...args);
  });
  syncBuiltinESMExports();
  t.after(() => release.resolve());
  const guard = noSync(t);
  const welcome = peer.next(); void welcome.catch(() => {});
  try {
    peer.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, name: 'worker', sessionId: launched.sessionId, launchToken: credential, cwd: root });
    await receipt(entered.promise, 'owned writer before disposal');
    const closing = hub.closeProject();
    const during = await ui.request({ type: 'session.list' });
    assert.equal(during.ok, true, 'the session table stays open until the writer drains');
    release.resolve();
    await receipt(closing, 'project disposal');
    assert.equal((await files.stat(file)).mode & 0o777, 0o600, 'the owned write completed before disposal returned');
    assert.deepEqual(guard.calls, []);
  } finally { release.resolve(); guard.restore(); }
});


test('relaunch rechecks the calling session after held credential persistence', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: coord } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const { process: worker } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  await value(ui, { type: 'session.stop', session: 'worker' });
  const file = sessionCredentialFile(join(root, '.cland'), worker.sessionId);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const rename = files.rename;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (args[1] === file) { entered.resolve(); await release.promise; }
    return rename(...args);
  });
  syncBuiltinESMExports();
  t.after(() => release.resolve());
  const relaunch = ui.request({ type: 'session.resume', session: 'worker', relaunch: true, as: { name: 'coord', sessionId: coord.sessionId, credential } });
  await receipt(entered.promise, 'admitted credential write');
  await value(ui, { type: 'role.set', session: 'coord', role: 'implementer' });
  release.resolve();
  const result = await receipt(relaunch, 'revoked relaunch refusal');
  assert.equal((result as { code?: string }).code, 'forbidden');
  assert.equal(result.ok, false);
  assert.equal(hub.fakes.codex!.resumes.length, 0);
  const stored = new Store(join(root, '.cland/hub.db'));
  try { assert.deepEqual(stored.reservations(), [], 'revocation settles the admitted role reservation'); }
  finally { stored.close(); }
  const rows = await value<{ processes: HarnessProcessView[] }>(ui, { type: 'session.list' });
  assert.equal(rows.processes.find(p => p.sessionId === worker.sessionId)?.status, 'stopped');
});

test('failed credential persistence rolls back relaunch ownership and permits subsequent admission', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: worker } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  await value(ui, { type: 'session.stop', session: 'worker' });
  const before = await value(ui, { type: 'role.list' });
  const file = sessionCredentialFile(join(root, '.cland'), worker.sessionId);
  const rename = files.rename;
  let failing = true;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (failing && args[1] === file) throw new Error('fixture credential rename refused');
    return rename(...args);
  });
  syncBuiltinESMExports();
  const result = await ui.request({ type: 'session.resume', session: 'worker', relaunch: true });
  assert.match(String(result.error ?? (result.value as { reason?: string } | undefined)?.reason), /fixture credential rename refused/);
  assert.equal(hub.fakes.codex!.resumes.length, 0);
  // Inspect the durable receipt in this fixture's owned database, not a launch reply.
  const stored = new Store(join(root, '.cland/hub.db'));
  try { assert.deepEqual(stored.reservations(), [], 'failed preparation leaves no durable launch reservation'); }
  finally { stored.close(); }
  assert.deepEqual(await value(ui, { type: 'role.list' }), before, 'preparation introduces no lasting role ownership');
  const rows = await value<{ processes: HarnessProcessView[]; pendingStops: unknown[] }>(ui, { type: 'session.list' });
  assert.equal(rows.processes.find(p => p.sessionId === worker.sessionId)?.status, 'stopped');
  assert.deepEqual(rows.pendingStops, []);
  failing = false;
  const retry = await value<{ found: boolean }>(ui, { type: 'session.resume', session: 'worker', relaunch: true });
  assert.equal(retry.found, true, 'the failed attempt released its lifecycle slot');
  assert.equal(hub.fakes.codex!.resumes.length, 1);
});

test('shutdown during credential preparation settles the relaunch reservation before storage closes', async t => {
  const root = await tempProject(t);
  const hub = await credentialHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process: worker } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  await value(ui, { type: 'session.stop', session: 'worker' });
  const file = sessionCredentialFile(join(root, '.cland'), worker.sessionId);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const rename = files.rename;
  t.mock.method(files, 'rename', async (...args: Parameters<typeof files.rename>) => {
    if (args[1] === file) { entered.resolve(); await release.promise; }
    return rename(...args);
  });
  syncBuiltinESMExports();
  t.after(() => release.resolve());
  const relaunch = ui.request({ type: 'session.resume', session: 'worker', relaunch: true });
  await receipt(entered.promise, 'credential preparation before shutdown');
  const closing = hub.closeProject();
  release.resolve();
  const result = await receipt(relaunch, 'shutdown relaunch settlement');
  await receipt(closing, 'storage disposal after relaunch settlement');
  assert.equal(result.ok, false);
  assert.match(String(result.error), /hub is closing/);
  assert.equal(hub.fakes.codex!.resumes.length, 0);
  const stored = new Store(join(root, '.cland/hub.db'));
  try {
    assert.deepEqual(stored.reservations(), []);
    assert.equal(stored.roleOf('worker'), null);
  } finally { stored.close(); }
});
