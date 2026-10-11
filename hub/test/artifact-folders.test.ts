// Artifact workspace behavior through a real hub and spoke over their public frames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { Artifact } from '../src/protocol.ts';

test('a folder has one id, a selected entry, on-demand files, and can be attached by a spoke', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const source = join(root, 'notes');
  await mkdir(join(source, 'details'), { recursive: true });
  await writeFile(join(source, 'z.md'), '# Entry');
  await writeFile(join(source, 'a.md'), '# First');
  await writeFile(join(source, 'details', 'data.txt'), 'details');
  const made = await coord.call<{ ok: boolean; artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Notes', topic: 'agents', path: source, entry: 'z.md' });
  assert.equal(made.ok, true);
  const a = made.artifact;
  assert.equal(a.folder, true);
  assert.equal(a.entry, 'z.md');
  await rm(source, { recursive: true });
  assert.equal(await readFile(join(a.path, a.entry!), 'utf8'), '# Entry');
  const list = (await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] };
  assert.equal(list.artifacts.length, 1);
  const files = await coord.call<{ files: string[] }>('artifact.list', { artifact: a.id });
  assert.deepEqual(files.files, ['a.md', 'details/data.txt', 'z.md']);
  const sent = await coord.call<{ ok: boolean }>('send', { to: ['coord'], topic: 'agents', text: 'Read notes', artifacts: [a.id] });
  assert.equal(sent.ok, true);
  const blank = await coord.call<{ ok: boolean; artifact: Artifact }>('artifact.create', { kind: 'prompt', title: 'New folder', topic: 'agents', folder: true, content: '# New' });
  assert.equal(blank.ok, true);
  assert.equal(blank.artifact.entry, 'index.md');
  assert.equal(await readFile(join(blank.artifact.path, 'index.md'), 'utf8'), '# New');
  assert.equal((await readdir(join(root, '.cland/artifacts'))).length, 2);
});

