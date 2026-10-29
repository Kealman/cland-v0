// T2: native factory, sealed frames and loopback Discord gateway/REST.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discordAdmissionObserver } from './fakes/discord/admission.ts';
import { discordHubFixtureOwner } from './fakes/discord/hub.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, connectUi, cland, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { fakeDiscordFixture, DISCORD_TEST_TOKEN, DISCORD_IDS } from './fakes/discord/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import type { RemoteStatusRow } from '../src/protocol.ts';
async function receipt<T>(read: () => Promise<T>, matches: (value: T) => boolean, what = 'exact Discord receipt'): Promise<T> {
  let value: T | undefined;
  await until(async () => { value = await read(); return matches(value); }, { what, timeoutMs: 2000 });
  return value!;
}
test('Discord production factory identifies and reports acknowledged connection and invite', async t => {
  const root = await tempProject(t);
  const fake = await fakeDiscordFixture(t);
  const clock = new FakeClock();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Discord fixture'); config.remote.discord.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { clock, log: entry => { logs.push(entry); }, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const status = async () => {
    const reply = await ui.request({ type: 'remote.status' }); assert.equal(reply.ok, true, reply.error);
    return (reply.value as { remotes: RemoteStatusRow[] }).remotes.find(r => r.messenger === 'discord')!;
  };
  // Startup must construct a native Discord client rather than the old disabled placeholder.
  assert.notEqual((await status()).connection, 'disabled');
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  await clock.advance(1000);
  const row = await receipt(status, r => r.connection === 'connected');
  assert.equal(row.botLink, `https://discord.com/oauth2/authorize?client_id=${DISCORD_IDS.application}&scope=bot&permissions=117824`);
  assert.ok(row.lastInbound); assert.ok(row.lastOutbound);
  const state = await fake.control('state');
  assert.equal(state.gateway.validIdentify, true);
  const cli = await cland(root, 'remote', 'status');
  assert.equal(cli.code, 0, cli.stderr); assert.ok(cli.stdout.includes(row.botLink!)); assert.match(cli.stdout, /connection: connected/);
  await fake.control('dispatch', { op: 0, t: DISCORD_TEST_TOKEN, s: 2, d: { content: DISCORD_TEST_TOKEN, id: DISCORD_IDS.channel } });
  await receipt(async () => logs, entries => entries.some(entry => entry.event === 'discord-dispatch' && entry.type === 'UNKNOWN'));
  assert.equal(JSON.stringify([ui.frames, logs, cli]).includes(DISCORD_TEST_TOKEN), false);
  assert.equal(JSON.stringify([ui.frames, row, state]).includes(DISCORD_TEST_TOKEN), false);
  await hub.stop();
  for (const file of ['log/hub.log', 'journal.jsonl']) assert.equal((await readFile(join(root, '.cland', file), 'utf8')).includes(DISCORD_TEST_TOKEN), false);
});

test('Discord heartbeats use jitter then interval and op 1; stale acknowledgements disconnect status', async t => {
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t); const clock = new FakeClock();
  const config = defaultConfig('Heartbeat fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const { DiscordRemote } = await import('../src/remote/discord.ts');
  const { DiscordApi } = await import('../src/remote/discord-api.ts');
  const hub = await projectHub(t, root, {}, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN },
    gatewayMessenger: () => new DiscordRemote(new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url }), DISCORD_TEST_TOKEN, clock, { fake: true, random: () => 0.25 }) });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const status = async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!;
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  assert.equal((await status()).connection, 'disconnected');
  await clock.advance(249); assert.equal((await fake.control('state')).gateway.heartbeats, 0);
  await clock.advance(1); await receipt(() => fake.control('state'), s => s.gateway.heartbeats === 1);
  await receipt(status, r => r.connection === 'connected');
  await clock.advance(999); assert.equal((await fake.control('state')).gateway.heartbeats, 1);
  await clock.advance(1); await receipt(() => fake.control('state'), s => s.gateway.heartbeats === 2);
  // At 1250 only opcode 11 can supply this timestamp; wait for the actual ACK.
  await receipt(status, r => r.lastInbound === clock.now().toISOString());
  await fake.control('configure', { acknowledge: false });
  await clock.advance(1001);
  assert.equal((await status()).connection, 'disconnected');
  await receipt(() => fake.control('state'), s => s.gateway.heartbeats === 3);
  await fake.control('dispatch', { op: 1, d: null });
  await receipt(() => fake.control('state'), s => s.gateway.heartbeats === 4);
  assert.equal((await status()).connection, 'disconnected', 'an opcode 1 is not an ACK');
  await fake.control('dispatch', { op: 11, d: null });
  await receipt(status, r => r.connection === 'connected');
  await hub.stop(); assert.equal(clock.pending, 0);
});

