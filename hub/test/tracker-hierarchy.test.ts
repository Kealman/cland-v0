// Release planning through the hub's public protocol, CLI and real MCP spoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, readDiscovery, spawnSpoke, startDaemon, tempProject } from './harness.ts';

type Item = { id: string; kind: string; version?: string; body: string; path: string; ancestry: Array<{ id: string; kind: string; title: string }> };

test('a release version and Notes survive writes and a hub restart; CLI and MCP expose them', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const created = await cland(root, 'task', 'create', 'v0.1', '--kind', 'release', '--version', '0.1.0', '--body', 'The goal.', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item = (JSON.parse(created.stdout) as { item: Item }).item;
  assert.equal(item.version, '0.1.0');
  assert.match(item.body, /^The goal\.\n\n## Notes$/);
  assert.match(await readFile(join(root, item.path), 'utf8'), /version: 0\.1\.0\n/);
  const comment = await cland(root, 'task', 'comment', item.id, 'Keep the version.');
  assert.equal(comment.code, 0, comment.stderr);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  const view = await spoke.call<{ ok: boolean; item: Item }>('task.view', { id: item.id });
  assert.equal(view.item.version, '0.1.0');
  const listed = await spoke.call<{ items: Item[] }>('task.list', { kind: 'release' });
  assert.equal(listed.items[0]?.version, '0.1.0');
  const optional = await spoke.call<{ ok: boolean; item: Item }>('task.create', { title: 'Later', kind: 'release', body: 'Goal\n\n## Notes\n\nPrepared notes.' });
  assert.equal(optional.ok, true);
  assert.equal(optional.item.version, undefined);
  assert.equal(optional.item.body, 'Goal\n\n## Notes\n\nPrepared notes.');
  for (const version of ['v0.1.0', '01.1.0', '0.1', '0.1.0-01', '0.1.0\n']) {
    const bad = await cland(root, 'task', 'create', 'Bad', '--kind', 'release', '--version', version);
    assert.equal(bad.code, 1, version);
    assert.match(bad.stderr, /version.*semver/);
  }
  const prerelease = await spoke.call<{ ok: boolean; item: Item }>('task.create', { title: 'Preview', kind: 'release', version: '1.2.3-rc.1+build.02' });
  assert.equal(prerelease.ok, true);
  assert.equal(prerelease.item.version, '1.2.3-rc.1+build.02');
});

test('the hub enforces the parenting rule on create, link and kind edits without partial writes', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  const create = async (kind: string, parent?: string) => {
    const r = await ui.request({ type: 'task.create', title: kind, kind, ...(parent ? { parent } : {}) });
    assert.equal(r.ok, true, r.error);
    return (r.value as { item: Item }).item.id;
  };
  const release = await create('release');
  const epic = await create('epic', release);
  const task = await create('task', epic);
  const map = await create('map');
  await create('question', map);
  await create('task', map); // wayfinder execution tickets are preserved
  await create('spec', release);
  for (const [kind, parent] of [['epic', task], ['release', epic], ['task', task], ['spec', map], ['epic', map], ['map', release]]) {
    const before = (await ui.request({ type: 'task.list' })).value;
    const refused = await ui.request({ type: 'task.create', title: 'Bad', kind, parent });
    assert.equal(refused.ok, false, `${kind} under ${parent}`);
    assert.match(refused.error ?? '', /parenting rule/);
    assert.deepEqual((await ui.request({ type: 'task.list' })).value, before);
  }
  for (const [item, parent] of [[epic, task], [release, epic], [task, task], [map, epic]]) {
    const refused = await ui.request({ type: 'task.link', item, parent });
    assert.equal(refused.ok, false);
    assert.match(refused.error ?? '', /parenting rule|cannot reference itself/);
  }
  const before = await readFile(join(root, '.cland/tasks/E-2-epic.md'), 'utf8');
  const edit = await ui.request({ type: 'task.edit', item: epic, kind: 'task', title: 'Must not change' });
  assert.equal(edit.ok, false, 'changing a container kind cannot leave its children under a leaf');
  assert.match(edit.error ?? '', /parenting rule/);
  assert.equal(await readFile(join(root, '.cland/tasks/E-2-epic.md'), 'utf8'), before);
  assert.equal((await ui.request({ type: 'task.link', item: task, parent: release })).ok, true);
  assert.equal((await ui.request({ type: 'task.link', item: epic, parent: null })).ok, true);
  // The same rule is applied by the CLI and MCP tool, not just raw frames.
  const badCli = await cland(root, 'task', 'link', release, '--parent', epic);
  assert.equal(badCli.code, 1);
  assert.match(badCli.stderr, /parenting rule/);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  const badMcp = await spoke.client.callTool({ name: 'task.link', arguments: { id: epic, parent: task } });
  assert.equal(badMcp.isError, true);
  assert.match(JSON.stringify(badMcp.content), /parenting rule/);
});

