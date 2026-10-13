import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { cland, connectUi, spawnSpoke, startDaemon, tempProject } from './harness.ts';

test('CLI tasks require a size while other kinds refuse it', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  for (const args of [[], ['--kind', 'task']]) {
    const result = await cland(root, 'task', 'create', 'Missing size', ...args);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /a task needs a size: XS, S, M, L or XL/);
  }
  const nonTask = await cland(root, 'task', 'create', 'Container', '--kind', 'epic', '--size', 'S');
  assert.equal(nonTask.code, 1);
  assert.match(nonTask.stderr, /size.*epic/);
  const created = await cland(root, 'task', 'create', 'Sized task', '--size', 'S', '--json');
  assert.equal(created.code, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).item.size, 'S');
});

test('item size and regression fields round-trip and legacy files stay readable', () => {
  const legacy = '---\nid: T-1\nkind: task\ntitle: Legacy\nstate: open\n---\n\n## Summary\n\nKeep me.\n';
  const old = parseItem(legacy);
  assert.equal(old.fm.size, undefined);
  assert.equal(old.fm.regression_of, undefined);
  for (const size of ['XS', 'S', 'M', 'L', 'XL']) {
    const item = parseItem(legacy.replace('state: open', `state: open\nstatus: backlog\nsize: ${size}\nregression_of: E-321`));
    assert.equal(item.fm.size, size);
    assert.equal(item.fm.regression_of, 'E-321');
    const text = serializeItem(item);
    assert.match(text, /status: backlog\nsize:/);
    assert.match(text, /blocked_by: \[\]\nregression_of: E-321/);
    assert.deepEqual(parseItem(text), item);
  }
  for (const size of ['XXL', 'none', 'null', '5']) assert.throws(() => parseItem(legacy.replace('state: open', `state: open\nsize: ${size}`)), /size must/);
  for (const field of ['size: S', 'regression_of: T-321']) assert.throws(() => parseItem(legacy.replace('kind: task', 'kind: epic').replace('state: open', `state: open\n${field}`)), /belongs only to a task.*epic/);
  assert.throws(() => parseItem(legacy.replace('state: open', 'state: open\nregression_of: nope')), /item reference/);
  assert.deepEqual(parseItem(legacy), old);
});

test('real spoke and CLI validate regression targets and publish indexed task fields', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  // Legacy fixture with durable landing evidence, available before the real hub starts.
  await writeFile(join(dir, 'T-321-landed.md'), '---\nid: T-321\nkind: task\ntitle: Landed\nstate: closed\nstatus: done\n---\n');
  const index = new TrackerIndex(join(root, '.cland/hub.db'));
  index.recordMerge('T-321', { branch: 't/landed', tip: 'a'.repeat(40), commit: 'b'.repeat(40), base: 'dev' });
  index.close();
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['coord']);
  const tools = await spoke.client.listTools();
  for (const name of ['task.create', 'task.edit']) assert.deepEqual(tools.tools.find(tool => tool.name === name)!.inputSchema.properties!.size, { type: 'string', enum: ['XS', 'S', 'M', 'L', 'XL'], description: 'Ex-ante task size; tasks only' });
  const refused = await spoke.call<{ ok: boolean; error: string }>('task.create', { title: 'Needs size' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /a task needs a size: XS, S, M, L or XL/);
  const created = await cland(root, 'task', 'create', 'Rework', '--size', 'S', '--regression-of', 'E-321', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item = JSON.parse(created.stdout).item;
  assert.equal(item.regression_of, 'T-321');
  const from = ui.frames.length;
  const edited = await spoke.call<{ item: ItemView }>('task.edit', { id: item.id, size: 'XL' });
  assert.equal(edited.item.size, 'XL');
  const event = await ui.waitFor(f => ui.frames.indexOf(f) >= from && f.type === 'task' && (f.item as ItemView)?.id === item.id && (f.item as ItemView).size === 'XL');
  assert.equal((event.item as ItemView).regression_of, 'T-321');
  const listed = await spoke.call<{ items: ItemView[] }>('task.list');
  assert.deepEqual(listed.items.filter(i => i.id === item.id).map(i => [i.size, i.regression_of]), [['XL', 'T-321']]);
  for (const id of ['321', 'E-321', 't-321']) {
    const linked = await spoke.call<{ item: ItemView }>('task.link', { id: item.id, regression_of: id });
    assert.equal(linked.item.regression_of, 'T-321');
  }
  for (const clear of [null, 'none']) {
    const cleared = await spoke.call<{ item: ItemView }>('task.link', { id: item.id, regression_of: clear });
    assert.equal(cleared.item.regression_of, undefined);
    assert.equal((await spoke.call<{ items: ItemView[] }>('task.list')).items.find(i => i.id === item.id)!.regression_of, undefined);
    await spoke.call('task.link', { id: item.id, regression_of: '321' });
  }
  const human = await cland(root, 'task', 'view', item.id);
  assert.match(human.stdout, /size +XL/);
  assert.match(human.stdout, /regression_of +T-321/);
  const open = await spoke.call<{ item: ItemView }>('task.create', { title: 'Open', size: 'M' });
  const container = await spoke.call<{ item: ItemView }>('task.create', { title: 'Epic', kind: 'epic' });
  const unlanded = await spoke.call<{ item: ItemView }>('task.create', { title: 'Closed without receipt', size: 'M' });
  await spoke.call('task.close', { id: unlanded.item.id });
  for (const [target, reason] of [[item.id, /item itself/], [open.item.id, /must be closed/], [container.item.id, /must be a task/], [unlanded.item.id, /landing receipt on dev/], ['999', /no item/]] as const) {
    const bad = await spoke.call<{ ok: boolean; error: string }>('task.link', { id: item.id, regression_of: target });
    assert.equal(bad.ok, false);
    assert.match(bad.error, reason);
  }
  for (const size of [null, 'none', 'XXL']) {
    const bad = await ui.request({ type: 'task.edit', item: item.id, size });
    assert.equal(bad.ok, false);
    assert.match(bad.error!, /size must/);
  }
  const noTask = await spoke.call<{ ok: boolean; error: string }>('task.link', { id: container.item.id, regression_of: '321' });
  assert.equal(noTask.ok, false);
  assert.match(noTask.error, /regression_of.*epic/);
  const sizeEdit = await cland(root, 'task', 'edit', item.id, '--size', 'L', '--json');
  assert.equal(sizeEdit.code, 0, sizeEdit.stderr);
  assert.equal(JSON.parse(sizeEdit.stdout).item.size, 'L');
  assert.equal((await cland(root, 'task', 'link', item.id, '--regression-of', 'none')).code, 0);
  await spoke.call('task.link', { id: item.id, regression_of: '321' });
  const converted = await spoke.call<{ item: ItemView }>('task.edit', { id: item.id, kind: 'question' });
  assert.equal(converted.item.kind, 'question');
  assert.equal(converted.item.size, undefined);
  assert.equal(converted.item.regression_of, undefined);
  const afterConversion = (await spoke.call<{ items: ItemView[] }>('task.list')).items.find(i => i.id === converted.item.id)!;
  assert.equal(afterConversion.size, undefined);
  assert.equal(afterConversion.regression_of, undefined);
});
