// T2: human frames and production Telegram renderer against the sealed fake Bot API.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { cardWebOwner } from './telegram-card-web-fixture.ts';
import { connectUi, inProcessSpoke, tempProject, until } from './harness.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { TelegramApi, type TgMessage } from '../src/remote/telegram-api.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { driveTelegram, pacingOwner } from './telegram-pacing-fixture.ts';
import type { HubFrame } from '../src/protocol.ts';
import type { Remote } from '../src/remote/gateway.ts';
import { within } from '../src/executor/droplet/deadline.ts';

async function fixture(t: TestContext, drop?: (frame: HubFrame) => boolean) {
  const web = cardWebOwner(t);
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = fakeTelegramFixture(t, { clock });
  owner.close(() => native.close(), { startupOnly: true });
  const fake = await native.start();
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = owner.store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const newRemote = (intercept?: (frame: HubFrame) => boolean) => {
    const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
    owner.close(() => remote.stop());
    const gateway: Remote = { id: remote.id, via: remote.via, start: (...args) => remote.start(...args),
      receive: frame => intercept?.(frame) ? undefined : remote.receive(frame), run: () => remote.run(), stop: () => remote.stop() };
    return { remote, gateway };
  };
  const { remote, gateway } = newRemote(drop);
  const initial = fake.waitForPoll();
  const hub = await owner.start(root, {}, clock, { hubOptions: { gatewayRemotes: [gateway] } });
  await within(initial, 1000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const messages = async () => (await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages;
  const ask = async (question = 'Which release?', options = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'], free = true, topic = 'general') => {
    let card: TgMessage | undefined;
    let id: string | undefined;
    const mapped = until(async () => {
      card = (await messages()).find(message => !!id && state.message('101', String(message.message_id))?.ask === id && !!message.reply_markup);
      return !!card && !!id && state.message('101', String(card.message_id))?.ask === id;
    }, { timeoutMs: 1000, what: 'accepted ask card with durable native mapping' });
    void mapped.catch(() => {});
    const result = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question, options, free });
    assert.equal(result.ok, true, JSON.stringify(result));
    id = result.ask;
    await clock.advance(250); // Publish the committed ask through the inbox coalescing window.
    await driveTelegram(clock, state, mapped);
    return { id, card: card! };
  };
  const stop = async () => { await web.dispose(); await hub.stop(); };
  return { web, stop, owner, root, clock, fake, store, state, remote, hub, ui, coord, messages, ask, newRemote };
}

test('Telegram nine-option free ask arrives as one entities card with eleven opaque button rows', async t => {
  const f = await fixture(t);
  const { id, card } = await f.ask();
  assert.match(card.text!, /coord.*General/);
  assert.match(card.text!, /Which release\?/);
  assert.ok(card.entities?.length);
  const markup = card.reply_markup as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  assert.deepEqual(markup.inline_keyboard.map(row => row.map(button => button.text)), [
    ['One'], ['Two'], ['Three'], ['Four'], ['Five'], ['Six'], ['Seven'], ['Eight'], ['Nine'], ['Other answer…'], ['Decline…'],
  ]);
  const keys = markup.inline_keyboard.flat().map(button => button.callback_data);
  assert.equal(new Set(keys).size, 11);
  for (const key of keys) { assert.ok(Buffer.byteLength(key) <= 64); assert.equal(key.includes(id), false); }
  await f.stop();
  assert.equal((await f.messages()).length, 1);
});

test('Telegram option three commits via Telegram before callback answer and offset, then edits the outcome', async t => {
  const f = await fixture(t);
  const { id, card } = await f.ask();
  await control(f.fake.url, 'fault', { method: 'answerCallbackQuery', code: 500, response: 'hold' });
  const answering = f.fake.waitForHeldRequest('answerCallbackQuery');
  const edited = until(async () => (await f.messages()).some(message => message.message_id === card.message_id && message.text?.includes('Three · human via Telegram')),
    { timeoutMs: 1000, what: 'native outcome edit' });
  void edited.catch(() => {});
  const press = await control<{ update_id: number; callback_query: { id: string } }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  const held = await within(answering, 1000);
  const saved = f.store.ask(id)!;
  assert.equal(saved.state, 'answered');
  assert.deepEqual(saved.outcome, { status: 'answered', text: 'Three', option: 3, by: 'human', at: saved.outcome!.at, via: 'telegram' });
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), null);
  const confirmed = f.fake.waitForPoll();
  await control(f.fake.url, 'release-requests', { ids: [held.id] });
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, edited);
  const outcome = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.equal(outcome.text, `coord · General\n\nWhich release?\n\nThree · human via Telegram · ${new Date(saved.outcome!.at).toTimeString().slice(0, 5)}`);
  assert.deepEqual(outcome.reply_markup, { inline_keyboard: [] });
  await f.stop();
});


