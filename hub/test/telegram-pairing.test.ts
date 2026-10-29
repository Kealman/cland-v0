// T2: production Telegram pairing through sealed CLI/frames and the loopback fake Bot API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, projectHub, tempProject, until, inProcessSpoke, frameClient } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { Inbox, RemoteStatusResult } from '../src/protocol.ts';
import type { TgMessage, TgUpdate } from '../src/remote/telegram-api.ts';
import { Store } from '../src/hub/store.ts';
import { setupHub } from '../src/setup/hub.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { pacingOwner, driveTelegram } from './telegram-pacing-fixture.ts';

type PairingOwner = ReturnType<typeof pacingOwner>;

function receipt(owner: PairingOwner, check: (signal: AbortSignal) => boolean | Promise<boolean>, what: string) {
  return owner.observe(async signal => {
    let checking: Promise<boolean> | undefined;
    try {
      await until(() => signal.aborted || (checking = Promise.resolve(check(signal))), { timeoutMs: 2_000, what });
      signal.throwIfAborted();
    } finally { await checking?.catch(() => {}); }
  });
}

async function nativeState(url: string, signal: AbortSignal): Promise<{ messages: TgMessage[] }> {
  const response = await fetch(`${url}/control/state`, { signal: AbortSignal.any([signal, AbortSignal.timeout(1_000)]) });
  assert.equal(response.status, 200);
  return await response.json() as { messages: TgMessage[] };
}

async function pairingFrames(owner: PairingOwner, hub: Awaited<ReturnType<typeof projectHub>>, root: string) {
  let receive = (_line: string) => {};
  let open = true;
  const conversation = hub.dispatcher.open({ send: frame => receive(`${JSON.stringify(frame)}\n`),
    close: () => { open = false; }, isOpen: () => open }, { authenticated: true, edge: 'socket' });
  const ui = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; },
    () => { if (open) { open = false; conversation.closed(); } }, root);
  owner.close(() => ui.close());
  const welcome = receipt(owner, () => ui.frames.some(frame => frame.type === 'welcome'), 'owned pairing frame welcome');
  ui.send({ type: 'hello', protocol: 2, client: 'nvim' });
  await welcome;
  return ui;
}

