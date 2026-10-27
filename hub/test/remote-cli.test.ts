// T2: sealed CLI subprocesses against projectHub and the fake messenger boundary.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';
import { legacyRemoteHub, legacyRemoteHubFixture } from './fakes/legacy-remote-hub.ts';
import { heldRemoteBoundary } from './fakes/held-remote-boundary.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { testMessenger } from './fakes/messenger.ts';
import { secretProject, secretCli } from './secrets-fixture.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { Inbox } from '../src/protocol.ts';

for (const via of ['telegram', 'discord'] as const) test(`remote approve ${via} prints the stored paired name and numeric id`, async t => {
  const root = await tempProject(t);
  const remote = testMessenger(via, via);
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  remote.pair({ userId: '123456789012345678', chatId: '234567890123456789', guildId: via === 'discord' ? '345678901234567890' : null, name: 'Fixture human' });
  const row = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  const approved = await cland(root, 'remote', 'approve', via, row.code);
  assert.equal(approved.code, 0, approved.stderr);
  assert.match(approved.stdout, /Fixture human.*123456789012345678/);
  assert.deepEqual(((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings, []);
});

test('remote status reports loaded fingerprints, pairing and messenger facts without secrets', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  const token = '123456:made_up_test_token_abcdefghijk';
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [{ ...remote,
    status: () => ({ connected: true, lastInbound: '2026-10-25T12:00:00.000Z', lastOutbound: '2026-10-25T12:01:00.000Z', botLink: 'https://t.me/fixture_bot' }),
  }], syntheticRemoteSecrets: { 'telegram.token': token } });
  const store = new Store(join(root, '.cland/hub.db'));
  try {
    const state = store.remotes.forMessenger('telegram');
    for (const [i, jobState] of ['queued', 'sending', 'uncertain', 'sent', 'dropped', 'missed'].entries())
      state.putOutbox({ id: `job-${i}`, kind: 'card', source: null, state: jobState, payload: {}, created: '2026-10-25T12:00:00.000Z', updated: '2026-10-25T12:00:00.000Z' });
  } finally { store.close(); }
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const paired = { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' };
  remote.pair(paired);
  const code = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!.code;
  assert.equal((await cland(root, 'remote', 'approve', 'telegram', code)).code, 0);
  const status = await cland(root, 'remote', 'status', '--json');
  assert.equal(status.code, 0, status.stderr.slice(0, 300));
  assert.deepEqual(JSON.parse(status.stdout), { remotes: [
    { messenger: 'telegram', token: { present: true, fingerprint: '6380e7f321ca' }, pairing: paired, connection: 'connected', reason: null,
      lastInbound: '2026-10-25T12:00:00.000Z', lastOutbound: '2026-10-25T12:01:00.000Z', outboxDepth: 3, mute: false, botLink: 'https://t.me/fixture_bot' },
    { messenger: 'discord', token: { present: false, fingerprint: null }, pairing: null, connection: 'disconnected', reason: null,
      lastInbound: null, lastOutbound: null, outboxDepth: 0, mute: false, botLink: null },
  ] });
  const plain = await cland(root, 'remote', 'status');
  assert.equal(plain.code, 0, plain.stderr);
  for (const fact of ['telegram', '6380e7f321ca', 'Fixture human', '12345', 'connected', '2026-10-25T12:00:00.000Z', '2026-10-25T12:01:00.000Z', 'outbox: 3', 'mute: false', 'https://t.me/fixture_bot', 'discord', 'absent']) assert.ok(plain.stdout.includes(fact), fact);
  assert.equal((status.stdout + status.stderr + plain.stdout + plain.stderr).includes(token), false);
});

for (const [via, stopCause, cause, fix] of [
  ['telegram', 'token', 'wrong or revoked token (401)', 'set a new token with cland secret set telegram.token, then run cland hub reload'],
  ['discord', 'message-content', 'Message Content toggle disabled (4014)', 'enable Message Content in the Discord application, then run cland hub reload'],
] as const) test(`remote status renders the shared ${via} structured cause and fix without parsing reason`, async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { gatewayRemotes: [testMessenger(via, { via,
    startError: Object.assign(new Error('opaque sanitized legacy reason'), { stopCause }),
  })] });
  const result = await cland(root, 'remote', 'status');
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes(`stopped: ${cause}; ${fix}`), result.stdout);
  assert.match(result.stdout, /connection: disabled \(opaque sanitized legacy reason\)/);
});

