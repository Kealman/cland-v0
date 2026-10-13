// Real project startup and the JSON-lines protocol; native SQLite tracing observes work without replacing it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { serveProject, type Daemon } from '../src/hub/daemon.ts';
import { createStdioEdge } from '../src/hub/stdio.ts';
import { connectUi, eventually } from './harness.ts';
import { ownDirectory } from './process-cleanup.ts';
import type { Inbox } from '../src/protocol.ts';
import { createHubBase, type HubBase } from '../src/hub/server.ts';
import { eventRow, type JournalRecord } from '../src/hub/journal.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function pipe(daemon: Pick<Daemon, 'hub'>) {
  const input = new PassThrough(), output = new PassThrough();
  const frames: Array<Record<string, unknown>> = [];
  let pending = '';
  const waiters = new Map<string, (frame: Record<string, unknown>) => void>();
  output.setEncoding('utf8');
  output.on('data', (text: string) => {
    pending += text;
    let at: number;
    while ((at = pending.indexOf('\n')) >= 0) {
      const frame = JSON.parse(pending.slice(0, at)) as Record<string, unknown>;
      frames.push(frame);
      const done = typeof frame.id === 'string' ? waiters.get(frame.id) : undefined;
      if (done) { waiters.delete(frame.id as string); done(frame); }
      pending = pending.slice(at + 1);
    }
  });
  createStdioEdge({ input, output, dispatcher: daemon.hub.dispatcher, onEnd: () => {} });
  return { frames, request: (frame: Record<string, unknown> & { id: string }) => new Promise<Record<string, unknown>>(resolve => {
    waiters.set(frame.id, resolve); input.write(JSON.stringify(frame) + '\n');
  }), send: (frame: Record<string, unknown>) => input.write(JSON.stringify(frame) + '\n'),
    batch: (batch: Array<Record<string, unknown>>) => input.write(batch.map(f => JSON.stringify(f)).join('\n') + '\n'),
    close: () => { input.end(); output.end(); } };
}

