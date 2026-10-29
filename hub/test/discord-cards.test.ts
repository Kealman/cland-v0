// T2: production frame port and sealed loopback Discord REST/ws.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, inProcessSpoke, until, connectUi, cland } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { messengerFactory } from '../src/remote/messenger.ts';
import { DiscordOutbox } from '../src/remote/discord-outbox.ts';
import { remoteApprovalHarness } from './fakes/remote-approval-harness.ts';
import { discordAsk } from '../src/remote/discord-cards.ts';
import type { InboxAsk } from '../src/protocol.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { driveTelegram } from './telegram-pacing-fixture.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import type { TgMessage } from '../src/remote/telegram-api.ts';
import { FakeClock } from './fake-clock.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';

async function fixture(t: TestContext, holdType?: string, projectName = 'Cards fixture', onCallback?: (id: string, type: number) => void | Promise<void>, both = false, log?: import('../src/log.ts').LogFn, scripted?: 'codex' | 'opencode', origin?: string) {
  const clock = new FakeClock();
  const exchange = await discordExchangeOwner(t, { clock, ...(origin ? { publicOrigin: origin } : {}), ...(onCallback ? { onCallback } : {}) }).start();
  const { root } = await exchange.project();
  const tgOwner = both ? fakeTelegramFixture(t, { clock }) : undefined;
  const tg = await tgOwner?.start();
  const config = defaultConfig('Commands fixture'); config.verification.lockPath = join(root, 'suite.lock'); config.remote.discord.enabled = true; config.remote.telegram.enabled = both; config.plan.approval = 'human'; if (origin) config.web.origin = origin;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const script = scripted ? remoteApprovalHarness(t, root, clock, scripted) : undefined;
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const telegram = store.remotes.forMessenger('telegram');
  if (both) telegram.setPairing(pairing);
  const env = { CLAND_DISCORD_API_ROOT: exchange.fake.url, ...(tg ? { CLAND_TELEGRAM_API_ROOT: tg.url } : {}) };
  const factory = messengerFactory(env, remoteRedactor(), clock, { state: store.remotes, projectName: () => projectName, webOrigin: () => origin ?? '', ...(log ? { log } : {}) });
  const frames: Array<{ frame: Record<string, unknown>; ingress?: import('../src/remote/gateway.ts').RemoteIngress }> = [];
  const held: Array<() => void> = [];
  let remote: import('../src/remote/gateway.ts').Remote;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  exchange.stop(() => hub?.stop());
  const startHub = () => exchange.run(async () => {
    hub = await projectHub(t, root, env, { clock, ...(script ? { adapters: [script.factory] } : {}), syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, ...(both ? { 'telegram.token': TELEGRAM_TEST_TOKEN } : {}) }, gatewayMessenger: (...args) => {
      const made = factory(...args); if (made.id !== 'discord') return made;
      remote = made; const start = remote.start.bind(remote);
      remote.start = (send, ...rest) => start((frame, ingress, bytes) => {
        frames.push({ frame, ...(ingress ? { ingress } : {}) });
        if (frame.type === holdType) held.push(() => send(frame, ingress, bytes)); else send(frame, ingress, bytes);
      }, ...rest);
      return remote;
    } });
    if (exchange.signal.aborted) await hub.stop();
  });
  await startHub();
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await until(async () => (await exchange.fake.control('state')).gateway.identifies === 1, { what: 'Discord READY', timeoutMs: 2000 });
  await exchange.fake.control('dispatch', { op: 1, d: null });
  await until(() => remote.status!().connected, { what: 'READY plus native heartbeat ACK', timeoutMs: 1500 });
  const command = (name: string, text?: string) => exchange.run(async () => {
    const { id } = await exchange.fake.control('interact', { command: name, ...(text === undefined ? {} : { text }) });
    await until(async () => !!(await exchange.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length,
      { what: 'native private command callback', timeoutMs: 1500 });
    return (await exchange.fake.control('state')).interactions.find(row => row.id === id)!;
  });
  return { ...exchange, root, script, store, tg, telegram, hub: hub!, restart: async (delay = 5000, down?: () => Promise<void>) => { await hub!.stop(); await down?.(); await clock.advance(delay); await startHub(); return hub!; }, clock, state, coord, command, frames, telegramMute: () => store.remotes.forMessenger('telegram').get('mute'), discardFrames: () => { holdType = undefined; held.splice(0); }, releaseFrames: () => { holdType = undefined; for (const send of held.splice(0)) send(); } };
}

// Own the rejecting observer before setup can yield; failed setup cancels and
// joins it before releasing native holds. Successful callers retain the hold.
async function holdRequest(f: Awaited<ReturnType<typeof fixture>>, produce: () => Promise<unknown>, signal?: AbortSignal): Promise<void> {
  const abort = new AbortController();
  const held = f.run(owner => f.fake.waitForHold(AbortSignal.any([owner, abort.signal, ...(signal ? [signal] : [])])));
  try {
    signal?.throwIfAborted();
    await f.run(produce);
    await held;
  } catch (error) {
    abort.abort();
    await held.catch(() => {});
    await f.run(() => f.fake.control('release', {}));
    throw error;
  }
}

test('Discord nine-option ask has three bounded rows with text labels', async t => {
  const f = await fixture(t);
  const options = Array.from({ length: 9 }, (_, i) => `Choice ${i + 1}`);
  const ask = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Choose a direction', options, free: true });
  assert.equal(ask.ok, true);
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'durable native card mapping', timeoutMs: 1500 });
  const messages = (await f.fake.control('state')).messages.filter(m => m.components?.length);
  assert.equal(messages.length, 1);
  const card = messages[0]!;
  assert.match(card.content, /^\*\*coord · General\*\*\n\nChoose a direction/);
  assert.deepEqual(card.components!.map(row => row.components.map(b => b.label)), [options.slice(0, 5), options.slice(5), ['Other answer…', 'Decline…']]);
  for (const b of card.components!.flatMap(row => row.components)) {
    assert.ok([...b.label].length <= 80); assert.ok([...b.custom_id!].length <= 100);
  }
  assert.equal(card.components![0]!.components[0]!.custom_id, `ask:${ask.ask}:1`);
  await f.hub.stop();
});

test('Discord long option gets numbered buttons and literal option list', async t => {
  const f = await fixture(t);
  const options = ['A long option that exceeds thirty four characters', 'Short'];
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Which?', options });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'numbered card mapping', timeoutMs: 1500 });
  const card = (await f.fake.control('state')).messages.find(m => m.id === f.state.messagesForAsk(ask.ask)[0]!.messageId)!;
  assert.deepEqual(card.components![0]!.components.map(b => b.label), ['1', '2']);
  assert.ok(card.content.includes(`1. ${options[0]}\n2. Short`));
  await f.hub.stop();
});

async function openCard(f: Awaited<ReturnType<typeof fixture>>) {
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Pick one', options: ['Keep', 'Change'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'mapped open card', timeoutMs: 1500 });
  return { ask: ask.ask, message: f.state.messagesForAsk(ask.ask)[0]!.messageId };
}

