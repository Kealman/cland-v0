// T2: real shell CLI against a sealed in-process hub; no native harnesses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { sessionCredentialFile, sessionRunDirectory } from '../../shared/session-credential.ts';
import { join } from 'node:path';
import { clandWithEnv, connectUi, flushProjectLogs, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { fakeHarness, type FakeHarness } from './fakes/harness.ts';
import { value } from './validation-support.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('a fresh onboarding Aide runs its first CLI with its launch credential and then uses its ready fallback file', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'onboarding-aide', role: 'aide', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const identity = { CLAND_SESSION_NAME: process.name, CLAND_SESSION_ID: process.sessionId };
  const file = sessionCredentialFile(join(root, '.cland'), process.sessionId);
  await assert.rejects(stat(file), { code: 'ENOENT' }, 'the fresh shell does not depend on its spoke having connected');
  await value(ui, { type: 'task.create', size: 'M', title: 'Aide attribution' });
  const first = await clandWithEnv(root, { ...identity, CLAND_LAUNCH_TOKEN: credential }, 'task', 'comment', 'T-1', 'first Aide CLI');
  assert.equal(first.code, 0, first.stderr);
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: process.name, sessionId: process.sessionId, launchToken: credential, assignRole: false });
  await spoke.call('who');
  assert.equal((await stat(file)).mode & 0o777, 0o600, 'own welcome follows durable fallback preparation');
  const fallback = await clandWithEnv(root, identity, 'task', 'comment', 'T-1', 'tokenless Aide CLI');
  assert.equal(fallback.code, 0, fallback.stderr);
  const { item } = await value<{ item: { comments: Array<{ author: string }> } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.deepEqual(item.comments.map(c => c.author), [process.name, process.name]);
  await flushProjectLogs(t, root);
  assert.equal((await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes(credential), false);
});

test('shell attribution requires the credential belonging to the claimed session', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const shells: Record<string, Record<string, string>> = {};
  for (const name of ['first', 'second']) {
    const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name, role: 'implementer', harness: 'codex' });
    const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
    shells[name] = { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: process.sessionId, CLAND_LAUNCH_TOKEN: credential };
  }
  await value(ui, { type: 'task.create', size: 'M', title: 'Owned', assignee: 'second' });
  const own = await clandWithEnv(root, shells.second!, 'task', 'comment', 'T-1', 'owned receipt');
  assert.equal(own.code, 0, own.stderr);
  for (const credential of [shells.first!.CLAND_LAUNCH_TOKEN!, '', 'invalid-fixture-credential']) {
    const refused = await clandWithEnv(root, { ...shells.second!, CLAND_LAUNCH_TOKEN: credential }, 'task', 'comment', 'T-1', 'refused write');
    assert.notEqual(refused.code, 0, 'a claim without its own credential is refused');
    assert.match(refused.stderr, /session "second".*credential/i);
    for (const shell of Object.values(shells)) assert.equal(refused.stderr.includes(shell.CLAND_LAUNCH_TOKEN!), false, 'errors omit credentials');
  }
  const { item } = await value<{ item: { comments: Array<{ author: string; text: string }> } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.deepEqual(item.comments.map(c => [c.author, c.text]), [['second', 'owned receipt']]);
  await flushProjectLogs(t, root);
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  for (const shell of Object.values(shells)) assert.equal(log.includes(shell.CLAND_LAUNCH_TOKEN!), false, 'logs omit credentials');
});

test('identity-free shells stay human and the own MCP spoke keeps its permissions', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', sessionId: process.sessionId, launchToken: credential });
  await value(ui, { type: 'task.create', size: 'M', title: 'Owned', assignee: 'worker' });
  const commented = await spoke.call<{ ok: boolean; error?: string }>('task.comment', { id: 'T-1', text: 'spoke receipt' });
  assert.equal(commented.ok, true, commented.error);
  const human = await clandWithEnv(root, {}, 'task', 'comment', 'T-1', 'human receipt');
  assert.equal(human.code, 0, human.stderr);
  const { item } = await value<{ item: { comments: Array<{ author: string }> } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.deepEqual(item.comments.map(c => c.author), ['worker', 'human']);
});

