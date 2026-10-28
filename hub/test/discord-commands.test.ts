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

async function fixture(t: TestContext, holdType?: string, projectName = 'Commands fixture') {
  const clock = new FakeClock();
  const exchange = await discordExchangeOwner(t, { clock }).start();
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

test('Discord status is ephemeral with phone groups, session bullets and gateway numbers last', async t => {
  const f = await fixture(t);
  f.state.set('discord.identify', JSON.stringify({ timestamps: [f.clock.now().getTime(), f.clock.now().getTime() - 1, f.clock.now().getTime() - 86400000], failures: 0, warned: null }));
  await f.fake.control('configure', { session_start_limit: { total: 1000, remaining: 137, reset_after: 10000, max_concurrency: 1 } });
  const row = await f.command('status');
  const callback = row.callbacks[0] as { type: number; data: { flags: number; content: string; allowed_mentions: object } };
  assert.equal(callback.type, 4); assert.equal(callback.data.flags, 64);
  assert.deepEqual(callback.data.allowed_mentions, { parse: [] });
  const text = callback.data.content;
  assert.ok(text.startsWith('**Commands fixture — Status**\n\n**Hub**\nVersion '), text);
  assert.match(text, /\nUp [^\n]+\n\n\*\*Coordinator\*\*\ncoord\nNeeds you: 0/);
  assert.match(text, /\*\*Sessions \(1\)\*\*\n- coord \\\[Coordinator\\\]: /);
  assert.match(text, /\*\*Queues\*\*\nVerification: idle\nWaiting: 0\nMerge queue: 0/);
  assert.match(text, /\*\*Release\*\*\nNone open\n\n\*\*This channel\*\*\nConnected\nGeneral on/);
  assert.match(text, /\n-# Outbox: 0\n-# Identifies today: 2\n-# Remaining session starts: 137$/);
  assert.ok(!text.includes(' · '), text);
  await f.hub.stop();
});

test('Discord help is ephemeral with short headed sections, command bullets and trust last', async t => {
  const f = await fixture(t);
  const row = await f.command('help');
  const callback = row.callbacks[0] as { type: number; data: { flags: number; content: string } };
  assert.equal(callback.type, 4); assert.equal(callback.data.flags, 64);
  const text = callback.data.content;
  assert.ok(text.startsWith('**Commands fixture — Help**\n\n**Follow**\n'), text);
  assert.match(text, /\n\n\*\*Send\*\*\n/);
  assert.match(text, /\n\n\*\*Commands\*\*\n- \/cland pair/);
  for (const command of ['status', 'inbox', 'mute', 'unmute', 'decision', 'question', 'help']) assert.ok(text.includes(`\n- /cland ${command}`), command);
  assert.ok(text.endsWith('-# Only the paired Discord user in this channel can act.\n-# Pairing is approved locally. Session, release and configuration controls stay in the workbench.'), text);
  assert.ok(!text.includes(' · '));
  await f.hub.stop();
});

test('Discord mute counts General sources once, unmute reports them and replay cannot remute', async t => {
  const f = await fixture(t);
  const mute = await f.command('mute');
  assert.match(JSON.stringify(mute.callbacks), /General stream muted/);
  assert.equal(f.state.get(`discord.mute:${mute.id}`), '1');
  for (const text of ['First muted source', 'Second muted source'])
    assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'report', text })).ok, true);
  await until(() => f.state.get('mute.missed') === '2', { what: 'two durable muted source receipts', timeoutMs: 1500 });
  assert.equal((await f.fake.control('state')).messages.length, 0);
  const unmute = await f.command('unmute');
  assert.match(JSON.stringify(unmute.callbacks), /2 messages arrived while muted/);
  assert.equal(f.state.get('mute'), 'false'); assert.equal(f.state.get('mute.missed'), '0');
  assert.equal(f.telegramMute(), null, 'mute affects Discord only');
  await f.fake.control('dispatch', { op: 0, t: 'INTERACTION_CREATE', s: 200, d: {
    id: mute.id, token: `synthetic_interaction_${mute.id}`, type: 2, application_id: ids.application,
    guild_id: ids.guild, channel_id: ids.channel, channel: { type: 0 }, member: { user: { id: ids.human } },
    data: { name: 'cland', options: [{ name: 'mute', type: 1 }] },
  } });
  const status = await f.command('status');
  assert.match(JSON.stringify(status.callbacks), /General on/);
  assert.equal(f.state.get('mute'), 'false');
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'report', text: 'Visible after unmute' })).ok, true);
  await until(() => f.state.outbox().some(job => job.state === 'sent'), { what: 'post-unmute native sent mapping', timeoutMs: 1500 });
  assert.deepEqual((await f.fake.control('state')).messages.map(m => m.content), ['coord · report\nVisible after unmute']);
  await f.hub.stop();
});

