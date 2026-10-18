import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FOUND_BY, parseItem, serializeItem } from '../src/tracker/item.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { cland, connectUi, flushProjectLogs, nativeProjectHub as projectHub, spawnSpoke, tempProject } from './harness.ts';

test('found_by round-trips the discovery vocabulary and refuses orphan attribution', () => {
  const legacy = '---\nid: T-1\nkind: task\ntitle: Rework\nstate: open\nregression_of: T-2\n---\n';
  assert.equal(parseItem(legacy).fm.found_by, undefined);
  for (const value of FOUND_BY) {
    const item = parseItem(legacy.replace('state: open', `state: open\nfound_by: ${value}`));
    assert.equal(item.fm.found_by, value);
    assert.deepEqual(parseItem(serializeItem(item)), item);
  }
  for (const value of ['tests', 'none', 'null', '42']) assert.throws(() => parseItem(legacy.replace('state: open', `state: open\nfound_by: ${value}`)), /found_by must be one of/);
  assert.throws(() => parseItem(legacy.replace('regression_of: T-2', 'found_by: cover')), /found_by requires/);
});

test('CLI and tools persist, index, edit and journal regression discovery', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'T-321-landed.md'), '---\nid: T-321\nkind: task\ntitle: Landed\nstate: closed\nstatus: done\n---\n');
  const index = new TrackerIndex(join(root, '.cland/hub.db'));
  index.recordMerge('T-321', { branch: 't/landed', tip: 'a'.repeat(40), commit: 'b'.repeat(40), base: 'dev' });
  index.close();
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const created = await cland(root, 'task', 'create', 'Rework', '--size', 'S', '--regression-of', 'T-321', '--found-by', 'cover', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item: ItemView = JSON.parse(created.stdout).item;
  assert.equal(item.found_by, 'cover');
  assert.match((await cland(root, 'task', 'view', item.id)).stdout, /found_by +cover/);
  assert.equal(parseItem(await readFile(join(root, item.path), 'utf8')).fm.found_by, 'cover');
  const listed = await coord.call<{ items: ItemView[] }>('task.list');
  assert.equal(listed.items.find(i => i.id === item.id)!.found_by, 'cover');
  const edited = await cland(root, 'task', 'edit', item.id, '--found-by', 'qa', '--json');
  assert.equal(edited.code, 0, edited.stderr);
  assert.equal(JSON.parse(edited.stdout).item.found_by, 'qa');
  const toolCreated = await coord.call<{ item: ItemView }>('task.create', { title: 'Caught on droplet', size: 'XS', regression_of: '321', found_by: 'droplet' });
  assert.equal(toolCreated.item.found_by, 'droplet');
  const toolEdit = await coord.call<{ item: ItemView }>('task.edit', { id: item.id, found_by: 'review' });
  assert.equal(toolEdit.item.found_by, 'review');
  for (const tool of ['task.create', 'task.edit']) {
    const args = tool === 'task.create' ? { title: 'Bad attribution', size: 'S', regression_of: '321' } : { id: item.id };
    for (const found_by of ['tests', 42, null]) {
      if (tool === 'task.edit' && found_by === null) continue;
      const bad = await coord.call<{ ok: boolean; error: string }>(tool, { ...args, found_by });
      assert.equal(bad.ok, false);
      assert.match(bad.error, /found_by must be one of/);
    }
  }
  const invalid = await cland(root, 'task', 'create', 'Invalid', '--size', 'S', '--regression-of', '321', '--found-by', 'tests');
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /found_by must be one of/);
  const orphan = await ui.request({ type: 'task.create', title: 'Orphan', size: 'S', found_by: 'human' });
  assert.equal(orphan.ok, false);
  assert.match(orphan.error!, /found_by requires/);
  await flushProjectLogs(t, root);
  const logs = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(logs.some(e => e.event === 'task-written' && e.id === item.id && e.op === 'create' && e.regression_of === 'T-321' && e.found_by === 'cover'));
  assert.ok(logs.some(e => e.event === 'task-written' && e.id === item.id && e.op === 'edit' && e.found_by === 'qa'));
  const cleared = await cland(root, 'task', 'edit', item.id, '--found-by', 'none', '--json');
  assert.equal(cleared.code, 0, cleared.stderr);
  assert.equal(JSON.parse(cleared.stdout).item.found_by, undefined);
  await coord.call('task.edit', { id: item.id, found_by: 'human' });
  const unlinked = await coord.call<{ item: ItemView }>('task.link', { id: item.id, regression_of: null });
  assert.equal(unlinked.item.found_by, undefined);
  const converted = await coord.call<{ item: ItemView }>('task.edit', { id: toolCreated.item.id, kind: 'question' });
  assert.equal(converted.item.found_by, undefined);
  assert.equal((await coord.call<{ items: ItemView[] }>('task.list')).items.find(i => i.id === converted.item.id)!.found_by, undefined);
});
