// T2: hub-owned cards through the existing human frame boundary.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { get } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { connectUi, projectHub, tempProject, frameClient, inProcessSpoke, type FrameClient } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import type { HubCards } from '../src/hub/hub-cards.ts';
import { testMessenger } from './fakes/messenger.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discordCardsFixture } from './discord-cards-fixture.ts';
import { until } from './harness.ts';
import { driveTelegram } from './telegram-pacing-fixture.ts';
import { control } from './telegram-polling-fixture.ts';
import type { TgMessage } from '../src/remote/telegram-api.ts';

test('hub card answers call their registered handler once and never target a session', async t => {
  const root = await tempProject(t);
  let cards!: HubCards;
  const calls: unknown[] = [];
  const hub = await projectHub(t, root, {}, {
    clock: new FakeClock(), processes: fakeLockProcesses().processes,
    registerHubCards: service => { cards = service; service.onAnswer('test', (payload, answer) => { calls.push([payload, answer]); return 'Login saved'; }); },
  });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const id = cards.raise('test', 'general', 'Use this login?', ['Use'], true, { login: 42 });
  const listed = await ui.request({ type: 'inbox.list' });
  assert.equal(listed.ok, true);
  assert.equal(Object.hasOwn((listed.value as any).asks[0], 'secret'), false, 'previous non-secret shape omits secret');
  assert.deepEqual((listed.value as any).asks.map((a: any) => [a.id, a.from, a.options]), [[id, 'hub', ['Use']]]);
  const result = await ui.request({ type: 'topic.answer', ask: id, option: 1 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(calls, [[{ login: 42 }, 'Use']]);
  assert.deepEqual((result.value as any).outcomes, []);
  assert.deepEqual((result.value as any).message.to, []);
  const second = await ui.request({ type: 'topic.answer', ask: id, option: 1 });
  assert.equal(second.ok, false);
  assert.match(String(second.error), /answered/);
  assert.equal(calls.length, 1);
});

test('pending hub cards survive restart; missing handlers keep them open and withdrawal records its reason', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  let cards!: HubCards;
  const options = { clock, processes: fakeLockProcesses().processes, registerHubCards: (s: HubCards) => { cards = s; } };
  const first = await projectHub(t, root, {}, options);
  const id = cards.raise('later', 'general', 'Continue?', ['Yes'], false, { durable: 7 });
  await first.stop();
  let payload: unknown;
  const second = await projectHub(t, root, {}, { ...options, registerHubCards: s => {
    cards = s; s.onAnswer('later', p => { payload = p; return 'Resumed'; });
  } });
  const ui = await connectUi(t, second.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'topic.answer', ask: id, option: 1 })).ok, true);
  assert.deepEqual(payload, { durable: 7 });
  const withdrawn = cards.raise('missing', 'general', 'Another?', ['Yes'], false, {});
  assert.equal((await ui.request({ type: 'topic.answer', ask: withdrawn, option: 1 })).ok, false);
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as any).asks[0].id, withdrawn);
  cards.withdraw(withdrawn, 'Login removed');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as any;
  assert.equal(history.messages.find((m: any) => m.id === withdrawn).ask.outcome.text, 'Login removed');
  assert.equal((await ui.request({ type: 'topic.answer', ask: withdrawn, option: 1 })).ok, false);
});

