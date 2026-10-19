// T2: artifact CLI subprocess subjects against an in-process hub and permission-probe spoke.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { Artifact } from '../src/protocol.ts';

test('the shell with an in-process hub creates a folder artifact from a directory or a new entry file', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  await mkdir(join(root, 'notes'));
  await writeFile(join(root, 'notes', 'first.md'), '# First');
  await writeFile(join(root, 'notes', 'entry.md'), '# Entry');
  const result = await cland(root, 'artifact', 'new', '--kind', 'note', '--title', 'Notes', '--topic', 'general', '--path', 'notes', '--entry', 'entry.md', '--json');
  assert.equal(result.code, 0, result.stderr);
  const a: Artifact = JSON.parse(result.stdout).artifact;
  assert.equal(a.folder, true);
  assert.equal(a.entry, 'entry.md');
  assert.equal(a.creator, 'human');
  assert.equal(await readFile(join(a.path, a.entry!), 'utf8'), '# Entry');
  const fresh = await cland(root, 'artifact', 'new', '--kind', 'prompt', '--title', 'Draft', '--topic', 'general', '--folder', '--entry', 'draft/start.md', '--content', '# Start', '--json');
  assert.equal(fresh.code, 0, fresh.stderr);
  const draft: Artifact = JSON.parse(fresh.stdout).artifact;
  assert.equal(await readFile(join(draft.path, 'draft/start.md'), 'utf8'), '# Start');
});

test('the shell with an in-process hub promotes a complete folder into docs without staging, committing or losing its source', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await cland(root, 'artifact', 'new', '--kind', 'note', '--title', 'v0.2 notes', '--topic', 'general', '--folder', '--content', '# v0.2', '--json');
  assert.equal(result.code, 0, result.stderr);
  const a: Artifact = JSON.parse(result.stdout).artifact;
  await mkdir(join(a.path, 'details')); await mkdir(join(a.path, 'empty'));
  await writeFile(join(a.path, 'details', 'data.bin'), Buffer.from([0, 255, 42]));
  const promoted = await cland(root, 'artifact', 'promote', a.id, 'docs/v0.2-notes', '--json');
  assert.equal(promoted.code, 0, promoted.stderr);
  assert.equal(JSON.parse(promoted.stdout).artifact.promoted, 'docs/v0.2-notes');
  assert.equal(await readFile(join(root, 'docs/v0.2-notes/index.md'), 'utf8'), '# v0.2');
  assert.deepEqual(await readFile(join(root, 'docs/v0.2-notes/details/data.bin')), Buffer.from([0, 255, 42]));
  assert.deepEqual(await readdir(join(root, 'docs/v0.2-notes/empty')), []);
  assert.equal(await readFile(join(a.path, 'index.md'), 'utf8'), '# v0.2');
  assert.equal((await cland(root, 'artifact', 'promote', a.id, 'docs/again')).code, 1);
});

test('open through an in-process hub resolves a folder entry and edits its saved bytes with the chosen editor', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await cland(root, 'artifact', 'new', '--kind', 'note', '--title', 'Notes', '--topic', 'general', '--folder', '--entry', 'notes.md', '--content', 'before', '--json');
  assert.equal(result.code, 0, result.stderr);
  const a: Artifact = JSON.parse(result.stdout).artifact;
  const resolved = await cland(root, 'artifact', 'open', a.id, '--json');
  assert.equal(resolved.code, 0, resolved.stderr);
  assert.equal(JSON.parse(resolved.stdout).path, join(a.path, 'notes.md'));
  assert.deepEqual(JSON.parse(resolved.stdout).files, ['notes.md']);
  // An external editor stand-in receives the path as one argument and saves in place.
  const editor = join(root, 'fake editor.cjs');
  await writeFile(editor, "require('node:fs').writeFileSync(process.argv[2], 'after');\n");
  const opened = await clandWithEnv(root, { VISUAL: `\"${process.execPath}\" \"${editor}\"`, EDITOR: 'false' }, 'artifact', 'open', a.id);
  assert.equal(opened.code, 0, opened.stderr);
  assert.equal(await readFile(join(a.path, 'notes.md'), 'utf8'), 'after');
  const listed = await cland(root, 'artifact', 'list', '--json');
  assert.equal(JSON.parse(listed.stdout).artifacts[0].id, a.id);
});

