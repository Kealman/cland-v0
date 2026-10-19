// T2 component: tracker rules at public APIs, sockets, CLI and in-process MCP.
import { componentTask } from './component-task.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import files, { readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, connectUi, eventually, projectHub, startHub, tempProject } from './harness.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { FakeClock } from './fake-clock.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import { Tracker, type ItemView, type ItemSummary } from '../src/tracker/tracker.ts';
import { Store } from '../src/hub/store.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { TEST_SECRET } from './harness.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';

test('indexed closed time precedes receipts and legacy fallbacks and reopening has none', async t => {
  const root = await tempProject(t);
  const index = new TrackerIndex(join(root, 'index.db'));
  t.after(() => index.close());
  const item = parseItem('---\nid: T-1\nstate: closed\nupdated: 2026-10-12T10:00:00Z\nclosed: 2026-10-01T10:00:00Z\n---\n');
  const put = () => index.put(item, { file: 'T-1-time.md', hash: 'hash', source: 'hand', indexedAt: Date.now() });
  put();
  assert.equal(index.closedAt('T-1'), '2026-10-01T10:00:00Z');
  index.recordMerge('T-1', { branch: 't/time', tip: 'a'.repeat(40), commit: 'b'.repeat(40), base: 'dev' });
  assert.equal(index.closedAt('T-1'), '2026-10-01T10:00:00Z');
  delete item.fm.closed;
  put();
  assert.ok(index.closedAt('T-1'));
  assert.notEqual(index.closedAt('T-1'), item.fm.updated, 'receipt fallback remains');
  item.fm.state = 'open'; put();
  assert.equal(index.closedAt('T-1'), null);
  const legacy = parseItem('---\nid: T-2\nstate: closed\nupdated: 2026-10-02T10:00:00Z\n---\n');
  index.put(legacy, { file: 'T-2-legacy.md', hash: 'legacy', source: 'hand', indexedAt: Date.now() });
  assert.equal(index.closedAt('T-2'), legacy.fm.updated);
});

test('a 65-row list reads no item files; a verify finishing reads one summary with bounded queries and coalesced events', async t => {
  const root = await tempProject(t);
  await files.mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\n');
  const clock = new FakeClock();
  const admitted = Promise.withResolvers<RunRef>();
  let receipt: RunStatus = { state: 'running' };
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'acquire', async (run: RunRef, deadline: string): Promise<Lease> => ({ kind: 'local', run: run.id, created: clock.now().toISOString(), deadline, resource: null }));
  t.mock.method(LocalExecutor.prototype, 'prepare', async () => {});
  t.mock.method(LocalExecutor.prototype, 'deliver', async () => {});
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { admitted.resolve(run); });
  t.mock.method(LocalExecutor.prototype, 'status', async () => receipt);
  t.mock.method(LocalExecutor.prototype, 'release', async () => ({ lifetimeMs: null, costUsd: null }));
  const head = 'a'.repeat(40), tree = 'b'.repeat(40);
  const db = join(root, '.cland/hub.db');
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db, watch: () => ({ close() {} }), scheduleTips: () => ({ poke() {}, stop() {} }) });
  tracker.start();
  t.after(() => tracker.stop());
  const hub = await startHub({ clock, droplet: { processes: { alive: () => true, started: () => 'fixture-process' } },
    env: { DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state') }, tracker, store: new Store(db), roles: fixedRoles(), verification: {
    durationContext: null,
    candidate: { head: async () => head, tree: async () => tree, inspect: async () => ({ head, tree, branch: 'dev', selection: { mode: 'hub-only', files: [], reason: 'card receipt' }, tierPlan: [], budgetBase: undefined }) },
    locks: [join(root, 'suite.lock'), join(root, 'nvim.lock')] },
    control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: '', uptimeMs: 0 }), stop() {} } });
  t.after(() => hub.close());
  const socket = join(root, 'card.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  const made = await ui.request({ size: 'S', type: 'task.create', title: 'Build card' });
  const item = (made.value as { item: ItemView }).item;
  let landed: string | undefined;
  for (let n = 0; n < 64; n++) {
    const result = await ui.request({ size: 'M', type: 'task.create', title: `Unrelated ${n}` });
    assert.equal(result.ok, true);
    if (n === 0) landed = (result.value as { item: ItemView }).item.id;
  }
  assert.equal((await ui.request({ type: 'task.close', item: landed })).ok, true);
  tracker.recordMerge(landed!, { branch: 't/landed', tip: 'a'.repeat(40), commit: 'b'.repeat(40), base: 'dev' });
  assert.equal((await ui.request({ type: 'task.link', item: item.id, regression_of: landed, blocked_by: [landed!] })).ok, true);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, labels: ['z-last', 'a-first'] })).ok, true);
  const topic = (await ui.request({ type: 'topic.create', title: 'Build', item: item.id })).value as { topic: { id: string } };
  await ui.request({ type: 'subscribe' });
  let fileReads = 0, measuringList = false, observing = false;
  const syncRead = fs.readFileSync, asyncRead = files.readFile;
  t.mock.method(fs, 'readFileSync', (...args: Parameters<typeof fs.readFileSync>) => {
    if ((measuringList || observing) && String(args[0]).includes('/.cland/tasks/')) fileReads++;
    return syncRead(...args);
  });
  t.mock.method(files, 'readFile', (...args: Parameters<typeof files.readFile>) => {
    if ((measuringList || observing) && String(args[0]).includes('/.cland/tasks/')) fileReads++;
    return asyncRead(...args);
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let queries = 0, fullLists = 0, repeatedCriteriaReads = 0, repeatedEdgeReads = 0;
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if ((measuringList || observing) && sql.startsWith('select criteria_summary from tracker_items')) repeatedCriteriaReads++;
    if (measuringList && /^select (label|blocker) from tracker_/.test(sql)) repeatedEdgeReads++;
    if (observing && /tracker_/.test(sql)) queries++;
    return prepare.call(this, sql);
  });
  const fullList = tracker.list.bind(tracker);
  t.mock.method(tracker, 'list', (...args: Parameters<Tracker['list']>) => {
    if (observing) fullLists++;
    // Count the list's own native reads separately from already-pending watcher work.
    measuringList = true;
    try { return fullList(...args); }
    finally { measuringList = false; }
  });
  const list = await ui.request({ type: 'task.list' });
  assert.equal((list.value as { items: ItemSummary[] }).items.length, 65);
  const indexedCard = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id)!;
  assert.deepEqual([indexedCard.size, indexedCard.regression_of], ['S', landed]);
  assert.deepEqual(indexedCard.labels, ['z-last', 'a-first']);
  assert.deepEqual(indexedCard.blocked_by, [landed]);
  assert.deepEqual((list.value as { items: ItemSummary[] }).items.find(i => i.id === landed)!.blocked_by, []);
  assert.equal(repeatedCriteriaReads, 0, 'list resolves counts from the already-selected rows');
  assert.equal(repeatedEdgeReads, 0, 'list loads labels and blockers with the item rows');
  assert.equal(fileReads, 0);
  const run = await ui.request({ type: 'suite.start', mode: 'all', cwd: root, report: topic.topic.id, to: [] });
  assert.equal(run.ok, true, run.error);
  const worker = await admitted.promise;
  const running = ((await ui.request({ type: 'task.list' })).value as { items: ItemSummary[] }).items.find(i => i.id === item.id)!.verify!;
  assert.equal(running.state, 'running');
  assert.equal(running.result, null);
  await tracker.rescanAsync(); // Drain fixture writes before measuring suite completion.
  queries = 0;
  observing = true;
  fileReads = 0;
  const from = ui.frames.length;
  await writeFile(worker.log, '# tests 1\n# pass 1\n');
  receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
  await clock.advance(1000);
  await ui.waitFor(f => ui.frames.indexOf(f) >= from && f.type === 'task' && (f.item as ItemSummary)?.id === item.id && !!(f.item as ItemSummary).verify?.artifact, 15_000);
  assert.equal(fullLists, 0, 'completion must never hydrate the full tracker');
  assert.equal(repeatedCriteriaReads, 0, 'summary publication does not reread criteria columns');
  assert.equal(fileReads, 0);
  assert.ok(queries <= 80, `${queries} tracker queries for one completion with 64 unrelated items`);
  t.diagnostic(`completion: ${queries} tracker queries; ${fullLists} full lists; ${fileReads} item file reads`);
  const cards = ui.frames.slice(from).filter(f => f.type === 'task' && (f.item as ItemSummary)?.id === item.id);
  assert.equal(cards.length, 1, 'one completion card, including the artifact');
  for (const card of cards) {
    assert.equal((card as { events?: unknown }).events, undefined);
    assert.deepEqual([(card.item as ItemSummary).size, (card.item as ItemSummary).regression_of], ['S', landed]);
  }
  // Repeated same-tick saves, even for the same final result, announce at most once.
  const at = ui.frames.length;
  tracker.verifyChanged(item.id, 'dev'); tracker.verifyChanged(item.id, 'dev'); tracker.verifyChanged(item.id, 'dev');
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(ui.frames.slice(at).filter(f => f.type === 'task').length, 0, 'unchanged jobs are silent');
});