test('Telegram callback replay after committed answer and lost result returns its durable receipt once', async t => {
  const lost = Promise.withResolvers<void>();
  const f = await fixture(t, frame => {
    if (frame.type === 'result' && frame.ok && (frame.value as { message?: { answerTo?: string } }).message?.answerTo) {
      lost.resolve(); return true;
    }
    return false;
  });
  const { id, card } = await f.ask();
  const press = await control<{ update_id: number; callback_query: { id: string } }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  await within(lost.promise, 1000);
  const answer = f.store.ask(id)!.answer;
  assert.ok(answer);
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), null);
  assert.equal(f.state.get(`telegram.press:${press.callback_query.id}`), 'pending');
  await f.stop();
  f.ui.close(); await f.coord.close();
  const next = f.newRemote();
  const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
  const confirmed = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next.gateway] } });
  const ack = await driveTelegram(f.clock, f.state, within(acknowledged, 1000));
  assert.equal(ack.params.text, 'Answered');
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  assert.equal(f.store.ask(id)!.answer, answer);
  const ui = await connectUi(t, hub.discovery);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ answerTo?: string }> };
  assert.equal(history.messages.filter(message => message.answerTo === id).length, 1);
  assert.equal(f.state.get(`telegram.press:${press.callback_query.id}`), 'Answered');
  await hub.stop();
});

test('Telegram refuses unissued and cross-ask button data and keeps auxiliary actions unavailable', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const first = await f.ask('First question');
  const second = await f.ask('Second question');
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url });
  const firstMarkup = first.card.reply_markup as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  const press = async (row: number, expected: string) => {
    const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
    const confirmed = f.fake.waitForPoll();
    const update = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: second.card.message_id, row, column: 0 });
    assert.equal((await within(acknowledged, 1000)).params.text, expected);
    assert.equal((await within(confirmed, 1000)).params.offset, update.update_id + 1);
  };
  await press(9, 'Not available yet');
  await press(10, 'Not available yet');
  for (const data of ['not-issued-by-this-hub', firstMarkup.inline_keyboard[2]![0]!.callback_data]) {
    await api.editMessageText({ chat_id: '101', message_id: second.card.message_id, text: second.card.text!,
      reply_markup: { inline_keyboard: [[{ text: 'Untrusted choice', callback_data: data }]] } }, { signal: AbortSignal.timeout(1000) });
    await press(0, 'This button is not available');
    assert.equal(f.store.ask(first.id)!.state, 'open');
    assert.equal(f.store.ask(second.id)!.state, 'open');
  }
  await f.stop();
});

for (const failure of ['not-modified', 'failed'] as const) test(`Telegram ${failure} outcome edit settles with ${failure === 'failed' ? 'one reply' : 'no reply'}`, async t => {
  const f = await fixture(t);
  const { id, card } = await f.ask();
  await control(f.fake.url, 'fault', { method: 'editMessageText', code: 400,
    description: failure === 'not-modified' ? 'Bad Request: message is not modified' : 'Bad Request: message cannot be edited' });
  const settled = until(() => {
    const jobs = f.state.outbox().filter(job => job.kind === 'edit' && job.source === id);
    return jobs.length === 1 && jobs.every(job => job.state === (failure === 'failed' ? 'dropped' : 'sent'))
      && f.state.outbox().filter(job => job.source === id).every(job => job.state === 'sent' || job.state === 'dropped');
  }, { timeoutMs: 1500, what: 'durable outcome edit and fallback settlement' });
  void settled.catch(() => {});
  const confirmed = f.fake.waitForPoll();
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  assert.equal((await within(confirmed, 1000)).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, settled);
  await f.stop();
  const messages = await f.messages();
  assert.equal(messages.length, failure === 'failed' ? 2 : 1);
  if (failure === 'failed') {
    assert.match(messages[1]!.text!, /Three · human via Telegram · \d\d:\d\d/);
    assert.equal(messages[1]!.reply_to_message!.message_id, card.message_id);
    assert.deepEqual(messages[1]!.reply_markup, { inline_keyboard: [] });
  }
  const requests = (await control<{ requests: Array<{ method: string }> }>(f.fake.url, 'state')).requests;
  assert.equal(requests.filter(request => request.method === 'editMessageText').length, 1);
});

