// Sibling rank through the agreed hub frame, CLI and MCP seams (T-122).
import { onCleanup } from './process-cleanup.ts';
import test, { type TestContext } from 'node:test';
import { performance } from 'node:perf_hooks';
import { compareRank, rankChanges } from '../src/tracker/rank.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import files, { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Tracker } from '../src/tracker/tracker.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { join } from 'node:path';
import { cland, connectUi, connectWsUi, spawnSpoke, startDaemon, startHub, tempProject, TEST_SECRET } from './harness.ts';

type Item = { id: string; rank?: number; path: string; file: string; parent: string | null };

test('sparse rank moves persist, are idempotent, and CLI and MCP share rank then id order', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  const items: Item[] = [];
  for (const title of ['A', 'B', 'C', 'D']) {
    const made = await coord.call<{ item: Item }>('task.create', { title });
    items.push(made.item);
  }
  assert.deepEqual(items.map(i => i.rank), [10, 20, 30, 40]);
  for (const item of items) assert.doesNotMatch(await readFile(join(root, item.path ?? join('.cland', 'tasks', item.file)), 'utf8'), /^rank:/m);
  const original = await readFile(join(root, items[0]!.path), 'utf8');
  const top = await cland(root, 'task', 'rank', 'T-3', '--top', '--json');
  assert.equal(top.code, 0, top.stderr);
  const once = await readFile(join(root, items[2]!.path), 'utf8');
  assert.equal((await cland(root, 'task', 'rank', 'T-3', '--top')).code, 0);
  assert.equal(await readFile(join(root, items[2]!.path), 'utf8'), once);
  assert.equal(await readFile(join(root, items[0]!.path), 'utf8'), original);
  assert.equal((await coord.call<{ ok: boolean }>('task.rank', { id: 'T-4', before: 'T-2' })).ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('task.rank', { id: 'T-1', after: 'T-2' })).ok, true);
  const listed = await cland(root, 'task', 'list', '--json');
  assert.equal(listed.code, 0, listed.stderr);
  assert.deepEqual((JSON.parse(listed.stdout) as { items: Item[] }).items.map(i => i.id), ['T-3', 'T-4', 'T-2', 'T-1']);
  const mcp = await coord.call<{ items: Item[] }>('task.list', {});
  assert.deepEqual(mcp.items.map(i => i.id), ['T-3', 'T-4', 'T-2', 'T-1']);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === 'T-1' && (f.item as Item).rank! > 20);
  assert.equal((event.item as Item).rank, mcp.items[3]!.rank);
  const ordered = await ui.waitFor(f => f.type === 'task' && Array.isArray(f.siblings) && (f.siblings as string[]).at(-1) === 'T-1');
  assert.deepEqual(ordered.siblings, ['T-3', 'T-4', 'T-2', 'T-1']);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  const restart = await cland(root, 'task', 'list', '--json');
  assert.deepEqual((JSON.parse(restart.stdout) as { items: Item[] }).items.map(i => i.id), ['T-3', 'T-4', 'T-2', 'T-1']);
});


async function fixture(root: string, rows: Array<{ id: string; rank?: number; kind?: string; parent?: string | null; status?: string }>): Promise<void> {
  await mkdir(join(root, '.cland', 'tasks'), { recursive: true });
  for (const row of rows) await writeFile(join(root, '.cland', 'tasks', `${row.id}-fixture.md`), [
    '---', `id: ${row.id}`, `kind: ${row.kind ?? 'task'}`, `title: ${row.id}`,
    `parent: ${row.parent ?? 'null'}`, ...(row.status === undefined ? [] : [`status: ${row.status}`]), ...(row.rank === undefined ? [] : [`rank: ${row.rank}`]), '---', '',
  ].join('\n'));
}

