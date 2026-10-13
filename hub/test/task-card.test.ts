import test from 'node:test';
import assert from 'node:assert/strict';
import files, { readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, connectUi, eventually, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { execFileSync } from 'node:child_process';
import { preparedProject } from './prepared-project.ts';
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
  const root = await preparedProject(t, 'verification');
  await writeFile(join(root, 'fake-suite.cjs'), `const fs = require('fs'); fs.writeFileSync('entered', ''); const timer = setInterval(() => { if (fs.existsSync('finish')) clearInterval(timer); }, 20);`);
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node fake-suite.cjs' } }));
  const db = join(root, '.cland/hub.db');
  const tracker = new Tracker({ root, db, scheduleTips: () => ({ poke() {}, stop() {} }) });
  tracker.start();
  t.after(() => tracker.stop());
  const hub = await startHub({ tracker, store: new Store(db), roles: fixedRoles(), verification: { locks: [join(root, 'suite.lock'), join(root, 'nvim.lock')] },
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
  assert.equal((await ui.request({ type: 'task.link', item: item.id, regression_of: landed })).ok, true);
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
  let queries = 0, fullLists = 0, repeatedCriteriaReads = 0;
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
    if ((measuringList || observing) && sql.startsWith('select criteria_summary from tracker_items')) repeatedCriteriaReads++;
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
  assert.equal(repeatedCriteriaReads, 0, 'list resolves counts from the already-selected rows');
  assert.equal(fileReads, 0);
  const run = await ui.request({ type: 'suite.start', mode: 'all', cwd: root, report: topic.topic.id, to: [] });
  assert.equal(run.ok, true, run.error);
  await eventually('fake runner entered', async () => fs.existsSync(join(root, 'entered')) || undefined);
  const running = ((await ui.request({ type: 'task.list' })).value as { items: ItemSummary[] }).items.find(i => i.id === item.id)!.verify!;
  assert.equal(running.state, 'running');
  assert.equal(running.result, null);
  queries = 0;
  observing = true;
  fileReads = 0;
  const from = ui.frames.length;
  await writeFile(join(root, 'finish'), '');
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

test('list criteria counts use exclusive mark precedence and exact branch and epic tips', async t => {
  const root = await preparedProject(t);
  const tip = execFileSync('git', ['rev-parse', 'dev'], { cwd: root, encoding: 'utf8' }).trim();
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const body = `## Acceptance criteria
- [x] C1. Done only
  - done: impl · 2026-10-13T10:00Z
- [x] C2. Current beats stale and done
  - done: impl · 2026-10-13T10:00Z
  - verified: rev [reviewer] · run old · 2026-10-13T10:00Z
  - verified: rev [reviewer] · run current · 2026-10-13T10:00Z · commit ${tip}
- [x] C3. Stale beats done
  - done: impl · 2026-10-13T10:00Z
  - verified: rev [reviewer] · run old · 2026-10-13T10:00Z · commit ${'a'.repeat(40)}
- [ ] C4. Failed beats current
  - failed: rev [reviewer] · 2026-10-13T10:00Z · note Broken
  - verified: rev [reviewer] · run current · 2026-10-13T10:00Z · commit ${tip}
- [x] C5. A checkbox alone is open
- [ ] C6. Legacy verification is stale
  - verified: rev [reviewer] · run legacy · 2026-10-13T10:00Z`;
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item } = await coord.call<{ item: ItemView }>('task.create', { size: 'M', title: 'Counts', body, branch: 'dev' });
  const counts = { total: 6, done: 1, verified: 1, stale: 2, failed: 1 };
  await eventually('counts resolve the current branch tip', async () => {
    const list = await coord.call<{ items: ItemSummary[] }>('task.list', {});
    return JSON.stringify(list.items[0]?.criteria) === JSON.stringify(counts) ? true : undefined;
  });
  const detail = await coord.call<{ item: ItemView }>('task.view', { id: item.id });
  assert.deepEqual(detail.item.criteriaCounts, counts);
  assert.equal(detail.item.criteria[1]!.marks.at(-1)?.kind, 'verified');
  const epic = await coord.call<{ item: ItemView }>('task.create', { title: 'Definition', kind: 'epic', body: body.replace('Acceptance criteria', 'Definition of done') });
  const list = await coord.call<{ items: ItemSummary[] }>('task.list', {});
  assert.deepEqual(list.items.find(i => i.id === epic.item.id)?.criteria, counts);
  assert.deepEqual(epic.item.criteriaCounts, counts);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as ItemSummary)?.id === epic.item.id);
  assert.deepEqual((event.item as ItemSummary).criteria, counts);
  assert.match((await cland(root, 'task', 'view', item.id)).stdout, /criteria +1 verified \/ 6 total.*1 done.*2 stale.*1 failed/);
});

