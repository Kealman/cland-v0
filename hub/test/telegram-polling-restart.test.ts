// T3: a real hub process is SIGKILLed with an unconfirmed Telegram update or mid Discord history catch-up; restart recovers it.
import { discordCardsFixture as fixture, discordHistorySeed as historySeed } from './discord-cards-fixture.ts';
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
import { abortable, within } from '../src/executor/droplet/deadline.ts';

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

async function discordHistoryCrashOwner(t: import('node:test').TestContext) {
  const { discordExchangeOwner } = await import('./fakes/discord/exchange.ts');
  const lifetime = pacingOwner(t);
  const exchange = await discordExchangeOwner(t).start();
  exchange.stop(() => lifetime.dispose());
  const { root } = await exchange.project();
  let acquiring: ReturnType<typeof startDaemon> | undefined;
  let native: Awaited<ReturnType<typeof startDaemon>> | undefined;
  lifetime.close(async () => {
    await acquiring?.catch(() => {});
    if (native) await killDaemon(native.discovery.pid);
  });
  return {
    ...exchange, root, lifetime,
    native: () => native,
    startNative: (extra: Record<string, string>, setup: { receipt?: Promise<void>; signal?: AbortSignal; timeoutMs?: number; clock?: import('../src/hub/clock.ts').Clock } = {}) => {
      const ready = Promise.withResolvers<Awaited<ReturnType<typeof startDaemon>>>();
      const observed = lifetime.observe(signal => within(abortable(ready.promise,
        AbortSignal.any([signal, ...(setup.signal ? [setup.signal] : [])])), setup.timeoutMs ?? 10000, setup.clock, () => new Error('Discord native setup receipt deadline')));
      acquiring = startDaemon(t, root, extra);
      void acquiring.then(async hub => {
        native = hub;
        await lifetime.observe(signal => abortable(setup.receipt ?? Promise.resolve(), AbortSignal.any([signal, ...(setup.signal ? [setup.signal] : [])])));
        ready.resolve(hub);
      }, ready.reject).catch(ready.reject);
      return observed.catch(async error => { await exchange.close(); throw error; });
    },
    waitForExit: (inspect: () => Promise<{ alive: boolean }>) => lifetime.observe(async signal => {
      const { setImmediate: yieldIO } = await import('node:timers/promises');
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      for (;;) {
        bounded.throwIfAborted();
        const facts = await inspect();
        if (!facts.alive) return facts;
        await yieldIO(undefined, { signal: bounded });
      }
    }),
  };
}

test('SIGKILL mid Discord history preserves the committed input and finishes the batch once', async t => {
  const { DISCORD_TEST_TOKEN, DISCORD_IDS: ids } = await import('./fakes/discord/fake-api.ts');
  const owner = await discordHistoryCrashOwner(t);
  const { root } = owner;
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Discord history kill fixture');
  config.remote.discord.enabled = true;
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'discord.token', DISCORD_TEST_TOKEN);
  const db = join(root, '.cland/hub.db');
  const seed = owner.lifetime.store(db);
  const state = seed.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const cursor = await owner.fake.control('say', { content: 'Before crash history' });
  state.set('discord.lastMessageId', cursor.id);
  const first = await owner.startNative({ CLAND_DISCORD_API_ROOT: owner.fake.url, CLAND_TEST_CRASH_AT: 'discord-input-committed' });
  const pid = first.discovery.pid;
  const processes = nativePollerProcesses(fixtureEnvironment(root, process.env));
  const captured = recordedProcess(pid);
  assert.ok(captured?.identity);
  const live = await processes.inspect(pid);
  assert.equal(live.alive, true);
  assert.equal(live.identity, captured.identity);
  await until(async () => (await owner.fake.control('state')).gateway.identifies === 1, { what: 'initial native READY', timeoutMs: 2000 });
  await owner.fake.control('say', { contents: ['Killed history first', 'Killed history second'] });
  // The first Identify had no missing history. A session-invalidating 4003 now
  // exercises a fresh Identify and history, respecting the native five-second budget.
  const exited = owner.waitForExit(() => processes.inspect(first.discovery.pid));
  void exited.catch(() => {});
  await owner.fake.control('close', { code: 4003 });
  await exited;
  await killDaemon(first.discovery.pid);
  assert.deepEqual(await processes.inspect(first.discovery.pid), { alive: false, started: null, identity: null });
  const checkpoint = new Store(db);
  let original: TopicMessage;
  try {
    const rows = checkpoint.topicMessages('general', 100).filter(m => m.text.startsWith('Killed history'));
    assert.equal(rows.length, 1);
    original = rows[0]!;
    assert.equal(original.via, 'discord');
    assert.ok(checkpoint.remotes.forMessenger('discord').get('discord.history'));
    assert.equal(checkpoint.remotes.forMessenger('discord').get('discord.lastMessageId'), cursor.id);
  } finally { checkpoint.close(); }
  const second = await owner.lifetime.start(root, { CLAND_DISCORD_API_ROOT: owner.fake.url }, (await import('../src/hub/clock.ts')).realClock, { hubOptions: { gatewayProcesses: processes } });
  const ui = await connectUi(t, second.discovery, 'nvim');
  let rows: TopicMessage[] = [];
  await until(async () => {
    rows = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.filter(m => m.text.startsWith('Killed history'));
    return rows.length === 2;
  }, { what: 'both durable history inputs after native kill', timeoutMs: 10000 });
  assert.deepEqual(rows.map(m => m.text.split('\n')[0]), ['Killed history first', 'Killed history second']);
  assert.equal(rows[0]!.id, original.id);
  await second.stop();
});