test('Telegram card definite 400 falls back to plain text with the same buttons and durable ask map', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 400 });
  const { id, card } = await f.ask();
  assert.equal(card.entities?.length ?? 0, 0);
  assert.equal(f.state.message('101', String(card.message_id))!.ask, id);
  assert.equal((card.reply_markup as { inline_keyboard: unknown[] }).inline_keyboard.length, 11);
  await f.stop();
  assert.equal((await f.messages()).length, 1);
});


test('Telegram long ask keeps one card and every label while reserving a word-boundary preview for the outcome', async t => {
  const f = await fixture(t);
  const question = 'A complete 📦 word '.repeat(250);
  const options = Array.from({ length: 9 }, (_, i) => `Option ${i + 1}: ${'full label '.repeat(15)}`.trim());
  const { card } = await f.ask(question, options);
  assert.ok([...card.text!].length <= 4096 - 1000);
  assert.ok(card.text!.endsWith('…\nfull question in the workbench'));
  const preview = card.text!.split('\n\n')[1]!.split('…')[0]!;
  assert.ok(question.startsWith(preview));
  assert.match(preview, /(?:A|complete|📦|word)$/);
  const buttons = (card.reply_markup as { inline_keyboard: Array<Array<{ text: string }>> }).inline_keyboard;
  assert.deepEqual(buttons.slice(0, 9).map(row => row[0]!.text), options);
  assert.equal(buttons.length, 11);
  const edited = until(async () => {
    const current = (await f.messages()).find(message => message.message_id === card.message_id)!;
    return !!current.text?.includes('human via Telegram') && f.state.outbox().some(job => job.kind === 'edit' && job.state === 'sent');
  }, { timeoutMs: 1000, what: 'bounded long-ask outcome edit and durable settlement' });
  void edited.catch(() => {});
  await control(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  await driveTelegram(f.clock, f.state, edited);
  await f.stop();
  const messages = await f.messages();
  assert.equal(messages.length, 1);
  assert.ok([...messages[0]!.text!].length <= 4096);
  assert.ok(messages[0]!.text!.includes('full question in the workbench'));
  assert.ok(messages[0]!.text!.includes(options[2]!));
  assert.deepEqual(messages[0]!.reply_markup, { inline_keyboard: [] });
});

for (const code of [401, 403]) test(`Telegram card ${code} stops only the remote without fallback`, async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'sendMessage', code });
  const disabled = until(() => f.state.status().disabled, { timeoutMs: 1000, what: `card ${code} durable disabled receipt` });
  void disabled.catch(() => {});
  assert.equal((await f.coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Fatal card', options: ['Keep'] })).ok, true);
  await f.clock.advance(250);
  await disabled;
  assert.equal((await f.ui.request({ type: 'hub.status' })).ok, true);
  await f.stop();
  const state = await control<{ messages: TgMessage[]; requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(state.messages.length, 0);
  assert.equal(state.requests.filter(request => request.method === 'sendMessage').length, 1);
});

test('Telegram card 429 holds its immutable request and an uncertain accepted card stays fenced across restart', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 2 });
  const { id } = await f.ask();
  const job = f.state.outbox().find(job => job.source === id)!;
  assert.deepEqual(f.state.attempts(job.id).map(attempt => attempt.outcome), ['never-left', 'sent']);
  const before = await control<{ requests: Array<{ method: string; params: unknown }> }>(f.fake.url, 'state');
  assert.deepEqual(before.requests.filter(request => request.method === 'sendMessage').map(request => request.params).slice(0, 2),
    [job.payload, job.payload].map(payload => (payload as { params: unknown }).params));
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'accept-disconnect' });
  const uncertain = until(() => f.state.outbox().some(row => row.kind === 'card' && row.state === 'uncertain'),
    { timeoutMs: 1000, what: 'accepted card without response is durably fenced' });
  void uncertain.catch(() => {});
  assert.equal((await f.coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Uncertain card', options: ['Keep'] })).ok, true);
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, uncertain);
  const uncertainAsk = f.state.outbox().find(row => row.kind === 'card' && row.state === 'uncertain')!.source!;
  assert.equal((await f.ui.request({ type: 'topic.answer', ask: uncertainAsk, option: 1 })).ok, true);
  assert.equal(f.state.outbox().some(row => row.kind === 'edit' && row.source === uncertainAsk), false);
  await f.stop(); f.ui.close(); await f.coord.close();
  const messages = await f.messages();
  const next = f.newRemote();
  const polling = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next.gateway] } });
  await driveTelegram(f.clock, f.state, within(polling, 1000));
  await hub.stop();
  assert.deepEqual(await f.messages(), messages);
  assert.equal(f.state.outbox().filter(row => row.state === 'uncertain').length, 1);
  assert.equal(f.state.outbox().some(row => row.kind === 'edit' && row.source === uncertainAsk), false);
});

