// T3: a real hub process is SIGKILLed with an unconfirmed update; restart recovers it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { nativePollerProcesses } from '../src/remote/poller-lease.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { connectUi, startDaemon, killDaemon, tempProject, until } from './harness.ts';
import type { TopicMessage } from '../src/protocol.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { pairing, control } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { recordedProcess } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';

test('SIGKILL mid-update leaves the Telegram offset unconfirmed and restart handles it once', async t => {
  const owner = pacingOwner(t);
  let nativePid: number | undefined;
  owner.close(async () => { if (nativePid !== undefined) await killDaemon(nativePid); });
  const root = await tempProject(t);
  const fake = await fakeTelegram(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram crash fixture');
  config.remote.telegram.enabled = true;
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const db = join(root, '.cland/hub.db');
  const seed = new Store(db);
  seed.remotes.forMessenger('telegram').setPairing(pairing);
  seed.close();
  const initialPoll = owner.observe(signal => fake.waitForPoll(signal));
  const first = await startDaemon(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url });
  nativePid = first.discovery.pid;
  const processes = nativePollerProcesses(fixtureEnvironment(root, process.env));
  const captured = recordedProcess(first.discovery.pid);
  assert.ok(captured?.identity, 'cleanup captured the native birth before signalling');
  const live = await processes.inspect(first.discovery.pid);
  assert.equal(live.alive, true, 'positive control: native inspection retains the live writer');
  assert.equal(live.identity, captured.identity, 'the inspected writer is the owned incarnation');
  assert.equal((await within(initialPoll, 2_000)).params.offset, undefined);
  // The production text handler awaits feedback after its durable human commit.
  // Hold that native exchange, rather than relying on unmatched input to stall.
  await control(fake.url, 'fault', { method: 'setMessageReaction', code: 503, response: 'hold' });
  const interrupted = owner.observe(signal => fake.waitForHeldRequest('setMessageReaction', signal));
  await control(fake.url, 'say', { text: 'recover after real kill' });
  const held = await within(interrupted, 3_000);
  const before = new Store(db);
  let original: TopicMessage;
  try {
    const messages = before.topicMessages('general', 200).filter(message => message.text === 'recover after real kill');
    assert.equal(messages.length, 1, 'the accepted handler committed its human message before feedback');
    original = messages[0]!;
    assert.equal(original.via, 'telegram');
    assert.equal(before.remotes.forMessenger('telegram').get('telegram.offset'), null,
      'the held feedback pins the handler before offset confirmation at the kill');
  } finally { before.close(); }
  const feedbackClosed = owner.observe(signal => fake.waitForConnectionClose('setMessageReaction', signal), { drain: true });
  await killDaemon(first.discovery.pid);
  const exited = await processes.inspect(first.discovery.pid);
  assert.deepEqual(exited, { alive: false, started: null, identity: null },
    'owned native incarnation and writers have exited before reopening; parent reaping is separate');
  assert.equal((await within(feedbackClosed, 1_000)).id, held.id);
  const killed = new Store(db);
  let resumedAt: number;
  try {
    const lastAttempt = killed.remotes.forMessenger('telegram').get('telegram.outbox.last:101');
    assert.ok(lastAttempt, 'held feedback persisted its native attempt time');
    resumedAt = Number(lastAttempt) + 1_000;
    assert.ok(Number.isFinite(resumedAt));
    assert.equal(killed.remotes.forMessenger('telegram').get('telegram.offset'), null,
    'SIGKILL left the accepted update unconfirmed');
  }
  finally { killed.close(); }

  // Continue after the persisted native pacing boundary, never back in October 16.
  const clock = new FakeClock(resumedAt);
  const recoveredPoll = owner.observe(signal => fake.waitForPoll(signal));
  // Keep real process facts for the stale lease; no synthetic dead-PID claim.
  const second = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock,
    { hubOptions: { gatewayProcesses: processes } });
  const receipt = await within(recoveredPoll, 2_000, undefined,
    () => new Error('restart has no confirmed Telegram poll receipt'));
  assert.equal(receipt.params.offset, 2);
  const recovered = new Store(db);
  try { assert.equal(recovered.remotes.forMessenger('telegram').get('telegram.offset'), '2'); }
  finally { recovered.close(); }
  const secondUi = await connectUi(t, second.discovery, 'nvim');
  const history = await secondUi.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.text === 'recover after real kill');
  assert.equal(messages.length, 1, 'replay must not duplicate the committed human effect');
  assert.equal(messages[0]!.id, original.id, 'restart returns the original durable message');
  const closed = owner.observe(signal => fake.waitForPollClose(receipt.id, signal), { drain: true });
  await second.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
  await owner.dispose();
  assert.equal(owner.observations(), 0);
  assert.equal(clock.pending, 0);
});

