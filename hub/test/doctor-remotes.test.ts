// T2: doctor output through local frames and sealed on-disk secrets; no platform credentials.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { doctor, initialised, toolchain } from './doctor-fixture.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { connectUi, projectHub } from './harness.ts';
import { testMessenger } from './fakes/messenger.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { access, chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Check } from '../src/doctor/report.ts';
import { until } from './harness.ts';
import { createHook } from 'node:async_hooks';
import { Socket } from 'node:net';
import { once } from 'node:events';
import { telegramLivenessFixture } from './telegram-liveness-fixture.ts';
import { control } from './telegram-polling-fixture.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { afterCleanup, guardDirectoryRemoval, onCleanup } from './process-cleanup.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';
import { setTimeout as nativeTimeout, clearTimeout as nativeClearTimeout } from 'node:timers';
import { performance } from 'node:perf_hooks';
import { realClock } from '../src/hub/clock.ts';
import { legacyRemoteHubFixture } from './fakes/legacy-remote-hub.ts';

const checks = (stdout: string): Check[] => (JSON.parse(stdout) as { checks: Check[] }).checks;
const named = (rows: Check[], name: string) => { const row = rows.find(row => row.name === name); assert.ok(row, name); return row; };

for (const source of ['file', 'environment'] as const) test(`doctor reports ${source} token fingerprint in text and JSON without its value`, async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const token = '123456:made_up_test_token_abcdefghijk';
  setSecret(root, 'telegram.token', source === 'file' ? token : '123456:another_made_up_token_abcdefghijk');
  const env = source === 'environment' ? { ...tools.env, CLAND_TELEGRAM_TOKEN: token } : tools.env;
  for (const args of [[], ['--json']]) {
    const result = await doctor(root, env, ...args);
    assert.match(result.stdout, /telegram token/);
    assert.match(result.stdout, /present \(6380e7f321ca\)/);
    assert.equal((result.stdout + result.stderr).includes(token), false);
    assert.equal((result.stdout + result.stderr).includes('123456:another_made_up_token_abcdefghijk'), false);
  }
});

test('doctor reports each messenger enabled state, live connection and exact paired name and id', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const config = defaultConfig('Doctor remotes');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const telegram = testMessenger('telegram');
  const discord = testMessenger('discord', 'discord');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [telegram, discord].map(remote => ({ ...remote,
    status: () => ({ connected: remote.via === 'telegram', lastInbound: null, lastOutbound: null, botLink: null }),
  })) });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  for (const remote of [telegram, discord]) {
    remote.pair({ userId: '123456789012345678', chatId: '234567890123456789', guildId: null, name: `${remote.via} human` });
    const inbox = (await ui.request({ type: 'inbox.list' })).value as import('../src/protocol.ts').Inbox;
    const row = inbox.pairings!.find(row => row.messenger === remote.via)!;
    assert.equal((await ui.request({ type: 'pairing.approve', messenger: remote.via, code: row.code })).ok, true);
  }
  const rows = checks((await doctor(root, tools.env, '--json')).stdout);
  assert.equal(named(rows, 'telegram enabled').detail, 'true');
  assert.equal(named(rows, 'discord enabled').detail, 'false');
  assert.equal(named(rows, 'telegram connection').detail, 'connected');
  assert.equal(named(rows, 'discord connection').detail, 'disconnected');
  for (const via of ['telegram', 'discord']) assert.equal(named(rows, `${via} pairing`).detail,
    `${via} human (123456789012345678); ${via === 'discord' ? 'channel' : 'chat'} 234567890123456789`);
});

test('doctor reports hub not running for both remotes without contacting a platform', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const rows = checks((await doctor(root, tools.env, '--json')).stdout);
  for (const via of ['telegram', 'discord']) {
    assert.equal(named(rows, `${via} enabled`).detail, 'false');
    assert.equal(named(rows, `${via} connection`).detail, 'hub not running');
    assert.equal(named(rows, `${via} connection`).fix, 'cland hub start');
  }
});

