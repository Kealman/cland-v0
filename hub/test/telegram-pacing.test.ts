// T2: production gateway frames and a loopback fake API; all time is injected.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, tempProject, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeTelegram, fakeTelegramFixture, telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { TelegramOutbox } from '../src/remote/telegram-outbox.ts';
import { TelegramApi } from '../src/remote/telegram-api.ts';
import { FakeClock } from './fake-clock.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { onCleanup } from './process-cleanup.ts';

const pairing = { userId: '101', chatId: '101', guildId: null, name: 'Fixture human' };

test('twenty General sends survive a 429 complete and ordered with durable attempts and one-second pacing', { timeout: 10_000 }, async t => {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  owner.close(() => fake.close(), { startupOnly: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram pacing');
  config.remote.telegram = { enabled: true, format: 'entities' };
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const db = owner.store(join(root, '.cland/hub.db'));
  const state = db.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const hub = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 8 })).status, 200);
  for (let n = 1; n <= 20; n++) assert.equal((await coord.call<{ ok: boolean }>('send', {
    topic: 'general', kind: 'report', text: `burst ${n}`,
  })).ok, true);
  assert.equal(state.outbox().length, 20, 'every General send is durably queued');
  await until(() => state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left', { what: 'durable 429 non-delivery proof' });
  await clock.advance(7_999);
  let received = await telegramControl<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.deepEqual(received.body.messages, [], 'the rate-limited send cannot leave before retry_after');
  await clock.advance(1);
  for (let n = 1; n <= 20; n++) {
    await until(() => state.outbox().filter(job => job.state === 'sent').length === n, { what: `durable accepted burst ${n}` });
    if (n === 1) {
      const status = await ui.request({ type: 'remote.status' });
      assert.equal(status.ok, true, status.error);
      assert.equal((status.value as { remotes: Array<{ lastOutbound: string | null }> }).remotes[0]!.lastOutbound,
        '2026-10-16T12:00:08.000Z', 'an accepted send updates traffic before the remaining burst drains');
    }
    if (n < 20) await clock.advance(1_000);
  }
  await hub.stop();
  received = await telegramControl(fake.url, 'state');
  assert.deepEqual(received.body.messages.map(message => message.text), Array.from({ length: 20 }, (_, n) => `coord · report\nburst ${n + 1}`));
  const jobs = state.outbox();
  assert.equal(jobs.length, 20);
  assert.ok(jobs.every(job => job.state === 'sent'));
  assert.equal(state.attempts(jobs[0]!.id).length, 2);
  assert.deepEqual(jobs.flatMap(job => state.attempts(job.id)).map(attempt => attempt.at), [
    '2026-10-16T12:00:00.000Z', ...Array.from({ length: 20 }, (_, n) => new Date(Date.parse('2026-10-16T12:00:08Z') + n * 1_000).toISOString()),
  ]);
  assert.equal(clock.pending, 0);
});

async function queueFixture(t: import('node:test').TestContext) {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = fakeTelegramFixture(t, { clock });
  owner.close(() => native.close(), { startupOnly: true });
  const fake = await native.start();
  const db = owner.store(join(root, 'hub.db'));
  const state = db.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const queue = new TelegramOutbox(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
  owner.close(() => queue.stop());
  return { root, clock, fake, db, state, queue, owner, native };
}

async function fakeState(fake: { url: string }) {
  const response = await telegramControl<{
    messages: Array<{ message_id: number; chat: { id: number }; text: string }>;
    sends: Array<{ id: number; chat: string; at: number }>;
    maxInFlight: Record<string, number>;
  }>(fake.url, 'state');
  assert.equal(response.status, 200);
  return response.body;
}

test('a 429 holds new sends to every chat and caps retry_after at five minutes', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  const at = clock.now().getTime();
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 900 })).status, 200);
  const first = queue.send({ chat_id: '101', text: 'limited' });
  void first.catch(() => {});
  await until(() => state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left', { what: 'rate-limit refusal committed' });
  const other = queue.send({ chat_id: '202', text: 'other chat' }, { admission: 'old-chat' });
  const next = queue.send({ chat_id: '101', text: 'next in first chat' });
  void other.catch(() => {}); void next.catch(() => {});
  await clock.advance(299_999);
  assert.deepEqual((await fakeState(fake)).messages, []);
  await clock.advance(1);
  await until(() => state.outbox().filter(job => job.state === 'sent').length === 2, { what: 'both chats accepted at capped deadline' });
  await clock.advance(1_000);
  await Promise.all([first, other, next]);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.filter(message => message.chat.id === 101).map(message => message.text), ['limited', 'next in first chat']);
  assert.deepEqual(actual.sends.map(send => send.at - at).sort((a, b) => a - b), [0, 300_000, 300_000, 301_000]);
  assert.deepEqual(actual.maxInFlight, { '101': 1, '202': 1 });
  assert.equal(state.outbox().filter(job => job.state === 'missed').length, 0);
});