test('session credentials survive hub restart, native resume and relaunch', async t => {
  const root = await tempProject(t);
  const first = await projectHub(t, root);
  const ui = await connectUi(t, first.discovery);
  const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  const credential = first.fakes.codex!.spawns.at(-1)!.launchToken!;
  const shell = { CLAND_SESSION_NAME: 'worker', CLAND_SESSION_ID: process.sessionId, CLAND_LAUNCH_TOKEN: credential };
  ui.close();
  await first.stop();
  let resumedHarness: FakeHarness;
  const next = await projectHub(t, root, {}, { adapters: [host => {
    resumedHarness = fakeHarness('codex', { host });
    resumedHarness.scriptResume('worker', 'found', 'found');
    return resumedHarness;
  }] });
  const client = await connectUi(t, next.discovery);
  const resumed = await client.request({ type: 'session.resume', session: 'worker' });
  assert.equal(resumed.ok, true, resumed.error);
  const read = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(read.code, 0, read.stderr);
  const relaunched = await client.request({ type: 'session.resume', session: 'worker', relaunch: true });
  assert.equal(relaunched.ok, true, relaunched.error);
  const received = resumedHarness!.resumes.at(-1)!.options as { launchToken?: string };
  assert.equal(typeof received.launchToken === 'string' && received.launchToken !== credential, true, 'relaunch rotates the credential');
  const stale = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(stale.code, 1, 'the previous environment credential is revoked');
  const after = await clandWithEnv(root, { ...shell, CLAND_LAUNCH_TOKEN: received.launchToken! }, 'session', 'list');
  assert.equal(after.code, 0, after.stderr);
});

test('a tokenless Coordinator shell survives an upgrade restart after its own spoke reconnects without relaunch', async t => {
  const root = await tempProject(t);
  const first = await projectHub(t, root);
  const ui = await connectUi(t, first.discovery);
  const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'legacy', role: 'coordinator', harness: 'codex' });
  await value(ui, { type: 'task.create', size: 'M', title: 'Migration receipt' });
  ui.close();
  await first.stop();
  // A pre-upgrade database has session rows but no credential table.
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(join(root, '.cland/hub.db'));
  database.exec('drop table session_credentials');
  database.close();
  let harness: FakeHarness;
  const hub = await projectHub(t, root, {}, { adapters: [host => {
    harness = fakeHarness('codex', { host });
    harness.scriptResume('legacy', 'found', 'found');
    return harness;
  }] });
  const shell = { CLAND_SESSION_ID: process.sessionId, CLAND_SESSION_NAME: 'legacy' };
  const before = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(before.code, 1);
  assert.match(before.stderr, /session "legacy" credential.*reconnect/);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'legacy', sessionId: process.sessionId, assignRole: false });
  await peer.waitForPresence(['legacy']);
  const after = await clandWithEnv(root, shell, 'task', 'comment', 'T-1', 'migration receipt');
  assert.equal(after.code, 0, after.stderr);
  const read = await clandWithEnv(root, shell, 'task', 'view', 'T-1', '--json');
  assert.equal(read.code, 0, read.stderr);
  assert.deepEqual(JSON.parse(read.stdout).item.comments.map((c: { author: string }) => c.author), ['legacy']);
  assert.equal(harness!.spawns.length, 0);
  assert.equal(harness!.resumes.every(r => !r.options?.relaunch), true, 'the existing native process was never relaunched');
});

test('own spoke reconnect provisions a private fallback credential for a running legacy shell', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const sessionId = 'legacy-stable-id';
  const shell = { CLAND_SESSION_NAME: 'legacy', CLAND_SESSION_ID: sessionId };
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'legacy', sessionId, role: 'implementer' });
  await peer.waitForPresence(['legacy']);
  const file = sessionCredentialFile(join(root, '.cland'), sessionId);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  if (process.getuid) assert.equal((await stat(file)).uid, process.getuid());
  assert.equal((await stat(sessionRunDirectory(join(root, '.cland'), sessionId))).mode & 0o777, 0o700);
  const receipt = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(receipt.code, 0, receipt.stderr);
  await peer.close();
  const reconnect = await inProcessSpoke(t, { discover: true, cwd: root, name: 'legacy', sessionId });
  const again = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(again.code, 0, again.stderr);
  await reconnect.close();
});

