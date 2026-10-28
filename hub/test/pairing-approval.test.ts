// T2: local frame/CLI transport and trusted fake messengers; no platform or token.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectUi, frameClient, projectHub, tempProject } from './harness.ts';
import { testMessenger } from './fakes/messenger.ts';
import { FakeClock } from './fake-clock.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';
import type { Inbox } from '../src/protocol.ts';
import { Store } from '../src/hub/store.ts';
import { join } from 'node:path';
import { heldRemoteBoundary } from './fakes/held-remote-boundary.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { PassThrough } from 'node:stream';
import { createStdioEdge } from '../src/hub/stdio.ts';
import { onCleanup } from './process-cleanup.ts';

test('only the local Neovim client and human CLI can approve a waiting code', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock() });
  const identity = { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' };
  remote.pair(identity);
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  const rows = await nvim.request({ type: 'inbox.list' });
  const row = (rows.value as Inbox).pairings![0]!;
  const frame = { type: 'pairing.approve', messenger: 'telegram', code: row.code };
  const refusedRemote = await remote.client.request(frame);
  assert.equal(refusedRemote.ok, false);
  assert.equal((refusedRemote as { code?: string }).code, 'forbidden');
  for (const client of ['ui', 'human', 'web', 'other']) {
    const other = await connectUi(t, hub.discovery, client);
    const refused = await other.request(frame);
    assert.equal(refused.ok, false, client);
  }
  for (const as of [{ name: 'human' }, { name: 'invented-session' }, null]) {
    assert.equal((await nvim.request({ ...frame, as })).ok, false, 'an attributed caller cannot grant access');
  }
  const approved = await nvim.request(frame);
  assert.equal(approved.ok, true, approved.error);
  assert.deepEqual(approved.value, { pairing: identity });
  assert.equal((await nvim.request(frame)).ok, false, 'a same-client repeated code is consumed');
  remote.pair({ ...identity, userId: '23456', chatId: '23456' });
  const next = await nvim.request({ type: 'inbox.list' });
  const code = (next.value as Inbox).pairings![0]!.code;
  // Exercise the actual CLI socket transport with a sealed human environment.
  const cli = await askHubFrame(hub.discovery, { ...frame, code }, 2000, {});
  assert.deepEqual(cli, { pairing: { ...identity, userId: '23456', chatId: '23456' } });
});

test('Neovim can approve through its trusted parent-owned stdio connection', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock() });
  const input = new PassThrough(), output = new PassThrough();
  const nvim = frameClient(line => { input.write(line); }, fn => output.on('data', chunk => fn(chunk.toString())), () => { input.end(); output.destroy(); });
  onCleanup(t, () => nvim.close());
  createStdioEdge({ input, output, dispatcher: hub.dispatcher, onEnd: () => {} });
  const welcome = nvim.waitFor(frame => frame.type === 'welcome');
  nvim.send({ type: 'hello', protocol: 2, client: 'nvim' });
  assert.equal((await welcome).name, 'nvim');
  const identity = { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' };
  remote.pair(identity);
  const row = ((await nvim.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  const approved = await nvim.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code });
  assert.equal(approved.ok, true, approved.error);
  assert.deepEqual(approved.value, { pairing: identity });
});

for (const receipt of [true, false]) test(`shutdown drains a held replacement notice after granting the new pairing (setup receipt: ${receipt})`, async t => {
  const hold = heldRemoteBoundary(t, receipt);
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  let delivered = false;
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [{ ...remote, pairingReplaced: async (previous, text) => {
    await hold.hold();
    remote.pairingReplaced(previous, text);
    delivered = true;
  } }], clock: new FakeClock() });
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  const first = { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' };
  for (const userId of [first.userId, '23456']) {
    remote.pair({ ...first, userId, chatId: userId });
    const row = ((await nvim.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
    // Live bounds also cover a producer that never calls the fake at all.
    // The fake setup deadline is explicitly driven in the lost-receipt control.
    const entered = userId === '23456' ? within(hold.setup(), 1000, realClock,
      () => new Error('replacement notice setup live deadline reached')) : undefined;
    const actual = userId === '23456' ? within(hold.actual(), 1000, realClock,
      () => new Error('replacement notice actual entry live deadline reached')) : undefined;
    const missing = entered && !receipt ? assert.rejects(entered, /remote fixture setup receipt deadline reached/) : undefined;
    void entered?.catch(() => {});
    void actual?.catch(() => {});
    const approved = await nvim.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code });
    assert.equal(approved.ok, true, approved.error);
    await actual;
    if (missing) { await hold.clock.advance(1000); await missing; }
    else await entered;
  }
  assert.equal(delivered, false, 'approval commits independently of a held platform send');
  const stopping = hold.own(hub.stop());
  hold.resume();
  await within(stopping, 2000, realClock, () => new Error('hub replacement-notice drain deadline reached'));
  assert.equal(delivered, true, 'the actual platform completion precedes hub shutdown');
  assert.deepEqual(remote.replacements, [{ pairing: first, text: 'This project is now paired with another chat.' }]);
});

