import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, clauseAnswered, connectUi, fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { DEFAULTS, parseRoles } from '../src/roles/config.ts';
import { DEFAULT_PERMISSIONS, decide, KNOWN_TOOLS } from '../src/roles/permissions.ts';
import type { Artifact, Message } from '../src/protocol.ts';

const aideTools = ['task.plan', 'task.create', 'task.edit', 'task.close', 'task.link', 'task.comment', 'task.claim', 'task.criterion', 'task.view', 'task.list', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', 'artifact.promote', 'send', 'topic.create', 'history', 'who', 'status'];

test('Aide defaults are non-exclusive, use the human model, and grant exactly §3.3/3.4/3.10 tools', () => {
  const aide = DEFAULTS.get('aide')!;
  assert.equal(aide.exclusive, false);
  assert.equal(aide.launch.harness, 'claude-code');
  assert.equal(aide.launch.model, null);
  assert.deepEqual(aide.permissions.tools, aideTools);
  assert.deepEqual(DEFAULT_PERMISSIONS.aide, aideTools);
  assert.deepEqual(parseRoles('').get('aide'), aide);
  assert.equal(parseRoles('[aide.launch]\nharness = "claude-code"\nmodel = "chosen-by-human"').get('aide')?.launch.model, 'chosen-by-human');
  for (const tool of KNOWN_TOOLS) {
    const decision = decide('aide', KNOWN_TOOLS, { tool, ...(tool === 'task.criterion' ? { criterionOp: 'done' } : {}) });
    assert.equal(decision.ok, aideTools.includes(tool), tool);
    if (!decision.ok) assert.match(decision.reason, /Aide rule \(v0.1 §3.3\)/);
  }
});

test('cland init writes the Aide defaults and CLI launches several Aides with no model override', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const init = await clandWithEnv(root, fake.env, 'init');
  assert.equal(init.code, 0, init.stderr);
  const roles = parseRoles(await readFile(join(root, '.cland', 'roles.toml'), 'utf8'));
  assert.deepEqual(roles.get('aide'), DEFAULTS.get('aide'));
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const name of ['aide-1', 'aide-2']) {
    const launch = await cland(root, 'session', 'launch', name, '--role', 'aide', '--json');
    assert.equal(launch.code, 0, launch.stderr);
    const process = JSON.parse(launch.stdout).process;
    assert.equal(process.harness, 'claude-code');
    assert.equal(process.label, `${name} [Aide]`);
    assert.equal((await fake.job(process.harnessId)).model, null);
    await clauseAnswered(ui, name);
  }
  const status = await ui.request({ type: 'hub.status' });
  assert.deepEqual((status.value as { sessions: Array<{ name: string; role: string }> }).sessions.filter(s => s.role === 'aide').map(s => s.name).sort(), ['aide-1', 'aide-2']);
});

