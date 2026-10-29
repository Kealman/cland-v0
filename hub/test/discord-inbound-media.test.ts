// T2: sealed production frames and fake Discord CDN / Telegram.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, connectUi, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { fakeDiscordFixture, DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { onCleanup } from './process-cleanup.ts';
import type { TopicMessage } from '../src/protocol.ts';

import { pacingOwner } from './telegram-pacing-fixture.ts';
import { realClock } from '../src/hub/clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { discordExchangeOwner } from './fakes/discord/exchange.ts';

function mediaStartup(t: TestContext, exchange: Awaited<ReturnType<ReturnType<typeof discordExchangeOwner>['start']>>) {
  const startup = pacingOwner(t);
  // Register the dynamic acquisition owner before projectHub can start.
  exchange.stop(startup.dispose);
  return startup;
}

test('Discord captioned photo uploads original bytes once and reaches Telegram once', async t => {
  const root = await tempProject(t), fake = await fakeDiscordFixture(t), telegram = await fakeTelegram(t);
  const config = defaultConfig('Discord media'); config.remote.discord.enabled = true; config.remote.telegram.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_TELEGRAM_API_ROOT: telegram.url },
    { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'telegram.token': TELEGRAM_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery);
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  const bytes = Buffer.from('original photo');
  await fake.control('cdn', { id: 'photo', content: bytes.toString('base64') });
  const message = { id: '90071992547421000', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'A photo',
    attachments: [{ id: 'photo', filename: 'photo.png', content_type: 'image/png', size: bytes.length, url: `${fake.url}/cdn/photo` }] };
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: message });
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: message });
  await until(() => state.get('discord.lastMessageId') === message.id, { what: 'durable media receipt', timeoutMs: 2000 });
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(messages.length, 1); assert.equal(messages[0]!.text, 'A photo'); assert.equal(messages[0]!.via, 'discord');
  assert.equal(messages[0]!.artifacts?.length, 1);
  assert.deepEqual(await readFile(messages[0]!.artifacts![0]!.path), bytes);
  await until(async () => {
    const native = await (await fetch(`${telegram.url}/control/state`)).json() as { messages: Array<{ caption?: string }> };
    return native.messages.some(m => m.caption?.includes('you (Discord)'));
  }, { what: 'cross remote photo receipt', timeoutMs: 2000 });
  const native = await (await fetch(`${telegram.url}/control/state`)).json() as { messages: Array<{ caption?: string }> };
  assert.equal(native.messages.filter(m => m.caption?.includes('you (Discord)')).length, 1);
  const cdn = await fake.control('cdn');
  assert.deepEqual(cdn.requests, [{ id: 'photo', authorization: false }]);
  await hub.stop();
});

test('Discord voice keeps original audio and replies with transcript duration timings and provider', async t => {
  const { fakeSpeech } = await import('./fakes/speech/fake-api.ts');
  const root = await tempProject(t), fake = await fakeDiscordFixture(t), speech = await fakeSpeech(t, [{ body: { text: 'heard Discord' } }]);
  onCleanup(t, () => speech.close());
  const config = defaultConfig('Discord voice'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url },
    { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'speech.elevenlabs_key': 'fictional-key' } });
  const ui = await connectUi(t, hub.discovery);
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  const bytes = Buffer.from('original OGG'); await fake.control('cdn', { id: 'voice', content: bytes.toString('base64') });
  const message = { id: '90071992547422000', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: '', flags: 8192,
    attachments: [{ id: 'voice', filename: 'recording.ogg', size: bytes.length, duration_secs: 42, url: `${fake.url}/cdn/voice` }] };
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: message });
  await until(() => state.outbox().some(j => j.source === `discord.media:${ids.channel}:${message.id}` && j.state === 'sent'), { what: 'durable echo sent', timeoutMs: 2000 });
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), ['🎤 heard Discord']);
  assert.deepEqual(await readFile(messages[0]!.artifacts![0]!.path), bytes);
  assert.equal(speech.requests.length, 1); assert.deepEqual(speech.requests[0]!.file, { bytes, mime: 'audio/ogg', filename: 'recording.ogg' });
  const native = await fake.control('state');
  const sent = native.requests.find(r => r.method === 'POST' && r.body.content && String(r.body.content).includes('🎤 heard Discord'))!;
  assert.match(String(sent.body.content), /^🎤 heard Discord\n0:42 · download [0-9.]+ s · transcription [0-9.]+ s · elevenlabs$/);
  assert.deepEqual(sent.body.message_reference, { message_id: message.id, fail_if_not_exists: false });
  assert.deepEqual(sent.body.allowed_mentions, { parse: [] });
  await speech.close(); await hub.stop();
});

