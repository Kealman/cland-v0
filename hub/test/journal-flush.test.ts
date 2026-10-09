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
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'test' }));
  const request = (id: string, flushLogs = false) => conversation.receive(JSON.stringify({ type: 'hub.status', id, flushLogs }));
  request('barrier', true);
  assert.equal(answers.find(frame => frame.id === 'barrier'), undefined);
  request('ordinary');
  assert.equal(answers.find(frame => frame.id === 'ordinary')?.ok, true);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(answers.find(frame => frame.id === 'barrier')?.ok, true);
  gate = new Promise<void>(resolve => { release = resolve; });
  request('repeat', true);
  assert.equal(drains, 2, 'a repeated barrier never replays a cached status');
  assert.equal(answers.find(frame => frame.id === 'repeat'), undefined);
  t.mock.timers.tick(5000);
  await new Promise(resolve => setImmediate(resolve));
  const result = answers.find(frame => frame.id === 'repeat');
  assert.equal(result?.ok, false);
  assert.match(String(result?.error), /log drain exceeded 5000 ms/);
  request('after-timeout');
  assert.equal(answers.find(frame => frame.id === 'after-timeout')?.ok, true);
});
