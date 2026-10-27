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
import { connectUi, projectHub, startDaemon, killDaemon, tempProject, until } from './harness.ts';
import type { TopicMessage } from '../src/protocol.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { pairing, control, nativeRemote } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup, recordedProcess } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';

test('SIGKILL mid-update leaves the Telegram offset unconfirmed and restart handles it once', async t => {
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
  const initialPoll = fake.waitForPoll();
  const first = await startDaemon(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url });
  const firstUi = await connectUi(t, first.discovery, 'nvim');
  const processes = nativePollerProcesses(fixtureEnvironment(root, process.env));
  const captured = recordedProcess(first.discovery.pid);
  assert.ok(captured?.identity, 'cleanup captured the native birth before signalling');
  const live = await processes.inspect(first.discovery.pid);
  assert.equal(live.alive, true, 'positive control: native inspection retains the live writer');
  assert.equal(live.identity, captured.identity, 'the inspected writer is the owned incarnation');
  assert.equal((await within(initialPoll, 2_000)).params.offset, undefined);
  // Arm observation before introducing the update. The log is emitted only after
  // the loop has selected this exact input and found no durable handler receipt.
  const interrupted = until(async () => {
    await firstUi.request({ type: 'hub.status', flushLogs: true });
    const lines = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
    return lines.split('\n').filter(line => line.startsWith('{') && line.endsWith('}')).some(line => {
      const record = JSON.parse(line) as { event: string; update?: number };
      return record.event === 'telegram-update-unhandled' && record.update === 1;
    });
  }, { what: 'exact unconfirmed Telegram update selected', timeoutMs: 3_000 });
  // Text now has a native mirror handler; an edit still belongs to a separate
  // handler, preserving this case's original before-handling crash boundary.
  await control(fake.url, 'update', { edited_message: { message_id: 1, date: 1,
    chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' },
    text: 'recover after real kill' } });
  await interrupted;
  const before = new Store(db);
  try { assert.equal(before.remotes.forMessenger('telegram').get('telegram.offset'), null); }
  finally { before.close(); }
  await killDaemon(first.discovery.pid);
  const exited = await processes.inspect(first.discovery.pid);
  assert.deepEqual(exited, { alive: false, started: null, identity: null },
    'owned native incarnation and writers have exited before reopening; parent reaping is separate');
  firstUi.close();

  const store = new Store(db);
  const clock = new FakeClock();
  const native = nativeRemote(store, fake.url, clock);
  onCleanup(t, async () => { await native.gateway.stop(); store.close(); });
  const recoveredPoll = fake.waitForPoll();
  // Keep real process facts for the stale lease; no synthetic dead-PID claim.
  const second = await projectHub(t, root, {}, { gatewayRemotes: [native.gateway], clock,
    gatewayProcesses: processes });
  const receipt = await within(recoveredPoll, 2_000);
  assert.equal(receipt.params.offset, 2);
  assert.deepEqual(native.handled, [1]);
  assert.equal(native.state.get('telegram.offset'), '2');
  const secondUi = await connectUi(t, second.discovery, 'nvim');
  const history = await secondUi.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  assert.equal(JSON.stringify(history.value).split('recover after real kill').length - 1, 1);
  const closed = fake.waitForPollClose(receipt.id);
  await second.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
  assert.equal(clock.pending, 0);
});

test('SIGKILL after Telegram human commit before adapter receipt replays the durable message once', async t => {
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
  const polled = fake.waitForPoll();
  const first = await startDaemon(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url,
    CLAND_TEST_CRASH_AT: 'telegram-input-committed' });
  const poll = await within(polled, 2_000);
  const processes = nativePollerProcesses(fixtureEnvironment(root, process.env));
  const captured = recordedProcess(first.discovery.pid);
  assert.ok(captured?.identity, 'the fixture owns this native incarnation');
  const live = await processes.inspect(first.discovery.pid);
  assert.equal(live.alive, true);
  assert.equal(live.identity, captured.identity, 'positive native writer control before triggering the crash');
  const pollClosed = fake.waitForPollClose(poll.id);
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
  const recovered = fake.waitForPoll();
  const second = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url },
    { clock: new FakeClock(), gatewayProcesses: processes });
  const receipt = await within(recovered, 2_000);
  assert.equal(receipt.params.offset, 2);
  const ui = await connectUi(t, second.discovery, 'nvim');
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages.filter(message => message.text === 'Committed before native crash');
  assert.equal(messages.length, 1, 'native crash/replay must not duplicate the human effect');
  assert.equal(messages[0]!.id, original.id);
  const closed = fake.waitForPollClose(receipt.id);
  await second.stop();
  assert.equal(await within(closed, 1_000), receipt.id);
});
