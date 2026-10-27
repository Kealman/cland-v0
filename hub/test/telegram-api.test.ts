// T2: the plain-fetch client at a real loopback fake Bot API; no hub or child process.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelegramApi, TelegramError, type TgMessage, type TgUpdate } from '../src/remote/telegram-api.ts';
import { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import * as telegramFakes from './fakes/telegram/fake-api.ts';
import { within } from '../src/executor/droplet/deadline.ts';

async function control<T>(root: string, operation: string, params?: object): Promise<T> {
  const response = await telegramControl<T>(root, operation, params);
  assert.equal(response.status, 200, `fake control ${operation} failed`);
  return response.body;
}

test('Telegram fake captures only its declared fictional public origin and still scrubs credential URLs', async t => {
  const origin = 'https://workbench.example.invalid';
  const fake = await fakeTelegram(t, { publicOrigin: origin });
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const sent = await api.sendMessage({ chat_id: 101, text: `${origin}\n${origin}/auth?token=synthetic-only\nBearer synthetic-only` });
  assert.equal(sent.text, `${origin}\n[redacted]\n[redacted]`);
  const state = await control<{ messages: TgMessage[]; requests: Array<{ method: string; params: { text?: string } }> }>(fake.url, 'state');
  assert.equal(state.messages[0]!.text, sent.text);
  assert.equal(state.requests.find(row => row.method === 'sendMessage')!.params.text, sent.text);
  for (const publicOrigin of [`${origin}/auth?token=synthetic-only`, 'https://user:synthetic-only@workbench.example.invalid', 'https://example.com']) {
    assert.throws(() => telegramFakes.fakeTelegramFixture(t, { publicOrigin }), /fake public origin must be/);
  }
});

test('Telegram card keyboard preserves eleven rows and a press identifies its message and presser', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const reply_markup = { inline_keyboard: Array.from({ length: 11 }, (_, i) => [
    { text: `Choice ${i + 1}`, callback_data: `opaque-${i + 1}`, style: 'primary' as const },
  ]) };
  const sent = await api.sendMessage({ chat_id: 101, text: 'Choose', reply_markup });
  assert.deepEqual(sent.reply_markup, reply_markup);
  assert.deepEqual((await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages, [sent]);
  const pressed = await control<TgUpdate>(fake.url, 'press', {
    chat_id: 101, message_id: sent.message_id, row: 10, column: 0, user: 'stranger',
  });
  const updates = await api.getUpdates({ timeout: 0, allowed_updates: ['callback_query'] });
  assert.deepEqual(updates, [pressed]);
  assert.deepEqual(updates[0]?.callback_query?.message, sent);
  assert.equal(updates[0]?.callback_query?.from.id, 202);
  assert.equal(updates[0]?.callback_query?.data, 'opaque-11');
  assert.equal(typeof updates[0]?.callback_query?.id, 'string');
});

test('Telegram callback answers expire after 150 seconds on the fake clock', { timeout: 5_000 }, async t => {
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const sent = await api.sendMessage({ chat_id: 101, text: 'Choose', reply_markup: {
    inline_keyboard: [[{ text: 'Yes', callback_data: 'opaque' }]],
  } });
  const press = async () => (await control<TgUpdate>(fake.url, 'press', {
    chat_id: 101, message_id: sent.message_id, row: 0, column: 0,
  })).callback_query!.id;
  const first = await press();
  const second = await press();
  await clock.advance(150_000);
  assert.equal(await api.answerCallbackQuery({ callback_query_id: first, text: 'Stored', show_alert: false }), true);
  await clock.advance(1_000);
  await assert.rejects(api.answerCallbackQuery({ callback_query_id: second, text: 'Too late', show_alert: true }), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 400);
    assert.match(error.description, /query is too old/);
    return true;
  });
  const requests = (await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state')).requests;
  assert.deepEqual(requests.filter(request => request.method === 'answerCallbackQuery').map(request => request.params), [
    { callback_query_id: first, text: 'Stored', show_alert: false },
    { callback_query_id: second, text: 'Too late', show_alert: true },
  ]);
});

test('Telegram keyboard limits count UTF-8 bytes and silently cap rows and total buttons', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const button = { text: 'Choose', callback_data: 'é'.repeat(32) };
  const accepted = await api.sendMessage({ chat_id: 101, text: '64 bytes', reply_markup: { inline_keyboard: [[button]] } });
  assert.deepEqual(accepted.reply_markup, { inline_keyboard: [[button]] });
  await assert.rejects(api.sendMessage({ chat_id: 101, text: '65 bytes', reply_markup: {
    inline_keyboard: [[{ ...button, callback_data: button.callback_data + 'a' }]],
  } }), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 400);
    return true;
  });
  const capped = await api.sendMessage({ chat_id: 101, text: 'Limits', reply_markup: {
    inline_keyboard: Array.from({ length: 26 }, () => Array.from({ length: 13 }, () => button)),
  } });
  assert.deepEqual(capped.reply_markup, { inline_keyboard: Array.from({ length: 25 }, () => Array.from({ length: 12 }, () => button)) });
  assert.equal((await control<{ messages: unknown[] }>(fake.url, 'state')).messages.length, 2,
    'the invalid keyboard must not create a message');
});