test('Discord click stores Discord answer before one immediate outcome update', async t => {
  let callbackStored = false;
  const f = await fixture(t, undefined, 'Cards fixture', (id, type) => { if (type === 7) callbackStored = f.state.get(`discord.press:${id}`) === 'answered'; });
  const card = await openCard(f);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1` });
  await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'native update acknowledgement', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  const row = native.interactions.find(r => r.id === id)!;
  assert.equal(callbackStored, true, 'saved hub result observed at native callback ingress');
  assert.equal(row.callbacks.length, 1);
  assert.equal((row.callbacks[0] as { type: number }).type, 7);
  assert.ok(row.callbackTimes[0]! - row.at < 3000);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: import('../src/protocol.ts').TopicMessage[] };
  const saved = history.messages.find(m => m.id === card.ask)!.ask!;
  assert.equal(saved.outcome?.via, 'discord'); assert.equal(saved.option, 1);
  assert.ok(f.state.get('discord.press:' + id), 'hub result receipt precedes callback');
  assert.deepEqual(native.messages.find(m => m.id === card.message)!.components, []);
  assert.match(native.messages.find(m => m.id === card.message)!.content, /Keep · human via Discord/);
  assert.deepEqual(f.frames.find(r => r.frame.type === 'topic.answer')!.ingress, { chatId: ids.channel, messageId: `interaction:${id}` });
  await f.hub.stop();
});

test('Discord slow click defers at two seconds and durably edits outcome after hub result', async t => {
  const f = await fixture(t, 'topic.answer');
  const card = await openCard(f);
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:2` });
  await until(() => f.frames.some(r => r.frame.type === 'topic.answer'), { what: 'held answer frame', timeoutMs: 1500 });
  await f.clock.advance(1999);
  assert.equal((await f.fake.control('state')).interactions.find(r => r.id === id)!.callbacks.length, 0);
  await f.clock.advance(1);
  await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'native deferred update', timeoutMs: 1500 });
  const deferred = (await f.fake.control('state')).interactions.find(r => r.id === id)!;
  assert.deepEqual(deferred.callbacks, [{ type: 6 }]);
  assert.equal(deferred.callbackTimes[0]! - deferred.at, 2000);
  await f.clock.advance(1500);
  f.releaseFrames();
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.state === 'sent'), { what: 'durable outcome edit settlement', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  assert.equal(native.interactions.find(r => r.id === id)!.callbacks.length, 1);
  assert.deepEqual(native.messages.find(m => m.id === card.message)!.components, []);
  assert.match(native.messages.find(m => m.id === card.message)!.content, /Change · human via Discord/);
  await f.hub.stop();
});

test('Discord coalesced asks arrive oldest first while General is muted', async t => {
  const f = await fixture(t);
  await f.command('mute');
  await f.coord.call('send', { topic: 'general', text: 'Muted General' });
  const first = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Older ask', options: ['Yes'] });
  await f.clock.advance(1);
  const second = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Newer ask', options: ['No'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(first.ask).length === 1 && f.state.messagesForAsk(second.ask).length === 1, { what: 'both muted card mappings', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  assert.deepEqual(native.messages.map(m => f.state.message(ids.channel, m.id)?.ask), [first.ask, second.ask]);
  assert.ok(native.messages[0]!.content.includes('Older ask'));
  assert.ok(native.messages[1]!.content.includes('Newer ask'));
  await f.hub.stop();
});

for (const deferred of [false, true]) test(`Discord stop drains held card answer ${deferred ? 'after' : 'before'} defer`, async t => {
  const f = await fixture(t, 'topic.answer');
  const card = await openCard(f);
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1` });
  await until(() => f.frames.some(r => r.frame.type === 'topic.answer'), { what: 'held card answer before stop', timeoutMs: 1500 });
  if (deferred) {
    await f.clock.advance(2000);
    await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'defer accepted before stop', timeoutMs: 1500 });
  }
  await f.run(() => f.hub.stop());
  assert.equal(f.clock.pending, 0);
  await f.clock.advance(3000);
  assert.equal((await f.fake.control('state')).interactions.find(r => r.id === id)!.callbacks.length, deferred ? 1 : 0);
  assert.equal(f.state.outbox().filter(j => j.kind === 'edit').length, 0);
});

test('Discord refuses foreign and forged card clicks', async t => {
  const f = await fixture(t);
  const card = await openCard(f);
  const other = await openCard(f);
  const before = (await f.fake.control('state')).messages;
  const frames = f.frames.length;
  for (const [custom, user, expected, modal] of [
    [`ask:${card.ask}:1`, 'member', "This card is for the project's owner"],
    [`modal:${card.ask}:decline`, 'member', "This card is for the project's owner", true],
    [`ask:${other.ask}:1`, 'human', 'not available'],
    ['ask:unissued:1', 'human', 'not available'],
    [`ask:${card.ask}:9`, 'human', 'not available'],
  ] as const) {
    const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: custom, user, ...(modal ? { modal_text: 'Foreign answer' } : {}) });
    await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'private refused click', timeoutMs: 1500 });
    const callback = (await f.fake.control('state')).interactions.find(r => r.id === id)!.callbacks[0] as { type: number; data: { content: string; flags: number } };
    assert.equal(callback.type, 4); assert.equal(callback.data.flags, 64); assert.ok(callback.data.content.includes(expected!));
  }
  assert.equal(f.frames.length, frames, 'refusals send no hub frames');
  assert.deepEqual((await f.fake.control('state')).messages, before);
  await f.hub.stop();
});

test('Discord large ask preserves numbered options inside the native content limit', async t => {
  const f = await fixture(t);
  const options = Array.from({ length: 9 }, (_, i) => `${i + 1} ${'x'.repeat(198)}`);
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'A long question with words. '.repeat(200), options });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'bounded large card mapping', timeoutMs: 1500 });
  const card = (await f.fake.control('state')).messages.find(m => m.id === f.state.messagesForAsk(ask.ask)[0]!.messageId)!;
  assert.ok([...card.content].length <= 2000);
  assert.ok(card.content.includes('full question in the workbench'));
  for (const option of options) assert.ok(card.content.includes(option));
  await f.hub.stop();
});

test('Discord lost defer response still settles the committed outcome without a second callback', async t => {
  const f = await fixture(t, 'topic.answer');
  const card = await openCard(f);
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1`, lose_callback_response: true });
  await until(() => f.frames.some(r => r.frame.type === 'topic.answer'), { what: 'held answer before lost defer', timeoutMs: 1500 });
  await f.clock.advance(2000);
  await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'accepted defer whose native response is lost', timeoutMs: 1500 });
  f.releaseFrames();
  await until(() => f.state.get(`discord.press:${id}`) === 'answered', { what: 'committed answer after lost defer', timeoutMs: 1500 });
  await until(() => f.state.outbox().some(j => j.source === `discord.press:${id}` && j.state === 'sent'), { what: 'owed outcome edit settles independently of defer response', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  assert.deepEqual(native.interactions.find(r => r.id === id)!.callbacks, [{ type: 6 }]);
  assert.deepEqual(native.messages.find(m => m.id === card.message)!.components, []);
  assert.match(native.messages.find(m => m.id === card.message)!.content, /Keep · human via Discord/);
  await f.hub.stop();
});

