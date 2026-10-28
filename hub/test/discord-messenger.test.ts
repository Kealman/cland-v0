// T2: native factory, sealed frames and loopback Discord gateway/REST.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, connectUi, cland, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { fakeDiscordFixture, DISCORD_TEST_TOKEN, DISCORD_IDS } from './fakes/discord/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import type { RemoteStatusRow } from '../src/protocol.ts';
async function receipt<T>(read: () => Promise<T>, matches: (value: T) => boolean): Promise<T> {
  let value: T | undefined;
  await until(async () => { value = await read(); return matches(value); }, { what: 'exact Discord receipt', timeoutMs: 2000 });
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
