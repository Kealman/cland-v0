// T2: native Telegram mirror through public frames and the loopback Bot API.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, connectUi, inProcessSpoke, until, testWaitMs } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { Store } from '../src/hub/store.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { within, abortable } from '../src/executor/droplet/deadline.ts';
import type { TopicMessage, HubFrame } from '../src/protocol.ts';
import { TelegramApi, type TgMessage } from '../src/remote/telegram-api.ts';
import { heldTelegramReaction } from './fakes/telegram/held-reaction.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import type { Remote } from '../src/remote/gateway.ts';
import { pacingOwner, driveTelegram } from './telegram-pacing-fixture.ts';

async function fixture(t: TestContext) {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  owner.close(() => fake.close(), { startupOnly: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram inbound fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = owner.store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const logs: Record<string, unknown>[] = [];
  const start = (extra: Record<string, string>, options: import('./harness.ts').ProjectHubOptions = {}) =>
    owner.start(root, extra, clock, { hubOptions: { ...options, log: entry => { logs.push(entry); options.log?.(entry); } } });
  const frame = (ui: Awaited<ReturnType<typeof connectUi>>, predicate: (frame: Record<string, unknown>) => boolean) => owner.observe(async signal => {
    await until(() => signal.aborted || ui.frames.some(predicate), { what: 'owned media frame receipt', timeoutMs: testWaitMs(5_000) });
    signal.throwIfAborted();
    return ui.frames.find(predicate)!;
  });
  const clean = async (ui: Awaited<ReturnType<typeof connectUi>>, hub: { stop: () => Promise<void> }) => {
    const listed = await ui.request({ type: 'artifact.list' });
    assert.equal(listed.ok, true, listed.error);
    const artifacts = (listed.value as { artifacts: import('../src/protocol.ts').Artifact[] }).artifacts;
    const sinks = await Promise.all(artifacts.map(a => readFile(a.path)));
    const unsafe = (value: Buffer) => value.includes(TELEGRAM_TEST_TOKEN) || value.includes('/file/bot');
    assert.ok(unsafe(Buffer.from(TELEGRAM_TEST_TOKEN)) && unsafe(Buffer.from('/file/botfixture')), 'secret scan positive controls');
    await hub.stop();
    for (const value of [Buffer.from(JSON.stringify(ui.frames)), Buffer.from(JSON.stringify(logs)), ...sinks,
      await readFile(join(root, '.cland/log/hub.log')), await readFile(join(root, '.cland/journal.jsonl'))])
      assert.equal(unsafe(value), false, 'native/public sinks contain no token or file URL');
  };
  return { root, clock, fake, owner, store, state, start, logs, clean, frame, drive: <T>(work: Promise<T>) => driveTelegram(clock, state, work) };
}

test('Telegram text decisions questions and formatting reach General as the human', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  for (const text of ['Free text', '/decision Ship it', '/question Why now?'])
    await control(fake.url, 'say', { text });
  await control(fake.url, 'update', { message: {
    message_id: 99, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Bold link code',
    entities: [{ type: 'bold', offset: 0, length: 4 }, { type: 'text_link', offset: 5, length: 4, url: 'https://example.invalid' },
      { type: 'code', offset: 10, length: 4 }],
  } });
  const polled = fake.waitForPoll();
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const poll = await drive(within(polled, 1_000));
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
  assert.equal(await drive(within(closed, 1_000)), poll.id);
});

test('Telegram replies use the mirrored topic and react stored before delivered', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  const initialPoll = fake.waitForPoll();
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  await drive(within(initialPoll, 1_000));
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
  await drive(within(eyes, 1_000));
  const poll = await drive(within(polled, 1_000));
  const state = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  const general = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(JSON.stringify(general.value).includes('Phone reply'), false);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await drive(within(closed, 1_000)), poll.id);
});

test('Telegram replies to the native outbound mirror without an echo or a seeded reply map', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  const initial = fake.waitForPoll();
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  await drive(within(initial, 1_000));
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const store = new Store(join(root, '.cland/hub.db'));
  owner.close(async () => { await hub.stop(); store.close(); });
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
  await drive(within(eyes, 1_000));
  const poll = await drive(within(polled, 1_000));
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await drive(within(closed, 1_000)), poll.id);
  const state = await control<{ messages: TgMessage[]; requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(state.messages.map(message => message.text), ['coord · report\nNative mirrored original'], 'the human reply receives reactions without a mirror echo');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 99, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  await fake.close(); // Native server/connection drainage precedes fixture removal.
});