for (const stage of ['planning', 'next write'] as const) {
  test(`rank measures the continuous ${stage} stretch across adjacent 150 ms operations`, async t => {
    const root = await tempProject(t);
    await fixture(root, [{ id: 'T-1', rank: 11, status: 'planned' }, { id: 'T-2', rank: 60, status: 'planned' }, { id: 'T-3', rank: 10, status: 'planned' }, { id: 'T-4', rank: 12, status: 'planned' }]);
    let clock = 0;
    let slowArithmetic = stage === 'planning';
    let slowSerialization = false;
    let slowOpen = false;
    let armClose = stage === 'next write';
    const records: Array<Record<string, unknown>> = [];
    const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      open: async (...args) => {
        if (slowOpen) { slowOpen = false; clock += 150; }
        const fd = await files.open(...args);
        if (armClose) {
          armClose = false;
          const close = fd.close.bind(fd);
          t.mock.method(fd, 'close', async () => { await close(); slowSerialization = true; });
        }
        return fd;
      },
    } });
    tracker.start();
    const hub = await startHub({ tracker, roles: fixedRoles(), requestGuard: guard });
    onCleanup(t, () => hub.close());
  onCleanup(t, () => tracker.stop());
    const ui = await connectWsUi(t, hub);
    // Intrinsic arithmetic/serialization and the native open prefix provide CPU time;
    // file waits are excluded. No tracker collaborators or diagnostic logs are replaced.
    const integer = BigInt;
    t.mock.method(globalThis, 'BigInt', (...args: Parameters<typeof BigInt>) => {
      if (slowArithmetic) { slowArithmetic = false; slowOpen = true; clock += 150; }
      return integer(...args);
    });
    const stringify = JSON.stringify;
    t.mock.method(JSON, 'stringify', (...args: Parameters<typeof stringify>) => {
      if (slowSerialization) { slowSerialization = false; slowOpen = true; clock += 150; }
      return stringify(...args);
    });
    const result = await ui.request({ type: 'task.rank', item: 'T-2', before: 'T-1' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual((result.value as { changed: string[] }).changed, ['T-1', 'T-2']);
    assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['task.rank', 'resumed', 300]]);
  });
}

test('a dense interval changes only the moved item and one neighbor, preserving every outer sibling', async t => {
  const root = await tempProject(t);
  await fixture(root, [
    { id: 'T-1', rank: 11 }, { id: 'T-2', rank: 50 }, { id: 'T-3', rank: 60 },
    { id: 'T-4', rank: 10 }, { id: 'T-5', rank: 12 }, { id: 'T-6', rank: -20 },
  ]);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const before = await ui.request({ type: 'task.list' });
  const original = new Map<string, string>();
  for (const item of (before.value as { items: Item[] }).items) original.set(item.id, await readFile(join(root, item.path ?? join('.cland', 'tasks', item.file)), 'utf8'));
  const moved = await cland(root, 'task', 'rank', 'T-3', '--before', 'T-1', '--json');
  assert.equal(moved.code, 0, moved.stderr);
  const result = JSON.parse(moved.stdout) as { changed: string[]; siblings: string[] };
  assert.deepEqual(result.changed, ['T-1', 'T-3']);
  assert.deepEqual(result.siblings, ['T-6', 'T-4', 'T-3', 'T-1', 'T-5', 'T-2']);
  const after = await ui.request({ type: 'task.list' });
  assert.deepEqual((after.value as { items: Item[] }).items.map(i => [i.id, i.rank]), [
    ['T-6', -20], ['T-4', 10], ['T-3', 11], ['T-1', 12], ['T-5', 12], ['T-2', 50],
  ]);
  for (const item of (after.value as { items: Item[] }).items) {
    if (!result.changed.includes(item.id)) assert.equal(await readFile(join(root, item.path ?? join('.cland', 'tasks', item.file)), 'utf8'), original.get(item.id), item.id);
  }
  const event = await ui.waitFor(f => f.type === 'task' && Array.isArray(f.siblings));
  assert.deepEqual(event.siblings, result.siblings);
});

test('ranking refuses different parents, self references, wrong kinds and ambiguous placement', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[tracker]\nlevels = ["cycle", "area", "group"]\n');
  await fixture(root, [
    { id: 'T-1', kind: 'cycle' }, { id: 'T-2', kind: 'area', parent: 'T-1' },
    { id: 'T-3', kind: 'area', parent: 'T-1' }, { id: 'T-4', parent: 'T-2' }, { id: 'T-5', parent: 'T-3' },
    { id: 'T-6', kind: 'group', parent: 'T-2' },
  ]);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const before = await readFile(join(root, '.cland', 'tasks', 'T-4-fixture.md'), 'utf8');
  for (const frame of [
    { item: 'T-4', before: 'T-5' }, { item: 'T-4', after: 'T-4' }, { item: 'T-1', top: true },
    { item: 'T-4' }, { item: 'T-4', top: true, after: 'T-5' }, { item: 'T-4', top: 'yes' },
    { item: 'T-4', before: 2 },
  ]) assert.equal((await ui.request({ type: 'task.rank', ...frame })).ok, false, JSON.stringify(frame));
  assert.equal(await readFile(join(root, '.cland', 'tasks', 'T-4-fixture.md'), 'utf8'), before);
  assert.equal((await ui.request({ type: 'task.rank', item: 'T-3', top: true })).ok, true);
  assert.equal((await ui.request({ type: 'task.rank', item: 'T-6', top: true })).ok, true);
});