test('the shell with an in-process hub keeps, releases, moves and archives artifacts through the hub', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const make = async (title: string, ...options: string[]): Promise<Artifact> => {
    const result = await cland(root, 'artifact', 'new', '--kind', 'note', '--title', title, '--topic', 'general', '--json', ...options);
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout).artifact;
  };
  const folder = await make('Folder', '--folder');
  const source = await make('Source', '--content', 'source bytes');
  const keep = await cland(root, 'artifact', 'keep', source.id, '--json');
  assert.equal(keep.code, 0, keep.stderr);
  assert.equal(JSON.parse(keep.stdout).artifact.kept, true);
  const release = await cland(root, 'artifact', 'keep', source.id, '--release', '--json');
  assert.equal(release.code, 0, release.stderr);
  assert.equal(JSON.parse(release.stdout).artifact.kept, false);
  const move = await cland(root, 'artifact', 'move', source.id, folder.id, '--name', 'details.md', '--json');
  assert.equal(move.code, 0, move.stderr);
  assert.equal(JSON.parse(move.stdout).artifact.path, join(folder.path, 'details.md'));
  assert.equal(await readFile(join(folder.path, 'details.md'), 'utf8'), 'source bytes');
  await assert.rejects(readFile(source.path), { code: 'ENOENT' });
  const archive = await cland(root, 'artifact', 'archive', folder.id, '--json');
  assert.equal(archive.code, 0, archive.stderr);
  assert.equal(JSON.parse(archive.stdout).artifact.status, 'archived');
  assert.match((await cland(root, 'artifact', 'list')).stdout, /archived/);
});

test('an in-process agent can resolve human notes but cannot open them for editing, including an absorbed file', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  await projectHub(t, root, {}, { clock });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'coord-cli', clock });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  const folderResult = await cland(root, 'artifact', 'new', '--kind', 'note', '--title', 'Human folder', '--topic', 'general', '--folder', '--content', 'human bytes', '--json');
  assert.equal(folderResult.code, 0, folderResult.stderr);
  const folder: Artifact = JSON.parse(folderResult.stdout).artifact;
  const source = (await coord.call<{ artifact: Artifact }>('artifact.create', { kind: 'note', title: 'Agent file', topic: 'agents', content: 'agent bytes' })).artifact;
  const moved = await cland(root, 'artifact', 'move', source.id, folder.id, '--name', 'agent.md');
  assert.equal(moved.code, 0, moved.stderr);
  const editor = join(root, 'editor.cjs');
  await writeFile(editor, "require('node:fs').writeFileSync(process.argv[2], 'overwritten');\n");
  const env = { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coord-cli', VISUAL: `\"${process.execPath}\" \"${editor}\"` };
  for (const id of [folder.id, source.id]) {
    const info = await clandWithEnv(root, env, 'artifact', 'open', id, '--json');
    assert.equal(info.code, 0, info.stderr);
    const opened = await clandWithEnv(root, env, 'artifact', 'open', id);
    assert.equal(opened.code, 1, opened.stderr);
    assert.match(opened.stderr, /agents cannot edit/);
  }
  assert.equal(await readFile(join(folder.path, 'index.md'), 'utf8'), 'human bytes');
  assert.equal(await readFile(join(folder.path, 'agent.md'), 'utf8'), 'agent bytes');
  for (const command of ['keep', 'archive', 'promote']) {
    const result = await clandWithEnv(root, env, 'artifact', command, folder.id, ...(command === 'promote' ? ['docs/forbidden'] : []));
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /agents cannot change/);
  }
});
