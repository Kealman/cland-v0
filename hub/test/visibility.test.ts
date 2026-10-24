// T3: UI writer death/lock recovery, serving-path responsiveness and native death event.

import { sessionUi as connectUi } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually, fakeClaude, killDaemon, nativeProjectHub as projectHub, tempProject, withDiscoveredPid } from './harness.ts';
import type { EventsPage, Inbox } from '../src/protocol.ts';

test('layout saves and human choices serialize through the shared UI lock', async t => {
  const { readFile, rm } = await import('node:fs/promises');
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const path = join(root, '.cland/ui.json');
  await writeFile(path, JSON.stringify({ layout: 'latest', visibility: {} }));
  await mkdir(`${path}.lock`);
  await writeFile(join(`${path}.lock`, '00000000-0000-0000-0000-000000000001.owner'), String(process.pid));
  const blocked = await ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'mute' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error!, /being saved/);
  await rm(`${path}.lock`, { recursive: true });
  assert.equal((await ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'mute' })).ok, true);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.layout, 'latest');
  assert.equal(saved.visibility.topics.general, 'mute');
});

test('concurrent human choices safely recover a dead UI writer and preserve both updates', async t => {
  const { readFile } = await import('node:fs/promises');
  const { spawn } = await import('node:child_process');
  // cland-allow-child-env: empty Node bystander supplies a reaped PID; no account or Git operation
  const dead = spawn(process.execPath, ['-e', '']);
  const deadPid = dead.pid!;
  await new Promise<void>(resolve => dead.once('exit', () => resolve()));
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const a = await connectUi(t, discovery), b = await connectUi(t, discovery);
  const path = join(root, '.cland/ui.json');
  await writeFile(path, JSON.stringify({ layout: 'preserved', visibility: {} }));
  await mkdir(`${path}.lock`);
  await writeFile(join(`${path}.lock`, '00000000-0000-0000-0000-000000000001.owner'), String(deadPid));
  const results = await Promise.all([
    a.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'pin' }),
    b.request({ type: 'visibility.set', surface: 'topics', target: 'agents', mode: 'mute' }),
  ]);
  for (const result of results) assert.equal(result.ok, true, result.error);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.layout, 'preserved');
  assert.deepEqual(saved.visibility.topics, { general: 'pin', agents: 'mute' });
});

test('a preference disk wait leaves the serving path responsive', { skip: process.platform === 'win32' }, async t => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery), observer = await connectUi(t, discovery);
  const path = join(root, '.cland/ui.json');
  await promisify(execFile)('mkfifo', [path], { env: fixtureEnvironment(root, process.env) });
  const choice = ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'pin' });
  try {
    await eventually('preference file read acquired its lock', async () => {
      const { stat } = await import('node:fs/promises');
      try { return (await stat(`${path}.lock`)).isDirectory() ? true : undefined; } catch { return undefined; }
    });
    assert.equal((await observer.request({ type: 'hub.status' }, 2000)).ok, true, 'another request completes while UI file read is blocked');
  } finally {
    await writeFile(path, JSON.stringify({ layout: 'preserved', visibility: {} }));
  }
  assert.equal((await choice).ok, true);
});

