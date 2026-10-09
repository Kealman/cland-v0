import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { Artifact, TopicMessage } from '../src/protocol.ts';

test('a spoke creates a persistent diagram and publishes its structured chip in the topic', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const result = await coord.call<{ ok: boolean; artifact: Artifact }>('artifact.create', { kind: 'diagram', title: 'Merge flow', content: 'graph TD\n A-->B', topic: 'general' });
  assert.equal(result.ok, true);
  const a = result.artifact;
  assert.equal(a.id, 'A-1');
  assert.equal(a.path, join(root, '.cland/artifacts/A-1-merge-flow.mmd'));
  assert.equal(await readFile(a.path, 'utf8'), 'graph TD\n A-->B');
  assert.equal(a.status, 'shared');
  assert.equal(a.creator, 'coord');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  const messages = (history.value as { messages: TopicMessage[] }).messages;
  assert.equal(messages[0]?.artifact?.id, 'A-1');
  assert.deepEqual((await ui.request({ type: 'artifact.list', topic: 'general' })).value, { artifacts: [a] });
});


test('CLI copies a file that survives source deletion and lists persistent artifacts after restart', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const source = join(root, 'preview.html');
  await writeFile(source, '<h1>Preview</h1>');
  const result = await cland(root, 'artifact', 'create', '--kind', 'page', '--title', 'Preview', '--path', source, '--topic', 'general', '--json');
  assert.equal(result.code, 0, result.stderr);
  const a = (JSON.parse(result.stdout) as { artifact: Artifact }).artifact;
  await rm(source);
  assert.equal(await readFile(a.path, 'utf8'), '<h1>Preview</h1>');
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  const list = await cland(root, 'artifact', 'list', '--topic', 'general', '--json');
  assert.equal(list.code, 0, list.stderr);
  assert.deepEqual(JSON.parse(list.stdout), { artifacts: [a] });
  const next = await cland(root, 'artifact', 'create', '--kind', 'note', '--title', 'Next', '--content', 'Second', '--topic', 'general', '--json');
  assert.equal(JSON.parse(next.stdout).artifact.id, 'A-2');
});

test('invalid artifacts are typed refusals and leave the index unchanged', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const valid = { kind: 'note', title: 'Note', content: 'hello', topic: 'general' };
  for (const [change, code] of [
    [{ kind: 'unknown' }, 'artifact-kind'], [{ path: join(root, 'missing'), content: undefined }, 'artifact-source'],
    [{ path: join(root, 'missing') }, 'artifact-source'], [{ content: undefined }, 'artifact-source'],
    [{ topic: 'absent' }, 'artifact-topic'], [{ title: '  ' }, 'artifact-title'],
    [{ title: 'first\nsecond' }, 'artifact-title'],
  ] as const) {
    const r = await coord.call<{ ok: boolean; code: string }>('artifact.create', { ...valid, ...change });
    assert.equal(r.ok, false);
    assert.equal(r.code, code);
  }
  assert.deepEqual((await ui.request({ type: 'artifact.list' })).value, { artifacts: [] });
  const accepted = await coord.call<{ artifact: Artifact }>('artifact.create', valid);
  assert.equal(accepted.artifact.id, 'A-1');
});

test('all roles can share in a delivered request topic; other topics and CLI impersonation are refused', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ type: 'topic.create', title: 'Work' });
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const other = (await ui.request({ type: 'topic.create', title: 'Elsewhere' })).value as { topic: { id: string } };
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  for (const role of ['implementer', 'reviewer', 'qa']) {
    const name = `role-${role}`;
    const s = await spawnSpoke({ discover: true, cwd: root, name, role, sessionId: `session-${role}` });
    t.after(() => s.close());
    await s.waitForPresence([name, 'coord']);
    const request = { kind: 'note', title: role, content: 'result', topic };
    const noRequest = await s.call<{ ok: boolean; code: string }>('artifact.create', request);
    assert.equal(noRequest.code, 'forbidden');
    await coord.call('send', { topic, to: [name], text: 'Please exercise this work' });
    await s.waitForEvent((e) => e.params.content === 'Please exercise this work');
    const accepted = await s.call<{ ok: boolean; artifact: Artifact }>('artifact.create', request);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.artifact.creator, name);
    for (const forbidden of ['general', 'agents', other.topic.id]) {
      const r = await s.call<{ code: string }>('artifact.create', { ...request, topic: forbidden });
      assert.equal(r.code, 'forbidden');
    }
    const forged = await ui.request({ type: 'artifact.create', ...request, topic: other.topic.id, as: { name: 'human', sessionId: `session-${role}` } });
    assert.equal((forged as { code?: string }).code, 'forbidden');
  }
});

test('an Implementer may share in its claimed item topic without a mention', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const item = await cland(root, 'task', 'create', 'Own work', '--assignee', 'impl', '--json');
  const id = JSON.parse(item.stdout).item.id;
  const topic = (await ui.request({ type: 'topic.create', title: 'Own work', item: id })).value as { topic: { id: string } };
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  await impl.call('task.claim', { id });
  const r = await impl.call<{ ok: boolean }>('artifact.create', { kind: 'note', title: 'Result', content: 'Done', topic: topic.topic.id });
  assert.equal(r.ok, true);
});

test('artifact publications use send size and rate limits, rolling back files and index on refusal', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nrate_limit_max = 2\nrate_limit_window_minutes = 1\nmax_text_bytes = 64\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const request = { kind: 'note', title: 'Result', content: 'x'.repeat(10000), topic: 'general' };
  const big = await coord.call<{ ok: boolean; refusal: { rule: string } }>('artifact.create', { ...request, title: 'x'.repeat(65) });
  assert.equal(big.refusal.rule, 'size');
  assert.deepEqual(await readdir(join(root, '.cland/artifacts')), []);
  const first = await coord.call<{ ok: boolean; artifact: Artifact }>('artifact.create', request);
  assert.equal(first.ok, true, 'the cap is on the publication message, not its file');
  assert.equal(first.artifact.id, 'A-1');
  await coord.call('send', { text: 'One message', topic: 'general' });
  const limited = await coord.call<{ ok: boolean; refusal: { rule: string } }>('artifact.create', request);
  assert.equal(limited.ok, false);
  assert.equal(limited.refusal.rule, 'rate');
  assert.deepEqual((await ui.request({ type: 'artifact.list' })).value, { artifacts: [first.artifact] });
  assert.deepEqual(await readdir(join(root, '.cland/artifacts')), ['A-1-result.md']);
});
