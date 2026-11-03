// T2: users-mode Telegram fan-out and native answers against the sealed Bot API.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, connectUi, inProcessSpoke, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { TelegramApi, type TgMessage } from '../src/remote/telegram-api.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { pacingOwner, driveTelegram } from './telegram-pacing-fixture.ts';
import { nativeReplyHold } from './native-reply-hold.ts';
import type { TopicMessage } from '../src/protocol.ts';
import { within } from '../src/executor/droplet/deadline.ts';

async function fixture(t: TestContext) {
  const owner = pacingOwner(t), root = await tempProject(t), clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock }); owner.close(() => fake.close(), { startupOnly: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram users'); config.auth.mode = 'users';
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = owner.store(join(root, '.cland/hub.db'));
  const alice = store.users.firstAdmin('Alice', [], 1), bob = store.users.add('bob', 'Bob', [], 2);
  store.users.setMode('users', 3);
  const invite = store.users.mintInvite(bob.id, clock.now().getTime());
  store.users.registerPassword(invite, 'fixture-hash', clock.now().getTime(), () => {});
  const state = store.remotes.forMessenger('telegram');
  state.setUserPairing(alice.id, { userId: '101', chatId: '101', guildId: null, name: 'Alice' });
  state.setUserPairing(bob.id, { userId: '202', chatId: '202', guildId: null, name: 'Bob' });
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock });
  const remote = new TelegramRemote(api, clock, { store: state });
  const frames: Array<Record<string, unknown>> = [];
  const start = remote.start.bind(remote);
  remote.start = (send, ...rest) => start((frame, ...args) => { frames.push(frame); send(frame, ...args); }, ...rest);
  owner.close(() => remote.stop());
  const initial = fake.waitForPoll();
  const hub = await owner.start(root, {}, clock, { hubOptions: { gatewayRemotes: [remote] } });
  await within(initial, 1000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const messages = async () => (await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages;
  const wait = (predicate: () => Promise<boolean>, what: string) => {
    const work = owner.observe(async signal => {
      await driveTelegram(clock, state, until(async () => signal.aborted || await predicate(), { timeoutMs: 1500, what }));
      signal.throwIfAborted();
    });
    void work.catch(() => {}); return work;
  };
  return { owner, store, state, clock, fake, hub, ui, coord, messages, wait, bob, frames, api };
}

async function secondPress(t: TestContext, f: Awaited<ReturnType<typeof fixture>>, press: Record<string, unknown>) {
  const hold = nativeReplyHold(t), answer = f.api.answerCallbackQuery.bind(f.api);
  f.api.answerCallbackQuery = async (...args) => {
    const result = await answer(...args);
    if (args[0].callback_query_id === press.id) await hold.pause();
    return result;
  };
  let updateId = -1, completed = false;
  const completion = f.wait(async () => updateId >= 0 && f.state.get(`telegram.update:${updateId}`) === '1', 'exact callback update durably completed').then(() => { completed = true; });
  try {
    const update = await control<{ update_id: number }>(f.fake.url, 'callback', { callback_query: press });
    updateId = update.update_id;
    await hold.entered();
    assert.equal(f.state.get(`telegram.update:${updateId}`), null, 'post-ack handler remains unfinished');
    assert.equal(completed, false, 'completion observer must wait past native acknowledgement');
    hold.release();
    await completion;
    assert.equal(f.state.get(`telegram.update:${updateId}`), '1');
  } finally { hold.release(); await completion; f.api.answerCallbackQuery = answer; }
}

test('Telegram users receive General once each and mirror native text only to the other owner', async t => {
  const f = await fixture(t);
  const both = f.wait(async () => (await f.messages()).filter(m => m.text?.includes('Coordinator line')).length === 2, 'two General native receipts');
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Coordinator line' })).ok, true);
  await both;
  const mirrored = f.wait(async () => (await f.messages()).some(m => m.chat.id === 101 && m.text?.includes('Bob phone')), 'cross-user native message receipt');
  await control(f.fake.url, 'update', { message: { message_id: 80, date: Math.floor(f.clock.now().getTime() / 1000), chat: { id: 202, type: 'private' }, from: { id: 202, is_bot: false, first_name: 'Bob' }, text: 'Bob phone' } });
  await mirrored;
  await f.hub.stop();
  const messages = await f.messages();
  assert.deepEqual(messages.filter(m => m.text?.includes('Coordinator line')).map(m => m.chat.id).sort(), [101, 202]);
  const copies = messages.filter(m => m.text?.includes('Bob phone'));
  assert.equal(copies.length, 1); assert.equal(copies[0]!.chat.id, 101); assert.match(copies[0]!.text!, /Bob/);
});

test('Telegram users answer once and fold every mapped card with the answerer', async t => {
  const f = await fixture(t);
  let id = '';
  const published = f.wait(async () => !!id && f.state.messagesForAsk(id).length === 2, 'both durable ask mappings');
  const ask = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Choose users', options: ['Ship', 'Wait'] });
  assert.equal(ask.ok, true); id = ask.ask; await f.clock.advance(250); await published;
  const card = f.state.messagesForAsk(id).find(m => m.chatId === '202')!;
  const aliceNative = (await f.messages()).find(m => m.chat.id === 101 && m.text?.includes('Choose users'))!;
  const aliceMarkup = aliceNative.reply_markup as { inline_keyboard: Array<Array<{ callback_data: string }>> };
  const folded = f.wait(async () => (await f.messages()).filter(m => m.text?.includes('Choose users') && m.text.includes('bob via Telegram') && JSON.stringify(m.reply_markup) === '{"inline_keyboard":[]}').length === 2, 'both folded native cards naming Bob');
  const native = (await f.messages()).find(m => m.chat.id === 202 && m.message_id === Number(card.messageId))!;
  const markup = native.reply_markup as { inline_keyboard: Array<Array<{ callback_data: string }>> };
  await control(f.fake.url, 'callback', { callback_query: { id: 'bob-press', from: { id: 202, is_bot: false, first_name: 'Bob' }, message: native, data: markup.inline_keyboard[0]![0]!.callback_data } });
  await folded;
  const closure = JSON.parse(f.state.get(`telegram.card-closure:${id}`)!);
  assert.equal(closure.outcome.userId, f.bob.id); assert.equal(closure.outcome.text, 'Ship');
  const before = await f.messages();
  await secondPress(t, f, { id: 'alice-second', from: { id: 101, is_bot: false, first_name: 'Alice' }, message: before.find(m => m.chat.id === 101 && m.text?.includes('Choose users'))!, data: aliceMarkup.inline_keyboard[1]![0]!.callback_data });
  const requests = (await control<{ requests: Array<{ method: string; params: Record<string, unknown> }> }>(f.fake.url, 'state')).requests;
  assert.equal(requests.find(r => r.method === 'answerCallbackQuery' && r.params.callback_query_id === 'alice-second')!.params.text, 'Already answered');
  for (const card of before.filter(m => m.text?.includes('Choose users'))) assert.equal(requests.filter(r => r.method === 'editMessageText' && r.params.message_id === card.message_id && String(r.params.chat_id) === String(card.chat.id)).length, 1);

  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(history.filter(m => m.answerTo === id).length, 1);
  assert.equal(f.frames.filter(frame => frame.type === 'topic.answer').length, 1);
  assert.deepEqual(history.find(m => m.id === id)!.ask!.outcome, closure.outcome);
  assert.deepEqual((await f.messages()).filter(m => m.text?.includes('Choose users')), before.filter(m => m.text?.includes('Choose users')));
  await f.hub.stop();
});

test('Telegram users keep a failed chat outbox and gap independent from the healthy chat', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'sendRichMessage', code: 503 });
  const settled = f.wait(async () => f.state.outbox().filter(j => j.kind === 'general' && ['sent', 'missed'].includes(j.state)).length === 2, 'failed and healthy chat durable settlements');
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Partial outage' })).ok, true);
  await settled;
  const failed = f.state.outbox().find(j => j.kind === 'general' && j.state === 'missed')!;
  const healthy = f.state.outbox().find(j => j.kind === 'general' && j.state === 'sent')!;
  const chat = (j: typeof failed) => String((j.payload as { params: { chat_id: string } }).params.chat_id);
  assert.notEqual(chat(failed), chat(healthy));
  assert.equal(f.state.get(`telegram.outbox.unavailable:${chat(healthy)}`), null);
  const more = f.wait(async () => f.state.outbox().filter(j => j.kind === 'general' && ['sent', 'missed'].includes(j.state)).length === 4, 'second healthy chat send despite failed peer');
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Healthy continues' })).ok, true);
  await more;
  assert.equal(f.state.outbox().filter(j => j.kind === 'general' && chat(j) === chat(healthy) && j.state === 'sent').length, 2);
  const recovered = f.wait(async () => f.state.outbox().filter(j => j.kind === 'general' && j.state === 'reported').length === 2, 'captured failed-chat gap receipt');
  await control(f.fake.url, 'release-polls', {});
  await recovered;
  const gaps = (await f.messages()).filter(m => m.text?.includes('General messages missed'));
  assert.equal(gaps.length, 1); assert.equal(String(gaps[0]!.chat.id), chat(failed));
  assert.match(gaps[0]!.text!, /^2 General messages missed/);
  assert.equal(f.state.attempts(failed.id).length, 1, 'unknown native sends remain fenced during recovery');
  await f.hub.stop();
});