test('secret hub answers reach the handler verbatim and remote replay stores a digest', async t => {
  const root = await tempProject(t), clock = new FakeClock();
  const remote = testMessenger('telegram', 'telegram');
  let cards!: HubCards, received = '', calls = 0;
  const logs: unknown[] = [];
  const hub = await projectHub(t, root, {}, { clock, processes: fakeLockProcesses().processes,
    gatewayRemotes: [remote], log: e => logs.push(e),
    registerHubCards: s => { cards = s; s.onAnswer('secret', (_, answer) => { received = answer; calls++; return answer; }); },
  });
  const id = cards.raise('secret', 'general', 'Paste code', [], true, null, true);
  const secret = '  sentinel-login-code-1775  ';
  const ingress = { chatId: '101', messageId: 'secret-answer-1775' };
  const answer = { type: 'topic.answer', id: 'secret-first', ask: id, text: secret };
  const result = remote.client.waitFor(f => f.type === 'result' && f.id === answer.id);
  remote.upload(answer, ingress, []);
  assert.equal((await result).ok, true);
  assert.equal(received, secret);
  const replay = remote.client.waitFor(f => f.type === 'result' && f.id === 'secret-replay');
  remote.upload({ ...answer, id: 'secret-replay' }, ingress, []);
  assert.equal((await replay).ok, true);
  assert.equal(calls, 1);
  const ui = await connectUi(t, hub.discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(JSON.stringify(history).includes(secret.trim()), false);
  assert.equal(JSON.stringify(logs).includes(secret.trim()), false);
  assert.equal(JSON.stringify(remote.client.frames).includes(secret.trim()), false);
  await hub.stop();
  for (const file of ['hub.db', 'log/hub.log', 'journal.jsonl']) {
    assert.equal((await readFile(join(root, '.cland', file))).includes(Buffer.from(secret.trim())), false, file);
  }
});

test('ordinary ask remote replay preserves its existing answer and deduplicates delivery', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram', 'telegram');
  const hub = await projectHub(t, root, {}, { clock: new FakeClock(), processes: fakeLockProcesses().processes, gatewayRemotes: [remote] });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const asked = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Ordinary question', options: [], free: true });
  const ingress = { chatId: '101', messageId: 'ordinary-answer' };
  const frame = { type: 'topic.answer', ask: asked.ask, text: 'ordinary answer retained' };
  for (const id of ['first', 'replayed']) {
    const received = remote.client.waitFor(f => f.type === 'result' && f.id === id);
    remote.upload({ ...frame, id }, ingress, []);
    assert.equal((await received).ok, true);
  }
  const ui = await connectUi(t, hub.discovery);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as any;
  const answers = history.messages.filter((m: any) => m.answerTo === asked.ask);
  assert.equal(answers.length, 1);
  assert.equal(answers[0].text, 'ordinary answer retained');
  assert.deepEqual(answers[0].to, ['coord']);
  await hub.stop();
  assert.equal((await readFile(join(root, '.cland/hub.db'))).includes(Buffer.from(frame.text)), true);
});

test('hub card handler failures roll back and a decline carries no consent', async t => {
  const root = await tempProject(t);
  let cards!: HubCards, followUps = 0;
  const hub = await projectHub(t, root, {}, { clock: new FakeClock(), processes: fakeLockProcesses().processes,
    registerHubCards: s => { cards = s; s.onAnswer('intent', (_, __, context) => { context.afterCommit(() => { followUps++; }); throw new Error('do not publish this failure text'); }); },
  });
  const ui = await connectUi(t, hub.discovery);
  const id = cards.raise('intent', 'general', 'Create login?', ['Create'], false, {});
  assert.equal((await ui.request({ type: 'topic.answer', ask: id, option: 1 })).ok, false);
  assert.equal(followUps, 0);
  assert.equal(((await ui.request({ type: 'inbox.list' })).value as any).asks[0].id, id);
  cards.onAnswer('intent', (_, answer, context) => {
    assert.equal(context.declined, true);
    assert.equal(answer, 'declined: no login wanted');
    context.afterCommit(() => { followUps++; });
    return 'Creation declined';
  });
  assert.equal((await ui.request({ type: 'topic.answer', ask: id, declined: true, reason: 'no login wanted' })).ok, true);
  assert.equal(followUps, 1);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as any;
  assert.equal(history.messages.find((m: any) => m.id === id).ask.outcome.status, 'declined');
});

for (const via of ['web', 'neovim', 'telegram', 'discord', 'withdraw', 'secret'] as const) test(`hub cards publish and fold both native copies after ${via}`, async t => {
  let cards!: HubCards;
  let calls = 0;
  const f = await discordCardsFixture(t, undefined, 'Hub cards', undefined, true, undefined, undefined, undefined, undefined, false, false,
    service => { cards = service; service.onAnswer('login', (payload, answer) => { assert.deepEqual(payload, { number: 9 }); assert.equal(answer, via === 'secret' ? 'native-secret-1775' : 'Use'); calls++; return via === 'secret' ? answer : 'Creating login 9'; }); });
  let id = '';
  const mapped = until(() => !!id && f.telegram.messagesForAsk(id).length === 1 && f.state.messagesForAsk(id).length === 1, { what: 'both durable card mappings', timeoutMs: 2000 });
  void mapped.catch(() => {});
  t.after(() => mapped.catch(() => {}));
  id = cards.raise('login', 'general', 'Use login 9?', ['Use'], via === 'secret', { number: 9 }, via === 'secret');
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.telegram, mapped);
  const tgId = Number(f.telegram.messagesForAsk(id)[0]!.messageId);
  const dcId = f.state.messagesForAsk(id)[0]!.messageId;
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const folded = until(async () => {
    const dc = (await f.fake.control('state')).messages.find(m => m.id === dcId);
    const tg = (await control<{ messages: TgMessage[] }>(f.tg!.url, 'state')).messages.find(m => m.message_id === tgId);
    return !!dc?.content.includes(via === 'withdraw' ? 'Login removed' : via === 'secret' ? 'answered' : 'Creating login 9') && !!tg?.text?.includes(via === 'withdraw' ? 'Login removed' : via === 'secret' ? 'answered' : 'Creating login 9') && dc.components?.length === 0 && (tg.reply_markup as any)?.inline_keyboard.length === 0;
  }, { what: 'both native copies contain outcome and no buttons', timeoutMs: 2000 });
  void folded.catch(() => {});
  t.after(() => folded.catch(() => {}));
  if (via === 'secret') assert.equal((await ui.request({ type: 'topic.answer', ask: id, text: 'native-secret-1775' })).ok, true);
  else if (via === 'withdraw') cards.withdraw(id, 'Login removed');
  else if (via === 'neovim' || via === 'web') assert.equal((await (via === 'web' ? await webClient(t, ui) : ui).request({ type: 'topic.answer', ask: id, option: 1 })).ok, true);
  else if (via === 'telegram') await control(f.tg!.url, 'press', { chat_id: 101, message_id: tgId, row: 0, column: 0 });
  else await f.fake.control('interact', { message_id: dcId, custom_id: `ask:${id}:1` });
  await driveTelegram(f.clock, f.telegram, folded);
  if (via === 'secret') {
    assert.equal(JSON.stringify(await f.fake.control('state')).includes('native-secret-1775'), false);
    assert.equal(JSON.stringify(await control(f.tg!.url, 'state')).includes('native-secret-1775'), false);
  }
  assert.equal(calls, via === 'withdraw' ? 0 : 1);
  assert.equal((await ui.request({ type: 'topic.answer', ask: id, option: 1 })).ok, false);
  await f.hub.stop();
});

