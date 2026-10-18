import { archiveWorkload, inboxStartupWorkload, verifierWorkload } from './inbox-archive-workload.ts';
// T2: indexed query budgets through real frames and fixture-owned SQLite tracing.
import { sqliteProbe } from './sqlite-probe.ts';
import { FakeClock } from './fake-clock.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { Dispatcher } from '../src/hub/dispatch.ts';
import { createStdioEdge } from '../src/hub/stdio.ts';
import { eventually, projectHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { createHubBase, type HubBase } from '../src/hub/server.ts';
import { eventRow, type JournalRecord } from '../src/hub/journal.ts';
import { Tracker } from '../src/tracker/tracker.ts';

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

for (const kind of ['task', 'epic'] as const)
test(`a protocol stop burst does bounded indexed work despite unrelated retained ${kind} items`, async t => {
  const database = sqliteProbe();
  const clock = new FakeClock();
  const root = await tempProject(t, 'cland-stop-work-'), db = join(root, '.cland', 'hub.db');
  let stop = async () => {};
  onCleanup(t, () => stop());
  const tracker = new Tracker({ root, db });
  const actor = { id: 'human', name: 'human', role: null, human: true };
  for (let i = 0; i < 64; i++) {
    const item = await tracker.create(actor, { title: `Unrelated retained item ${i}`, kind });
    if (kind === 'epic' && i % 2 === 0) {
      const path = join(root, item.path);
      await writeFile(path, (await readFile(path, 'utf8')).replace('state: open', 'state: closed'));
    }
  }
  await tracker.rescanAsync();
  await tracker.stop();
  const daemon = await projectHub(t, root, {}, { openDatabase: database.open, clock, probes: 'fake', harnesses: 'fake', log: () => {} });
  const human = pipe(daemon);
  stop = async () => { human.close(); await daemon.stop(); };
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  await tick();
  const table = new ProcessTable(db);
  for (let i = 0; i < 8; i++) table.put({ name: `stop-${i}`, harness: 'codex', role: null, model: null, cwd: root, pid: null, harnessId: null, sessionId: `stop-id-${i}`, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' });
  table.close();
  const prepare = database.prepare;
  let queries = 0;
  database.mock(t, function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    if (args[0].includes('tracker_')) queries++;
    return prepare.apply(this, args);
  });
  human.batch(Array.from({ length: 8 }, (_, i) => ({ type: 'session.stop', id: `stop-${i}`, session: `stop-${i}` })));
  await eventually('all protocol stops committed', () => human.frames.filter(f => f.type === 'result' && String(f.id).startsWith('stop-')).length === 8 || undefined);
  const stopped = human.frames.filter(f => String(f.id).startsWith('stop-'));
  assert.ok(stopped.every(f => f.ok), `stop frames succeeded: ${JSON.stringify(stopped.find(f => !f.ok))}`);
  await tick();
  t.diagnostic(`stop-burst indexed queries: ${queries}`);
  assert.ok(queries < 1000, `eight stops hydrated unrelated retained items (${queries} indexed queries)`);
});

test('a task hold release reads bounded indexed work despite unrelated retained items', async t => {
  const database = sqliteProbe();
  const clock = new FakeClock();
  const root = await tempProject(t, 'cland-hold-work-'), db = join(root, '.cland', 'hub.db');
  let stop = async () => {};
  onCleanup(t, () => stop());
  const tracker = new Tracker({ root, db });
  const actor = { id: 'human', name: 'human', role: null, human: true };
  const target = await tracker.create(actor, { title: 'Hold target' });
  for (let i = 0; i < 64; i++) await tracker.create(actor, { title: `Unrelated item ${i}` });
  await tracker.stop();
  const daemon = await projectHub(t, root, {}, { openDatabase: database.open, clock, probes: 'fake', harnesses: 'fake', log: () => {} });
  const human = pipe(daemon), verifier = pipe(daemon);
  stop = async () => { human.close(); verifier.close(); await daemon.stop(); };
  human.send({ type: 'hello', protocol: 2, client: 'ui' });
  assert.equal((await human.request({ type: 'role.set', id: 'role', session: 'verifier', role: 'reviewer' })).ok, true);
  verifier.send({ type: 'hello', protocol: 2, name: 'verifier', sessionId: 'verifier-id', cwd: root });
  await eventually('verifier connected', () => verifier.frames.some(f => f.type === 'welcome') || undefined);
  await tick();
  const prepare = database.prepare;
  let queries = 0;
  database.mock(t, function(this: DatabaseSync, ...args: Parameters<typeof prepare>) {
    queries++;
    return prepare.apply(this, args);
  });
  const released = await verifier.request({ type: 'task.hold', id: 'release', item: target.id, release: true });
  assert.equal(released.ok, true, String(released.error));
  t.diagnostic(`hold-release indexed queries: ${queries}`);
  assert.ok(queries > 0, 'the native tracer observes indexed work');
  assert.ok(queries <= 100, `one hold release used ${queries} indexed queries for 64 unrelated items`);
});

test('archive startup batches stops and coalesces event bursts', t => archiveWorkload(t, {
  items: 16, messages: 16, processes: 8, events: 8,
}));

test('startup with settled retained history coalesces two protocol bursts', t => inboxStartupWorkload(t, {
  processes: 8, messagePairs: 16, requests: 4, events: 8, turns: 4,
}));


test('durable wait capture retains the original timestamp and archives a request resolved within its publication window', async t => {
  const database = sqliteProbe();
  const clock = new FakeClock();
  const root = await tempProject(t, 'cland-inbox-time-'), records: Array<Record<string, unknown>> = [];
  let stop = async () => {};
  onCleanup(t, () => stop());
  const daemon = await projectHub(t, root, {}, { openDatabase: database.open, clock, probes: 'fake', harnesses: 'fake', log: record => records.push(record) });
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
  await clock.advance(250);
  await eventually('persistent request captured', () => inspector.inboxWaits().some(w => w.id === message.id) || undefined);
  assert.equal(inspector.inboxWaits().find(w => w.id === message.id)?.since, message.ts, 'coalesced persistence preserves the actual wait start, rather than recording the recompute time');
  human.send({ type: 'topic.send', id: 'reply-persistent', topic: 'general', replyTo: message.id, text: 'Reviewed' });
  await clock.advance(250);
  await eventually('persistent request departure', () => inspector.inboxDepartures('1970-01-01T00:00:00.000Z').some(d => d.id === message.id && d.reason === 'replied') || undefined);

  send('transient', 'Resolved in the same tick');
  assert.equal(aide.frames.find(f => f.id === 'transient')?.ok, true);
  const transient = inspector.topicMessages('general', 10).find(m => m.text === 'Resolved in the same tick');
  assert.ok(transient);
  human.send({ type: 'topic.send', id: 'reply-transient', topic: 'general', replyTo: transient.id, text: 'Reviewed immediately' });
  assert.equal(human.frames.find(f => f.id === 'reply-transient')?.ok, true);
  await clock.advance(250);
  await eventually('transient request departure', () => inspector.inboxDepartures('1970-01-01T00:00:00.000Z').some(d => d.id === transient.id) || undefined);
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
  const client = pipe({ dispatcher: hub.dispatcher });
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


test('delivered verifier requests and session.list bursts never scan retained message history', t => verifierWorkload(t, 8));