for (const gatewayUrl of ['wss://discord.gg.attacker.invalid', 'ws://192.0.2.1:8080', 'message-content', 'interactions-endpoint']) test(`Discord refuses gateway ${gatewayUrl} while Telegram keeps mirroring`, async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } = await import('./fakes/telegram/fake-api.ts');
  const { inProcessSpoke } = await import('./harness.ts');
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t); const telegram = await fakeTelegram(t);
  const clock = new FakeClock();
  await fake.control('configure', gatewayUrl === 'message-content' ? { application: { flags: 0 } } : gatewayUrl === 'interactions-endpoint' ? { application: { interactions_endpoint_url: 'https://example.invalid/interaction' } } : { gatewayUrl });
  const config = defaultConfig('Isolation fixture'); config.remote.discord.enabled = true; config.remote.telegram.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' }); } finally { store.close(); }
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_TELEGRAM_API_ROOT: telegram.url },
    { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'telegram.token': TELEGRAM_TEST_TOKEN }, log: entry => { logs.push(entry); } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const row = await receipt(async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!, r => r.connection === 'disabled');
  assert.match(row.reason!, gatewayUrl === 'message-content' ? /Message Content/ : gatewayUrl === 'interactions-endpoint' ? /clear the Interactions Endpoint URL/ : /gateway URL refused/);
  if (gatewayUrl === 'message-content') assert.equal(row.stopCause, 'message-content');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  const notices = (history.value as { messages: Array<{ text: string }> }).messages.filter(m => m.text.includes('Discord remote:'));
  assert.equal(notices.length, 1); assert.match(notices[0]!.text, gatewayUrl === 'message-content' ? /Message Content/ : gatewayUrl === 'interactions-endpoint' ? /clear the Interactions Endpoint URL/ : /gateway URL refused/);
  // Application checks run before the gateway opens; the durable General notice
  // above is the receipt. Prove ongoing Telegram delivery with a new report.
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Still mirroring' })).ok, true);
  await clock.advance(1000);
  await receipt(async () => (await telegramControl<{ messages: Array<{ text: string }> }>(telegram.url, 'state')).body.messages, messages => messages.some(m => m.text.includes('Still mirroring')));
  assert.equal((await fake.control('state')).gateway.identifies, 0);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  assert.equal(JSON.stringify([ui.frames, logs, row, notices]).includes(DISCORD_TEST_TOKEN), false);
  await hub.stop();
});