for (const action of ['other', 'decline']) test(`Discord ${action} modal stores text before updating its card`, async t => {
  let storedBeforeCallback = false;
  const f = await fixture(t, undefined, 'Both cards', (id, type) => { if (type === 7) storedBeforeCallback = f.state.get(`discord.press:${id}`) === 'answered'; }, true);
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Explain your choice', options: ['Keep'], free: true });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'modal card mapping', timeoutMs: 1500 });
  const message = f.state.messagesForAsk(ask.ask)[0]!.messageId;
  const pressed = await f.fake.control('interact', { message_id: message, custom_id: `ask:${ask.ask}:${action}` });
  await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === pressed.id)?.callbacks.length, { what: 'native modal', timeoutMs: 1500 });
  const callback = (await f.fake.control('state')).interactions.find(r => r.id === pressed.id)!.callbacks[0] as { type: number; data: { title: string; custom_id: string; components: Array<{ type: number; content?: string; component?: { type: number; style: number; required: boolean; max_length: number } }> } };
  assert.equal(callback.type, 9);
  assert.equal(callback.data.title, action === 'other' ? 'Your answer' : 'Why decline');
  assert.deepEqual(callback.data.components[0], { type: 10, content: 'Explain your choice' });
  assert.deepEqual(callback.data.components[1]!.component, { type: 4, custom_id: 'answer', style: 2, required: true, max_length: 4000 });
  const submitted = await f.fake.control('interact', { message_id: message, custom_id: callback.data.custom_id, modal_text: 'My considered reason' });
  await until(() => f.state.get(`discord.press:${submitted.id}`) === 'answered', { what: 'durable modal result', timeoutMs: 1500 });
  await until(async () => (await f.fake.control('state')).messages.find(m => m.id === message)?.content.includes('My considered reason') === true, { what: 'modal outcome native edit', timeoutMs: 1500 });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: import('../src/protocol.ts').TopicMessage[] };
  const outcome = history.messages.find(m => m.id === ask.ask)!.ask!.outcome!;
  assert.equal(outcome.status, action === 'other' ? 'answered' : 'declined');
  assert.equal(outcome.via, 'discord');
  const nativeCallback = (await f.fake.control('state')).interactions.find(r => r.id === submitted.id)!.callbacks[0] as { type: number; data: { content: string } };
  assert.equal(storedBeforeCallback, true);
  assert.equal(nativeCallback.type, 7);
  assert.ok(nativeCallback.data.content.includes(action === 'decline' ? 'Declined: My considered reason' : 'My considered reason'));
  assert.deepEqual((await f.fake.control('state')).messages.find(m => m.id === message)!.components, []);
  await driveTelegram(f.clock, f.telegram, until(async () => (await control<{ messages: TgMessage[] }>(f.tg!.url, 'state')).messages.some(m => m.text?.includes('My considered reason') && m.reply_markup && 'inline_keyboard' in m.reply_markup && m.reply_markup.inline_keyboard.length === 0), { what: 'Telegram copy of modal outcome', timeoutMs: 1500 }));
  await f.hub.stop();
});

for (const client of ['nvim', 'web'] as const) test(`Discord REST removes buttons after ${client} answers`, async t => {
  const f = await fixture(t); const card = await openCard(f);
  const ui = await connectUi(t, f.hub.discovery, client);
  assert.equal((await ui.request({ type: 'topic.answer', ask: card.ask, option: 2 })).ok, true);
  await f.clock.advance(250);
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.state === 'sent'), { what: 'external outcome REST settlement', timeoutMs: 1500 });
  const native = (await f.fake.control('state')).messages.find(m => m.id === card.message)!;
  assert.deepEqual(native.components, []); assert.match(native.content, /Change/);
  await f.hub.stop();
});

for (const action of ['withdrawn', 'cancelled']) test(`Discord ${action} ask closes native card`, async t => {
  const f = await fixture(t);
  const topic = (await f.coord.call<{ topic: { id: string } }>('topic.create', { title: 'Closure fixture' })).topic.id;
  const ask = await f.coord.call<{ ask: string }>('ask', { topic, question: 'Still open?', options: ['Yes'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'closure card mapping', timeoutMs: 1500 });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  if (action === 'withdrawn') await f.coord.call('resolve', { topic }); else await ui.request({ type: 'topic.close', topic });
  await f.clock.advance(250);
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.state === 'sent'), { what: 'closure REST settlement', timeoutMs: 1500 });
  const native = (await f.fake.control('state')).messages.find(m => m.id === f.state.messagesForAsk(ask.ask)[0]!.messageId)!;
  assert.deepEqual(native.components, []);
  assert.ok(native.content.includes(action === 'withdrawn' ? 'Withdrawn · asked by coord' : 'Cancelled: topic or item closed'));
  await f.hub.stop();
});

