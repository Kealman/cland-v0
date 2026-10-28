// T2: sealed production frame/fake Discord REST and gateway.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { fakeDiscordFixture, DISCORD_TEST_TOKEN } from './fakes/discord/fake-api.ts';

test('Discord global cland definition writes once, compares on restart and repairs drift', async t => {
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  const config = defaultConfig('Pair fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const start = () => projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  let hub = await start();
  await until(async () => (await fake.control('state')).commandWrites === 1, { timeoutMs: 1500, what: 'global command write' });
  const commands = (await fake.control('state')).commands as Array<Record<string, unknown>>;
  assert.equal(commands.length, 1); const command = commands[0]!;
  for (const name of ['decision', 'question']) assert.deepEqual((command.options as Array<{ name: string; options?: object[] }>).find(o => o.name === name)!.options, [{ type: 3, name: 'text', description: 'Text', required: true }]);
  assert.equal(command.name, 'cland'); assert.deepEqual(command.contexts, [0]); assert.deepEqual(command.integration_types, [0]); assert.equal(command.default_member_permissions, '0');
  assert.deepEqual((command.options as Array<{ name: string }>).map(o => o.name), ['pair', 'status', 'inbox', 'mute', 'unmute', 'decision', 'question', 'help']);
  await hub.stop();
  const metadataOnly = structuredClone(command);
  Object.assign(metadataOnly, { id: '90071992547419999', application_id: '90071992547409931', version: '123456789012345678', nsfw: false, name_localizations: null, description_localizations: null });
  (metadataOnly.options as Array<Record<string, unknown>>)[0]!.options = [];
  await fake.control('configure', { commands: [metadataOnly] });
  hub = await start(); assert.equal((await fake.control('state')).commandWrites, 1);
  await hub.stop();
  const changed = structuredClone(command);
  (changed.options as Array<Record<string, unknown>>)[0]!.options = [{ type: 3, name: 'unexpected', description: 'Must be removed', required: true }];
  await fake.control('configure', { commands: [changed] }); hub = await start();
  assert.equal((await fake.control('state')).commandWrites, 2); await hub.stop();
});

test('Discord pair uses private bounded code replies, expiry and stranger reply cap', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const { connectUi } = await import('./harness.ts');
  const clock = new FakeClock(); const root = await tempProject(t); const fake = await fakeDiscordFixture(t, { clock });
  const config = defaultConfig('Pair fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  const first = await fake.control('interact', { user: 'member' });
  await until(async () => !!(await fake.control('state')).interactions.find(r => r.id === first.id)?.callbacks.length, { what: 'ephemeral pair callback', timeoutMs: 2000 });
  const row = (await fake.control('state')).interactions[0]!;
  const callback = row.callbacks[0] as { type: number; data: { flags: number; content: string } };
  assert.equal(callback.type, 4); assert.equal(callback.data.flags, 64);
  assert.match(callback.data.content, /user 90071992547409936: code [A-HJ-NP-Z2-9]{8}\ncland remote approve discord/);
  const inbox = await ui.request({ type: 'inbox.list' });
  assert.ok(JSON.stringify(inbox).includes(callback.data.content.match(/code ([A-Z2-9]{8})/)![1]!));
  await fake.control('interact', { user: 'member' });
  await until(async () => (await fake.control('state')).interactions[1]!.callbacks.length === 1, { what: 'second private reply', timeoutMs: 2000 });
  await fake.control('interact', { user: 'member' });
  // Ordered dispatch receipt: a subsequent human reply proves the earlier request was processed.
  await fake.control('interact', { user: 'human' });
  await until(async () => (await fake.control('state')).interactions[3]!.callbacks.length === 1, { what: 'ordered human callback', timeoutMs: 2000 });
  assert.equal((await fake.control('state')).interactions[2]!.callbacks.length, 0);
  for (const input of [{ command: 'status' }, { guild_id: null }, { channel_type: 11 }]) {
    const invalid = await fake.control('interact', input);
    await until(async () => !!(await fake.control('state')).interactions.find(r => r.id === invalid.id)?.callbacks.length, { what: 'unpaired or invalid-channel note', timeoutMs: 2000 });
    const text = JSON.stringify((await fake.control('state')).interactions.find(r => r.id === invalid.id)!.callbacks);
    assert.match(text, input.command ? /Not paired yet/ : /server text channel/);
    assert.doesNotMatch(text, /code [A-Z2-9]{8}/);
  }
  await clock.advance(900000);
  const expired = await ui.request({ type: 'inbox.list' });
  assert.equal(JSON.stringify(expired).includes(callback.data.content.match(/code ([A-Z2-9]{8})/)![1]!), false);
  await hub.stop();
});

test('Discord CLI approval edits original privately, replaces old channel and preserves TEXT ids across restart without interaction secrets', async t => {
  const { FakeClock } = await import('./fake-clock.ts');
  const { connectUi, cland } = await import('./harness.ts');
  const { DISCORD_IDS: ids } = await import('./fakes/discord/fake-api.ts');
  const { readFile } = await import('node:fs/promises'); const { DatabaseSync } = await import('node:sqlite');
  const clock = new FakeClock(); const root = await tempProject(t); const fake = await fakeDiscordFixture(t, { clock });
  const config = defaultConfig('Pair fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const logs: unknown[] = [], sent: unknown[] = [];
  const { Store } = await import('../src/hub/store.ts');
  const { messengerFactory } = await import('../src/remote/messenger.ts');
  const { remoteRedactor } = await import('../src/remote/redact.ts');
  const { onCleanup } = await import('./process-cleanup.ts');
  const store = new Store(join(root, '.cland/hub.db'));
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  onCleanup(t, async () => { await hub?.stop(); store.close(); });
  const env = { CLAND_DISCORD_API_ROOT: fake.url };
  const factory = messengerFactory(env, remoteRedactor(), clock, { state: store.remotes, projectName: () => 'Pair fixture' });
  const start = () => projectHub(t, root, env, { clock, log: e => { logs.push(e); }, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN },
    gatewayMessenger: (...args) => {
      const remote = factory(...args); const nativeStart = remote.start.bind(remote);
      remote.start = (send, ...rest) => nativeStart((frame, ingress, bytes) => { sent.push(frame); send(frame, ingress, bytes); }, ...rest);
      return remote;
    },
  });
  hub = await start(); const ui = await connectUi(t, hub.discovery, 'nvim');
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: 2000 });
  const pair = async (channel_id: string) => {
    const interaction = await fake.control('interact', { channel_id });
    await until(async () => !!(await fake.control('state')).interactions.find(r => r.id === interaction.id)?.callbacks.length, { what: 'code callback', timeoutMs: 2000 });
    const row = (await fake.control('state')).interactions.find(r => r.id === interaction.id)!;
    const text = (row.callbacks[0] as { data: { content: string } }).data.content;
    const code = /code ([A-Z2-9]{8})/.exec(text)![1]!;
    const result = await cland(root, 'remote', 'approve', 'discord', code);
    assert.equal(result.code, 0, result.stderr); assert.match(result.stdout, /Fixture human/); assert.ok(result.stdout.includes(ids.human));
    await until(async () => !!(await fake.control('state')).interactions.find(r => r.id === interaction.id)?.edits.length, { what: 'Approved edit', timeoutMs: 2000 });
    assert.match(JSON.stringify((await fake.control('state')).interactions.find(r => r.id === interaction.id)!.edits), /Approved: this channel is paired with Pair fixture/);
    return interaction.id;
  };
  const first = await pair(ids.channel);
  for (const input of [{ user: 'member' }, { user: 'administrator' }, { channel_id: ids.secondChannel }]) {
    const before = sent.length;
    const r = await fake.control('interact', { ...input, command: 'status' });
    await until(async () => !!(await fake.control('state')).interactions.find(i => i.id === r.id)?.callbacks.length, { what: 'private refusal', timeoutMs: 2000 });
    const callback = (await fake.control('state')).interactions.find(i => i.id === r.id)!.callbacks[0] as { type: number; data: { flags: number; content: string } };
    assert.equal(callback.type, 4); assert.equal(callback.data.flags, 64); assert.match(callback.data.content, /not paired/);
    assert.equal(sent.length, before, 'refusal sends no hub frame');
  }
  const same = await fake.control('interact', {});
  await until(async () => !!(await fake.control('state')).interactions.find(r => r.id === same.id)?.callbacks.length, { what: 'already paired reply', timeoutMs: 2000 });
  assert.match(JSON.stringify((await fake.control('state')).interactions.find(r => r.id === same.id)!.callbacks), /Paired with Pair fixture/);
  const second = await pair(ids.secondChannel);
  await until(async () => (await fake.control('state')).messages.some(m => m.channel_id === ids.channel && m.content.includes('another chat')), { what: 'old channel notice', timeoutMs: 2000 });
  assert.equal((await fake.control('state')).messages.filter(m => m.channel_id === ids.channel).length, 1);
  await hub.stop(); hub = await start();
  const status = await cland(root, 'remote', 'status', '--json'); assert.equal(status.code, 0, status.stderr);
  for (const id of [ids.guild, ids.secondChannel, ids.human]) assert.ok(status.stdout.includes(id));
  await hub.stop();
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    const row = db.prepare("select guild_id, chat_id, user_id, typeof(guild_id) as g, typeof(chat_id) as c, typeof(user_id) as u from remote_pairings where messenger = 'discord'").get()!;
    assert.deepEqual({ ...row }, { guild_id: ids.guild, chat_id: ids.secondChannel, user_id: ids.human, g: 'text', c: 'text', u: 'text' });
  } finally { db.close(); }
  const sinks = await Promise.all(['hub.db', 'log/hub.log', 'journal.jsonl'].map(f => readFile(join(root, '.cland', f))));
  for (const secret of [`synthetic_interaction_${first}`, `synthetic_interaction_${second}`, DISCORD_TEST_TOKEN]) {
    assert.equal(sinks.some(b => b.includes(secret)), false); assert.equal(JSON.stringify([ui.frames, logs, status]).includes(secret), false);
  }
});

