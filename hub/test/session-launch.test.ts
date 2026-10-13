// Coordinator launches through the spoke's MCP interface, with the fake harness at the process boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

for (const preassigned of [false, true]) test(`a Coordinator launches an Implementer with a launch brief exactly once after its role clause, without inherited launch environment (${preassigned ? 'preassigned role' : 'explicit role'})`, async (t) => {
  const root = await tempProject(t);
  // The native background child loses ambient CLAND_*; identity must survive in MCP config.
  // Exercise a hello before --bg returns as well as the ordinary launch ordering.
  const fake = await fakeClaude(t, { lateBg: preassigned });
  const { discovery } = await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const tool = (await coord.client.listTools()).tools.find(tool => tool.name === 'session.launch');
  const briefSchema = tool?.inputSchema.properties?.brief;
  assert.ok(briefSchema && 'type' in briefSchema);
  assert.equal(briefSchema.type, 'string');
  assert.ok(!tool?.inputSchema.required?.includes('brief'));
  const brief = 'Implement the launch brief without another message.';
  if (preassigned) {
    const ui = await connectUi(t, discovery);
    assert.equal((await ui.request({ type: 'role.set', session: 'impl-brief', role: 'implementer' })).ok, true);
  }
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-brief', ...(preassigned ? {} : { role: 'implementer' }), harness: 'claude-code', brief,
  });
  assert.equal(launched.ok, true, launched.error);
  const input = await eventually('brief reaches the native harness', async () => {
    const log = await fake.log(launched.process.harnessId!);
    return log.includes(brief) ? log : undefined;
  });
  assert.ok(input.indexOf('you hold the role Implementer') < input.indexOf(brief));
  assert.equal(input.split('\n').filter(line => line.includes('submitted:')).length, 1, 'the first harness input includes clause and brief');
  const journal = await eventually('brief journalled as a message', async () => {
    const lines = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean);
    const events = lines.map(line => JSON.parse(line) as { event: string; from?: string; to?: string[]; id?: string });
    const sent = events.find(event => event.event === 'send' && event.from === 'hub' && event.to?.includes('impl-brief'));
    return sent && events.some(event => event.event === 'acked' && event.id === sent.id) ? events : undefined;
  });
  const sent = journal.find(event => event.event === 'send' && event.from === 'hub' && event.to?.includes('impl-brief'))!;
  assert.ok(journal.some(event => event.event === 'acked' && event.id === sent.id));

  // A later turn must not submit the brief again when hooks report another idle boundary.
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const followup = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl-brief'], text: 'A later turn.' });
  assert.equal(followup.ok, true, followup.error);
  const followupId = (followup.value as { message: { id: string } }).message.id;
  await ui.waitFor(frame => frame.type === 'message' && (frame.message as { replyTo?: string }).replyTo === followupId);
  const after = await fake.log(launched.process.harnessId!);
  assert.equal(after.split('\n').filter(line => line === brief).length, 1, 'one native submission of the brief across both turns');
});

test('launch resolves an artifact brief at launch and refuses an unknown artifact before starting a harness', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const refused = await coord.call<{ ok: boolean; error?: string }>('session.launch', {
    name: 'impl-artifact', role: 'implementer', harness: 'claude-code', brief: 'A-999999',
  });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /brief artifact/);
  assert.deepEqual(await fake.sessions(), []);
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
  const log = await eventually('artifact content delivered', async () => {
    const log = await fake.log(launched.process.harnessId!);
    return log.includes(content) ? log : undefined;
  });
  assert.ok(!log.includes('Old brief'));
});

test('cland session launch forwards text and artifact briefs', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const content = 'Start on the CLI artifact brief.';
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'CLI brief', topic: 'general', content });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: { id: string } }).artifact;
  for (const [name, brief, expected] of [['cli-text', 'Start on the CLI text brief.', 'Start on the CLI text brief.'], ['cli-artifact', artifact.id, content]]) {
    const launched = await clandWithEnv(root, fake.env, 'session', 'launch', name!, '--role', 'implementer', '--harness', 'claude-code', '--brief', brief!, '--json');
    assert.equal(launched.code, 0, launched.stderr);
    const process = (JSON.parse(launched.stdout) as { process: HarnessProcessView }).process;
    await eventually('CLI brief reaches the native harness', async () => (await fake.log(process.harnessId!)).includes(expected!) || undefined);
  }
});

test('a Coordinator spoke launches a session in the requested absolute cwd', async (t) => {
  const root = await tempProject(t);
  const cwd = join(root, '.cland', 'worktrees', 'T-45');
  await mkdir(cwd, { recursive: true });
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
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
  const child = (await fake.sessions()).find((s) => s.name === 'impl-45');
  assert.equal(child?.cwd, cwd);
});

test('a Coordinator spoke gets a typed refusal for a missing directory or a file as launch cwd', async (t) => {
  const root = await tempProject(t);
  await writeFile(join(root, 'file'), 'not a directory');
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);

  for (const cwd of ['missing', 'file']) {
    const refused = await coord.call<{ ok: boolean; code?: string; error?: string }>('session.launch', {
      name: 'impl-invalid', role: 'implementer', harness: 'claude-code', cwd,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'invalid-cwd');
    assert.ok(refused.error?.includes(join(root, cwd)), refused.error);
  }
  assert.deepEqual(await fake.sessions(), []);
  // Refusal leaves the name usable, and omitting cwd still launches at the project root.
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-invalid', role: 'implementer', harness: 'claude-code',
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, root);
  assert.equal((await fake.sessions()).find((s) => s.name === 'impl-invalid')?.cwd, root);
});

test('a Coordinator spoke resolves relative launch cwd against the project root', async (t) => {
  const root = await tempProject(t);
  const relative = '.cland/worktrees/T-45 relative';
  const cwd = join(root, relative);
  const coordinatorCwd = join(root, 'coordinator');
  await mkdir(cwd, { recursive: true });
  await mkdir(coordinatorCwd);
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: coordinatorCwd, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);

  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-relative', role: 'implementer', harness: 'claude-code', cwd: relative,
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, cwd);
  const child = (await fake.sessions()).find((s) => s.name === 'impl-relative');
  assert.equal(child?.cwd, cwd);
});

test('folder entries and absorbed-file ids deliver launch briefs to a fake harness', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  const folder = (await coord.call<{ artifact: { id: string } }>('artifact.create', { kind: 'prompt', title: 'Folder brief', topic: 'general', folder: true, content: 'Read the folder entry.' })).artifact;
  const file = (await coord.call<{ artifact: { id: string } }>('artifact.create', { kind: 'prompt', title: 'File brief', topic: 'general', content: 'Read the absorbed file.' })).artifact;
  assert.equal((await coord.call<{ ok: boolean }>('artifact.move', { artifact: file.id, folder: folder.id, name: 'absorbed.md' })).ok, true);
  for (const [name, artifact, text] of [['folder-brief', folder.id, 'Read the folder entry.'], ['absorbed-brief', file.id, 'Read the absorbed file.']]) {
    const launch = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'implementer', harness: 'claude-code', brief: artifact });
    assert.equal(launch.ok, true, launch.error);
    await eventually('resolved brief delivered to harness', async () => (await fake.log(launch.process.harnessId!)).includes(text!) ? true : undefined);
  }
});