test('one request owns each chat while other chats run and cards overtake only queued ordinary sends', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' })).status, 200);
  const entered = fake.waitForHeldRequest('sendMessage');
  const first = queue.send({ chat_id: '101', text: 'in flight' });
  void first.catch(() => {});
  const held = await entered;
  const ordinary = queue.send({ chat_id: '101', text: 'ordinary' });
  const card = queue.send({ chat_id: '101', text: 'card' }, { kind: 'card', source: 'ask-1', ask: 'ask-1' });
  const other = queue.send({ chat_id: '202', text: 'independent' }, { admission: 'old-chat' });
  void ordinary.catch(() => {}); void card.catch(() => {}); void other.catch(() => {});
  await other;
  await clock.advance(1_000);
  let actual = await fakeState(fake);
  assert.deepEqual(actual.messages.map(message => message.text), ['independent']);
  assert.equal(actual.sends.filter(send => send.chat === '101').length, 1, 'the held request retains its chat after the pacing interval');
  const released = await telegramControl(fake.url, 'release-requests', { ids: [held.id] });
  assert.equal(released.status, 200);
  await until(() => state.outbox().filter(job => job.state === 'sent').length === 3, { what: 'in-flight send and then queued card committed' });
  const arrived = queue.send({ chat_id: '101', text: 'arrived during drain' });
  void arrived.catch(() => {});
  await clock.advance(1_000);
  await until(() => state.outbox().filter(job => job.state === 'sent').length === 4, { what: 'ordinary send committed' });
  await clock.advance(1_000);
  await Promise.all([first, ordinary, card, arrived]);
  actual = await fakeState(fake);
  assert.deepEqual(actual.messages.filter(message => message.chat.id === 101).map(message => message.text),
    ['in flight', 'card', 'ordinary', 'arrived during drain']);
  assert.deepEqual(actual.maxInFlight, { '101': 1, '202': 1 });
  const sentCard = actual.messages.find(message => message.text === 'card')!;
  assert.equal(state.message('101', String(sentCard.message_id))?.ask, 'ask-1');
});

test('rich rejection keeps every fallback part ahead of later General messages and maps each accepted part', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 400 })).status, 200);
  const first = queue.rich({ chat_id: '101', rich_message: { markdown: '**first**', skip_entity_detection: true } }, [
    { chat_id: '101', text: 'first 1/2' }, { chat_id: '101', text: 'first 2/2' },
  ], { kind: 'general', source: 'message-1' });
  const second = queue.send({ chat_id: '101', text: 'second' }, { kind: 'general', source: 'message-2' });
  void first.catch(() => {}); void second.catch(() => {});
  await until(() => state.outbox()[0]?.state === 'dropped', { what: 'rich intent durably superseded by plain parts' });
  for (let n = 1; n <= 3; n++) {
    await clock.advance(1_000);
    await until(() => state.outbox().filter(job => job.state === 'sent').length === n, { what: `accepted replacement or following send ${n}` });
  }
  await Promise.all([first, second]);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.map(message => message.text), ['first 1/2', 'first 2/2', 'second']);
  assert.deepEqual(actual.messages.map(message => state.message('101', String(message.message_id))?.message), ['message-1', 'message-1', 'message-2']);
  assert.equal(state.outbox().filter(job => job.state === 'missed').length, 0);
});