for (const unpairFirst of [false, true]) test(`Telegram users fold approval copies (first user unpaired: ${unpairFirst})`, async t => {
  const f = await fixture(t);
  const first = f.store.users.first()!;
  if (unpairFirst) f.state.removeUserPairing(first.id);
  const launched = await f.ui.request({ type: 'session.launch', name: 'approval-worker', harness: 'codex', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  let id = '';
  const mapped = f.wait(async () => !!id && f.state.messagesForApproval(id).length === (unpairFirst ? 1 : 2), 'remaining owner approval mapping');
  const delta = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { session: string }).session === 'approval-worker', 1000);
  f.hub.fakes.codex!.raiseApproval('approval-worker', { id: 'remote', kind: 'command', subject: { command: 'echo users' }, choices: ['once', 'deny'] });
  id = ((await delta).approval as { id: string }).id;
  await f.clock.advance(250); await mapped;
  const aliceNative = (await f.messages()).find(m => m.chat.id === 101 && m.text?.includes('echo users'));
  const aliceMarkup = aliceNative?.reply_markup as { inline_keyboard: Array<Array<{ callback_data: string }>> } | undefined;
  const native = (await f.messages()).find(m => m.chat.id === 202 && m.text?.includes('echo users'))!;
  const markup = native.reply_markup as { inline_keyboard: Array<Array<{ callback_data: string }>> };
  const folded = f.wait(async () => (await f.messages()).filter(m => m.text?.includes('echo users') && m.text.includes('Approved once · bob via Telegram') && JSON.stringify(m.reply_markup) === '{"inline_keyboard":[]}').length === (unpairFirst ? 1 : 2), 'remaining owner folded approval receipt');
  await control(f.fake.url, 'callback', { callback_query: { id: 'bob-approval', from: { id: 202, is_bot: false, first_name: 'Bob' }, message: native, data: markup.inline_keyboard[0]![0]!.callback_data } });
  await folded;
  assert.equal(JSON.parse(f.state.get(`telegram.approval-closure:${id}`)!).userId, f.bob.id);
  if (!unpairFirst) {
    const saved = f.store.inboxOutcome('approval', id)!;
    const before = (await f.messages()).filter(m => m.text?.includes('echo users'));
    await secondPress(t, f, { id: 'alice-approval-second', from: { id: 101, is_bot: false, first_name: 'Alice' }, message: before.find(m => m.chat.id === 101)!, data: aliceMarkup!.inline_keyboard.flat().at(-1)!.callback_data });
    const requests = (await control<{ requests: Array<{ method: string; params: Record<string, unknown> }> }>(f.fake.url, 'state')).requests;
    assert.equal(requests.find(r => r.method === 'answerCallbackQuery' && r.params.callback_query_id === 'alice-approval-second')!.params.text, 'Already answered');
    assert.equal(f.frames.filter(frame => frame.type === 'approval.answer').length, 1);
    assert.equal(saved.userId, f.bob.id); assert.deepEqual(f.store.inboxOutcome('approval', id), saved);
    assert.deepEqual((await f.messages()).filter(m => m.text?.includes('echo users')), before);
    for (const card of before) assert.equal(requests.filter(r => r.method === 'editMessageText' && r.params.message_id === card.message_id && String(r.params.chat_id) === String(card.chat.id)).length, 1);
    for (const card of before) { assert.match(card.text!, /Approved once · bob via Telegram/); assert.deepEqual(card.reply_markup, { inline_keyboard: [] }); }
  }

  await f.hub.stop();
});