for (const race of [false, true]) test(`Discord and Telegram ${race ? 'race stores one answer' : 'Telegram answer edits Discord'}`, async t => {
  const f = await fixture(t, undefined, 'Shared gate', undefined, true);
  const card = await openCard(f);
  await until(() => f.telegram.messagesForAsk(card.ask).length === 1, { what: 'Telegram mapped copy', timeoutMs: 1500 });
  const message = Number(f.telegram.messagesForAsk(card.ask)[0]!.messageId);
  const presses = [control(f.tg!.url, 'press', { chat_id: 101, message_id: message, row: 1, column: 0 })];
  if (race) presses.push(f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1` }));
  await Promise.all(presses);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await driveTelegram(f.clock, f.telegram, until(() => f.telegram.outbox().some(j => j.kind === 'edit' && j.state === 'sent'), { what: 'Telegram settled winner edit', timeoutMs: 1500 }));
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.state === 'sent'), { what: 'Discord settled winner edit', timeoutMs: 1500 });
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: import('../src/protocol.ts').TopicMessage[] };
  const outcome = history.messages.find(m => m.id === card.ask)!.ask!.outcome!;
  assert.equal(outcome.status, 'answered');
  if (outcome.status !== 'answered') return;
  const discord = (await f.fake.control('state')).messages.find(m => m.id === card.message)!;
  const telegram = (await control<{ messages: TgMessage[] }>(f.tg!.url, 'state')).messages.find(m => m.message_id === message)!;
  assert.ok(discord.content.includes(outcome.text)); assert.ok(telegram.text!.includes(outcome.text));
  assert.deepEqual(discord.components, []); assert.deepEqual(telegram.reply_markup, { inline_keyboard: [] });
  assert.equal((await ui.request({ type: 'topic.answer', ask: card.ask, option: 1 })).ok, false);
  const after = (await ui.request({ type: 'topic.history', topic: 'general' })).value as typeof history;
  assert.deepEqual(after.messages.find(m => m.id === card.ask)!.ask!.outcome, outcome);
  await f.hub.stop();
});

test('Discord drops a queued card closed before native sending', async t => {
  const f = await fixture(t);
  await holdRequest(f, async () => {
    await f.fake.control('fault', { response: 'hold' });
    await f.coord.call('send', { topic: 'general', text: 'Hold the channel lane' });
  });
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Close before send', options: ['Keep'] });
  await f.clock.advance(250);
  await until(() => f.state.outbox().some(j => j.kind === 'card' && j.state === 'queued'), { what: 'queued card behind held lane', timeoutMs: 1500 });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'topic.answer', ask: ask.ask, option: 1 })).ok, true);
  await f.clock.advance(250);
  await f.fake.control('release', {});
  await until(() => f.state.outbox().some(j => j.kind === 'card' && j.state === 'dropped'), { what: 'closed queued card dropped', timeoutMs: 1500 });
  assert.equal(f.state.messagesForAsk(ask.ask).length, 0);
  assert.equal((await f.fake.control('state')).messages.some(m => m.content.includes('Close before send')), false);
  await f.hub.stop();
});

test('Discord restart reconciles an accepted closed card with a lost POST response', async t => {
  const f = await fixture(t);
  let ask!: { ask: string };
  await holdRequest(f, async () => {
    await f.fake.control('fault', { response: 'holdStored' });
    ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Accepted before response lost', options: ['Keep'] });
    await f.clock.advance(250);
  });
  const accepted = (await f.fake.control('state')).messages.find(m => m.content.includes('Accepted before response lost'))!;
  assert.ok(accepted.components!.length > 0);
  assert.equal(f.state.messagesForAsk(ask.ask).length, 0);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'topic.answer', ask: ask.ask, option: 1 })).ok, true);
  await f.clock.advance(250);
  await until(() => !!f.state.get(`discord.card-closure:${ask.ask}`), { what: 'closure saved before native response loss', timeoutMs: 1500 });
  const restarted = await f.restart();
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'recovered accepted native card mapping', timeoutMs: 1500 });
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.target === accepted.id && j.state === 'sent'), { what: 'recovered closed-card edit settlement', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  const copies = native.messages.filter(m => m.id === accepted.id || m.content.includes('Accepted before response lost'));
  assert.equal(copies.length, 1); assert.equal(native.messages.length, 1);
  assert.equal(f.state.messagesForAsk(ask.ask)[0]!.messageId, accepted.id);
  assert.deepEqual(copies[0]!.components, []); assert.match(copies[0]!.content, /Keep · human via Neovim/);
  const posts = native.requests.filter(r => r.method === 'POST' && r.path === `/channels/${ids.channel}/messages`);
  assert.equal(posts.length, 2); assert.equal(posts[0]!.body.nonce, posts[1]!.body.nonce);
  assert.equal(posts[1]!.body.enforce_nonce, true);
  await restarted.stop();
});

for (const aborted of [false, true]) test(`Discord hold setup ${aborted ? 'pre-aborted' : 'omitted'} owns its failure and drains`, async t => {
  const f = await fixture(t);
  const abort = new AbortController();
  if (aborted) abort.abort(new Error('Hold setup intentionally aborted'));
  let entered = false;
  await assert.rejects(holdRequest(f, async () => { entered = true; }, abort.signal),
    aborted ? /Hold setup intentionally aborted/ : /Discord fake hold receipt deadline reached/);
  assert.equal(entered, !aborted);
  assert.equal(f.pending(), 0);
  assert.equal(f.fake.receipts().observers, 0);
  assert.equal(f.fake.receipts().held, 0);
  await f.close();
  const receipt = f.fake.receipts();
  assert.equal(receipt.closed, true); assert.equal(receipt.connections, 0);
  assert.equal(receipt.handlers, 0); assert.equal(receipt.observers, 0); assert.equal(receipt.held, 0);
  assert.equal(f.clock.pending, 0);
});

test('Discord reopen folds a closed card interrupted after mapping before pending General', async t => {
  const clock = new FakeClock();
  const f = await discordExchangeOwner(t, { clock }).start();
  const { root } = await f.project();
  const path = join(root, 'hub.db');
  let store = new Store(path); f.afterDrain(() => store.close());
  let state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const at = clock.now().toISOString();
  const ask: InboxAsk = { id: 'checkpoint-ask', topic: { id: 'general', title: 'General' }, question: 'Checkpoint question', options: ['Keep'], free: true, from: 'coord', label: 'Question', ts: at, since: at };
  state.set(`discord.card-model:${ask.id}`, JSON.stringify(ask));
  let interrupted = false;
  // Inject only after the real atomic completion/map write returns: this is the
  // persisted crash boundary, before the adapter's settled callback can run.
  const checkpoint = new Proxy(state, { get(target, key) {
    if (key === 'writeOutbox') return (...args: Parameters<typeof state.writeOutbox>) => {
      target.writeOutbox(...args);
      if (!interrupted && args[0].kind === 'card' && args[0].state === 'sent') {
        interrupted = true; throw new Error('Interrupted after native mapping commit');
      }
    };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const first = new DiscordOutbox(f.api, checkpoint, clock, f.signal); f.stop(() => first.stop());
  const rendered = discordAsk(ask);
  const held = f.run(signal => f.fake.waitForHold(signal));
  await f.fake.control('fault', { response: 'holdStored' });
  const sent = f.run(() => first.card(ids.channel, rendered.content, rendered.components, ask.id, 'general'));
  await held;
  const original = (await f.fake.control('state')).messages[0]!;
  const general = f.run(() => first.send(ids.channel, 'Pending General', 'checkpoint-general'));
  const closed = f.run(() => first.closeCard(ask.id, { state: 'answered', outcome: { status: 'answered', text: 'Keep', by: 'human', via: 'web', at } }));
  await until(() => !!state.get(`discord.card-closure:${ask.id}`), { what: 'closure before interrupted settlement', timeoutMs: 1000 });
  await f.fake.control('release', {});
  await Promise.all([sent, general, closed].map(work => assert.rejects(work, /Interrupted after native mapping commit/)));
  await first.stop();
  assert.equal(interrupted, true);
  assert.equal(state.messagesForAsk(ask.id)[0]!.messageId, original.id);
  assert.equal(state.outbox().find(j => j.kind === 'card')!.state, 'sent');
  assert.equal(state.outbox().some(j => j.kind === 'edit'), false);
  assert.equal(f.pending(), 0);
  store.close(); store = new Store(path); state = store.remotes.forMessenger('discord');
  const resumed = new DiscordOutbox(f.api, state, clock, f.signal); f.stop(() => resumed.stop());
  const before = (await f.fake.control('state')).requests.length;
  await f.run(() => resumed.resume());
  const native = await f.fake.control('state');
  assert.equal(state.messagesForAsk(ask.id).length, 1);
  assert.equal(state.messagesForAsk(ask.id)[0]!.messageId, original.id);
  assert.equal(native.messages.length, 2);
  const copy = native.messages.find(m => m.id === original.id)!;
  assert.deepEqual(copy.components, []); assert.match(copy.content, /Keep · human via web/);
  assert.equal(native.messages.filter(m => m.content.includes('Checkpoint question')).length, 0);
  assert.equal(native.messages.filter(m => m.content === 'Pending General').length, 1);
  assert.deepEqual(native.requests.slice(before).map(r => [r.method, r.path]), [
    ['PATCH', `/channels/${ids.channel}/messages/${original.id}`], ['POST', `/channels/${ids.channel}/messages`],
  ]);
  assert.ok(state.outbox().some(j => j.kind === 'edit' && j.target === original.id && j.state === 'sent'));
  await f.run(() => resumed.resume());
  assert.equal((await f.fake.control('state')).requests.length, native.requests.length, 'reconciliation is idempotent');
});


test('Discord stale click refuses privately without an answer frame and repairs buttons', async t => {
  const f = await fixture(t);
  const card = await openCard(f);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'topic.answer', ask: card.ask, option: 2 });
  await until(() => !!f.state.get(`discord.card-closure:${card.ask}`), { what: 'durable external closure', timeoutMs: 1500 });
  const before = f.frames.filter(r => r.frame.type === 'topic.answer').length;
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1` });
  await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'stale private acknowledgement', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  assert.deepEqual(native.interactions.find(r => r.id === id)!.callbacks, [{ type: 4, data: { content: 'Already answered', flags: 64, allowed_mentions: { parse: [] } } }]);
  assert.equal(f.frames.filter(r => r.frame.type === 'topic.answer').length, before);
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.target === card.message && j.state === 'sent'), { what: 'stale buttons retired', timeoutMs: 1500 });
  assert.deepEqual((await f.fake.control('state')).messages.find(m => m.id === card.message)!.components, []);
  await f.hub.stop();
});

test('Discord inbox re-sends open asks oldest first with separate keys and keeps every copy live', async t => {
  const f = await fixture(t);
  const empty = await f.command('inbox');
  assert.match(JSON.stringify(empty.callbacks), /Nothing needs you/);
  const first = await openCard(f);
  await f.clock.advance(1);
  const second = await openCard(f);
  const reply = await f.command('inbox');
  assert.match(JSON.stringify(reply.callbacks), /2 open cards/);
  await until(() => f.state.messagesForAsk(first.ask).length === 2 && f.state.messagesForAsk(second.ask).length === 2, { what: 'durable inbox resend mappings', timeoutMs: 1500 });
  const copies = (await f.fake.control('state')).messages;
  assert.deepEqual(copies.map(m => f.state.message(ids.channel, m.id)?.ask), [first.ask, second.ask, first.ask, second.ask]);
  await f.clock.advance(5000);
  const repeated = await f.command('inbox');
  assert.match(JSON.stringify(repeated.callbacks), /2 open cards/);
  await until(() => f.state.messagesForAsk(first.ask).length === 3, { what: 'fresh resend per command', timeoutMs: 1500 });
  await f.clock.advance(5000);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'topic.answer', ask: first.ask, option: 1 });
  await f.clock.advance(250);
  await until(() => f.state.outbox().filter(j => j.kind === 'edit' && j.state === 'sent').length >= 3, { what: 'every first-ask copy closes', timeoutMs: 1500 });
  for (const copy of f.state.messagesForAsk(first.ask)) assert.deepEqual((await f.fake.control('state')).messages.find(m => m.id === copy.messageId)!.components, []);
  const next = await f.command('inbox');
  assert.match(JSON.stringify(next.callbacks), /1 open card/);
  assert.equal(f.state.messagesForAsk(first.ask).length, 3);
  await f.hub.stop();
});