async function pausedWriteHub(t: TestContext) {
  const root = await tempProject(t);
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(done => { enter = done; });
  const released = new Promise<void>(done => { release = done; });
  let hold = false;
  onCleanup(t, () => release());
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    writeFile: async (...args) => {
    await files.writeFile(...args);
    if (hold) { hold = false; enter(); await released; }
    },
  } });
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  return { root, ui, release, pause: () => { hold = true; return entered; } };
}

for (const change of ['rank', 'parent', 'grant'] as const) {
  test(`rank refuses a sibling ${change} change after its temporary write await`, async t => {
    const { root, ui, release, pause } = await pausedWriteHub(t);
    assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
    const a = (await ui.request({ type: 'task.create', title: 'A' })).value as { item: Item };
    const b = (await ui.request({ type: 'task.create', title: 'B' })).value as { item: Item };
    const original = await readFile(join(root, b.item.path), 'utf8');
    const paused = pause();
    const writing = ui.request({ type: 'task.rank', item: b.item.id, top: true, as: { name: 'coord' } });
    await Promise.race([paused, writing.then(value => { throw new Error(`rank answered before write pause: ${JSON.stringify(value)}`); })]);
    if (change === 'grant') assert.equal((await ui.request({ type: 'role.clear', session: 'coord' })).ok, true);
    else {
      const path = join(root, a.item.path);
      const text = await readFile(path, 'utf8');
      await writeFile(path, change === 'rank' ? text.replace('kind: task', 'kind: task\nrank: -100') : text.replace('parent: null', 'parent: T-99'));
    }
    release();
    const refused = await writing;
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(await readFile(join(root, b.item.path), 'utf8'), original);
  });
}

test('rank operations wait behind earlier writes and see each preceding rank without losing comments', async t => {
  const { ui, release, pause } = await pausedWriteHub(t);
  for (const title of ['A', 'B']) assert.equal((await ui.request({ type: 'task.create', title })).ok, true);
  const paused = pause();
  const comment = ui.request({ type: 'task.comment', item: 'T-1', text: 'Earlier comment stays.' });
  await paused;
  const first = ui.request({ type: 'task.rank', item: 'T-2', top: true });
  const second = ui.request({ type: 'task.rank', item: 'T-1', top: true });
  release();
  assert.equal((await comment).ok, true);
  assert.deepEqual(((await first).value as { siblings: string[] }).siblings, ['T-2', 'T-1']);
  assert.deepEqual(((await second).value as { siblings: string[] }).siblings, ['T-1', 'T-2']);
  const view = await ui.request({ type: 'task.view', item: 'T-1' });
  assert.equal((view.value as { item: { comments: Array<{ text: string }> } }).item.comments[0]!.text, 'Earlier comment stays.');
});


test('the shared client ordering fixture matches hub lists and resolved event ranks', async t => {
  const root = await tempProject(t);
  const example = JSON.parse(await readFile(new URL('./fixtures/rank-order.json', import.meta.url), 'utf8')) as { items: Array<{ id: string; rank?: number }>; order: string[] };
  await fixture(root, example.items);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const list = await ui.request({ type: 'task.list' });
  assert.deepEqual((list.value as { items: Item[] }).items.map(i => i.id), example.order);
  assert.equal((await ui.request({ type: 'task.comment', item: 'T-1', text: 'Implicit rank is resolved.' })).ok, true);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === 'T-1');
  assert.equal((event.item as Item).rank, 10);
});

async function migration(root: string): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../bin/migrate-high-rank.ts', import.meta.url))], {
      cwd: root, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_'))), timeout: 30_000,
    });
    return { code: 0, ...result };
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string };
    return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr };
  }
}