for (const recovery of ['gap', 'long outage']) test(`Telegram blocked chat during ${recovery} leaves healthy General cards and native input usable`, async t => {
  const f = await fixture(t);
  const blocked = f.state.publicationPairings()[0]!, healthy = f.state.publicationPairings()[1]!;
  let askId = '';
  if (recovery === 'gap') {
    const at = f.clock.now().toISOString();
    f.state.putOutbox({ id: 'blocked-missed', kind: 'general', source: 'blocked-line', state: 'missed', created: at, updated: at,
      payload: { telegram: true, userId: blocked.userId, clandUserId: blocked.clandUserId, params: { chat_id: blocked.chatId } } });
  } else {
    const original = until(() => !!askId && f.state.messagesForAsk(askId).length === 2, { timeoutMs: 1500, what: 'both original cards mapped before outage' });
    void original.catch(() => {});
    const ask = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Healthy recovery card', options: ['Ship'] });
    assert.equal(ask.ok, true); askId = ask.ask; await f.clock.advance(250);
    await driveTelegram(f.clock, f.state, original);
    const offline = until(() => !!f.state.get('telegram.outage'), { timeoutMs: 1000, what: 'global polling outage persisted' });
    await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 240 });
    await control(f.fake.url, 'release-polls', {}); await offline;
  }
  for (let i = 0; i < 6; i++) await control(f.fake.url, 'fault', { method: 'sendMessage', chat_id: blocked.chatId, code: 403 });
  const outage = f.state.get('telegram.outage');
  const card = until(() => !!askId && f.state.messagesForAsk(askId).filter(m => m.chatId === healthy.chatId).length === (recovery === 'long outage' ? 2 : 1), { timeoutMs: 1500, what: 'healthy chat durable card mapping during blocked recovery' });
  void card.catch(() => {});
  if (!askId) {
    const ask = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Healthy recovery card', options: ['Ship'] });
    assert.equal(ask.ok, true); askId = ask.ask; await f.clock.advance(250);
  }
  if (recovery === 'long outage') await f.clock.advance(240_000);
  else await control(f.fake.url, 'release-polls', {});
  await driveTelegram(f.clock, f.state, card);
  if (outage) {
    const since = JSON.parse(outage).since;
    await f.wait(async () => f.state.get(`telegram.catchup:${healthy.chatId}:${since}:done`) === '1', 'healthy catch-up completion checkpoint');
  }
  const general = f.wait(async () => (await f.messages()).some(m => String(m.chat.id) === healthy.chatId && m.text?.includes('Healthy recovery line')), 'healthy native General after blocked recovery');
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Healthy recovery line' })).ok, true);
  await general;
  const stored = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as { text: string }).text === 'Healthy native input', 1000);
  await control(f.fake.url, 'update', { message: { message_id: 88, date: Math.floor(f.clock.now().getTime() / 1000), chat: { id: Number(healthy.chatId), type: 'private' }, from: { id: Number(healthy.userId), is_bot: false, first_name: 'Healthy' }, text: 'Healthy native input' } });
  const native = await stored;
  assert.equal((native.message as { userId: string }).userId, healthy.clandUserId);
  assert.equal(f.state.status().disabled, false);
  if (recovery === 'long outage') assert.ok(f.state.outbox().some(j => {
    const key = (j.payload as { key?: string }).key;
    return key?.startsWith(`telegram.catchup:${blocked.chatId}:`) && j.state === 'uncertain' && f.state.attempts(j.id).length === 1;
  }), 'blocked replacement card reaches its native attempt fence during catch-up');
  if (recovery === 'gap') {
    assert.equal(f.state.outbox(undefined, 'blocked-missed')[0]!.state, 'missed');
    const saved = JSON.parse(f.state.get(`telegram.gap:${blocked.chatId}`)!);
    assert.equal(saved.owner, blocked.clandUserId, 'blocked gap keeps its captured project owner');
    const notice = f.state.outbox().find(j => (j.payload as { key?: string }).key === saved.key)!;
    assert.equal(notice.state, 'uncertain');
    assert.equal(f.state.attempts(notice.id).length, 1, 'blocked informational send is never retried without non-delivery proof');
  }
  await f.hub.stop();
});