for (const mode of ['immediate', 'deferred', 'lost-defer'] as const) test(`Discord losing click is refused privately ${mode}`, async t => {
  const slow = mode !== 'immediate';
  const f = await fixture(t, 'topic.answer');
  const card = await openCard(f);
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1`, lose_callback_response: mode === 'lost-defer' });
  await until(() => f.frames.some(r => r.frame.type === 'topic.answer'), { what: 'held losing answer', timeoutMs: 1500 });
  if (slow) {
    await f.clock.advance(2000);
    await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'loser deferred acknowledgement', timeoutMs: 1500 });
  }
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'topic.answer', ask: card.ask, option: 2 });
  f.releaseFrames();
  await until(async () => {
    const row = (await f.fake.control('state')).interactions.find(r => r.id === id)!;
    return JSON.stringify(slow ? row.followups : row.callbacks).includes('Already answered');
  }, { what: 'private losing answer refusal', timeoutMs: 1500 });
  const row = (await f.fake.control('state')).interactions.find(r => r.id === id)!;
  const payload = (slow ? row.followups[0] : (row.callbacks[0] as { data: object }).data) as { flags: number };
  assert.equal(payload.flags, 64);
  await until(() => f.state.outbox().some(j => j.kind === 'edit' && j.target === card.message && j.state === 'sent'), { what: 'winner outcome settles', timeoutMs: 1500 });
  assert.deepEqual((await f.fake.control('state')).messages.find(m => m.id === card.message)!.components, []);
  await f.hub.stop();
});

for (const replace of [false, true]) test(`Discord inbox held read loses authority on ${replace ? 'replacement' : 'unpair'}`, async t => {
  const f = await fixture(t, 'inbox.list');
  await openCard(f);
  const before = f.state.outbox().filter(j => j.kind === 'card').length;
  const { id } = await f.fake.control('interact', { command: 'inbox' });
  await until(() => f.frames.some(r => r.frame.type === 'inbox.list'), { what: 'captured inbox read before pairing change', timeoutMs: 1500 });
  f.state.setPairing(replace ? { userId: ids.member, chatId: ids.channel, guildId: ids.guild, name: 'Replacement' } : null);
  f.releaseFrames();
  await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'obsolete command settlement', timeoutMs: 1500 });
  assert.equal(f.state.outbox().filter(j => j.kind === 'card').length, before, 'obsolete command enqueues no publication');
  assert.equal((await f.fake.control('state')).messages.length, 1);
  await f.hub.stop();
});

test('Discord explicit inbox probes restored delivery from durable unavailable state', async t => {
  const f = await fixture(t);
  const card = await openCard(f);
  // Model the persisted outage checkpoint; native REST is now healthy.
  f.state.set('outbox.unavailable', '1');
  const response = await f.command('inbox');
  assert.match(JSON.stringify(response.callbacks), /1 open card/);
  await until(() => f.state.messagesForAsk(card.ask).length === 2, { what: 'restored native resend settlement', timeoutMs: 1500 });
  assert.equal(f.state.get('outbox.unavailable'), null);
  assert.equal((await f.fake.control('state')).messages.length, 2);
  await f.hub.stop();
});


test('Discord loser waits for held initial acknowledgement acceptance before followup', async t => {
  const gate = Promise.withResolvers<void>();
  let arrived = false;
  const trace: string[] = [];
  let ready = false;
  t.after(() => gate.resolve());
  const f = await fixture(t, 'topic.answer', 'Held callback', async (_id, type) => {
    if (type === 6) { arrived = true; await gate.promise; trace.push('accepted'); }
  }, false, entry => {
    if (entry.event === 'discord-card-refusal-ready') { trace.push('ready'); ready = true; }
    if (entry.event === 'discord-card-refusal-followup') trace.push('followup');
  });
  const card = await openCard(f);
  const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1` });
  await until(() => f.frames.some(r => r.frame.type === 'topic.answer'), { what: 'held answer before initial acknowledgement', timeoutMs: 1500 });
  await f.clock.advance(2000);
  await until(() => arrived, { what: 'native initial callback arrival', timeoutMs: 1500 });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'topic.answer', ask: card.ask, option: 2 });
  f.releaseFrames();
  await until(() => ready, { what: 'consumed losing result at initial-ack join', timeoutMs: 1500 });
  gate.resolve();
  await until(async () => (await f.fake.control('state')).interactions.find(r => r.id === id)!.followups.length === 1, { what: 'private refusal after accepted initial acknowledgement', timeoutMs: 1500 });
  const row = (await f.fake.control('state')).interactions.find(r => r.id === id)!;
  assert.deepEqual(trace, ['ready', 'accepted', 'followup']);
  assert.deepEqual(row.callbacks, [{ type: 6 }]);
  assert.match(JSON.stringify(row.followups), /Already answered/);
  await f.hub.stop();
});

