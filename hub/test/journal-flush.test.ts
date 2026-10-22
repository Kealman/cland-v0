// T1: dispatcher/core/store assertions run in-process with deterministic time.
import { completeJournalLines } from './journal-lines.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHubBase } from '../src/hub/server.ts';
import { PROTOCOL_VERSION, type HubFrame } from '../src/protocol.ts';

test('synchronous control exceptions return failed results and the same connection keeps serving', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const status = () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root: '', startedAt: '', uptimeMs: 0 });
  const control = { status, stop: () => {}, reload: async () => ({ loadedAt: '', sourceCommit: null, applied: [], warnings: [] }), flushLogs: async () => {} };
  const hub = createHubBase({ secret: 'test', guard: { now: () => 0 }, control });
  t.after(() => hub.close());
  const answers: HubFrame[] = [];
  const conversation = hub.dispatcher.open({
    send: frame => { answers.push(frame); },
    close: () => assert.fail('a handler exception must not close the connection'),
    isOpen: () => true,
  }, { authenticated: false, edge: 'socket' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, secret: 'test', client: 'test' }));
  for (const [method, request] of [
    ['status', { type: 'hub.status' }],
    ['reload', { type: 'hub.reload' }],
    ['flushLogs', { type: 'hub.status', flushLogs: true }],
    ['stop', { type: 'hub.stop' }],
  ] as const) {
    const injected = t.mock.method(control, method, () => { throw new Error(`${method} collector failed`); });
    const id = `failed-${method}`;
    conversation.receive(JSON.stringify({ ...request, id }));
    // Cross the drain deadline: a failed invocation must leave no rejecting timer behind.
    t.mock.timers.tick(5000);
    assert.deepEqual(answers.filter(frame => 'id' in frame && frame.id === id), [
      { type: 'result', id, ok: false, error: `${method} collector failed` },
    ]);
    injected.mock.restore();
    const next = `after-${method}`;
    conversation.receive(JSON.stringify({ type: 'hub.status', id: next }));
    const result = answers.find(frame => frame.type === 'result' && frame.id === next);
    assert.equal(result?.type === 'result' && result.ok, true);
  }
  conversation.receive(JSON.stringify({ type: 'hub.stop', id: 'normal-stop' }));
  assert.deepEqual(answers.filter(frame => 'id' in frame && frame.id === 'normal-stop'), [
    { type: 'result', id: 'normal-stop', ok: true, value: { stopping: true } },
  ]);
});

test('a log drain barrier waits, drains again on repetition, and times out while ordinary status stays responsive', async t => {
  let release!: () => void;
  let gate = new Promise<void>(resolve => { release = resolve; });
  let drains = 0;
  // This dispatcher proof serves no project: a root would install executor sweep services.
  const hub = createHubBase({ secret: 'test', guard: { now: () => 0 }, control: {
    status: () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root: '', startedAt: '', uptimeMs: 0 }),
    stop: () => {}, flushLogs: () => { drains++; return gate; },
  } });
  t.after(() => hub.close());
  t.after(() => release());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const answers: Array<Record<string, unknown>> = [];
  const pending = new Map<string, (frame: Record<string, unknown>) => void>();
  const conversation = hub.dispatcher.open({ send: frame => {
    answers.push(frame);
    if (frame.type === 'result') { pending.get(frame.id)?.(frame); pending.delete(frame.id); }
  }, close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'test' }));
  const request = (id: string, flushLogs = false) => new Promise<Record<string, unknown>>(resolve => {
    pending.set(id, resolve);
    conversation.receive(JSON.stringify({ type: 'hub.status', id, flushLogs }));
  });
  const barrier = request('barrier', true);
  assert.equal(answers.find(frame => frame.id === 'barrier'), undefined);
  assert.equal((await request('ordinary')).ok, true);
  release();
  assert.equal((await barrier).ok, true);
  gate = new Promise<void>(resolve => { release = resolve; });
  const repeat = request('repeat', true);
  assert.equal(drains, 2, 'a repeated barrier never replays a cached status');
  assert.equal(answers.find(frame => frame.id === 'repeat'), undefined);
  t.mock.timers.tick(5000);
  const result = await repeat;
  assert.equal(result?.ok, false);
  assert.match(String(result?.error), /log drain exceeded 5000 ms/);
  assert.equal((await request('after-timeout')).ok, true);
});

// A producer may start another append after the barrier has drained its prefix.
test('live journal observations defer every unfinished tail and retain malformed complete records', () => {
  const first = '{"event":"event-delivery","id":"message"}\n';
  const next = '{"event":"injected","id":"message"}\n';
  for (let end = 0; end < next.length; end++) {
    const records = completeJournalLines(first + next.slice(0, end)).map(line => JSON.parse(line));
    assert.deepEqual(records, [{ event: 'event-delivery', id: 'message' }]);
  }
  assert.deepEqual(completeJournalLines(first + next).map(line => JSON.parse(line)), [
    { event: 'event-delivery', id: 'message' }, { event: 'injected', id: 'message' },
  ]);
  assert.throws(() => completeJournalLines(first + '{broken}\n').map(line => JSON.parse(line)), SyntaxError);
});