test('Telegram replays a stored input after interrupted feedback without a second human message', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  await control(fake.url, 'fault', { method: 'setMessageReaction', code: 503, response: 'hold' });
  await control(fake.url, 'say', { text: 'Durable before feedback' });
  const held = fake.waitForHeldRequest('setMessageReaction');
  const first = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const entered = await drive(within(held, 1_000));
  const closed = fake.waitForConnectionClose('setMessageReaction');
  await first.stop();
  assert.equal((await drive(within(closed, 1_000))).id, entered.id);
  const polled = fake.waitForPoll();
  const second = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const poll = await drive(within(polled, 1_000));
  const ui = await connectUi(t, second.discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.text === 'Durable before feedback');
  assert.equal(messages.length, 1, 'replay returns the durable original across adapter shutdown');
  assert.equal(poll.params.offset, 2);
  const pollClosed = fake.waitForPollClose(poll.id);
  await second.stop();
  assert.equal(await drive(within(pollClosed, 1_000)), poll.id);
});

test('Telegram stored feedback does not claim delivery until the queued addressee receives it', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  await control(fake.url, 'say', { text: 'Waiting for the Coordinator' });
  const polled = fake.waitForPoll();
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const poll = await drive(within(polled, 1_000));
  const before = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(before.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
  ], 'offset confirmation includes stored feedback, never an invented session receipt');
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const eyeClose = fake.waitForConnectionClose('setMessageReaction');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const delivered = await coord.waitForEvent(event => event.params.content === 'Waiting for the Coordinator');
  assert.equal(delivered.params.meta!.from, 'human');
  const seen = await drive(within(eyes, 1_000));
  assert.equal((await drive(within(eyeClose, 1_000))).id, seen.id);
  const after = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(after.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await drive(within(closed, 1_000)), poll.id);
});

test('Telegram preserves workbench mention routing including named Aides and item leads', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  const initial = fake.waitForPoll();
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  await drive(within(initial, 1_000));
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
  let poll = await drive(within(polled, 1_000));
  // Updates may arrive while a reaction is in flight; observe the final durable cursor.
  await drive(until(async () => {
    const state = await control<{ pendingPolls: Array<typeof poll> }>(fake.url, 'state');
    const final = state.pendingPolls.find(candidate => candidate.params.offset === 6);
    if (final) poll = final;
    return !!final;
  }, { what: 'all mention messages confirmed', timeoutMs: 1_000 }));
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const remote = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.via === 'telegram');
  assert.deepEqual(remote.map(message => message.to), localTo);
  assert.equal(remote.length, 5);
  await aide.waitForEvent(event => event.params.content === '@aide-1 by name' && event.params.meta?.via === 'telegram');
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await drive(within(closed, 1_000)), poll.id);
});

test('Telegram delivery arriving as stored feedback settles acquires the next reaction owner', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  // The real fake HTTP exchange completes; only its native API receipt is held
  // to select the exact promise-settlement interleaving at the public API seam.
  const held = heldTelegramReaction({ apiRoot: fake.url, clock });
  const store = new Store(join(root, '.cland/hub.db'));
  const native = new TelegramRemote(held.api, clock,
    { store: store.remotes.forMessenger('telegram') });
  owner.close(async () => { held.release(true); await native.stop(); await held.drain(); store.close(); });
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
  const hub = await start({}, { gatewayRemotes: [remote] });
  await drive(within(initial, 1_000));
  const storedClose = fake.waitForConnectionClose('setMessageReaction');
  await control(fake.url, 'say', { text: 'Reaction handoff' });
  const ok = await drive(within(held.completed, 1_000));
  await drive(within(storedClose, 1_000));
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const actual = await coord.waitForEvent(event => event.params.content === 'Reaction handoff');
  assert.equal(actual.params.meta!.via, 'telegram');
  const delivery = await drive(within(heldDelivery.promise, 1_000));
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const eyeClose = fake.waitForConnectionClose('setMessageReaction');
  for (const observation of [eyes, eyeClose]) void observation.catch(() => {});
  // Queue the flush continuation first, then the real delivery frame. Its
  // native receive microtask runs before an old work.then(delete) callback.
  held.release(ok);
  const receiving = native.receive(delivery);
  await drive(Promise.resolve(receiving));
  const seen = await drive(within(eyes, 1_000, undefined, () => new Error('settlement delivery is missing its 👀 reaction')));
  assert.equal((await drive(within(eyeClose, 1_000))).id, seen.id);
  assert.equal(held.maximum(), 1, 'one reaction owner at a time');
  const state = await control<{ requests: Array<{ method: string; params: unknown }>; pendingPolls: Array<{ id: number }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ]);
  const poll = state.pendingPolls[0]!;
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await drive(within(closed, 1_000)), poll.id);
});