for (const harness of ['codex', 'opencode'] as const) test(`Discord ${harness} approval truncates native command and commits before styled outcome callback`, async t => {
  let savedBeforeCallback = false;
  const f = await fixture(t, undefined, 'Approvals', (_id, type) => {
    if (type === 7) savedBeforeCallback = f.store.inboxOutcome('approval', record.id)?.via === 'discord';
  }, false, undefined, harness);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  assert.equal((await ui.request({ type: 'session.launch', name: 'approval-worker', harness, role: 'implementer' })).ok, true);
  await until(f.script!.ready, { what: 'scripted native approval subscription', timeoutMs: 1500 });
  const raised = ui.waitFor(frame => frame.type === 'approval' && (frame.approval as import('../src/protocol.ts').InboxApproval).answerIn === 'hub', 1500);
  f.script!.raise('x'.repeat(5000));
  const record = (await raised).approval as import('../src/protocol.ts').InboxApproval;
  await f.clock.advance(250);
  await until(() => f.state.messagesForApproval(record.id).length === 1, { what: 'durable Discord approval mapping', timeoutMs: 1500 });
  const card = (await f.fake.control('state')).messages.find(m => m.id === f.state.messagesForApproval(record.id)[0]!.messageId)!;
  assert.match(card.content, new RegExp(`approval-worker.*${harness}`));
  assert.ok([...card.content].length <= 2000);
  assert.match(card.content, /```[\s\S]*x+[\s\S]*```/);
  assert.match(card.content, /full command in the workbench/);
  assert.deepEqual(card.components!.flatMap(row => row.components).map(b => [b.label, b.style]), [['Approve once', 3], ['Always allow', 1], ['Deny', 4]]);
  const { id } = await f.fake.control('interact', { message_id: card.id, custom_id: `approval:${record.id}:once` });
  await until(async () => !!(await f.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length, { what: 'approval native callback', timeoutMs: 1500 });
  assert.equal(savedBeforeCallback, true);
  const native = await f.fake.control('state');
  assert.equal((native.interactions.find(row => row.id === id)!.callbacks[0] as { type: number }).type, 7);
  assert.match(native.messages.find(m => m.id === card.id)!.content, /Approved once · human via Discord · \d\d:\d\d/);
  assert.deepEqual(native.messages.find(m => m.id === card.id)!.components, []);
  await until(() => f.script!.commands.length === 1, { what: 'scripted harness receives native approval', timeoutMs: 1500 });
  assert.equal(f.script!.commands[0]!.outcome, 'ran');
  await f.hub.stop();
});

for (const longTitle of [false, true]) for (const origin of [undefined, 'https://workbench.invalid']) test(`Discord notices and referenced replies with origin ${origin ?? 'unset'}${longTitle ? ' and long plan title' : ''}`, async t => {
  const f = await fixture(t, undefined, 'Notices', undefined, false, undefined, undefined, origin);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const request = async <T>(frame: { type: string } & Record<string, unknown>) => {
    const result = await ui.request(frame); assert.equal(result.ok, true, result.error); return result.value as T;
  };
  const epic = (await request<{ item: { id: string } }>({ type: 'task.create', kind: 'epic', title: 'Notice epic' + (longTitle ? '🪐'.repeat(2500) : '') })).item.id;
  const topic = (await request<{ topic: { id: string } }>({ type: 'topic.create', title: 'Notice topic', item: epic })).topic.id;
  await request({ type: 'visibility.set', surface: 'topics', target: topic, mode: 'pin' });
  const task = (await request<{ item: { id: string } }>({ type: 'task.create', size: 'S', title: 'Planned work', parent: epic })).item.id;
  const mappedNotice = async (source: string) => {
    await f.clock.advance(250);
    await until(async () => (await f.fake.control('state')).messages.some(m => f.state.message(ids.channel, m.id)?.message === source), { what: 'durable notice mapping', timeoutMs: 1500 });
    return (await f.fake.control('state')).messages.find(m => f.state.message(ids.channel, m.id)?.message === source)!;
  };
  await request({ type: 'task.plan', item: epic, op: 'set', yaml: JSON.stringify({ stages: [{ name: 'Build', lanes: [[task]], qa: { scope: 'none', when: 'after-stage' } }] }) });
  const plan = await mappedNotice(epic);
  assert.match(plan.content, /^📥.*Plan/);
  assert.ok([...plan.content].length <= 2000);
  assert.match(plan.content, /Plans are approved in the workbench\./);
  if (longTitle) assert.match(plan.content, /…/);
  assert.equal(plan.content.includes('https://'), !!origin);
  if (origin) assert.ok(plan.content.includes(origin));
  assert.ok(!plan.content.includes('web.link'));
  const sentNotice = async (text: string, fields: Record<string, unknown> = {}) => {
    assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic, text, ...fields })).ok, true);
    const source = (await request<{ messages: import('../src/protocol.ts').TopicMessage[] }>({ type: 'topic.history', topic })).messages.at(-1)!.id;
    return { source, card: await mappedNotice(source) };
  };
  const review = await sentNotice('Review this plan', { kind: 'request', request: 'review', subject: epic });
  assert.match(review.card.content, /^📥.*review/);
  const message = await sentNotice('Read this item report');
  assert.match(message.card.content, /^📥.*coord/);
  await request({ type: 'session.launch', name: 'claude-worker', harness: 'claude-code', role: 'implementer' });
  f.hub.fakes['claude-code']!.waitingForApproval('claude-worker', 'touch reviewed');
  const approval = (await request<import('../src/protocol.ts').Inbox>({ type: 'inbox.list' })).approvals.find(row => row.session === 'claude-worker')!;
  const tui = await mappedNotice(approval.id);
  assert.match(tui.content, /^📥.*claude-worker/);
  assert.match(tui.content, /Answer in its terminal/);
  for (const card of [plan, review.card, message.card, tui]) assert.equal(card.components?.length ?? 0, 0);
  let next = 90071992547449990n;
  const reply = async (card: { id: string }, text: string, topic: string) => {
    const id = String(next++);
    await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id, type: 19, channel_id: ids.channel, author: { id: ids.human }, content: text, message_reference: { message_id: card.id } } });
    await until(() => !!f.state.get(`discord.inbound:${id}`), { what: `saved notice reply ${text}`, timeoutMs: 1500 });
    return (await request<{ messages: import('../src/protocol.ts').TopicMessage[] }>({ type: 'topic.history', topic })).messages.at(-1)!;
  };
  const reviewReply = await reply(review.card, 'Review reply', topic);
  assert.equal(reviewReply.text, 'Review reply'); assert.equal(reviewReply.replyTo, review.source); assert.equal(reviewReply.via, 'discord');
  await f.clock.advance(5000);
  const planReply = await reply(plan, 'Plan reply', 'general');
  assert.equal(planReply.text, `re plan ${epic}: Plan reply`);
  await f.hub.stop();
});

