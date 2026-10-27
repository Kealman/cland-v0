// T2: production Telegram pairing through sealed CLI/frames and the loopback fake Bot API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { Inbox, RemoteStatusResult } from '../src/protocol.ts';
import type { TgMessage, TgUpdate } from '../src/remote/telegram-api.ts';
import { Store } from '../src/hub/store.ts';

test('Telegram private starts respect stranger limits and CLI approval names the paired project', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Pairing fixture project');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const initial = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  let poll = await within(initial, 1_000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const say = async (user: 'human' | 'stranger', text: string) => {
    await clock.advance(1_000);
    const confirmed = fake.waitForPoll();
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
  const approved = await cland(root, 'remote', 'approve', 'telegram', human.code);
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
  assert.equal(state.messages.length, 4, 'a paired start is a project reply, not another code');
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
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