for (const stage of ['pacing delay', '429 delay', 'active request'] as const) test(`stop joins Telegram sends during ${stage} and leaves no timer or active writer`, { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  if (stage === 'pacing delay') await queue.send({ chat_id: '101', text: 'first' });
  else assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: stage === '429 delay' ? 429 : 500,
    ...(stage === '429 delay' ? { retry_after: 8 } : { response: 'hold' }) })).status, 200);
  const closed = stage === 'active request' ? fake.waitForConnectionClose('sendMessage') : null;
  void closed?.catch(() => {});
  const held = stage === 'active request' ? fake.waitForHeldRequest('sendMessage') : null;
  const sending = queue.send({ chat_id: '101', text: 'pending' }).then(() => 'sent', () => 'incomplete');
  if (held) await held;
  else await until(() => stage === '429 delay'
    ? state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left'
    : state.outbox().length === 2, { what: `durable pending ${stage}` });
  await queue.stop();
  if (closed) await closed;
  assert.equal(await sending, 'incomplete');
  assert.equal(clock.pending, 0);
  await clock.advance(300_000);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.map(message => message.text), stage === 'pacing delay' ? ['first'] : []);
  assert.throws(() => queue.send({ chat_id: '101', text: 'after stop' }));
});

test('a rich 429 retries the same rich request after the hold without falling back', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 429, retry_after: 8 })).status, 200);
  const sending = queue.rich({ chat_id: '101', rich_message: { markdown: '**rich**', skip_entity_detection: true } }, [
    { chat_id: '101', text: 'plain fallback' },
  ], { kind: 'general', source: 'rich-rate-limit' });
  void sending.catch(() => {});
  await until(() => state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left', { what: 'rich 429 proof persisted' });
  await clock.advance(7_999);
  assert.deepEqual((await fakeState(fake)).messages, []);
  await clock.advance(1);
  await sending;
  const actual = await telegramControl<{ requests: Array<{ method: string }>; messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.deepEqual(actual.body.requests.map(request => request.method), ['sendRichMessage', 'sendRichMessage']);
  assert.deepEqual(actual.body.messages.map(message => message.text), ['**rich**']);
});

for (const code of [401, 403]) for (const phase of ['rich', 'plain fallback'] as const) test(`a ${phase} ${code} stops the remote with one cause and never falls back further`, { timeout: 5_000 }, async t => {
  const { clock, fake, state, owner } = await queueFixture(t);
  state.setPairing(pairing);
  const notices: string[] = [];
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: state, notice: (cause, fix) => notices.push(`${cause}; ${fix}`) });
  owner.close(() => remote.stop());
  await remote.start(() => {});
  if (phase === 'plain fallback') assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 400 })).status, 200);
  assert.equal((await telegramControl(fake.url, 'fault', { method: phase === 'rich' ? 'sendRichMessage' : 'sendMessage', code, echoToken: true })).status, 200);
  const message = { id: 'fatal-rich', seq: 1, topic: 'general', from: 'agent', fromKind: 'agent' as const, via: 'session' as const,
    to: [], text: 'body', ts: clock.now().toISOString() };
  const frame = { type: 'message' as const, topic: { id: 'general', title: 'General', unread: 0, lastMessageAt: message.ts }, message };
  const refused = assert.rejects(Promise.resolve(remote.receive(frame)), code === 401 ? /wrong or revoked token.*set a new token/ : /bot blocked.*unblock the bot/);
  if (phase === 'plain fallback') {
    await until(() => state.outbox()[0]?.state === 'dropped', { what: 'rich formatting refusal before fatal plain fallback' });
    await clock.advance(1_000);
  }
  await refused;
  await remote.receive({ ...frame, message: { ...message, id: 'after-fatal' } });
  await remote.stop();
  assert.equal(notices.length, 1);
  assert.equal(remote.status().connected, false);
  const actual = await telegramControl<{ requests: Array<{ method: string }>; messages: unknown[] }>(fake.url, 'state');
  assert.deepEqual(actual.body.requests.filter(request => request.method.startsWith('send')).map(request => request.method), phase === 'rich' ? ['sendRichMessage'] : ['sendRichMessage', 'sendMessage']);
  assert.deepEqual(actual.body.messages, []);
  assert.equal(JSON.stringify(notices).includes(TELEGRAM_TEST_TOKEN), false);
});