test('archive startup batches hundreds of stops; item and stop bursts schedule one sweep per tick with thousands of retained items and messages', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-archive-work-'))), db = join(root, '.cland', 'hub.db');
  const cleanup = ownDirectory(undefined, root);
  let stop = async () => {};
  t.after(async () => { try { await stop(); } finally { await cleanup(); } });
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "1s"\narchive_after_stop = "1s"\n');
  const tracker = new Tracker({ root, db });
  const actor = { id: 'human', name: 'human', role: null, human: true };
  for (let i = 0; i < 2000; i++) await tracker.create(actor, { title: `Retained item ${i}` });
  await tracker.stop();
  const seed = new Store(db), ts = new Date(Date.now() - 86400000).toISOString();
  seed.transaction(() => {
    for (let i = 0; i < 3000; i++) seed.record({ id: `old-${i}`, from: 'old', fromKind: 'agent', via: 'session', to: [], text: 'Retained message', ts }, [], Date.now());
  });
  seed.close();
  const processes = new ProcessTable(db);
  for (let i = 0; i < 256; i++) processes.put({ name: `old-${i}`, harness: 'claude-code', role: 'implementer', item: 'T-1', model: null, cwd: root, pid: null, harnessId: null, sessionId: `old-id-${i}`, harnessSessionId: null, startedAt: ts, stoppedAt: ts, status: 'stopped' });
  processes.close();
  const prepare = DatabaseSync.prototype.prepare;
  let batches = 0, lifecycleLookups = 0, archiveCounts = 0;
  // A native tracer counts queries without retaining node:test's per-call stack/arguments on this large store.
  DatabaseSync.prototype.prepare = function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    if (args[0].startsWith('update harness_processes set archived_at')) batches++;
    if (args[0].includes('coalesce(m.merged_at')) lifecycleLookups++;
    if (args[0] === 'select count(*) as n from harness_processes where archived_at is not null') archiveCounts++;
    return prepare.apply(this, args);
  };
  t.after(() => { DatabaseSync.prototype.prepare = prepare; });
  const records: Array<Record<string, unknown>> = [];
  let turn = 0;
  let turnTimer: ReturnType<typeof setImmediate>;
  const nextTurn = () => { turn++; turnTimer = setImmediate(nextTurn); };
  nextTurn();
  t.after(() => clearImmediate(turnTimer));
  const daemon = await serveProject(root, { log: entry => records.push({ ...entry, turn }) });
  const human = pipe(daemon), verifier = pipe(daemon);
  stop = async () => { human.close(); verifier.close(); await daemon.stop(); };
  await tick();
  const startup = records.filter(r => r.event === 'session-archive-sweep');
  assert.equal(startup.length, 1, 'one sweep at startup');
  assert.deepEqual([startup[0]!.rows, startup[0]!.archived, startup[0]!.batches], [256, 256, 1]);
  assert.equal(batches, 1, 'one native archive batch for every due row');
  assert.equal(lifecycleLookups, 1, 'one indexed item timestamp lookup for a shared item');
  assert.equal(archiveCounts, 1, 'one authoritative count scan for the whole startup batch');
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  const archived = await human.request({ type: 'session.list', id: 'archive', archived: true });
  assert.equal((archived.value as { archived: number }).archived, 256);
  assert.ok((archived.value as { processes: HarnessProcessView[] }).processes.every(p => p.archivedBy === 'rule'));
  await human.request({ type: 'role.set', id: 'role', session: 'verifier', role: 'reviewer' });
  verifier.send({ type: 'hello', protocol: 2, name: 'verifier', sessionId: 'verifier-id', cwd: root });
  await eventually('verifier connected', () => verifier.frames.some(f => f.type === 'welcome') || undefined);
  await tick();
  const before = records.filter(r => r.event === 'session-archive-sweep').length;
  verifier.batch(Array.from({ length: 100 }, (_, i) => ({ type: 'task.hold', id: `hold-${i}`, item: `T-${i + 1}`, release: true })));
  await eventually('all protocol holds committed', () => verifier.frames.filter(f => f.type === 'result' && String(f.id).startsWith('hold-')).length === 100 || undefined);
  await tick();
  assert.equal(records.filter(r => r.event === 'session-archive-sweep').length - before, 1, '100 item events in one input chunk coalesce into one sweep');
  // Fixtures represent live, unconnected harness rows with no OS process, so stop needs no external process.
  const live = new ProcessTable(db);
  for (let i = 0; i < 8; i++) live.put({ name: `new-${i}`, harness: 'codex', role: null, model: null, cwd: root, pid: 2147483646, harnessId: null, sessionId: `new-id-${i}`, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' });
  live.close();
  const beforeStops = records.filter(r => r.event === 'session-archive-sweep').length;
  human.batch(Array.from({ length: 8 }, (_, i) => ({ type: 'session.stop', id: `stop-${i}`, session: `new-${i}` })));
  await eventually('all protocol stops committed', () => human.frames.filter(f => f.type === 'result' && String(f.id).startsWith('stop-')).length === 8 || undefined);
  const stopped = human.frames.filter(f => String(f.id).startsWith('stop-'));
  assert.ok(stopped.every(f => f.ok), `stop frames succeeded: ${JSON.stringify(stopped.find(f => !f.ok))}`);
  await tick();
  const sweeps = records.filter(r => r.event === 'session-archive-sweep').slice(beforeStops);
  assert.ok(sweeps.length > 0, 'stops trigger cleanup');
  assert.equal(sweeps.length, new Set(sweeps.map(r => r.turn)).size, 'asynchronous stops produce at most one sweep in each event-loop tick');
});

