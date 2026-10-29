// T2: sealed hub frames and the native messenger against a loopback fake Bot API.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, tempProject, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { TelegramApi, type TgMessage, type TgUpdate } from '../src/remote/telegram-api.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { driveTelegram, pacingOwner } from './telegram-pacing-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { HubFrame, Inbox, RemoteStatusResult } from '../src/protocol.ts';

async function resources(t: TestContext, muteDefault = false) {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = fakeTelegramFixture(t, { clock });
  owner.close(() => native.close(), { startupOnly: true });
  const fake = await native.start();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Mute fixture');
  config.remote.muteDefault = muteDefault;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = owner.store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  const newRemote = () => {
    let remote: TelegramRemote | undefined;
    owner.close(() => remote?.stop());
    remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
    return remote;
  };
  const remote = newRemote();
  return { root, clock, fake, native, store, state, remote, newRemote, owner };
}

async function fixture(t: TestContext, muteDefault = false) {
  const f = await resources(t, muteDefault);
  const { root, clock, fake, state, remote, owner } = f;
  const initial = fake.waitForPoll();
  const hub = await owner.start(root, {}, clock, { hubOptions: { gatewayRemotes: [remote] } });
  await within(initial, 1000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const say = async (text: string, user = 'human') => {
    const confirmed = fake.waitForPoll();
    const update = await control<TgUpdate>(fake.url, 'say', { text, user });
    assert.equal((await driveTelegram(clock, state,
      within(confirmed, 2000, undefined, () => new Error(`missing durable receipt for ${text}`)))).params.offset, update.update_id + 1);
    return update;
  };
  const mute = async () => ((await ui.request({ type: 'remote.status' })).value as RemoteStatusResult).remotes[0]!.mute;
  const messages = async () => (await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages;
  const post = async (text: string) => {
    assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text })).ok, true);
  };
  return { ...f, hub, ui, say, mute, messages, post };
}

test('Telegram mute suppresses three General messages but keeps a hub notice and unmute reports the count', async t => {
  const f = await fixture(t, true);
  await f.say('/start');
  const row = ((await f.ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  assert.equal((await f.ui.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code })).ok, true);
  assert.equal(await f.mute(), true, 'new pairing applies mute_default');
  await f.say('/unmute');
  assert.equal(await f.mute(), false);
  await f.say('/mute@cland_fixture_bot');
  assert.equal(await f.mute(), true);
  const counted = until(() => f.state.get('mute.missed') === '3', { timeoutMs: 1000, what: 'three durable suppressed General messages' });
  void counted.catch(() => {});
  for (const text of ['first muted report', 'second muted report', 'third muted report']) await f.post(text);
  await counted;
  const notice: HubFrame = { type: 'message', topic: { id: 'general', title: 'General', unread: 0, lastMessageAt: null },
    message: { id: 'mute-test-notice', seq: 100, topic: 'general', from: 'hub', fromKind: 'hub', via: 'hub', to: [],
      kind: 'event', text: 'A hub notice while muted', ts: f.clock.now().toISOString() } };
  await driveTelegram(f.clock, f.state, Promise.resolve(f.remote.receive(notice)));
  await f.say('/unmute');
  assert.equal(await f.mute(), false);
  assert.equal(f.state.get('mute.missed'), '0');
  const resumed = f.fake.waitForRequest('sendRichMessage', request =>
    (request.params.rich_message as { markdown: string }).markdown === 'coord · report\nafter unmute');
  const persisted = until(async () => {
    const message = (await f.messages()).find(message => message.text === 'coord · report\nafter unmute');
    return !!message && !!f.state.message('101', String(message.message_id));
  }, { timeoutMs: 1000, what: 'resumed General accepted and source mapping persisted' });
  void persisted.catch(() => {});
  await f.post('after unmute');
  await driveTelegram(f.clock, f.state, resumed);
  await persisted;
  await f.hub.stop();
  const messages = await f.messages();
  assert.deepEqual(messages.slice(1).map(message => message.text), [
    'Paired with this project.', '0 messages arrived while muted', 'General stream muted', 'hub · event\nA hub notice while muted',
    '3 messages arrived while muted', 'coord · report\nafter unmute',
  ]);
  assert.equal(f.store.remotes.forMessenger('discord').get('mute'), null, 'mute belongs to Telegram');
});

