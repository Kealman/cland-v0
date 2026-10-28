// T2: production frames and loopback Discord REST/ws.
import { discordExchangeOwner } from './fakes/discord/exchange.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, connectUi, inProcessSpoke, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { fakeDiscordFixture, DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { onCleanup, beforeDirectories } from './process-cleanup.ts';

test('Discord General mirror has enforced nonce and atomic native mapping', async t => {
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  const config = defaultConfig('Message fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Hello channel @everyone', kind: 'report' })).ok, true);
  await until(async () => (await fake.control('state')).messages.some(m => m.content.includes('Hello channel')), { timeoutMs: 1500, what: 'General mirror receipt' });
  const native = (await fake.control('state')).messages.find(m => m.content.includes('Hello channel'))!;
  assert.equal(native.content, 'coord · report\nHello channel @everyone');
  const request = (await fake.control('state')).requests.find(r => r.method === 'POST' && r.path.includes('/messages'))!;
  assert.equal(request.body.enforce_nonce, true); assert.equal(request.body.flags, 4);
  assert.deepEqual(request.body.allowed_mentions, { parse: [] }); assert.ok(String(request.body.nonce).length <= 25);
  await until(() => state.outbox().some(j => j.state === 'sent'), { timeoutMs: 1500, what: 'durable send settlement' });
  assert.equal(state.message(ids.channel, native.id)?.topic, 'general');
  assert.equal(state.attempts(state.outbox()[0]!.id).length, 1);
  await hub.stop();
});

test('Discord accepts paired ordinary/reply text once, excludes other authors, and mirrors to Telegram', async t => {
  const { fakeTelegram, TELEGRAM_TEST_TOKEN } = await import('./fakes/telegram/fake-api.ts');
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t); const telegram = await fakeTelegram(t);
  const config = defaultConfig('Inbound fixture'); config.remote.discord.enabled = true; config.remote.telegram.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url, CLAND_TELEGRAM_API_ROOT: telegram.url },
    { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'telegram.token': TELEGRAM_TEST_TOKEN } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: 1500, what: 'Discord READY' });
  const send = (d: object) => fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d });
  const base = { id: '90071992547420000', channel_id: ids.channel, author: { id: ids.human }, content: 'From Discord', type: 0 };
  for (const change of [{ author: { id: ids.member } }, { author: { id: ids.human, bot: true } }, { webhook_id: ids.webhook },
    { channel_id: ids.secondChannel }, { type: 7 }, { author: { id: ids.bot, bot: true } }]) await send({ ...base, ...change });
  await send(base); await send(base);
  const reply = { ...base, id: '90071992547420001', type: 19, content: 'A reply' }; await send(reply);
  await until(() => state.get('discord.lastMessageId') === reply.id, { timeoutMs: 1500, what: 'stored cursor after ordered input' });
  const history = await ui.request({ type: 'topic.history', topic: 'general' }); assert.equal(history.ok, true);
  const messages = (history.value as { messages: import('../src/protocol.ts').TopicMessage[] }).messages.filter(m => m.via === 'discord');
  assert.deepEqual(messages.map(m => [m.text, m.kind, m.fromKind, m.to]), [['From Discord', 'message', 'human', ['coordinator']], ['A reply', 'message', 'human', ['coordinator']]]);
  await until(async () => {
    const response = await fetch(`${telegram.url}/control/state`); const value = await response.json() as { messages: Array<{ text?: string; rich_message?: { markdown: string } }> };
    return value.messages.some(m => (m.text ?? m.rich_message?.markdown ?? '').includes('you (Discord)'));
  }, { timeoutMs: 1500, what: 'Telegram cross-remote header' });
  assert.equal((await fake.control('state')).messages.length, 0, 'no inbound echo or refusal replies');
  await hub.stop();
});