test('remote status renders previous hub rows without a structured cause', async t => {
  const root = await tempProject(t);
  await legacyRemoteHubFixture(t, root, { legacyStatus: true }).start();
  const result = await cland(root, 'remote', 'status');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /connection: disabled \(legacy sanitized stop reason\)/);
  assert.match(result.stdout, /Old hub human \(12345\)/);
  assert.equal(result.stdout.includes('stopped:'), false);
});

for (const via of ['telegram', 'discord'] as const) test(`remote unpair ${via} forgets only that binding`, async t => {
  const root = await tempProject(t);
  const remotes = [testMessenger('telegram'), testMessenger('discord', 'discord')];
  const hub = await projectHub(t, root, {}, { gatewayRemotes: remotes });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  for (const remote of remotes) {
    remote.pair({ userId: '12345', chatId: '23456', guildId: null, name: 'Fixture human' });
    const row = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings!.find(row => row.messenger === remote.via)!;
    assert.equal((await cland(root, 'remote', 'approve', remote.via, row.code)).code, 0);
  }
  const result = await cland(root, 'remote', 'unpair', via);
  assert.equal(result.code, 0, result.stderr.slice(0, 300));
  assert.equal(result.stdout, `unpaired ${via}\n`);
  const status = JSON.parse((await cland(root, 'remote', 'status', '--json')).stdout);
  assert.equal(status.remotes.find((r: { messenger: string }) => r.messenger === via).pairing, null);
  assert.equal(status.remotes.find((r: { messenger: string }) => r.messenger !== via).pairing.userId, '12345');
});

for (const via of ['telegram', 'discord'] as const) test(`remote test ${via} checks the client and sends one line only to the paired chat`, async t => {
  const root = await tempProject(t);
  const remote = testMessenger(via, via);
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const unpaired = await cland(root, 'remote', 'test', via);
  assert.equal(unpaired.code, 0, unpaired.stderr.slice(0, 300));
  assert.equal(remote.tokenChecks, 1);
  assert.deepEqual(remote.testLines, []);
  const identity = { userId: '12345', chatId: '23456', guildId: via === 'discord' ? '34567' : null, name: 'Fixture human' };
  remote.pair(identity);
  const row = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  assert.equal((await cland(root, 'remote', 'approve', via, row.code)).code, 0);
  const paired = await cland(root, 'remote', 'test', via);
  assert.equal(paired.code, 0, paired.stderr);
  assert.match(paired.stdout, /token checked; test line sent/);
  assert.equal(remote.tokenChecks, 2);
  assert.deepEqual(remote.testLines, [{ pairing: identity, text: 'cland remote test' }]);
});

test('remote management refuses remote and attributed callers and legacy clients keep serving', async t => {
  const root = await tempProject(t);
  const current = testMessenger('telegram');
  const { test: _test, ...legacy } = current;
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [legacy] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  for (const frame of [{ type: 'remote.status' }, { type: 'remote.test', messenger: 'telegram' }, { type: 'remote.unpair', messenger: 'telegram' }]) {
    assert.equal((await current.client.request(frame)).ok, false);
    assert.equal((await ui.request({ ...frame, as: { name: 'human' } })).ok, false);
    const other = await connectUi(t, hub.discovery, 'ui');
    assert.equal((await other.request(frame)).ok, false);
  }
  const tested = await cland(root, 'remote', 'test', 'telegram');
  assert.equal(tested.code, 1);
  assert.match(tested.stderr, /messenger test is unavailable/);
  assert.equal((await current.client.request({ type: 'hub.status' })).ok, true);
  assert.equal((await cland(root, 'remote', 'status')).code, 0);
});