for (const [status, code] of [[401, 0], [400, 40001], [400, 50014]]) test(`Discord credential-echo REST refusal ${status}/${code} stays out of CLI frames logs errors and journal`, async t => {
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  await fake.control('fault', { status, code, echoToken: true });
  const config = defaultConfig('Credential refusal'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, {
    syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN }, log: entry => { logs.push(entry); } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const reply = await ui.request({ type: 'remote.status' });
  const row = (reply.value as { remotes: RemoteStatusRow[] }).remotes[1]!;
  assert.equal(row.connection, 'disabled'); assert.equal(row.stopCause, 'token'); assert.match(row.reason!, /wrong or revoked token/);
  assert.ok(logs.some(entry => entry.event === 'remote-disabled' && entry.remote === 'discord'));
  const cli = await cland(root, 'remote', 'status'); assert.equal(cli.code, 0, cli.stderr);
  assert.match(cli.stdout, /wrong or revoked token/);
  assert.equal((await fake.control('state')).requests[0]!.path, '/oauth2/applications/@me');
  await hub.stop();
  const sinks = await Promise.all(['log/hub.log', 'journal.jsonl'].map(file => readFile(join(root, '.cland', file), 'utf8')));
  assert.equal(JSON.stringify([ui.frames, logs, cli, row, sinks]).includes(DISCORD_TEST_TOKEN), false);
});

for (const hasDiscordNotice of [true, false]) test(`messenger factory retains Telegram notice callback with Discord callback ${hasDiscordNotice ? 'present' : 'absent'}`, async t => {
  const { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } = await import('./fakes/telegram/fake-api.ts');
  const { Store } = await import('../src/hub/store.ts');
  const { messengerFactory } = await import('../src/remote/messenger.ts');
  const { remoteRedactor } = await import('../src/remote/redact.ts');
  const { onCleanup } = await import('./process-cleanup.ts');
  const root = await tempProject(t); const discord = await fakeDiscordFixture(t); const telegram = await fakeTelegram(t);
  await discord.control('configure', { gatewayUrl: 'ws://192.0.2.1:8080' });
  assert.equal((await telegramControl(telegram.url, 'fault', { method: 'getMe', code: 401 })).status, 200);
  const config = defaultConfig('Distinct notices'); config.remote.telegram.enabled = true; config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, async () => { await hub?.stop(); store.close(); });
  const telegramNotices: string[] = [], discordNotices: string[] = [];
  const clock = new FakeClock();
  const env = { CLAND_TELEGRAM_API_ROOT: telegram.url, CLAND_DISCORD_API_ROOT: discord.url };
  const factory = messengerFactory(env, remoteRedactor(), clock, { state: store.remotes,
    notice: cause => { telegramNotices.push(cause); },
    ...(hasDiscordNotice ? { discordNotice: (cause: string) => { discordNotices.push(cause); } } : {}),
  });
  hub = await projectHub(t, root, env, { clock, gatewayMessenger: factory,
    syntheticRemoteSecrets: { 'telegram.token': TELEGRAM_TEST_TOKEN, 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await receipt(async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes,
    rows => rows.every(row => row.connection === 'disabled'));
  assert.equal(telegramNotices.length, 1); assert.match(telegramNotices[0]!, /401/);
  assert.equal(discordNotices.length, hasDiscordNotice ? 1 : 0);
  if (hasDiscordNotice) assert.match(discordNotices[0]!, /gateway URL refused/);
  await hub.stop();
});

test('Discord production gateway allowlist refuses foreign hosts before external I/O', async () => {
  const { discordGatewayUrl } = await import('../src/remote/discord-socket.ts');
  for (const url of ['wss://discord.gg.attacker.invalid', 'wss://notdiscord.gg', 'ws://127.0.0.1:8080',
    'wss://user:password@gateway.discord.gg', 'wss://gateway.discord.gg?token=fictional']) {
    assert.throws(() => discordGatewayUrl(url, false), /gateway URL refused/);
  }
  assert.equal(discordGatewayUrl('wss://gateway.discord.gg', false), 'wss://gateway.discord.gg/?v=10&encoding=json');
  assert.equal(discordGatewayUrl('ws://127.0.0.1:8080', true), 'ws://127.0.0.1:8080/?v=10&encoding=json');
  // Validation only: this control never constructs a socket or uses a platform token.
});

for (const [code, cause] of [[4004, 'token'], [4010, 'gateway-refused'], [4011, 'gateway-refused'], [4012, 'gateway-refused'], [4013, 'gateway-refused'], [4014, 'message-content'], [4003, 'gateway-refused']] as const) test(`Discord fatal close ${code} persists ${cause} without reconnect`, async t => {
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t); const clock = new FakeClock();
  const { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } = await import('./fakes/telegram/fake-api.ts');
  const { Store } = await import('../src/hub/store.ts');
  const { inProcessSpoke } = await import('./harness.ts');
  const telegram = await fakeTelegram(t);
  const config = defaultConfig('Fatal close'); config.remote.discord.enabled = true; config.remote.telegram.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' }); } finally { store.close(); }
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_TELEGRAM_API_ROOT: telegram.url }, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'telegram.token': TELEGRAM_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const status = async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!;
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  await fake.control('close', { code });
  if (code === 4003) {
    await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
    await clock.advance(5000);
    await receipt(() => fake.control('state'), s => s.gateway.identifies === 2);
    await fake.control('close', { code });
  }
  const row = await receipt(status, r => r.connection === 'disabled');
  assert.equal(row.stopCause, cause); assert.match(row.reason!, new RegExp(String(code)));
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  const notices = (history.value as { messages: Array<{ text: string }> }).messages.filter(m => m.text.includes('Discord remote:'));
  assert.equal(notices.length, 1); assert.match(notices[0]!.text, /cland hub reload/);
  assert.match(notices[0]!.text, new RegExp(String(code)));
  const cli = await cland(root, 'remote', 'status'); assert.equal(cli.code, 0, cli.stderr); assert.match(cli.stdout, new RegExp(String(code)));
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Telegram survives fatal close' })).ok, true);
  await clock.advance(1000);
  await receipt(async () => (await telegramControl<{ messages: Array<{ text: string }> }>(telegram.url, 'state')).body.messages, messages => messages.some(m => m.text.includes('Telegram survives fatal close')));
  await clock.advance(60_000);
  assert.equal((await fake.control('state')).gateway.identifies, code === 4003 ? 2 : 1);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await hub.stop(); assert.equal(clock.pending, 0);
});

test('Discord remote test checks application and sends one paired line; REST 401 stops it', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  const config = defaultConfig('Remote test'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('discord').setPairing({ userId: DISCORD_IDS.human, chatId: DISCORD_IDS.channel, guildId: DISCORD_IDS.guild, name: 'Fixture human' }); } finally { store.close(); }
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  const before = (await fake.control('state')).requests.filter(r => r.path === '/oauth2/applications/@me').length;
  const cli = await cland(root, 'remote', 'test', 'discord'); assert.equal(cli.code, 0, cli.stderr); assert.match(cli.stdout, /test line sent/);
  const state = await fake.control('state');
  assert.equal(state.requests.filter(r => r.path === '/oauth2/applications/@me').length, before + 1);
  assert.equal(state.messages.length, 1); assert.equal(state.messages[0]!.content, 'cland remote test');
  await fake.control('fault', { status: 401, echoToken: true });
  const refused = await cland(root, 'remote', 'test', 'discord'); assert.notEqual(refused.code, 0);
  const row = await receipt(async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!, r => r.connection === 'disabled');
  assert.equal(row.stopCause, 'token');
  await receipt(() => fake.control('state'), s => s.gateway.closes.includes(1000));
  assert.equal(JSON.stringify([ui.frames, cli, refused, row]).includes(DISCORD_TEST_TOKEN), false);
  await hub.stop();
});

