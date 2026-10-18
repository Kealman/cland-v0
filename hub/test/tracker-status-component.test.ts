// T2 component: tracker rules at public APIs, sockets, CLI and in-process MCP.
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, connectWsUi, inProcessSpoke, projectHub, startHub, tempProject } from './harness.ts';

// Persistence proofs close and reopen the hub/store in this process.
const hubs = new Map<string, Awaited<ReturnType<typeof projectHub>>>();
const openHub: typeof projectHub = async (...args) => {
  const hub = await projectHub(...args);
  hubs.set(args[1], hub);
  args[0].after(() => { if (hubs.get(args[1]) === hub) hubs.delete(args[1]); });
  return hub;
};
const stopHub = async (root: string) => { await hubs.get(root)!.stop(); };
import { Tracker } from '../src/tracker/tracker.ts';
import { fixedRoles } from '../src/roles/config.ts';

type Item = { id: string; kind: string; state: string; status?: string; path: string };

test('new tasks persist backlog across writes and restart; other kinds have no status', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await cland(root, 'task', 'create', '--size', 'M', 'Parser', '--json');
  assert.equal(made.code, 0, made.stderr);
  const item = (JSON.parse(made.stdout) as { item: Item }).item;
  assert.equal(item.status, 'backlog');
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === item.id);
  assert.equal((event.item as Item).status, 'backlog');
  assert.match(await readFile(join(root, item.path), 'utf8'), /status: backlog\n/);
  assert.equal((await cland(root, 'task', 'comment', item.id, 'Keep status.')).code, 0);
  await stopHub(root);
  await openHub(t, root);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  assert.equal((await coord.call<{ item: Item }>('task.view', { id: item.id })).item.status, 'backlog');
  for (const kind of ['release', 'epic', 'question', 'spec', 'map']) {
    const result = await coord.call<{ ok: boolean; item: Item }>('task.create', { ...(['task'].includes(kind) ? { size: 'M' } : {}), title: kind, kind });
    assert.equal(result.ok, true);
    assert.equal(result.item.status, undefined, kind);
  }
});

test('only human, Coordinator and the claiming Implementer can set status; done and reopen keep state consistent', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer' });
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-1', role: 'qa' });
  for (const session of [coord, impl, rev, qa]) onCleanup(t, () => session.close());
  await coord.waitForPresence(['coord', 'impl', 'rev', 'qa-1']);
  const { item } = await coord.call<{ item: Item }>('task.create', { size: 'M', title: 'Parser', assignee: 'impl' });
  const read = async () => (await coord.call<{ item: Item }>('task.view', { id: item.id })).item;
  let eventAt = ui.frames.length;
  const pair = async (status: string, state = 'open', changed = true) => {
    const view = await read();
    assert.deepEqual([view.status, view.state], [status, state]);
    if (changed) {
      const event = await ui.waitFor(f => ui.frames.indexOf(f) >= eventAt && f.type === 'task' && (f.item as Item | undefined)?.id === item.id && (f.item as Item).status === status);
      assert.equal((event.item as Item).state, state);
      eventAt = ui.frames.indexOf(event) + 1;
    }
  };
  const assigned = await impl.call<{ ok: boolean; code: string }>('task.edit', { id: item.id, status: 'review' });
  assert.deepEqual([assigned.ok, assigned.code], [false, 'forbidden'], 'assignment alone is insufficient');
  const planned = await cland(root, 'task', 'edit', item.id, '--status', 'planned', '--json');
  assert.equal(planned.code, 0, planned.stderr);
  await pair('planned');
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  await pair('in progress');
  const handed = await impl.call<{ ok: boolean }>('task.edit', { id: item.id, status: 'review' });
  assert.equal(handed.ok, true);
  await pair('review');
  for (const [session, args] of [
    [impl, { status: 'planned' }], [impl, { status: 'review', title: 'Smuggled' }],
    [rev, { status: 'review' }], [qa, { status: 'qa' }],
  ] as const) {
    const result = await session.call<{ ok: boolean; code: string }>('task.edit', { id: item.id, ...args });
    assert.deepEqual([result.ok, result.code], [false, 'forbidden']);
    await pair('review', 'open', false);
  }
  for (const status of ['backlog', 'planned', 'in progress', 'review', 'qa', 'ready', 'done']) {
    assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, status })).ok, true, status);
    await pair(status, status === 'done' ? 'closed' : 'open');
  }
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, status: 'qa' })).ok, true);
  await pair('qa');
  assert.equal((await coord.call<{ ok: boolean }>('task.close', { id: item.id })).ok, true);
  await pair('done', 'closed');
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, state: 'open' })).ok, true);
  await pair('backlog');
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'invalid' })).ok, false);
  const other = await coord.call<{ item: Item }>('task.create', { size: 'M', title: 'Other' });
  assert.equal((await impl.call<{ ok: boolean }>('task.edit', { id: other.item.id, status: 'review' })).ok, false);
});