test('Discord cursor waits for the durable hub result and survives duplicate replay after restart', async t => {
  const { messengerFactory } = await import('../src/remote/messenger.ts');
  const { remoteRedactor } = await import('../src/remote/redact.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  const config = defaultConfig('Cursor fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const env = { CLAND_DISCORD_API_ROOT: fake.url };
  const factory = messengerFactory(env, remoteRedactor(), realClock, { state: store.remotes });
  let release: (() => void) | undefined;
  const start = () => projectHub(t, root, env, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN }, gatewayMessenger: (...args) => {
    const remote = factory(...args); const native = remote.start.bind(remote);
    remote.start = (send, ...rest) => native((frame, ingress) => { release = () => send(frame, ingress); }, ...rest);
    return remote;
  } });
  let hub = await start(); let ui = await connectUi(t, hub.discovery, 'nvim');
  await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: 1500, what: 'READY' });
  const d = { id: '90071992547430000', channel_id: ids.channel, author: { id: ids.human }, type: 0, content: 'Held at ingress' };
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d });
  await until(() => !!release, { timeoutMs: 1500, what: 'native frame waiting at ingress' });
  assert.equal(state.get('discord.lastMessageId'), null);
  const before = await ui.request({ type: 'topic.history', topic: 'general' }); assert.ok(!JSON.stringify(before.value).includes('Held at ingress'));
  release!();
  await until(() => state.get('discord.lastMessageId') === d.id, { timeoutMs: 1500, what: 'store then cursor' });
  const saved = await ui.request({ type: 'topic.history', topic: 'general' }); assert.ok(JSON.stringify(saved.value).includes('Held at ingress'));
  await hub.stop(); release = undefined; hub = await start(); ui = await connectUi(t, hub.discovery, 'nvim');
  await until(async () => (await fake.control('state')).gateway.identifies === 2, { timeoutMs: 1500, what: 'restart READY' });
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d });
  // A later valid input is the ordered completion barrier for the replay.
  await fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { ...d, id: '90071992547430001' } });
  await until(() => !!release, { timeoutMs: 1500, what: 'input after replay reached ingress' });
  assert.equal(state.get('discord.lastMessageId'), d.id);
  release!();
  await until(() => state.get('discord.lastMessageId') === '90071992547430001', { timeoutMs: 1500, what: 'second durable cursor' });
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal((history.value as { messages: Array<{ via?: string }> }).messages.filter(m => m.via === 'discord').length, 2);
  await hub.stop();
});