test('Discord replacement notification auth failure retains token cause and joins held terminal close', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  const config = defaultConfig('Replacement stop'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('discord').setPairing({ userId: DISCORD_IDS.human, chatId: DISCORD_IDS.channel, guildId: DISCORD_IDS.guild, name: 'Fixture human' }); } finally { store.close(); }
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { log: entry => { logs.push(entry); }, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  const interaction = await fake.control('interact', { channel_id: DISCORD_IDS.secondChannel });
  const issued = await receipt(() => fake.control('state'), s => !!s.interactions.find(r => r.id === interaction.id)?.callbacks.length);
  const text = (issued.interactions.find(r => r.id === interaction.id)!.callbacks[0] as { data: { content: string } }).data.content;
  const code = /code ([A-Z2-9]{8})/.exec(text)![1]!;
  await fake.control('configure', { holdClose: true });
  await fake.control('fault', { status: 401, echoToken: true });
  try {
    const approval = await cland(root, 'remote', 'approve', 'discord', code); assert.equal(approval.code, 0, approval.stderr);
    await receipt(() => fake.control('state'), s => s.requests.some(r => r.path === `/channels/${DISCORD_IDS.channel}/messages`));
    const cli = await cland(root, 'remote', 'status'); assert.equal(cli.code, 0, cli.stderr);
    assert.match(cli.stdout, /wrong or revoked token/); assert.match(cli.stdout, /cland secret set discord.token/);
  } finally { await fake.control('configure', { holdClose: false }); }
  await receipt(async () => logs, entries => entries.some(e => e.event === 'remote-disabled' && e.remote === 'discord'));
  const row = ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!;
  assert.equal(row.stopCause, 'token'); assert.match(row.reason!, /cland secret set discord.token/);
  await receipt(() => fake.control('state'), s => s.gateway.closes.includes(1000));
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal((history.value as { messages: Array<{ text: string }> }).messages.filter(m => m.text.includes('Discord remote:')).length, 1);
  await hub.stop();
  const persisted = new Store(join(root, '.cland/hub.db'));
  try { assert.equal(persisted.remotes.forMessenger('discord').status().stopCause, 'token'); } finally { persisted.close(); }
});

async function resumeFixture(t: import('node:test').TestContext, log?: (entry: Record<string, unknown>) => void) {
  const fixture = await discordHubFixtureOwner(t, { injected: true, ...(log ? { log } : {}) }).start();
  await fixture.clock.advance(250); await receipt(fixture.status, r => r.connection === 'connected');
  return fixture;
}

test('Discord zombie terminates resumably and buffered input reaches General once', async t => {
  const { close, fake, clock, status, history } = await resumeFixture(t);
  await fake.control('configure', { acknowledge: false });
  await clock.advance(1000); await receipt(() => fake.control('state'), s => s.gateway.heartbeats === 2);
  await clock.advance(1000);
  await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
  assert.equal((await status()).connection, 'disconnected');
  assert.equal((await fake.control('state')).gateway.closes[0], 1006);
  const message = { op: 0, t: 'MESSAGE_CREATE', d: { id: '99000000000000001', channel_id: DISCORD_IDS.channel, author: { id: DISCORD_IDS.human }, type: 0, content: 'During the zombie', timestamp: clock.now().toISOString() } };
  await fake.control('dispatch', message);
  await fake.control('configure', { acknowledge: true });
  await clock.advance(1000); await receipt(() => fake.control('state'), s => s.gateway.resumes === 1);
  const late = 'During the zombie\n\n(written on Discord at 12:00; the hub was down until 12:00)';
  await receipt(history, rows => rows.some(m => m.text === late));
  await fake.control('dispatch', message);
  await fake.control('dispatch', { ...message, d: { ...message.d, id: '99000000000000002', content: 'Replay drained' } });
  const rows = await receipt(history, rows => rows.some(m => m.text === 'Replay drained'));
  assert.equal(rows.filter(m => m.text === late).length, 1);
  assert.equal((await fake.control('state')).gateway.identifies, 1);
  assert.equal((await fake.control('state')).gateway.validResume, true);
  await close(); assert.equal(clock.pending, 0);
});

test('Discord ten drops, reconnect and resumable invalid session spend no extra Identify', async t => {
  const { close, fake, clock, status } = await resumeFixture(t);
  const resumableCodes = [4000, 4001, 4002, 4005, 4008];
  for (let index = 0; index < 12 + resumableCodes.length; index++) {
    if (index < 10) await fake.control('drop', {});
    else if (index < 12) await fake.control('dispatch', { op: index === 10 ? 7 : 9, d: true });
    else await fake.control('close', { code: resumableCodes[index - 12] });
    await receipt(() => fake.control('state'), s => s.gateway.closes.length === index + 1);
    assert.equal((await status()).connection, 'disconnected');
    await clock.advance(1);
    await receipt(() => fake.control('state'), s => s.gateway.resumes === index + 1);
    await clock.advance(250); await receipt(status, r => r.connection === 'connected');
  }
  const state = await fake.control('state'); assert.equal(state.gateway.identifies, 1); assert.equal(state.gateway.validResume, true);
  await close(); assert.equal(clock.pending, 0);
});