for (const via of ['telegram', 'discord'] as const) test(`rotating the ${via} token through secret set and hub reload reconnects with the numeric pairing and mute retained`, async t => {
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Rotation');
  config.verification.lockPath = join(root, 'suite.lock');
  config.remote[via].enabled = true;
  config.remote.muteDefault = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const tokens = ['123456:made_up_test_token_abcdefghijk', '123456:rotated_test_token_abcdefghijk'];
  await secretCli(t, root, ['set', `${via}.token`], tokens[0] + '\n');
  const remotes: ReturnType<typeof testMessenger>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayMessenger: (messenger, token) => {
    assert.ok(token === tokens[remotes.length], 'factory receives the resolved token at each start');
    const remote = testMessenger(messenger, messenger); remotes.push(remote); return remote;
  } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const identity = { userId: '123456789012345678', chatId: '234567890123456789', guildId: via === 'discord' ? '345678901234567890' : null, name: 'Rotation human' };
  remotes[0]!.pair(identity);
  const row = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  assert.equal((await cland(root, 'remote', 'approve', via, row.code)).code, 0);
  const before = JSON.parse((await cland(root, 'remote', 'status', '--json')).stdout).remotes.find((r: { messenger: string }) => r.messenger === via);
  assert.equal(before.mute, true, 'new pairing starts with mute_default');
  await secretCli(t, root, ['set', `${via}.token`], tokens[1] + '\n');
  const reloaded = await cland(root, 'hub', 'reload');
  assert.equal(reloaded.code, 0, reloaded.stderr);
  assert.equal(remotes.length, 2);
  assert.equal(remotes[0]!.stopped, true, 'reload joins the previous client stop');
  assert.equal((await remotes[1]!.client.request({ type: 'hub.status' })).ok, true, 'replacement client exchanges frames');
  const after = JSON.parse((await cland(root, 'remote', 'status', '--json')).stdout).remotes.find((r: { messenger: string }) => r.messenger === via);
  assert.deepEqual(after.pairing, identity);
  assert.equal(after.mute, true);
  assert.notEqual(after.token.fingerprint, before.token.fingerprint);
  assert.equal((await cland(root, 'remote', 'test', via)).code, 0);
  assert.deepEqual(remotes[1]!.testLines, [{ pairing: identity, text: 'cland remote test' }]);
  await hub.stop();
  for (const file of ['log/hub.log', 'journal.jsonl']) {
    const bytes = await readFile(join(root, '.cland', file), 'utf8');
    assert.equal(tokens.some(token => bytes.includes(token)), false, 'rotation logs and journals contain no token');
  }
});