for (const effect of ['General', 'gap']) test(`Telegram held ${effect} in one chat cannot hold healthy native input behind recovery`, async t => {
  const f = await fixture(t);
  const heldOwner = f.state.publicationPairings()[0]!, healthy = f.state.publicationPairings()[1]!;
  const method = effect === 'General' ? 'sendRichMessage' : 'sendMessage';
  await control(f.fake.url, 'fault', { method, chat_id: heldOwner.chatId, code: 500, response: 'hold' });
  const entered = f.fake.waitForHeldRequest(method);
  void entered.catch(() => {});
  if (effect === 'General') {
    assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Held outbound' })).ok, true);
  } else {
    const at = f.clock.now().toISOString();
    f.state.putOutbox({ id: 'held-gap-source', source: 'line', kind: 'general', state: 'missed', created: at, updated: at,
      payload: { telegram: true, userId: heldOwner.userId, clandUserId: heldOwner.clandUserId, params: { chat_id: heldOwner.chatId } } });
    await control(f.fake.url, 'release-polls', {});
  }
  const held = await within(entered, 1000);
  const job = f.state.outbox().find(j => j.state === 'sending' && String((j.payload as { params: { chat_id: string } }).params.chat_id) === heldOwner.chatId)!;
  assert.ok(job);
  try {
    const committed = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as { text: string }).text === 'Healthy before release', 1000);
    void committed.catch(() => {});
    // Complete the current empty poll before queueing the next input; the held
    // drain must not become a barrier between that completion and getUpdates.
    await control(f.fake.url, 'release-polls', {});
    await control(f.fake.url, 'update', { message: { message_id: 89, date: Math.floor(f.clock.now().getTime() / 1000), chat: { id: Number(healthy.chatId), type: 'private' }, from: { id: Number(healthy.userId), is_bot: false, first_name: 'Healthy' }, text: 'Healthy before release' } });
    const frame = await committed;
    assert.equal((frame.message as { userId: string }).userId, healthy.clandUserId);
    assert.equal(f.state.outbox(undefined, job.id)[0]!.state, 'sending', 'healthy input committed while A remains held');
  } finally {
    await control(f.fake.url, 'release-requests', { ids: [held.id] });
    await until(() => f.state.outbox(undefined, job.id)[0]!.state === 'sent', { timeoutMs: 1000, what: 'released native A send durably settled' });
    await f.hub.stop();
    assert.equal(f.state.outbox(['sending']).length, 0);
    assert.equal(f.clock.pending, 0);
  }
});

test('Telegram stop joins an independently owned held gap recovery before returning', async t => {
  const f = await fixture(t), owner = f.state.publicationPairings()[0]!;
  const at = f.clock.now().toISOString();
  f.state.putOutbox({ id: 'stop-gap-source', source: 'line', kind: 'general', state: 'missed', created: at, updated: at,
    payload: { telegram: true, userId: owner.userId, clandUserId: owner.clandUserId, params: { chat_id: owner.chatId } } });
  await control(f.fake.url, 'fault', { method: 'sendMessage', chat_id: owner.chatId, code: 500, response: 'hold' });
  const entered = f.fake.waitForHeldRequest('sendMessage');
  await control(f.fake.url, 'release-polls', {});
  const held = await within(entered, 1000);
  const job = f.state.outbox().find(j => j.state === 'sending')!;
  const closed = f.fake.waitForConnectionClose('sendMessage');
  const stopped = f.hub.stop();
  assert.equal((await within(closed, 1000)).id, held.id);
  await stopped;
  assert.equal(f.state.outbox(undefined, job.id)[0]!.state, 'uncertain');
  assert.equal(f.state.attempts(job.id).at(-1)!.outcome, 'unknown');
  assert.equal(f.clock.pending, 0);
});
