import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, readdir, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { gitIn } from '../src/tracker/verdict-git.ts';
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
  await coord.waitForPresence(['coord']);
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
  const item = await cland(root, 'task', 'create', '--size', 'M', 'Own work', '--assignee', 'impl', '--json');
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

test('prompt drafts send text at the byte cap and attach above it, with persistent sent status', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nmax_text_bytes = 64\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  for (const [content, attached] of [['x'.repeat(64), false], ['x'.repeat(65), true], ['é'.repeat(32), false], ['é'.repeat(32) + 'x', true]] as const) {
    const created = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Brief', topic: 'general', content, status: 'draft' });
    assert.equal(created.ok, true, created.error);
    const a = (created.value as { artifact: Artifact }).artifact;
    assert.equal(a.status, 'draft');
    const sent = await ui.request({ type: 'prompt.send', artifact: a.id });
    assert.equal(sent.ok, true, sent.error);
    const message = (sent.value as { message: TopicMessage }).message;
    assert.equal(message.text, attached ? `Prompt ${a.id}: Brief` : content);
    assert.equal(message.artifacts?.[0]?.path, a.path);
    const event = await coord.waitForEvent(e => e.params.meta?.msg_id === message.id);
    assert.equal(event.params.meta?.artifact_path, a.path);
    assert.equal(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.find(x => x.id === a.id)?.status, 'sent');
  }
});

test('spoke send attaches several artifacts and refuses unknown, foreign and missing files', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => coord.close());
  t.after(() => impl.close());
  await coord.waitForPresence(['coord', 'impl']);
  const artifacts: Artifact[] = [];
  for (const title of ['Brief', 'Details']) {
    const created = await coord.call<{ artifact: Artifact }>('artifact.create', { kind: 'prompt', title, content: title, topic: 'agents', status: 'draft' });
    artifacts.push(created.artifact);
  }
  const sent = await coord.call<{ ok: boolean }>('send', { to: ['impl'], topic: 'agents', text: 'Read the briefs', artifacts: artifacts.map(a => a.id) });
  assert.equal(sent.ok, true);
  const event = await impl.waitForEvent(e => e.params.content === 'Read the briefs');
  assert.deepEqual(JSON.parse(event.params.meta!.artifacts!).map((a: Artifact) => a.path), artifacts.map(a => a.path));
  const stored = ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: TopicMessage[] }).messages.find(m => m.id === event.params.meta?.msg_id)!;
  assert.deepEqual(stored.artifacts?.map(a => a.status), ['sent', 'sent']);
  for (const ids of [['A-999999'], [artifacts[0]!.id, 'A-999999']]) {
    const refused = await coord.call<{ ok: boolean; code: string }>('send', { to: ['impl'], topic: 'agents', text: 'Unknown attachment', artifacts: ids });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'artifact-unavailable');
  }
  const foreign = await coord.call<{ ok: boolean; code: string }>('send', { to: ['impl'], topic: 'general', text: 'Foreign attachment', artifacts: [artifacts[0]!.id] });
  assert.equal(foreign.code, 'artifact-unavailable');
  await rm(artifacts[0]!.path);
  const missing = await coord.call<{ ok: boolean }>('send', { to: ['impl'], topic: 'agents', text: 'Missing file', artifacts: [artifacts[0]!.id] });
  assert.equal(missing.ok, false);
  assert.equal(impl.events.some(e => ['Unknown attachment', 'Foreign attachment', 'Missing file'].includes(e.params.content)), false);
});

test('forced prompt attachment keeps the saved text in its artifact and a refused post keeps the draft', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Brief', topic: 'general', content: 'Short brief', status: 'draft' });
  const a = (created.value as { artifact: Artifact }).artifact;
  const attached = await ui.request({ type: 'prompt.send', artifact: a.id, attach: true });
  assert.equal((attached.value as { message: TopicMessage }).message.text, `Prompt ${a.id}: Brief`);
  assert.equal(await readFile(a.path, 'utf8'), 'Short brief');
  const empty = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Empty', topic: 'general', content: '', status: 'draft' });
  const draft = (empty.value as { artifact: Artifact }).artifact;
  assert.equal((await ui.request({ type: 'prompt.send', artifact: draft.id })).ok, false);
  assert.equal(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.find(x => x.id === draft.id)?.status, 'draft');
  assert.equal((await ui.request({ type: 'prompt.send', artifact: a.id })).ok, false, 'a sent draft cannot post twice');
});

