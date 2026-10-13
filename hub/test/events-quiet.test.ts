import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { serveProject } from '../src/hub/daemon.ts';
import { connectUi, spawnSpoke, tempProject } from './harness.ts';
import type { EventRow, EventsPage } from '../src/protocol.ts';

const stamp = (seconds: number) => new Date(Date.parse('2026-10-12T10:00:00Z') + seconds * 1000).toISOString();
test('real journal classes, interleaved bursts and filtered pages never split or repeat a group', async t => {
  // Register hub shutdown before tempProject registers directory removal. A failed
  // assertion must still stop the in-process hub before its live files are removed.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.clear = "now"\n');
  const records = [
    { event: 'task-claimed', item: 'T-1', session: 'impl', ts: stamp(0) },
    { event: 'session-launched', session: 'impl', ts: stamp(61) },
    { event: 'session-stopped', session: 'impl', ts: stamp(62) },
    { event: 'event-announced', kind: 'task', subject: { item: 'T-1' }, text: 'status changed review', ts: stamp(63) },
    { event: 'event-announced', kind: 'task', subject: { item: 'T-1' }, text: 'criterion C1 done', ts: stamp(64) },
    { event: 'topic-status', topic: 'general', to: 'closed', ts: stamp(65) },
    { event: 'notification', kind: 'verdict', item: 'T-1', result: 'not clear', text: 'review not clear', ts: stamp(66) },
    { event: 'notification', kind: 'verdict', item: 'T-1', result: 'clear', text: 'review clear override', ts: stamp(67) },
    { event: 'harness-exited', session: 'dead', ts: stamp(68) },
    { event: 'suite-result', branch: 'dev', item: 'T-1', mode: 'all', outcome: { code: 1 }, ts: stamp(69) },
    { event: 'suite-result', branch: 't/T-1', item: 'T-1', mode: 'all', outcome: { code: 1 }, ts: stamp(70) },
    ...Array.from({ length: 5 }, (_, i) => ({ event: 'event-announced', kind: 'task', subject: { item: 'T-2' }, text: 'burst', ts: stamp(100 + i * 10) })),
    { event: 'event-announced', kind: 'topic', subject: { topic: 'other' }, text: 'between burst records', ts: stamp(135) },
    { event: 'event-announced', kind: 'session.state', subject: { session: 'waiting' }, lifecycle: 'waiting for approval', text: 'waiting for approval', ts: stamp(150) },
  ].sort((a, b) => a.ts.localeCompare(b.ts));
  await writeFile(join(root, '.cland/journal.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n');
  const daemon = await serveProject(root, { log: () => {} });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const list = async (extra = {}) => {
    const result = await ui.request({ type: 'events.list', ...extra });
    assert.equal(result.ok, true, result.error);
    return result.value as EventsPage;
  };
  const page = await list({ limit: 1 });
  assert.equal(page.rows[0]?.text, 'burst');
  assert.equal(page.rows[0]?.count, 5);
  assert.equal(page.more, true);
  const second = await list({ before: page.before, limit: 1 });
  assert.equal(second.rows[0]?.text, 'between burst records');
  const seen = [...page.rows, ...second.rows];
  let cursor = second.before, more = second.more;
  while (more) { const p = await list({ before: cursor, limit: 1 }); seen.push(...p.rows); cursor = p.before; more = p.more; }
  assert.equal(seen.filter(r => r.text === 'burst').length, 1);
  assert.equal(new Set(seen.map(r => r.id)).size, seen.length);
  assert.equal(seen.filter(r => r.bookkeeping).length, 6);
  assert.equal(seen.some(r => r.text === 'waiting for approval'), false);
  const warnings = await list({ filter: { warnings: true } });
  assert.equal(warnings.rows.length, 4);
  assert.ok(warnings.rows.every(r => r.glyph === '⚠' && r.warning));
  assert.equal(seen.find(r => r.text.includes('t/T-1'))?.warning, undefined);
  assert.ok((await list({ filter: { kinds: ['session'], subject: { kind: 'session', id: 'impl' } } })).rows.every(r => r.subject.id === 'impl'));
  assert.equal((await list({ filter: { muted: [{ kind: 'item', id: 'T-2' }] } })).rows.some(r => r.text === 'burst'), false);
  assert.equal((await list({ filter: { subject: { kind: 'topic', id: 'other' } } })).rows.length, 1);
  assert.equal((await ui.request({ type: 'events.list', filter: { kinds: ['invalid'] } })).ok, false);
  assert.equal((await ui.request({ type: 'events.list', before: 'events:bm90anNvbg' })).ok, false);
});

test('real announced rows merge on pushes and list, and subtree filters include descendants', async t => {
  // Register hub shutdown before tempProject registers directory removal. A failed
  // assertion must still stop the in-process hub before its live files are removed.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  const daemon = await serveProject(root, { log: () => {} });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const parent = ((await ui.request({ type: 'task.create', kind: 'epic', title: 'Parent' })).value as { item: { id: string } }).item.id;
  const child = ((await ui.request({ size: 'M', type: 'task.create', parent, title: 'Child' })).value as { item: { id: string } }).item.id;
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['coord']);
  await ui.request({ type: 'subscribe' });
  for (let i = 0; i < 5; i++) { const edit = await ui.request({ type: 'task.edit', item: child, status: i % 2 ? 'planned' : 'backlog' }); assert.equal(edit.ok, true, edit.error); }
  const mergedPush = (await ui.waitFor(f => f.type === 'event' && (f.row as EventRow)?.item === child && ((f.row as EventRow).count ?? 0) >= 2)).row as EventRow;
  assert.ok(mergedPush.replaces);
  const grouped = (await ui.request({ type: 'events.list', filter: { kinds: ['task'] } })).value as EventsPage;
  assert.equal(grouped.rows.find(r => r.id === mergedPush.id)?.count, mergedPush.count);
  // A real artifact announcement is usable through its reference filter.
  const artifact = await spoke.call<{ id: string }>('artifact.create', { kind: 'note', title: 'Filtered note', topic: 'general', content: 'note' });
  const pushed = (await ui.waitFor(f => f.type === 'event' && (f.row as EventRow)?.artifact === artifact.id)).row as EventRow;
  await ui.request({ type: 'hub.status', flushLogs: true });
  const artifactPage = (await ui.request({ type: 'events.list', filter: { subject: { kind: 'artifact', id: artifact.id } } })).value as EventsPage;
  assert.ok(artifactPage.rows.some(r => r.id === pushed.id));
  const children = (await ui.request({ type: 'events.list', filter: { subject: { kind: 'item', id: parent } } })).value as EventsPage;
  assert.ok(children.rows.some(r => r.subject.id === child));
});