test('Discord nonresumable invalid session waits random one to five seconds for fresh Identify', async t => {
  const admission = discordAdmissionObserver(t);
  const { close, fake, clock, status } = await resumeFixture(t, admission.log);
  const scheduled = admission.observe(2);
  await fake.control('dispatch', { op: 9, d: false });
  await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
  assert.equal((await status()).connection, 'disconnected');
  await clock.advance(1999); assert.equal((await fake.control('state')).gateway.identifies, 1);
  await clock.advance(1); assert.equal((await fake.control('state')).gateway.identifies, 1);
  assert.equal((await scheduled).delay, 2750);
  await clock.advance(2749); assert.equal((await fake.control('state')).gateway.identifies, 1);
  await clock.advance(1); await receipt(() => fake.control('state'), s => s.gateway.identifies === 2);
  assert.equal((await fake.control('state')).gateway.resumes, 0);
  await clock.advance(250); await receipt(status, r => r.connection === 'connected');
  await close(); assert.equal(clock.pending, 0);
});

test('Discord three minutes offline posts one General notice then one recovery', async t => {
  const fixture = await discordHubFixtureOwner(t).start();
  const { clock, fake, status, history } = fixture;
  const notices = async () => (await history()).filter(m => /^Discord remote (offline since|recovered;)/.test(m.text));
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  await clock.advance(1000); await receipt(status, r => r.connection === 'connected');
  await fake.control('configure', { acknowledge: false, resumeWindow: 600000 });
  await fake.control('drop', {});
  await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
  assert.equal((await status()).connection, 'disconnected');
  await clock.advance(179999); assert.equal((await notices()).length, 0);
  await clock.advance(1); await receipt(notices, rows => rows.length === 1);
  assert.match((await notices())[0]!.text, /^Discord remote offline since 12:00: /);
  await clock.advance(10000); assert.equal((await notices()).length, 1);
  await fake.control('configure', { acknowledge: true });
  // A real inbound ACK supplies the successful exchange, rather than just a resumed socket.
  await receipt(() => fake.control('state'), s => s.gateway.resumes > 0);
  await fake.control('dispatch', { op: 11, d: null });
  await receipt(status, r => r.connection === 'connected');
  const rows = await receipt(notices, rows => rows.length === 2);
  assert.match(rows[1]!.text, /^Discord remote recovered; offline since 12:00/);
  await fixture.close(); assert.equal(clock.pending, 0);
});

test('Discord settled REST send outage survives socket ACKs until paired send recovers', async t => {
  const { inProcessSpoke } = await import('./harness.ts');
  const fixture = await discordHubFixtureOwner(t, { interval: 1000000 }).start();
  const { root, clock, fake, ui, state, status, history, run, logs } = fixture;
  const notices = async () => (await history()).filter(m => /^Discord remote (offline since|recovered;)/.test(m.text));
  await fake.control('dispatch', { op: 11, d: null }); await receipt(status, r => r.connection === 'connected', 'REST health connected');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  for (let i = 0; i < 4; i++) await fake.control('fault', { status: 500, echoToken: true });
  const sends = async () => (await fake.control('state')).requests.filter(r => r.method === 'POST' && r.path === `/channels/${DISCORD_IDS.channel}/messages`);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Failed health send' })).ok, true);
  const refusals = async () => logs.filter(e => e.event === 'discord-rest-refused' && e.route === 'POST /channels/:channel/messages' && e.status === 500);
  await receipt(sends, rows => rows.length === 1);
  await receipt(refusals, rows => rows.length === 1, 'client refusal 1');
  assert.equal((await status()).connection, 'connected', 'a retrying exchange has not settled as failed');
  for (const [delay, count] of [[1000, 2], [2000, 3], [4000, 4]]) {
    await clock.advance(delay!); await receipt(sends, rows => rows.length === count);
    await receipt(refusals, rows => rows.length === count, `client refusal ${count}`);
  }
  await receipt(async () => state.outbox(), rows => rows.some(j => j.state === 'missed'));
  assert.equal((await status()).connection, 'disconnected');
  await fake.control('dispatch', { op: 11, d: null });
  await clock.advance(179999); assert.equal((await notices()).length, 0);
  await fake.control('fault', { response: 'hold' });
  const held = run(signal => fake.waitForHold(signal));
  await clock.advance(1); await held; await receipt(notices, rows => rows.length === 1, 'REST offline notice');
  assert.match((await notices())[0]!.text, /REST sends unavailable/);
  assert.equal((await status()).connection, 'disconnected', 'socket ACK cannot erase failed REST sends');
  await fake.control('release', {});
  await receipt(async () => state.outbox(), rows => rows.some(j => j.state === 'sent'), 'REST recovered sent settlement');
  await receipt(status, r => r.connection === 'connected', 'REST health connected');
  const rows = await receipt(notices, rows => rows.length === 2, 'REST recovered notice');
  assert.match(rows[1]!.text, /Discord remote recovered;/);
  assert.equal(JSON.stringify([ui.frames, rows, logs]).includes(DISCORD_TEST_TOKEN), false);
  await fixture.close(); assert.equal(clock.pending, 0);
});