test('closed is an optional ISO timestamp that round trips after updated', () => {
  const text = '---\nid: T-1\nupdated: 2026-10-13T10:00:00.000Z\nclosed: 2026-10-13T09:00:00.000Z\n---\n';
  const item = parseItem(text);
  assert.equal(item.fm.closed, '2026-10-13T09:00:00.000Z');
  assert.equal(parseItem(serializeItem(item)).fm.closed, item.fm.closed);
  assert.match(serializeItem(item), /updated: .*\nclosed: /);
  for (const time of ['yesterday', '2026-02-30T10:00:00.000Z', '2026-10-13', '123']) {
    assert.throws(() => parseItem(text.replace('2026-10-13T09:00:00.000Z', time)), /closed.*ISO/);
  }
});

test('hub closes after a hand reopen replace retained closed times, while already-closed retries keep them', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const made = await cland(root, 'task', 'create', '--size', 'M', 'Reclosed', '--json');
  const item = JSON.parse(made.stdout).item;
  const path = join(root, item.path);
  const old = '2001-01-01T00:00:00.000Z';
  for (const args of [['close', item.id], ['edit', item.id, '--status', 'done'], ['edit', item.id, '--state', 'closed']]) {
    const source = (await readFile(path, 'utf8')).replace(/^closed:.*\n/m, '').replace('state: closed', 'state: open').replace('status: done', 'status: backlog');
    await writeFile(path, source.replace(/^updated:.*\n/m, line => `${line}closed: ${old}\n`));
    const reopened = JSON.parse((await componentTask(root, 'task', 'view', item.id, '--json')).stdout).item;
    assert.equal(reopened.state, 'open');
    assert.equal(reopened.closed, old, 'hand saves remain the source of truth');
    const close = await componentTask(root, 'task', ...args, '--json');
    assert.equal(close.code, 0, close.stderr);
    const closed = JSON.parse(close.stdout).item.closed;
    assert.notEqual(closed, old);
    assert.ok(Date.parse(closed) > Date.parse(old));
    const retry = await componentTask(root, 'task', ...args, '--json');
    assert.equal(retry.code, 0, retry.stderr);
    assert.equal(JSON.parse(retry.stdout).item.closed, closed, 'already-closed writes remain idempotent');
  }
});
