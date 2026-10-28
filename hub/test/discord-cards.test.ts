// T2: production frame port and sealed loopback Discord REST/ws.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, inProcessSpoke, until, connectUi } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { messengerFactory } from '../src/remote/messenger.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { FakeClock } from './fake-clock.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';

async function fixture(t: TestContext, holdType?: string, projectName = 'Cards fixture', onCallback?: (id: string, type: number) => void) {
  const clock = new FakeClock();
  const exchange = await discordExchangeOwner(t, { clock, ...(onCallback ? { onCallback } : {}) }).start();
  const { root } = await exchange.project();
  const config = defaultConfig('Commands fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const env = { CLAND_DISCORD_API_ROOT: exchange.fake.url };
  const factory = messengerFactory(env, remoteRedactor(), clock, { state: store.remotes, projectName: () => projectName });
  const frames: Array<{ frame: Record<string, unknown>; ingress?: import('../src/remote/gateway.ts').RemoteIngress }> = [];
  const held: Array<() => void> = [];
  let remote: import('../src/remote/gateway.ts').Remote;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  exchange.stop(() => hub?.stop());
  await exchange.run(async () => {
    hub = await projectHub(t, root, env, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN }, gatewayMessenger: (...args) => {
      remote = factory(...args); const start = remote.start.bind(remote);
      remote.start = (send, ...rest) => start((frame, ingress, bytes) => {
        frames.push({ frame, ...(ingress ? { ingress } : {}) });
        if (frame.type === holdType) held.push(() => send(frame, ingress, bytes)); else send(frame, ingress, bytes);
      }, ...rest);
      return remote;
    } });
    if (exchange.signal.aborted) await hub.stop();
  });
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
  return { ...exchange, hub: hub!, clock, state, coord, command, frames, telegramMute: () => store.remotes.forMessenger('telegram').get('mute'), releaseFrames: () => { holdType = undefined; for (const send of held.splice(0)) send(); } };
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

test('Discord refuses foreign and forged card clicks and privately marks modal placeholders', async t => {
  const f = await fixture(t);
  const card = await openCard(f);
  for (const [custom, user, expected] of [
    [`ask:${card.ask}:1`, 'member', 'not paired'],
    ['ask:unissued:1', 'human', 'not available'],
    [`ask:${card.ask}:9`, 'human', 'not available'],
    [`ask:${card.ask}:decline`, 'human', 'not available yet'],
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
