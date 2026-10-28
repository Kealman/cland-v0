import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, connectUi, until, testWaitMs } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { pacingOwner, driveTelegram } from './telegram-pacing-fixture.ts';

export async function voiceFixture(t: TestContext) {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  owner.close(() => fake.close(), { startupOnly: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram inbound fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = owner.store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const logs: Record<string, unknown>[] = [];
  const start = (extra: Record<string, string>, options: import('./harness.ts').ProjectHubOptions = {}) =>
    owner.start(root, extra, clock, { hubOptions: { ...options, log: entry => { logs.push(entry); options.log?.(entry); } } });
  const frame = (ui: Awaited<ReturnType<typeof connectUi>>, predicate: (frame: Record<string, unknown>) => boolean) => owner.observe(async signal => {
    await until(() => signal.aborted || ui.frames.some(predicate), { what: 'owned media frame receipt', timeoutMs: testWaitMs(5_000) });
    signal.throwIfAborted();
    return ui.frames.find(predicate)!;
  });
  const clean = async (ui: Awaited<ReturnType<typeof connectUi>>, hub: { stop: () => Promise<void> }) => {
    const listed = await ui.request({ type: 'artifact.list' });
    assert.equal(listed.ok, true, listed.error);
    const artifacts = (listed.value as { artifacts: import('../src/protocol.ts').Artifact[] }).artifacts;
    const sinks = await Promise.all(artifacts.map(a => readFile(a.path)));
    const unsafe = (value: Buffer) => value.includes(TELEGRAM_TEST_TOKEN) || value.includes('/file/bot');
    assert.ok(unsafe(Buffer.from(TELEGRAM_TEST_TOKEN)) && unsafe(Buffer.from('/file/botfixture')), 'secret scan positive controls');
    await hub.stop();
    for (const value of [Buffer.from(JSON.stringify(ui.frames)), Buffer.from(JSON.stringify(logs)), ...sinks,
      await readFile(join(root, '.cland/log/hub.log')), await readFile(join(root, '.cland/journal.jsonl'))])
      assert.equal(unsafe(value), false, 'native/public sinks contain no token or file URL');
  };
  return { root, clock, fake, owner, store, state, start, logs, clean, frame, drive: <T>(work: Promise<T>) => driveTelegram(clock, state, work) };
}