test('Discord outbox proves crash sends by own nonce, bounded same-nonce retry, and fences old unknown sends', async t => {
  const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const { DiscordApi } = await import('../src/remote/discord-api.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock(); const root = await tempProject(t); const fake = await fakeDiscordFixture(t, { clock });
  const store = new Store(join(root, 'hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url, clock });
  const outbox = new DiscordOutbox(api, state, clock, new AbortController().signal); onCleanup(t, () => outbox.stop());
  const seed = (id: string, age = 0) => {
    const job = { id, kind: 'message', source: id, state: 'sending', created: new Date(clock.now().getTime() - age).toISOString(), updated: clock.now().toISOString(),
      payload: { discord: true, channel: ids.channel, user: ids.human, content: id, mapping: { chatId: ids.channel, topic: 'general', message: id, ask: null, approval: null } } };
    state.writeOutbox(job, { id: `attempt-${id}`, job: id, at: job.created, outcome: null });
    return job;
  };
  const own = seed('ownreceipt');
  const native = await api.createMessage(ids.channel, { content: own.id, nonce: own.id }); outbox.observe(native);
  const retry = seed('samenonce'); await api.createMessage(ids.channel, { content: retry.id, nonce: retry.id });
  const old = seed('oldunknown', 120000);
  await outbox.resume();
  const jobs = state.outbox();
  assert.equal(jobs.find(j => j.id === own.id)?.state, 'sent'); assert.equal(state.message(ids.channel, native.id)?.message, own.id);
  assert.equal(jobs.find(j => j.id === retry.id)?.state, 'sent');
  assert.equal(jobs.find(j => j.id === old.id)?.state, 'uncertain');
  assert.equal((await fake.control('state')).messages.length, 2, 'same nonce returns existing post and old unknown is never retried');
  assert.equal((await fake.control('state')).requests.filter(r => r.method === 'POST').length, 3, 'own receipt avoids re-send');
});

test('Discord records attempt before REST and publishes mapping with sent settlement', async t => {
  const { root, store, state, send, observe, fault, release } = await ownedOutbox(t);
  const held = observe();
  await fault();
  const sending = send();
  await held;
  const job = state.outbox()[0]!; assert.equal(job.state, 'sending'); assert.equal(state.attempts(job.id).length, 1);
  // A separate connection observes durable state, excluding the writer's open savepoint.
  const reader = new Store(join(root, 'hub.db')); onCleanup(t, () => reader.close());
  const durable = reader.remotes.forMessenger('discord');
  const settlements: boolean[] = [];
  const unsubscribe = store.remotes.subscribe(() => {
    const sent = durable.outbox().find(j => j.id === job.id && j.state === 'sent');
    if (sent) settlements.push(!!durable.message(ids.channel, durable.get(`discord.outbox.receipt:${job.id}`)!));
  });
  try { await release(); await sending; } finally { unsubscribe(); }
  assert.equal(durable.outbox()[0]!.state, 'sent');
  assert.ok(durable.message(ids.channel, durable.get(`discord.outbox.receipt:${job.id}`)!));
  assert.ok(settlements.every(Boolean), 'no observable sent state without mapping');
});

test('Discord startup replay cancellation drains the held REST request before gateway shutdown', async t => {
  const { DiscordRemote } = await import('../src/remote/discord.ts'); const { DiscordApi } = await import('../src/remote/discord-api.ts');
  const { Gateway } = await import('../src/remote/gateway.ts'); const { realClock } = await import('../src/hub/clock.ts');
  const { within } = await import('../src/executor/droplet/deadline.ts');
  const abort = new AbortController();
  let gateway: InstanceType<typeof Gateway> | undefined;
  let starting: Promise<void> | undefined, stopping: Promise<void> | undefined, held: Promise<number> | undefined;
  let store: Store | undefined;
  onCleanup(t, async () => {
    abort.abort();
    await gateway?.stop();
    await Promise.allSettled([starting, stopping, held]); store?.close();
  });
  const root = await tempProject(t); const fake = await fakeDiscordFixture(t);
  store = new Store(join(root, 'hub.db')); const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const at = realClock.now().toISOString();
  state.putOutbox({ id: 'replayjob', kind: 'general', source: 'replayjob', state: 'queued', created: at, updated: at,
    payload: { discord: true, channel: ids.channel, user: ids.human, content: 'Replay', mapping: { chatId: ids.channel, topic: 'general', message: 'replayjob', ask: null, approval: null } } });
  let applicationReady = false;
  // Hold the replay, after the startup application/command exchanges, at the native REST seam.
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const nativeCreate = api.createMessage.bind(api);
  api.createMessage = async (...args) => { await fake.control('fault', { response: 'hold' }); return nativeCreate(args[0], args[1], { signal: AbortSignal.any([abort.signal, ...(args[2]?.signal ? [args[2].signal] : [])]) }); };
  const replayRemote = new DiscordRemote(api, DISCORD_TEST_TOKEN, realClock, { store: state, fake: true });
  gateway = new Gateway({ open: () => { applicationReady = true; throw new Error('late conversation acquisition'); } }, [replayRemote]);
  held = fake.waitForHold(abort.signal); void held.catch(() => {});
  starting = gateway.start(); void starting.catch(() => {});
  await held;
  assert.equal(state.attempts('replayjob').length, 1);
  stopping = gateway.stop(); void stopping.catch(() => {});
  await within(stopping, 500, realClock, () => new Error('startup replay ignored cancellation'));
  await Promise.allSettled([starting]);
  await until(() => fake.receipts().held === 0 && fake.receipts().handlers === 0 && fake.receipts().connections === 0, { timeoutMs: 1000, what: 'native replay close and handler drainage' });
  assert.equal(applicationReady, false); assert.equal(state.get('discord.outbox.receipt:replayjob'), null);
  assert.equal((await fake.control('state')).messages.length, 0); assert.notEqual(state.outbox()[0]!.state, 'sent');
});

async function ownedOutbox(t: TestContext, publishHeld = true, suppliedClock?: import('../src/hub/clock.ts').Clock) {
  const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const clock = suppliedClock ?? realClock;
  const exchange = await discordExchangeOwner(t, { publishHeld, clock }).start();
  const { fake, api, run, signal, close } = exchange;
  const { root } = await exchange.project();
  const store = new Store(join(root, 'hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const outbox = new DiscordOutbox(api, state, clock, signal); exchange.stop(() => outbox.stop());
  return { root, fake, store, state, close, api, clock,
    fault: () => run(() => fake.control('fault', { response: 'hold' })),
    release: () => run(() => fake.control('release', {})),
    nativeHeld: () => run(() => fake.held()),
    resume: () => run(() => outbox.resume()),
    observe: () => run(() => fake.waitForHold(signal)),
    send: () => run(() => outbox.send(ids.channel, 'Atomic receipt', 'atomic-source')),
  };
}

test('Discord held-send owner drains omitted observer and abort before fault setup', async t => {
  for (const publishHeld of [false, true]) {
    const owner = await ownedOutbox(t, publishHeld);
    const held = owner.observe();
    if (!publishHeld) {
      await owner.fault();
      owner.send();
      await owner.nativeHeld();
    }
    await owner.close();
    await assert.rejects(held, /aborted/);
    await until(() => owner.fake.receipts().held === 0 && owner.fake.receipts().observers === 0 && owner.fake.receipts().handlers === 0 && owner.fake.receipts().connections === 0,
      { timeoutMs: 1000, what: 'owned observer/send native drainage' });
  }
});

test('Discord recovery POST owns a distinct attempt and never renews the original nonce window', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const clock = new FakeClock();
  const owner = await ownedOutbox(t, true, clock); const { state, api, fake } = owner;
  const at = clock.now().toISOString();
  const job = { id: 'recoveryjob', kind: 'message', source: 'recoveryjob', state: 'sending', created: at, updated: at,
    payload: { discord: true, channel: ids.channel, user: ids.human, content: 'Recovery', mapping: { chatId: ids.channel, topic: 'general', message: 'recoveryjob', ask: null, approval: null } } };
  state.writeOutbox(job, { id: 'original', job: job.id, at, outcome: null });
  const original = await api.createMessage(ids.channel, { content: 'Recovery', nonce: job.id });
  const held = owner.observe(); await owner.fault(); const recovery = owner.resume(); await held;
  const attempts = state.attempts(job.id);
  assert.equal(attempts.length, 2, 'each actual recovery POST has its own durable fence');
  assert.notEqual(attempts[0]!.id, attempts[1]!.id); assert.equal(state.outbox()[0]!.state, 'sending');
  await owner.release(); await recovery;
  assert.equal((await fake.control('state')).messages.length, 1);
  assert.equal(state.outbox()[0]!.state, 'sent'); assert.equal(state.message(ids.channel, original.id)?.message, job.id);
  // Simulate another interrupted replay near the expiry, with a fresh latest attempt.
  const old = { ...job, id: 'oldwindow', state: 'sending' };
  state.writeOutbox(old, { id: 'oldoriginal', job: old.id, at, outcome: 'unknown' });
  await clock.advance(119999);
  state.putAttempt({ id: 'recentreplay', job: old.id, at: clock.now().toISOString(), outcome: 'never-left' });
  await clock.advance(1); const before = (await fake.control('state')).requests.length;
  await owner.resume();
  assert.equal(state.outbox().find(j => j.id === old.id)!.state, 'uncertain');
  assert.equal((await fake.control('state')).requests.length, before, 'fresh attempt cannot extend nonce eligibility');
});

for (const status of [401, 403, 404]) test(`Discord terminal ${status} is dropped durably and never replayed`, async t => {
  const { DiscordApi } = await import('../src/remote/discord-api.ts');
  const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const root = await tempProject(t), fake = await fakeDiscordFixture(t);
  const store = new Store(join(root, 'hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const box = new DiscordOutbox(api, state, realClock, new AbortController().signal); onCleanup(t, () => box.stop());
  await fake.control('fault', { status }); await box.send(ids.channel, 'Refused', `source-${status}`);
  assert.equal(state.outbox()[0]!.state, 'dropped'); await box.resume();
  assert.equal((await fake.control('state')).requests.length, 1);
});

test('Discord stored then timed-out send proves its enforced nonce and posts once', async t => {
  const { DiscordApi } = await import('../src/remote/discord-api.ts'); const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const { FakeClock } = await import('./fake-clock.ts'); const clock = new FakeClock();
  const exchange = await discordExchangeOwner(t, { clock, timeoutMs: 100 }).start();
  const { fake, api, signal, run } = exchange;
  const { root } = await exchange.project();
  const store = new Store(join(root, 'hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const box = new DiscordOutbox(api, state, clock, signal); exchange.stop(() => box.stop());
  const held = run(() => fake.waitForHold(signal)); await run(() => fake.control('fault', { response: 'holdStored' }));
  const send = run(() => box.send(ids.channel, 'Once', 'timeout-source')); await held;
  assert.equal((await fake.control('state')).messages.length, 1, 'stored before response hold');
  await clock.advance(100); await send;
  await run(() => box.resume());
  assert.equal(state.outbox()[0]!.state, 'sent');
  const native = await fake.control('state'); assert.equal(native.messages.length, 1);
  const posts = native.requests.filter(r => r.method === 'POST'); assert.equal(posts.length, 2);
  assert.equal(posts[0]!.body.nonce, posts[1]!.body.nonce);
  assert.equal(posts[1]!.body.enforce_nonce, true);
  assert.equal(state.message(ids.channel, native.messages[0]!.id)?.message, 'timeout-source');
});

test('Discord paired-channel refusal stops only the remote; missing edit leaves it running', async t => {
  const { DiscordApi } = await import('../src/remote/discord-api.ts'); const { DiscordRemote } = await import('../src/remote/discord.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const root = await tempProject(t), fake = await fakeDiscordFixture(t);
  const store = new Store(join(root, 'hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const notices: string[] = []; const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const remote = new DiscordRemote(api, DISCORD_TEST_TOKEN, realClock, { store: state, fake: true, notice: cause => notices.push(cause) });
  onCleanup(t, () => remote.stop());
  await assert.rejects(api.editMessage(ids.channel, '99999999999999999', { content: 'gone' }));
  assert.equal(state.status().disabled, false); assert.equal(notices.length, 0);
  await fake.control('fault', { status: 403 }); await assert.rejects(api.getChannel(ids.channel));
  await until(() => state.status().disabled === true, { timeoutMs: 1000, what: 'durable blocked remote' });
  assert.match(state.status().reason ?? '', /blocked.*403/); assert.equal(state.status().stopCause, 'blocked'); assert.equal(notices.length, 1);
  assert.equal((await api.getCurrentApplication()).id, ids.application, 'REST server still serves');
});

test('Discord production frames drain twelve General messages in order without 429', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const clock = new FakeClock();
  const root = await tempProject(t), fake = await fakeDiscordFixture(t, { clock });
  const config = defaultConfig('Pacing fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); onCleanup(t, () => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const hub = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { clock, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  for (let i = 0; i < 12; i++) assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: `Burst ${i}`, kind: 'report' })).ok, true);
  for (const count of [5, 10]) {
    await until(() => state.outbox().filter(j => j.state === 'sent').length === count, { timeoutMs: 1500, what: `${count} durable mappings` });
    await clock.advance(5000);
  }
  await until(() => state.outbox().filter(j => j.state === 'sent').length === 12, { timeoutMs: 1500, what: 'all twelve durable mappings' });
  const native = await fake.control('state'); assert.equal(native.rateLimits, 0);
  assert.deepEqual(native.messages.map(m => m.content), Array.from({ length: 12 }, (_, i) => `coord · report\nBurst ${i}`));
  await hub.stop();
});

for (const wait of ['queue', 'header'] as const) test(`Discord aged recovery retains original deadline across ${wait} wait`, async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const clock = new FakeClock();
  const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const exchange = await discordExchangeOwner(t, { clock }).start(); const { api, fake, run, signal } = exchange;
  const { root } = await exchange.project(); const store = new Store(join(root, 'hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord'); state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const box = new DiscordOutbox(api, state, clock, signal); exchange.stop(() => box.stop());
  const originalAt = clock.now().toISOString();
  await api.createMessage(ids.channel, { content: 'Old native copy', nonce: 'aged' });
  await clock.advance(110000);
  const job = { id: 'aged', kind: 'message', source: 'aged', state: 'sending', created: originalAt, updated: originalAt,
    payload: { discord: true, channel: ids.channel, user: ids.human, content: 'Old native copy', mapping: { chatId: ids.channel, topic: 'general', message: 'aged', ask: null, approval: null } } };
  state.writeOutbox(job, { id: 'original-attempt', job: job.id, at: originalAt, outcome: null });
  let blocker: Promise<unknown> | undefined;
  if (wait === 'header') {
    await fake.control('configure', { sendLimit: 1, sendWindow: 20000 });
    await api.createMessage(ids.channel, { content: 'occupy bucket', nonce: 'occupy' });
  } else {
    const held = run(() => fake.waitForHold(signal));
    await fake.control('fault', { response: 'hold' });
    blocker = api.createMessage(ids.channel, { content: 'queue predecessor', nonce: 'predecessor' });
    await held;
  }
  const resumed = run(() => box.resume());
  await until(() => state.attempts('aged').length === 2, { timeoutMs: 1000, what: 'recovery attempt entered pacing' });
  await clock.advance(20000);
  if (blocker) { await fake.control('release', {}); await blocker; }
  await resumed;
  const native = await fake.control('state');
  assert.equal(native.requests.filter(r => r.method === 'POST' && r.body.nonce === 'aged').length, 1, 'no late recovery POST');
  assert.equal(native.messages.filter(m => m.nonce === 'aged').length, 1);
  assert.equal(state.outbox().find(j => j.id === 'aged')!.state, 'uncertain');
  assert.equal(state.attempts('aged')[0]!.at, originalAt);
});

for (const abortBeforeEntry of [false, true]) test(abortBeforeEntry
  ? 'Discord incomplete exchange writer setup aborted before entry drains through its disposer'
  : 'Discord incomplete exchange drain retains writer root and Store until native settlement', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const drainClock = new FakeClock();
  const { existsSync } = await import('node:fs');
  const { abortable } = await import('../src/executor/droplet/deadline.ts');
  const release = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
  const entryAbort = new AbortController();
  let writing: Promise<void> | undefined, entry: Promise<void> | undefined;
  let close = async () => {}, remove = async () => {};
  let disposing: Promise<void> | undefined;
  const dispose = () => disposing ??= (async () => {
    // Registered before acquisition and writer launch, including signal cleanup.
    release.resolve(); entryAbort.abort(new Error('writer entry observation aborted'));
    await Promise.allSettled([writing, entry]);
    await close(); await remove();
  })();
  onCleanup(t, dispose); beforeDirectories(t, dispose);
  const exchange = await discordExchangeOwner(t, { drainClock }).start(); close = exchange.close;
  const project = await exchange.project(); const root = project.root; remove = project.remove;
  const store = new Store(join(root, 'hub.db'));
  let storeClosed = false, didEnter = false;
  exchange.afterDrain(() => { store.close(); storeClosed = true; });
  try {
    // An intentionally ignored abort models an asynchronous Store writer still owned here.
    writing = exchange.run(async () => {
      didEnter = true; entered.resolve(); await release.promise;
      store.remotes.forMessenger('discord').set('writer-receipt', 'settled');
    });
    entry = exchange.run(signal => abortable(entered.promise, AbortSignal.any([signal, entryAbort.signal])));
    if (abortBeforeEntry) {
      const noWriter = assert.rejects(writing, /aborted/), noEntry = assert.rejects(entry, /aborted/);
      void noWriter.catch(() => {}); void noEntry.catch(() => {});
      await close(); await Promise.all([noWriter, noEntry]);
      assert.equal(didEnter, false); assert.equal(storeClosed, true);
    } else {
      await entry;
      const removing = remove(); const incomplete = assert.rejects(removing, /disposal incomplete/); void incomplete.catch(() => {});
      await drainClock.advance(2000); await incomplete;
      assert.equal(existsSync(root), true, 'failed disposer retains the owned inode');
      assert.equal(storeClosed, false);
      store.remotes.forMessenger('discord').set('still-open', 'yes');
      release.resolve(); await writing;
      assert.equal(store.remotes.forMessenger('discord').get('writer-receipt'), 'settled');
    }
  } finally { await dispose(); }
  assert.equal(storeClosed, true); assert.equal(existsSync(root), false);
  assert.equal(exchange.pending(), 0);
});