for (const failure of ['5xx', 'disconnect', 'accepted without receipt'] as const) test(`a rich ${failure} stays fenced without fallback or replay`, { timeout: 5_000 }, async t => {
  const { fake, state, queue } = await queueFixture(t);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 500,
    ...(failure === '5xx' ? {} : { response: failure === 'disconnect' ? 'disconnect' : 'accept-disconnect' }) })).status, 200);
  await assert.rejects(queue.rich({ chat_id: '101', rich_message: { markdown: 'uncertain rich', skip_entity_detection: true } }, [
    { chat_id: '101', text: 'must not fall back' },
  ], { kind: 'general', source: 'uncertain-source' }));
  state.set('outbox.unavailable', null);
  await queue.resume();
  const actual = await telegramControl<{ requests: Array<{ method: string }>; messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.deepEqual(actual.body.requests.map(request => request.method), ['sendRichMessage']);
  assert.deepEqual(actual.body.messages.map(message => message.text), failure === 'accepted without receipt' ? ['uncertain rich'] : []);
  assert.equal(state.outbox().length, 1);
  assert.equal(state.attempts(state.outbox()[0]!.id)[0]?.outcome, 'unknown');
});

test('native remote tests and old-chat notices share General pacing and the bot-wide hold', { timeout: 5_000 }, async t => {
  const { clock, fake, state, owner } = await queueFixture(t);
  state.setPairing(pairing);
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
  owner.close(() => remote.stop());
  await remote.start(() => {});
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 429, retry_after: 8 })).status, 200);
  const message = { id: 'general-hold', seq: 1, topic: 'general', from: 'agent', fromKind: 'agent' as const, via: 'session' as const,
    to: [], text: 'General', ts: clock.now().toISOString() };
  const general = Promise.resolve(remote.receive({ type: 'message', topic: { id: 'general', title: 'General', unread: 0, lastMessageAt: message.ts }, message }));
  void general.catch(() => {});
  await until(() => state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left', { what: 'General 429 committed before notices' });
  const notice = remote.pairingReplaced({ ...pairing, chatId: '202' }, 'old-chat notice');
  const tested = remote.test(pairing, 'remote test');
  void notice.catch(() => {}); void tested.catch(() => {});
  await until(() => state.outbox().length === 3, { what: 'notice and remote test durably queued' });
  await clock.advance(7_999);
  assert.deepEqual((await fakeState(fake)).messages, []);
  await clock.advance(1);
  await until(() => state.outbox().filter(job => job.state === 'sent').length === 2, { what: 'General and old-chat notice accepted at hold deadline' });
  await clock.advance(1_000);
  await Promise.all([general, notice, tested]);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.filter(message => message.chat.id === 101).map(message => message.text), ['agent · message\nGeneral', 'remote test']);
  assert.deepEqual(actual.messages.filter(message => message.chat.id === 202).map(message => message.text), ['old-chat notice']);
  assert.deepEqual(actual.maxInFlight, { '101': 1, '202': 1 });
  await remote.stop();
});