test('Telegram restart reconciles a confirmed input whose durable session delivery frame was lost', async t => {
  const { root, clock, fake, owner, start, drive } = await fixture(t);
  const store = new Store(join(root, '.cland/hub.db'));
  const native = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: store.remotes.forMessenger('telegram') });
  owner.close(async () => { await native.stop(); store.close(); });
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
  const first = await start({}, { gatewayRemotes: [remote] });
  const poll = await drive(within(polled, 1_000));
  await drive(within(storedClose, 1_000));
  assert.equal(poll.params.offset, 2, 'the input was confirmed before session delivery');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await coord.waitForEvent(event => event.params.content === 'Recover durable eyes');
  const delivery = await drive(within(dropped.promise, 1_000));
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
  assert.equal(await drive(within(closed, 1_000)), poll.id);
  await coord.close();
  const eyes = fake.waitForRequest('setMessageReaction', receipt => JSON.stringify(receipt.params).includes('👀'));
  const eyeClose = fake.waitForConnectionClose('setMessageReaction');
  for (const observation of [eyes, eyeClose]) void observation.catch(() => {});
  const recovered = fake.waitForPoll();
  const second = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const next = await drive(within(recovered, 1_000));
  const seen = await drive(within(eyes, 1_000, undefined, () => new Error('durable delivery recovery is missing its 👀 reaction')));
  assert.equal((await drive(within(eyeClose, 1_000))).id, seen.id);
  assert.equal(next.params.offset, 2);
  const state = await control<{ requests: Array<{ method: string; params: unknown }> }>(fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'setMessageReaction').map(request => request.params), [
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👌' }] },
    { chat_id: '101', message_id: 1, reaction: [{ type: 'emoji', emoji: '👀' }] },
  ], 'restart repairs delivery feedback without repeating stored feedback');
  const nextClosed = fake.waitForPollClose(next.id);
  await second.stop();
  assert.equal(await drive(within(nextClosed, 1_000)), next.id);
});


test('Telegram unsupported messages reply once confirm and do not replay after restart', async t => {
  const { root, clock, fake, owner, start, drive, logs } = await fixture(t);
  const payloads = [
    { location: { latitude: 1, longitude: 2 } },
    { sticker: { file_id: 'fake-sticker' } },
    { voice: { file_id: 'fake-voice', duration: 1 } },
    { caption: 'caption only' },
    { contact: { phone_number: '123' } },
  ];
  for (const [index, payload] of payloads.entries()) await control(fake.url, 'update', { message: {
    message_id: 100 + index, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, ...payload,
  } });
  await control(fake.url, 'say', { text: 'Text after unsupported input' });
  const polled = owner.observe(signal => fake.waitForPoll(signal));
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const poll = await drive(within(polled, 1_000));
  assert.equal(poll.params.offset, 7);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.map(message => message.text), ['Text after unsupported input']);
  const before = await control<{ messages: TgMessage[] }>(fake.url, 'state');
  assert.deepEqual(before.messages.map(message => message.text), Array(5).fill('This kind of message does not reach General'));
  assert.deepEqual(logs.filter(entry => entry.event === 'telegram-update-unhandled').map(({ ts: _ts, eventsVersion: _version, ...entry }) => entry), payloads.map((_, index) => ({ event: 'telegram-update-unhandled', update: index + 1, kind: 'message' })));
  const closed = owner.observe(signal => fake.waitForPollClose(poll.id, signal));
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  const reopened = owner.observe(signal => fake.waitForPoll(signal));
  const next = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const receipt = await drive(within(reopened, 1_000));
  assert.equal(receipt.params.offset, 7);
  const after = await control<{ messages: TgMessage[] }>(fake.url, 'state');
  assert.deepEqual(after.messages, before.messages, 'confirmed unsupported messages never reply again');
  assert.equal(logs.filter(entry => entry.event === 'telegram-update-unhandled').length, 5);
  const end = owner.observe(signal => fake.waitForPollClose(receipt.id, signal));
  await next.stop();
  assert.equal(await within(end, 1_000), receipt.id);
});

test('Telegram replies to an edit and delivers the following text', async t => {
  const { fake, owner, start, drive, logs } = await fixture(t);
  await control(fake.url, 'update', { edited_message: {
    message_id: 100, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'edited text',
  } });
  await control(fake.url, 'say', { text: 'After edit' });
  const polled = owner.observe(signal => fake.waitForPoll(signal));
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const poll = await drive(within(polled, 1_000));
  assert.equal(poll.params.offset, 3);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.map(message => message.text), ['After edit']);
  assert.deepEqual((await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages.map(m => m.text), ['This kind of message does not reach General']);
  assert.deepEqual(logs.filter(entry => entry.event === 'telegram-update-unhandled').map(({ ts: _ts, eventsVersion: _version, ...entry }) => entry), [{ event: 'telegram-update-unhandled', update: 1, kind: 'edited_message' }]);
  const closed = owner.observe(signal => fake.waitForPollClose(poll.id, signal));
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
});


