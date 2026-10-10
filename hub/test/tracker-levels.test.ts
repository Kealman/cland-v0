// Configured hierarchy through the real hub, CLI and MCP boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseItem } from '../src/tracker/item.ts';
import { cland, connectUi, eventually, readDiscovery, spawnSpoke, startDaemon, tempProject } from './harness.ts';

test('configured containers work through CLI, MCP and the hub and enforce adjacent levels', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["release", "epic", "feature"]\n');
  await startDaemon(t, root);
  for (const [title, kind, parent] of [['Release', 'release', undefined], ['Epic', 'epic', 'T-1'], ['Feature', 'feature', 'T-2']]) {
    const made = await cland(root, 'task', 'create', title!, '--kind', kind!, ...(parent ? ['--parent', parent] : []), '--json');
    assert.equal(made.code, 0, made.stderr);
  }
  const ui = await connectUi(t, await readDiscovery(root));
  const bad = await ui.request({ type: 'task.create', title: 'Skipped level', kind: 'feature', parent: 'T-1' });
  assert.equal(bad.ok, false);
  assert.match(bad.error ?? '', /parenting rule.*feature.*release/);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  const made = await spoke.call<{ ok: boolean; item: { id: string; kind: string; path: string } }>('task.create', { title: 'MCP feature', kind: 'feature', parent: 'T-2' });
  assert.equal(made.ok, true);
  assert.equal(made.item.kind, 'feature');
  const edited = await spoke.call<{ ok: boolean }>('task.edit', { id: made.item.id, kind: 'task' });
  assert.equal(edited.ok, true);
  assert.match(await readFile(join(root, made.item.path), 'utf8'), /kind: task\n/);
  const list = await spoke.call<{ items: Array<{ kind: string }> }>('task.list', { kind: 'feature' });
  assert.deepEqual(list.items.map(it => it.kind), ['feature']);
  const badLink = await ui.request({ type: 'task.link', item: 'T-3', parent: 'T-1' });
  assert.equal(badLink.ok, false);
  assert.match(badLink.error ?? '', /parenting rule/);
  const leaf = await ui.request({ type: 'task.create', title: 'Feature work', parent: 'T-3' });
  assert.equal(leaf.ok, true);
  const child = (leaf.value as { item: { id: string } }).item.id;
  const badClose = await ui.request({ type: 'task.close', item: 'T-3' });
  assert.equal(badClose.ok, false);
  assert.match(badClose.error ?? '', /open children.*Feature work/);
  assert.equal((await ui.request({ type: 'task.close', item: child })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-3' })).ok, true);
});

test('queued close sees the child committed while it waited for the tracker write queue', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root, { CLAND_TEST_TASK_WRITE_PAUSE_MS: '300' });
  const ui = await connectUi(t, await readDiscovery(root));
  assert.equal((await ui.request({ type: 'task.create', title: 'Container', kind: 'epic' })).ok, true);
  const child = ui.request({ type: 'task.create', title: 'Queued child', parent: 'T-1' });
  await eventually('child write in flight', async () => (await readdir(join(root, '.cland/tasks'))).some(file => file.startsWith('.T-2-')) || undefined);
  const close = ui.request({ type: 'task.close', item: 'T-1' });
  assert.equal((await child).ok, true);
  const refused = await close;
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /open children.*T-2.*Queued child/);
});

test('close rechecks a child reopened during the parent temporary write before rename', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root, { CLAND_TEST_TASK_WRITE_PAUSE_MS: '300' });
  const ui = await connectUi(t, await readDiscovery(root));
  for (const frame of [{ title: 'Container', kind: 'epic' }, { title: 'Child', parent: 'T-1' }]) {
    assert.equal((await ui.request({ type: 'task.create', ...frame })).ok, true);
  }
  assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
  const dir = join(root, '.cland/tasks');
  const parent = join(dir, 'T-1-container.md');
  const child = join(dir, 'T-2-child.md');
  const before = await readFile(parent, 'utf8');
  const close = ui.request({ type: 'task.close', item: 'T-1' });
  await eventually('parent temporary write', async () => (await readdir(dir)).some(file => file.startsWith('.T-1-')) || undefined);
  await writeFile(child, (await readFile(child, 'utf8')).replace('state: closed', 'state: open'));
  const refused = await close;
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /open children.*T-2/);
  assert.equal(await readFile(parent, 'utf8'), before);
  assert.equal((await readdir(dir)).some(file => file.endsWith('.tmp')), false);
});