test('pending plan approvals, asks and waiting messages stay in the inbox; follow-up approval events may show', async t => {
  // Register hub shutdown before tempProject registers directory removal. A failed
  // assertion must still stop the in-process hub before its live files are removed.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  const daemon = await serveProject(root, { log: () => {} });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const ok = async (frame: { type: string } & Record<string, unknown>) => { const r = await ui.request(frame); assert.equal(r.ok, true, r.error); return r.value; };
  const parent = (await ok({ type: 'task.create', kind: 'epic', title: 'Waiting plan' }) as { item: { id: string } }).item.id;
  const child = (await ok({ size: 'M', type: 'task.create', title: 'Plan child', parent }) as { item: { id: string } }).item.id;
  await ok({ type: 'task.plan', item: parent, op: 'set', yaml: JSON.stringify({ stages: [{ name: 'Build', lanes: [[child]], qa: { scope: 'none', when: 'after-stage' } }] }) });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  assert.equal((await coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Waiting question', options: [] })).ok, true);
  const inbox = await ok({ type: 'inbox.list' }) as import('../src/protocol.ts').Inbox;
  assert.equal(inbox.plans.length, 1); assert.equal(inbox.asks.length, 1);
  await ok({ type: 'hub.status', flushLogs: true });
  const page = await ok({ type: 'events.list' }) as EventsPage;
  assert.equal(page.rows.some(r => r.text.includes('Waiting question') || r.text.includes('waiting for human') || r.text.includes('plan needs approval')), false);
  await ok({ type: 'task.plan', item: parent, op: 'approve' });
  const approved = await ok({ type: 'events.list' }) as EventsPage;
  assert.ok(approved.rows.some(r => /plan approved/.test(r.text)));
});

test('the first equal announcement after a real hub restart replaces the restored group', async t => {
  // Register hub shutdown before tempProject registers directory removal. A failed
  // assertion must still stop the in-process hub before its live files are removed.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  let daemon = await serveProject(root, { log: () => {} });
  stop = () => daemon.stop();
  let ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const create = await ui.request({ size: 'M', type: 'task.create', title: 'Restart coalescing' });
  const item = (create.value as { item: { id: string } }).item.id;
  for (let i = 0; i < 10; i++) {
    const result = await ui.request({ type: 'task.edit', item, status: i % 2 ? 'backlog' : 'planned' });
    assert.equal(result.ok, true, result.error);
  }
  const initial = (await ui.request({ type: 'events.list', filter: { subject: { kind: 'item', id: item } } })).value as EventsPage;
  const group = initial.rows.find(r => r.text.endsWith('backlog → planned'))!;
  assert.equal(group.count, 5);
  await ui.request({ type: 'hub.status', flushLogs: true });
  ui.close(); await daemon.stop();
  // A recent group can sit beyond the newest page. Seed unrelated rows only while
  // the real daemon is stopped, then require startup to restore the entire minute.
  await appendFile(join(root, '.cland/journal.jsonl'), Array.from({ length: 205 }, (_, i) => JSON.stringify({ event: 'event-announced', ts: new Date().toISOString(), kind: 'topic', subject: { topic: `unrelated-${i}` }, text: `unrelated event ${i}` }) + '\n').join(''));
  daemon = await serveProject(root, { log: () => {} });
  ui = await connectUi(t, daemon.discovery!);
  await ui.request({ type: 'subscribe' });
  const newest = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.equal(newest.rows.some(r => r.id === group.id), false, 'restored predecessor lies beyond the newest page');
  const restored = (await ui.request({ type: 'events.list', filter: { subject: { kind: 'item', id: item } } })).value as EventsPage;
  assert.equal(restored.rows.find(r => r.id === group.id)?.count, 5);
  assert.equal((await ui.request({ type: 'task.edit', item, status: 'planned' })).ok, true);
  const live = (await ui.waitFor(f => f.type === 'event' && (f.row as EventRow)?.text === group.text)).row as EventRow;
  assert.equal(live.replaces, group.id, 'live occurrence replaces the row loaded before restart');
  assert.equal(live.count, 6, 'live and restored occurrences form one group');
  const refreshed = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.equal(refreshed.rows.find(r => r.id === live.id)?.count, live.count);
});

function deferredAtDatabaseClose(t: TestContext) {
  // Control only the timer and SQLite boundaries. Keep real hub requests, adapters
  // and databases; a pending projection must never query a closed process table.
  const pending = new Map<NodeJS.Immediate, () => void>();
  let rejectCallbacks!: (error: unknown) => void;
  const callbacksFailed = new Promise<never>((_, reject) => { rejectCallbacks = reject; });
  const schedule = globalThis.setImmediate;
  const cancel = globalThis.clearImmediate;
  t.mock.method(globalThis, 'setImmediate', (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
    const handle = schedule(() => {});
    pending.set(handle, () => callback(...args));
    return handle;
  });
  t.mock.method(globalThis, 'clearImmediate', (handle: NodeJS.Immediate | undefined) => {
    if (handle) pending.delete(handle);
    cancel(handle);
  });
  const close = DatabaseSync.prototype.close;
  t.mock.method(DatabaseSync.prototype, 'close', function (this: DatabaseSync) {
    close.call(this);
    // Release held callbacks at the first database close, before the next await
    // in stop can reach dispatcher shutdown. Cancellation still wins normally.
    for (const [handle, callback] of pending) void Promise.resolve().then(() => {
      if (!pending.delete(handle)) return;
      callback();
    }).catch(rejectCallbacks); // propagate callback errors to the test, never suppress them
  });
  return { pending, callbacksFailed };
}

test('hub stop cancels deferred session work before closing its databases', async t => {
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  let swept!: () => void;
  const sweepDone = new Promise<void>(resolve => { swept = resolve; });
  const daemon = await serveProject(root, { log: entry => {
    if (entry.event === 'orphan-sweep-completed' || entry.event === 'orphan-sweep-failed') swept();
  } });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  await sweepDone;

  const { pending, callbacksFailed } = deferredAtDatabaseClose(t);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Pending shutdown projection' });
  assert.equal(created.ok, true, created.error);
  assert.ok(pending.size > 0, 'the frame left deferred work pending');
  await Promise.race([stop(), callbacksFailed]);
  await daemon.stopped;
  assert.equal(pending.size, 0, 'shutdown cancels or drains every deferred callback');
});


test('hub stop cancels deferred journal projections before closing the inbox process provider', async t => {
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  let swept!: () => void;
  const sweepDone = new Promise<void>(resolve => { swept = resolve; });
  const daemon = await serveProject(root, { log: entry => {
    if (entry.event === 'orphan-sweep-completed' || entry.event === 'orphan-sweep-failed') swept();
  } });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  await sweepDone;
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Deferred journal at shutdown' });
  assert.equal(created.ok, true, created.error);
  const { pending, callbacksFailed } = deferredAtDatabaseClose(t);
  const changed = await ui.request({ type: 'task.edit', item: 'T-1', status: 'planned' });
  assert.equal(changed.ok, true, changed.error);
  assert.ok(pending.size > 0, 'the status event left deferred publications pending');
  await Promise.race([stop(), callbacksFailed]);
  await daemon.stopped;
  assert.equal(pending.size, 0, 'shutdown cancels or drains every deferred callback');
});