test('the high migration ranks singleton groups, including closed items, and a rerun writes nothing', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  for (const title of ['One', 'Two']) assert.equal((await cland(root, 'task', 'create', title, '--kind', 'epic')).code, 0);
  for (const parent of ['T-1', 'T-2']) {
    assert.equal((await cland(root, 'task', 'create', 'Ordinary', '--parent', parent)).code, 0);
    assert.equal((await cland(root, 'task', 'create', 'High', '--label', 'high', '--parent', parent)).code, 0);
  }
  assert.equal((await cland(root, 'task', 'close', 'T-6')).code, 0);
  const first = await migration(root);
  assert.equal(first.code, 0, first.stderr);
  const migrated = JSON.parse(first.stdout) as { moved: Array<{ id: string }>; retired: string[] };
  assert.deepEqual(migrated.moved.map(item => item.id), ['T-4', 'T-6']);
  assert.deepEqual(migrated.retired, ['T-4', 'T-6']);
  const listed = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout) as { items: Array<Item & { labels: string[] }> };
  assert.deepEqual(listed.items.filter(item => item.parent === 'T-1').map(item => item.id), ['T-4', 'T-3']);
  assert.deepEqual(listed.items.filter(item => item.parent === 'T-2').map(item => item.id), ['T-6', 'T-5']);
  assert.equal(listed.items.some(item => item.labels.includes('high')), false);
  const before = await Promise.all(listed.items.map(item => readFile(join(root, '.cland', 'tasks', item.file), 'utf8')));
  const again = await migration(root);
  assert.equal(again.code, 0, again.stderr);
  assert.deepEqual(JSON.parse(again.stdout), { moved: [], retired: [] });
  assert.deepEqual(await Promise.all(listed.items.map(item => readFile(join(root, '.cland', 'tasks', item.file), 'utf8'))), before);
});

test('the high migration refuses multiple labelled siblings before any writes, counting closed items', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  for (const title of ['One', 'Two']) assert.equal((await cland(root, 'task', 'create', title, '--label', 'high')).code, 0);
  assert.equal((await cland(root, 'task', 'close', 'T-2')).code, 0);
  const listed = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout) as { items: Item[] };
  const before = await Promise.all(listed.items.map(item => readFile(join(root, '.cland', 'tasks', item.file), 'utf8')));
  const refused = await migration(root);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /multiple high items.*no parent: T-1, T-2.*nothing was changed/);
  assert.deepEqual(await Promise.all(listed.items.map(item => readFile(join(root, '.cland', 'tasks', item.file), 'utf8'))), before);
});

test('a failed high label removal retries without another rank write or a migration journal', async t => {
  const root = await tempProject(t);
  let fail = false;
  let target = '';
  let targetRenames = 0;
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files, rename: async (from, to) => {
    if (String(to) === target) targetRenames++;
    if (fail && String(to) === target && (await readFile(from, 'utf8')).includes('labels: []')) {
      fail = false;
      throw new Error('injected label removal failure');
    }
    await files.rename(from, to);
  } } });
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const socket = join(root, '.cland', 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  onCleanup(t, () => edge.close());
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket, port: Number(new URL(hub.url).port), secret: TEST_SECRET, pid: process.pid, version: 'test' }));
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'task.create', title: 'Ordinary' });
  const high = (await ui.request({ type: 'task.create', title: 'High', labels: ['high'] })).value as { item: Item };
  target = join(root, high.item.path);
  fail = true;
  const failed = await migration(root);
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /injected label removal failure/);
  assert.deepEqual((JSON.parse(failed.stdout) as { moved: Array<{ id: string }> }).moved.map(item => item.id), ['T-2']);
  const ranked = await ui.request({ type: 'task.view', item: 'T-2' });
  const rank = (ranked.value as { item: Item }).item.rank;
  const beforeRetry = targetRenames;
  const retry = await migration(root);
  assert.equal(retry.code, 0, retry.stderr);
  assert.deepEqual(JSON.parse(retry.stdout), { moved: [], retired: ['T-2'] });
  assert.equal(targetRenames, beforeRetry + 1, 'only label removal replaces the file on retry');
  const done = await ui.request({ type: 'task.view', item: 'T-2' });
  assert.equal((done.value as { item: Item }).item.rank, rank);
  const again = await migration(root);
  assert.equal(again.code, 0, again.stderr);
  assert.deepEqual(JSON.parse(again.stdout), { moved: [], retired: [] });
});

test('dense equal ranks make room with the fewest neighbors while preserving an unrankable boundary', async t => {
  const root = await tempProject(t);
  await fixture(root, [
    { id: 'T-6', kind: 'question' }, { id: 'T-1', rank: 61 }, { id: 'T-2', rank: 61 },
    { id: 'T-5', rank: 62 }, { id: 'T-3', rank: 80 },
  ]);
  await startDaemon(t, root);
  const result = await cland(root, 'task', 'rank', 'T-3', '--before', 'T-1', '--json');
  assert.equal(result.code, 0, result.stderr);
  const moved = JSON.parse(result.stdout) as { changed: string[]; siblings: string[] };
  assert.deepEqual(moved.changed, ['T-1', 'T-2', 'T-3']);
  assert.deepEqual(moved.siblings, ['T-6', 'T-3', 'T-1', 'T-2', 'T-5']);
  const listed = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout) as { items: Item[] };
  assert.deepEqual(listed.items.map(i => [i.id, i.rank]), [['T-6', 60], ['T-3', 61], ['T-1', 62], ['T-2', 62], ['T-5', 62]]);
});