test('human and Aide artifacts live until deleted by hand, kept reports survive, and agents cannot change their artifacts', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[artifacts]\nretention_days = 0\n');
  let { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Lifetime' })).value as { topic: { id: string } }).topic.id;
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'notes-aide', role: 'aide' });
  t.after(() => coord.close()); t.after(() => aide.close());
  await coord.waitForPresence(['coord', 'notes-aide']);
  const request = { kind: 'note', title: 'Notes', topic, content: 'keep bytes' };
  const mine = ((await ui.request({ type: 'artifact.create', ...request, folder: true })).value as { artifact: Artifact }).artifact;
  const theirs = (await aide.call<{ artifact: Artifact }>('artifact.create', request)).artifact;
  const report = (await coord.call<{ artifact: Artifact }>('artifact.create', { ...request, folder: true })).artifact;
  const kept = (await coord.call<{ artifact: Artifact }>('artifact.create', request)).artifact;
  assert.equal((await coord.call<{ ok: boolean }>('artifact.keep', { artifact: kept.id })).ok, true);
  const protectedFile = ((await ui.request({ type: 'artifact.create', ...request })).value as { artifact: Artifact }).artifact;
  for (const source of [protectedFile, theirs]) {
    const refused = await ui.request({ type: 'artifact.move', artifact: source.id, folder: report.id, name: source.id + '.md' });
    assert.equal(refused.ok, false);
    assert.match(JSON.stringify(refused), /human.*folder|protected.*folder/);
    assert.equal(await readFile(source.path, 'utf8'), 'keep bytes');
  }

  for (const a of [mine, theirs]) {
    for (const tool of ['artifact.keep', 'artifact.archive']) {
      const refused = await coord.call<{ code: string }>(tool, { artifact: a.id });
      assert.equal(refused.code, 'forbidden');
    }
  }
  await ui.request({ type: 'topic.close', topic });
  const entries = ((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
  for (const a of [mine, theirs, kept]) assert.equal(entries.find(x => x.id === a.id)?.status, 'shared');
  assert.equal((await ui.request({ type: 'artifact.archive', artifact: mine.id })).ok, true);
  await ui.request({ type: 'topic.send', topic, text: 'Reopen' });
  assert.equal(((await ui.request({ type: 'artifact.list', artifact: mine.id })).value as { artifact: Artifact }).artifact.status, 'archived');
  await ui.request({ type: 'topic.close', topic });
  await coord.close(); await aide.close();
  // A changed current role cannot revoke historical Aide provenance.
  await ui.request({ type: 'role.clear', session: 'notes-aide' });
  const { cland, eventually } = await import('./harness.ts');
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  const restarted = await connectUi(t, discovery);
  await eventually('only the unkept report is swept', async () => {
    const entries = ((await restarted.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
    return entries.find(x => x.id === report.id)?.fileDeleted ? true : undefined;
  });
  await assert.rejects(readFile(join(report.path, 'index.md')), { code: 'ENOENT' });
  assert.equal(await readFile(join(mine.path, 'index.md'), 'utf8'), 'keep bytes');
  assert.equal(await readFile(theirs.path, 'utf8'), 'keep bytes');
  assert.equal(await readFile(protectedFile.path, 'utf8'), 'keep bytes');
  assert.equal(await readFile(kept.path, 'utf8'), 'keep bytes');
});

test('moving absorbs a file, redirects its old chip, and follows the destination folder lifetime', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  const request = { kind: 'note', title: 'Notes', topic: 'general', content: 'source bytes' };
  const source = (await coord.call<{ artifact: Artifact }>('artifact.create', request)).artifact;
  const target = (await coord.call<{ artifact: Artifact }>('artifact.create', { ...request, folder: true, content: '# Folder' })).artifact;
  const moved = await coord.call<{ ok: boolean; artifact: Artifact }>('artifact.move', { artifact: source.id, folder: target.id, name: 'details.md' });
  assert.equal(moved.ok, true);
  assert.equal(moved.artifact.path, join(target.path, 'details.md'));
  assert.equal(await readFile(moved.artifact.path, 'utf8'), 'source bytes');
  await assert.rejects(readFile(source.path), { code: 'ENOENT' });
  assert.deepEqual(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.map(a => a.id), [target.id]);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { artifact?: Artifact }[] };
  assert.equal(history.messages.find(m => m.artifact?.id === source.id)?.artifact?.path, moved.artifact.path);
  const resolved = await coord.call<{ artifact: Artifact }>('artifact.list', { artifact: source.id });
  assert.equal(resolved.artifact.path, moved.artifact.path);
  const files = await coord.call<{ files: string[] }>('artifact.list', { artifact: target.id });
  assert.deepEqual(files.files, ['details.md', 'index.md']);
  assert.equal((await coord.call<{ ok: boolean }>('artifact.move', { artifact: target.id, folder: target.id })).ok, false);
  const occupied = (await coord.call<{ artifact: Artifact }>('artifact.create', request)).artifact;
  assert.equal((await coord.call<{ ok: boolean }>('artifact.move', { artifact: occupied.id, folder: target.id, name: 'index.md' })).ok, false);
  assert.equal(await readFile(occupied.path, 'utf8'), 'source bytes');
  assert.equal(await readFile(join(target.path, 'index.md'), 'utf8'), '# Folder');
  const mine = ((await ui.request({ type: 'artifact.create', ...request, folder: true })).value as { artifact: Artifact }).artifact;
  assert.equal((await coord.call<{ code: string }>('artifact.move', { artifact: occupied.id, folder: mine.id })).code, 'forbidden');
  assert.equal((await coord.call<{ code: string }>('artifact.move', { artifact: occupied.id, folder: target.id, name: '../escape' })).code, 'artifact-path');
  await coord.call('artifact.archive', { artifact: target.id });
  assert.equal((await coord.call<{ artifact: Artifact }>('artifact.list', { artifact: source.id })).artifact.status, 'archived');
});

test('folder entry defaults to the first Markdown file and invalid or symlinked trees leave no copied artifact', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const source = join(root, 'source');
  await mkdir(source);
  await writeFile(join(source, 'b.md'), 'second');
  await writeFile(join(source, 'a.md'), 'first');
  const request = { type: 'artifact.create', kind: 'note', title: 'Tree', topic: 'general', path: source };
  const created = await ui.request(request);
  assert.equal(created.ok, true);
  assert.equal((created.value as { artifact: Artifact }).artifact.entry, 'a.md');
  for (const entry of ['../a.md', '/a.md', 'missing.md']) assert.equal((await ui.request({ ...request, entry })).ok, false);
  const { symlink } = await import('node:fs/promises');
  await symlink(join(source, 'a.md'), join(source, 'link.md'));
  assert.equal((await ui.request(request)).ok, false);
  assert.equal(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.length, 1);
  assert.equal((await readdir(join(root, '.cland/artifacts'))).length, 1);
});