test('Discord fake enforces one acknowledgement, three-second callback deadline and fifteen-minute original edit lifetime', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const { DiscordApi } = await import('../src/remote/discord-api.ts');
  const { DISCORD_IDS } = await import('./fakes/discord/fake-api.ts');
  const clock = new FakeClock(); const fake = await fakeDiscordFixture(t, { clock });
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const first = await fake.control('interact', {}); const token = `synthetic_interaction_${first.id}`;
  await clock.advance(2999); await api.callback(first.id, token, 'private');
  await assert.rejects(api.callback(first.id, token, 'second'), e => (e as { code: number }).code === 40060);
  await clock.advance(897000); await api.editOriginal(DISCORD_IDS.application, token, 'still live');
  await clock.advance(1); await assert.rejects(api.editOriginal(DISCORD_IDS.application, token, 'expired'), e => (e as { code: number }).code === 10015);
  const late = await fake.control('interact', {}); await clock.advance(3000);
  await assert.rejects(api.callback(late.id, `synthetic_interaction_${late.id}`, 'late'), e => (e as { code: number }).code === 10062);
  assert.equal((await fake.control('state')).interactions[0]!.callbacks.length, 1);
  assert.equal((await fake.control('state')).interactions[0]!.edits.length, 1);
  assert.equal((await fake.control('state')).interactions[1]!.callbacks.length, 0);
});