test('Discord missing edit on an acknowledged live remote leaves connection healthy', async t => {
  const fixture = await discordHubFixtureOwner(t, { injected: true, interval: 1000000 }).start();
  const { api, fake, clock, status, notices, history } = fixture;
  await fake.control('dispatch', { op: 11, d: null });
  await receipt(status, r => r.connection === 'connected');
  await assert.rejects(api.editMessage(DISCORD_IDS.channel, '99999999999999999', { content: 'deleted message' }));
  assert.equal((await status()).connection, 'connected');
  await clock.advance(180001);
  assert.equal((await status()).connection, 'connected');
  assert.deepEqual(notices, []);
  await api.createMessage(DISCORD_IDS.channel, { content: 'ordinary send after missing edit', nonce: 'missing-edit-control' });
  assert.equal((await status()).connection, 'connected');
  assert.deepEqual(notices, [], 'neither an outage nor a recovery follows a job-local missing edit');
  assert.equal((await history()).filter(m => /^Discord remote (offline since|recovered;)/.test(m.text)).length, 0);
  await fixture.close(); assert.equal(clock.pending, 0);
});

test('Discord hub fixture cold tempProject has a separate setup budget and timing receipt', async t => {
  const acquisitionClock = new FakeClock();
  const acquired = Promise.withResolvers<string>();
  const release = Promise.withResolvers<void>();
  const owner = discordHubFixtureOwner(t, { acquisitionClock, acquireProject: async signal => {
    const root = await tempProject(t);
    acquired.resolve(root); // Actual allocation receipt, before the held return.
    await abortable(release.promise, signal);
    return root;
  } });
  // Setup covers native fake startup plus the independent 15 s cold phase.
  const setupReceipt = within(acquired.promise, 20000);
  const starting = owner.start(); void starting.catch(() => {});
  try {
    await setupReceipt;
    await acquisitionClock.advance(2050);
    release.resolve();
    const fixture = await starting;
    const timing = owner.acquisitionReceipts[0]!;
    assert.deepEqual(timing, { phase: 'tempProject acquisition', elapsedMs: 2050, outcome: 'complete' });
    assert.equal((await fixture.ui.request({ type: 'hub.status' })).ok, true);
  } finally {
    release.resolve();
    await owner.close();
  }
  assert.equal(owner.pending(), 0);
  assert.equal(owner.dbClosed(), true);
  assert.equal(acquisitionClock.pending, 0);
});

test('Discord hub fixture failed tempProject names phase and elapsed time', async t => {
  const owner = discordHubFixtureOwner(t, { acquireProject: async () => { throw new Error('synthetic acquisition failure'); } });
  await assert.rejects(owner.start(), /tempProject acquisition incomplete after [0-9.]+ ms/);
  assert.equal(owner.acquisitionReceipts.length, 1);
  assert.equal(owner.acquisitionReceipts[0]!.outcome, 'incomplete');
  assert.ok(owner.acquisitionReceipts[0]!.elapsedMs >= 0);
  await owner.close();
  assert.equal(owner.pending(), 0);
  assert.equal(owner.receipts().closed, true);
});

for (const mode of ['omitted', 'aborted'] as const) test(`Discord hub fixture ${mode} setup receipt disposes the acquisition owner`, async t => {
  const setupClock = new FakeClock(); const abort = new AbortController();
  const owner = discordHubFixtureOwner(t, { fake: { publishListening: false, setupClock, signal: abort.signal } });
  const listening = owner.listening(); void listening.catch(() => {});
  const starting = owner.start();
  const failed = assert.rejects(starting, mode === 'omitted' ? /listening receipt deadline/ : /aborted/); void failed.catch(() => {});
  await listening;
  if (mode === 'aborted') abort.abort(); else await setupClock.advance(1000);
  await failed; await owner.close();
  assert.equal(owner.pending(), 0); assert.equal(setupClock.pending, 0);
  assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
});