for (const [code, stopCause, cause, fix] of [
  [4004, 'token', 'wrong or revoked token (4004)', 'set a new token with cland secret set discord.token, then run cland hub reload'],
  [4014, 'message-content', 'Message Content toggle disabled (4014)', 'enable Message Content in the Discord application, then run cland hub reload'],
] as const) test(`doctor reports structured Discord ${code} stop with its recovery instruction`, async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const remote = testMessenger('discord', 'discord');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote] });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  remote.fail(Object.assign(new Error(`synthetic Discord close ${code}`), { stopCause }));
  await until(async () => {
    const result = await ui.request({ type: 'remote.status' });
    return (result.value as import('../src/protocol.ts').RemoteStatusResult).remotes[1]!.connection === 'disabled';
  }, { what: `persisted Discord ${code} stop`, timeoutMs: 1000 });
  const rows = checks((await doctor(root, tools.env, '--json')).stdout);
  assert.deepEqual(named(rows, 'discord stopped'), { name: 'discord stopped', verdict: 'warn', detail: cause, fix });
  const plain = await doctor(root, tools.env);
  assert.ok(plain.stdout.includes(cause));
  assert.ok(plain.stdout.includes(fix));
  const status = await ui.request({ type: 'remote.status' });
  assert.equal((status.value as import('../src/protocol.ts').RemoteStatusResult).remotes[1]!.stopCause, stopCause);
});

test('doctor opens no network connection or platform request with an active Telegram remote', async t => {
  const f = await telegramLivenessFixture(t);
  const tools = await toolchain(t);
  const polling = f.fake.waitForPoll();
  const { hub } = await f.start();
  const poll = await within(polling, 1000);
  const connections: string[] = [];
  const hook = createHook({ init(_id, type) {
    if (['TCPCONNECTWRAP', 'TLSWRAP', 'GETADDRINFOREQWRAP'].includes(type)) connections.push(type);
  } });
  t.after(() => hook.disable());
  const socket = new Socket();
  const closed = once(socket, 'close');
  onCleanup(t, async () => { socket.destroy(); await within(closed, 1000); });
  const connected = once(socket, 'connect');
  hook.enable();
  socket.connect(Number(new URL(f.fake.url).port), '127.0.0.1');
  await within(connected, 1000);
  hook.disable();
  socket.destroy();
  await within(closed, 1000);
  assert.ok(connections.includes('TCPCONNECTWRAP'), 'positive control observes a real loopback TCP connection');
  connections.length = 0;
  const before = await control<{ requests: unknown[] }>(f.fake.url, 'state');
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('doctor attempted network fetch'); });
  let outputs: string[];
  hook.enable();
  try { outputs = [(await doctor(f.root, tools.env)).stdout, (await doctor(f.root, tools.env, '--json')).stdout]; }
  finally { hook.disable(); fetch.mock.restore(); }
  assert.deepEqual(connections, [], 'doctor uses only the local Unix socket');
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(named(checks(outputs[1]!), 'telegram connection').detail, 'connected');
  assert.match(outputs[0]!, /telegram connection\s+connected/);
  const after = await control<{ requests: unknown[] }>(f.fake.url, 'state');
  assert.deepEqual(after.requests, before.requests, 'no platform request during doctor');
  const pollClosed = f.fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(pollClosed, 1000), poll.id);
});

test('doctor reads the previous remote status wire shape without assuming a stop cause', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const old = await legacyRemoteHubFixture(t, root, { legacyStatus: true }).start();
  const rows = checks((await doctor(root, tools.env, '--json')).stdout);
  assert.equal(named(rows, 'telegram connection').detail, 'disabled');
  assert.equal(named(rows, 'telegram pairing').detail, 'Old hub human (12345); chat 23456');
  assert.equal(named(rows, 'telegram stopped').detail, 'legacy sanitized stop reason');
  assert.equal(named(rows, 'telegram stopped').verdict, 'warn');
  assert.ok(old.requests.includes('remote.status'));
  assert.equal(old.requests.includes('remote.test'), false);
});

test('doctor reports unavailable local status when the old hub refuses remote status', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await legacyRemoteHubFixture(t, root).start();
  const rows = checks((await doctor(root, tools.env, '--json')).stdout);
  assert.equal(named(rows, 'telegram connection').detail, 'local remote status unavailable');
  assert.equal(named(rows, 'telegram connection').verdict, 'warn');
});


