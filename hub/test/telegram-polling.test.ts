// T2: sealed frame gateway and loopback Bot API, with durable handler receipts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Store } from '../src/hub/store.ts';
import { TelegramApi, type TgUpdate } from '../src/remote/telegram-api.ts';
import { tempProject, projectHub, connectUi, until } from './harness.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';

import { pairing, control, nativeRemote } from './telegram-polling-fixture.ts';

test('Telegram confirms only durable handling and deduplicates update and message ids', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, async () => { await native.gateway.stop(); store.close(); });
  const native = nativeRemote(store, fake.url, clock);
  native.state.setPairing(pairing);
  const original = await control<TgUpdate>(fake.url, 'say', { text: 'handled once' });
  await control(fake.url, 'duplicate', { update_id: 1 });
  await control(fake.url, 'update', { message: original.message });
  const polled = fake.waitForPoll();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [native.gateway], clock });
  const receipt = await within(polled, 1_000);
  assert.equal(receipt.params.offset, 3);
  assert.equal(receipt.params.timeout, 40);
  assert.deepEqual(receipt.params.allowed_updates, ['message', 'edited_message', 'callback_query', 'my_chat_member']);
  assert.deepEqual(native.handled, [1]);
  assert.equal(native.state.get('telegram.offset'), '3');
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const messages = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(messages.ok, true, messages.error);
  assert.equal(JSON.stringify(messages.value).split('handled once').length - 1, 1);
  const closed = fake.waitForPollClose(receipt.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
  assert.equal(clock.pending, 0);
});


test('Telegram filters foreign identities unlisted kinds and bots before the handler', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, async () => { await native.gateway.stop(); store.close(); });
  const native = nativeRemote(store, fake.url, clock);
  native.state.setPairing(pairing);
  const message = { message_id: 11, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture' }, text: 'filtered payload',
    document: { file_id: 'must-not-download' } };
  for (const body of [
    { message: { ...message, chat: { id: 202, type: 'private' } } },
    { message: { ...message, from: { ...message.from, id: 202 } } },
    { channel_post: message },
    { message: { ...message, from: { ...message.from, is_bot: true } } },
    { message: { ...message, from: { ...message.from, id: 123456789, is_bot: true } } },
    { message: { ...message, chat: { id: 101, type: 'group' } } },
    { callback_query: { id: 'foreign-click', from: { ...message.from, id: 202 }, message } },
    { my_chat_member: { chat: message.chat, from: { ...message.from, id: 202 }, new_chat_member: { user: { id: 123456789 } } } },
  ]) await control(fake.url, 'update', body);
  const accepted = await control<TgUpdate>(fake.url, 'say', { text: 'approved human' });
  const polled = fake.waitForPoll();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [native.gateway], clock });
  const receipt = await within(polled, 1_000);
  assert.equal(receipt.params.offset, accepted.update_id + 1);
  assert.deepEqual(native.handled, [accepted.update_id], 'no download, command or handler work for rejected input');
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  assert.equal(JSON.stringify(history.value).includes('filtered payload'), false);
  assert.equal(JSON.stringify(history.value).includes('approved human'), true);
  const traffic = await control<{ requests: Array<{ method: string }> }>(fake.url, 'state');
  assert.ok(traffic.requests.every(request => ['getMe', 'getUpdates'].includes(request.method)), 'no download or reply work for rejected input');
  const closed = fake.waitForPollClose(receipt.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
});


test('Telegram waits for durable handler completion and joins its writer on stop', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const entered = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, {
    store: state, handlers: [{ accepts: () => true, handle: async (_update, signal) => {
      signal.addEventListener('abort', () => aborted.resolve(), { once: true });
      entered.resolve();
      await release.promise;
    } }],
  });
  onCleanup(t, async () => { release.resolve(); await remote.stop(); store.close(); });
  await control(fake.url, 'say', { text: 'held writer' });
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  await within(entered.promise, 1_000);
  assert.equal(state.get('telegram.offset'), null);
  assert.equal(state.get('telegram.update:1'), null);
  let stopped = false;
  const stopping = hub.stop().then(() => { stopped = true; });
  await within(aborted.promise, 1_000);
  assert.equal(stopped, false, 'stop cannot release storage with a handler writer outstanding');
  assert.equal(state.get('telegram.offset'), null);
  release.resolve();
  await within(stopping, 1_000);
  assert.equal(state.get('telegram.offset'), null, 'cancelled handling is left for replay');
  assert.equal(clock.pending, 0);
});