for (const revoke of ['unpair', 'replace'] as const) for (const reopen of [false, true]) for (const delay of ['pacing', '429'] as const) test(`queued project content is fenced after ${revoke} during ${delay}${reopen ? ' across reopen' : ''}`, { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  state.setPairing(pairing);
  if (delay === 'pacing') await queue.send({ chat_id: '101', text: 'before revocation' });
  else assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 8 })).status, 200);
  const old = queue.send({ chat_id: '101', text: 'revoked project content' }, { kind: 'general', source: 'old-project-message' }).catch(() => {});
  const revoked = state.outbox().find(job => job.source === 'old-project-message')!;
  if (delay === '429') await until(() => state.attempts(revoked.id)[0]?.outcome === 'never-left', { what: 'queued old-chat rate refusal' });
  else assert.equal(revoked.state, 'queued');
  state.setPairing(revoke === 'unpair' ? null : { ...pairing, userId: '202', chatId: '202' });
  let current = queue;
  if (reopen) {
    await queue.stop(); await old;
    current = new TelegramOutbox(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
    owner.close(() => current.stop());
  }
  const resumed = current.resume();
  const notice = current.send({ chat_id: '101', text: 'authorized old-chat notice' }, { admission: 'old-chat' });
  const positive = revoke === 'replace'
    ? current.send({ chat_id: '202', text: 'new-chat project content' }, { kind: 'general', source: 'new-project-message' })
    : current.send({ chat_id: '202', text: 'stranger pairing reply' }, { admission: 'pairing' });
  void resumed.catch(() => {}); void notice.catch(() => {}); void positive.catch(() => {});
  await clock.advance(8_000);
  await until(() => ['sent', 'dropped'].includes(state.outbox().find(job => job.id === revoked.id)?.state ?? ''), { what: 'revoked intent settled' });
  assert.equal(state.outbox().find(job => job.id === revoked.id)?.state, 'dropped');
  await Promise.all([old, resumed, notice, positive]);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.filter(message => message.chat.id === 101).map(message => message.text),
    delay === 'pacing' ? ['before revocation', 'authorized old-chat notice'] : ['authorized old-chat notice']);
  assert.deepEqual(actual.messages.filter(message => message.chat.id === 202).map(message => message.text),
    [revoke === 'replace' ? 'new-chat project content' : 'stranger pairing reply']);
  assert.equal(state.outbox().find(job => job.id === revoked.id)?.state, 'dropped');
});

test('reopen retains the remaining bot-wide 429 deadline for every chat', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  const at = clock.now().getTime();
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 8 })).status, 200);
  const original = queue.send({ chat_id: '101', text: 'retry after reopen' }).catch(() => {});
  await until(() => state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left', { what: '429 deadline durable before stop' });
  await clock.advance(4_000);
  await queue.stop(); await original;
  const reopened = new TelegramOutbox(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
  owner.close(() => reopened.stop());
  const draining = reopened.resume();
  const other = reopened.send({ chat_id: '202', text: 'other chat after reopen' }, { admission: 'old-chat' });
  void draining.catch(() => {}); void other.catch(() => {});
  await clock.advance(3_999);
  assert.deepEqual((await fakeState(fake)).messages, [], 'reopen cannot shorten the hold for either chat');
  await clock.advance(1);
  await Promise.all([draining, other]);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.sends.map(send => send.at - at), [0, 8_000, 8_000]);
  assert.deepEqual(actual.messages.map(message => message.text).sort(), ['other chat after reopen', 'retry after reopen']);
});

test('reopen retains the remaining per-chat request spacing', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  const at = clock.now().getTime();
  await queue.send({ chat_id: '101', text: 'before reopen' });
  await clock.advance(400);
  await queue.stop();
  const reopened = new TelegramOutbox(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
  owner.close(() => reopened.stop());
  const next = reopened.send({ chat_id: '101', text: 'after reopen' });
  void next.catch(() => {});
  await clock.advance(599);
  assert.deepEqual((await fakeState(fake)).messages.map(message => message.text), ['before reopen']);
  await clock.advance(1);
  await next;
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.map(message => message.text), ['before reopen', 'after reopen']);
  assert.deepEqual(actual.sends.map(send => send.at - at), [0, 1_000]);
});