test('SIGKILL after Telegram human commit before adapter receipt replays the durable message once', async t => {
  const owner = pacingOwner(t);
  let nativePid: number | undefined;
  owner.close(async () => { if (nativePid !== undefined) await killDaemon(nativePid); });
  const root = await tempProject(t);
  const fake = await fakeTelegram(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram committed-input crash fixture');
  config.remote.telegram.enabled = true;
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const db = join(root, '.cland/hub.db');
  const seed = new Store(db);
  try { seed.remotes.forMessenger('telegram').setPairing(pairing); }
  finally { seed.close(); }
  const polled = owner.observe(signal => fake.waitForPoll(signal));
  const first = await startDaemon(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url,
    CLAND_TEST_CRASH_AT: 'telegram-input-committed' });
  nativePid = first.discovery.pid;
  const poll = await within(polled, 2_000);
  const processes = nativePollerProcesses(fixtureEnvironment(root, process.env));
  const captured = recordedProcess(first.discovery.pid);
  assert.ok(captured?.identity, 'the fixture owns this native incarnation');
  const live = await processes.inspect(first.discovery.pid);
  assert.equal(live.alive, true);
  assert.equal(live.identity, captured.identity, 'positive native writer control before triggering the crash');
  const pollClosed = owner.observe(signal => fake.waitForPollClose(poll.id, signal), { drain: true });
  const exited = until(async () => !(await processes.inspect(first.discovery.pid)).alive,
    { what: 'native SIGKILL after committed Telegram input', timeoutMs: 3_000 });
  void exited.catch(() => {});
  await control(fake.url, 'say', { text: 'Committed before native crash' });
  try { await exited; }
  catch (error) {
    const facts = await processes.inspect(first.discovery.pid);
    const tail = await readFile(join(root, '.cland/log/hub.log'), 'utf8').catch(() => 'hub log unavailable');
    t.diagnostic(`incomplete native SIGKILL receipt: exit/signal unobserved; process ${JSON.stringify(facts)}; bounded hub tail: ${tail.slice(-2_048)}`);
    throw error;
  }
  assert.deepEqual(await processes.inspect(first.discovery.pid), { alive: false, started: null, identity: null });
  await killDaemon(first.discovery.pid); // Join captured ownership/descendants before reopening writers.
  assert.equal(await within(pollClosed, 1_000), poll.id);
  const before = new Store(db);
  let original: TopicMessage;
  try {
    const messages = before.topicMessages('general', 200).filter(message => message.text === 'Committed before native crash');
    assert.equal(messages.length, 1, 'human effect is durable at the SIGKILL boundary');
    original = messages[0]!;
    assert.equal(original.via, 'telegram');
    assert.equal(before.remotes.forMessenger('telegram').get(`telegram.inbound:${original.id}`), null,
      'the adapter never received/stored its frame result');
    assert.equal(before.remotes.forMessenger('telegram').get('telegram.offset'), null);
  } finally { before.close(); }
  const recovered = owner.observe(signal => fake.waitForPoll(signal));
  const second = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, new FakeClock(),
    { hubOptions: { gatewayProcesses: processes } });
  const receipt = await within(recovered, 2_000);
  assert.equal(receipt.params.offset, 2);
  const ui = await connectUi(t, second.discovery, 'nvim');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.text === 'Committed before native crash');
  assert.equal(messages.length, 1, 'native crash/replay must not duplicate the human effect');
  assert.equal(messages[0]!.id, original.id);
  const closed = owner.observe(signal => fake.waitForPollClose(receipt.id, signal), { drain: true });
  await second.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
});

for (const failure of ['omitted', 'aborted'] as const) test(`Telegram restart observation owner drains after ${failure} setup receipt`, async t => {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const fake = await fakeTelegram(t);
  owner.close(() => fake.close(), { startupOnly: true });
  const clock = new FakeClock();
  const setupClock = new FakeClock();
  const abort = new AbortController();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram restart setup control');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = owner.store(join(root, '.cland/hub.db'));
  store.remotes.forMessenger('telegram').setPairing(pairing);
  // Unfulfilled observers use the same cancellation/join owner as the crash case.
  const poll = owner.observe(signal => fake.waitForPoll(signal));
  const cancelled = assert.rejects(poll, /observation aborted/);
  await control(fake.url, 'fault', { method: 'setMessageReaction', code: 503, response: 'hold' });
  const held = owner.observe(signal => fake.waitForHeldRequest('setMessageReaction', signal));
  const closed = owner.observe(signal => fake.waitForConnectionClose('setMessageReaction', signal), { drain: true });
  await control(fake.url, 'say', { text: 'setup control' });
  const starting = owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock, {
    receipt: new Promise<void>(() => {}), clock: setupClock, signal: abort.signal,
  });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /setup cancelled/);
  const hub = await within(owner.serving, 1_000);
  const receipt = await within(held, 1_000);
  assert.equal(store.remotes.forMessenger('telegram').get('telegram.offset'), null);
  if (failure === 'omitted') await setupClock.advance(1_000);
  else abort.abort(new Error('Telegram pacing fixture setup cancelled'));
  await rejected;
  await owner.dispose();
  await cancelled;
  await hub.stopped;
  assert.equal((await within(closed, 1_000)).id, receipt.id);
  assert.equal(owner.observations(), 0);
  assert.throws(() => store.remotes.forMessenger('telegram').get('telegram.offset'), /not open|closed/i);
  assert.equal(clock.pending, 0);
  assert.equal(setupClock.pending, 0);
});