test('doctor reports speech key presence and fingerprint without a provider request or key value', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const config = defaultConfig('Active speech doctor');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const api = await fakeSpeech(t);
  const env = { ...tools.env, CLAND_ELEVENLABS_API_ROOT: api.url };
  const key = 'made_up_doctor_speech_key';
  setSecret(root, 'speech.elevenlabs_key', key);
  const present = await doctor(root, env, '--json');
  const rows = checks(present.stdout);
  assert.deepEqual(named(rows, 'speech provider'), { name: 'speech provider', verdict: 'ok', detail: 'elevenlabs' });
  assert.deepEqual(named(rows, 'speech elevenlabs key'), { name: 'speech elevenlabs key', verdict: 'ok', detail: 'present (d7d075072edc)' });
  assert.equal((present.stdout + present.stderr).includes(key), false);
  await writeFile(join(root, '.cland/secrets.toml'), '');
  const absent = await doctor(root, env, '--json');
  assert.deepEqual(named(checks(absent.stdout), 'speech elevenlabs key'), {
    name: 'speech elevenlabs key', verdict: 'warn', detail: 'absent', fix: 'cland secret set speech.elevenlabs_key',
  });
  assert.deepEqual(api.requests, []);
});


test('doctor resolves speech command on PATH without executing and warns for missing or empty argv', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const executable = join(root, 'speech-probe');
  const marker = join(root, 'command-ran');
  await writeFile(executable, `#!/bin/sh\nprintf ran > "${marker}"\n`);
  await chmod(executable, 0o700);
  const config = defaultConfig('Speech doctor');
  config.speech.provider = 'command';
  config.remote.telegram.enabled = true;
  const env = { ...tools.env, PATH: `${root}:${tools.env.PATH}` };
  for (const [argv, verdict, detail] of [
    [['speech-probe'], 'ok', executable],
    [['missing-speech-probe'], 'warn', 'argv[0] not found: missing-speech-probe'],
    [[], 'warn', 'empty command'],
  ] as const) {
    config.speech.command = [...argv];
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    const rows = checks((await doctor(root, env, '--json')).stdout);
    assert.equal(named(rows, 'speech provider').detail, 'command');
    const command = named(rows, 'speech command');
    assert.equal(command.verdict, verdict);
    assert.equal(command.detail, detail);
    if (verdict === 'warn') assert.equal(command.fix, 'edit [speech] command in .cland/config.toml');
    assert.equal(rows.some(row => row.name === 'speech elevenlabs key'), false);
  }
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  config.speech.provider = '';
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const off = checks((await doctor(root, env, '--json')).stdout);
  assert.equal(named(off, 'speech provider').detail, 'transcription off');
  assert.equal(off.some(row => row.name === 'speech command'), false);
});


test('doctor keeps unused speech healthy without remotes and reports transcription off', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const config = defaultConfig('Unused speech doctor');
  for (const provider of ['elevenlabs', 'command', ''] as const) {
    config.speech.provider = provider;
    config.speech.command = ['missing-unused-command'];
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    const result = await doctor(root, tools.env, '--json');
    const rows = checks(result.stdout);
    assert.deepEqual(named(rows, 'speech provider'), { name: 'speech provider', verdict: 'ok',
      detail: provider ? 'speech unused until a remote is set up' : 'transcription off' });
    assert.equal(rows.some(row => row.name === 'speech elevenlabs key' || row.name === 'speech command'), false);
    const plain = await doctor(root, tools.env);
    assert.ok(plain.stdout.includes(provider ? 'speech unused until a remote is set up' : 'transcription off'));
  }
});