for (const failure of ['omitted', 'aborted'] as const) test(`Telegram input fixture drains observers after ${failure} setup receipt`, async t => {
  const { root, clock, fake, owner, store } = await fixture(t);
  const setupClock = new FakeClock();
  const abort = new AbortController();
  // This observer never receives its event: disposal must cancel and join it.
  const waiting = owner.observe(signal => fake.waitForPoll(signal));
  const cancelled = assert.rejects(waiting, /observation aborted/);
  await control(fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' });
  await control(fake.url, 'update', { message: { message_id: 900, date: 1,
    chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' },
    sticker: { file_id: 'fake-sticker' },
  } });
  const held = owner.observe(signal => fake.waitForHeldRequest('sendMessage', signal));
  const closed = owner.observe(signal => fake.waitForConnectionClose('sendMessage', signal), { drain: true });
  // A loaded runner may spend over a second acquiring the hub.
  await new Promise(resolve => setTimeout(resolve, 1_100)); // lint-allow-wall-clock: fault injection exceeds the former pre-disposal observer deadline (T-1417)
  const starting = owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock, {
    receipt: new Promise<void>(() => {}), clock: setupClock, signal: abort.signal,
  });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /setup cancelled/);
  const hub = await within(owner.serving, testWaitMs(5_000));
  const receipt = await within(held, testWaitMs(5_000));
  if (failure === 'omitted') await setupClock.advance(1_000);
  else abort.abort(new Error('Telegram pacing fixture setup cancelled'));
  await rejected;
  await owner.dispose();
  await cancelled;
  await hub.stopped;
  assert.equal((await within(closed, testWaitMs(5_000))).id, receipt.id);
  assert.equal(owner.observations(), 0);
  assert.throws(() => store.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
  assert.equal(clock.pending, 0);
  assert.equal(setupClock.pending, 0);
});

test('Telegram photo caption uploads the largest size as one human artifact message', async t => {
  const { fake, owner, start, drive, clean } = await fixture(t);
  const small = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [{ kind: 'photo', content: Buffer.from('small').toString('base64') }] });
  const large = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [{ kind: 'photo', content: Buffer.from('large photo').toString('base64') }] });
  // Override the native update with both independently registered sizes.
  const photo = large[0]!.message!;
  await control(fake.url, 'update', { message: { ...photo, message_id: 99, caption: 'the error', photo: [small[0]!.message!.photo![0], { ...photo.photo![0], width: 100, height: 100 }] } });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery);
  await drive(until(async () => ((await control<{ requests: Array<{ method: string; params: { message_id: number; reaction: Array<{ emoji: string }> } }> }>(fake.url, 'state')).requests.filter(r => r.method === 'setMessageReaction').map(r => r.params)).some(r => r.message_id === 99 && r.reaction[0]?.emoji === '👌'), { what: 'photo stored reaction', timeoutMs: 2_000 }));
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  const messages = history.messages.filter(m => m.text === 'the error');
  assert.equal(messages.length, 1);
  const message = messages[0]!;
  assert.equal(message.from, 'human'); assert.equal(message.via, 'telegram');
  assert.equal(message.artifacts?.length, 1);
  const artifact = message.artifacts![0]!;
  assert.ok(artifact.path.endsWith('.jpg'));
  assert.equal(await (await import('node:fs/promises')).readFile(artifact.path, 'utf8'), 'large photo');
  await clean(ui, hub);
});

test('Telegram documents keep names and empty captions and reply into the mapped topic', async t => {
  const { fake, owner, state, start, drive, clean, frame } = await fixture(t);
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery);
  await ui.request({ type: 'subscribe' });
  const created = await ui.request({ type: 'topic.create', title: 'Document destination' });
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const source = await ui.request({ type: 'topic.send', topic, text: 'Original' });
  const id = (source.value as { message: TopicMessage }).message.id;
  state.putMessage({ chatId: '101', messageId: '500', topic, message: id, ask: null, approval: null });
  const posted = frame(ui, f => f.type === 'message' && (f.message as TopicMessage).artifacts?.[0]?.title === 'reply.pdf');
  const rows = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [{ kind: 'document', file_name: 'plain.bin', content: Buffer.from('plain').toString('base64') }] });
  await control(fake.url, 'update', { message: { ...rows[0]!.message, message_id: 99,
    document: { ...rows[0]!.message!.document, file_name: 'reply.pdf', mime_type: 'application/pdf' },
    reply_to_message: { message_id: 500, chat: { id: 101, type: 'private' }, date: 1 } } });
  const reply = (await drive(posted)).message as TopicMessage;
  assert.equal(reply.topic, topic); assert.equal(reply.replyTo, id); assert.equal(reply.text, '');
  assert.equal(reply.artifacts![0]!.title, 'reply.pdf');
  assert.equal(await (await import('node:fs/promises')).readFile(reply.artifacts![0]!.path, 'utf8'), 'plain');
  const general = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.equal(general.messages.filter(m => m.via === 'telegram').length, 1);
  assert.equal(general.messages.find(m => m.via === 'telegram')!.text, '');
  await clean(ui, hub);
});