test('interruption between fallback parts rolls back the plan and recovery delivers the complete group once', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue, owner } = await queueFixture(t);
  const originalWrite = state.putOutbox.bind(state);
  let partWrites = 0;
  state.putOutbox = job => {
    const intent = job.payload as { part?: number };
    if (intent.part) {
      partWrites++;
      if (partWrites === 2) throw new Error('planted fallback planning interruption');
    }
    originalWrite(job);
  };
  onCleanup(t, () => { state.putOutbox = originalWrite; });
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 400 })).status, 200);
  const first = queue.rich({ chat_id: '101', rich_message: { markdown: 'rich rejected', skip_entity_detection: true } }, [
    { chat_id: '101', text: 'fallback 1/2' }, { chat_id: '101', text: 'fallback 2/2' },
  ], { kind: 'general', source: 'complete-source' }).catch(() => {});
  await until(() => partWrites === 2, { what: 'failure planted between persisted fallback parts' });
  await queue.stop(); await first;
  assert.equal(state.outbox().length, 1, 'no partial replacement survives the failed transaction');
  state.putOutbox = originalWrite;
  const reopened = new TelegramOutbox(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
  owner.close(() => reopened.stop());
  const resumed = reopened.resume();
  const later = reopened.send({ chat_id: '101', text: 'later General' }, { kind: 'general', source: 'later-source' });
  void resumed.catch(() => {}); void later.catch(() => {});
  // Recovering the definite 400 plans all replacements without another rich request.
  await clock.advance(1_000);
  await until(() => state.outbox()[0]?.state === 'dropped', { what: 'complete replacement and superseded proof committed on recovery' });
  for (let n = 1; n <= 3; n++) {
    if (n > 1) await clock.advance(1_000);
    await until(() => state.outbox().filter(job => job.state === 'sent').length === n, { what: `durable recovered part or following message ${n}` });
  }
  await Promise.all([resumed, later]);
  const actual = await fakeState(fake);
  assert.deepEqual(actual.messages.map(message => message.text), ['fallback 1/2', 'fallback 2/2', 'later General']);
  assert.deepEqual(actual.messages.map(message => state.message('101', String(message.message_id))?.message), ['complete-source', 'complete-source', 'later-source']);
  const requests = await telegramControl<{ requests: Array<{ method: string }> }>(fake.url, 'state');
  assert.equal(requests.body.requests.filter(request => request.method === 'sendRichMessage').length, 1);
  assert.equal(state.outbox().filter(job => job.state === 'missed').length, 0);
});

for (const failure of ['missed receipt', 'aborted receipt', 'rejected startup'] as const) test(`pacing fixture drains writers and closes SQLite after ${failure}`, { timeout: 5_000 }, async t => {
  const { root, fake, db, state, queue, owner, clock } = await queueFixture(t);
  const setupClock = new FakeClock();
  const setupAbort = new AbortController();
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' })).status, 200);
  const held = fake.waitForHeldRequest('sendMessage');
  const closed = fake.waitForConnectionClose('sendMessage');
  void closed.catch(() => {});
  const sending = queue.send({ chat_id: '101', text: 'held fixture writer' }).then(() => 'sent', () => 'incomplete');
  const request = await held;
  if (failure === 'rejected startup') {
    // The later openDatabase failure path is tracked separately as T-1351.
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), 'broken = [');
  }
  const starting = owner.start(root, {}, clock, {
    receipt: new Promise<void>(() => {}), clock: setupClock, signal: setupAbort.signal,
  });
  const rejected = assert.rejects(starting, failure === 'missed receipt' ? /setup receipt deadline/ : failure === 'aborted receipt' ? /setup cancelled/ : /Invalid TOML document: unfinished array/);
  let hub: Awaited<typeof owner.serving> | undefined;
  if (failure !== 'rejected startup') {
    hub = await within(owner.serving, 1_000);
    assert.equal(state.outbox()[0]?.state, 'sending', 'the producer remains owned while setup has no receipt');
    if (failure === 'missed receipt') await setupClock.advance(1_000);
    else setupAbort.abort(new Error('Telegram pacing fixture setup cancelled'));
  }
  await rejected;
  await owner.dispose();
  assert.equal((await closed).id, request.id);
  assert.equal(await sending, 'incomplete');
  if (hub) await hub.stopped;
  assert.throws(() => db.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
  assert.equal(clock.pending, 0);
  assert.equal(setupClock.pending, 0);
  assert.deepEqual((await fakeState(fake)).messages, []);
});