test('automatic and explicit prompt attachment pointers fit the cap with long and multibyte titles', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nmax_text_bytes = 33\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  for (const attach of [false, true]) for (const title of ['x'.repeat(100), 'é'.repeat(100)]) {
    const a = ((await ui.request({ type: 'artifact.create', kind: 'prompt', title, topic: 'general', content: attach ? 'Short' : 'x'.repeat(34), status: 'draft' })).value as { artifact: Artifact }).artifact;
    const sent = await ui.request({ type: 'prompt.send', artifact: a.id, attach });
    assert.equal(sent.ok, true, sent.error);
    const message = (sent.value as { message: TopicMessage }).message;
    assert.ok(Buffer.byteLength(message.text, 'utf8') <= 33);
    assert.equal(message.text, `Prompt ${a.id}: ` + (title.startsWith('é') ? 'é'.repeat(10) : 'x'.repeat(21)));
    assert.equal(message.artifacts?.[0]?.title, title, 'the full title remains in attachment metadata');
    assert.equal(message.artifacts?.[0]?.status, 'sent');
  }
});

test('an attachment pointer also fits a cap smaller than its usual heading', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nmax_text_bytes = 1\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const a = ((await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Long heading', topic: 'general', content: 'Over cap', status: 'draft' })).value as { artifact: Artifact }).artifact;
  const sent = await ui.request({ type: 'prompt.send', artifact: a.id });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: TopicMessage }).message;
  assert.equal(message.text, 'P');
  assert.equal(message.artifacts?.[0]?.id, a.id, 'the attachment still identifies the prompt');
});
test('human promotes artifact bytes into the repo without changing Git and refuses confined or occupied paths', async (t) => {
  const root = await tempProject(t);
  const git = gitIn(root);
  assert.equal(await git(['init', '-q', '-b', 'main']), '');
  await git(['config', 'user.name', 'Test']);
  await git(['config', 'user.email', 'test@example.com']);
  await writeFile(join(root, 'base'), 'base');
  await git(['add', 'base']);
  await git(['commit', '-qm', 'base']);
  const head = await git(['rev-parse', 'HEAD']);
  const index = await git(['ls-files', '--stage']);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Design', content: '# Design', topic: 'general' });
  const a = (made.value as { artifact: Artifact }).artifact;
  const result = await cland(root, 'artifact', 'promote', a.id, 'docs/design.md', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(join(root, 'docs/design.md'), 'utf8'), '# Design');
  assert.equal(JSON.parse(result.stdout).artifact.promoted, 'docs/design.md');
  assert.equal(await git(['rev-parse', 'HEAD']), head);
  assert.equal(await git(['ls-files', '--stage']), index);
  assert.match((await cland(root, 'artifact', 'list')).stdout, /promoted: docs\/design.md/);
  assert.equal((await cland(root, 'artifact', 'promote', a.id, 'docs/again.md')).code, 1);
});

test('closing topics or bound items archives artifacts; reopening restores files and promotion exempts them', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const item = JSON.parse((await cland(root, 'task', 'create', '--size', 'M', 'Design', '--json')).stdout).item.id;
  const topic = ((await ui.request({ type: 'topic.create', title: 'Design', item })).value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' });
  const create = async () => ((await ui.request({ type: 'artifact.create', as: { name: 'coord' }, kind: 'note', title: 'Design', content: 'bytes', topic })).value as { artifact: Artifact }).artifact;
  const a = await create();
  const promoted = await create();
  assert.equal((await cland(root, 'artifact', 'promote', promoted.id, 'design.md')).code, 0);
  const entries = async () => ((await ui.request({ type: 'artifact.list', topic })).value as { artifacts: Artifact[] }).artifacts;
  await ui.request({ type: 'topic.close', topic });
  assert.equal((await entries())[0]?.status, 'archived');
  assert.ok((await entries())[0]?.archivedAt);
  assert.equal((await entries())[1]?.status, 'shared');
  await ui.request({ type: 'topic.send', topic, text: 'Reopen' });
  assert.equal((await entries())[0]?.status, 'shared');
  assert.equal((await entries())[0]?.archivedAt, undefined);
  assert.equal((await cland(root, 'task', 'close', item)).code, 0);
  assert.equal((await entries())[0]?.status, 'archived');
  assert.equal(await readFile(a.path, 'utf8'), 'bytes');
});