test('close and every kind-change path discover an unindexed disk reparent', async t => {
  for (const operation of ['close', 'edit', 'import']) {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["feature"]\n');
    await startDaemon(t, root, { CLAND_TEST_TASK_WRITE_PAUSE_MS: '300' });
    const ui = await connectUi(t, await readDiscovery(root));
    const issue = { number: 1, url: 'https://example.com/1', title: 'Container', body: '', labels: ['feature'], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' };
    assert.equal((await ui.request({ type: 'task.import', repo: 'test/project', issues: [issue] })).ok, true);
    assert.equal((await ui.request({ type: 'task.create', title: 'Unparented child' })).ok, true);
    const dir = join(root, '.cland/tasks');
    const parent = join(dir, 'T-1-container.md');
    const child = join(dir, 'T-2-unparented-child.md');
    const before = await readFile(parent, 'utf8');
    const frame = operation === 'close' ? { type: 'task.close', item: 'T-1' }
      : operation === 'edit' ? { type: 'task.edit', item: 'T-1', kind: 'task' }
      : { type: 'task.import', repo: 'test/project', issues: [{ ...issue, labels: [] }] };
    const pending = ui.request(frame);
    await eventually(`${operation} temporary write`, async () => (await readdir(dir)).some(file => file.startsWith('.T-1-')) || undefined);
    await writeFile(child, (await readFile(child, 'utf8')).replace('parent: null', 'parent: T-1'));
    const refused = await pending;
    assert.equal(refused.ok, false, operation);
    assert.match(refused.error ?? '', /T-2/, operation);
    assert.equal(await readFile(parent, 'utf8'), before, operation);
    assert.equal((await readdir(dir)).some(file => file.endsWith('.tmp')), false, operation);
  }
});

test('an unreadable task file outside the indexed children blocks container close by filename', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  assert.equal((await ui.request({ type: 'task.create', title: 'Container', kind: 'epic' })).ok, true);
  await writeFile(join(root, '.cland/tasks/T-99-unindexed.md'), '---\nid: T-99\ntitle: [\n---\n');
  const refused = await ui.request({ type: 'task.close', item: 'T-1' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /T-99-unindexed\.md/);
});

test('re-import cannot close an existing configured container over open children', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["feature"]\n');
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  const issue = { number: 1, url: 'https://example.com/1', title: 'Imported feature', body: '', labels: ['feature'], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' };
  assert.equal((await ui.request({ type: 'task.import', repo: 'test/project', issues: [issue] })).ok, true);
  assert.equal((await ui.request({ type: 'task.create', title: 'Open work', parent: 'T-1' })).ok, true);
  const file = join(root, '.cland/tasks/T-1-imported-feature.md');
  const before = await readFile(file, 'utf8');
  const close = (labels = issue.labels) => ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, labels, state: 'closed' }] });
  for (const labels of [issue.labels, []]) {
    const refused = await close(labels);
    assert.equal(refused.ok, false, `labels: ${JSON.stringify(labels)}`);
    assert.match(refused.error ?? '', /open children.*T-2.*Open work/);
    assert.equal(await readFile(file, 'utf8'), before);
  }
  const converted = await ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, labels: [] }] });
  assert.equal(converted.ok, false, 'an open import cannot convert a container with children into a leaf');
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
  assert.equal((await close()).ok, true);
});

test('renamed top-level metadata survives restart; an empty ladder refuses former containers with a notice', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = join(root, '.cland/config.toml');
  await writeFile(config, '[tracker]\nlevels = ["initiative", "feature"]\n');
  await startDaemon(t, root);
  const top = await cland(root, 'task', 'create', 'Plan', '--kind', 'initiative', '--version', '1.0.0', '--json');
  assert.equal(top.code, 0, top.stderr);
  assert.match(top.stdout, /## Notes/);
  assert.equal((await cland(root, 'task', 'create', 'Child', '--kind', 'feature', '--parent', 'T-1')).code, 0);
  assert.equal((await cland(root, 'task', 'close', 'T-1')).code, 1);
  const wrongVersion = await cland(root, 'task', 'edit', 'T-2', '--version', '1.0.0');
  assert.equal(wrongVersion.code, 1);
  assert.match(wrongVersion.stderr, /version belongs only to an initiative item/);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  assert.match((await cland(root, 'task', 'view', 'T-1', '--json')).stdout, /"version":"1.0.0"/);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await writeFile(config, '[tracker]\nlevels = []\n');
  await startDaemon(t, root);
  assert.deepEqual(JSON.parse((await cland(root, 'task', 'list', '--json')).stdout).items, [], 'unchanged file hashes do not retain kinds removed from config');
  const ui = await connectUi(t, await readDiscovery(root));
  await eventually('removed container notices', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.match(JSON.stringify(history.value), /T-1-plan\.md.*unknown kind/);
    return true;
  });
  for (const kind of ['task', 'question', 'spec', 'map']) assert.equal((await cland(root, 'task', 'create', kind, '--kind', kind)).code, 0);
  const bad = await cland(root, 'task', 'create', 'Old container', '--kind', 'epic');
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /unknown kind/);
});

