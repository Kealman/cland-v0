// T2: injected artifact rules and store reopen; recorded Neovim screens live in nvim/test/artifacts.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';
import type { Artifact } from '../src/protocol.ts';

test('an agent artifact keeps its placement after reopening the store', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Reports' })).value as { topic: { id: string } }).topic.id;
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer' });
  await impl.waitForPresence(['impl']);
  await ui.request({ type: 'topic.send', topic, text: '@impl share your report' });
  const result = await impl.call<{ ok: boolean; artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Agent report', topic, content: 'Report bytes' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const a = result.artifact;
  assert.equal(a.layer, 'background');
  assert.equal((await ui.request({ type: 'artifact.keep', artifact: a.id, kept: true })).ok, true);
  const kept = (await ui.request({ type: 'artifact.list', artifact: a.id })).value as { artifact: Artifact };
  assert.equal(kept.artifact.layer, 'watch');
  await impl.close(); await ui.close(); await hub.stop();
  const store = new Store(join(root, '.cland/hub.db'));
  try { assert.equal(store.artifact(a.id)?.kept, true); }
  finally { store.close(); }
  const reopened = await projectHub(t, root);
  const fresh = await connectUi(t, reopened.discovery);
  assert.equal(((await fresh.request({ type: 'artifact.list', artifact: a.id })).value as { artifact: Artifact }).artifact.layer, 'watch');
  assert.equal((await fresh.request({ type: 'artifact.keep', artifact: a.id, kept: false })).ok, true);
  assert.equal(((await fresh.request({ type: 'artifact.list', artifact: a.id })).value as { artifact: Artifact }).artifact.layer, 'background');
});

test('Coordinator artifacts publish in Agents', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const result = await coord.call<{ ok: boolean }>('artifact.create', { kind: 'note', title: 'Plan', content: '# Shared plan', topic: 'agents' });
  assert.equal(result.ok, true);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.match(JSON.stringify(history.value), /Shared plan|Plan/);
});

test('artifact CLI creates diagram and page files without changing source bytes', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const create = await cland(root, 'artifact', 'create', '--kind', 'diagram', '--title', 'Merge flow', '--content', 'graph TD\n A-->B', '--topic', 'general', '--json');
  assert.equal(create.code, 0, create.stderr);
  const a = JSON.parse(create.stdout).artifact as Artifact;
  const page = await cland(root, 'artifact', 'create', '--kind', 'page', '--title', 'Preview', '--content', '<h1>Preview</h1>', '--topic', 'general', '--json');
  assert.equal(page.code, 0, page.stderr);
  assert.equal(await readFile(a.path, 'utf8'), 'graph TD\n A-->B');
});

test('prompt sending delivers the saved bytes to the Coordinator', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const created = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Brief for T-12', topic: 'general', content: '', status: 'draft' });
  assert.equal(created.ok, true, created.error);
  const a = (created.value as { artifact: Artifact }).artifact;
  assert.match(a.path, /A-\d+-brief-for-t-12\.md$/);
  await writeFile(a.path, 'First line\nSecond line unsaved');
  assert.equal((await ui.request({ type: 'prompt.send', artifact: a.id })).ok, true);
  await coord.waitForEvent(e => e.params.content === 'First line\nSecond line unsaved');
  assert.equal(((await ui.request({ type: 'artifact.list', artifact: a.id })).value as { artifact: Artifact }).artifact.status, 'sent');
});

test('promoting an artifact writes its project file', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const create = await cland(root, 'artifact', 'create', '--kind', 'note', '--title', 'Keep', '--content', '# Keep', '--topic', 'general', '--json');
  assert.equal(create.code, 0, create.stderr);
  const a = JSON.parse(create.stdout).artifact as Artifact;
  assert.equal((await ui.request({ type: 'artifact.promote', artifact: a.id, path: 'docs/keep.md' })).ok, true);
  assert.equal(await readFile(join(root, 'docs/keep.md'), 'utf8'), '# Keep');
});

test('closed-topic artifacts retain deleted-file metadata on store reopen', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[artifacts]\nretention_days = 0\n');
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, hub.discovery);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Archive' })).value as { topic: { id: string } }).topic.id;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', clock });
  await coord.waitForPresence(['coord']);
  const a = (await coord.call<{ artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Old note', content: 'old bytes', topic })).artifact;
  await coord.close();
  assert.equal((await ui.request({ type: 'topic.close', topic })).ok, true);
  assert.equal(((await ui.request({ type: 'artifact.list', artifact: a.id })).value as { artifact: Artifact }).artifact.status, 'archived');
  await ui.close(); await hub.stop();
  const reopened = await projectHub(t, root, {}, { clock });
  const fresh = await connectUi(t, reopened.discovery);
  const retained = await eventually('startup retention records the deleted file', async () => {
    const listed = await fresh.request({ type: 'artifact.list' });
    assert.equal(listed.ok, true, listed.error);
    const entry = (listed.value as { artifacts: Artifact[] }).artifacts.find(entry => entry.id === a.id);
    return entry?.fileDeleted ? entry : undefined;
  });
  assert.equal(retained.fileDeleted, true);
  await assert.rejects(readFile(a.path), { code: 'ENOENT' });
});

test('moved artifact ids resolve after reopening their index', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const create = async (folder: boolean, title: string) => {
    const result = await ui.request({ type: 'artifact.create', kind: 'prompt', title, topic: 'general', status: 'draft', content: 'Draft bytes', folder });
    assert.equal(result.ok, true, result.error);
    return (result.value as { artifact: Artifact }).artifact;
  };
  const source = await create(false, 'Draft'), folder = await create(true, 'Folder');
  assert.equal((await ui.request({ type: 'artifact.move', artifact: source.id, folder: folder.id, name: 'moved.md' })).ok, true);
  const destination = join(folder.path, 'moved.md');
  assert.equal(await readFile(destination, 'utf8'), 'Draft bytes');
  await assert.rejects(readFile(source.path), { code: 'ENOENT' });
  assert.deepEqual(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.map(a => a.id), [folder.id]);
  await ui.close(); await hub.stop();
  const store = new Store(join(root, '.cland/hub.db'));
  try { assert.deepEqual(store.artifact(source.id)?.movedTo, { folder: folder.id, path: 'moved.md' }); }
  finally { store.close(); }
});