test('zero-day retention on restart removes only archived files and keeps deleted index entries', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[artifacts]\nretention_days = 0\n');
  let { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Archive' })).value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' });
  const create = async (topic: string) => ((await ui.request({ type: 'artifact.create', as: { name: 'coord' }, kind: 'note', title: 'Note', content: 'keep bytes', topic })).value as { artifact: Artifact }).artifact;
  const gone = await create(topic);
  const deletedTopic = ((await ui.request({ type: 'topic.create', title: 'Deleted archive' })).value as { topic: { id: string } }).topic.id;
  const deletedTopicArtifact = await create(deletedTopic);
  await ui.request({ type: 'topic.close', topic: deletedTopic });
  await ui.request({ type: 'topic.delete', topic: deletedTopic });
  const promoted = await create(topic);
  const open = await create('general');
  assert.equal((await cland(root, 'artifact', 'promote', promoted.id, 'docs/keep.md')).code, 0);
  await ui.request({ type: 'topic.close', topic });
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  const restarted = await connectUi(t, discovery);
  await eventually('archived file deleted in background', async () => {
    const entries = ((await restarted.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
    return entries.find(a => a.id === gone.id)?.fileDeleted && entries.find(a => a.id === deletedTopicArtifact.id)?.fileDeleted ? true : undefined;
  });
  await assert.rejects(readFile(gone.path), { code: 'ENOENT' });
  await assert.rejects(readFile(deletedTopicArtifact.path), { code: 'ENOENT' });
  assert.equal(await readFile(promoted.path, 'utf8'), 'keep bytes');
  assert.equal(await readFile(open.path, 'utf8'), 'keep bytes');
  assert.equal(await readFile(join(root, 'docs/keep.md'), 'utf8'), 'keep bytes');
  assert.match((await cland(root, 'artifact', 'list')).stdout, /file deleted/);
  await restarted.request({ type: 'topic.send', topic, text: 'Reopen' });
  const entries = ((await restarted.request({ type: 'artifact.list', topic })).value as { artifacts: Artifact[] }).artifacts;
  assert.equal(entries[0]?.status, 'archived');
  assert.equal(entries[0]?.fileDeleted, true);
});

test('promotion rejects existing, escaped, absolute, private and symlinked destinations without copying', async (t) => {
  const root = await tempProject(t);
  const outside = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const a = ((await ui.request({ type: 'artifact.create', kind: 'file', title: 'Bytes', content: 'bytes', topic: 'general' })).value as { artifact: Artifact }).artifact;
  await writeFile(join(root, 'exists'), 'original');
  await symlink(outside, join(root, 'escape'));
  await symlink(join(root, '.cland'), join(root, 'private'));
  for (const path of ['exists', '../outside', 'docs/../normalized', join(root, 'absolute'), '.cland/copy', '.CLAND/copy', 'escape/sub/copy', 'private/sub/copy']) {
    const result = await cland(root, 'artifact', 'promote', a.id, path);
    assert.equal(result.code, 1, path);
    assert.equal(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts[0]?.promoted, undefined);
  }
  assert.equal(await readFile(join(root, 'exists'), 'utf8'), 'original');
  assert.deepEqual(await readdir(outside), []);
  await assert.rejects(readFile(join(root, '.cland/copy')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(root, 'absolute')), { code: 'ENOENT' });
});

test('promotion is granted to the Coordinator from its shell and refused to the other roles', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery, 'cli');
  const a = ((await ui.request({ type: 'artifact.create', kind: 'note', title: 'Keep', content: 'bytes', topic: 'general' })).value as { artifact: Artifact }).artifact;
  for (const role of ['implementer', 'reviewer', 'qa', 'coordinator']) {
    const name = `promoter-${role}`;
    const sessionId = `promote-${role}`;
    const s = await spawnSpoke({ discover: true, cwd: root, name, role, sessionId });
    t.after(() => s.close());
    await s.waitForPresence([name]);
    const owned = role === 'coordinator' ? (await s.call<{ artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Own note', topic: 'general', content: 'bytes' })).artifact : a;
    const result = await ui.request({ type: 'artifact.promote', artifact: owned.id, path: `${role}.md`, as: { name, sessionId } });
    if (role === 'coordinator') assert.equal(result.ok, true, result.error);
    else {
      assert.equal(result.ok, false);
      assert.equal((result as { code?: string }).code, 'forbidden');
      await assert.rejects(readFile(join(root, `${role}.md`)), { code: 'ENOENT' });
    }
  }
});
