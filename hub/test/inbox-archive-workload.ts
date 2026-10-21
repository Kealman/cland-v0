// T2: indexed query budgets through real frames and fixture-owned SQLite tracing.
import { sqliteProbe } from './sqlite-probe.ts';
import { FakeClock } from './fake-clock.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { Dispatcher } from '../src/hub/dispatch.ts';
import { createStdioEdge } from '../src/hub/stdio.ts';
import { connectUi, eventually, projectHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import type { Inbox } from '../src/protocol.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function pipe(daemon: { dispatcher: Pick<Dispatcher, 'open'> }) {
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
  createStdioEdge({ input, output, dispatcher: daemon.dispatcher, onEnd: () => {} });
  return { frames, request: (frame: Record<string, unknown> & { id: string }) => new Promise<Record<string, unknown>>(resolve => {
    waiters.set(frame.id, resolve); input.write(JSON.stringify(frame) + '\n');
  }), send: (frame: Record<string, unknown>) => input.write(JSON.stringify(frame) + '\n'),
    batch: (batch: Array<Record<string, unknown>>) => input.write(batch.map(f => JSON.stringify(f)).join('\n') + '\n'),
    close: () => { input.end(); output.end(); } };
}


/** Same query-budget proof at merge-path and soak scales. */
export async function archiveWorkload(t: import('node:test').TestContext, scale: { items: number; messages: number; processes: number; events: number }) {
  const database = sqliteProbe();
  const clock = new FakeClock();
  const root = await tempProject(t, 'cland-archive-work-'), db = join(root, '.cland', 'hub.db');
  let stop = async () => {};
  onCleanup(t, () => stop());
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "1s"\narchive_after_stop = "1s"\n');
  const tracker = new Tracker({ root, db });
  const actor = { id: 'human', name: 'human', role: null, human: true };
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await Promise.all(Array.from({ length: scale.items }, (_, i) => writeFile(join(root, '.cland/tasks', `T-${i + 1}-retained.md`), `---\nid: T-${i + 1}\nkind: task\ntitle: Retained item ${i}\nstate: open\n---\n`)));
  await tracker.rescanAsync();
  await tracker.stop();
  const seed = new Store(db), ts = new Date(clock.now().getTime() - 86400000).toISOString();
  seed.transaction(() => {
    for (let i = 0; i < scale.messages; i++) seed.record({ id: `old-${i}`, from: 'old', fromKind: 'agent', via: 'session', to: [], text: 'Retained message', ts }, [], Date.now());
  });
  seed.close();
  const processes = new ProcessTable(db);
  for (let i = 0; i < scale.processes; i++) processes.put({ name: `old-${i}`, harness: 'claude-code', role: 'implementer', item: 'T-1', model: null, cwd: root, pid: null, harnessId: null, sessionId: `old-id-${i}`, harnessSessionId: null, startedAt: ts, stoppedAt: ts, status: 'stopped' });
  processes.close();
  let batches = 0, lifecycleLookups = 0, archiveCounts = 0;
  // A native tracer counts queries without retaining node:test's per-call stack/arguments on this large store.
  const prepare = database.prepare;
  database.mock(t, function(this: DatabaseSync, sql) {
    if (sql.startsWith('update harness_processes set archived_at')) batches++;
    return prepare.call(this, sql);
  });
  database.trace(t, function(sql) {
    // The lifecycle lookup now prefers the frontmatter column before its receipt fallback.
    if (sql.includes('coalesce(i.closed, m.merged_at')) lifecycleLookups++;
    if (sql === 'select count(*) as n from harness_processes where archived_at is not null') archiveCounts++;
  });
  const records: Array<Record<string, unknown>> = [];
  let turn = 0;
  const daemon = await projectHub(t, root, {}, { openDatabase: database.open, clock, probes: 'fake', harnesses: 'fake', log: entry => records.push({ ...entry, turn }) });
  const human = pipe(daemon), verifier = pipe(daemon);
  stop = async () => { human.close(); verifier.close(); await daemon.stop(); };
  await tick();
  const startup = records.filter(r => r.event === 'session-archive-sweep');
  assert.equal(startup.length, 1, 'one sweep at startup');
  assert.deepEqual([startup[0]!.rows, startup[0]!.archived, startup[0]!.batches], [scale.processes, scale.processes, 1]);
  assert.equal(batches, 1, 'one native archive batch for every due row');
  assert.equal(lifecycleLookups, 1, 'one indexed item timestamp lookup for a shared item');
  assert.equal(archiveCounts, 1, 'one authoritative count scan for the whole startup batch');
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  const archived = await human.request({ type: 'session.list', id: 'archive', archived: true });
  assert.equal((archived.value as { archived: number }).archived, scale.processes);
  assert.ok((archived.value as { processes: HarnessProcessView[] }).processes.every(p => p.archivedBy === 'rule'));
  await human.request({ type: 'role.set', id: 'role', session: 'verifier', role: 'reviewer' });
  verifier.send({ type: 'hello', protocol: 2, name: 'verifier', sessionId: 'verifier-id', cwd: root });
  await eventually('verifier connected', () => verifier.frames.some(f => f.type === 'welcome') || undefined);
  await tick();
  const before = records.filter(r => r.event === 'session-archive-sweep').length;
  verifier.batch(Array.from({ length: scale.events }, (_, i) => ({ type: 'task.hold', id: `hold-${i}`, item: `T-${i + 1}`, release: true })));
  await eventually('all protocol holds committed', () => verifier.frames.filter(f => f.type === 'result' && String(f.id).startsWith('hold-')).length === scale.events || undefined);
  await tick();
  assert.equal(records.filter(r => r.event === 'session-archive-sweep').length - before, 0, 'unrelated item events do not wake archived sessions');
  // Fixtures represent live, unconnected harness rows with no OS process, so stop needs no external process.
  const live = new ProcessTable(db);
  for (let i = 0; i < 8; i++) live.put({ name: `new-${i}`, harness: 'codex', role: null, model: null, cwd: root, pid: null, harnessId: null, sessionId: `new-id-${i}`, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' });
  live.close();
  const beforeStops = records.filter(r => r.event === 'session-archive-sweep').length;
  assert.equal(turn, 0, 'turn counter stays idle through startup and archive I/O');
  // Only the stop-coalescing assertion needs event-loop turn labels.
  let turnTimer: ReturnType<typeof setImmediate>;
  const nextTurn = () => { turn++; turnTimer = setImmediate(nextTurn); };
  nextTurn();
  try {
    human.batch(Array.from({ length: 8 }, (_, i) => ({ type: 'session.stop', id: `stop-${i}`, session: `new-${i}` })));
    await eventually('all protocol stops committed', () => human.frames.filter(f => f.type === 'result' && String(f.id).startsWith('stop-')).length === 8 || undefined);
    const stopped = human.frames.filter(f => String(f.id).startsWith('stop-'));
    assert.ok(stopped.every(f => f.ok), `stop frames succeeded: ${JSON.stringify(stopped.find(f => !f.ok))}`);
    await tick();
    const sweeps = records.filter(r => r.event === 'session-archive-sweep').slice(beforeStops);
    assert.ok(sweeps.length > 0, 'stops trigger cleanup');
    assert.equal(sweeps.length, new Set(sweeps.map(r => r.turn)).size, 'asynchronous stops produce at most one sweep in each event-loop tick');
  } finally { clearImmediate(turnTimer!); }
  const afterStops = turn;
  await tick();
  assert.equal(turn, afterStops, 'turn counter stops before teardown');
}

/** The same startup query-plan and coalescing proof at component and load scales. */
export async function inboxStartupWorkload(t: import('node:test').TestContext, scale: { processes: number; messagePairs: number; requests: number; events: number; turns: number }) {
  const database = sqliteProbe();
  const clock = new FakeClock();
  const root = await tempProject(t, 'cland-inbox-work-'), db = join(root, '.cland', 'hub.db');
  let stop = async () => {};
  onCleanup(t, () => stop());
  await mkdir(join(root, '.cland'), { recursive: true });
  const seed = new Store(db), ts = clock.now().toISOString();
  seed.createTopic('history', 'Answered history', null, ts);
  seed.createTopic('requests', 'Replied requests', null, ts);
  seed.createTopic('replies', 'Explicit replies', null, ts);
  seed.transaction(() => {
    for (let i = 0; i < scale.messagePairs; i++) {
      seed.record({ id: `report-${i}`, topic: 'history', from: 'aide', fromKind: 'agent', fromRole: 'aide', via: 'session', to: [], text: `Report ${i}`, ts }, [], Date.now());
      seed.record({ id: `answer-${i}`, topic: 'history', from: 'human', fromKind: 'human', via: 'session', to: [], text: `Answer ${i}`, ts }, [], Date.now());
    }
    for (let i = 0; i < scale.requests; i++) {
      seed.record({ id: `request-${i}`, topic: 'requests', from: 'aide', fromKind: 'agent', fromRole: 'aide', via: 'session', to: [], kind: 'request', request: 'review', subject: 'remembered-0', text: `Request ${i}`, ts }, [], Date.now());
      seed.record({ id: `reply-${i}`, topic: 'replies', from: 'human', fromKind: 'human', via: 'session', to: [], replyTo: `request-${i}`, text: `Reply ${i}`, ts }, [], Date.now());
    }
  });
  seed.close();
  const processes = new ProcessTable(db);
  for (let i = 0; i < scale.processes; i++) processes.put({ name: `remembered-${i}`, harness: 'codex', role: null, model: null, cwd: root, pid: null, harnessId: null, sessionId: `old-${i}`, harnessSessionId: null, startedAt: ts, status: 'stopped' });
  processes.close();

  let queries = 0, candidateRows = 0, inboxSql = '', topicSql = '';
  database.trace(t, function(sql, method, _bindings, result) {
    if (sql.includes('order by standing desc')) topicSql = sql;
    if (sql.startsWith('with latest_messages as') && method === 'all') {
      queries++;
      inboxSql = sql;
      candidateRows = (result as unknown[]).length;
    }
  });
  const daemon = await projectHub(t, root, {}, { openDatabase: database.open, clock, probes: 'fake', harnesses: 'fake', log: () => {} });
  const clients: Array<() => void> = [];
  stop = async () => { for (const close of clients) close(); await daemon.stop(); };
  const atServing = queries;
  t.diagnostic(`startup inbox queries at serving: ${atServing}`);
  assert.ok(atServing <= 3, `startup recomputed the inbox ${atServing} times for ${scale.processes} remembered processes`);
  await clock.advance(250);
  await eventually('initial inbox publication', () => queries > 0 || undefined);
  assert.ok(queries <= 3, `startup and its first publication used ${queries} inbox queries`);
  assert.ok(queries > 0, 'the native tracer saw an actual inbox query');
  assert.ok(daemon.discovery);
  const ui = await connectUi(t, daemon.discovery);
  clients.push(() => ui.close());
  const snapshot = await ui.request({ type: 'inbox.list' });
  assert.equal(snapshot.ok, true, snapshot.error);
  assert.equal((snapshot.value as Inbox).needsYou, 0, 'same-topic answers and cross-topic explicit replies leave no waiting rows');
  assert.ok(candidateRows <= 3, `a settled snapshot materialized ${candidateRows} retained candidates instead of current topic ends`);
  const planner = new DatabaseSync(db, { readOnly: true });
  try {
    for (const [name, sql] of [['inbox', inboxSql], ['topics', topicSql]]) {
      assert.ok(sql, `${name} was observed at the protocol boundary`);
      const plan = planner.prepare( `explain query plan ${sql}`).all() as Array<{ detail: string }>;
      t.diagnostic(`${name} query plan: ${JSON.stringify(plan.map(row => row.detail))}`);
      assert.ok(!plan.some(row => /^SCAN [mh](?: |$)/.test(row.detail)), `${name} scans retained message history`);
    }
  } finally { planner.close(); }
  const client = pipe(daemon);
  clients.push(() => client.close());
  client.send({ type: 'hello', protocol: 2, client: 'ui' });
  assert.equal(client.frames[0]?.type, 'welcome');
  await tick();
  for (let batch = 0; batch < 2; batch++) {
    const before = queries, frameCount = client.frames.length;
    client.batch(Array.from({ length: scale.events }, (_, i) => ({ type: 'topic.read', id: `read-${batch}-${i}`, topic: 'history', upTo: `answer-${i + batch * scale.events}` })));
    const replies = client.frames.slice(frameCount).filter(f => f.type === 'result');
    assert.equal(replies.length, scale.events, 'all event-producing writes completed in this input chunk');
    assert.ok(replies.every(f => f.ok === true));
    assert.equal(queries, before, 'no full inbox query runs synchronously per event');
    const started = clock.now().getTime();
    for (let turn = 0; turn < scale.turns; turn++) {
      client.send({ type: 'topic.read', id: `turn-${batch}-${turn}`, topic: 'history', upTo: `answer-${turn}` });
      await tick();
    }
    const allowance = Math.ceil((clock.now().getTime() - started) / 250) + 1;
    assert.ok(queries - before <= allowance, `cross-turn burst used ${queries - before} inbox rebuilds (budget ${allowance})`);
    await clock.advance(250);
    await eventually('coalesced inbox rebuild', () => queries > before || undefined);
  }
}

/** Same query-plan/coalescing proof at component and sustained burst scales. */
export async function verifierWorkload(t: import('node:test').TestContext, burstSize: number) {
  assert.ok(burstSize >= 2 && burstSize % 2 === 0, 'an even burst finishes on the newer request');

  const database = sqliteProbe();
  const clock = new FakeClock();
  const root = await tempProject(t, 'cland-verifier-work-'), db = join(root, '.cland', 'hub.db');
  await mkdir(join(root, '.cland'), { recursive: true });
  const seed = new Store(db), ts = clock.now().toISOString();
  seed.transaction(() => {
    for (let i = 0; i < 300; i++) seed.record({ id: `old-${i}`, from: 'old', fromKind: 'agent', via: 'session', to: [], text: 'review request T-1', ts }, [], Date.now());
  });
  seed.close();
  const daemon = await projectHub(t, root, {}, { openDatabase: database.open, clock, probes: 'fake', harnesses: 'fake', log: () => {} });
  const human = pipe(daemon), verifier = pipe(daemon);
  onCleanup(t, async () => { human.close(); verifier.close(); await daemon.stop(); });
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  await human.request({ type: 'role.set', id: 'role', session: 'verifier', role: 'reviewer' });
  verifier.send({ type: 'hello', protocol: 2, name: 'verifier', sessionId: 'verifier-id', cwd: root });
  await eventually('verifier hello', () => verifier.frames.some(f => f.type === 'welcome') || undefined);
  await human.request({ size: 'M', type: 'task.create', id: 'item', title: 'Burst verification' });
  const first = ((human.frames.find(f => f.id === 'item')!.value as { item: { id: string } }).item.id);
  const second = await human.request({ size: 'M', type: 'task.create', id: 'item-two', title: 'Newer burst request' });
  const item = (second.value as { item: { id: string } }).item.id;
  // Take the initial role clause before measuring request deliveries.
  for (const frame of verifier.frames.filter(f => f.type === 'role')) verifier.send({ type: 'ack', id: (frame.message as { id: string }).id });
  await tick();
  const table = new ProcessTable(db);
  table.put({ name: 'verifier', harness: 'codex', role: 'reviewer', model: null, cwd: root, pid: null, harnessId: null, sessionId: 'verifier-id', harnessSessionId: null, startedAt: ts, status: 'running' });
  table.close();
  await human.request({ type: 'subscribe', id: 'subscribe' });
  const prepare = database.prepare;
  let observing = false, messageReads = 0, pendingReads = 0;
  const scans: string[] = [];
  const scanPlans = new Map<string, boolean>();
  database.trace(t, function(sql, method, bindings) {
    if (observing && /^select|^with/i.test(sql.trim()) && /\b(?:from|join) messages\b/i.test(sql)) {
      messageReads++;
      // Schema and null-bound EXPLAIN inputs stay fixed; check each SQL shape once,
      // while counting every real query in all three delivery/list bursts below.
      let scan = scanPlans.get(sql);
      if (scan === undefined) {
        const explain = sql.replace(/:[a-z_]+/gi, '?');
        const plan = prepare.call(this, `explain query plan ${explain}`).all(...Array((explain.match(/\?/g) ?? []).length).fill(null)) as Array<{ detail: string }>;
        const aliases = [...sql.matchAll(/\b(?:from|join) messages(?:\s+(?!where\b|on\b|order\b|group\b|limit\b|join\b)([a-z_]+))?/gi)].map(m => m[1] ?? 'messages');
        scan = plan.some(row => aliases.some(alias => new RegExp(`^SCAN ${alias}(?: |$)`, 'i').test(row.detail)));
        scanPlans.set(sql, scan);
      }
      if (scan) scans.push(sql);
    }
    if (observing && sql === 'select value from meta where key = ?' && method === 'get'
      && bindings[0] === 'pending-verification:verifier-id') pendingReads++;
  });
  for (let burst = 0; burst < 3; burst++) {
    const before = human.frames.length, readsBefore = pendingReads;
    observing = true;
    for (let i = 0; i < burstSize; i++) {
      human.send({ type: 'topic.send', id: `send-${burst}-${i}`, topic: 'general', to: ['verifier'], text: burst === 2 ? `Ordinary report ${i}` : `review request ${i % 2 === 0 ? first : item}` });
      if (burst === 0 && i === 0) {
        const queued = await human.request({ type: 'session.list', id: 'before-acceptance' });
        assert.equal((queued.value as { processes: Array<{ pending?: unknown }> }).processes[0]?.pending, undefined, 'sending alone does not set pending work');
      }
      const frame = verifier.frames.findLast(f => f.type === 'deliver')!;
      verifier.send({ type: 'ack', id: (frame.message as { id: string }).id });
      human.send({ type: 'session.list', id: `list-${burst}-${i}` });
    }
    observing = false;
    assert.deepEqual(scans, [], 'delivery acceptance and session views use indexed message lookups only');
    // At most one capture and one explicit view per delivery, plus a fixed allowance.
    assert.ok(pendingReads - readsBefore <= (burst === 2 ? burstSize + 10 : burstSize * 2 + 10), `${burstSize} deliveries and ${burstSize} explicit views allow no synchronous whole-presence reads (${pendingReads - readsBefore} pending reads)`);
    await tick();
    const presence = human.frames.slice(before).filter(f => f.type === 'presence');
    assert.equal(presence.length, burst === 0 ? 1 : 0, 'changing requests publish only the final changed presence per tick');
    const updates = human.frames.slice(before).filter(f => f.type === 'session.process' && (f.process as { name: string }).name === 'verifier');
    assert.equal(updates.length, burst === 0 ? 1 : 0, 'a burst of changing requests publishes at most one final process per tick');
    const lists = human.frames.slice(before).filter(f => String(f.id).startsWith(`list-${burst}-`));
    assert.equal(lists.length, burstSize);
    assert.ok(lists.every((f, i) => f.ok === true && (f.value as { processes: Array<{ pending?: { item: string } }> }).processes[0]?.pending?.item === (burst === 2 || i % 2 !== 0 ? item : first)));
  }
  const status = await human.request({ type: 'hub.status', id: 'pending-status' });
  assert.deepEqual((status.value as { sessions: Array<{ pending?: { item: string; kind: string } }> }).sessions[0]!.pending, { item, kind: 'review' });
  assert.ok(messageReads > 0, 'native tracing observed actual delivery message lookups');
}