test('Telegram answer receipt failure rolls back without publishing or delivering a phantom answer, then retries once', { timeout: 5000 }, async t => {
  const failure = Promise.withResolvers<void>();
  const f = await fixture(t, frame => {
    if (frame.type === 'result' && !frame.ok && frame.error.includes('fixture answer receipt failure')) failure.resolve();
    return false;
  });
  const { id, card } = await f.ask();
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const { DatabaseSync } = await import('node:sqlite');
  const fault = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try { fault.exec(`create trigger fail_card_receipt before insert on remote_state
    when new.messenger = 'telegram' and new.key glob 'gateway.answer:*'
    begin select raise(abort, 'fixture answer receipt failure'); end`); }
  finally { fault.close(); }
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  await within(failure.promise, 1000);
  // These ordered socket replies drain earlier frames before the absence assertions.
  assert.equal((await f.ui.request({ type: 'inbox.list' })).ok, true);
  await f.coord.call('who', {});
  assert.equal(f.store.ask(id)!.state, 'open');
  assert.equal(f.store.ask(id)!.answer, undefined);
  assert.equal(f.coord.events.some(event => event.params.meta?.answer_to === id), false);
  assert.equal(f.ui.frames.some(frame => frame.type === 'ask' && frame.ask === id && (frame.card as { state: string }).state === 'answered'), false);
  assert.equal(f.ui.frames.some(frame => frame.type === 'message' && (frame.message as { answerTo?: string }).answerTo === id), false);
  assert.equal(f.state.outbox().some(job => job.kind === 'edit' && job.source === id), false);
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), null);
  const recover = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try { recover.exec('drop trigger fail_card_receipt'); } finally { recover.close(); }
  const confirmed = f.fake.waitForPoll();
  await f.clock.advance(1000);
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  await f.coord.call('who', {});
  assert.equal(f.store.ask(id)!.state, 'answered');
  assert.equal(f.coord.events.filter(event => event.params.meta?.answer_to === id).length, 1);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ answerTo?: string }> };
  assert.equal(history.messages.filter(message => message.answerTo === id).length, 1);
  await f.stop();
});

test('Telegram expired callback acknowledgement confirms the durable answer and lets later input progress', { timeout: 5000 }, async t => {
  const delayed = Promise.withResolvers<HubFrame>();
  const f = await fixture(t, frame => {
    if (frame.type === 'result' && frame.ok && (frame.value as { message?: { answerTo?: string } }).message?.answerTo) {
      delayed.resolve(frame); return true;
    }
    return false;
  });
  const { id, card } = await f.ask();
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  const result = await within(delayed.promise, 1000);
  assert.equal(f.store.ask(id)!.state, 'answered');
  // Hold the actual committed frame result, before direct callback HTTP starts.
  // Advancing a held HTTP request would hit its separate 35-second deadline.
  await f.clock.advance(151000);
  const confirmed = f.fake.waitForPoll();
  await f.remote.receive(result);
  assert.equal((await within(confirmed, 1000)).params.offset, press.update_id + 1);
  const nextPoll = f.fake.waitForPoll();
  const later = await control<{ update_id: number }>(f.fake.url, 'say', { text: '/help' });
  assert.equal((await driveTelegram(f.clock, f.state, within(nextPoll, 1000))).params.offset, later.update_id + 1);
  await f.stop();
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), '1');
  const history = f.store.topicMessages('general', 100);
  assert.equal(history.filter(message => message.answerTo === id).length, 1);
  assert.ok((await f.messages()).some(message => message.text?.includes('— Help')));
});