test('startup with 256 remembered processes and thousands of messages, then two 100-event protocol bursts, uses a fixed inbox query budget', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-inbox-work-'))), db = join(root, '.cland', 'hub.db');
  const cleanup = ownDirectory(undefined, root);
  let stop = async () => {};
  t.after(async () => { try { await stop(); } finally { await cleanup(); } });
  await mkdir(join(root, '.cland'), { recursive: true });
  const seed = new Store(db), ts = new Date().toISOString();
  seed.createTopic('history', 'Answered history', null, ts);
  seed.createTopic('requests', 'Replied requests', null, ts);
  seed.createTopic('replies', 'Explicit replies', null, ts);
  seed.transaction(() => {
    for (let i = 0; i < 1500; i++) {
      seed.record({ id: `report-${i}`, topic: 'history', from: 'aide', fromKind: 'agent', fromRole: 'aide', via: 'session', to: [], text: `Report ${i}`, ts }, [], Date.now());
      seed.record({ id: `answer-${i}`, topic: 'history', from: 'human', fromKind: 'human', via: 'session', to: [], text: `Answer ${i}`, ts }, [], Date.now());
    }
    for (let i = 0; i < 100; i++) {
      seed.record({ id: `request-${i}`, topic: 'requests', from: 'aide', fromKind: 'agent', fromRole: 'aide', via: 'session', to: [], kind: 'request', request: 'review', subject: 'remembered-0', text: `Request ${i}`, ts }, [], Date.now());
      seed.record({ id: `reply-${i}`, topic: 'replies', from: 'human', fromKind: 'human', via: 'session', to: [], replyTo: `request-${i}`, text: `Reply ${i}`, ts }, [], Date.now());
    }
  });
  seed.close();
  const processes = new ProcessTable(db);
  for (let i = 0; i < 256; i++) processes.put({ name: `remembered-${i}`, harness: 'codex', role: null, model: null, cwd: root, pid: null, harnessId: null, sessionId: `old-${i}`, harnessSessionId: null, startedAt: ts, status: 'stopped' });
  processes.close();

  let queries = 0;
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    if (args[0].includes('with latest_messages as')) queries++;
    return prepare.apply(this, args);
  });
  const daemon = await serveProject(root, { log: () => {} });
  const clients: Array<() => void> = [];
  stop = async () => { for (const close of clients) close(); await daemon.stop(); };
  const atServing = queries;
  t.diagnostic(`startup inbox queries at serving: ${atServing}`);
  assert.ok(atServing <= 3, `startup recomputed the inbox ${atServing} times for 256 remembered processes`);
  await tick();
  assert.ok(queries <= 3, `startup and its first tick used ${queries} inbox queries`);
  assert.ok(queries > 0, 'the native tracer saw an actual inbox query');
  assert.ok(daemon.discovery);
  const ui = await connectUi(t, daemon.discovery);
  clients.push(() => ui.close());
  const snapshot = await ui.request({ type: 'inbox.list' });
  assert.equal(snapshot.ok, true, snapshot.error);
  assert.equal((snapshot.value as Inbox).needsYou, 0, 'same-topic answers and cross-topic explicit replies leave no waiting rows');
  const client = pipe(daemon);
  clients.push(() => client.close());
  client.send({ type: 'hello', protocol: 2, client: 'ui' });
  assert.equal(client.frames[0]?.type, 'welcome');
  await tick();
  for (let batch = 0; batch < 2; batch++) {
    const before = queries, frameCount = client.frames.length;
    client.batch(Array.from({ length: 100 }, (_, i) => ({ type: 'topic.read', id: `read-${batch}-${i}`, topic: 'history', upTo: `answer-${i + batch * 100}` })));
    const replies = client.frames.slice(frameCount).filter(f => f.type === 'result');
    assert.equal(replies.length, 100, 'all 100 event-producing writes completed in this input chunk');
    assert.ok(replies.every(f => f.ok === true));
    assert.equal(queries, before, 'no full inbox query runs synchronously per event');
    await tick();
    assert.equal(queries - before, 1, 'a burst recomputes once on the next tick');
  }
});


test('durable wait capture is deferred one tick, retains the original timestamp, and archives a request resolved within that tick', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-inbox-time-'))), records: Array<Record<string, unknown>> = [];
  const cleanup = ownDirectory(undefined, root);
  let stop = async () => {};
  t.after(async () => { try { await stop(); } finally { await cleanup(); } });
  const daemon = await serveProject(root, { listen: 'never', log: record => records.push(record) });
  const clients: Array<() => void> = [];
  stop = async () => { for (const close of clients) close(); await daemon.stop(); };
  const human = pipe(daemon), aide = pipe(daemon);
  clients.push(() => human.close(), () => aide.close());
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  assert.equal((await human.request({ type: 'role.set', id: 'assign', session: 'aide-test', role: 'aide' })).ok, true);
  aide.send({ type: 'hello', protocol: 2, name: 'aide-test', sessionId: 'aide-id', cwd: root });
  await eventually('aide protocol hello', () => aide.frames.some(f => f.type === 'welcome') ? Promise.resolve(true) : Promise.resolve(undefined));
  await tick();
  const inspector = new Store(join(root, '.cland', 'hub.db'));
  clients.push(() => inspector.close());
  const send = (id: string, text: string) => aide.send({ type: 'send', id, kind: 'request', request: 'review', subject: 'aide-test', text });

  send('persistent', 'Wait across a tick');
  assert.equal(aide.frames.find(f => f.id === 'persistent')?.ok, true);
  const message = inspector.topicMessages('general', 10).find(m => m.text === 'Wait across a tick');
  assert.ok(message);
  assert.ok(!inspector.inboxWaits().some(w => w.id === message.id), 'the send is committed before its inbox wait is recorded');
  await tick();
  assert.equal(inspector.inboxWaits().find(w => w.id === message.id)?.since, message.ts, 'next-tick persistence preserves the actual wait start, rather than recording the recompute time');
  human.send({ type: 'topic.send', id: 'reply-persistent', topic: 'general', replyTo: message.id, text: 'Reviewed' });
  await tick();
  assert.ok(inspector.inboxDepartures('1970-01-01T00:00:00.000Z').some(d => d.id === message.id && d.reason === 'replied'));

  send('transient', 'Resolved in the same tick');
  assert.equal(aide.frames.find(f => f.id === 'transient')?.ok, true);
  const transient = inspector.topicMessages('general', 10).find(m => m.text === 'Resolved in the same tick');
  assert.ok(transient);
  human.send({ type: 'topic.send', id: 'reply-transient', topic: 'general', replyTo: transient.id, text: 'Reviewed immediately' });
  assert.equal(human.frames.find(f => f.id === 'reply-transient')?.ok, true);
  await tick();
  assert.ok(!inspector.inboxWaits().some(w => w.id === transient.id));
  assert.equal(inspector.inboxDepartures('1970-01-01T00:00:00.000Z').filter(d => d.id === transient.id && d.reason === 'replied').length, 1, 'a same-tick reply has one durable departure');
  assert.equal(records.filter(r => r.event === 'inbox-departure' && r.id === transient.id && r.reason === 'replied').length, 1);
});