test('reserved or malformed configured levels produce a notice and keep the default ladder', async t => {
  for (const levels of ['["task"]', '["question"]', '["spec"]', '["map"]', '["feature", "feature"]', '"feature"']) {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), `[tracker]\nlevels = ${levels}\n`);
    await startDaemon(t, root);
    assert.equal((await cland(root, 'task', 'create', 'Default', '--kind', 'epic')).code, 0);
    const ui = await connectUi(t, await readDiscovery(root));
    await eventually('invalid levels notice', async () => {
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      assert.match(JSON.stringify(history.value), /config\.toml.*config refused.*levels.*keeping the defaults/);
      return true;
    });
  }
});

test('unknown kinds at startup and on hand edit produce Agents notices while other items remain readable', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'T-1-unknown.md'), '---\nid: T-1\nkind: mystery\ntitle: Unknown\n---\n');
  await writeFile(join(dir, 'T-2-known.md'), '---\nid: T-2\nkind: task\ntitle: Known\n---\n');
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  const listed = await ui.request({ type: 'task.list' });
  assert.deepEqual((listed.value as { items: Array<{ id: string }> }).items.map(it => it.id), ['T-2']);
  await eventually('tracker index/notice', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.match(JSON.stringify(history.value), /T-1-unknown\.md.*unknown kind.*mystery/);
    return true;
  });
  await writeFile(join(dir, 'T-2-known.md'), '---\nid: T-2\nkind: mystery\ntitle: Known\n---\n');
  await eventually('tracker index/notice', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.match(JSON.stringify(history.value), /T-2-known\.md.*unknown kind/);
    const items = (await ui.request({ type: 'task.list' })).value as { items: unknown[] };
    assert.deepEqual(items.items, [], 'a refused replacement must leave no stale indexed kind');
    return true;
  });
  await writeFile(join(dir, 'T-2-known.md'), '---\nid: T-2\nkind: question\ntitle: Fixed\n---\n');
  await eventually('tracker index/notice', async () => {
    const items = (await ui.request({ type: 'task.list' })).value as { items: Array<{ kind: string }> };
    assert.deepEqual(items.items.map(it => it.kind), ['question']);
    return true;
  });
});

test('kind changes with children are refused by edit and reported for hand edits', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["feature"]\n');
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  assert.equal((await ui.request({ type: 'task.create', title: 'Container', kind: 'feature' })).ok, true);
  assert.equal((await ui.request({ type: 'task.create', title: 'Child', parent: 'T-1' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
  const file = join(root, '.cland/tasks/T-1-container.md');
  const before = await readFile(file, 'utf8');
  const edited = await ui.request({ type: 'task.edit', item: 'T-1', kind: 'task' });
  assert.equal(edited.ok, false, 'closed children also prevent converting a container to a leaf');
  assert.match(edited.error ?? '', /parenting rule.*child T-2/);
  assert.equal(await readFile(file, 'utf8'), before);
  await writeFile(file, before.replace('kind: feature', 'kind: task'));
  await eventually('hand kind change notice', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.match(JSON.stringify(history.value), /T-1-container\.md.*parenting rule.*child T-2/);
    return true;
  });
  const listed = (await ui.request({ type: 'task.list' })).value as { items: Array<{ kind: string }> };
  assert.equal(listed.items[0]?.kind, 'task', 'the valid hand edit remains authoritative');
});

test('a malformed indexed child stays visible and prevents close with its file named', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  for (const frame of [{ title: 'Epic', kind: 'epic' }, { title: 'Child', parent: 'T-1' }]) {
    assert.equal((await ui.request({ type: 'task.create', ...frame })).ok, true);
  }
  const parent = join(root, '.cland/tasks/T-1-epic.md');
  const child = join(root, '.cland/tasks/T-2-child.md');
  const original = await readFile(child, 'utf8');
  const before = await readFile(parent, 'utf8');
  await writeFile(child, '---\nid: T-2\nkind: task\ntitle: [\n---\n');
  await eventually('malformed child notice', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.match(JSON.stringify(history.value), /T-2-child\.md.*not valid YAML/);
    return true;
  });
  const listed = (await ui.request({ type: 'task.list' })).value as { items: Array<{ id: string }> };
  assert.deepEqual(listed.items.map(it => it.id), ['T-1', 'T-2'], 'malformed YAML retains the last known item');
  const closed = await ui.request({ type: 'task.close', item: 'T-1' });
  assert.equal(closed.ok, false);
  assert.match(closed.error ?? '', /T-2-child\.md/);
  assert.equal(await readFile(parent, 'utf8'), before);
  await writeFile(child, original);
  await eventually('repaired child can close', async () => {
    assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
    return true;
  });
  assert.equal((await ui.request({ type: 'task.close', item: 'T-1' })).ok, true);
});