test('Discord decision and question store one General message with kind, provenance and interaction ingress', async t => {
  const f = await fixture(t);
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  for (const kind of ['decision', 'question']) {
    const row = await f.command(kind, `${kind} from phone`);
    const callback = row.callbacks[0] as { type: number; data: { content: string; flags: number } };
    assert.equal(callback.data.content, 'Sent'); assert.equal(callback.data.flags, 64);
    const sent = f.frames.find(({ ingress }) => ingress?.messageId === row.id)!;
    assert.deepEqual(sent.ingress, { chatId: ids.channel, messageId: row.id });
    assert.equal(sent.frame.type, 'topic.send'); assert.equal(sent.frame.topic, 'general'); assert.equal(sent.frame.kind, kind);
  }
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true);
  const messages = (history.value as { messages: import('../src/protocol.ts').TopicMessage[] }).messages.filter(m => m.via === 'discord');
  assert.deepEqual(messages.map(m => [m.text, m.kind, m.fromKind, m.to]), [
    ['decision from phone', 'decision', 'human', ['coord']], ['question from phone', 'question', 'human', ['coord']],
  ]);
  assert.equal((await f.fake.control('state')).messages.length, 0, 'command input has no channel echo');
  await f.hub.stop();
});

test('Discord slow command defers privately at two seconds and completes by editing original', async t => {
  const f = await fixture(t, 'hub.status');
  const { id } = await f.fake.control('interact', { command: 'status' });
  await until(() => f.frames.some(({ frame }) => frame.type === 'hub.status'), { what: 'held hub status request', timeoutMs: 1500 });
  await f.clock.advance(1999);
  assert.equal((await f.fake.control('state')).interactions.find(row => row.id === id)!.callbacks.length, 0);
  await f.clock.advance(1);
  await until(async () => !!(await f.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length,
    { what: 'native deferred callback before three seconds', timeoutMs: 1500 });
  const deferred = (await f.fake.control('state')).interactions.find(row => row.id === id)!;
  assert.deepEqual(deferred.callbacks, [{ type: 5, data: { flags: 64, allowed_mentions: { parse: [] } } }]);
  await f.clock.advance(1500);
  f.releaseFrames();
  await until(async () => !!(await f.fake.control('state')).interactions.find(row => row.id === id)?.edits.length,
    { what: 'native original completion edit', timeoutMs: 1500 });
  const completed = (await f.fake.control('state')).interactions.find(row => row.id === id)!;
  assert.equal(completed.callbacks.length, 1); assert.equal(completed.edits.length, 1);
  const edit = completed.edits[0] as { content: string; allowed_mentions: object };
  assert.ok(edit.content.startsWith('**Commands fixture — Status**'));
  assert.deepEqual(edit.allowed_mentions, { parse: [] });
  await f.hub.stop();
});

for (const deferred of [false, true]) test(`Discord stop drains a held command ${deferred ? 'after' : 'before'} deferral`, async t => {
  const f = await fixture(t, 'hub.status');
  const { id } = await f.fake.control('interact', { command: 'status' });
  await until(() => f.frames.some(({ frame }) => frame.type === 'hub.status'), { what: 'held command request before stop', timeoutMs: 1500 });
  if (deferred) {
    await f.clock.advance(2000);
    await until(async () => !!(await f.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length,
      { what: 'defer accepted before stop', timeoutMs: 1500 });
  }
  await f.run(() => f.hub.stop());
  assert.equal(f.clock.pending, 0, 'shutdown joins command work and cancels its deadline');
  await f.clock.advance(3000);
  const native = (await f.fake.control('state')).interactions.find(row => row.id === id)!;
  assert.equal(native.callbacks.length, deferred ? 1 : 0); assert.equal(native.edits.length, 0);
});

for (const slow of [false, true]) test(`Discord long status preserves literal facts in bounded private replies ${slow ? 'after defer' : 'immediately'}`, async t => {
  const name = '🧭*[]\\'.repeat(500);
  const f = await fixture(t, slow ? 'hub.status' : undefined, name);
  const { id } = await f.fake.control('interact', { command: 'status' });
  if (slow) {
    await until(() => f.frames.some(({ frame }) => frame.type === 'hub.status'), { what: 'long status held request', timeoutMs: 1500 });
    await f.clock.advance(2000);
    await until(async () => !!(await f.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length,
      { what: 'long status private defer', timeoutMs: 1500 });
    f.releaseFrames();
  }
  const contents = async () => {
    const row = (await f.fake.control('state')).interactions.find(row => row.id === id)! as { callbacks: Array<{ data?: { content?: string } }>; edits: Array<{ content: string }>; followups?: Array<{ content: string }> };
    return [row.callbacks[0]?.data?.content, ...row.edits.map(e => e.content), ...(row.followups ?? []).map(e => e.content)].filter((text): text is string => text !== undefined);
  };
  await until(async () => (await contents()).at(-1)?.includes('-# Remaining session starts: 1000') === true,
    { what: 'last long status private reply carries gateway footer', timeoutMs: 1500 });
  const pages = await contents();
  assert.ok(pages.length > 1); assert.ok(pages.every(page => [...page].length <= 2000));
  const plain = pages.join('').replace(/\*\*/g, '').replace(/\\(.)/gs, '$1').replace(/\n/g, '');
  assert.ok(plain.includes(name), 'all original Unicode and escaped literal title tokens survive');
  const joined = pages.join('\n');
  let previous = -1;
  for (const label of ['Hub', 'Coordinator', 'Sessions (1)', 'Queues', 'Release', 'This channel']) {
    const position = joined.indexOf(`**${label}**`); assert.ok(position > previous, label); previous = position;
  }
  const native = (await f.fake.control('state')).interactions.find(row => row.id === id)! as { callbacks: Array<{ type: number; data: { flags: number } }>; followups?: Array<{ flags: number; allowed_mentions: object }> };
  assert.equal(native.callbacks.length, 1); assert.equal(native.callbacks[0]!.type, slow ? 5 : 4);
  assert.equal(native.callbacks[0]!.data.flags, 64);
  for (const reply of native.followups ?? []) { assert.equal(reply.flags, 64); assert.deepEqual(reply.allowed_mentions, { parse: [] }); }
  await f.hub.stop();
});

test('Discord fake enforces the inclusive 2000-code-point private content budget', async t => {
  const exchange = await discordExchangeOwner(t).start();
  const { id } = await exchange.fake.control('interact', {});
  const token = `synthetic_interaction_${id}`;
  const exact = '🧭'.repeat(2000), over = exact + 'x';
  const invalid = (error: unknown) => (error as { code?: number }).code === 50035;
  await assert.rejects(exchange.api.callback(id, token, over), invalid);
  await exchange.api.callback(id, token, exact);
  await assert.rejects(exchange.api.editOriginal(ids.application, token, over), invalid);
  await exchange.api.editOriginal(ids.application, token, exact);
  await assert.rejects(exchange.api.followup(ids.application, token, over), invalid);
  await exchange.api.followup(ids.application, token, exact);
  const row = (await exchange.fake.control('state')).interactions.find(row => row.id === id)!;
  assert.equal(row.callbacks.length, 1); assert.equal(row.edits.length, 1); assert.equal(row.followups.length, 1);
});