test('rank handles safe integer endpoints without overflow and refuses a fractional disk rank', async t => {
  const root = await tempProject(t);
  await fixture(root, [
    { id: 'T-1', rank: Number.MIN_SAFE_INTEGER }, { id: 'T-2', rank: Number.MAX_SAFE_INTEGER },
    { id: 'T-3', rank: 0 },
  ]);
  await startDaemon(t, root);
  for (const args of [['T-3', '--top'], ['T-1', '--after', 'T-2']]) {
    const result = await cland(root, 'task', 'rank', ...args, '--json');
    assert.equal(result.code, 0, result.stderr);
  }
  const listed = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout) as { items: Item[] };
  assert.deepEqual(listed.items.map(i => i.id), ['T-3', 'T-2', 'T-1']);
  assert.equal(listed.items.every(i => Number.isSafeInteger(i.rank)), true);
  const path = join(root, '.cland', 'tasks', listed.items[1]!.file);
  const text = await readFile(path, 'utf8');
  await writeFile(path, text.replace(/^rank: .*$/m, 'rank: 0.5'));
  const refused = await cland(root, 'task', 'rank', 'T-1', '--top');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /rank must be a safe integer/);
});

test('a failed dense batch reports its committed neighbor and a retry completes the move', async t => {
  const root = await tempProject(t);
  await fixture(root, [{ id: 'T-4', rank: 10 }, { id: 'T-1', rank: 11 }, { id: 'T-5', rank: 12 }, { id: 'T-3', rank: 60 }]);
  let fail = false;
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    rename: async (from, to) => {
      if (fail && String(to).endsWith('T-3-fixture.md')) { fail = false; throw new Error('injected rename failure'); }
      await files.rename(from, to);
    },
  } });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'task.view', item: 'T-3' });
  fail = true;
  const refused = await ui.request({ type: 'task.rank', item: 'T-3', before: 'T-1' });
  assert.equal(refused.ok, false);
  assert.match(JSON.stringify(refused), /rank writes committed: T-1/);
  const neighbor = await ui.request({ type: 'task.view', item: 'T-1' });
  assert.equal((neighbor.value as { item: Item }).item.rank, 12);
  const moved = await ui.request({ type: 'task.view', item: 'T-3' });
  assert.equal((moved.value as { item: Item }).item.rank, 60);
  const retry = await ui.request({ type: 'task.rank', item: 'T-3', before: 'T-1' });
  assert.equal(retry.ok, true);
  assert.deepEqual((retry.value as { siblings: string[] }).siblings, ['T-4', 'T-3', 'T-1', 'T-5']);
});

test('a moved item keeps its rank when changing one neighbor alone can place it', async t => {
  const root = await tempProject(t);
  await fixture(root, [{ id: 'T-1', rank: 7 }, { id: 'T-2', rank: 7 }, { id: 'T-5', rank: 7 }]);
  await startDaemon(t, root);
  const before = await readFile(join(root, '.cland', 'tasks', 'T-5-fixture.md'), 'utf8');
  const result = await cland(root, 'task', 'rank', 'T-5', '--before', 'T-2', '--json');
  assert.equal(result.code, 0, result.stderr);
  const moved = JSON.parse(result.stdout) as { changed: string[]; siblings: string[] };
  assert.deepEqual(moved.changed, ['T-2']);
  assert.deepEqual(moved.siblings, ['T-1', 'T-5', 'T-2']);
  assert.equal(await readFile(join(root, '.cland', 'tasks', 'T-5-fixture.md'), 'utf8'), before);
});


// The Coordinator explicitly added this pure computation seam for the bounded linear planner.
test('500 equal-ranked siblings compute in under 50 ms and write only the required 249 neighbors', () => {
  const items = Array.from({ length: 500 }, (_, index) => ({ id: `T-${index + 1}`, rank: 0 }));
  const allowed = new Set(items.map(item => item.id));
  const started = performance.now();
  const changes = rankChanges(items.slice(0, -1), items[499]!, 250, allowed);
  const elapsed = performance.now() - started;
  assert.equal(changes.size, 249);
  assert.equal(changes.has('T-500'), false);
  assert.equal(changes.has('T-250'), false);
  assert.ok(elapsed < 50, `rank computation took ${elapsed.toFixed(1)} ms`);
  const order = items.map(item => ({ ...item, rank: changes.get(item.id) ?? item.rank })).sort(compareRank);
  assert.deepEqual(order.map(item => item.id), [...items.slice(0, 250), items[499]!, ...items.slice(250, -1)].map(item => item.id));
});
