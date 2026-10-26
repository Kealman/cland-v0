// T2: production messenger construction through projectHub's public frames and a loopback Bot API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { Store } from '../src/hub/store.ts';
import { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import type { Artifact, RemoteStatusRow } from '../src/protocol.ts';
import { Journal } from '../src/hub/journal.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import { FakeClock } from './fake-clock.ts';

test('configured Telegram uses the production factory for token checks and a paired send', async t => {
  const root = await tempProject(t);
  const fake = await fakeTelegram(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' }); }
  finally { store.close(); }
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const closed = fake.waitForConnectionClose('sendMessage');
  void closed.catch(() => {}); // The result remains owned if the frame fails before the close assertion.
  const checked = await ui.request({ type: 'remote.test', messenger: 'telegram' });
  assert.equal(checked.ok, true, checked.error);
  assert.equal((await within(closed, 1_000, realClock, () => new Error('completed Telegram request TCP close deadline reached'))).method, 'sendMessage',
    'the completed request closes promptly while the remote is still active');
  const response = await telegramControl<{ messages: Array<{ chat: { id: number }; text?: string }> }>(fake.url, 'state');
  assert.equal(response.status, 200);
  const state = response.body;
  assert.deepEqual(state.messages.map(message => ({ chat: message.chat.id, text: message.text })), [
    { chat: 101, text: 'cland remote test' },
  ]);
  const status = await ui.request({ type: 'remote.status' });
  assert.equal(status.ok, true, status.error);
  const telegram = (status.value as { remotes: RemoteStatusRow[] }).remotes.find(remote => remote.messenger === 'telegram')!;
  assert.equal(telegram.connection, 'connected');
  assert.equal(telegram.botLink, 'https://t.me/cland_fixture_bot');
  assert.ok(telegram.lastInbound);
  assert.ok(telegram.lastOutbound);
  await hub.stop();
});

test('Telegram refusal reaches actual frame log journal and artifact sinks without its token', async t => {
  const root = await tempProject(t);
  const fake = await fakeTelegram(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram refusal fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { log: entry => { logs.push(entry); } });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const armed = await telegramControl(fake.url, 'fault', { method: 'getMe', code: 401, echoToken: true });
  assert.equal(armed.status, 200);
  const refused = await ui.request({ type: 'remote.test', messenger: 'telegram' });
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /getMe.*401.*\[redacted\]/);
  const captured = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'note',
    title: 'Telegram refusal receipt', content: String(refused.error) });
  assert.equal(captured.ok, true, captured.error);
  const artifact = (captured.value as { artifact: Artifact }).artifact;
  const bytes = await readFile(artifact.path, 'utf8');
  assert.match(bytes, /getMe.*401.*\[redacted\]/);
  const journal = new Journal(join(root, '.cland/telegram-refusal.jsonl'));
  beforeDirectories(t, () => journal.close());
  journal.write({ event: 'telegram-client-refusal', reason: String(refused.error) });
  await journal.close();
  assert.ok(logs.some(entry => entry.event === 'remote-disabled' && String(entry.reason).includes('[redacted]')),
    'the log observer must capture the forced provider refusal');
  const status = await ui.request({ type: 'remote.status' });
  assert.equal((status.value as { remotes: RemoteStatusRow[] }).remotes[0]!.connection, 'disabled');
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true, 'a provider refusal leaves the hub serving');
  await hub.stop();
  const persisted = await Promise.all(['log/hub.log', 'journal.jsonl', 'telegram-refusal.jsonl'].map(file => readFile(join(root, '.cland', file), 'utf8')));
  for (const sink of [JSON.stringify(logs), JSON.stringify(ui.frames), bytes, ...persisted])
    assert.equal(sink.includes(TELEGRAM_TEST_TOKEN), false, 'actual public and persisted sinks must be token-free');
  assert.ok(persisted[0]!.includes('remote-disabled') && persisted[0]!.includes('[redacted]'),
    'the process log contains the specific masked refusal');
  const record = JSON.parse(persisted[2]!.trim()) as { event: string; reason: string };
  assert.equal(record.event, 'telegram-client-refusal');
  assert.match(record.reason, /getMe.*401.*\[redacted\]/, 'the native journal retains the client refusal');
});

test('Telegram configuration reload starts the native client only when enabled', async t => {
  const root = await tempProject(t);
  const fake = await fakeTelegram(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram reload fixture');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const methods = async () => {
    const response = await telegramControl<{ requests: Array<{ method: string }> }>(fake.url, 'state');
    assert.equal(response.status, 200);
    return response.body.requests.map(request => request.method);
  };
  assert.deepEqual(await methods(), []);
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const polled = fake.waitForPoll();
  const enabled = await ui.request({ type: 'hub.reload' });
  assert.equal(enabled.ok, true, enabled.error);
  const poll = await within(polled, 1_000);
  assert.deepEqual(await methods(), ['getMe', 'getUpdates']);
  const unchanged = await ui.request({ type: 'hub.reload' });
  assert.equal(unchanged.ok, true, unchanged.error);
  assert.deepEqual(await methods(), ['getMe', 'getUpdates'], 'an unchanged reload retains the existing client');
  config.remote.telegram.enabled = false;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const closed = fake.waitForPollClose(poll.id);
  const disabled = await ui.request({ type: 'hub.reload' });
  assert.equal(disabled.ok, true, disabled.error);
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal((await ui.request({ type: 'remote.test', messenger: 'telegram' })).ok, false);
  assert.deepEqual(await methods(), ['getMe', 'getUpdates'], 'disabled remotes make no platform calls');
  await hub.stop();
});

test('shutdown aborts held Telegram getMe during native factory reload', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram held startup');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'getMe', code: 500, response: 'hold' })).status, 200);
  const entered = fake.waitForHeldRequest('getMe');
  const closed = fake.waitForConnectionClose('getMe');
  void closed.catch(() => {});
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const reload = ui.request({ type: 'hub.reload' }).then(result => ({ result, error: null }),
    error => ({ result: null, error: String(error) }));
  const receipt = await within(entered, 1_000);
  assert.equal(receipt.method, 'getMe');
  const stopped = hub.stop();
  await within(stopped, 1_000, realClock, () => new Error('shutdown did not cancel held Telegram startup'));
  assert.equal((await within(closed, 1_000)).id, receipt.id);
  const outcome = await within(reload, 1_000);
  if (outcome.result) assert.equal(outcome.result.ok, false, 'the cancelled reload must not publish success');
  else assert.match(outcome.error!, /closed|disconnected/);
  assert.equal(clock.now().toISOString(), '2026-10-16T12:00:00.000Z', 'no HTTP deadline was advanced');
  assert.equal(clock.pending, 0);
  const state = await telegramControl<{ heldRequests: unknown[] }>(fake.url, 'state');
  assert.equal(state.status, 200);
  assert.deepEqual(state.body.heldRequests, []);
});