for (const answerMode of ['free', 'number', 'label'] as const) test(`Discord refuses long voice before CDN and voice ${answerMode} reply answers its mapped ask without audio`, async t => {
  const { fakeSpeech } = await import('./fakes/speech/fake-api.ts');
  const { inProcessSpoke } = await import('./harness.ts');
  const root = await tempProject(t), fake = await fakeDiscordFixture(t), speech = await fakeSpeech(t, [{ body: { text: answerMode === 'free' ? 'spoken answer' : answerMode === 'number' ? '1.' : 'NORTH!' } }]);
  onCleanup(t, () => speech.close());
  const config = defaultConfig('Discord answers'); config.remote.discord.enabled = true; config.speech.maxSeconds = 30;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url },
    { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'speech.elevenlabs_key': 'fictional-key' } });
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  const message = { id: '90071992547423000', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: '', flags: 8192,
    attachments: [{ id: 'voice', filename: 'voice.ogg', size: 5, duration_secs: 31, content_type: 'audio/ogg', url: `${fake.url}/cdn/voice` }] };
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: message });
  await until(() => state.get('discord.lastMessageId') === message.id, { what: 'duration refusal receipt', timeoutMs: 2000 });
  assert.deepEqual((await fake.control('cdn')).requests, []); assert.equal(speech.requests.length, 0);
  assert.match((await fake.control('state')).messages[0]!.content, /max_seconds/);
  const ask = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Where next?', free: answerMode === 'free', options: ['North', 'South'] });
  assert.equal(ask.ok, true);
  await until(() => state.messagesForAsk(ask.ask).length > 0, { what: 'ask native mapping', timeoutMs: 2000 });
  const card = state.messagesForAsk(ask.ask)[0]!;
  await fake.control('cdn', { id: 'voice', content: Buffer.from('audio').toString('base64') });
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { ...message, id: '90071992547423001', type: 19,
    message_reference: { message_id: card.messageId }, attachments: [{ ...message.attachments[0], duration_secs: 30 }] } });
  await until(() => state.get('discord.lastMessageId') === '90071992547423001', { what: 'voice answer committed', timeoutMs: 2000 });
  const history = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  const answered = history.find(m => m.id === ask.ask)!;
  assert.equal(answered.ask?.outcome?.status, 'answered');
  assert.equal(answered.ask?.outcome?.text, answerMode === 'free' ? 'spoken answer' : 'North');
  const artifacts = (await ui.request({ type: 'artifact.list' })).value as { artifacts: unknown[] };
  assert.deepEqual(artifacts.artifacts, []);
  assert.equal(speech.requests.length, 1);
  await speech.close(); await hub.stop();
});

for (const mode of ['expired', 'redirect', 'foreign', 'oversize'] as const) test(`Discord attachment ${mode} obeys download boundaries`, async t => {
  const root = await tempProject(t), fake = await fakeDiscordFixture(t);
  const config = defaultConfig('Download boundaries'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery);
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  await fake.control('cdn', { id: 'old', content: 'eA==', expired: mode === 'expired', ...(mode === 'redirect' ? { redirect: `${fake.url}/redirect-target` } : {}) });
  await fake.control('cdn', { id: 'fresh', content: 'eA==' });
  const attachment = { id: 'file', filename: 'file.png', size: mode === 'oversize' ? 100 * 1024 * 1024 : 1, content_type: 'image/png', url: `${fake.url}/cdn/fresh` };
  const native = await fake.control('say', { content: '', attachments: [attachment] });
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { ...native,
    attachments: [{ ...attachment, url: mode === 'foreign' ? `${fake.url}/control/state` : `${fake.url}/cdn/old` }] } });
  await until(() => state.get('discord.lastMessageId') === native.id, { what: 'terminal media receipt', timeoutMs: 2000 });
  const history = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  const requests = (await fake.control('cdn')).requests;
  assert.equal((await fake.control('state')).redirectsFollowed, 0);
  assert.ok(requests.every(r => !r.authorization));
  if (mode === 'expired') {
    assert.deepEqual(requests.map(r => r.id), ['old', 'fresh']);
    assert.equal(history.length, 1); assert.deepEqual(await readFile(history[0]!.artifacts![0]!.path), Buffer.from('x'));
  } else {
    assert.equal(history.length, 0); assert.equal(requests.length, mode === 'redirect' ? 1 : 0);
  }
  await hub.stop();
});