async function webClient(t: TestContext, local: FrameClient) {
  const link = await local.request({ type: 'web.link' });
  assert.equal(link.ok, true, link.error);
  const { url } = link.value as { url: string };
  const cookie = await new Promise<string>((resolve, reject) => {
    const request = get(url, { agent: false }, response => {
      response.resume();
      response.on('end', () => resolve(response.headers['set-cookie']![0]!.split(';')[0]!));
      response.on('error', reject);
    });
    request.setTimeout(2000, () => request.destroy(new Error('fixture sign-in timed out')));
    request.on('error', reject);
  });
  const origin = new URL(url).origin;
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  t.after(() => ws.terminate());
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  const welcome = client.waitFor(frame => frame.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'human' });
  assert.equal((await welcome).name, 'human');
  return client;
}

for (const via of ['telegram', 'discord'] as const) test(`native secret ${via} retention probe`, async t => {
  let cards!: HubCards, received: string | undefined, calls = 0;
  const f = await discordCardsFixture(t, undefined, 'Secret probe', undefined, true, undefined, undefined, undefined, undefined, false, false,
    service => { cards = service; service.onAnswer('secret', (_, answer) => { received = answer; calls++; return 'answered'; }); });
  const sentinel = 'fake-native-input-1775';
  let id = '';
  const mappings = observe(t, until(() => !!id && f.telegram.messagesForAsk(id).length === 1 && f.state.messagesForAsk(id).length === 1, { what: 'both native mappings', timeoutMs: 2000 }));
  id = cards.raise('secret', 'general', 'Paste code', [], true, null, true);
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.telegram, mappings);
  if (via === 'telegram') {
    const tgId = Number(f.telegram.messagesForAsk(id)[0]!.messageId);
    const card = (await control<{ messages: TgMessage[] }>(f.tg!.url, 'state')).messages.find(m => m.message_id === tgId);
    const stored = until(() => f.store.ask(id)?.state === 'answered' && !!f.telegram.get('telegram.answer-input:101:901')?.includes('"stored":true'), { what: 'accepted native answer receipt', timeoutMs: 2000 });
    void stored.catch(() => {}); t.after(() => stored.catch(() => {}));
    await control(f.tg!.url, 'update', { message: { message_id: 901, date: 1, chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: sentinel, reply_to_message: card } });
    await driveTelegram(f.clock, f.telegram, stored);
    assert.equal(received, sentinel);
    const leaks = f.telegram.get('telegram.answer-input:101:901')!.includes(sentinel);
    const restarted = await f.restart();
    let replayId: number | undefined;
    const replayReceipt = observe(t, until(() => replayId !== undefined && Number(f.telegram.get('telegram.offset')) === replayId + 1, { what: 'native replay polling offset persisted', timeoutMs: 2000 }));
    const replayed = await control<{ update_id: number }>(f.tg!.url, 'update', { message: { message_id: 901, date: 1, chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: sentinel, reply_to_message: card } });
    replayId = replayed.update_id;
    await driveTelegram(f.clock, f.telegram, replayReceipt);
    assert.equal(calls, 1);
    await restarted.stop();
    assert.equal((await readFile(join(f.root, '.cland/hub.db'))).includes(Buffer.from(sentinel)), false, 'closed hub database retains native input');
    assert.equal(leaks, false, 'native Telegram answer-input receipt retains plaintext');
  } else {
    const dcId = f.state.messagesForAsk(id)[0]!.messageId;
    let submittedId = '';
    const callbackReceipt = observe(t, until(async () => !!submittedId && !!(await f.fake.control('state')).interactions.find(r => r.id === submittedId)?.callbacks.some(r => (r as { type: number }).type === 7), { what: 'native Discord decline update receipt', timeoutMs: 2000 }));
    const submitted = await f.fake.control('interact', { message_id: dcId, custom_id: `modal:${id}:decline`, modal_text: sentinel });
    submittedId = submitted.id;
    await callbackReceipt;
    assert.equal(received, `declined: ${sentinel}`);
    const callback = (await f.fake.control('state')).interactions.find(r => r.id === submitted.id)!.callbacks.find(r => (r as { type: number }).type === 7) as { data: { content: string } };
    const leaks = callback.data.content.includes(sentinel);
    await f.hub.stop();
    assert.equal(leaks, false, 'native Discord decline callback contains plaintext');
  }
});

