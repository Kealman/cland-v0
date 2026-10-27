// T2: native Telegram mirror through public frames and the loopback Bot API.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, connectUi, inProcessSpoke, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { Store } from '../src/hub/store.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { TopicMessage, HubFrame } from '../src/protocol.ts';
import { TelegramApi, type TgMessage } from '../src/remote/telegram-api.ts';
import { heldTelegramReaction } from './fakes/telegram/held-reaction.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import type { Remote } from '../src/remote/gateway.ts';
import { onCleanup } from './process-cleanup.ts';

async function fixture(t: TestContext) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram inbound fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); }
  finally { store.close(); }
  return { root, clock, fake };
}

test('Telegram text decisions questions and formatting reach General as the human', async t => {
  const { root, clock, fake } = await fixture(t);
  for (const text of ['Free text', '/decision Ship it', '/question Why now?'])
    await control(fake.url, 'say', { text });
  await control(fake.url, 'update', { message: {
    message_id: 99, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Bold link code',
    entities: [{ type: 'bold', offset: 0, length: 4 }, { type: 'text_link', offset: 5, length: 4, url: 'https://example.invalid' },
      { type: 'code', offset: 10, length: 4 }],
  } });
  const polled = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const poll = await within(polled, 1_000);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.via === 'telegram');
  assert.deepEqual(messages.map(message => ({ text: message.text, kind: message.kind, from: message.from,
    fromKind: message.fromKind, to: message.to, via: message.via })), [
    { text: 'Free text', kind: 'message', from: 'human', fromKind: 'human', to: ['coordinator'], via: 'telegram' },
    { text: 'Ship it', kind: 'decision', from: 'human', fromKind: 'human', to: ['coordinator'], via: 'telegram' },
    { text: 'Why now?', kind: 'question', from: 'human', fromKind: 'human', to: ['coordinator'], via: 'telegram' },
    { text: 'Bold link code', kind: 'message', from: 'human', fromKind: 'human', to: ['coordinator'], via: 'telegram' },
  ]);
  assert.equal(poll.params.offset, 5);
  const status = await ui.request({ type: 'remote.status' });
  assert.equal(status.ok, true, status.error);
  const telegram = (status.value as { remotes: Array<{ messenger: string; lastOutbound: string | null }> }).remotes.find(row => row.messenger === 'telegram')!;
  assert.ok(telegram.lastOutbound, 'successful reaction is outbound traffic');
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
});

test('Telegram replies use the mirrored topic and react stored before delivered', async t => {
  const { root, clock, fake } = await fixture(t);
  const initialPoll = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(initialPoll, 1_000);
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const created = await ui.request({ type: 'topic.create', title: 'A mirrored notice topic' });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const original = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === 'Agent original');
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic, text: 'Agent original' })).ok, true);
  const source = (await original).message as TopicMessage;
  // Mirror-out owns rendering; seed its existing native map at this seam.
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock });
  const mirrored = await api.sendMessage({ chat_id: '101', text: 'coord · report\nAgent original' });
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').putMessage({ chatId: '101', messageId: String(mirrored.message_id),
    topic, message: source.id, ask: null, approval: null }); }
  finally { store.close(); }
  const delivered = coord.waitForEvent(event => event.params.content.includes('Phone reply'));
  const posted = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === 'Phone reply');
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const polled = fake.waitForPoll();
  for (const observation of [delivered, posted, eyes, polled]) void observation.catch(() => {});
  await control(fake.url, 'update', { message: {
    message_id: 99, date: 1, chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' },
    text: 'Phone reply', reply_to_message: mirrored,
  } });
  const message = (await posted).message as TopicMessage;
  assert.equal(message.topic, topic);
  assert.equal(message.replyTo, source.id);
  assert.deepEqual(message.to, ['coord']);
  assert.equal(message.via, 'telegram');
  assert.equal((await delivered).params.meta!.from, 'human');
  await within(eyes, 1_000);
  const poll = await within(polled, 1_000);
  const state = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  const general = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(JSON.stringify(general.value).includes('Phone reply'), false);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
});