for (const failure of ['omitted', 'aborted'] as const) test(`Discord native history setup ${failure} drains its Store writers and observations`, async t => {
  const owner = await discordHistoryCrashOwner(t);
  const { DISCORD_TEST_TOKEN } = await import('./fakes/discord/fake-api.ts');
  await mkdir(join(owner.root, '.cland'), { recursive: true });
  const config = defaultConfig('Discord native setup control'); config.remote.discord.enabled = true;
  config.verification.lockPath = join(owner.root, 'suite.lock');
  await writeFile(join(owner.root, '.cland/config.toml'), renderConfig(config));
  setSecret(owner.root, 'discord.token', DISCORD_TEST_TOKEN);
  const store = owner.lifetime.store(join(owner.root, '.cland/hub.db'));
  const clock = new FakeClock();
  const abort = new AbortController();
  const unmatched = owner.waitForExit(async () => ({ alive: true }));
  const cancelled = assert.rejects(unmatched, /abort|cancel/i);
  const starting = owner.startNative({ CLAND_DISCORD_API_ROOT: owner.fake.url }, { receipt: new Promise<void>(() => {}), signal: abort.signal, clock, timeoutMs: 1000 });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /abort/i);
  await until(() => !!owner.native(), { what: 'owned native acquisition before losing setup receipt', timeoutMs: 2000 });
  const native = owner.native()!;
  const processes = nativePollerProcesses(fixtureEnvironment(owner.root, process.env));
  assert.equal((await processes.inspect(native.discovery.pid)).alive, true);
  if (failure === 'omitted') await clock.advance(1000); else abort.abort();
  await rejected;
  await cancelled;
  assert.deepEqual(await processes.inspect(native.discovery.pid), { alive: false, started: null, identity: null });
  assert.throws(() => store.remotes.forMessenger('discord').get('discord.history'), /not open|closed/i);
  assert.equal(owner.lifetime.observations(), 0);
  assert.equal(owner.pending(), 0);
  assert.equal(owner.fake.receipts().closed, true);
  assert.equal(clock.pending, 0);
});

test('Discord fresh history forwards newest 500 of 620 once with one silent overflow line', async t => {
  const f = await fixture(t);
  const seed = await historySeed(f);
  await f.fake.control('configure', { reactionWindow: 0 });
  const started = performance.now();
  const hub = await f.restart(180000, async () => {
    f.state.set('discord.session', null);
    await f.fake.control('say', { contents: Array.from({ length: 620 }, (_, n) => `Outage ${n}`) });
  });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await until(() => f.frames.filter(r => r.frame.type === 'topic.send').length >= 20, { what: 'active history catch-up', timeoutMs: 3000 });
  assert.ok(f.state.get('discord.history'));
  const responsive = performance.now();
  assert.equal((await within(ui.request({ type: 'topic.send', topic: 'general', kind: 'message', text: 'Responsive during history' }), 500)).ok, true);
  t.diagnostic(`topic.send during catch-up: ${(performance.now() - responsive).toFixed(1)} ms`);
  assert.ok(f.state.get('discord.history'), 'responsiveness measured before history completion');
  await until(async () => {
    return f.state.outbox().some(j => j.source?.startsWith('discord.history-overflow:') && j.state === 'sent');
  }, { what: '500 inputs and overflow settlement', timeoutMs: 45000, loadFactor: 1 }).catch(error => { t.diagnostic(JSON.stringify({ inputCount: f.frames.filter(r => r.frame.type === 'topic.send').length, jobs: f.state.outbox().reduce((a, j) => { a[j.state] = (a[j.state] ?? 0) + 1; return a; }, {} as Record<string, number>) })); throw error; });
  t.diagnostic(`restart and 500-input completion: ${(performance.now() - started).toFixed(1)} ms (${process.platform}/local; injected pacing excluded)`);
  const durable: Array<{ text: string; seq: number }> = [];
  let after = 0;
  for (;;) {
    const page = ((await ui.request({ type: 'topic.history', topic: 'general', after, limit: 200 })).value as { messages: Array<{ text: string; seq: number }> }).messages;
    if (!page.length) break;
    durable.push(...page); after = page.at(-1)!.seq;
  }
  const messages = durable.filter(m => m.text.startsWith('Outage')).map(m => m.text.split('\n')[0]);
  assert.deepEqual(messages, Array.from({ length: 500 }, (_, i) => `Outage ${i + 120}`));
  const native = await f.fake.control('state');
  assert.equal(native.messages.filter(m => m.content === 'Older Discord messages were not passed on.').length, 1);
  assert.ok((native.requests.find(r => r.method === 'POST' && r.body.content === 'Older Discord messages were not passed on.')!.body.flags as number) & 4096);
  assert.ok(BigInt(seed.id) > 2n ** 53n);
  assert.equal(typeof f.state.get('discord.lastMessageId'), 'string');
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
});