test('close, done and reopen publish the file closing time through CLI, MCP and task events', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item } = await coord.call<{ item: { id: string; path: string } }>('task.create', { size: 'M', title: 'Closing time' });
  const read = async () => (await coord.call<{ item: { closed?: string; state: string } }>('task.view', { id: item.id })).item;
  for (const args of [['close', item.id], ['edit', item.id, '--status', 'done']]) {
    const from = ui.frames.length;
    const result = await cland(root, 'task', ...args, '--json');
    assert.equal(result.code, 0, result.stderr);
    const closed = JSON.parse(result.stdout).item.closed;
    assert.match(closed, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.equal((await read()).closed, closed);
    assert.equal(parseItem(await readFile(join(root, item.path), 'utf8')).fm.closed, closed);
    const list = await cland(root, 'task', 'list', '--json');
    assert.equal(JSON.parse(list.stdout).items[0].closed, closed);
    const event = await ui.waitFor(f => ui.frames.indexOf(f) >= from && f.type === 'task' && (f.item as { closed?: string })?.closed === closed);
    assert.equal((event.item as { id: string }).id, item.id);
    assert.match((await cland(root, 'task', 'view', item.id)).stdout, new RegExp(`closed +${closed.replaceAll('.', '\\.')}\n`));
    await coord.call('task.edit', { id: item.id, state: 'open' });
    assert.equal((await read()).closed, undefined);
    assert.doesNotMatch(await readFile(join(root, item.path), 'utf8'), /^closed:/m);
  }
  const { item: container } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Category', kind: 'category' });
  const result = await coord.call<{ item: { closed: string } }>('task.close', { id: container.id });
  assert.ok(result.item.closed);
  // A hand close does not invent a time from updated or the wall clock.
  const source = await readFile(join(root, item.path), 'utf8');
  await writeFile(join(root, item.path), source.replace('state: open', 'state: closed').replace('status: backlog', 'status: done'));
  await eventually('hand close indexed without a time', async () => {
    const list = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout).items;
    return list.find((i: { id: string; state: string; closed?: string }) => i.id === item.id && i.state === 'closed' && i.closed === undefined);
  });
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
  await startDaemon(t, root);
  const made = await cland(root, 'task', 'create', '--size', 'M', 'Reclosed', '--json');
  const item = JSON.parse(made.stdout).item;
  const path = join(root, item.path);
  const old = '2001-01-01T00:00:00.000Z';
  for (const args of [['close', item.id], ['edit', item.id, '--status', 'done'], ['edit', item.id, '--state', 'closed']]) {
    const source = (await readFile(path, 'utf8')).replace(/^closed:.*\n/m, '').replace('state: closed', 'state: open').replace('status: done', 'status: backlog');
    await writeFile(path, source.replace(/^updated:.*\n/m, line => `${line}closed: ${old}\n`));
    const reopened = JSON.parse((await cland(root, 'task', 'view', item.id, '--json')).stdout).item;
    assert.equal(reopened.state, 'open');
    assert.equal(reopened.closed, old, 'hand saves remain the source of truth');
    const close = await cland(root, 'task', ...args, '--json');
    assert.equal(close.code, 0, close.stderr);
    const closed = JSON.parse(close.stdout).item.closed;
    assert.notEqual(closed, old);
    assert.ok(Date.parse(closed) > Date.parse(old));
    const retry = await cland(root, 'task', ...args, '--json');
    assert.equal(retry.code, 0, retry.stderr);
    assert.equal(JSON.parse(retry.stdout).item.closed, closed, 'already-closed writes remain idempotent');
  }
});