for (const held of ['cdn', 'speech'] as const) test(`Discord stop during held ${held} leaves input unconfirmed for resume`, async t => {
  const { fakeSpeech } = await import('./fakes/speech/fake-api.ts');
  const { discordExchangeOwner } = await import('./fakes/discord/exchange.ts');
  const owner = discordExchangeOwner(t); const { root } = await owner.project();
  const exchange = await owner.start(), fake = exchange.fake;
  const startup = mediaStartup(t, exchange);
  const speech = await fakeSpeech(t, [{ body: { text: 'before stop' }, delayMs: 60000 }, { body: { text: 'after resume' } }]);
  exchange.stop(() => speech.close());
  const config = defaultConfig('Cancelled media'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  const start = () => startup.start(root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url }, realClock,
    { hubOptions: { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'speech.elevenlabs_key': 'fictional-key' } } });
  const first = await start(), ui = await connectUi(t, first.discovery);
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  await fake.control('cdn', { id: held, content: Buffer.from('original').toString('base64'), hold: held === 'cdn' });
  const hold = exchange.run(async signal => {
    if (held === 'cdn') await fake.waitForHold(signal);
    else {
      await until(() => signal.aborted || speech.requests.length === 1, { what: 'speech native request', timeoutMs: 2000 });
      signal.throwIfAborted();
    }
  });
  void hold.catch(() => {});
  const message = { id: '90071992547424000', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: held === 'cdn' ? 'photo caption' : '',
    ...(held === 'speech' ? { flags: 8192 } : {}), attachments: [{ id: held, filename: `${held}.ogg`, content_type: held === 'speech' ? 'audio/ogg' : 'application/octet-stream', duration_secs: 2, size: 8, url: `${fake.url}/cdn/${held}` }] };
  await exchange.run(() => fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: message })); await hold;
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  const closed = exchange.run(() => until(async () => held === 'cdn' ? (await fake.control('cdn')).closed.includes(held) : speech.closedRequests.includes(1), { what: 'held native response closed', timeoutMs: 2000 }));
  void closed.catch(() => {}); await exchange.run(() => first.stop()); await closed;
  assert.equal(state.get('discord.lastMessageId'), null);
  assert.equal(state.get(`discord.inbound:${message.id}`), null);
  assert.equal(JSON.parse(state.get('discord.session')!).sequence, 1, 'only READY confirmed before stop');
  await fake.control('cdn', { id: held, content: Buffer.from('original').toString('base64') });
  const second = await start(), resumed = await connectUi(t, second.discovery);
  await until(() => state.get('discord.lastMessageId') === message.id, { what: 'resumed upload committed', timeoutMs: 2000 });
  const history = ((await resumed.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(history.length, 1); assert.deepEqual(await readFile(history[0]!.artifacts![0]!.path), Buffer.from('original'));
  if (held === 'cdn') {
    assert.match(history[0]!.text, /^photo caption\n\n\(written on Discord at/);
    assert.equal(history[0]!.text.match(/written on Discord at/g)?.length, 1);
    assert.equal(state.message(ids.channel, message.id)?.message, history[0]!.id);
  }
  if (held === 'speech') assert.match(history[0]!.text, /^🎤 after resume\n\n\(written on Discord at/);
  assert.equal((await fake.control('state')).gateway.resumes, 1);
  await exchange.run(() => second.stop()); await exchange.close();
});

test('Discord offline history pages attachment-only photo and voice with expired URL once', async t => {
  const { FakeClock } = await import('./fake-clock.ts');
  const { fakeSpeech } = await import('./fakes/speech/fake-api.ts');
  const clock = new FakeClock(), root = await tempProject(t), fake = await fakeDiscordFixture(t, { clock });
  const speech = await fakeSpeech(t, [{ body: { text: 'offline voice' } }]); onCleanup(t, () => speech.close());
  const config = defaultConfig('History media'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  const start = () => projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url },
    { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'speech.elevenlabs_key': 'fictional-key' } });
  await fake.control('configure', { interval: 1000000, sendLimit: 10000, sendWindow: 0, reactionWindow: 0 });
  const first = await start(); await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  const seed = await fake.control('say', { content: 'seed' }); await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: seed });
  await until(() => state.get('discord.lastMessageId') === seed.id, { what: 'seed cursor', timeoutMs: 2000 });
  await first.stop(); state.set('discord.session', null); // Model fresh Identify after the resumable session expired.
  await fake.control('cdn', { id: 'old-photo', content: 'eA==', expired: true, refresh: 'fresh-photo' });
  await fake.control('cdn', { id: 'fresh-photo', content: 'eA==' }); await fake.control('cdn', { id: 'history-voice', content: 'eQ==' });
  const photo = await fake.control('say', { content: '', attachments: [{ id: 'photo', filename: 'photo.png', content_type: 'image/png', size: 1, url: `${fake.url}/cdn/old-photo` }] });
  await fake.control('say', { user: 'member', contents: Array.from({ length: 101 }, () => 'ignored') });
  const voice = await fake.control('say', { content: '', flags: 8192, attachments: [{ id: 'voice', filename: 'voice.ogg', content_type: 'audio/ogg', duration_secs: 2, size: 1, url: `${fake.url}/cdn/history-voice` }] });
  await clock.advance(180000);
  const second = await start(), ui = await connectUi(t, second.discovery);
  await until(async () => { await clock.advance(250); return state.get('discord.lastMessageId') === voice.id && state.get('discord.history') === null; }, { what: 'paged media history committed', timeoutMs: 2000 });
  const history = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  const media = history.filter(m => m.artifacts?.length);
  assert.equal(media.length, 2); assert.match(media[0]!.text, /written on Discord at .*hub was down until/);
  assert.match(media[1]!.text, /^🎤 offline voice\n\n\(written on Discord at/);
  assert.deepEqual(await readFile(media[0]!.artifacts![0]!.path), Buffer.from('x'));
  assert.deepEqual(await readFile(media[1]!.artifacts![0]!.path), Buffer.from('y'));
  assert.equal(speech.requests.length, 1);
  const native = await fake.control('state');
  assert.ok(native.requests.filter(r => r.method === 'GET' && r.path.includes('/messages?')).length >= 2);
  assert.deepEqual((await fake.control('cdn')).requests.map(r => r.id), ['old-photo', 'fresh-photo', 'history-voice']);
  assert.equal(state.message(ids.channel, photo.id)?.message, media[0]!.id);
  assert.equal(state.message(ids.channel, voice.id)?.message, media[1]!.id);
  await speech.close(); await second.stop();
});