test('Telegram refuses a declared 25 MB document without getFile and leaks no file URL or token', async t => {
  const { fake, owner, start, drive, clean } = await fixture(t);
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery);
  await ui.request({ type: 'subscribe' });
  const reply = owner.observe(signal => fake.waitForRequest('sendMessage', r => String(r.params.text).includes('25 MB'), signal));
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'large.bin', file_size: 25 * 1024 * 1024 }] });
  assert.equal((await drive(reply)).params.text, 'large.bin is 25 MB: a bot can download at most 20 MB, so it was not stored');
  const state = await control<{ requests: Array<{ method: string }> }>(fake.url, 'state');
  assert.equal(state.requests.some(r => r.method === 'getFile'), false);
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  await clean(ui, hub);
});

test('Telegram recovers confirmed media once and keeps following text behind it', async t => {
  const { fake, owner, state, start, drive, clean, frame } = await fixture(t);
  const held = owner.observe(signal => fake.waitForHeldRequest('getFile', signal));
  const closed = owner.observe(signal => fake.waitForConnectionClose('getFile', signal), { drain: true });
  await control(fake.url, 'fault', { method: 'getFile', code: 500, response: 'hold' });
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'recover.bin', content: Buffer.from('recover bytes').toString('base64'), caption: 'media first' }] });
  await control(fake.url, 'say', { text: 'text second' });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const heldReceipt = await within(held, testWaitMs(5_000));
  await until(() => state.get('telegram.offset') === '3', { what: 'confirmed media and following text', timeoutMs: 2_000 });
  const ui = await connectUi(t, hub.discovery);
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  await hub.stop();
  assert.equal((await within(closed, testWaitMs(5_000))).id, heldReceipt.id);
  const next = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const nextUi = await connectUi(t, next.discovery);
  await drive(until(async () => {
    const history = (await nextUi.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
    return history.messages.some(m => m.text === 'text second');
  }, { what: 'recovered media then text', timeoutMs: 2_000 }));
  const history = (await nextUi.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.deepEqual(history.messages.map(m => m.text), ['media first', 'text second']);
  assert.equal(history.messages[0]!.artifacts!.length, 1);
  assert.equal(await (await import('node:fs/promises')).readFile(history.messages[0]!.artifacts![0]!.path, 'utf8'), 'recover bytes');
  await clean(nextUi, next);
});

test('Telegram transient media retries once without blocking commands or duplicating a message', async t => {
  const { fake, owner, clock, start, state, drive, clean } = await fixture(t);
  const failure = owner.observe(signal => fake.waitForRequest('getFile', () => true, signal));
  await control(fake.url, 'fault', { method: 'getFile', code: 500 });
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'retry.bin', content: Buffer.from('retry bytes').toString('base64') }] });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  await within(failure, testWaitMs(5_000));
  const ui = await connectUi(t, hub.discovery);
  const command = owner.observe(signal => fake.waitForRequest('sendMessage', r => String(r.params.text).includes('Cancelled'), signal));
  await control(fake.url, 'say', { text: '/cancel' });
  await drive(command);
  await clock.advance(1_000);
  await drive(until(async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.some(m => m.artifacts?.[0]?.title === 'retry.bin'), { what: 'retried artifact', timeoutMs: 2_000 }));
  assert.equal(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.length, 1);
  await drive(until(() => state.get('media.identity:101:1') === 'completed', { what: 'media completion receipt', timeoutMs: 2_000 }));
  assert.equal(state.entries('media.queue:').length, 0);
  await clean(ui, hub);
});

test('media last-owner handoff drains an enqueue in the retiring worker turn', async t => {
  const { MediaQueue } = await import('../src/remote/media.ts');
  const { state, clock, owner } = await fixture(t);
  const abort = new AbortController();
  const first = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const seen: string[] = [];
  const queue = new MediaQueue(state, clock, abort.signal, input => {
    seen.push(input.message);
    if (input.message === '1') { entered.resolve(); return first.promise; }
    finished.resolve(); return Promise.resolve();
  });
  owner.close(async () => { abort.abort(); first.resolve(); await queue.stop(); });
  queue.enqueue({ chat: '101', message: '1', date: 1, caption: '' });
  await within(entered.promise, 1_000);
  first.resolve();
  queueMicrotask(() => queue.enqueue({ chat: '101', message: '2', date: 1, caption: '' }));
  await within(finished.promise, 1_000);
  await until(() => state.get('media.identity:101:2') === 'completed', { what: 'successor completion receipt', timeoutMs: 1_000 });
  assert.deepEqual(seen, ['1', '2']);
});