for (const [terminal, role, expected] of [['stopped', 'implementer', 'background'], ['exited', 'implementer', 'background'], ['stopped', 'aide', 'now']] as const) {
  test(`live ${role} ${terminal} state keeps terminal placement under an idle-now override`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[visibility]\nsessions.idle = "now"\n');
    const fake = await fakeClaude(t, { pollMs: 50, reexecGraceMs: 100 });
    const { discovery } = await projectHub(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    const launched = await ui.request({ type: 'session.launch', name: 'worker', role, harness: 'claude-code' }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const processRow = (launched.value as { process: { sessionId: string; pid: number } }).process;
    let published: ReturnType<typeof ui.waitFor> | undefined;
    if (terminal === 'stopped') assert.equal((await ui.request({ type: 'session.stop', session: 'worker' }, 30_000)).ok, true);
    else {
      const pid = (await withDiscoveredPid(ui, processRow)).pid;
      published = ui.waitFor(f => f.type === 'session.process' && (f.process as { status: string }).status === terminal);
      process.kill(pid, 'SIGKILL');
      await killDaemon(pid);
    }
    const changed = await (published ?? ui.waitFor(f => f.type === 'session.process' && (f.process as { status: string }).status === terminal));
    assert.equal((changed.process as { layer: string }).layer, expected);
    const state = await ui.waitFor(f => f.type === 'session.state' && f.sessionId === processRow.sessionId && f.state === 'unknown' && f.source === (terminal === 'stopped' ? 'stopped' : 'process'));
    assert.equal(state.layer, expected, 'the following state event must keep terminal status and the Aide exception');
  });
}

test('the hub places messages, sessions, items and artifacts by the default table on snapshots and live frames', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const { spawnSpoke } = await import('./harness.ts');
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => coord.close()); t.after(() => impl.close());
  await coord.waitForPresence(['coord', 'impl']);
  await coord.call('send', { topic: 'general', text: 'Report to the human' });
  await impl.call('send', { topic: 'general', text: 'Implementation question', to: ['coord'] });
  await ui.request({ type: 'topic.send', topic: 'general', text: '@impl what changed?' });
  const direct = await impl.call<{ ok: boolean; error?: string }>('send', { topic: 'general', text: 'Direct human report' });
  assert.equal(direct.ok, true, direct.error);
  const { messages } = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ id: string; text: string; layer: string }> };
  for (const [text, layer] of [['Report to the human', 'watch'], ['Implementation question', 'background'], ['Direct human report', 'now']]) {
    const m = messages.find(m => m.text === text)!;
    assert.equal(m.layer, layer);
    const event = await ui.waitFor(f => f.type === 'message' && (f.message as { id: string }).id === m.id);
    assert.equal((event.message as { layer: string }).layer, layer);
  }
  const unread = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.deepEqual(unread.messages.map(m => m.text), ['Direct human report']);
  assert.equal(unread.needsYou, 1, 'the unread now message counts under the four-kind inbox');
  assert.equal((await ui.request({ type: 'topic.read', topic: 'general' })).ok, true);
  const read = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(read.messages.length, 0);
  assert.equal(read.needsYou, 0, 'read the report before checking that verdict notifications add no waits');
  const create = async (title: string, extra: Record<string, unknown> = {}) => {
    const result = await ui.request({ ...((!('kind' in extra) || extra.kind === 'task') ? { size: 'M' } : {}), type: 'task.create', title, ...extra });
    assert.equal(result.ok, true, result.error);
    return (result.value as { item: { id: string; layer: string } }).item;
  };
  const release = await create('Current', { kind: 'release', version: '0.1.0' });
  const epic = await create('Visibility', { kind: 'epic', parent: release.id });
  const active = await create('Work', { parent: epic.id });
  await ui.request({ type: 'task.edit', item: active.id, status: 'in progress' });
  const planned = await create('Next', { parent: epic.id });
  await ui.request({ type: 'task.edit', item: planned.id, status: 'planned' });
  // §3.5: planned is Watch only inside the current release; an orphan is unscheduled Background.
  const orphan = await create('Unscheduled plan');
  await ui.request({ type: 'task.edit', item: orphan.id, status: 'planned' });
  const later = await create('Later', { kind: 'release', version: '0.2.0' });
  const unscheduled = await create('Future work', { parent: later.id });
  await ui.request({ type: 'task.edit', item: unscheduled.id, status: 'in progress' });
  const oldRelease = await create('Old', { kind: 'release', version: '0.0.1' });
  await ui.request({ type: 'task.close', item: oldRelease.id });
  const list = (await ui.request({ type: 'task.list' })).value as { items: Array<{ id: string; layer: string }> };
  for (const [id, layer] of [[active.id, 'now'], [planned.id, 'watch'], [orphan.id, 'background'], [unscheduled.id, 'background'], [oldRelease.id, 'archive']]) assert.equal(list.items.find(i => i.id === id)?.layer, layer);
  const mark = ui.frames.length;
  assert.equal((await ui.request({ type: 'task.edit', item: release.id, version: '0.3.0' })).ok, true);
  const promoted = await ui.waitFor(f => f.type === 'task' && f.id === release.id && ui.frames.indexOf(f) >= mark);
  assert.equal((promoted.layers as Record<string, string>)[unscheduled.id], 'now', 'changing the current release publishes newly active placements');
  assert.equal((promoted.layers as Record<string, string>)[active.id], 'background');
  assert.equal((promoted.layers as Record<string, string>)[planned.id], 'background', 'planned work leaves Watch when its release is no longer current');
  assert.equal((promoted.layers as Record<string, string>)[orphan.id], 'background');
  assert.equal((await ui.request({ type: 'task.edit', item: release.id, version: '0.1.0' })).ok, true);
  await ui.request({ type: 'task.comment', item: active.id, text: 'Fix the fold.', verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'v-now' }, as: { name: 'rev', role: 'reviewer' } });
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.ok(((await ui.request({ type: 'events.list' })).value as EventsPage).rows.some(r => r.kind === 'verdict' && r.warning));
  assert.equal(inbox.needsYou, 0);
  await ui.request({ type: 'task.comment', item: planned.id, text: 'Looks good.', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'v-watch' }, as: { name: 'rev', role: 'reviewer' } });
  const after = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.ok(((await ui.request({ type: 'events.list' })).value as EventsPage).rows.some(r => r.kind === 'verdict' && !r.warning));
  assert.equal(after.needsYou, 0);
  const humanArtifact = (await ui.request({ type: 'artifact.create', kind: 'note', title: 'Mine', topic: 'general', content: 'Notes' })).value as { artifact: { layer: string } };
  assert.equal(humanArtifact.artifact.layer, 'watch');
  const topicResult = await ui.request({ type: 'topic.create', title: 'Agent artifacts' });
  const agentTopic = (topicResult.value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'topic.send', topic: agentTopic, text: '@impl share the report' });
  const agentArtifact = await impl.call<{ artifact: { layer: string } }>('artifact.create', { kind: 'note', title: 'Agent report', topic: agentTopic, content: 'Notes' });
  assert.equal(agentArtifact.artifact.layer, 'background');
  const reportArtifact = await coord.call<{ artifact: { layer: string } }>('artifact.create', { kind: 'note', title: 'Human report', topic: 'general', content: 'Notes' });
  assert.equal(reportArtifact.artifact.layer, 'watch');
  const sessions = (await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; layer: string }> };
  assert.equal(sessions.sessions.find(s => s.name === 'impl')?.layer, 'watch', 'unobserved live sessions are watch');
});