test('delivery reactions wait behind the bot-wide 429 hold and ordinary sends in per-chat order', { timeout: 5_000 }, async t => {
  const { clock, fake, state, queue } = await queueFixture(t);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 8 })).status, 200);
  const sending = queue.send({ chat_id: '101', text: 'limited send' });
  void sending.catch(() => {});
  await until(() => state.attempts(state.outbox()[0]!.id)[0]?.outcome === 'never-left', { what: 'send 429 before reaction admission' });
  const stored = queue.react({ chat_id: '101', message_id: 77, reaction: [{ type: 'emoji', emoji: '👌' }] });
  const seen = queue.react({ chat_id: '101', message_id: 77, reaction: [{ type: 'emoji', emoji: '👀' }] });
  void stored.catch(() => {}); void seen.catch(() => {});
  await clock.advance(7_999);
  let actual = await telegramControl<{ requests: Array<{ method: string; params: { reaction?: unknown } }> }>(fake.url, 'state');
  assert.equal(actual.body.requests.filter(request => request.method === 'setMessageReaction').length, 0);
  await clock.advance(1);
  await until(() => state.outbox().filter(job => job.state === 'sent').length === 1, { what: 'limited send accepted before feedback' });
  await clock.advance(1_000);
  await until(() => state.outbox().filter(job => job.state === 'sent').length === 2, { what: 'stored reaction accepted' });
  await within(stored, 1_000, undefined, () => new Error('accepted reaction receipt waited for later queued feedback'));
  await clock.advance(1_000);
  await Promise.all([sending, stored, seen]);
  actual = await telegramControl(fake.url, 'state');
  assert.deepEqual(actual.body.requests.map(request => request.method), ['sendMessage', 'sendMessage', 'setMessageReaction', 'setMessageReaction']);
  assert.deepEqual(actual.body.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params.reaction),
    [[{ type: 'emoji', emoji: '👌' }], [{ type: 'emoji', emoji: '👀' }]]);
  assert.deepEqual((await fakeState(fake)).maxInFlight, { '101': 1 });
});

for (const interruption of ['abort', 'missing startup deadline'] as const) test(`pre-serving held getMe ${interruption} releases acquisition before joining startup`, { timeout: 5_000 }, async t => {
  const { root, fake, db, owner, clock, native } = await queueFixture(t);
  const setupClock = new FakeClock();
  const setupAbort = new AbortController();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Held acquisition');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'getMe', code: 500, response: 'hold' })).status, 200);
  // queueFixture registered this fake's startup release through the same owner.
  const entered = fake.waitForHeldRequest('getMe');
  const starting = owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock, { clock: setupClock, signal: setupAbort.signal });
  void starting.catch(() => {});
  try {
    const request = await within(entered, 1_000);
    const rejected = assert.rejects(within(starting, 1_000, undefined,
      () => new Error('pre-serving setup observer did not settle')), interruption === 'abort' ? /cancel held acquisition/ : /setup receipt deadline reached/);
    if (interruption === 'abort') setupAbort.abort(new Error('cancel held acquisition'));
    else await setupClock.advance(1_000);
    await rejected;
    const lateHub = await within(owner.serving, 1_000);
    await within(lateHub.stopped, 1_000);
    assert.equal(request.method, 'getMe');
    assert.deepEqual(native.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
    assert.throws(() => db.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
    assert.equal(clock.now().toISOString(), '2026-10-16T12:00:00.000Z', 'the behavior clock never supplies native cleanup');
    assert.equal(clock.pending, 0);
    assert.equal(setupClock.pending, 0);
  } finally {
    // Emergency release keeps the red control finite if acquisition cancellation regresses.
    await fake.close();
    await owner.dispose();
  }
});