test('Telegram transient callback refusal retries its saved answer without duplicating the human effect', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const { id, card } = await f.ask();
  await control(f.fake.url, 'fault', { method: 'answerCallbackQuery', code: 500 });
  const refused = until(() => f.state.get('telegram.outage') !== null,
    { timeoutMs: 1000, what: 'transient callback failure durably enters recovery' });
  void refused.catch(() => {});
  const press = await control<{ update_id: number; callback_query: { id: string } }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  await refused;
  assert.equal(f.state.get(`telegram.press:${press.callback_query.id}`), 'Answered');
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), null);
  const confirmed = f.fake.waitForPoll();
  await f.clock.advance(1000);
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  await f.stop();
  assert.equal(f.store.topicMessages('general', 100).filter(message => message.answerTo === id).length, 1);
  const state = await control<{ requests: Array<{ method: string; params: { text?: string } }> }>(f.fake.url, 'state');
  assert.deepEqual(state.requests.filter(request => request.method === 'answerCallbackQuery').map(request => request.params.text), ['Answered', 'Answered']);
});

for (const client of ['Neovim', 'web'] as const) test(`Telegram ask answered via ${client} edits its mapped card from the hub outcome without buttons`, async t => {
  const f = await fixture(t);
  const ui = client === 'web' ? await f.web.start(f.ui) : f.ui;
  const { id, card } = await f.ask();
  const edited = until(() => f.state.outbox().some(job => job.kind === 'edit' && job.source === id && job.state === 'sent'),
    { timeoutMs: 1000, what: `${client} outcome edit durable receipt` });
  void edited.catch(() => {});
  const result = await ui.request({ type: 'topic.answer', ask: id,
    ...(client === 'web' ? { declined: true, reason: 'Keep the current release' } : { option: 2 }) });
  assert.equal(result.ok, true, result.error);
  await driveTelegram(f.clock, f.state, edited);
  await f.stop();
  const saved = f.store.ask(id)!;
  assert.equal(saved.outcome!.via, client === 'web' ? 'web' : 'neovim');
  const current = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.equal(current.text, `coord · General\n\nWhich release?\n\n${client === 'web' ? 'Declined: Keep the current release' : 'Two'} · human via ${client} · ${new Date(saved.outcome!.at).toTimeString().slice(0, 5)}`);
  assert.deepEqual(current.reply_markup, { inline_keyboard: [] });
});

for (const action of ['withdrawn', 'cancelled'] as const) test(`Telegram ${action} ask edits its card without buttons`, async t => {
  const f = await fixture(t);
  const created = await f.coord.call<{ ok: boolean; topic: { id: string } }>('topic.create', { title: 'Release decision' });
  assert.equal(created.ok, true);
  const topic = created.topic.id;
  const { id, card } = await f.ask('Which release?', ['One', 'Two'], true, topic);
  const edited = until(() => f.state.outbox().some(job => job.kind === 'edit' && job.source === id && job.state === 'sent'),
    { timeoutMs: 1000, what: `${action} card edit durable receipt` });
  void edited.catch(() => {});
  const result = action === 'withdrawn' ? await f.coord.call<{ ok: boolean }>('resolve', { topic }) : await f.ui.request({ type: 'topic.close', topic });
  assert.equal(result.ok, true, JSON.stringify(result));
  await driveTelegram(f.clock, f.state, edited);
  await f.stop();
  assert.equal(f.store.ask(id)!.state, action);
  const current = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.ok(current.text!.endsWith(action === 'withdrawn' ? 'Withdrawn · asked by coord' : 'Cancelled: topic or item closed'));
  assert.deepEqual(current.reply_markup, { inline_keyboard: [] });
});

