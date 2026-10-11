import test from 'node:test';
import assert from 'node:assert/strict';
import { createHubBase } from '../src/hub/server.ts';

test('a log drain barrier waits, drains again on repetition, and times out while ordinary status stays responsive', async t => {
  let release!: () => void;
  let gate = new Promise<void>(resolve => { release = resolve; });
  let drains = 0;
  const hub = createHubBase({ secret: 'test', guard: { now: () => 0 }, control: {
    status: () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root: '/', startedAt: '', uptimeMs: 0 }),
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
