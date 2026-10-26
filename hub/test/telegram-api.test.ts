// T2: the plain-fetch client at a real loopback fake Bot API; no hub or child process.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelegramApi, TelegramError } from '../src/remote/telegram-api.ts';
import { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import * as telegramFakes from './fakes/telegram/fake-api.ts';
import { within } from '../src/executor/droplet/deadline.ts';

async function control<T>(root: string, operation: string, params?: object): Promise<T> {
  const response = await telegramControl<T>(root, operation, params);
  assert.equal(response.status, 200, `fake control ${operation} failed`);
  return response.body;
}

test('Telegram API override sends to the fake bot', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });

  assert.deepEqual(await api.getMe(), {
    id: 123456789, is_bot: true, first_name: 'cland fixture', username: 'cland_fixture_bot',
  });
  const sent = await api.sendMessage({ chat_id: 101, text: 'client boundary receipt' });
  assert.equal(sent.message_id, 1);
  assert.equal(sent.chat.id, 101);
  assert.equal(sent.from?.is_bot, true);
  assert.equal(sent.text, 'client boundary receipt');

  const response = await telegramControl<{ messages: Array<{ message_id: number; text?: string }> }>(fake.url, 'state');
  assert.equal(response.status, 200);
  const state = response.body;
  assert.deepEqual(state.messages.map(message => ({ id: message.message_id, text: message.text })), [
    { id: 1, text: 'client boundary receipt' },
  ]);
});

test('Telegram provider errors retain safe facts without a token or fetch cause', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const fault = await telegramControl(fake.url, 'fault', { method: 'sendMessage', code: 400, echoToken: true });
  assert.equal(fault.status, 200);
  await assert.rejects(api.sendMessage({ chat_id: 101, text: 'forced refusal' }), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.method, 'sendMessage');
    assert.equal(error.code, 400);
    assert.match(error.description, /\[redacted\]/);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    assert.equal((String(error) + error.stack + JSON.stringify(error)).includes(TELEGRAM_TEST_TOKEN), false,
      'all diagnostic surfaces must be token-free');
    return true;
  });
  const state = await telegramControl(fake.url, 'state');
  assert.equal(state.status, 200);
  const captured = state.text;
  assert.equal(captured.includes(TELEGRAM_TEST_TOKEN), false, 'fake receipts must not retain token-bearing request paths');
});

test('Telegram validates credentials before parsing a root that could echo them', () => {
  const token = 'malformed-made-up-private-token';
  assert.throws(() => new TelegramApi(token, { apiRoot: `broken:${token}` }), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'telegram.token: invalid token format (at most 80 characters)');
    assert.equal(String(error.stack).includes(token), false);
    return true;
  });
});

test('Telegram fake delivers human and stranger messages until the offset confirms them', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'say', { user: 'human', text: 'human says hello' });
  await control(fake.url, 'say', { user: 'stranger', text: 'stranger says hello' });
  const updates = await api.getUpdates({ timeout: 0, allowed_updates: ['message'] });
  assert.deepEqual(updates.map(update => ({ id: update.update_id, user: update.message?.from?.id,
    chat: update.message?.chat.id, text: update.message?.text })), [
    { id: 1, user: 101, chat: 101, text: 'human says hello' },
    { id: 2, user: 202, chat: 202, text: 'stranger says hello' },
  ]);
  assert.deepEqual(await api.getUpdates({ timeout: 0, allowed_updates: ['message'] }), updates,
    'reading updates alone must not acknowledge them');
  assert.deepEqual(await api.getUpdates({ offset: 3, timeout: 0, allowed_updates: ['message'] }), []);
});

test('Telegram fake replays the exact duplicate update id and message', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'say', { text: 'deliver twice' });
  await control(fake.url, 'duplicate', { update_id: 1 });
  const updates = await api.getUpdates({ timeout: 0, allowed_updates: ['message'] });
  assert.equal(updates.length, 2);
  assert.deepEqual(updates.map(update => [update.update_id, update.message?.message_id, update.message?.text]), [
    [1, 1, 'deliver twice'], [1, 1, 'deliver twice'],
  ]);
});

test('Telegram fake delivers a blocked-bot membership update', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'membership', { user: 'human', status: 'kicked' });
  const updates = await api.getUpdates({ timeout: 0, allowed_updates: ['my_chat_member'] });
  assert.equal(updates.length, 1);
  const membership = updates[0]!.my_chat_member;
  assert.equal(membership?.chat.id, 101);
  assert.equal(membership?.from.id, 101);
  assert.equal(membership?.old_chat_member.status, 'member');
  assert.equal(membership?.new_chat_member.status, 'kicked');
  assert.equal(membership?.new_chat_member.user.is_bot, true);
});

test('Telegram fake rejects a rich message without accepting the send', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'fault', { method: 'sendRichMessage', code: 400 });
  await assert.rejects(api.sendRichMessage({ chat_id: 101, rich_message: { markdown: '# Report', skip_entity_detection: true } }), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.method, 'sendRichMessage');
    assert.equal(error.code, 400);
    return true;
  });
  assert.equal((await control<{ messages: unknown[] }>(fake.url, 'state')).messages.length, 0);
  const fallback = await api.sendMessage({ chat_id: 101, text: 'Report' });
  assert.equal(fallback.text, 'Report');
  assert.equal((await control<{ messages: unknown[] }>(fake.url, 'state')).messages.length, 1);
  const rich = await api.sendRichMessage({ chat_id: 101, rich_message: { markdown: '# Accepted', skip_entity_detection: true } });
  assert.equal(rich.message_id, 2);
  const state = await control<{ requests: Array<{ method: string; params: object }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.at(-1), { method: 'sendRichMessage',
    params: { chat_id: 101, rich_message: { markdown: '# Accepted', skip_entity_detection: true } },
  });
});