// Existing fake lifecycle seam supplements the native scripted producer cases above.
test('Discord approval inbox copies reject cross-kind keys and fold a workbench answer everywhere', async t => {
  const f = await fixture(t);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  await ui.request({ type: 'session.launch', name: 'approval-worker', harness: 'codex', role: 'implementer' });
  const raised = ui.waitFor(frame => frame.type === 'approval' && (frame.approval as import('../src/protocol.ts').InboxApproval).answerIn === 'hub', 1500);
  f.hub.fakes.codex!.raiseApproval('approval-worker', { id: 'copies', kind: 'command', subject: { command: 'echo copies' }, choices: ['once', 'deny'] });
  const record = (await raised).approval as import('../src/protocol.ts').InboxApproval;
  await f.clock.advance(250);
  await until(() => f.state.messagesForApproval(record.id).length === 1, { what: 'mapped approval', timeoutMs: 1500 });
  const original = f.state.messagesForApproval(record.id)[0]!.messageId;
  const ask = await openCard(f);
  const refused = async (message: string, custom_id: string, user?: string) => {
    const { id } = await f.fake.control('interact', { message_id: message, custom_id, ...(user ? { user } : {}) });
    await until(async () => !!(await f.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length, { what: 'private approval refusal', timeoutMs: 1500 });
    const callback = (await f.fake.control('state')).interactions.find(row => row.id === id)!.callbacks[0] as { type: number; data: { flags: number; content: string } };
    assert.equal(callback.type, 4); assert.equal(callback.data.flags & 64, 64);
  };
  const frames = f.frames.filter(row => ['approval.answer', 'topic.answer'].includes(String(row.frame.type))).length;
  await refused(original, `ask:${record.id}:1`);
  await refused(ask.message, `approval:${record.id}:once`);
  await refused(original, `approval:${record.id}:always`);
  await refused(original, `approval:${record.id}:once`, 'member');
  assert.equal(f.frames.filter(row => ['approval.answer', 'topic.answer'].includes(String(row.frame.type))).length, frames);
  await f.command('inbox');
  await until(() => f.state.messagesForApproval(record.id).length === 2, { what: 'inbox approval copy mapped', timeoutMs: 1500 });
  await f.clock.advance(5000);
  const result = await ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny' });
  assert.equal(result.ok, true, result.error);
  await until(() => f.state.messagesForApproval(record.id).every(copy => f.state.outbox().some(job => job.kind === 'edit' && job.target === copy.messageId && job.state === 'sent')), { what: 'all approval copies durably edited', timeoutMs: 1500 });
  const native = await f.fake.control('state');
  for (const copy of f.state.messagesForApproval(record.id)) {
    const message = native.messages.find(row => row.id === copy.messageId)!;
    assert.match(message.content, /Denied · human via Neovim/); assert.deepEqual(message.components, []);
  }
  const beforeStale = f.frames.filter(row => row.frame.type === 'approval.answer').length;
  await refused(original, `approval:${record.id}:once`);
  assert.equal(f.frames.filter(row => row.frame.type === 'approval.answer').length, beforeStale);
  const outcome = f.store.inboxOutcome('approval', record.id)!;
  assert.ok('choice' in outcome); assert.equal(outcome.choice, 'deny');
  await f.hub.stop();
});


test('Discord hub restart after thirty seconds resumes without Identify', async t => {
  const f = await fixture(t);
  await f.restart(30000);
  await until(async () => (await f.fake.control('state')).gateway.resumes === 1, { what: 'native restart RESUME', timeoutMs: 2000 });
  const native = await f.fake.control('state');
  assert.equal(native.gateway.identifies, 1);
  assert.equal(native.gateway.validResume, true);
  assert.equal(native.gateway.closes[0], 4000);
});


test('Discord replayed message reaches General once with written and return times', async t => {
  const f = await fixture(t);
  f.clock.block(45000);
  const written = f.clock.now().toISOString();
  const event = { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000111', channel_id: ids.channel, guild_id: ids.guild, author: { id: ids.human }, type: 0, content: 'During restart', timestamp: written } };
  const hub = await f.restart(30000, async () => { await f.fake.control('dispatch', event); });
  const next = await connectUi(t, hub.discovery, 'nvim');
  let messages: Array<{ text: string }> = [];
  await until(async () => { messages = ((await next.request({ type: 'topic.history', topic: 'general' })).value as { messages: typeof messages }).messages; return messages.some(m => m.text.includes('During restart')); }, { what: 'durable late General message', timeoutMs: 2000 });
  assert.equal(messages.filter(m => m.text.includes('During restart')).length, 1);
  assert.equal(messages.find(m => m.text.includes('During restart'))!.text, `During restart\n\n(written on Discord at ${written.slice(11,16)}; the hub was down until ${f.clock.now().toISOString().slice(11,16)})`);
  await f.fake.control('dispatch', event);
  await next.request({ type: 'hub.status' });
  assert.equal(f.state.entries('discord.inbound:').filter(row => row.key.endsWith('900000000000000111')).length, 1);
});


test('Discord resumed press resends only its card without answering or acknowledging', async t => {
  const f = await fixture(t);
  const a = await openCard(f);
  const b = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Unpressed card', options: ['Yes', 'No'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(b.ask).length === 1, { what: 'unpressed mapping', timeoutMs: 1500 });
  const old = f.state.messagesForAsk(a.ask)[0]!.messageId;
  let press = '';
  const hub = await f.restart(30000, async () => { press = (await f.fake.control('interact', { message_id: old, custom_id: `ask:${a.ask}:1` })).id; });
  await until(() => f.state.messagesForAsk(a.ask).length === 2, { what: 'pressed replay card resend mapping', timeoutMs: 2000 });
  await until(async () => (await f.fake.control('state')).messages.find(m => m.id === old)?.content === '↓ Re-sent below', { what: 'old copy edit receipt', timeoutMs: 2000 });
  const native = await f.fake.control('state');
  assert.equal(native.messages.find(m => m.id === old)!.components?.length, 0);
  assert.match(native.messages.at(-1)!.content, /a button pressed then may have been lost; press again/);
  assert.equal(f.state.messagesForAsk(b.ask).length, 1);
  assert.equal(native.interactions.find(i => i.id === press)!.callbacks.length, 0);
  assert.equal(f.frames.filter(r => r.frame.type === 'topic.answer').length, 0);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const inbox = (await ui.request({ type: 'inbox.list' })).value as import('../src/protocol.ts').Inbox;
  assert.ok(inbox.asks.some(row => row.id === a.ask));
});


test('Discord config disable and reload closes normally and reenable identifies afresh', async t => {
  const f = await fixture(t);
  for (const args of [['config', 'set', 'remote.discord.enabled', 'false'], ['hub', 'reload']]) {
    const result = await cland(f.root, ...args); assert.equal(result.code, 0, result.stderr);
  }
  await until(async () => (await f.fake.control('state')).gateway.closes.length === 1, { what: 'disabled native close receipt', timeoutMs: 2000 });
  assert.equal((await f.fake.control('state')).gateway.closes[0], 1000);
  await f.clock.advance(5000);
  for (const args of [['config', 'set', 'remote.discord.enabled', 'true'], ['hub', 'reload']]) {
    const result = await cland(f.root, ...args); assert.equal(result.code, 0, result.stderr);
  }
  await until(async () => (await f.fake.control('state')).gateway.identifies === 2, { what: 'fresh Identify after disable', timeoutMs: 2000 });
  assert.equal((await f.fake.control('state')).gateway.resumes, 0);
});


test('Discord resumed scripted approval press preserves the colon-bearing approval identity', async t => {
  const f = await fixture(t, undefined, 'Replay approval', undefined, false, undefined, 'codex');
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  assert.equal((await ui.request({ type: 'session.launch', name: 'approval-worker', harness: 'codex', role: 'implementer' })).ok, true);
  await until(f.script!.ready, { what: 'scripted native approval subscription', timeoutMs: 1500 });
  const raised = ui.waitFor(frame => frame.type === 'approval' && (frame.approval as import('../src/protocol.ts').InboxApproval).answerIn === 'hub', 1500);
  f.script!.raise('x'.repeat(5000));
  const record = (await raised).approval as import('../src/protocol.ts').InboxApproval;
  assert.ok(record.id.includes(':'));
  await f.clock.advance(250);
  await until(() => f.state.messagesForApproval(record.id).length === 1, { what: 'durable original approval mapping', timeoutMs: 1500 });
  const old = f.state.messagesForApproval(record.id)[0]!.messageId;
  let press = '';
  await f.restart(30000, async () => { press = (await f.fake.control('interact', { message_id: old, custom_id: `approval:${record.id}:once` })).id; });
  await until(() => f.state.messagesForApproval(record.id).length === 2, { what: 'replayed approval resend mapping', timeoutMs: 2000 });
  await until(async () => (await f.fake.control('state')).messages.find(m => m.id === old)?.content === '↓ Re-sent below', { what: 'old approval native edit', timeoutMs: 2000 });
  const native = await f.fake.control('state');
  assert.equal(native.messages.find(m => m.id === old)!.components?.length, 0);
  assert.match(native.messages.at(-1)!.content, /a button pressed then may have been lost; press again/);
  assert.equal(native.interactions.find(i => i.id === press)!.callbacks.length, 0);
  assert.equal(f.frames.filter(r => r.frame.type === 'approval.answer').length, 0);
  assert.equal(f.script!.commands.length, 0);
  assert.ok([...native.messages.at(-1)!.content].length <= 2000);
  assert.match(native.messages.at(-1)!.content, /```[\s\S]*x+[\s\S]*```/);
  assert.match(native.messages.at(-1)!.content, /full command in the workbench/);
});


test('Discord replay retains the complete numbered option list in a long card', async t => {
  const f = await fixture(t);
  const options = Array.from({ length: 9 }, (_, i) => `Option ${i + 1}: ${'🪐'.repeat(80)}`);
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'long question '.repeat(500), options });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 1, { what: 'original long numbered card mapping', timeoutMs: 1500 });
  const old = f.state.messagesForAsk(ask.ask)[0]!.messageId;
  await f.restart(30000, async () => { await f.fake.control('interact', { message_id: old, custom_id: `ask:${ask.ask}:9` }); });
  await until(() => f.state.messagesForAsk(ask.ask).length === 2, { what: 'long numbered replay mapping', timeoutMs: 2000 });
  await until(async () => (await f.fake.control('state')).messages.find(m => m.id === old)?.content === '↓ Re-sent below', { what: 'long numbered old copy removal', timeoutMs: 2000 });
  const native = await f.fake.control('state');
  const card = native.messages.at(-1)!;
  assert.ok([...card.content].length <= 2000);
  for (const [i, option] of options.entries()) assert.ok(card.content.includes(`${i + 1}. ${option}`), `complete option ${i + 1}`);
  assert.match(card.content, /a button pressed then may have been lost; press again/);
  assert.deepEqual(card.components!.slice(0,2).flatMap(row => row.components.map(b => b.label)), ['1','2','3','4','5','6','7','8','9']);
  assert.equal(native.messages.find(m => m.id === old)!.components?.length, 0);
});