test('messenger test failures redact credentials and disable only the failing remote', async t => {
  const root = await tempProject(t);
  const token = '123456:made_up_test_token_abcdefghijk';
  const failing = testMessenger('telegram');
  const healthy = testMessenger('discord', 'discord');
  const hub = await projectHub(t, root, {}, { syntheticRemoteSecrets: { 'telegram.token': token }, gatewayRemotes: [
    { ...failing, test: () => { throw new Error(`platform failure ${token}`); } }, healthy,
  ] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const result = await ui.request({ type: 'remote.test', messenger: 'telegram' });
  assert.equal(result.ok, false);
  assert.ok(result.error === 'platform failure [redacted]', 'error is sanitized at the client boundary');
  assert.equal((await cland(root, 'remote', 'test', 'discord')).code, 0);
  const status = JSON.parse((await cland(root, 'remote', 'status', '--json')).stdout);
  assert.equal(status.remotes[0].connection, 'disabled');
  assert.equal(status.remotes[0].reason, 'platform failure [redacted]');
  assert.equal((await healthy.client.request({ type: 'hub.status' })).ok, true);
  await hub.stop();
  for (const file of ['log/hub.log', 'journal.jsonl']) assert.equal((await readFile(join(root, '.cland', file), 'utf8')).includes(token), false);
});

test('shutdown joins a held messenger test before releasing its store', async t => {
  const hold = heldRemoteBoundary(t);
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  let completed = false;
  const stoppedRemote = Promise.withResolvers<void>();
  const order: string[] = [];
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [{ ...remote, test: async () => {
    await hold.hold(); completed = true; order.push('test-completed');
  }, stop: async () => { await remote.stop(); stoppedRemote.resolve(); } }] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const entered = within(hold.setup(), 1000);
  const testing = hold.own(ui.request({ type: 'remote.test', messenger: 'telegram' }));
  await entered;
  assert.equal(completed, false);
  const stopping = hold.own(hub.stop().then(() => { order.push('hub-stopped'); }));
  await within(stoppedRemote.promise, 1000);
  assert.deepEqual(order, [], 'shutdown still owns the held callback after the remote stops');
  hold.resume();
  await within(stopping, 2000);
  await testing;
  assert.equal(completed, true, 'platform completion is observed before store removal');
  assert.equal(remote.stopped, true);
  assert.deepEqual(order, ['test-completed', 'hub-stopped']);
});

test('remote CLI accepts the previous approval reply and reports unsupported frames from an older hub', async t => {
  const root = await tempProject(t);
  const old = await legacyRemoteHub(t, root);
  const approved = await cland(root, 'remote', 'approve', 'telegram', 'ABCDEFGH');
  assert.equal(approved.code, 0, approved.stderr);
  assert.equal(approved.stdout, 'paired telegram: Old hub human (12345)\n');
  for (const args of [['status'], ['unpair', 'telegram'], ['test', 'telegram']]) {
    const result = await cland(root, 'remote', ...args);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'cland: invalid request\n');
  }
  assert.deepEqual(old.requests, ['pairing.approve', 'remote.status', 'remote.unpair', 'remote.test']);
});

test('remote status keeps public bot links and omits credential-bearing or foreign links', async t => {
  const root = await tempProject(t);
  const token = '123456:made_up_test_token_abcdefghijk';
  let link = 'https://discord.com/oauth2/authorize?client_id=123456789012345678&scope=bot&permissions=117824';
  const remote = testMessenger('discord', 'discord');
  const hub = await projectHub(t, root, {}, { syntheticRemoteSecrets: { 'telegram.token': token }, gatewayRemotes: [{ ...remote,
    status: () => ({ connected: false, lastInbound: null, lastOutbound: null, botLink: link }),
  }] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const status = async () => (await ui.request({ type: 'remote.status' })).value as import('../src/protocol.ts').RemoteStatusResult;
  assert.equal((await status()).remotes[1]!.botLink, link);
  for (const unsafe of [`https://t.me/${token}`, `https://example.invalid/${token}`, 'https://example.invalid/bot']) {
    link = unsafe;
    const reply = await status();
    assert.equal(reply.remotes[1]!.botLink, null);
    assert.equal(JSON.stringify(reply).includes(token), false);
  }
});

for (const failure of ['missing receipt', 'aborted setup'] as const) test(`older-hub fixture disposes its native listener after ${failure}`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const abort = new AbortController();
  const fixture = legacyRemoteHubFixture(t, root, { clock, signal: abort.signal, publishListening: false });
  const observed = within(fixture.listening(), 1000);
  const started = fixture.start();
  const failed = assert.rejects(started, failure === 'missing receipt' ? /legacy hub listening receipt deadline reached/ : /fixture setup cancelled/);
  await observed;
  if (failure === 'missing receipt') await clock.advance(1000);
  else abort.abort(new Error('fixture setup cancelled'));
  await within(failed, 1500);
  await within(fixture.dispose(), 1500);
  assert.deepEqual(fixture.receipts(), { listening: true, closed: true, peers: 0, writers: 0 });
  assert.equal(clock.pending, 0);
});

test('older-hub fixture reports a native bind error and disposes through its setup owner', async t => {
  const root = await tempProject(t);
  const fixture = legacyRemoteHubFixture(t, join(root, 'absent'));
  await assert.rejects(within(fixture.start(), 1500), /legacy hub listen failed: (ENOENT|EACCES)/);
  await within(fixture.dispose(), 1500);
  assert.equal(fixture.receipts().listening, false);
  assert.equal(fixture.receipts().peers, 0);
  assert.equal(fixture.receipts().writers, 0);
});

test('remote test after token rotation masks a colliding display name and refuses a colliding numeric id', async t => {
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Rotation collision');
  config.verification.lockPath = join(root, 'suite.lock');
  config.remote.discord.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  await secretCli(t, root, ['set', 'discord.token'], 'made_up_discord_initial\n');
  const remotes: ReturnType<typeof testMessenger>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayMessenger: via => {
    const remote = testMessenger(via, via); remotes.push(remote); return remote;
  } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const identity = { userId: '123456789012345678', chatId: '234567890123456789', guildId: '345678901234567890', name: 'Collision_name' };
  remotes[0]!.pair(identity);
  const row = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  assert.equal((await cland(root, 'remote', 'approve', 'discord', row.code)).code, 0);
  await secretCli(t, root, ['set', 'discord.token'], identity.name + '\n');
  assert.equal((await cland(root, 'hub', 'reload')).code, 0);
  const tested = await cland(root, 'remote', 'test', 'discord');
  assert.equal(tested.code, 0, tested.stderr);
  assert.equal(remotes[0]!.stopped, true);
  assert.deepEqual(remotes[1]!.testLines, [{ pairing: { ...identity, name: '[redacted]' }, text: 'cland remote test' }]);
  assert.equal(JSON.stringify(remotes[1]!.testLines).includes(identity.name), false);
  await secretCli(t, root, ['set', 'discord.token'], identity.userId + '\n');
  assert.equal((await cland(root, 'hub', 'reload')).code, 0);
  const refused = await cland(root, 'remote', 'test', 'discord');
  assert.equal(refused.code, 1);
  assert.equal(refused.stderr, 'cland: remote output would alter protocol routing\n');
  assert.equal(remotes[2]!.tokenChecks, 0);
  assert.deepEqual(remotes[2]!.testLines, []);
  await hub.stop();
  for (const file of ['log/hub.log', 'journal.jsonl']) {
    const text = await readFile(join(root, '.cland', file), 'utf8');
    assert.equal(text.includes(identity.name) || text.includes(identity.userId), false);
  }
});