test('Telegram drops a closed ask card queued behind a 429 hold without sending it', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 2 });
  let id = '';
  const held = until(() => f.state.outbox().some(job => job.source === id && job.state === 'queued'
    && f.state.attempts(job.id).at(-1)?.outcome === 'never-left'),
  { timeoutMs: 1000, what: 'card durable 429 non-delivery and queued hold' });
  void held.catch(() => {});
  const asked = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Held card?', options: ['Keep'] });
  assert.equal(asked.ok, true);
  id = asked.ask;
  await f.clock.advance(250);
  await held;
  const dropped = until(() => f.state.outbox().some(job => job.source === id && job.kind === 'card' && job.state === 'dropped'),
    { timeoutMs: 1000, what: 'closed source durable dropped card' });
  void dropped.catch(() => {});
  assert.equal((await f.ui.request({ type: 'topic.answer', ask: id, option: 1 })).ok, true);
  await driveTelegram(f.clock, f.state, dropped);
  await f.stop();
  const job = f.state.outbox().find(job => job.source === id && job.kind === 'card')!;
  assert.equal(job.state, 'dropped');
  assert.deepEqual(f.state.attempts(job.id).map(attempt => attempt.outcome), ['never-left']);
  assert.equal((await f.messages()).length, 0);
  assert.equal(f.state.status().disabled, false);
});

for (const winner of ['Neovim', 'Telegram'] as const) test(`Telegram tap racing a Neovim answer keeps the ${winner} winner on every copy`, { timeout: 5000 }, async t => {
  let racing = false;
  const held = Promise.withResolvers<HubFrame>();
  const f = await fixture(t, frame => {
    if (!racing || frame.type !== 'result' || !frame.ok) return false;
    const value = frame.value as { asks?: unknown[]; message?: { answerTo?: string } };
    if (winner === 'Neovim' ? Array.isArray(value.asks) : !!value.message?.answerTo) {
      racing = false; held.resolve(frame); return true;
    }
    return false;
  });
  const { id, card } = await f.ask();
  // A previous resend is a native accepted message and durable map, just like
  // the initial copy. /inbox resend admission belongs to the next item.
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url });
  const copy = await api.sendMessage({ chat_id: '101', text: card.text!,
    reply_markup: card.reply_markup as import('../src/remote/telegram-api.ts').TgInlineKeyboardMarkup }, { signal: AbortSignal.timeout(1000) });
  f.state.putMessage({ ...f.state.message('101', String(card.message_id))!, messageId: String(copy.message_id) });
  assert.equal(f.state.messagesForAsk(id).length, 2);
  racing = true;
  const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
  const confirmed = f.fake.waitForPoll();
  const edits = until(() => f.state.outbox().filter(job => job.kind === 'edit' && job.source === id && job.state === 'sent').length === 2,
    { timeoutMs: 1000, what: 'both winner outcome copies durably edited' });
  void edits.catch(() => {});
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  const blocked = await within(held.promise, 1000);
  const nvim = await f.ui.request({ type: 'topic.answer', ask: id, option: 2 });
  assert.equal(nvim.ok, winner === 'Neovim', nvim.error);
  const saved = f.store.ask(id)!;
  assert.equal(saved.outcome!.via, winner === 'Neovim' ? 'neovim' : 'telegram');
  await f.remote.receive(blocked);
  assert.equal((await within(acknowledged, 1000)).params.text, winner === 'Neovim' ? 'Already answered' : 'Answered');
  assert.equal((await within(confirmed, 1000)).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, edits);
  await f.stop();
  assert.deepEqual(f.store.ask(id), saved);
  assert.equal(f.store.topicMessages('general', 100).filter(message => message.answerTo === id).length, 1);
  const messages = (await f.messages()).filter(message => [card.message_id, copy.message_id].includes(message.message_id));
  assert.equal(messages.length, 2);
  for (const message of messages) {
    assert.equal(message.text, `coord · General\n\nWhich release?\n\n${winner === 'Neovim' ? 'Two' : 'Three'} · human via ${winner} · ${new Date(saved.outcome!.at).toTimeString().slice(0, 5)}`);
    assert.deepEqual(message.reply_markup, { inline_keyboard: [] });
  }
  assert.equal(f.state.status().disabled, false);
});