test('Telegram replies to the native outbound mirror without an echo or a seeded reply map', async t => {
  const { root, clock, fake } = await fixture(t);
  const initial = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(initial, 1_000);
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, async () => { await hub.stop(); store.close(); });
  const posted = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === 'Native mirrored original');
  let sourceId: string | undefined;
  let mirrored: TgMessage | undefined;
  const mapped = until(async () => {
    const state = await control<{ messages: TgMessage[] }>(fake.url, 'state');
    const message = state.messages.find(message => message.text === 'coord · report\nNative mirrored original');
    if (!message || !sourceId || store.remotes.forMessenger('telegram').message('101', String(message.message_id))?.message !== sourceId) return false;
    mirrored = message;
    return true;
  }, { what: 'native outbound accepted with its durable reply map', timeoutMs: 1_000 });
  void mapped.catch(() => {});
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Native mirrored original' })).ok, true);
  sourceId = ((await posted).message as TopicMessage).id;
  await mapped;
  const reply = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === 'Native phone reply');
  const delivered = coord.waitForEvent(event => event.params.content === 'Native phone reply');
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const polled = fake.waitForPoll();
  for (const observation of [reply, delivered, eyes, polled]) void observation.catch(() => {});
  await control(fake.url, 'update', { message: { message_id: 99, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Native phone reply', reply_to_message: mirrored } });
  const saved = (await reply).message as TopicMessage;
  assert.equal(saved.topic, 'general');
  assert.equal(saved.replyTo, sourceId);
  assert.equal(saved.via, 'telegram');
  assert.deepEqual(saved.to, ['coord']);
  assert.equal((await delivered).params.meta!.from, 'human');
  await within(eyes, 1_000);
  const poll = await within(polled, 1_000);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  const state = await control<{ messages: TgMessage[]; requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(state.messages.map(message => message.text), ['coord · report\nNative mirrored original'], 'the human reply receives reactions without a mirror echo');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  await fake.close(); // Native server/connection drainage precedes fixture removal.
});

test('Telegram replays a stored input after interrupted feedback without a second human message', async t => {
  const { root, clock, fake } = await fixture(t);
  await control(fake.url, 'fault', { method: 'setMessageReaction', code: 503, response: 'hold' });
  await control(fake.url, 'say', { text: 'Durable before feedback' });
  const held = fake.waitForHeldRequest('setMessageReaction');
  const first = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const entered = await within(held, 1_000);
  const closed = fake.waitForConnectionClose('setMessageReaction');
  await first.stop();
  assert.equal((await within(closed, 1_000)).id, entered.id);
  const polled = fake.waitForPoll();
  const second = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const poll = await within(polled, 1_000);
  const ui = await connectUi(t, second.discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.text === 'Durable before feedback');
  assert.equal(messages.length, 1, 'replay returns the durable original across adapter shutdown');
  assert.equal(poll.params.offset, 2);
  const pollClosed = fake.waitForPollClose(poll.id);
  await second.stop();
  assert.equal(await within(pollClosed, 1_000), poll.id);
});

test('Telegram stored feedback does not claim delivery until the queued addressee receives it', async t => {
  const { root, clock, fake } = await fixture(t);
  await control(fake.url, 'say', { text: 'Waiting for the Coordinator' });
  const polled = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const poll = await within(polled, 1_000);
  const before = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(before.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
  ], 'offset confirmation includes stored feedback, never an invented session receipt');
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const eyeClose = fake.waitForConnectionClose('setMessageReaction');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const delivered = await coord.waitForEvent(event => event.params.content === 'Waiting for the Coordinator');
  assert.equal(delivered.params.meta!.from, 'human');
  const seen = await within(eyes, 1_000);
  assert.equal((await within(eyeClose, 1_000)).id, seen.id);
  const after = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(after.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
});

test('Telegram preserves workbench mention routing including named Aides and item leads', async t => {
  const { root, clock, fake } = await fixture(t);
  const initial = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(initial, 1_000);
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const aide = await inProcessSpoke(t, { cwd: root, discover: true, name: 'aide-1', role: 'aide', sessionId: 'aide' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Mention routing fixture', size: 'S' });
  const texts = ['@coord by session', '@coordinator by role', `@lead ${item.id} by item`, '@aide no role recipient', '@aide-1 by name'];
  const localTo: string[][] = [];
  for (const text of texts) {
    const local = await ui.request({ type: 'topic.send', topic: 'general', text });
    assert.equal(local.ok, true, local.error);
    localTo.push((local.value as { message: TopicMessage }).message.to);
  }
  assert.deepEqual(localTo, [['coord'], ['coord'], ['coord'], [], ['aide-1']]);
  const polled = fake.waitForPoll();
  // The poll loop consumes one batch so its next poll is the completion boundary.
  for (let index = 0; index < texts.length; index++) await control(fake.url, 'update', { message: {
    message_id: 100 + index, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: texts[index],
  } });
  let poll = await within(polled, 1_000);
  // Updates may arrive while a reaction is in flight; observe the final durable cursor.
  await until(async () => {
    const state = await control<{ pendingPolls: Array<typeof poll> }>(fake.url, 'state');
    const final = state.pendingPolls.find(candidate => candidate.params.offset === 6);
    if (final) poll = final;
    return !!final;
  }, { what: 'all mention messages confirmed', timeoutMs: 1_000 });
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const remote = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.via === 'telegram');
  assert.deepEqual(remote.map(message => message.to), localTo);
  assert.equal(remote.length, 5);
  await aide.waitForEvent(event => event.params.content === '@aide-1 by name' && event.params.meta?.via === 'telegram');
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
});

test('Telegram delivery arriving as stored feedback settles acquires the next reaction owner', async t => {
  const { root, clock, fake } = await fixture(t);
  // The real fake HTTP exchange completes; only its native API receipt is held
  // to select the exact promise-settlement interleaving at the public API seam.
  const held = heldTelegramReaction({ apiRoot: fake.url, clock });
  const store = new Store(join(root, '.cland/hub.db'));
  const native = new TelegramRemote(held.api, clock,
    { store: store.remotes.forMessenger('telegram') });
  onCleanup(t, async () => { held.release(true); await native.stop(); await held.drain(); store.close(); });
  const heldDelivery = Promise.withResolvers<HubFrame>();
  let humanId: string | undefined;
  const remote: Remote = { id: native.id, via: native.via, start: (...args) => native.start(...args),
    stop: () => native.stop(), run: () => native.run(), receive: frame => {
      if (frame.type === 'result' && frame.ok && (frame.value as { message?: TopicMessage }).message?.text === 'Reaction handoff')
        humanId = (frame.value as { message: TopicMessage }).message.id;
      if (frame.type === 'delivery' && frame.message === humanId && frame.stage === 'delivered') { heldDelivery.resolve(frame); return; }
      return native.receive(frame);
    } };
  const initial = fake.waitForPoll();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  await within(initial, 1_000);
  const storedClose = fake.waitForConnectionClose('setMessageReaction');
  await control(fake.url, 'say', { text: 'Reaction handoff' });
  const ok = await within(held.completed, 1_000);
  await within(storedClose, 1_000);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const actual = await coord.waitForEvent(event => event.params.content === 'Reaction handoff');
  assert.equal(actual.params.meta!.via, 'telegram');
  const delivery = await within(heldDelivery.promise, 1_000);
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const eyeClose = fake.waitForConnectionClose('setMessageReaction');
  for (const observation of [eyes, eyeClose]) void observation.catch(() => {});
  // Queue the flush continuation first, then the real delivery frame. Its
  // native receive microtask runs before an old work.then(delete) callback.
  held.release(ok);
  const receiving = native.receive(delivery);
  await receiving;
  const seen = await within(eyes, 1_000, undefined, () => new Error('settlement delivery is missing its 👀 reaction'));
  assert.equal((await within(eyeClose, 1_000)).id, seen.id);
  assert.equal(held.maximum(), 1, 'one reaction owner at a time');
  const state = await control<{ requests: Array<{ method: string; params: unknown }>; pendingPolls: Array<{ id: number }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  const poll = state.pendingPolls[0]!;
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
});

test('Telegram restart reconciles a confirmed input whose durable session delivery frame was lost', async t => {
  const { root, clock, fake } = await fixture(t);
  const store = new Store(join(root, '.cland/hub.db'));
  const native = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: store.remotes.forMessenger('telegram') });
  onCleanup(t, async () => { await native.stop(); store.close(); });
  const dropped = Promise.withResolvers<HubFrame>();
  let humanId: string | undefined;
  const remote: Remote = { id: native.id, via: native.via, start: (...args) => native.start(...args),
    stop: () => native.stop(), run: () => native.run(), receive: frame => {
      if (frame.type === 'result' && frame.ok && (frame.value as { message?: TopicMessage }).message?.text === 'Recover durable eyes')
        humanId = (frame.value as { message: TopicMessage }).message.id;
      if (frame.type === 'delivery' && frame.message === humanId && frame.stage === 'delivered') { dropped.resolve(frame); return; }
      return native.receive(frame);
    } };
  await control(fake.url, 'say', { text: 'Recover durable eyes' });
  const polled = fake.waitForPoll();
  const storedClose = fake.waitForConnectionClose('setMessageReaction');
  const first = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  const poll = await within(polled, 1_000);
  await within(storedClose, 1_000);
  assert.equal(poll.params.offset, 2, 'the input was confirmed before session delivery');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await coord.waitForEvent(event => event.params.content === 'Recover durable eyes');
  const delivery = await within(dropped.promise, 1_000);
  assert.equal(delivery.type, 'delivery');
  const ui = await connectUi(t, first.discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const original = (history.value as { messages: TopicMessage[] }).messages.find(message => message.id === humanId)!;
  assert.equal(original.stage, 'delivered', 'the hub has the durable session receipt');
  const before = JSON.parse(store.remotes.forMessenger('telegram').get(`telegram.inbound:${humanId}`)!);
  assert.equal(before.delivered, false, 'the platform adapter missed that frame');
  const closed = fake.waitForPollClose(poll.id);
  await first.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  await coord.close();
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const eyeClose = fake.waitForConnectionClose('setMessageReaction');
  for (const observation of [eyes, eyeClose]) void observation.catch(() => {});
  const recovered = fake.waitForPoll();
  const second = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const next = await within(recovered, 1_000);
  const seen = await within(eyes, 1_000, undefined, () => new Error('durable delivery recovery is missing its 👀 reaction'));
  assert.equal((await within(eyeClose, 1_000)).id, seen.id);
  assert.equal(next.params.offset, 2);
  const state = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ], 'restart repairs delivery feedback without repeating stored feedback');
  const nextClosed = fake.waitForPollClose(next.id);
  await second.stop();
  assert.equal(await within(nextClosed, 1_000), next.id);
});
