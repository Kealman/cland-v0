// T2: production frame/fake Bot API, adapter replacement after graceful stop.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voiceFixture } from './telegram-voice-fixture.ts';
import { connectUi, inProcessSpoke, until } from './harness.ts';
import { control } from './telegram-polling-fixture.ts';
import type { TopicMessage, RemoteStatusResult } from '../src/protocol.ts';

for (const delay of [30000, 240000]) test(`Telegram planned stop catches input and cards after ${delay} ms without failure notices`, async t => {
  const f = await voiceFixture(t);
  const env = { CLAND_TELEGRAM_API_ROOT: f.fake.url };
  const first = await f.start(env);
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const ask = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Restart safely?', options: ['Yes'] });
  await f.clock.advance(250);
  await f.drive(until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'old card mapping', timeoutMs: 1500 }));
  const old = f.state.messagesForAsk(ask.ask)[0]!.messageId;
  await coord.close(); await first.stop();
  assert.ok(f.state.get('telegram.outage'), 'graceful stop persists recovery boundary');
  await control(f.fake.url, 'update', { message: { message_id: 900, date: Math.floor(f.clock.now().getTime() / 1000),
    chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Human' }, text: 'During planned stop' } });
  await f.clock.advance(delay);
  const second = await f.start(env);
  const ui = await connectUi(t, second.discovery, 'nvim');
  const history = async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  await f.drive(until(async () => f.state.get('telegram.outage') === null && (await history()).some(m => m.text.startsWith('During planned stop')),
    { what: 'planned restart recovery committed', timeoutMs: 2000 }));
  const rows = await history();
  assert.equal(rows.filter(m => m.text.startsWith('During planned stop')).length, 1);
  assert.match(rows.find(m => m.text.startsWith('During planned stop'))!.text, /written on Telegram at .*; the hub was down until/);
  assert.equal(rows.some(m => /Telegram remote (offline|recovered)/.test(m.text)), false);
  const status = (await ui.request({ type: 'remote.status' })).value as RemoteStatusResult;
  assert.equal(status.remotes[0]!.connection, 'connected'); assert.equal(status.remotes[0]!.reason, null);
  const native = await control<{ messages: Array<{ message_id: number; text: string }> }>(f.fake.url, 'state');
  assert.equal(f.state.messagesForAsk(ask.ask).length, delay === 30000 ? 1 : 2);
  if (delay === 240000) assert.match(native.messages.find(m => String(m.message_id) === old)!.text, /↓ Re-sent below/);
  await second.stop();
});

for (const aborted of [false, true]) test(`Integrated remotes startup ${aborted ? 'aborted' : 'omitted'} receipt drains native owners`, async t => {
  const { remotesFixture } = await import('./remotes-fixture.ts');
  const f = await remotesFixture(t);
  const abort = new AbortController();
  if (aborted) abort.abort(new Error('Controlled setup abort'));
  const missing = new Promise<void>(() => {});
  const rejected = assert.rejects(f.start({ receipt: missing, signal: abort.signal }),
    aborted ? /Controlled setup abort/ : /setup receipt deadline reached/);
  await rejected;
  await f.exchange.close();
  const tg = f.tgOwner.receipts(), dc = f.exchange.fake.receipts();
  assert.equal(tg.closed, true); assert.equal(tg.connections, 0); assert.equal(tg.handlers, 0);
  assert.equal(dc.closed, true); assert.equal(dc.connections, 0); assert.equal(dc.handlers, 0);
  assert.equal(f.owner.observations(), 0); assert.equal(f.exchange.pending(), 0); assert.equal(f.clock.pending, 0);
  assert.throws(() => f.store.remotes.forMessenger('telegram').get('telegram.outage'), /closed|not open/);
});