test('an event-producing frame followed immediately by public hub close cancels queued live projection', async t => {
  const store = new Store(), ts = new Date().toISOString();
  store.createTopic('shutdown', 'Shutdown boundary', null, ts);
  let hub: HubBase | undefined;
  const journalRows: JournalRecord[] = [];
  const log = (entry: Record<string, unknown>) => {
    const record = { ts, ...entry, event: String(entry.event), eventsVersion: 1 };
    const row = eventRow(record);
    if (row && hub) { journalRows.push(record); hub.core.publishJournalRow(row, record); }
  };
  hub = createHubBase({ secret: 'test', store, log });
  let closed = false;
  t.after(async () => { if (!closed) await hub!.close(); });
  const client = pipe({ hub });
  t.after(() => client.close());
  client.send({ type: 'hello', protocol: 2, client: 'ui' });
  await client.request({ type: 'subscribe', id: 'subscribe' });
  await tick();
  const before = client.frames.filter(f => f.type === 'event').length;
  client.send({ type: 'topic.close', id: 'close-topic', topic: 'shutdown' });
  assert.equal(client.frames.find(f => f.id === 'close-topic')?.ok, true, 'the domain action committed through its frame');
  assert.ok(journalRows.some(r => r.event === 'event-announced' && (r.subject as { topic?: string })?.topic === 'shutdown'), 'closing the topic queued its actual journal row');
  assert.equal(client.frames.filter(f => f.type === 'event').length, before, 'the projection is still pending in this tick');
  await hub.close();
  closed = true;
  await tick();
  assert.equal(client.frames.filter(f => f.type === 'event').length, before, 'no pending events publish after the hub closes');
});