for (const method of ['getFile', 'download'] as const) for (const action of ['unpair', 'replace'] as const) test(`Telegram held ${method} media cannot publish after pairing ${action}`, async t => {
  const { fake, owner, state, start, drive, clean } = await fixture(t);
  const held = owner.observe(signal => fake.waitForHeldRequest(method, signal));
  const closed = owner.observe(signal => fake.waitForConnectionClose(method, signal), { drain: true });
  await control(fake.url, 'fault', { method, code: 500, response: 'hold' });
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'private.bin', content: Buffer.from('private bytes').toString('base64') }] });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const entered = await within(held, testWaitMs(5_000));
  const ui = await connectUi(t, hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'remote.unpair', messenger: 'telegram' })).ok, true);
  if (action === 'replace') state.setPairing({ userId: '202', chatId: '202', guildId: null, name: 'Replacement human' });
  await control(fake.url, 'release-requests', { ids: [entered.id] });
  assert.equal((await within(closed, testWaitMs(5_000))).id, entered.id);
  await drive(until(() => state.get('media.identity:101:1') === 'completed', { what: 'withdrawn media completion', timeoutMs: 2_000 }));
  assert.deepEqual(((await ui.request({ type: 'artifact.list' })).value as { artifacts: unknown[] }).artifacts, []);
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  await clean(ui, hub);
});

for (const method of ['getFile', 'download'] as const) for (const code of [401, 403, 409]) test(`Telegram media ${method} ${code} saves fatal state and recovers queued work on reload`, async t => {
  const { fake, owner, state, start, drive, clean } = await fixture(t);
  const polled = owner.observe(signal => fake.waitForPoll(signal));
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const poll = await within(polled, testWaitMs(5_000));
  const closed = owner.observe(signal => fake.waitForPollClose(poll.id, signal), { drain: true });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await control(fake.url, 'fault', { method, code });
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'fatal.bin', content: Buffer.from('retained bytes').toString('base64') }] });
  await until(() => state.status().disabled, { what: 'durable fatal media status', timeoutMs: 1_000 });
  const status = (await ui.request({ type: 'remote.status' })).value as { remotes: import('../src/protocol.ts').RemoteStatusRow[] };
  const row = status.remotes.find(r => r.messenger === 'telegram')!;
  assert.equal(row.connection, 'disabled');
  assert.equal(row.stopCause, code === 401 ? 'token' : code === 403 ? 'blocked' : 'other-consumer');
  assert.equal(await within(closed, testWaitMs(5_000)), poll.id);
  assert.equal(state.entries('media.queue:').length, 1);
  const before = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.equal(before.messages.filter(m => m.fromKind === 'hub' && m.text.includes(`(${code})`)).length, 1);
  const resumed = owner.observe(signal => fake.waitForPoll(signal));
  assert.equal((await ui.request({ type: 'hub.reload' })).ok, true);
  await within(resumed, testWaitMs(5_000));
  await drive(until(() => state.get('media.identity:101:1') === 'completed', { what: 'fatal input recovered on unchanged reload', timeoutMs: 2_000 }));
  assert.equal(state.status().disabled, false);
  const after = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.equal(after.messages.filter(m => m.artifacts?.[0]?.title === 'fatal.bin').length, 1);
  await clean(ui, hub);
});

for (const failure of ['omitted', 'aborted'] as const) test(`Telegram held media fixture drains observers after ${failure} setup receipt`, async t => {
  const { root, clock, fake, owner, store } = await fixture(t);
  const setupClock = new FakeClock();
  const abort = new AbortController();
  // This observer never receives its event: disposal must cancel and join it.
  const waiting = owner.observe(signal => fake.waitForHeldRequest('sendDocument', signal));
  const cancelled = assert.rejects(waiting, /observation aborted/);
  await control(fake.url, 'fault', { method: 'getFile', code: 500, response: 'hold' });
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'held.bin', content: Buffer.from('held bytes').toString('base64') }] });
  const held = owner.observe(signal => fake.waitForHeldRequest('getFile', signal));
  const closed = owner.observe(signal => fake.waitForConnectionClose('getFile', signal), { drain: true });
  // A loaded runner may spend over a second acquiring the hub.
  await new Promise(resolve => setTimeout(resolve, 1_100)); // lint-allow-wall-clock: fault injection exceeds the former pre-disposal observer deadline (T-1417)
  const starting = owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock, {
    receipt: new Promise<void>(() => {}), clock: setupClock, signal: abort.signal,
  });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /setup cancelled/);
  const hub = await within(owner.serving, testWaitMs(5_000));
  const receipt = await within(held, testWaitMs(5_000));
  if (failure === 'omitted') await setupClock.advance(1_000);
  else abort.abort(new Error('Telegram pacing fixture setup cancelled'));
  await rejected;
  await owner.dispose();
  await cancelled;
  await hub.stopped;
  assert.equal((await within(closed, testWaitMs(5_000))).id, receipt.id);
  assert.equal(owner.observations(), 0);
  assert.throws(() => store.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
  assert.equal(clock.pending, 0);
  assert.equal(setupClock.pending, 0);
});