test('attaching a moved prompt preserves its redirect and agents attaching human drafts leave them editable', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  const make = async (folder = false) => ((await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Draft', topic: 'agents', status: 'draft', content: 'Draft bytes', folder })).value as { artifact: Artifact }).artifact;
  const source = await make();
  const folder = await make(true);
  assert.equal((await ui.request({ type: 'artifact.move', artifact: source.id, folder: folder.id })).ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'agents', to: ['coord'], text: 'Read moved draft', artifacts: [source.id] })).ok, true);
  assert.deepEqual(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.map(a => a.id), [folder.id]);
  const resolved = (await coord.call<{ artifact: Artifact }>('artifact.list', { artifact: source.id })).artifact;
  assert.equal(resolved.movedTo?.folder, folder.id);
  assert.equal(resolved.path, join(folder.path, resolved.movedTo!.path));
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'agents', to: ['coord'], text: 'Read human draft', artifacts: [folder.id] })).ok, true);
  assert.equal(((await ui.request({ type: 'artifact.list', artifact: folder.id })).value as { artifact: Artifact }).artifact.status, 'draft');
});

test('a queued attachment resolves its absorbed file when the recipient reconnects', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sender' });
  const reader = await spawnSpoke({ discover: true, cwd: root, name: 'reader', role: 'implementer', sessionId: 'reader' });
  t.after(() => coord.close()); t.after(() => reader.close());
  await coord.waitForPresence(['coord', 'reader']);
  await reader.close();
  const make = async (folder = false) => (await coord.call<{ artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Notes', content: 'bytes', topic: 'agents', folder })).artifact;
  const source = await make(), folder = await make(true);
  const sent = await coord.call<{ outcomes: { outcome: string }[] }>('send', { topic: 'agents', to: ['reader'], text: 'Queued notes', artifacts: [source.id] });
  assert.equal(sent.outcomes[0]?.outcome, 'queued');
  assert.equal((await coord.call<{ ok: boolean }>('artifact.move', { artifact: source.id, folder: folder.id, name: 'queued.md' })).ok, true);
  const reconnect = await spawnSpoke({ discover: true, cwd: root, name: 'reader', role: 'implementer', sessionId: 'reader' });
  t.after(() => reconnect.close());
  const event = await reconnect.waitForEvent(e => e.params.content === 'Queued notes');
  assert.equal(event.params.meta?.artifact_path, join(folder.path, 'queued.md'));
  assert.equal(await readFile(event.params.meta!.artifact_path!, 'utf8'), 'bytes');
  assert.equal(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.length, 1);
});

test('an existing T-190 Aide draft retains protection after upgrade and author role clearing', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[artifacts]\nretention_days = 0\n');
  let { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Upgrade' })).value as { topic: { id: string } }).topic.id;
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'old-aide', role: 'aide' });
  t.after(() => aide.close());
  await aide.waitForPresence(['old-aide']);
  const draft = (await aide.call<{ artifact: Artifact }>('artifact.create', { kind: 'prompt', title: 'Existing draft', topic, status: 'draft', content: 'protected legacy bytes' })).artifact;
  await aide.close();
  await ui.request({ type: 'role.clear', session: 'old-aide' });
  const { cland, eventually } = await import('./harness.ts');
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  // T-190's on-disk format records the publication role, but predates creatorKind.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  try { db.prepare("update artifacts set value = json_remove(value, '$.creatorKind') where number = ?").run(Number(draft.id.slice(2))); }
  finally { db.close(); }
  ({ discovery } = await startDaemon(t, root));
  const upgraded = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  for (const tool of ['artifact.keep', 'artifact.archive']) {
    assert.equal((await coord.call<{ code: string }>(tool, { artifact: draft.id })).code, 'forbidden');
  }
  const report = (await coord.call<{ artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Disposable report', topic, content: 'agent bytes' })).artifact;
  await upgraded.request({ type: 'topic.close', topic });
  await coord.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  ({ discovery } = await startDaemon(t, root));
  const retained = await connectUi(t, discovery);
  await eventually('unprotected report swept after upgrade', async () => {
    const entries = ((await retained.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
    return entries.find(a => a.id === report.id)?.fileDeleted ? true : undefined;
  });
  const resolved = ((await retained.request({ type: 'artifact.list', artifact: draft.id })).value as { artifact: Artifact }).artifact;
  assert.equal(resolved.status, 'draft');
  assert.equal(resolved.creatorRole, 'aide');
  assert.equal(await readFile(draft.path, 'utf8'), 'protected legacy bytes');
});