for (const mode of ['omitted', 'aborted'] as const) test(`Discord hub fixture ${mode} held receipt joins writers before Store close`, async t => {
  const setupClock = new FakeClock(); const abort = new AbortController();
  const owner = discordHubFixtureOwner(t, { injected: true, interval: 1000000, fake: { publishHeld: false, setupClock } });
  const fixture = await owner.start();
  const { fake, api, run, hub, clock } = fixture;
  await run(() => fake.control('fault', { response: 'hold' }));
  const observed = run(signal => fake.waitForHold(AbortSignal.any([signal, abort.signal])));
  const missing = assert.rejects(observed, mode === 'omitted' ? /hold receipt deadline/ : /aborted/); void missing.catch(() => {});
  const send = api.createMessage(DISCORD_IDS.channel, { content: 'held native writer', nonce: 'cleanup-health' });
  const cancelled = assert.rejects(send); void cancelled.catch(() => {});
  await run(() => fake.held());
  assert.equal(owner.dbClosed(), false);
  if (mode === 'aborted') abort.abort(); else await setupClock.advance(1000);
  await missing; await owner.close(); await cancelled; await hub.stopped;
  assert.equal(owner.dbClosed(), true);
  assert.deepEqual(owner.disposal, ['hub-stopped', 'store-closed']);
  const drains = owner.drainReceipts();
  assert.deepEqual(drains.map(r => r.phase).sort(), ['fake', 'native', 'stop']);
  assert.ok(drains.every(r => r.outcome === 'complete' && r.elapsedMs >= 0));
  t.diagnostic(JSON.stringify({ disposal: drains }));
  assert.equal(owner.pending(), 0); assert.equal(clock.pending, 0); assert.equal(setupClock.pending, 0);
  assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
});

test('Discord Identify floor stops below 100 with reset time and no Identify', async t => {
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t); const clock = new FakeClock();
  await fake.control('configure', { session_start_limit: { total: 1000, remaining: 99, reset_after: 60000, max_concurrency: 1 } });
  const config = defaultConfig('Identify floor'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const row = await receipt(async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!, r => r.connection === 'disabled');
  assert.equal(row.stopCause, 'identify-budget');
  assert.match(row.reason!, /2026-10-16T12:01:00.000Z/);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> };
  const warnings = history.messages.filter(m => m.text.includes('identify budget'));
  assert.equal(warnings.length, 1); assert.match(warnings[0]!.text, /2026-10-16T12:01:00.000Z/);
  assert.equal((await fake.control('state')).gateway.identifies, 0);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await hub.stop(); assert.equal(clock.pending, 0);
});