test('Telegram inbox departure with a web decline edits the card when its ask frame is unavailable', async t => {
  const f = await fixture(t, frame => frame.type === 'ask');
  const web = await f.web.start(f.ui);
  const { id, card } = await f.ask();
  const edited = until(() => f.state.outbox().some(job => job.kind === 'edit' && job.source === id && job.state === 'sent'),
    { timeoutMs: 1000, what: 'departure-only decline durable edit receipt' });
  void edited.catch(() => {});
  assert.equal((await web.request({ type: 'topic.answer', ask: id, declined: true, reason: 'Wait for QA' })).ok, true);
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, edited);
  await f.stop();
  const current = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.match(current.text!, /Declined: Wait for QA · human via web · \d\d:\d\d$/);
  assert.deepEqual(current.reply_markup, { inline_keyboard: [] });
});

test('Telegram in-flight card mapped after an answer still turns into its outcome', async t => {
  const closed = Promise.withResolvers<void>();
  const f = await fixture(t, frame => {
    if (frame.type === 'ask' && frame.card.state === 'answered') closed.resolve();
    return false;
  });
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' });
  const accepted = f.fake.waitForHeldRequest('sendMessage');
  const asked = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'In-flight card?', options: ['Keep'] });
  assert.equal(asked.ok, true);
  const id = asked.ask;
  await f.clock.advance(250);
  const held = await within(accepted, 1000);
  assert.equal(f.state.messagesForAsk(id).length, 0);
  const edited = until(() => f.state.outbox().some(job => job.kind === 'edit' && job.source === id && job.state === 'sent'),
    { timeoutMs: 1000, what: 'late-mapped card outcome durable receipt' });
  void edited.catch(() => {});
  assert.equal((await f.ui.request({ type: 'topic.answer', ask: id, option: 1 })).ok, true);
  // Observe the committed state-change frame at the adapter while the native
  // send is held, independently of the UI socket's reply.
  await within(closed.promise, 1000);
  await control(f.fake.url, 'release-requests', { ids: [held.id] });
  await driveTelegram(f.clock, f.state, edited);
  await f.stop();
  const messages = await f.messages();
  assert.equal(messages.length, 1);
  assert.match(messages[0]!.text!, /Keep · human via Neovim · \d\d:\d\d$/);
  assert.deepEqual(messages[0]!.reply_markup, { inline_keyboard: [] });
});

test('Telegram card web fixture missing setup receipt closes native HTTP and WebSocket work before disposal', async t => {
  const f = await fixture(t);
  const setupClock = new FakeClock();
  const closeReceipt = Promise.withResolvers<void>();
  const starting = f.web.start(f.ui, { setupClock, publishReady: false, closeReceipt: closeReceipt.promise });
  const failed = assert.rejects(starting, /setup receipt deadline reached/);
  void failed.catch(() => {});
  await f.web.actual();
  await setupClock.advance(1000);
  await within(f.web.socketClosed, 1000);
  try {
    assert.equal(f.web.receipts().joined, false, 'native close alone does not drain the held close observer');
    assert.ok(f.web.receipts().pending > 0);
  } finally { closeReceipt.resolve(); }
  await failed;
  await f.web.dispose();
  const receipt = f.web.receipts();
  assert.deepEqual(receipt.started, { requests: 1, responses: 1, sockets: 1 });
  assert.deepEqual(receipt.closed, receipt.started);
  assert.equal(receipt.joined, true);
  assert.equal(receipt.observing, false);
  assert.equal(receipt.pending, 0);
  await f.stop();
});

for (const stage of ['HTTP', 'WebSocket'] as const) test(`Telegram card web fixture aborted during ${stage} acquisition drains its native close receipts`, async t => {
  const f = await fixture(t);
  const abort = new AbortController();
  const starting = f.web.start(f.ui, { signal: abort.signal });
  const failed = assert.rejects(starting, /fixture acquisition cancelled/);
  void failed.catch(() => {});
  await within(stage === 'HTTP' ? f.web.httpStarted : f.web.socketStarted, 1000);
  abort.abort(new Error('fixture acquisition cancelled'));
  await failed;
  await f.web.dispose();
  const receipt = f.web.receipts();
  assert.equal(receipt.started.requests, 1);
  assert.equal(receipt.started.sockets, stage === 'HTTP' ? 0 : 1);
  assert.deepEqual(receipt.closed, receipt.started);
  assert.equal(receipt.joined, true);
  assert.equal(receipt.observing, false);
  assert.equal(receipt.pending, 0);
  await f.stop();
});