test('Telegram retries offline with zero timeout and restarts a stalled poll using injected time', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  const logs: Record<string, unknown>[] = [];
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: store.remotes.forMessenger('telegram'), log: entry => { logs.push(entry); } });
  onCleanup(t, async () => { await remote.stop(); store.close(); });
  await control(fake.url, 'fault', { method: 'getUpdates', code: 500 });
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  await until(() => logs.some(entry => entry.event === 'telegram-poll-retry'), { what: 'poll failure schedules retry', timeoutMs: 1_000 });
  const recovery = fake.waitForRequest('getUpdates', receipt => receipt.params.timeout === 0);
  const online = fake.waitForPoll();
  await clock.advance(1_000);
  assert.equal((await within(recovery, 1_000)).params.timeout, 0);
  const healthy = await within(online, 1_000);
  assert.equal(healthy.params.timeout, 40);
  await control(fake.url, 'stall', { enabled: true });
  const stalled = fake.waitForPoll();
  await control(fake.url, 'release-polls', {});
  const held = await within(stalled, 1_000);
  assert.equal(held.stalled, true);
  const closed = fake.waitForPollClose(held.id);
  const retries = logs.filter(entry => entry.event === 'telegram-poll-retry').length;
  await clock.advance(55_000);
  assert.equal(await within(closed, 1_000), held.id);
  await until(() => logs.filter(entry => entry.event === 'telegram-poll-retry').length === retries + 1,
    { what: 'stalled poll timeout schedules retry', timeoutMs: 1_000 });
  const next = fake.waitForPoll();
  await clock.advance(1_000);
  const probing = await within(next, 1_000);
  assert.equal(probing.params.timeout, 0, 'offline probe has no long-poll delay');
  const probeClosed = fake.waitForPollClose(probing.id);
  await hub.stop();
  assert.equal(await within(probeClosed, 1_000), probing.id);
  assert.equal(clock.pending, 0);
});

test('Telegram registry isolates private pairing starts and distinct callbacks on the same card', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const handled: Array<[string, number]> = [];
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, {
    store: state, handlers: [
      { kind: 'pairing', accepts: () => true, handle: async update => { handled.push(['pairing', update.update_id]); } },
      { accepts: update => !!update.callback_query, handle: async update => { handled.push(['callback', update.update_id]); } },
      { accepts: () => true, handle: async update => { handled.push(['paired', update.update_id]); } },
    ],
  });
  onCleanup(t, async () => { await remote.stop(); store.close(); });
  await control(fake.url, 'say', { user: 'stranger', text: 'unpaired free text' });
  await control(fake.url, 'say', { user: 'stranger', text: '/start' });
  await control(fake.url, 'say', { text: 'paired free text' });
  const user = { id: 101, is_bot: false, first_name: 'Fixture human' };
  const bot = { id: 123456789, is_bot: true, first_name: 'Fixture bot' };
  const card = { message_id: 77, date: 1, chat: { id: 101, type: 'private' }, from: bot };
  for (const id of ['click-a', 'click-a', 'click-b'])
    await control(fake.url, 'update', { callback_query: { id, from: user, message: card } });
  await control(fake.url, 'update', { edited_message: { ...card, message_id: 88, from: user } });
  await control(fake.url, 'membership', { status: 'kicked' });
  const polled = fake.waitForPoll();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  const receipt = await within(polled, 1_000);
  assert.equal(receipt.params.offset, 9);
  assert.deepEqual(handled, [['pairing', 2], ['paired', 3], ['callback', 4], ['callback', 6], ['paired', 7], ['paired', 8]]);
  const closed = fake.waitForPollClose(receipt.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
});

test('Telegram retains unmatched input with paced retries and one content-free diagnostic', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const logs: Record<string, unknown>[] = [];
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: state, handlers: [], log: entry => { logs.push(entry); } });
  onCleanup(t, async () => { await remote.stop(); store.close(); });
  await control(fake.url, 'say', { text: 'payload must stay out of diagnostic' });
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  await until(() => logs.some(entry => entry.event === 'telegram-update-unhandled'), { what: 'unmatched handler receipt', timeoutMs: 1_000 });
  const retry = fake.waitForRequest('getUpdates');
  const closed = fake.waitForConnectionClose('getUpdates');
  await clock.advance(1_000);
  assert.equal((await within(retry, 1_000)).params.offset, undefined);
  await within(closed, 1_000);
  await hub.stop();
  assert.equal(state.get('telegram.offset'), null);
  assert.deepEqual(logs, [{ event: 'telegram-update-unhandled', update: 1 }]);
  const response = await control<{ requests: Array<{ method: string }> }>(fake.url, 'state');
  assert.equal(response.requests.filter(request => request.method === 'getUpdates').length, 2, 'no immediate retry loop');
  assert.equal(clock.pending, 0);
});