test('Telegram outcome edits retain entities, remove buttons and distinguish an identical edit', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const sent = await api.sendMessage({ chat_id: 101, text: 'Choose', reply_markup: {
    inline_keyboard: [[{ text: 'Yes', callback_data: 'opaque' }]],
  } });
  const outcome = { chat_id: 101, message_id: sent.message_id, text: 'Answered',
    entities: [{ type: 'bold', offset: 0, length: 8 }], reply_markup: { inline_keyboard: [] } };
  const edited = await api.editMessageText(outcome);
  assert.deepEqual(edited, { ...sent, text: 'Answered', entities: outcome.entities, reply_markup: { inline_keyboard: [] } });
  await assert.rejects(api.editMessageText(outcome), error => {
    assert.ok(error instanceof TelegramError);
    assert.equal(error.code, 400);
    assert.equal(error.description, 'Bad Request: message is not modified');
    return true;
  });
  assert.deepEqual((await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages, [edited]);
  assert.equal((await telegramControl(fake.url, 'press', {
    chat_id: 101, message_id: sent.message_id, row: 0, column: 0,
  })).status, 400, 'removed buttons cannot produce another press');
  const longText = 'Outcome\n' + 'x'.repeat(600);
  const longEdit = await api.editMessageText({ ...outcome, text: longText });
  assert.equal(longEdit.text, longText, 'message content keeps line breaks and is not clipped by the diagnostic redactor');
});

test('Telegram ForceReply prompts retain their reply target and can never be edited', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const card = await api.sendMessage({ chat_id: 101, text: 'Question' });
  const prompt = await api.sendMessage({ chat_id: 101, text: 'Your answer',
    reply_parameters: { message_id: card.message_id },
    reply_markup: { force_reply: true, input_field_placeholder: 'Type an answer' },
  });
  assert.deepEqual(prompt.reply_markup, { force_reply: true, input_field_placeholder: 'Type an answer' });
  assert.deepEqual(prompt.reply_to_message, card);
  for (const text of ['Changed prompt', 'Another change']) {
    await assert.rejects(api.editMessageText({ chat_id: 101, message_id: prompt.message_id, text,
      reply_markup: { inline_keyboard: [] } }), error => {
      assert.ok(error instanceof TelegramError);
      assert.equal(error.code, 400);
      assert.match(error.description, /message can't be edited/);
      return true;
    });
  }
  assert.deepEqual((await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages, [card, prompt]);
});

test('Telegram card calls redact successful receipts and echoed faults while preserving failure classes', async t => {
  const fake = await fakeTelegram(t);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const logs: unknown[][] = [];
  for (const method of ['log', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => { logs.push(args); });
  const safe = (value: unknown) => assert.equal(JSON.stringify(value).includes(TELEGRAM_TEST_TOKEN), false,
    'diagnostics, captured logs and receipts must be token-free');
  const sent = await api.sendMessage({ chat_id: 101, text: 'Choose', reply_markup: {
    inline_keyboard: [[{ text: 'Answer', callback_data: TELEGRAM_TEST_TOKEN }]],
  } });
  safe(sent);
  const pressed = await control<TgUpdate>(fake.url, 'press', { chat_id: 101, message_id: sent.message_id, row: 0, column: 0 });
  safe(pressed);
  safe(await api.getUpdates({ timeout: 0, allowed_updates: ['callback_query'] }));
  const calls = [
    { method: 'answerCallbackQuery', invoke: () => api.answerCallbackQuery({ callback_query_id: pressed.callback_query!.id, text: 'Stored' }) },
    { method: 'editMessageText', invoke: () => api.editMessageText({ chat_id: 101, message_id: sent.message_id, text: 'Outcome', reply_markup: { inline_keyboard: [] } }) },
  ];
  for (const call of calls) {
    for (const code of [400, 401, 403, 429, 500]) {
      await control(fake.url, 'fault', { method: call.method, code, echoToken: true, ...(code === 429 ? { retry_after: 7 } : {}) });
      await assert.rejects(call.invoke(), error => {
        assert.ok(error instanceof TelegramError);
        assert.equal(error.method, call.method);
        assert.equal(error.code, code);
        assert.equal(error.retryAfter, code === 429 ? 7 : undefined);
        assert.match(error.description, /\[redacted\]/);
        assert.equal(Object.hasOwn(error, 'cause'), false);
        safe([String(error), error.stack, error]);
        return true;
      });
    }
    await control(fake.url, 'fault', { method: call.method, code: 500, response: 'disconnect' });
    await assert.rejects(call.invoke(), error => {
      assert.ok(error instanceof TelegramError);
      assert.equal(error.code, 0);
      safe([String(error), error.stack, error]);
      return true;
    });
    safe(await call.invoke());
  }
  safe(await control(fake.url, 'state'));
  safe(logs);
});

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

test('Telegram fake injects unlisted update kinds with redacted request observations', async t => {
  const fake = await fakeTelegram(t);
  const queued = await control<{ update_id: number; channel_post: { text: string } }>(fake.url, 'update', {
    channel_post: { text: `synthetic secret ${TELEGRAM_TEST_TOKEN}` },
  });
  assert.equal(queued.update_id, 1);
  assert.equal(queued.channel_post.text, 'synthetic secret [redacted]');
  const requested = fake.waitForRequest('getUpdates', receipt => receipt.params.timeout === 0);
  const closed = fake.waitForConnectionClose('getUpdates');
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url });
  const updates = await api.getUpdates({ timeout: 0, allowed_updates: ['message'] });
  assert.deepEqual(updates, [queued], 'the fault injection deliberately bypasses Telegram filtering so the client must filter');
  const request = await requested;
  assert.equal(request.method, 'getUpdates');
  assert.deepEqual(request.params, { timeout: 0, allowed_updates: ['message'] });
  assert.equal((await closed).id, request.id);
  const state = await control(fake.url, 'state');
  assert.equal(JSON.stringify(state).includes(TELEGRAM_TEST_TOKEN), false);
});