test('Aide tracker, topics, artifacts and named sends work; crew operations name the refusing rule', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const aide = await spawnSpoke({ cwd: root, discover: true, name: 'aide-1', role: 'aide', sessionId: 'aide-id' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(async () => { await aide.close(); await coord.close(); });
  await aide.waitForPresence(['aide-1', 'coord']);
  await aide.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.content.includes('you hold the role Aide'));
  const made = await aide.call<{ ok: boolean; item: { id: string } }>('task.create', { title: 'Human planning' });
  assert.equal(made.ok, true);
  const id = made.item.id;
  const call = async (tool: string, args: Record<string, unknown> = {}) => {
    const result = await aide.call<{ ok: boolean; error?: string }>(tool, args);
    assert.equal(result.ok, true, `${tool}: ${JSON.stringify(result)}`);
    return result;
  };
  await call('task.edit', { id, status: 'planned', title: 'Aide edits any item' });
  await call('task.claim', { id });
  const view = await aide.call<{ item: { status: string } }>('task.view', { id });
  assert.equal(view.item.status, 'in progress');
  await call('task.list');
  await call('task.comment', { id, text: 'A planning note.' });
  await call('task.link', { id, branch: 't/aide-planning' });
  const opened = await aide.call<{ ok: boolean; topic: { id: string } }>('topic.create', { title: 'Human planning topic' });
  assert.equal(opened.ok, true);
  await call('send', { topic: opened.topic.id, text: 'The human may read this topic.' });
  await call('send', { to: ['coord'], text: 'Aide named send' });
  const named = await coord.waitForEvent(e => e.params.meta?.from === 'aide-1' && e.params.content.includes('Aide named send'));
  assert.match(named.params.content, /(?:^|\n)Aide named send(?:\n|$)/);
  assert.match(named.params.content, /event · task · T-1 status changed backlog → planned/);
  await call('history', { topic: opened.topic.id });
  await call('status', { text: 'Planning with the human' });
  for (const topic of [opened.topic.id, 'general', 'agents']) {
    const created = await aide.call<{ ok: boolean; artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Human draft', topic, content: 'Aide artifact bytes' });
    assert.equal(created.ok, true, JSON.stringify(created));
    const path = `notes/${topic}.md`;
    await call('artifact.promote', { artifact: created.artifact.id, path });
    assert.equal(await readFile(join(root, path), 'utf8'), 'Aide artifact bytes');
    const cliArtifact = await aide.call<{ ok: boolean; artifact: Artifact }>('artifact.create', { kind: 'prompt', title: 'CLI draft', topic, content: 'CLI bytes', status: 'draft' });
    assert.equal(cliArtifact.ok, true, JSON.stringify(cliArtifact));
    const cli = await clandWithEnv(root, { CLAND_SESSION_NAME: 'aide-1', CLAND_SESSION_ID: 'aide-id' }, 'artifact', 'promote', cliArtifact.artifact.id, `notes/${topic}-cli.md`, '--json');
    assert.equal(cli.code, 0, cli.stderr);
  }
  await call('task.close', { id });
  for (const [tool, args] of [
    ['ask', { topic: opened.topic.id, question: 'Crew decision?', options: [] }],
    ['resolve', { topic: opened.topic.id }],
    ['session.launch', { name: 'other', role: 'implementer' }],
    ['merge', { item: id }],
    ['role.handover', { to: 'coord' }],
    ['role.state', {}],
    ['subscribe', { subject: { item: id }, events: ['task'] }],
    ['task.rank', { id, top: true }],
    ...['all', 'coordinator', 'aide', 'aide-*', `lead ${id}`].map(to => ['send', { to: [to], text: 'Broadcast attempt' }]),
  ] as Array<[string, Record<string, unknown>]>) {
    const refused = await aide.call<{ ok: boolean; code: string; reason: string }>(tool, args);
    assert.equal(refused.ok, false, tool);
    assert.equal(refused.code, 'forbidden', tool);
    assert.match(refused.reason, /Aide rule \(v0.1 §3.3\)/, tool);
  }
  for (const args of [['session', 'stop', 'coord'], ['session', 'resume', 'coord'], ['release', '0.1.0'], ['sync'], ['push']]) {
    const refused = await clandWithEnv(root, { CLAND_SESSION_NAME: 'aide-1', CLAND_SESSION_ID: 'aide-id' }, ...args);
    assert.equal(refused.code, 1, args.join(' '));
    assert.match(refused.stderr, /Aide rule \(v0.1 §3.3\)/, args.join(' '));
  }
  const record = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.ok((record.value as { messages: Message[] }).messages.some(m => m.kind === 'refusal' && m.text.includes('Aide rule')));
});

test('live and offline Aides receive names and clauses only, with no role placeholders, broadcasts or asks', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const aide = await spawnSpoke({ cwd: root, discover: true, name: 'aide-1', role: 'aide', sessionId: 'aide-id' });
  let offline = await spawnSpoke({ cwd: root, discover: true, name: 'aide-2', role: 'aide', sessionId: 'offline-id' });
  t.after(async () => { await coord.close(); await aide.close(); await offline.close(); });
  await coord.waitForPresence(['coord', 'aide-1', 'aide-2']);
  await offline.close();
  for (const to of ['coordinator', 'implementer', 'reviewer', 'qa', 'aide', 'all', '*', 'aide-*']) {
    const sent = await coord.call<{ ok: boolean }>('send', { to: [to], text: `excluded broadcast ${to}` });
    assert.equal(sent.ok, true, to);
  }
  for (const to of ['aide', 'all', 'aide-*']) {
    const human = await ui.request({ type: 'topic.send', topic: 'general', to: [to], text: `excluded human broadcast ${to}` });
    assert.equal(human.ok, true, human.error);
    assert.deepEqual((human.value as { message: Message }).message.to, to === 'all' ? ['coord'] : []);
  }
  await coord.call('ask', { topic: 'general', question: 'Pending human ask', options: ['Yes'] });
  await ui.request({ type: 'role.set', session: 'notice-source', role: 'reviewer' });
  await coord.call('send', { to: ['aide-2'], text: 'offline named delivery' });
  offline = await spawnSpoke({ cwd: root, discover: true, name: 'aide-2', role: 'aide', sessionId: 'offline-id' });
  await offline.waitForEvent(e => e.params.content === 'offline named delivery');
  await coord.call('send', { to: ['aide-1'], text: 'live named barrier' });
  await aide.waitForEvent(e => e.params.content === 'live named barrier');
  for (const session of [aide, offline]) {
    assert.equal(session.events.some(e => /excluded|Pending human ask|notice-source/.test(e.params.content)), false, JSON.stringify(session.events));
    assert.equal(session.events.some(e => e.params.meta?.from === 'hub' && e.params.meta?.kind !== 'role'), false);
  }
  const explicit = await ui.request({ type: 'topic.send', topic: 'general', text: '@aide-1 human named delivery' });
  assert.equal(explicit.ok, true, explicit.error);
  await aide.waitForEvent(e => e.params.content === '@aide-1 human named delivery');
});