for (const action of ['unpair', 'replace'] as const) test(`Telegram upload commit rejects pairing ${action} during native file preparation`, async t => {
  const { root, fake, owner, state, start, drive, clean } = await fixture(t);
  const fs = await import('node:fs/promises');
  const { syncBuiltinESMExports } = await import('node:module');
  const written = Promise.withResolvers<string>();
  const observedWrite = owner.observe(signal => abortable(written.promise, signal));
  const release = Promise.withResolvers<void>();
  const nativeOpen = fs.default.open;
  const mock = t.mock.method(fs.default, 'open', async (...args: Parameters<typeof nativeOpen>) => {
    const file = await nativeOpen(...args);
    if (String(args[0]).includes('/.cland/artifacts/')) {
      const write = file.writeFile.bind(file);
      file.writeFile = async (...values: Parameters<typeof write>) => {
        await write(...values);
        written.resolve(String(args[0]));
        await release.promise;
      };
    }
    return file;
  });
  syncBuiltinESMExports();
  owner.close(() => { release.resolve(); mock.mock.restore(); syncBuiltinESMExports(); });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await control(fake.url, 'media', { items: [{ kind: 'document', file_name: 'commit.bin', content: Buffer.from('commit bytes').toString('base64') }] });
  const path = await within(observedWrite, testWaitMs(5_000));
  assert.equal(await readFile(path, 'utf8'), 'commit bytes', 'native preparation completed before revocation');
  assert.equal((await ui.request({ type: 'remote.unpair', messenger: 'telegram' })).ok, true);
  if (action === 'replace') state.setPairing({ userId: '202', chatId: '202', guildId: null, name: 'Replacement human' });
  release.resolve();
  await drive(until(() => state.get('media.identity:101:1') === 'completed', { what: 'revoked upload completion', timeoutMs: 2_000 }));
  assert.deepEqual(((await ui.request({ type: 'artifact.list' })).value as { artifacts: unknown[] }).artifacts, []);
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  assert.deepEqual(await fs.readdir(join(root, '.cland/artifacts')), []);
  await clean(ui, hub);
});

test('Telegram three-photo album is one ordered captioned message before following text', async t => {
  const { fake, state, start, drive, clean } = await fixture(t);
  await control(fake.url, 'media', { album: true, items: [
    { kind: 'photo', content: Buffer.from('first').toString('base64'), caption: 'album caption' },
    { kind: 'photo', content: Buffer.from('second').toString('base64'), caption: 'ignored' },
    { kind: 'photo', content: Buffer.from('third').toString('base64') },
  ] });
  await control(fake.url, 'say', { text: 'after album' });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery);
  await drive(until(() => state.get('media.identity:101:4') === 'completed', { what: 'following text completed', timeoutMs: 2_000 }));
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.deepEqual(history.messages.map(m => m.text), ['album caption', 'after album']);
  const album = history.messages[0]!;
  assert.deepEqual(await Promise.all(album.artifacts!.map(a => readFile(a.path, 'utf8'))), ['first', 'second', 'third']);
  for (const id of ['1', '2', '3']) assert.equal(state.message('101', id)?.message, album.id);
  await clean(ui, hub);
});

test('Telegram album resumes after two confirmed updates before its third item', async t => {
  const { fake, state, clock, owner, start, drive, clean } = await fixture(t);
  const rows = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [
    { kind: 'photo', content: Buffer.from('one').toString('base64') },
    { kind: 'photo', content: Buffer.from('two').toString('base64'), caption: 'first non-empty' },
  ] });
  const confirmed = owner.observe(signal => fake.waitForRequest('getUpdates', r => r.params.offset === 3, signal));
  const first = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  await until(() => state.get('telegram.offset') === '3', { what: 'second album update durable confirmation', timeoutMs: 2_000 });
  assert.equal((await within(confirmed, testWaitMs(5_000))).params.offset, 3);
  const before = await connectUi(t, first.discovery);
  assert.deepEqual(((await before.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  await first.stop();
  await clock.advance(10_000); // Restart starts a fresh two-second collection window.
  await control(fake.url, 'media', { group: rows[0]!.message!.media_group_id, items: [
    { kind: 'photo', content: Buffer.from('three').toString('base64') },
  ] });
  const second = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, second.discovery);
  await until(() => state.get('telegram.offset') === '4', { what: 'third album update durable confirmation', timeoutMs: 2_000 });
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  await clock.advance(1_999);
  assert.equal(state.get('media.identity:101:1'), 'stored');
  await clock.advance(1);
  await drive(until(() => state.get('media.identity:101:3') === 'completed', { what: 'recovered album completion', timeoutMs: 2_000 }));
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.deepEqual(history.messages.map(m => m.text), ['first non-empty']);
  assert.deepEqual(await Promise.all(history.messages[0]!.artifacts!.map(a => readFile(a.path, 'utf8'))), ['one', 'two', 'three']);
  const native = await control<{ requests: Array<{ method: string; params: { offset?: number; message_id?: number; reaction?: Array<{ emoji: string }> } }> }>(fake.url, 'state');
  assert.deepEqual(native.requests.filter(r => r.method === 'getUpdates').map(r => r.params.offset).filter((offset): offset is number => offset !== undefined), [3, 3, 4]);
  assert.deepEqual(native.requests.filter(r => r.method === 'setMessageReaction' && r.params.reaction?.[0]?.emoji === '👌').map(r => r.params.message_id), [1, 2, 3]);
  await clean(ui, second);
});