for (const mode of ['omitted', 'aborted'] as const) test(`Discord media ${mode} startup receipt joins acquired hub before Store and root removal`, async t => {
  const gate = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
  onCleanup(t, () => gate.resolve());
  const { discordExchangeOwner } = await import('./fakes/discord/exchange.ts');
  const owner = discordExchangeOwner(t), project = await owner.project(), exchange = await owner.start();
  const startup = mediaStartup(t, exchange), abort = new AbortController();
  const config = defaultConfig('Media startup'); config.remote.discord.enabled = true;
  await mkdir(join(project.root, '.cland'), { recursive: true }); await writeFile(join(project.root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(project.root, '.cland/hub.db')); let drained = false;
  exchange.afterDrain(() => { drained = true; store.close(); });
  const state = store.remotes.forMessenger('discord'); state.set('startup-control', 'retained');
  startup.close(() => { entered.resolve(); return gate.promise; });
  const acquired = within(startup.serving, 2000); void acquired.catch(() => {});
  const observed = startup.start(project.root, { CLAND_DISCORD_API_ROOT: exchange.fake.url }, realClock,
    { receipt: new Promise<void>(() => {}), signal: abort.signal,
      hubOptions: { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } } });
  void observed.catch(() => {});
  const hub = await acquired;
  if (mode === 'aborted') abort.abort();
  await within(entered.promise, 2000);
  const disposal = exchange.close(); void disposal.catch(() => {});
  assert.equal(state.get('startup-control'), 'retained'); assert.equal(drained, false); await access(project.root);
  gate.resolve();
  await assert.rejects(observed, mode === 'aborted' ? /abort/i : /receipt deadline/);
  await disposal; await within(hub.stopped, 2000);
  assert.equal(startup.observations(), 0); assert.equal(exchange.pending(), 0); assert.equal(drained, true);
  const receipts = owner.receipts(); assert.equal(receipts.closed, true); assert.equal(receipts.handlers, 0); assert.equal(receipts.observers, 0);
  await project.remove(); await assert.rejects(access(project.root), { code: 'ENOENT' });
});