test('close validates a previously closed child file without waiting for the watcher', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  for (const frame of [{ title: 'Epic', kind: 'epic' }, { title: 'Child', parent: 'T-1' }]) {
    assert.equal((await ui.request({ type: 'task.create', ...frame })).ok, true);
  }
  assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
  const file = join(root, '.cland/tasks/T-2-child.md');
  const before = await readFile(file, 'utf8');
  await writeFile(file, '---\nid: T-2\nkind: task\ntitle: [\n---\n');
  const close = await ui.request({ type: 'task.close', item: 'T-1' });
  assert.equal(close.ok, false);
  assert.match(close.error ?? '', /T-2-child\.md/);
  await writeFile(file, before);
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-1', state: 'closed' })).ok, true);
});

test('containers refuse close and closed-state edits naming open children, then close after children close or move', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  for (const frame of [
    { title: 'Release', kind: 'release' },
    { title: 'Epic', kind: 'epic', parent: 'T-1' },
    { title: 'Parser', parent: 'T-2' },
    { title: 'Schema', kind: 'question', parent: 'T-2' },
  ]) assert.equal((await ui.request({ type: 'task.create', ...frame })).ok, true);
  const epicFile = join(root, '.cland/tasks/T-2-epic.md');
  const before = await readFile(epicFile, 'utf8');
  const bad = await cland(root, 'task', 'close', 'T-2', '--comment', 'Must not persist');
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /open children.*T-3.*Parser.*T-4.*Schema/);
  assert.equal(await readFile(epicFile, 'utf8'), before);
  const edit = await ui.request({ type: 'task.edit', item: 'T-2', state: 'closed', title: 'Must not persist' });
  assert.equal(edit.ok, false);
  assert.match(edit.error ?? '', /open children.*T-3.*T-4/);
  assert.equal(await readFile(epicFile, 'utf8'), before);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  const release = await spoke.client.callTool({ name: 'task.close', arguments: { id: 'T-1' } });
  assert.equal(release.isError, true);
  assert.match(JSON.stringify(release.content), /open children.*T-2.*Epic/);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-3' })).ok, true);
  assert.equal((await ui.request({ type: 'task.link', item: 'T-4', parent: null })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-1' })).ok, true);
});


test('configured containers refuse status while task closes and kind changes retain workflow status', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["feature"]\n');
  await startDaemon(t, root);
  const ui = await connectUi(t, await readDiscovery(root));
  const read = async (file: string) => parseItem(await readFile(join(root, '.cland/tasks', file), 'utf8'), file, ['feature']).fm;
  assert.equal((await ui.request({ type: 'task.create', title: 'Container', kind: 'feature' })).ok, true);
  const refused = await ui.request({ type: 'task.edit', item: 'T-1', status: 'planned' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /status belongs only to a task/);
  const containerFile = 'T-1-container.md';
  const text = await readFile(join(root, '.cland/tasks', containerFile), 'utf8');
  assert.throws(() => parseItem(text.replace('state: open', 'state: open\nstatus: planned'), containerFile, ['feature']), /status belongs only to a task/);
  assert.equal((await ui.request({ type: 'task.create', title: 'Child', parent: 'T-1' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-1' })).ok, false);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-2' })).ok, true);
  assert.deepEqual([(await read('T-2-child.md')).state, (await read('T-2-child.md')).status], ['closed', 'done']);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-1' })).ok, true);
  assert.equal((await read(containerFile)).status, undefined);
  assert.equal((await ui.request({ type: 'task.create', title: 'Convertible' })).ok, true);
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-3', status: 'review' })).ok, true);
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-3', kind: 'feature' })).ok, true);
  assert.equal((await read('T-3-convertible.md')).status, undefined);
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-3', kind: 'task', state: 'closed' })).ok, true);
  assert.deepEqual([(await read('T-3-convertible.md')).kind, (await read('T-3-convertible.md')).status], ['task', 'done']);
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-3', state: 'open' })).ok, true);
  assert.equal((await read('T-3-convertible.md')).status, 'backlog');
});