for (const [code, cause, fix] of [[4004, 'wrong or revoked token (4004)', /new token/], [4014, 'Message Content toggle disabled (4014)', /enable Message Content/]] as const)
test(`native Discord ${code} reaches doctor without platform I/O and includes numeric pairing identity`, async t => {
  const { discordHubFixtureOwner } = await import('./fakes/discord/hub.ts');
  const { DISCORD_IDS: ids } = await import('./fakes/discord/fake-api.ts');
  const f = await discordHubFixtureOwner(t).start();
  const tools = await toolchain(t);
  await f.fake.control('close', { code });
  await until(async () => (await f.status()).connection === 'disabled', { what: 'native fatal close settled', timeoutMs: 2000 });
  const before = (await f.fake.control('state')).requests;
  const plain = await doctor(f.root, tools.env);
  const rows = checks((await doctor(f.root, tools.env, '--json')).stdout);
  assert.equal(named(rows, 'discord stopped').detail, cause);
  assert.match(named(rows, 'discord stopped').fix!, fix);
  assert.ok(plain.stdout.includes(cause));
  assert.match(plain.stdout, fix);
  assert.equal(named(rows, 'discord pairing').detail, `Fixture human (${ids.human}); channel ${ids.channel}; guild ${ids.guild}`);
  assert.deepEqual((await f.fake.control('state')).requests, before, 'doctor makes no Discord request');
});

for (const failure of ['omitted', 'aborted'] as const)
test(`Discord workbench fixture drains ${failure} setup before Store and root removal`, async t => {
  const { discordWorkbench } = await import('./discord-workbench-fixture.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const { access } = await import('node:fs/promises');
  const f = await discordWorkbench(t);
  const project = await f.project();
  await f.prepare(project.root);
  const setupClock = new FakeClock(), abort = new AbortController();
  const starting = f.startHub(project.root, f.env, {}, { receipt: new Promise<void>(() => {}), clock: setupClock, signal: abort.signal });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /cancelled/);
  const hub = await within(f.startup.serving, 2000);
  await until(async () => (await f.fake.control('state')).gateway.identifies === 1, { what: 'native startup Identify', timeoutMs: 2000 });
  if (failure === 'omitted') await setupClock.advance(1000);
  else abort.abort(new Error('setup cancelled'));
  await rejected;
  await f.startup.dispose();
  await hub.stopped;
  assert.equal(f.exchange.receipts().closed, true);
  assert.equal(f.exchange.receipts().connections, 0);
  assert.equal(f.exchange.receipts().handlers, 0);
  assert.equal(f.exchange.pending(), 0);
  assert.equal(f.startup.observations(), 0);
  assert.equal(f.clock.pending, 0);
  assert.equal(setupClock.pending, 0);
  assert.throws(() => f.store.remotes.forMessenger('discord').get('discord.session'), /closed|not open/i);
  await project.remove();
  await assert.rejects(access(project.root), { code: 'ENOENT' });
});

// Observation deadlines and exceptional drainage stay native while product time is mocked.
const observationClock = { ...realClock, now: () => new Date(performance.timeOrigin + performance.now()),
  setTimeout: (fn: () => void, ms: number) => nativeTimeout(fn, ms),
  clearTimeout: (timer: import('../src/hub/clock.ts').ClockTimer | null | undefined) => { if (timer) nativeClearTimeout(timer as NodeJS.Timeout); } };
const readinessReceipt = (predicate: () => boolean, what: string) => until(predicate,
  { what, timeoutMs: 1000, loadFactor: 1, clock: observationClock });

function doctorReadinessOwner(t: import('node:test').TestContext) {
  let work: ReturnType<typeof doctor> | undefined;
  let joined = true, mocked = false;
  let release = () => {};
  let socketsClosed = () => true;
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= (async () => {
    release();
    // Keep fake Date and its native socket owners alive until the operation settles.
    await readinessReceipt(() => {
      if (!joined && mocked) t.mock.timers.tick(50);
      return joined;
    }, 'doctor operation drainage');
    await work;
    await readinessReceipt(socketsClosed, 'doctor native sockets closed');
    if (mocked) { t.mock.timers.reset(); mocked = false; }
  })();
  onCleanup(t, dispose);
  return { dispose, joined: () => joined,
    start(root: string, env: Record<string, string>, makeReady: () => void, closed: () => boolean) {
      release = makeReady;
      socketsClosed = closed;
      guardDirectoryRemoval(root, dispose);
      t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
      mocked = true;
      joined = false;
      work = doctor(root, env, '--json');
      void work.then(() => { joined = true; }, () => { joined = true; });
      return work;
    },
  };
}

