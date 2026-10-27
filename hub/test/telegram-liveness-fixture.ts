import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import type { RemoteStatusRow } from '../src/protocol.ts';
import { realClock, type Clock } from '../src/hub/clock.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { tempProject, projectHub, connectUi, until } from './harness.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';

type Hub = Awaited<ReturnType<typeof projectHub>>;
type Ui = Awaited<ReturnType<typeof connectUi>>;

/** Own startup before invoking the hub, including a frozen/held getMe or lost readiness receipt. */
export async function telegramLivenessFixture(t: TestContext, options: {
  setupClock?: Clock; signal?: AbortSignal; publishReady?: boolean;
} = {}) {
  const clock = new FakeClock();
  const setupAbort = new AbortController();
  const ready = Promise.withResolvers<Hub>();
  const actual = Promise.withResolvers<Hub>();
  void ready.promise.catch(() => {});
  void actual.promise.catch(() => {});
  let native: ReturnType<typeof fakeTelegramFixture> | undefined;
  let starting: Promise<Hub> | undefined;
  let observing: Promise<Hub> | undefined;
  let connecting: Promise<Ui> | undefined;
  let stopped = false, joined = false;
  let disposing: Promise<void> | undefined;
  const dispose = () => disposing ??= (async () => {
    setupAbort.abort(new Error('Telegram liveness setup cancelled'));
    // Closing the owned fake aborts held native startup I/O even while the
    // behavior clock is frozen. Its receipt joins every connection and handler.
    await native?.close();
    const hub = await starting?.catch(() => undefined);
    if (hub) { await hub.stop(); stopped = true; }
    joined = !!starting;
    await observing?.catch(() => {});
    await connecting?.then(ui => ui.close(), () => {});
  })();
  onCleanup(t, dispose);
  const root = await tempProject(t);
  native = fakeTelegramFixture(t, { clock });
  const fake = await native.start();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram liveness fixture');
  config.remote.telegram.enabled = true;
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const logs: Record<string, unknown>[] = [];
  const start = async () => {
    assert.equal(starting, undefined, 'fixture startup has one owner');
    const signal = AbortSignal.any([t.signal, setupAbort.signal, ...(options.signal ? [options.signal] : [])]);
    // Arm the independent readiness bound before triggering any hub startup.
    observing = within(abortable(ready.promise, signal), 1_000, options.setupClock ?? realClock,
      () => new Error('Telegram liveness startup receipt deadline reached'));
    void observing.catch(() => {});
    starting = projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock, log: entry => { logs.push(entry); } });
    void starting.then(hub => { actual.resolve(hub); if (options.publishReady !== false) ready.resolve(hub); }, error => {
      actual.reject(error); ready.reject(error);
    });
    try {
      const hub = await observing;
      signal.throwIfAborted();
      const ui = await (connecting = connectUi(t, hub.discovery, 'nvim'));
      signal.throwIfAborted();
      assert.equal((await ui.request({ type: 'subscribe' }, 1_000)).ok, true);
      const status = async () => {
        const result = await ui.request({ type: 'remote.status' });
        assert.equal(result.ok, true, result.error);
        return (result.value as { remotes: RemoteStatusRow[] }).remotes.find(row => row.messenger === 'telegram')!;
      };
      const history = async () => {
        const result = await ui.request({ type: 'topic.history', topic: 'general' });
        assert.equal(result.ok, true, result.error);
        return JSON.stringify(result.value);
      };
      return { hub, ui, status, history };
    } catch (error) { await dispose(); throw error; }
  };
  const retries = () => logs.filter(entry => entry.event === 'telegram-poll-retry').length;
  const waitRetry = (count: number) => until(() => retries() === count, { what: `Telegram retry ${count}`, timeoutMs: 1_000 });
  return { root, clock, fake, logs, start, retries, waitRetry, dispose,
    actual: () => within(actual.promise, 1_000, realClock, () => new Error('actual Telegram hub startup missing')),
    receipts: () => ({ joined, stopped, ...native!.receipts() }),
  };
}