test('under selects descendants before other filters; CLI and MCP views return the root-to-item path', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  for (const frame of [
    { title: 'v0.1', kind: 'release', version: '0.1.0' },
    { title: 'Schema', kind: 'epic', parent: 'R-1' },
    { title: 'Other epic', kind: 'epic', parent: 'R-1' },
    { title: 'Parser', parent: 'E-2', labels: ['hub'] },
    { title: 'Direct leaf', kind: 'question', parent: 'R-1', labels: ['hub'] },
    { title: 'Unscheduled', kind: 'epic' },
    { title: 'Outside', parent: 'E-6', labels: ['hub'] },
  ]) assert.equal((await ui.request({ type: 'task.create', ...frame })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-4' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'E-2', override: 'Hierarchy fixture: no epic demo' })).ok, true);
  // Reopening a leaf leaves its closed ancestor readable and included in subtree queries.
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-4', state: 'open' })).ok, true);
  const ids = async (filter: Record<string, unknown>) => {
    const r = await ui.request({ type: 'task.list', ...filter });
    assert.equal(r.ok, true, r.error);
    return (r.value as { items: Item[] }).items.map(item => item.id);
  };
  assert.deepEqual(await ids({ under: '1' }), ['E-2', 'E-3', 'T-4', 'Q-5']);
  assert.deepEqual(await ids({ under: 'R-1', kind: 'epic' }), ['E-2', 'E-3']);
  assert.deepEqual(await ids({ under: 'R-1', state: 'open', labels: ['hub'] }), ['T-4', 'Q-5']);
  assert.deepEqual(await ids({ under: 'E-2' }), ['T-4']);
  assert.deepEqual(await ids({ under: 'T-4' }), []);
  for (const under of ['T-99', 'invalid', 12]) assert.equal((await ui.request({ type: 'task.list', under })).ok, false);
  const plain = await cland(root, 'task', 'view', 'T-4');
  assert.equal(plain.code, 0, plain.stderr);
  assert.equal(plain.stdout.split('\n')[0], 'R-1  v0.1 › E-2  Schema › T-4  Parser');
  const listed = await cland(root, 'task', 'list', '--under', 'R-1', '--kind', 'epic', '--json');
  assert.equal(listed.code, 0, listed.stderr);
  assert.deepEqual((JSON.parse(listed.stdout) as { items: Item[] }).items.map(item => item.id), ['E-2', 'E-3']);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  const mcpList = await spoke.call<{ items: Item[] }>('task.list', { under: 'R-1', kind: 'epic' });
  assert.deepEqual(mcpList.items.map(item => item.id), ['E-2', 'E-3']);
  const view = await spoke.call<{ item: Item }>('task.view', { id: 'T-4' });
  assert.deepEqual(view.item.ancestry, [
    { id: 'R-1', kind: 'release', title: 'v0.1' },
    { id: 'E-2', kind: 'epic', title: 'Schema' },
    { id: 'T-4', kind: 'task', title: 'Parser' },
  ]);
  assert.equal(view.item.path, '.cland/tasks/T-4-parser.md', 'file path keeps its existing meaning');
  assert.equal((await ui.request({ type: 'task.link', item: 'E-2', parent: null })).ok, true);
  const moved = await spoke.call<{ item: Item }>('task.view', { id: 'T-4' });
  assert.deepEqual(moved.item.ancestry.map(item => item.id), ['E-2', 'T-4']);
  assert.deepEqual(await ids({ under: 'R-1' }), ['E-3', 'Q-5']);
});

test('an unversioned release can be planned later; invalid version edits preserve the previous file', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  assert.equal((await cland(root, 'task', 'create', 'Later', '--kind', 'release')).code, 0);
  const edit = await cland(root, 'task', 'edit', 'T-1', '--version', '2.0.0', '--json');
  assert.equal(edit.code, 0, edit.stderr);
  assert.equal((JSON.parse(edit.stdout) as { item: Item }).item.version, '2.0.0');
  const file = join(root, '.cland/tasks/R-1-later.md');
  const before = await readFile(file, 'utf8');
  const ui = await connectUi(t, await readDiscovery(root));
  for (const version of ['v2.0.0', 2]) {
    assert.equal((await ui.request({ type: 'task.edit', item: 'T-1', version, title: 'Bad' })).ok, false);
    assert.equal(await readFile(file, 'utf8'), before);
  }
  assert.equal((await cland(root, 'task', 'create', 'Task', '--version', '2.0.0')).code, 1);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  const cleared = await spoke.call<{ ok: boolean; item: Item }>('task.edit', { id: 'T-1', version: null });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.item.version, undefined);
  assert.equal((await cland(root, 'task', 'edit', 'T-1', '--version', '2.1.0')).code, 0);
  assert.equal((await cland(root, 'task', 'edit', 'T-1', '--version', 'none')).code, 0);
});

test('converting an item to a release adds Notes and preserves existing notes', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  for (const body of ['Goal.', 'Goal.\n\n## Notes\n\nAlready prepared.']) {
    const made = await ui.request({ type: 'task.create', title: 'Convert', body });
    assert.equal(made.ok, true, made.error);
    const id = (made.value as { item: Item }).item.id;
    const changed = await ui.request({ type: 'task.edit', item: id, kind: 'release', version: '0.1.0' });
    assert.equal(changed.ok, true, changed.error);
    assert.equal((changed.value as { item: Item }).item.body, body === 'Goal.' ? 'Goal.\n\n## Notes' : body);
  }
});