for (const messenger of ['telegram', 'discord'] as const) for (const recovers of [true, false]) {
  test(`doctor waits for ${messenger} readiness (recovers=${recovers})`, { timeout: 5000 }, async t => {
    const owner = doctorReadinessOwner(t);
    const tools = await toolchain(t);
    const root = await initialised(t, tools.env);
    const config = defaultConfig('doctor readiness');
    config.remote[messenger].enabled = true;
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    let reads = 0;
    let connected = false;
    const old = legacyRemoteHubFixture(t, root, { remoteStatus: () => {
      reads++;
      return { remotes: [{ messenger, token: { present: true, fingerprint: 'fixture' }, pairing: null,
        connection: connected ? 'connected' : 'disconnected', reason: null, lastInbound: null,
        lastOutbound: null, outboxDepth: 0, mute: false, botLink: null }] };
    } });
    await old.start();
    let settled = false;
    const work = owner.start(root, tools.env, () => { connected = true; }, () => old.receipts().peers === 0);
    void work.then(() => { settled = true; }, () => { settled = true; });
    await readinessReceipt(() => reads === 1 && old.receipts().peers === 0, 'initial doctor status closed');
    for (let tick = 0; tick < 198; tick++) {
      t.mock.timers.tick(50);
      await readinessReceipt(() => settled || reads === tick + 2 && old.receipts().peers === 0, 'doctor readiness read closed');
      assert.equal(settled, false, 'transient doctor status must remain pending');
    }
    assert.equal(settled, false);
    connected = recovers;
    t.mock.timers.tick(50);
    if (!recovers) {
      await readinessReceipt(() => reads === 200 && old.receipts().peers === 0, 'last doctor read closed');
      t.mock.timers.tick(50);
    }
    const result = await work;
    const row = named(checks(result.stdout), `${messenger} connection`);
    assert.equal(row.detail, recovers ? 'connected' : 'disconnected');
    assert.equal(row.verdict, recovers ? 'ok' : 'warn');
    assert.ok(reads > 1 && reads <= 201);
    assert.equal(old.receipts().writers, 0);
  });
}

for (const failure of ['omitted', 'aborted'] as const) test(`doctor readiness drains ${failure} observation before removing root`, { timeout: 5000 }, async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const config = defaultConfig('abandoned doctor');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const owner = doctorReadinessOwner(t);
  let reads = 0, connected = false;
  const old = legacyRemoteHubFixture(t, root, { remoteStatus: () => {
    reads++;
    return { remotes: [{ messenger: 'telegram', token: { present: true, fingerprint: 'fixture' }, pairing: null,
      connection: connected ? 'connected' : 'disconnected', reason: null, lastInbound: null,
      lastOutbound: null, outboxDepth: 0, mute: false, botLink: null }] };
  } });
  await old.start();
  const work = owner.start(root, tools.env, () => { connected = true; }, () => old.receipts().peers === 0);
  await readinessReceipt(() => reads === 1 && old.receipts().peers === 0, 'native initial status closed');
  assert.equal(owner.joined(), false);
  if (failure === 'aborted') {
    const abort = new AbortController();
    const observation = abortable(work, abort.signal);
    const rejected = assert.rejects(observation, /observation cancelled/);
    abort.abort(new Error('observation cancelled'));
    await rejected;
    assert.equal(owner.joined(), false, 'observer abort does not relinquish native work');
  }
  // No result await: exercise the actual shared cleanup lanes after the case returns.
  onCleanup(t, async () => {
    assert.equal(owner.joined(), true, 'doctor operation joined before resource/root cleanup');
    assert.equal(old.receipts().peers, 0, 'native request socket closed before root removal');
    await access(root);
  });
  afterCleanup(t, async () => {
    assert.equal(owner.joined(), true);
    assert.equal(old.receipts().closed, true);
    assert.equal(old.receipts().peers, 0);
    assert.equal(old.receipts().writers, 0);
    await assert.rejects(access(root), { code: 'ENOENT' });
  });
});