test('legacy tasks gain status on index, preserve claims through restart, and re-index hand-edited status and state', async t => {
  const root = await tempProject(t);
  await openHub(t, root);
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  const items: Item[] = [];
  for (const title of ['Unclaimed', 'Claimed', 'Closed']) {
    const made = await cland(root, 'task', 'create', '--size', 'M', title, '--assignee', 'impl', '--json');
    assert.equal(made.code, 0, made.stderr);
    items.push((JSON.parse(made.stdout) as { item: Item }).item);
  }
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: items[1]!.id })).ok, true);
  assert.equal((await cland(root, 'task', 'close', items[2]!.id)).code, 0);
  await impl.close();
  await stopHub(root);
  // An older hub indexed the same legacy text, before the additive status column existed.
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  try {
    for (const item of items) {
      const path = join(root, item.path);
      const text = (await readFile(path, 'utf8')).replace(/^status: .*\n/m, '');
      await writeFile(path, text);
      db.prepare('update tracker_items set status = null, hash = ? where id = ?').run(createHash('sha256').update(text).digest('hex'), item.id);
    }
  } finally { db.close(); }
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const viewed = await ui.request({ type: 'task.list' });
  assert.deepEqual((viewed.value as { items: Item[] }).items.map(i => [i.status, i.state]), [
    ['backlog', 'open'], ['in progress', 'open'], ['done', 'closed'],
  ]);
  for (const [index, status] of ['backlog', 'in progress', 'done'].entries()) {
    assert.match(await readFile(join(root, items[index]!.path), 'utf8'), new RegExp(`status: ${status}\\n`));
  }
  const file = join(root, items[0]!.path);
  await writeFile(file, (await readFile(file, 'utf8')).replace('status: backlog', 'status: planned'));
  const planned = await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.status === 'planned');
  assert.deepEqual([(planned.item as Item).status, (planned.item as Item).state], ['planned', 'open']);
  await writeFile(file, (await readFile(file, 'utf8')).replace('state: open', 'state: closed'));
  const closed = await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === items[0]!.id && (f.item as Item).state === 'closed');
  assert.deepEqual([(closed.item as Item).status, (closed.item as Item).state], ['done', 'closed']);
  await writeFile(file, (await readFile(file, 'utf8')).replace('state: closed', 'state: open'));
  await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === items[0]!.id && (f.item as Item).status === 'backlog');
  const fresh = await ui.request({ type: 'task.view', item: items[0]!.id });
  assert.deepEqual([(fresh.value as { item: Item }).item.status, (fresh.value as { item: Item }).item.state], ['backlog', 'open']);
});