test('Telegram API preserves retry_after on the fake bot-wide flood wait', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 8 });
  await assert.rejects(api.sendMessage({ chat_id: 101, text: 'rate limited' }), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 429);
    assert.equal(error.retryAfter, 8);
    return true;
  });
  assert.equal((await control<{ messages: unknown[] }>(fake.url, 'state')).messages.length, 0);
  assert.equal((await api.sendMessage({ chat_id: 101, text: 'retry after pacing' })).message_id, 1);
});

test('Telegram fake exposes an injected 409 as a conflict', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'fault', { method: 'getUpdates', code: 409 });
  await assert.rejects(api.getUpdates({ timeout: 0, allowed_updates: ['message'] }), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 409);
    assert.equal(error.method, 'getUpdates');
    return true;
  });
  assert.equal((await api.getMe()).username, 'cland_fixture_bot');
});

test('Telegram stalled poll retains its receipt until the caller aborts', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  await control(fake.url, 'stall', { enabled: true });
  const abort = new AbortController();
  t.after(() => abort.abort());
  const observed = fake.waitForPoll();
  const poll = api.getUpdates({ timeout: 30, allowed_updates: ['message', 'my_chat_member'] }, { signal: abort.signal });
  const refused = assert.rejects(poll, error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 0);
    assert.equal((String(error) + JSON.stringify(error) + error.stack).includes(TELEGRAM_TEST_TOKEN), false);
    return true;
  });
  const receipt = await observed;
  assert.equal(receipt.stalled, true);
  assert.deepEqual(receipt.params, { timeout: 30, allowed_updates: ['message', 'my_chat_member'] });
  const drained = fake.waitForPollClose(receipt.id);
  abort.abort(new Error(`caller cancellation ${TELEGRAM_TEST_TOKEN}`));
  await refused;
  await drained;
  assert.deepEqual((await control<{ pendingPolls: unknown[] }>(fake.url, 'state')).pendingPolls, []);
});

test('Telegram HTTP deadline exceeds a 50 second stalled poll and drains its timer', { timeout: 5_000 }, async t => {
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock });
  await control(fake.url, 'stall', { enabled: true });
  const observed = fake.waitForPoll();
  const poll = api.getUpdates({ timeout: 50, allowed_updates: ['message'] }, { signal: t.signal });
  const refused = assert.rejects(poll, error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 0);
    assert.equal(error.method, 'getUpdates');
    return true;
  });
  const receipt = await observed;
  await clock.advance(64_999);
  const state = await control<{ pendingPolls: Array<{ id: number }> }>(fake.url, 'state');
  assert.deepEqual(state.pendingPolls.map(poll => poll.id), [receipt.id]);
  const drained = fake.waitForPollClose(receipt.id);
  await clock.advance(1);
  await refused;
  await drained;
  assert.equal(clock.pending, 0);
  assert.deepEqual((await control<{ pendingPolls: unknown[] }>(fake.url, 'state')).pendingPolls, []);
});

test('Telegram refuses redirects and malformed provider errors without raw transport data', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  for (const response of ['redirect', 'invalid-json', 'malformed-error', 'disconnect']) {
    await control(fake.url, 'fault', { method: 'getMe', code: response === 'redirect' ? 302 : 500, response });
    await assert.rejects(api.getMe(), error => {
      assert.ok(error instanceof TelegramError);
      assert.equal(error.method, 'getMe');
      assert.equal(error.code, ['redirect', 'disconnect'].includes(response) ? 0 : 500);
      assert.equal((String(error) + error.stack + JSON.stringify(error)).includes(TELEGRAM_TEST_TOKEN), false);
      assert.equal(Object.hasOwn(error, 'cause'), false);
      return true;
    });
  }
  assert.equal((await control<{ redirectsFollowed: number }>(fake.url, 'state')).redirectsFollowed, 0);
  assert.equal((await api.getMe()).username, 'cland_fixture_bot');
});

test('Telegram fake drains missed and aborted setup through its pre-registered owner', async t => {
  for (const mode of ['missed', 'aborted'] as const) {
    const setupClock = new FakeClock();
    const abort = new AbortController();
    const fixture = telegramFakes.fakeTelegramFixture(t, { setupClock, publishListening: false, signal: abort.signal });
    const listening = fixture.listening();
    const setup = fixture.start();
    const refused = assert.rejects(setup, mode === 'missed' ? /listening receipt deadline reached/ : /setup aborted/);
    await listening;
    if (mode === 'missed') await setupClock.advance(1_000);
    else abort.abort();
    await within(refused, 1_500);
    await fixture.close();
    assert.deepEqual(fixture.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
    assert.equal(setupClock.pending, 0);
  }
});

test('Telegram fake observes a native bind error and closes through the same owner', async t => {
  const occupied = await fakeTelegram(t);
  const fixture = telegramFakes.fakeTelegramFixture(t, { port: Number(new URL(occupied.url).port) });
  await assert.rejects(fixture.start(), /listen failed: EADDRINUSE/);
  await fixture.close();
  assert.deepEqual(fixture.receipts(), { listening: false, closed: true, connections: 0, handlers: 0, nativeError: 'EADDRINUSE' });
});