test('deferred native Discord answer keeps handler outcome after all updates settle', async t => {
  let cards!: HubCards;
  const f = await discordCardsFixture(t, undefined, 'Deferred probe', undefined, true, undefined, undefined, undefined, undefined, false, false,
    service => { cards = service; service.onAnswer('test', () => 'Creating login 9'); });
  let id = '';
  const mapping = observe(t, until(() => !!id && f.state.messagesForAsk(id).length === 1, { what: 'native card mapping', timeoutMs: 2000 }));
  id = cards.raise('test', 'general', 'Use login?', ['Use'], false, null);
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.telegram, mapping);
  const dcId = f.state.messagesForAsk(id)[0]!.messageId;
  f.holdFrames('topic.answer');
  const held = observe(t, until(() => f.frames.some(r => r.frame.type === 'topic.answer'), { what: 'held answer dispatch', timeoutMs: 2000 }));
  const pressed = await f.fake.control('interact', { message_id: dcId, custom_id: `ask:${id}:1` });
  await held;
  const deferred = observe(t, until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === pressed.id)?.callbacks.some(r => (r as { type: number }).type === 6), { what: 'native deferred acknowledgement', timeoutMs: 2000 }));
  await f.clock.advance(2000);
  await deferred;
  const settled = observe(t, until(() => f.state.outbox().some(j => j.source === `discord.press:${pressed.id}` && j.state === 'sent'), { what: 'durable completed interaction edit', timeoutMs: 2000 }));
  f.releaseFrames();
  await settled;
  await f.hub.stop();
  const content = (await f.fake.control('state')).messages.find(m => m.id === dcId)!.content;
  assert.equal(content.startsWith('Creating login 9'), true, 'final native card lost the handler outcome');
});

for (const mode of ['option', 'free', 'decline'] as const) test(`users-mode hub ${mode} outcome retains stable user id`, async t => {
  let cards!: HubCards;
  const f = await discordCardsFixture(t, undefined, 'User attribution probe', undefined, false, undefined, undefined, undefined, undefined, true, false,
    service => { cards = service; service.onAnswer('test', () => 'Saved'); });
  const id = cards.raise('test', 'general', 'Proceed?', ['Use'], true, null);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const fields = mode === 'option' ? { option: 1 } : mode === 'free' ? { text: 'free input' } : { declined: true, reason: 'decline input' };
  assert.equal((await ui.request({ type: 'topic.answer', ask: id, ...fields })).ok, true);
  const outcome = f.store.ask(id)!.outcome!;
  const archive = (await ui.request({ type: 'inbox.list', archive: true })).value as import('../src/protocol.ts').Inbox;
  assert.equal(archive.archive?.find(row => row.id === id)?.outcome?.userId, f.store.users.first()!.id);
  const answerId = f.store.ask(id)!.answer!;
  await f.hub.stop();
  f.store.prune(f.clock.now().getTime() + 60_000, 30_000);
  assert.equal(f.store.message(answerId), null);
  assert.equal(f.store.inboxDepartures(new Date(f.clock.now().getTime() - 1000).toISOString()).find(row => row.id === id)?.outcome?.userId, f.store.users.first()!.id);
  assert.equal(outcome.userId, f.store.users.first()!.id, 'durable outcome lacks stable userId');
});


function observe<T>(t: TestContext, pending: Promise<T>): Promise<T> {
  void pending.catch(() => {});
  t.after(() => pending.then(() => {}, () => {}));
  return pending;
}