test('expired, missing, malformed and wrong-messenger codes grant no access', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const remote = testMessenger('discord', 'discord');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  remote.pair({ userId: '12345', chatId: '23456', guildId: '34567', name: 'Fixture human' });
  const list = (await nvim.request({ type: 'inbox.list' })).value as Inbox;
  const code = list.pairings![0]!.code;
  for (const frame of [
    { messenger: 'telegram', code },
    { messenger: 'discord', code: 'AAAAAAAA' === code ? 'BBBBBBBB' : 'AAAAAAAA' },
    { messenger: 'discord', code: '01INVALID' },
    { messenger: 'discord', code: null },
    { messenger: 'other', code },
  ]) assert.equal((await nvim.request({ type: 'pairing.approve', ...frame })).ok, false);
  assert.deepEqual(((await nvim.request({ type: 'inbox.list' })).value as Inbox).pairings, list.pairings);
  clock.block(900_000); // The grant must re-check durable expiry even before its timer fires.
  const expired = await nvim.request({ type: 'pairing.approve', messenger: 'discord', code });
  assert.equal(expired.ok, false);
  assert.match(expired.error!, /no live pairing code/);
  await hub.stop();
  const store = new Store(join(root, '.cland', 'hub.db'));
  try {
    assert.equal(store.remotes.forMessenger('discord').pairing(), null);
    assert.equal(store.remotes.forMessenger('telegram').pairing(), null);
    assert.deepEqual(store.remotes.forMessenger('discord').requests(), []);
  } finally { store.close(); }
});

test('replacement notice text uses the shared registered-secret redactor', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  // A fabricated opaque token deliberately collides with the fixed notice text.
  const fabricated = 'project';
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock(), syntheticRemoteSecrets: { 'discord.token': fabricated } });
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  for (const userId of ['12345', '23456']) {
    remote.pair({ userId, chatId: userId, guildId: null, name: 'Fixture human' });
    const row = ((await nvim.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
    const approved = await nvim.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code });
    assert.equal(approved.ok, true, approved.error);
  }
  assert.deepEqual(remote.replacements.map(row => row.text), ['This [redacted] is now paired with another chat.']);
  assert.equal(JSON.stringify(remote.replacements).includes(fabricated), false);
});

test('a configured messenger notice failure is redacted without rolling back the new numeric pairing', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Pairing notification fixture');
  config.remote.discord.enabled = true;
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const remote = testMessenger('discord', 'discord');
  const fabricated = 'fabricated-notice-failure';
  const failed = Promise.withResolvers<void>();
  const log: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { clock: new FakeClock(),
    syntheticRemoteSecrets: { 'discord.token': fabricated },
    gatewayMessenger: () => ({ ...remote, pairingReplaced: async () => { throw new Error(`send failed: ${fabricated}`); } }),
    log: entry => { log.push(entry); if (entry.event === 'remote-disabled') failed.resolve(); },
  });
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  for (const userId of ['12345', '23456']) {
    remote.pair({ userId, chatId: userId, guildId: '34567', name: 'Fixture human' });
    const row = ((await nvim.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
    const approved = await nvim.request({ type: 'pairing.approve', messenger: 'discord', code: row.code });
    assert.equal(approved.ok, true, approved.error);
  }
  await within(failed.promise, 2000, realClock, () => new Error('replacement failure receipt deadline reached'));
  assert.equal((await nvim.request({ type: 'hub.status' })).ok, true);
  assert.equal(JSON.stringify(log).includes(fabricated), false);
  await hub.stop();
  const store = new Store(join(root, '.cland', 'hub.db'));
  try {
    assert.deepEqual(store.remotes.forMessenger('discord').pairing(), { userId: '23456', chatId: '23456', guildId: '34567', name: 'Fixture human' });
    assert.deepEqual(store.remotes.forMessenger('discord').status(), { disabled: true, reason: 'send failed: [redacted]' });
  } finally { store.close(); }
});

test('a previous Remote shape without a replacement callback remains usable and reports the missing notice', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  const { pairingReplaced: _callback, pairingApproved: _approved, ...legacy } = remote;
  const log: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [legacy], clock: new FakeClock(), log: entry => { log.push(entry); } });
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  for (const userId of ['12345', '23456']) {
    remote.pair({ userId, chatId: userId, guildId: null, name: 'Fixture human' });
    const row = ((await nvim.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
    const approved = await nvim.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code });
    assert.equal(approved.ok, true, approved.error);
  }
  assert.equal(log.filter(entry => entry.event === 'remote-pairing-notice-unavailable' && entry.remote === 'telegram').length, 1);
  assert.equal((await remote.client.request({ type: 'hub.status' })).ok, true, 'missing optional support does not disable the old adapter');
});