test('Discord refused stale-topic input keeps the remote live for the following valid input', async t => {
  const f = await fixture(t);
  f.state.putMessage({ chatId: ids.channel, messageId: '900000000000000301', topic: 'deleted-topic', message: null, ask: null, approval: null });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000302', channel_id: ids.channel, author: { id: ids.human }, type: 19, content: 'Stale reply', message_reference: { message_id: '900000000000000301' } } });
  await until(() => f.state.get('discord.inbound:900000000000000302') === '1', { what: 'durable handled refusal', timeoutMs: 2000 });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000303', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'Valid after refusal' } });
  await until(() => !!f.state.get('discord.inbound:900000000000000303'), { what: 'valid input committed after refusal', timeoutMs: 2000 });
  await f.fake.control('dispatch', { op: 1, d: null });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await until(async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: import('../src/protocol.ts').RemoteStatusRow[] }).remotes[1]!.connection === 'connected', { what: 'remote remains connected after refusal', timeoutMs: 2000 });
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> };
  assert.equal(history.messages.filter(m => m.text === 'Valid after refusal').length, 1);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
});

test('Discord interrupted input confirmation replays the uncommitted input after restart', async t => {
  const f = await fixture(t, 'topic.send');
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000401', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'Interrupted input', timestamp: f.clock.now().toISOString() } });
  await until(() => f.frames.some(row => row.frame.type === 'topic.send'), { what: 'held exact inbound frame', timeoutMs: 1500 });
  assert.equal(f.state.get('discord.inbound:900000000000000401'), null);
  const hub = await f.restart(30000, async () => { f.discardFrames(); });
  await until(() => !!f.state.get('discord.inbound:900000000000000401'), { what: 'replayed input durable completion', timeoutMs: 2000 });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> };
  assert.equal(history.messages.filter(m => m.text.startsWith('Interrupted input')).length, 1);
  assert.equal((await f.fake.control('state')).gateway.resumes, 1);
});


test('Discord live resume labels input with the current recovery minute', async t => {
  const f = await fixture(t);
  f.clock.block(45000);
  const written = f.clock.now().toISOString();
  await f.fake.control('drop', {});
  await until(async () => (await f.fake.control('state')).gateway.closes.length === 1, { what: 'native dropped socket', timeoutMs: 1500 });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000501', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'Live outage input', timestamp: written } });
  f.clock.block(30000);
  await f.clock.advance(1);
  await until(() => !!f.state.get('discord.inbound:900000000000000501'), { what: 'live replay input completion', timeoutMs: 2000 });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> };
  assert.equal(history.messages.find(m => m.text.startsWith('Live outage input'))!.text, 'Live outage input\n\n(written on Discord at 12:00; the hub was down until 12:01)');
  assert.equal((await f.fake.control('state')).gateway.identifies, 1);
});


test('Discord replay stores all buffered input before resending a pressed card', async t => {
  let drainWaiting = false;
  const f = await fixture(t, 'topic.send', 'Replay order', undefined, false, entry => { if (entry.event === 'discord-replay-drain-waiting') drainWaiting = true; });
  const card = await openCard(f);
  await f.coord.close();
  const hub = await f.restart(30000, async () => {
    await f.fake.control('interact', { message_id: card.message, custom_id: `ask:${card.ask}:1` });
    await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000601', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'Later buffered input', timestamp: f.clock.now().toISOString() } });
  });
  await until(() => f.frames.some(row => row.frame.type === 'topic.send'), { what: 'held later replay input', timeoutMs: 1500 });
  await until(() => drainWaiting || f.state.messagesForAsk(card.ask).length === 2, { what: 'replay drain boundary or premature native resend', timeoutMs: 2000 });
  assert.equal(f.state.messagesForAsk(card.ask).length, 1, 'no native resend before durable input');
  assert.equal(f.state.get('discord.inbound:900000000000000601'), null);
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const delivered = coord.waitForEvent(e => e.params.content === 'Later buffered input\n\n(written on Discord at 12:00; the hub was down until 12:00)');
  void delivered.catch(() => {});
  await holdRequest(f, async () => {
    await f.fake.control('fault', { response: 'hold' });
    f.releaseFrames();
  });
  await delivered;
  await until(() => JSON.parse(f.state.get('discord.inbound:900000000000000601') ?? '{}').delivered === true, { what: 'durable replay delivery before resend drain', timeoutMs: 1500 });
  await f.fake.control('release', {});
  await until(() => f.state.outbox().some(job => job.source?.endsWith('900000000000000601:👌') && job.state === 'sent'), { what: 'durable stored reaction before replay feedback pacing', timeoutMs: 1500 });
  await f.clock.advance(250);
  await until(() => !!f.state.get('discord.inbound:900000000000000601') && f.state.messagesForAsk(card.ask).length === 2, { what: 'input then resend committed', timeoutMs: 2000 });
  await until(async () => (await f.fake.control('state')).messages.find(m => m.id === card.message)?.content === '↓ Re-sent below', { what: 'ordered replay old copy edit', timeoutMs: 2000 });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> };
  assert.equal(history.messages.find(m => m.text.startsWith('Later buffered input'))!.text, 'Later buffered input\n\n(written on Discord at 12:00; the hub was down until 12:00)');
  assert.equal((await f.fake.control('state')).messages.find(m => m.id === card.message)!.components?.length, 0);
});


test('Discord fatal close remains sessionless after full shutdown and identifies on restart', async t => {
  const f = await fixture(t);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await f.fake.control('close', { code: 4004 });
  await until(async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: import('../src/protocol.ts').RemoteStatusRow[] }).remotes[1]!.connection === 'disabled', { what: 'fatal remote disable receipt', timeoutMs: 2000 });
  await f.hub.stop();
  assert.equal(f.state.get('discord.session'), null, 'fatal close must remain forgotten after normal owner stop');
  await f.restart(30000);
  await until(async () => (await f.fake.control('state')).gateway.identifies === 2, { what: 'fresh Identify after terminal close', timeoutMs: 2000 });
  assert.equal((await f.fake.control('state')).gateway.resumes, 0);
});


test('Discord each live resume gates an owed resend before input without a new press', async t => {
  const f = await fixture(t, 'topic.send');
  const card = await openCard(f);
  f.state.set('discord.replay-press:900000000000000701', JSON.stringify({ channel: ids.channel, user: ids.human, kind: 'ask', card: card.ask, old: card.message }));
  await f.fake.control('drop', {});
  await until(async () => (await f.fake.control('state')).gateway.closes.length === 1, { what: 'native close before owed-replay resume', timeoutMs: 1500 });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '900000000000000702', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'No new press input', timestamp: f.clock.now().toISOString() } });
  await f.clock.advance(1);
  await until(() => f.frames.some(row => row.frame.type === 'topic.send'), { what: 'held later input without press', timeoutMs: 1500 });
  const peer = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Trigger inbox publication', options: ['Yes','No'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(peer.ask).length === 1, { what: 'durable inbox publication while replay input held', timeoutMs: 2000 });
  assert.equal(f.state.messagesForAsk(card.ask).length, 1, 'owed resend stays gated across RESUME without a press');
  assert.equal(f.state.get('discord.inbound:900000000000000702'), null);
  // The peer's durable native receipt ends this burst; reset learned pacing before releasing the next.
  await f.clock.advance(5000);
  f.releaseFrames();
  await until(() => f.state.outbox().some(job => job.source?.endsWith('900000000000000702:👌') && job.state === 'sent'), { what: 'durable stored reaction before next reaction bucket', timeoutMs: 1500 });
  await f.clock.advance(250);
  await until(() => !!f.state.get('discord.inbound:900000000000000702') && f.state.messagesForAsk(card.ask).length === 2, { what: 'input then owed resend completion', timeoutMs: 2000 });
  await until(async () => (await f.fake.control('state')).messages.find(m => m.id === card.message)?.content === '↓ Re-sent below', { what: 'owed old copy native edit', timeoutMs: 2000 });
  const native = await f.fake.control('state');
  assert.equal(native.interactions.length, 0, 'no fresh interaction triggered recovery');
  assert.equal(native.messages.find(m => m.id === card.message)!.components?.length, 0);
});
