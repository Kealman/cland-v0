// T2: production frame port and sealed loopback Discord REST/ws.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, inProcessSpoke, until, connectUi } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { messengerFactory } from '../src/remote/messenger.ts';
import { DiscordOutbox } from '../src/remote/discord-outbox.ts';
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

async function fixture(t: TestContext, holdType?: string, projectName = 'Cards fixture', onCallback?: (id: string, type: number) => void, both = false) {
  const clock = new FakeClock();
  const exchange = await discordExchangeOwner(t, { clock, ...(onCallback ? { onCallback } : {}) }).start();
  const { root } = await exchange.project();
  const tgOwner = both ? fakeTelegramFixture(t, { clock }) : undefined;
  const tg = await tgOwner?.start();
  const config = defaultConfig('Commands fixture'); config.remote.discord.enabled = true; config.remote.telegram.enabled = both;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const telegram = store.remotes.forMessenger('telegram');
  if (both) telegram.setPairing(pairing);
  const env = { CLAND_DISCORD_API_ROOT: exchange.fake.url, ...(tg ? { CLAND_TELEGRAM_API_ROOT: tg.url } : {}) };
  const factory = messengerFactory(env, remoteRedactor(), clock, { state: store.remotes, projectName: () => projectName });
  const frames: Array<{ frame: Record<string, unknown>; ingress?: import('../src/remote/gateway.ts').RemoteIngress }> = [];
  const held: Array<() => void> = [];
  let remote: import('../src/remote/gateway.ts').Remote;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  exchange.stop(() => hub?.stop());
  const startHub = () => exchange.run(async () => {
    hub = await projectHub(t, root, env, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, ...(both ? { 'telegram.token': TELEGRAM_TEST_TOKEN } : {}) }, gatewayMessenger: (...args) => {
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
  return { ...exchange, tg, telegram, hub: hub!, restart: async () => { await hub!.stop(); await clock.advance(5000); await startHub(); return hub!; }, clock, state, coord, command, frames, telegramMute: () => store.remotes.forMessenger('telegram').get('mute'), releaseFrames: () => { holdType = undefined; for (const send of held.splice(0)) send(); } };
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
  for (const [custom, user, expected] of [
    [`ask:${card.ask}:1`, 'member', 'not paired'],
    ['ask:unissued:1', 'human', 'not available'],
    [`ask:${card.ask}:9`, 'human', 'not available'],
  ]) {
    const { id } = await f.fake.control('interact', { message_id: card.message, custom_id: custom, user });
    await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'private refused click', timeoutMs: 1500 });
    const callback = (await f.fake.control('state')).interactions.find(r => r.id === id)!.callbacks[0] as { type: number; data: { content: string; flags: number } };
    assert.equal(callback.type, 4); assert.equal(callback.data.flags, 64); assert.ok(callback.data.content.includes(expected!));
  }
  assert.equal(f.frames.filter(r => r.frame.type === 'topic.answer').length, 0);
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