test('retained subscriptions cannot deliver Agents events to an Aide, and lead selects it only for its claim', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  let aide = await spawnSpoke({ cwd: root, discover: true, name: 'aide-1', role: 'reviewer', sessionId: 'aide-id' });
  t.after(async () => { await coord.close(); await aide.close(); });
  await coord.waitForPresence(['coord', 'aide-1']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Aide lead boundaries', assignee: 'aide-1' });
  assert.equal((await aide.call<{ ok: boolean }>('subscribe', { subject: { item: item.id }, events: ['task'] })).ok, true);
  await aide.close();
  await coord.call('task.edit', { id: item.id, status: 'planned' });
  await coord.call('send', { to: ['aide-1'], text: 'queued named barrier' });
  assert.equal((await ui.request({ type: 'role.set', session: 'aide-1', role: 'aide' })).ok, true);
  aide = await spawnSpoke({ cwd: root, discover: true, name: 'aide-1', role: 'aide', sessionId: 'aide-id' });
  await aide.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.meta?.role === 'aide');
  const queued = await aide.waitForEvent(e => e.params.content.includes('queued named barrier'));
  assert.doesNotMatch(queued.params.content, /event · task/);
  await coord.call('task.edit', { id: item.id, status: 'backlog' });
  await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${item.id} unclaimed lead barrier` });
  await coord.waitForEvent(e => e.params.content.includes('unclaimed lead barrier'));
  await coord.call('send', { to: ['aide-1'], text: 'named event barrier' });
  const barrier = await aide.waitForEvent(e => e.params.content.includes('named event barrier'));
  assert.doesNotMatch(barrier.params.content, /event · task|unclaimed lead barrier/);
  assert.equal((await aide.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  await coord.call('send', { to: [`lead ${item.id}`], text: 'claimed lead barrier' });
  const claimed = await aide.waitForEvent(e => e.params.content.includes('claimed lead barrier'));
  assert.match(claimed.params.content, /event · task · T-1 status changed backlog → in progress/);
  assert.doesNotMatch(claimed.params.content, /status changed planned → backlog/);
  assert.equal((await aide.call<{ ok: boolean }>('task.claim', { id: item.id, release: true })).ok, true);
  const human = await ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item.id}`], text: 'released lead' });
  assert.deepEqual((human.value as { message: Message }).message.to, ['coord']);
});

test('a Reviewer becoming an Aide drops queued broadcasts and their digest members but keeps named deliveries', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  let aide = await spawnSpoke({ cwd: root, discover: true, name: 'future-aide', role: 'reviewer', sessionId: 'future-id' });
  t.after(async () => { await coord.close(); await aide.close(); });
  await coord.waitForPresence(['coord', 'future-aide']);
  await aide.close();
  for (const to of ['all', 'reviewer', 'future-*']) {
    await coord.call('send', { to: [to], text: `excluded queued agent ${to}` });
  }
  for (const to of ['all', 'future-*']) {
    await ui.request({ type: 'topic.send', topic: 'general', to: [to], text: `excluded queued human ${to}` });
  }
  await coord.call('send', { to: ['all'], kind: 'progress', text: 'excluded broadcast digest member' });
  await coord.call('send', { to: ['future-aide'], text: 'retained named trigger' });
  await coord.call('send', { to: ['future-aide'], kind: 'progress', text: 'retained named digest member' });
  await coord.call('send', { to: ['all'], text: 'excluded broadcast trigger' });
  await coord.call('send', { to: ['all', 'future-aide'], text: 'retained explicit name plus broadcast' });
  assert.equal((await ui.request({ type: 'role.set', session: 'future-aide', role: 'aide' })).ok, true);
  aide = await spawnSpoke({ cwd: root, discover: true, name: 'future-aide', role: 'aide', sessionId: 'future-id' });
  await aide.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.meta?.role === 'aide');
  await aide.waitForEvent(e => e.params.content.includes('retained named trigger'));
  await aide.waitForEvent(e => e.params.content.includes('retained explicit name plus broadcast'));
  await coord.call('send', { to: ['future-aide'], text: 'retained named final barrier' });
  await aide.waitForEvent(e => e.params.content.includes('retained named final barrier'));
  assert.equal(aide.events.some(e => e.params.content.includes('excluded')), false, JSON.stringify(aide.events));
  assert.equal(aide.events.some(e => e.params.content.includes('retained named digest member')), true);
});