test('Telegram private starts respect stranger limits and CLI approval names the paired project', async t => {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  owner.close(() => fake.close(), { startupOnly: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Pairing fixture project');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const stateStore = owner.store(join(root, '.cland/hub.db')).remotes.forMessenger('telegram');
  const initial = owner.observe(signal => fake.waitForPoll(signal));
  const hub = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock);
  let poll = await within(initial, 1_000);
  const ui = await pairingFrames(owner, hub, root);
  const say = async (user: 'human' | 'stranger', text: string) => {
    await clock.advance(1_000);
    const confirmed = owner.observe(signal => fake.waitForPoll(signal));
    const update = await control<TgUpdate>(fake.url, 'say', { user, text });
    poll = await within(confirmed, 1_000, undefined, () => new Error('Telegram /start durable handling receipt missing'));
    assert.equal(poll.params.offset, update.update_id + 1);
  };
  await say('stranger', '/start');
  const strangerInbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  const stranger = strangerInbox.pairings!.find(row => row.userId === '202')!;
  assert.match(stranger.code, /^[A-HJ-NP-Z2-9]{8}$/);
  let state = await control<{ messages: TgMessage[] }>(fake.url, 'state');
  assert.deepEqual(state.messages.map(message => ({ chat: message.chat.id, text: message.text })), [
    { chat: 202, text: `Pair Telegram user 202: code ${stranger.code}\ncland remote approve telegram ${stranger.code}\nask the project's owner to approve` },
  ]);
  await say('stranger', '/start');
  await say('stranger', '/start');
  state = await control(fake.url, 'state');
  assert.equal(state.messages.length, 2, 'a stranger receives at most two private replies');
  assert.equal(state.messages[1]!.text, state.messages[0]!.text, 'the live code is reused');
  await say('human', '/start@cland_fixture_bot');
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  const human = inbox.pairings!.find(row => row.userId === '101')!;
  const confirmation = receipt(owner, async signal => {
    const native = await nativeState(fake.url, signal);
    return native.messages.some(message => message.text === 'Paired with Pairing fixture project.')
      && stateStore.outbox().some(job => job.state === 'sent'
        && (job.payload as { params?: { text?: string } }).params?.text === 'Paired with Pairing fixture project.');
  }, 'pairing confirmation native send and durable sent receipt');
  const approved = await cland(root, 'remote', 'approve', 'telegram', human.code);
  await driveTelegram(clock, stateStore, confirmation);
  assert.equal(approved.code, 0, approved.stderr);
  assert.equal(approved.stdout.trim(), 'paired telegram: Fixture human (101)');
  assert.deepEqual(((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings, []);
  const status = await cland(root, 'remote', 'status', '--json');
  assert.equal(status.code, 0, status.stderr);
  assert.deepEqual((JSON.parse(status.stdout) as RemoteStatusResult).remotes[0]!.pairing,
    { userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  await say('human', '/start');
  state = await control(fake.url, 'state');
  assert.equal(state.messages.at(-1)!.chat.id, 101);
  assert.match(state.messages.at(-1)!.text!, /Pairing fixture project/);
  assert.equal(state.messages.filter(message => message.text === 'Paired with Pairing fixture project.').length, 2,
    'one approval confirmation plus the later explicitly requested paired start');
  assert.equal(state.messages.length, 5, 'approval adds exactly one confirmation');
  const closed = owner.observe(signal => fake.waitForPollClose(poll.id, signal), { drain: true });
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
});

for (const [approvalPath, recovery] of [['nvim', 'live'], ['setup', 'live'], ['nvim', 'restart'], ['nvim', '429']] as const) test(`Telegram ${approvalPath} approval confirms once before open cards in age order (${recovery})`, async t => {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  owner.close(() => fake.close(), { startupOnly: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Ordered pairing');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const state = owner.store(join(root, '.cland/hub.db')).remotes.forMessenger('telegram');
  const initial = owner.observe(signal => fake.waitForPoll(signal));
  let hub = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock);
  await within(initial, 1_000);
  const ui = await pairingFrames(owner, hub, root);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  for (const question of ['Older question', 'Newer question']) {
    assert.equal((await coord.call<{ ok: boolean }>('ask', { topic: 'general', question, options: ['Yes'] })).ok, true);
    await clock.advance(250);
  }
  const confirmed = owner.observe(signal => fake.waitForPoll(signal));
  const start = await control<TgUpdate>(fake.url, 'say', { text: '/start' });
  assert.equal((await within(confirmed, 1_000)).params.offset, start.update_id + 1);
  const row = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!;
  const delivered = receipt(owner, async signal => {
    const native = await nativeState(fake.url, signal);
    return native.messages.length === 5 && state.outbox().filter(job => job.state === 'sent').length === 5;
  }, 'confirmation and all cards native and durable sent receipts');
  if (recovery === '429') await control(fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 1 });
  if (approvalPath === 'setup') await setupHub(root, fixtureEnvironment(root, {})).approve!('telegram', row.code);
  else assert.equal((await ui.request({ type: 'pairing.approve', messenger: 'telegram', code: row.code })).ok, true);
  const live = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Live question during confirmation', options: ['Yes'] });
  assert.equal(live.ok, true);
  await clock.advance(250);
  await receipt(owner, () => state.outbox().some(job => job.source === live.ask && job.state === 'queued'),
    'live card durably queued while confirmation waits for its paced slot');
  assert.ok(state.outbox().some(job => job.state === 'queued'
    && (job.payload as { key?: string }).key?.startsWith('telegram.pairing-confirmation:')));
  if (recovery === 'restart') {
    await hub.stop();
    hub = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock);
  }
  await driveTelegram(clock, state, delivered);
  // Flush another inbox publication: it must not duplicate confirmation or cards.
  await clock.advance(250);
  await hub.stop();
  const native = await control<{ messages: TgMessage[] }>(fake.url, 'state');
  assert.equal(native.messages.length, 5);
  assert.equal(native.messages[1]!.text, 'Paired with Ordered pairing.');
  assert.match(native.messages[2]!.text!, /Older question/);
  assert.match(native.messages[3]!.text!, /Newer question/);
  assert.match(native.messages[4]!.text!, /Live question during confirmation/);
  assert.equal(state.outbox().filter(job => job.state === 'sent').length, 5);
});

for (const source of ['membership', '403'] as const) test(`Telegram stops and reports a blocked bot from ${source} while status keeps its bot link`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Blocked fixture project');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' }); }
  finally { store.close(); }
  const initial = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  let poll = await within(initial, 1_000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'remote.test', messenger: 'telegram' })).ok, true);
  // The paired identity gate must discard a stranger's membership signal.
  const foreignConfirmed = fake.waitForPoll();
  const foreign = await control<TgUpdate>(fake.url, 'membership', { user: 'stranger', status: 'kicked' });
  poll = await within(foreignConfirmed, 1_000);
  assert.equal(poll.params.offset, foreign.update_id + 1);
  const fixedLine = 'Telegram remote: bot blocked (403); unblock the bot in Telegram, then run cland hub reload';
  const notice = ui.waitFor(frame => frame.type === 'message' && (frame.message as { text: string }).text === fixedLine, 1_000);
  void notice.catch(() => {});
  const closed = fake.waitForPollClose(poll.id);
  if (source === 'membership') await control(fake.url, 'membership', { status: 'kicked' });
  else {
    await control(fake.url, 'fault', { method: 'sendMessage', code: 403, echoToken: true });
    await clock.advance(1_000);
    const failed = await ui.request({ type: 'remote.test', messenger: 'telegram' });
    assert.equal(failed.ok, false);
    assert.match(failed.error!, /bot blocked \(403\).*unblock the bot in Telegram, then run cland hub reload/);
  }
  await notice;
  assert.equal(await within(closed, 1_000), poll.id);
  const status = await cland(root, 'remote', 'status');
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /connection: disabled .*bot blocked \(403\)/);
  assert.match(status.stdout, /bot: https:\/\/t.me\/cland_fixture_bot/);
  assert.ok(status.stdout.includes(`last inbound: ${source === '403' ? '2026-10-16T12:00:01.000Z' : '2026-10-16T12:00:00.000Z'}`));
  assert.match(status.stdout, /last outbound: 2026-10-16T12:00:00.000Z/);
  const before = await control<{ requests: unknown[]; messages: TgMessage[] }>(fake.url, 'state');
  assert.equal(before.messages.length, 1);
  const pendingStart = await control<TgUpdate>(fake.url, 'say', { text: '/start' });
  assert.equal((await ui.request({ type: 'remote.test', messenger: 'telegram' })).ok, false);
  assert.equal((await cland(root, 'remote', 'test', 'telegram')).code, 1);
  const after = await control<typeof before>(fake.url, 'state');
  assert.deepEqual(after.requests, before.requests, 'a stopped remote makes no further platform calls');
  assert.deepEqual(after.messages, before.messages, 'a stopped remote sends nothing');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  assert.equal(JSON.stringify(history.value).split(fixedLine).length - 1, 1, 'General records one fixed cause and fix');
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  for (const sink of [JSON.stringify(ui.frames), status.stdout, JSON.stringify(history.value)])
    assert.equal(sink.includes(TELEGRAM_TEST_TOKEN), false);
  await hub.stop();
  assert.equal(clock.pending, 0);
  if (source === 'membership') {
    ui.close();
    // Restart after the persisted interval; pending /start still needs its send receipt.
    await clock.advance(1_000);
    const resumed = fake.waitForPoll();
    const restarted = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
    const resumedPoll = await within(resumed, 1_000, undefined, () => new Error('restart replayed the already reported kick'));
    assert.equal(resumedPoll.params.offset, pendingStart.update_id + 1);
    const restartedUi = await connectUi(t, restarted.discovery, 'nvim');
    const resumedHistory = await restartedUi.request({ type: 'topic.history', topic: 'general' });
    assert.equal(resumedHistory.ok, true, resumedHistory.error);
    assert.equal(JSON.stringify(resumedHistory.value).split(fixedLine).length - 1, 1);
    const messages = await control<{ messages: TgMessage[] }>(fake.url, 'state');
    assert.match(messages.messages.at(-1)!.text!, /Blocked fixture project/);
    const resumedClosed = fake.waitForPollClose(resumedPoll.id);
    await restarted.stop();
    assert.equal(await within(resumedClosed, 1_000), resumedPoll.id);
    assert.equal(clock.pending, 0);
  }
});
