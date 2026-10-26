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
  await control(fake.url, 'say', { text: 'recover after real kill' });
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