test('delivered verifier requests and session.list bursts never scan retained message history', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-verifier-work-'))), db = join(root, '.cland', 'hub.db');
  const cleanup = ownDirectory(undefined, root);
  await mkdir(join(root, '.cland'), { recursive: true });
  const seed = new Store(db), ts = new Date().toISOString();
  seed.transaction(() => {
    for (let i = 0; i < 4000; i++) seed.record({ id: `old-${i}`, from: 'old', fromKind: 'agent', via: 'session', to: [], text: 'review request T-1', ts }, [], Date.now());
  });
  seed.close();
  const daemon = await serveProject(root, { log: () => {} });
  const human = pipe(daemon), verifier = pipe(daemon);
  t.after(async () => { human.close(); verifier.close(); await daemon.stop(); await cleanup(); });
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  await human.request({ type: 'role.set', id: 'role', session: 'verifier', role: 'reviewer' });
  verifier.send({ type: 'hello', protocol: 2, name: 'verifier', sessionId: 'verifier-id', cwd: root });
  await eventually('verifier hello', () => verifier.frames.some(f => f.type === 'welcome') || undefined);
  await human.request({ type: 'task.create', id: 'item', title: 'Burst verification' });
  const first = ((human.frames.find(f => f.id === 'item')!.value as { item: { id: string } }).item.id);
  const second = await human.request({ type: 'task.create', id: 'item-two', title: 'Newer burst request' });
  const item = (second.value as { item: { id: string } }).item.id;
  // Take the initial role clause before measuring request deliveries.
  for (const frame of verifier.frames.filter(f => f.type === 'role')) verifier.send({ type: 'ack', id: (frame.message as { id: string }).id });
  await tick();
  const table = new ProcessTable(db);
  table.put({ name: 'verifier', harness: 'codex', role: 'reviewer', model: null, cwd: root, pid: null, harnessId: null, sessionId: 'verifier-id', harnessSessionId: null, startedAt: ts, status: 'running' });
  table.close();
  await human.request({ type: 'subscribe', id: 'subscribe' });
  const prepare = DatabaseSync.prototype.prepare;
  let observing = false, messageReads = 0, pendingReads = 0;
  const scans: string[] = [];
  t.mock.method(DatabaseSync.prototype, 'prepare', function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    const sql = args[0];
    if (observing && /^select|^with/i.test(sql.trim()) && /\b(?:from|join) messages\b/i.test(sql)) {
      messageReads++;
      const explain = sql.replace(/:[a-z_]+/gi, '?');
      const plan = prepare.call(this, `explain query plan ${explain}`).all(...Array((explain.match(/\?/g) ?? []).length).fill(null)) as Array<{ detail: string }>;
      const aliases = [...sql.matchAll(/\b(?:from|join) messages(?:\s+(?!where\b|on\b|order\b|group\b|limit\b|join\b)([a-z_]+))?/gi)].map(m => m[1] ?? 'messages');
      if (plan.some(row => aliases.some(alias => new RegExp(`^SCAN ${alias}(?: |$)`, 'i').test(row.detail)))) scans.push(sql);
    }
    const statement = prepare.apply(this, args);
    if (sql === 'select value from meta where key = ?') {
      const get = statement.get;
      t.mock.method(statement, 'get', function(this: typeof statement, ...bindings: unknown[]) {
        if (observing && bindings[0] === 'pending-verification:verifier-id') pendingReads++;
        return Reflect.apply(get, this, bindings);
      });
    }
    return statement;
  });
  for (let burst = 0; burst < 3; burst++) {
    const before = human.frames.length, readsBefore = pendingReads;
    observing = true;
    for (let i = 0; i < 100; i++) {
      human.send({ type: 'topic.send', id: `send-${burst}-${i}`, topic: 'general', to: ['verifier'], text: burst === 2 ? `Ordinary report ${i}` : `review request ${i % 2 === 0 ? first : item}` });
      if (burst === 0 && i === 0) {
        const queued = await human.request({ type: 'session.list', id: 'before-acceptance' });
        assert.equal((queued.value as { processes: Array<{ pending?: unknown }> }).processes[0]?.pending, undefined, 'sending alone does not set pending work');
      }
      const frame = verifier.frames.filter(f => f.type === 'deliver').at(-1)!;
      verifier.send({ type: 'ack', id: (frame.message as { id: string }).id });
      human.send({ type: 'session.list', id: `list-${burst}-${i}` });
    }
    observing = false;
    assert.deepEqual(scans, [], 'delivery acceptance and session views use indexed message lookups only');
    // At most 100 delivery captures + 100 explicit views, with a small fixed allowance; ordinary reports need only the views.
    assert.ok(pendingReads - readsBefore <= (burst === 2 ? 110 : 210), `100 deliveries and 100 explicit views allow no synchronous whole-presence reads (${pendingReads - readsBefore} pending reads)`);
    await tick();
    const presence = human.frames.slice(before).filter(f => f.type === 'presence');
    assert.equal(presence.length, burst === 0 ? 1 : 0, 'changing requests publish only the final changed presence per tick');
    const updates = human.frames.slice(before).filter(f => f.type === 'session.process' && (f.process as { name: string }).name === 'verifier');
    assert.equal(updates.length, burst === 0 ? 1 : 0, 'a burst of changing requests publishes at most one final process per tick');
    const lists = human.frames.slice(before).filter(f => String(f.id).startsWith(`list-${burst}-`));
    assert.equal(lists.length, 100);
    assert.ok(lists.every((f, i) => f.ok === true && (f.value as { processes: Array<{ pending?: { item: string } }> }).processes[0]?.pending?.item === (burst === 2 || i % 2 !== 0 ? item : first)));
  }
  const status = await human.request({ type: 'hub.status', id: 'pending-status' });
  assert.deepEqual((status.value as { sessions: Array<{ pending?: { item: string; kind: string } }> }).sessions[0]!.pending, { item, kind: 'review' });
  assert.ok(messageReads > 0, 'native tracing observed actual delivery message lookups');
});
