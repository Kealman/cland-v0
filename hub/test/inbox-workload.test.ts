// Real project startup and the JSON-lines protocol; native SQLite tracing observes work without replacing it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
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

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function pipe(daemon: Daemon) {
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


test('durable wait capture is deferred one tick, retains the original timestamp, and never captures a wait resolved within that tick', async t => {
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
  assert.ok(!inspector.inboxDepartures('1970-01-01T00:00:00.000Z').some(d => d.id === transient.id), 'a wait settled before the first recompute never enters the durable inbox archive');
  assert.ok(!records.some(r => r.event === 'inbox-departure' && r.id === transient.id));
});
