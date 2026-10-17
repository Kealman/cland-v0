// T2 component: launch input composition and cwd admission on recorded SpawnRequests; no harness process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('launch resolves an artifact brief at launch and refuses an unknown artifact before starting a harness', async t => {
  const root = await tempProject(t);
  const { fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const refused = await coord.call<{ ok: boolean; error?: string }>('session.launch', {
    name: 'impl-artifact', role: 'implementer', harness: 'claude-code', brief: 'A-999999',
  });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /brief artifact/);
  assert.equal(fake.spawns.length, 0);
  const content = 'Implement the artifact brief.\nThen report the result.';
  const created = await coord.call<{ ok: boolean; artifact: { id: string; path: string } }>('artifact.create', {
    kind: 'prompt', title: 'Launch brief', topic: 'general', content: 'Old brief',
  });
  assert.equal(created.ok, true);
  await writeFile(created.artifact.path, content);
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-artifact', role: 'implementer', harness: 'claude-code', brief: created.artifact.id,
  });
  assert.equal(launched.ok, true, launched.error);
  const log = fake.spawns.at(-1)!.brief!.text;
  assert.ok(log.includes(content));
  assert.ok(!log.includes('Old brief'));
});

test('a Coordinator spoke launches a session in the requested absolute cwd', async (t) => {
  const root = await tempProject(t);
  const cwd = join(root, '.cland', 'worktrees', 'T-45');
  await mkdir(cwd, { recursive: true });
  const { fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);

  const tool = (await coord.client.listTools()).tools.find((tool) => tool.name === 'session.launch');
  const cwdSchema = tool?.inputSchema.properties?.cwd;
  assert.ok(cwdSchema && 'type' in cwdSchema);
  assert.equal(cwdSchema.type, 'string');
  assert.ok(!tool?.inputSchema.required?.includes('cwd'));

  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-45', role: 'implementer', harness: 'claude-code', cwd,
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, cwd);
  const child = fake.spawns.find((s) => s.name === 'impl-45');
  assert.equal(child?.cwd, cwd);
});

test('a Coordinator spoke gets a typed refusal for a missing directory or a file as launch cwd', async (t) => {
  const root = await tempProject(t);
  await writeFile(join(root, 'file'), 'not a directory');
  const { fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);

  for (const cwd of ['missing', 'file']) {
    const refused = await coord.call<{ ok: boolean; code?: string; error?: string }>('session.launch', {
      name: 'impl-invalid', role: 'implementer', harness: 'claude-code', cwd,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'invalid-cwd');
    assert.ok(refused.error?.includes(join(root, cwd)), refused.error);
  }
  assert.equal(fake.spawns.length, 0);
  // Refusal leaves the name usable, and omitting cwd still launches at the project root.
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-invalid', role: 'implementer', harness: 'claude-code',
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, root);
  assert.equal(fake.spawns.find((s) => s.name === 'impl-invalid')?.cwd, root);
});

test('a Coordinator spoke resolves relative launch cwd against the project root', async (t) => {
  const root = await tempProject(t);
  const relative = '.cland/worktrees/T-45 relative';
  const cwd = join(root, relative);
  const coordinatorCwd = join(root, 'coordinator');
  await mkdir(cwd, { recursive: true });
  await mkdir(coordinatorCwd);
  const { fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { discover: true, cwd: coordinatorCwd, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);

  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-relative', role: 'implementer', harness: 'claude-code', cwd: relative,
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, cwd);
  const child = fake.spawns.find((s) => s.name === 'impl-relative');
  assert.equal(child?.cwd, cwd);
});

test('folder entries and absorbed-file ids resolve launch briefs on the SpawnRequest', async t => {
  const root = await tempProject(t);
  const { fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const folder = (await coord.call<{ artifact: { id: string } }>('artifact.create', { kind: 'prompt', title: 'Folder brief', topic: 'general', folder: true, content: 'Read the folder entry.' })).artifact;
  const file = (await coord.call<{ artifact: { id: string } }>('artifact.create', { kind: 'prompt', title: 'File brief', topic: 'general', content: 'Read the absorbed file.' })).artifact;
  assert.equal((await coord.call<{ ok: boolean }>('artifact.move', { artifact: file.id, folder: folder.id, name: 'absorbed.md' })).ok, true);
  for (const [name, artifact, text] of [['folder-brief', folder.id, 'Read the folder entry.'], ['absorbed-brief', file.id, 'Read the absorbed file.']]) {
    const launch = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'implementer', harness: 'claude-code', brief: artifact });
    assert.equal(launch.ok, true, launch.error);
    assert.ok(fake.spawns.at(-1)!.brief!.text.includes(text!));
  }
});

test('explicit and preassigned roles compose a clause before a one-time brief', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const tool = (await coord.client.listTools()).tools.find(tool => tool.name === 'session.launch');
  const schema = tool?.inputSchema.properties?.brief;
  assert.ok(schema && 'type' in schema);
  assert.equal(schema.type, 'string');
  assert.ok(!tool?.inputSchema.required?.includes('brief'));
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const preassigned of [false, true]) {
    const name = preassigned ? 'preassigned' : 'explicit';
    if (preassigned) assert.equal((await ui.request({ type: 'role.set', session: name, role: 'implementer' })).ok, true);
    const brief = 'Implement the launch brief without another message.';
    const launched = await coord.call<{ ok: boolean; error?: string }>('session.launch', {
      name, ...(preassigned ? {} : { role: 'implementer' }), harness: 'claude-code', brief,
    });
    assert.equal(launched.ok, true, launched.error);
    const request = fakes['claude-code']!.spawns.at(-1)!;
    assert.equal(request.role, 'implementer');
    assert.match(request.clause!, /you hold the role Implementer/);
    assert.ok(request.brief!.text.includes(brief));
    assert.equal(fakes['claude-code']!.spawns.filter(r => r.name === name).length, 1);
    const process = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    const row = process.processes.find(p => p.name === name)!;
    const peer = await inProcessSpoke(t, { discover: true, cwd: root, name, sessionId: row.sessionId, launchToken: request.launchToken! });
    fakes['claude-code']!.idle(name);
    await peer.waitForEvent(e => e.params.content.includes(brief));
    await ui.waitFor(f => f.type === 'delivery' && f.message === request.brief!.id && f.stage === 'injected');
    const first = peer.events.map(e => e.params.content).join('\n');
    assert.ok(first.indexOf('you hold the role Implementer') >= 0);
    assert.ok(first.indexOf('you hold the role Implementer') < first.indexOf(brief));
    const later = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: 'A later turn.' });
    assert.equal(later.ok, true, later.error);
    const id = (later.value as { message: { id: string } }).message.id;
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    assert.equal(peer.events.filter(e => e.params.content.includes(brief)).length, 1);
    assert.equal(fakes['claude-code']!.injections.filter(i => i.message.id === request.brief!.id).length, 1);
    await peer.close();
  }
});