test('fallback files are bound to their session id and explicit invalid environment credentials stay refused', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const clandDir = join(root, '.cland');
  for (const name of ['one', 'two']) {
    const peer = await inProcessSpoke(t, { discover: true, cwd: root, name, sessionId: `stable-${name}`, role: 'implementer' });
    await peer.waitForPresence([name]);
  }
  await copyFile(sessionCredentialFile(clandDir, 'stable-two'), sessionCredentialFile(clandDir, 'stable-one'));
  const wrongFile = await clandWithEnv(root, { CLAND_SESSION_NAME: 'one', CLAND_SESSION_ID: 'stable-one' }, 'session', 'list');
  assert.equal(wrongFile.code, 1);
  assert.match(wrongFile.stderr, /session "one" credential/);
  const invalidEnv = await clandWithEnv(root, { CLAND_SESSION_NAME: 'two', CLAND_SESSION_ID: 'stable-two', CLAND_LAUNCH_TOKEN: 'invalid-owned-fixture' }, 'session', 'list');
  assert.equal(invalidEnv.code, 1, 'a present invalid token never falls back to the valid file');
  assert.equal(invalidEnv.stderr.includes('invalid-owned-fixture'), false);
});

test('archiving a stopped session removes its private run directory and relaunch restores a rotated fallback', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  const credential = hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', sessionId: process.sessionId, launchToken: credential });
  await peer.waitForPresence(['worker']);
  const directory = sessionRunDirectory(join(root, '.cland'), process.sessionId);
  await writeFile(join(directory, 'settings.json'), '{}', { mode: 0o600 });
  await peer.close();
  await value(ui, { type: 'session.stop', session: 'worker' });
  await value(ui, { type: 'session.archive', session: 'worker' });
  await assert.rejects(stat(directory), { code: 'ENOENT' });
  await value(ui, { type: 'session.resume', session: 'worker', relaunch: true });
  const rotated = hub.fakes.codex!.resumes.at(-1)!.options!.launchToken!;
  assert.equal(typeof rotated === 'string' && rotated !== credential, true);
  const shell = { CLAND_SESSION_NAME: 'worker', CLAND_SESSION_ID: process.sessionId };
  const read = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(read.code, 0, read.stderr);
});

test('upgrade reconnect retains an existing environment credential when the old store has no credential table', async t => {
  const root = await tempProject(t);
  const first = await projectHub(t, root);
  const ui = await connectUi(t, first.discovery);
  const { process } = await value<{ process: HarnessProcessView }>(ui, { type: 'session.launch', name: 'existing', role: 'implementer', harness: 'codex' });
  const credential = first.fakes.codex!.spawns.at(-1)!.launchToken!;
  ui.close();
  await first.stop();
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(join(root, '.cland/hub.db'));
  database.exec('drop table session_credentials'); database.close();
  const hub = await projectHub(t, root, {}, { adapters: [host => {
    const harness = fakeHarness('codex', { host });
    harness.scriptResume('existing', 'found', 'found');
    return harness;
  }] });
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'existing', sessionId: process.sessionId, launchToken: credential, assignRole: false });
  await peer.waitForPresence(['existing']);
  const read = await clandWithEnv(root, { CLAND_SESSION_NAME: 'existing', CLAND_SESSION_ID: process.sessionId, CLAND_LAUNCH_TOKEN: credential }, 'session', 'list');
  assert.equal(read.code, 0, read.stderr);
  const client = await connectUi(t, hub.discovery);
  const files = await value(client, { type: 'session.list' });
  assert.equal(JSON.stringify(files).includes(credential), false, 'public replies omit credentials');
});