test('Telegram four-item album omits the oversized document with one named reply', async t => {
  const { fake, state, clock, start, drive, clean } = await fixture(t);
  await control(fake.url, 'media', { items: [
    { kind: 'photo', content: Buffer.from('a').toString('base64'), caption: 'mixed album' },
    { kind: 'document', file_name: 'too-large.pdf', file_size: 25 * 1024 * 1024 },
    { kind: 'photo', content: Buffer.from('b').toString('base64') },
    { kind: 'photo', content: Buffer.from('c').toString('base64') },
  ] });
  const hub = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery);
  await until(() => state.get('telegram.offset') === '5', { what: 'four album updates confirmed after storage', timeoutMs: 2_000 });
  await clock.advance(2_000);
  await drive(until(() => state.get('media.identity:101:4') === 'completed', { what: 'mixed album completed', timeoutMs: 2_000 }));
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.deepEqual(history.messages.map(m => m.text), ['mixed album']);
  assert.deepEqual(await Promise.all(history.messages[0]!.artifacts!.map(a => readFile(a.path, 'utf8'))), ['a', 'b', 'c']);
  const native = await control<{ requests: Array<{ method: string }>; messages: TgMessage[] }>(fake.url, 'state');
  assert.equal(native.requests.filter(r => r.method === 'getFile').length, 3);
  assert.deepEqual(native.messages.map(m => m.text), ['too-large.pdf is 25 MB: a bot can download at most 20 MB, so it was not stored']);
  for (const id of ['1', '2', '3', '4']) assert.equal(state.message('101', id)?.message, history.messages[0]!.id);
  await clean(ui, hub);
});

test('Telegram committed album repairs every member after lost upload result without expired files', async t => {
  const { clock, fake, owner, state, start, drive, clean } = await fixture(t);
  const native = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
  owner.close(() => native.stop());
  const lost = Promise.withResolvers<TopicMessage>();
  const dropped = owner.observe(signal => abortable(lost.promise, signal));
  const remote: Remote = { id: native.id, via: native.via, start: (...args) => native.start(...args),
    stop: () => native.stop(), run: () => native.run(), receive: frame => {
      if (frame.type === 'result' && frame.ok && (frame.value as { message?: TopicMessage }).message?.text === 'committed album') {
        lost.resolve((frame.value as { message: TopicMessage }).message);
        return;
      }
      return native.receive(frame);
    } };
  const confirmed = owner.observe(signal => fake.waitForRequest('getUpdates', r => r.params.offset === 3, signal));
  await control(fake.url, 'media', { items: [
    { kind: 'photo', content: Buffer.from('saved one').toString('base64'), caption: 'committed album' },
    { kind: 'photo', content: Buffer.from('saved two').toString('base64') },
  ] });
  const first = await start({}, { gatewayRemotes: [remote] });
  await within(confirmed, testWaitMs(5_000));
  await clock.advance(2_000);
  const original = await within(dropped, testWaitMs(5_000));
  const ui = await connectUi(t, first.discovery);
  assert.equal(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages[0]!.id, original.id);
  assert.equal(state.message('101', '2'), null, 'result never reached the adapter');
  await first.stop();
  assert.equal(state.get('media.identity:101:2'), 'stored');
  assert.equal((await control<{ expired: number }>(fake.url, 'expire-files', {})).expired, 2);
  const second = await start({ CLAND_TELEGRAM_API_ROOT: fake.url });
  const recovered = await connectUi(t, second.discovery);
  await drive(until(() => state.get('media.identity:101:2') === 'completed', { what: 'committed album repaired', timeoutMs: 2_000 }));
  for (const id of ['1', '2']) assert.equal(state.message('101', id)?.message, original.id);
  const history = (await recovered.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.deepEqual(history.messages.map(m => m.id), [original.id]);
  assert.deepEqual(await Promise.all(history.messages[0]!.artifacts!.map(a => readFile(a.path, 'utf8'))), ['saved one', 'saved two']);
  const platform = await control<{ requests: Array<{ method: string; params: { message_id?: number; reaction?: Array<{ emoji: string }> } }> }>(fake.url, 'state');
  assert.equal(platform.requests.filter(r => r.method === 'getFile').length, 2, 'restart does not need expired native files');
  assert.deepEqual(platform.requests.filter(r => r.method === 'setMessageReaction' && r.params.reaction?.[0]?.emoji === '👌').map(r => r.params.message_id), [1, 2]);
  await clean(recovered, second);
});