test('a not-clear review or QA verdict returns a handed-over task to in progress in view and task events', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Fix findings' });
  const item = (made.value as { item: Item }).item;
  for (const [name, role] of [['rev', 'reviewer'], ['qa-1', 'qa']] as const) {
    const verifier = await inProcessSpoke(t, { discover: true, cwd: root, name, role });
    onCleanup(t, () => verifier.close());
    assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'review' })).ok, true);
    const verdict = role === 'reviewer' ? 'review' : 'qa';
    const run = `finding-${verdict}`;
    assert.equal((await verifier.call<{ ok: boolean }>('task.comment', { id: item.id, verdict, ...(verdict === 'review' ? { scope: 'full' } : {}), result: 'not clear', run })).ok, true);
    const view = await ui.request({ type: 'task.view', item: item.id });
    assert.deepEqual([(view.value as { item: Item }).item.status, (view.value as { item: Item }).item.state], ['in progress', 'open']);
    const event = await ui.waitFor(f => f.type === 'task' && (f.item as { verdicts?: Array<{ run: string }> } | undefined)?.verdicts?.some(v => v.run === run) === true);
    assert.equal((event.item as Item).status, 'in progress');
    assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'review' })).ok, true);
    assert.equal((await verifier.call<{ ok: boolean }>('task.comment', { id: item.id, verdict, ...(verdict === 'review' ? { scope: 'full' } : {}), result: 'clear', run: `clear-${verdict}` })).ok, true);
    const clear = await ui.request({ type: 'task.view', item: item.id });
    assert.equal((clear.value as { item: Item }).item.status, 'review', 'clear verdicts do not set ready in this slice');
  }
});

test('a broad task.edit grant does not let another role set status', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db') });
  onCleanup(t, () => tracker.stop());
  const definitions = new Map(fixedRoles().get());
  const reviewer = definitions.get('reviewer')!;
  definitions.set('reviewer', { ...reviewer, permissions: { tools: [...reviewer.permissions.tools, 'task.edit'] } });
  const hub = await startHub({ tracker, roles: fixedRoles(definitions) });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'No status override' });
  const item = (made.value as { item: Item }).item;
  const denied = await ui.request({ type: 'task.edit', item: item.id, status: 'review', as: { name: 'rev' } });
  assert.deepEqual([denied.ok, (denied as { code?: string }).code], [false, 'forbidden']);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, title: 'Ordinary edit', as: { name: 'rev' } })).ok, true);
});

test('startup preserves offline state edits, and migration removes an old hand-edited ID', async t => {
  const root = await tempProject(t);
  await openHub(t, root);
  const items: Item[] = [];
  for (const title of ['Close offline', 'Reopen offline']) {
    const made = await cland(root, 'task', 'create', '--size', 'M', title, '--json');
    assert.equal(made.code, 0, made.stderr);
    items.push((JSON.parse(made.stdout) as { item: Item }).item);
  }
  assert.equal((await cland(root, 'task', 'close', items[1]!.id)).code, 0);
  await stopHub(root);
  for (const [index, from, to] of [[0, 'open', 'closed'], [1, 'closed', 'open']] as const) {
    const path = join(root, items[index]!.path);
    await writeFile(path, (await readFile(path, 'utf8')).replace(`state: ${from}`, `state: ${to}`));
  }
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const list = await ui.request({ type: 'task.list' });
  assert.deepEqual((list.value as { items: Item[] }).items.map(i => [i.id, i.status, i.state]), [
    ['T-1', 'done', 'closed'], ['T-2', 'backlog', 'open'],
  ]);
  const path = join(root, items[1]!.path);
  await writeFile(path, (await readFile(path, 'utf8')).replace('id: T-2', 'id: T-99').replace(/^status: .*\n/m, ''));
  await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === 'T-99');
  const moved = await ui.request({ type: 'task.list' });
  assert.deepEqual((moved.value as { items: Item[] }).items.map(i => [i.id, i.status, i.state]), [
    ['T-1', 'done', 'closed'], ['T-99', 'backlog', 'open'],
  ]);
  assert.equal((await ui.request({ type: 'task.view', item: 'T-2' })).ok, false);
});