test('Telegram unmute interruption after commit preserves the count reset without replaying its reply', async t => {
  const f = await fixture(t);
  f.state.setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  await f.say('/mute');
  const counted = until(() => f.state.get('mute.missed') === '3', { timeoutMs: 1000, what: 'three durable muted sources before interruption' });
  void counted.catch(() => {});
  for (const text of ['one', 'two', 'three']) await f.post(text);
  await counted;
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' });
  const held = f.fake.waitForRequest('sendMessage', request => request.params.text === '3 messages arrived while muted');
  const update = await control<TgUpdate>(f.fake.url, 'say', { text: '/unmute' });
  const attempt = await driveTelegram(f.clock, f.state, held);
  assert.equal(f.state.get('mute'), 'false', 'the mutation is durable before the external response');
  assert.equal(f.state.get('mute.missed'), '0');
  assert.equal(f.state.get(`telegram.update:${update.update_id}`), null, 'polling has not confirmed the held command');
  const closed = (async () => {
    const signal = AbortSignal.timeout(1000);
    for (;;) {
      const receipt = await f.fake.waitForConnectionClose('sendMessage', signal);
      if (receipt.id === attempt.id) return receipt;
    }
  })();
  void closed.catch(() => {});
  await f.hub.stop();
  assert.equal((await closed).id, attempt.id);
  f.ui.close();
  const before = await f.messages();
  const resumed = f.newRemote();
  const confirmed = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [resumed] } });
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 2000))).params.offset, update.update_id + 1);
  assert.equal(f.state.get('mute'), 'false');
  assert.equal(f.state.get('mute.missed'), '0');
  assert.deepEqual(await f.messages(), before, 'an uncertain reply is not sent twice after restart');
  const ui = await connectUi(t, hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await hub.stop();
});

test('Telegram mute counts each eligible source once and a replacement pairing starts with a fresh count', async t => {
  const f = await fixture(t, true);
  f.state.setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  await f.say('/mute');
  const frame: HubFrame = { type: 'message', topic: { id: 'general', title: 'General', unread: 0, lastMessageAt: null },
    message: { id: 'duplicate-muted-source', seq: 100, topic: 'general', from: 'agent', fromKind: 'agent', via: 'session', to: [],
      text: 'muted once', ts: f.clock.now().toISOString() } };
  await f.remote.receive(frame);
  await f.remote.receive(frame);
  assert.equal(f.state.get('mute.missed'), '1');
  await f.say('/mute');
  assert.equal(f.state.get('mute.missed'), '1', 'repeated mute preserves the count');
  await f.say('/unmute', 'stranger');
  assert.equal(await f.mute(), true, 'foreign commands cannot change the pairing');
  await f.say('/start', 'stranger');
  const row = ((await f.ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  assert.equal((await f.ui.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code })).ok, true);
  assert.equal(await f.mute(), true);
  assert.equal(f.state.get('mute.missed'), '0', 'the old pairing count is not inherited');
  await f.say('/unmute', 'stranger');
  assert.equal(await f.mute(), false);
  await f.remote.receive(frame);
  assert.equal(f.state.get('mute.missed'), '0', 'a previously suppressed source never replays after unmute');
  await f.hub.stop();
  const messages = await f.messages();
  assert.equal(messages.some(message => message.text?.includes('muted once')), false);
  assert.equal(messages.filter(message => message.text === '0 messages arrived while muted').length, 1);
});

for (const failure of ['missed receipt', 'aborted startup', 'rejected startup'] as const) test(`mute fixture drains native writers and SQLite after ${failure}`, { timeout: 5_000 }, async t => {
  const f = await resources(t);
  const setupClock = new FakeClock();
  const setupAbort = new AbortController();
  const rejectedStartup = failure === 'rejected startup';
  if (rejectedStartup) {
    f.state.setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
    await f.remote.start(() => {});
    await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' });
    await writeFile(join(f.root, '.cland/config.toml'), 'broken = [');
  } else await control(f.fake.url, 'fault', { method: 'getMe', code: 500, response: 'hold' });
  const method = rejectedStartup ? 'sendMessage' : 'getMe';
  const entered = f.fake.waitForHeldRequest(method);
  // Pre-serving disposal closes the fake itself, invalidating its event
  // observers; that path retains the stronger native all-connections receipt.
  const closed = rejectedStartup ? f.fake.waitForConnectionClose(method) : undefined;
  void closed?.catch(() => {});
  const sending = rejectedStartup ? f.remote.test(f.state.pairing(), 'held mute fixture writer').then(() => 'sent', () => 'incomplete') : null;
  if (rejectedStartup) await within(entered, 1_000);
  const starting = f.owner.start(f.root, {}, f.clock, {
    clock: setupClock, signal: setupAbort.signal, hubOptions: { gatewayRemotes: [f.remote] },
  });
  void starting.catch(() => {});
  const rejected = assert.rejects(within(starting, 1_000), rejectedStartup ? /Invalid TOML document: unfinished array/
    : failure === 'missed receipt' ? /setup receipt deadline/ : /cancel mute startup/);
  try {
    const request = await within(entered, 1_000);
    if (!rejectedStartup) {
      if (failure === 'missed receipt') await setupClock.advance(1_000);
      else setupAbort.abort(new Error('cancel mute startup'));
    }
    await rejected;
    await f.owner.dispose();
    if (closed) assert.equal((await closed).id, request.id);
    if (sending) assert.equal(await sending, 'incomplete');
    else {
      const lateHub = await within(f.owner.serving, 1_000);
      await within(lateHub.stopped, 1_000);
    }
    assert.throws(() => f.state.outbox(), /not open|closed/i);
    assert.equal(f.clock.pending, 0);
    assert.equal(setupClock.pending, 0);
    await f.fake.close();
    assert.deepEqual(f.native.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
  } finally {
    // Bound red controls too: release native I/O before joining failed acquisition.
    await f.fake.close();
    await f.owner.dispose();
  }
});