for (const messenger of ['telegram', 'discord'] as const) test(`${messenger} approval persists numeric ids, clears its codes and tells the replaced chat once`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const remote = testMessenger(messenger, messenger);
  const other = testMessenger('other', messenger === 'telegram' ? 'discord' : 'telegram');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote, other], clock });
  const local = await connectUi(t, hub.discovery, 'nvim');
  const identity = { userId: '9007199254740993', chatId: '1234567890123456789', guildId: messenger === 'discord' ? '987654321098765432' : null, name: 'Same display name' };
  remote.pair(identity);
  remote.pair({ ...identity, userId: '2' });
  remote.pair({ ...identity, userId: '3' });
  other.pair({ ...identity, userId: '4' });
  const before = (await local.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(before.pairings!.length, 4);
  const code = before.pairings!.find(row => row.messenger === messenger && row.userId === identity.userId)!.code;
  const approved = await local.request({ type: 'pairing.approve', messenger, code, userId: '999', chatId: '999', name: 'Forged identity' });
  assert.equal(approved.ok, true, approved.error);
  assert.deepEqual(approved.value, { pairing: identity }, 'only the trusted stored numeric ids are bound');
  const after = (await local.request({ type: 'inbox.list' })).value as Inbox;
  assert.deepEqual(after.pairings, before.pairings!.filter(row => row.messenger !== messenger));
  assert.equal(after.needsYou, before.needsYou - 3, 'the immediately reread inbox does not replay waiting codes');
  assert.deepEqual(remote.replacements, [], 'the first pairing replaces nobody');
  assert.deepEqual(remote.approvals, [identity], 'optional notification receives the committed identity');
  // Equal names do not identify: a different numeric user/chat replaces this pairing.
  const nextIdentity = { ...identity, userId: '9007199254740995', chatId: '1234567890123456791' };
  remote.pair(nextIdentity);
  const next = (await local.request({ type: 'inbox.list' })).value as Inbox;
  const nextCode = next.pairings!.find(row => row.messenger === messenger)!.code;
  const replaced = await askHubFrame(hub.discovery, { type: 'pairing.approve', messenger, code: nextCode }, 2000, {});
  assert.deepEqual(replaced, { pairing: nextIdentity });
  assert.deepEqual(remote.replacements, [{ pairing: identity, text: 'This project is now paired with another chat.' }]);
  const repeated = await local.request({ type: 'pairing.approve', messenger, code: nextCode });
  assert.equal(repeated.ok, false, 'consumed codes cannot approve twice');
  assert.equal(remote.replacements.length, 1);
  assert.deepEqual(remote.approvals, [identity, nextIdentity]);
  assert.deepEqual(other.replacements, [], 'replacement is messenger-scoped');
  await hub.stop();
  const store = new Store(join(root, '.cland', 'hub.db'));
  try {
    assert.deepEqual(store.remotes.forMessenger(messenger).pairing(), nextIdentity);
    assert.deepEqual(store.remotes.forMessenger(messenger).requests(), []);
    assert.equal(store.remotes.forMessenger(messenger).replies(identity.userId), 1, 'approval does not reset stranger limits');
    assert.equal(store.remotes.forMessenger(other.via).requests().length, 1);
  } finally { store.close(); }
});

test('approval notification redacts a newly registered display-name secret but refuses numeric identity collisions', async t => {
  const { Gateway } = await import('../src/remote/gateway.ts');
  const { remoteRedactor } = await import('../src/remote/redact.ts');
  const { testRemoteStates } = await import('./fakes/messenger.ts');
  const root = await tempProject(t); const hub = await projectHub(t, root);
  const remote = testMessenger('discord', 'discord'); const state = testRemoteStates();
  const redactor = remoteRedactor();
  const gateway = new Gateway(hub.dispatcher, [remote], { state, redact: redactor });
  onCleanup(t, () => gateway.stop()); await gateway.start();
  const pairing = { userId: '90071992547409935', chatId: '90071992547409933', guildId: '90071992547409932', name: 'Fixture rotated credential' };
  redactor.register([pairing.name]);
  gateway.pairingApproved('discord', pairing);
  assert.deepEqual(remote.approvals, [{ ...pairing, name: '[redacted]' }]);
  assert.equal(state.forMessenger('discord').status().disabled, false);
  redactor.register([pairing.userId]); gateway.pairingApproved('discord', pairing);
  assert.equal(state.forMessenger('discord').status().disabled, true);
  assert.equal(remote.approvals.length, 1, 'numeric identity cannot be rewritten into another destination');
});