test('Discord Identify spacing and rolling count survive a legacy sessionless hub restart', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const root = await tempProject(t); const clock = new FakeClock(); const fake = await fakeDiscordFixture(t, { clock });
  await fake.control('configure', { interval: 1000000 });
  const config = defaultConfig('Identify restart'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const admission = discordAdmissionObserver(t);
  const start = () => projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { clock, log: admission.log, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const first = await start();
  await receipt(() => fake.control('state'), s => s.gateway.identifies === 1);
  await first.stop();
  const readBudget = () => { const db = new Store(join(root, '.cland/hub.db')); try { return JSON.parse(db.remotes.forMessenger('discord').get('discord.identify')!); } finally { db.close(); } };
  assert.deepEqual(readBudget().timestamps, [clock.now().getTime()]);
  // Previous hub versions persisted the Identify ledger without a resumable session.
  // Seed that historical checkpoint only after the original owner has joined.
  const legacy = new Store(join(root, '.cland/hub.db'));
  try { legacy.remotes.forMessenger('discord').set('discord.session', null); } finally { legacy.close(); }
  const scheduled = admission.observe(1); // New hub owns a new socket ordinal.
  const second = await start();
  assert.equal((await scheduled).delay, 5000);
  await clock.advance(4999); assert.equal((await fake.control('state')).gateway.identifies, 1);
  await clock.advance(1); await receipt(() => fake.control('state'), s => s.gateway.identifies === 2);
  assert.deepEqual(readBudget().timestamps, [Date.parse('2026-10-16T12:00:00Z'), Date.parse('2026-10-16T12:00:05Z')]);
  await second.stop(); assert.equal(clock.pending, 0);
});

test('Discord failed Identifies grow equal-jitter waits through the cap; READY clears backoff', async t => {
  const admission = discordAdmissionObserver(t);
  const fixture = await discordHubFixtureOwner(t, { log: admission.log, injected: true, interval: 1000000, configure: { ready: false } }).start();
  const { fake, clock, state, close } = fixture;
  const origin = clock.now().getTime();
  let count = 1;
  await clock.advance(10000); // A long failed handshake still backs off after its close.
  for (const delay of [3125, 6250, 12500, 25000, 50000, 100000, 187500, 187500]) {
    const failedAt = clock.now().getTime();
    const scheduled = admission.observe(count + 1);
    await fake.control('close', { code: 4009 });
    await receipt(() => fake.control('state'), s => s.gateway.closes.length === count);
    await clock.advance(1);
    assert.ok((await scheduled).delay > 0);
    const previous = JSON.parse(state.get('discord.identify')!).timestamps.at(-1) as number;
    const deadline = Math.max(previous + 5000, failedAt + delay);
    await clock.advance(deadline - clock.now().getTime() - 1);
    assert.equal((await fake.control('state')).gateway.identifies, count);
    if (count === 8) await fake.control('configure', { ready: true });
    await clock.advance(1);
    count++; await receipt(() => fake.control('state'), s => s.gateway.identifies === count);
    assert.equal(JSON.parse(state.get('discord.identify')!).timestamps.at(-1), deadline);
  }
  await receipt(async () => JSON.parse(state.get('discord.identify')!).failures, failures => failures === 0);
  assert.ok(clock.now().getTime() > origin);
  const scheduled = admission.observe(count + 1);
  await fake.control('close', { code: 4009 });
  await receipt(() => fake.control('state'), s => s.gateway.closes.length === count);
  await clock.advance(1); assert.equal((await scheduled).delay, 4999);
  await clock.advance(4998); assert.equal((await fake.control('state')).gateway.identifies, count);
  await clock.advance(1); await receipt(() => fake.control('state'), s => s.gateway.identifies === count + 1);
  await close(); assert.equal(clock.pending, 0);
});

test('Discord 500th Identify warns General once across the 501st and prunes rolling day', async t => {
  const clock = new FakeClock(); const now = clock.now().getTime();
  const admission = discordAdmissionObserver(t);
  const fixture = await discordHubFixtureOwner(t, { log: admission.log, clock, interval: 1000000, prepare: state => {
    state.set('discord.identify', JSON.stringify({ timestamps: [now - 86400001, ...Array.from({ length: 499 }, (_, i) => now - (499 - i) * 5000)], failures: 0, warned: null }));
  } }).start();
  const { fake, state, history, close } = fixture;
  const warnings = () => history().then(rows => rows.filter(m => m.text.includes('500 identifies')));
  assert.equal((await receipt(warnings, rows => rows.length === 1)).length, 1);
  assert.equal(JSON.parse(state.get('discord.identify')!).timestamps.length, 500);
  const scheduled = admission.observe(2);
  await fake.control('close', { code: 4009 }); await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
  await clock.advance(1); assert.equal((await scheduled).delay, 4999);
  await clock.advance(4999); await receipt(() => fake.control('state'), s => s.gateway.identifies === 2);
  assert.equal(JSON.parse(state.get('discord.identify')!).timestamps.length, 501);
  assert.equal((await warnings()).length, 1);
  assert.equal(JSON.stringify(await history()).includes(DISCORD_TEST_TOKEN), false);
  await close(); assert.equal(clock.pending, 0);
});

test('Discord rereads the start budget before a fresh Identify after READY', async t => {
  const admission = discordAdmissionObserver(t);
  const { fake, clock, status, history, close } = await discordHubFixtureOwner(t, { log: admission.log, interval: 1000000,
    configure: { session_start_limit: { total: 1000, remaining: 100, reset_after: 60000, max_concurrency: 1 } } }).start();
  await fake.control('configure', { session_start_limit: { total: 1000, remaining: 99, reset_after: 90000, max_concurrency: 1 } });
  const scheduled = admission.observe(2);
  await fake.control('close', { code: 4009 });
  await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
  await clock.advance(1); assert.equal((await scheduled).delay, 4999);
  await clock.advance(4999);
  const row = await receipt(status, r => r.connection === 'disabled');
  assert.equal(row.stopCause, 'identify-budget'); assert.match(row.reason!, /2026-10-16T12:01:35.000Z/);
  assert.equal((await fake.control('state')).gateway.identifies, 1);
  assert.equal((await history()).filter(m => m.text.includes('identify budget')).length, 1);
  await close(); assert.equal(clock.pending, 0);
});

for (const mode of ['omitted', 'aborted'] as const) test(`Discord Identify ${mode} admission setup drains observers and native writers`, async t => {
  const setupClock = new FakeClock(); const abort = new AbortController();
  const admission = discordAdmissionObserver(t, { setupClock, publish: false });
  const owner = discordHubFixtureOwner(t, { log: admission.log, interval: 1000000 });
  const { fake, clock, logs, hub } = await owner.start();
  const scheduled = admission.observe(2, abort.signal);
  const incomplete = assert.rejects(scheduled, mode === 'omitted' ? /admission receipt deadline/ : /admission observation aborted/);
  void incomplete.catch(() => {});
  await fake.control('close', { code: 4009 });
  await receipt(() => fake.control('state'), s => s.gateway.closes.length === 1);
  await clock.advance(1);
  // Positive producer control: omit only observer publication, never substitute a status timestamp.
  await receipt(async () => logs, entries => entries.some(e => e.event === 'discord-identify-scheduled' && e.connection === 2));
  if (mode === 'aborted') abort.abort(new Error('Discord admission observation aborted')); else await setupClock.advance(2000);
  await incomplete; await admission.close(); await owner.close(); await hub.stopped;
  assert.equal(admission.pending(), 0); assert.equal(admission.listeners(), 0);
  assert.equal(owner.pending(), 0); assert.equal(owner.dbClosed(), true);
  assert.deepEqual(owner.disposal, ['hub-stopped', 'store-closed']);
  assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
  assert.equal(clock.pending, 0); assert.equal(setupClock.pending, 0);
});
