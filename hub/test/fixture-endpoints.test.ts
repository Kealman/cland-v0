// T2: sealed factory construction, loopback port-zero speech and production hub frames.
import './cover-quiet.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, mkdtemp, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ownDirectory } from './process-cleanup.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { messengerFactory } from '../src/remote/messenger.ts';
import { speechProvider } from '../src/speech/provider.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { realClock } from '../src/hub/clock.ts';
import { connectUi } from './harness.ts';
import type { RemoteStatusRow } from '../src/protocol.ts';

// Messenger construction refuses; speech can construct without a key and fails locally on use.
for (const [name, key] of [['discord', 'CLAND_DISCORD_API_ROOT'], ['telegram', 'CLAND_TELEGRAM_API_ROOT'], ['elevenlabs', 'CLAND_ELEVENLABS_API_ROOT']] as const) {
  test(`sealed ${name} refuses missing and base-only API roots before external I/O`, async t => {
    for (const base of [{}, { [key]: 'http://127.0.0.1:12345' }]) {
      const env = fixtureEnvironment('/scratch', base);
      const config = defaultConfig('sealed endpoints');
      const construct = () => name === 'elevenlabs'
        ? speechProvider({ ...config.speech, provider: 'elevenlabs' }, { 'speech.elevenlabs_key': 'fictional-speech-key' }, { env })
        : messengerFactory(env, remoteRedactor(), realClock)(name, name === 'telegram' ? '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi' : 'fictional-discord-token', config);
      if (name === 'elevenlabs') {
        const provider = construct() as NonNullable<ReturnType<typeof speechProvider>>;
        const targets: string[] = [];
        const nativeFetch = globalThis.fetch;
        const observed = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
          const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
          targets.push(target.origin);
          if (target.origin !== 'http://127.0.0.1:0') throw new Error('unexpected fixture speech target');
          return nativeFetch(input, init);
        });
        try {
          await assert.rejects(provider.transcribe({ audio: Buffer.from('synthetic-audio'), mime: 'audio/ogg', filename: 'note.ogg', signal: AbortSignal.timeout(1_000) }), /Speech transport or response failed/);
          assert.deepEqual(targets, ['http://127.0.0.1:0'], 'speech never falls back to the production host');
        } finally { observed.mock.restore(); }
      } else assert.throws(construct, /API (?:root|override) must be/);
    }
  });
}

test('sealed endpoint extras allow only explicit numeric loopback HTTP roots', () => {
  for (const key of ['CLAND_DISCORD_API_ROOT', 'CLAND_TELEGRAM_API_ROOT', 'CLAND_ELEVENLABS_API_ROOT']) {
    for (const root of ['https://api.telegram.org', 'https://discord.com/api/v10', 'https://api.elevenlabs.io', '', 'http://localhost:12345', 'http://127.0.0.1', 'http://user:synthetic-only@127.0.0.1:12345', 'http://127.0.0.1:12345?key=synthetic-only']) {
      assert.throws(() => fixtureEnvironment('/scratch', {}, { [key]: root }), { message: `fixture ${key} requires an explicit loopback HTTP API root` });
    }
    for (const root of ['http://127.0.0.1:12345', 'http://127.0.0.1:12345/api/v10', 'http://[::1]:12345']) {
      assert.equal(fixtureEnvironment('/scratch', {}, { [key]: root })[key], root);
    }
    const sealed = fixtureEnvironment('/scratch', {});
    assert.equal(fixtureEnvironment('/scratch/child', sealed, sealed)[key], sealed[key], 're-sealing preserves the refusal sentinel');
  }
});

async function endpointFixture(t: TestContext, messenger: 'discord' | 'telegram') {
  const owner = pacingOwner(t); // Registered before root allocation or hub acquisition.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-endpoints-')));
  const remove = ownDirectory(t, root, { beforeRemove: owner.dispose });
  const config = defaultConfig('sealed hub');
  config.remote[messenger].enabled = true;
  config.speech.provider = '';
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const logs: Record<string, unknown>[] = [];
  // Pre-arm the boundary; a regression cannot send to a production host.
  const fetches = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected fixture request'); });
  const token = messenger === 'telegram' ? '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi' : 'fictional-discord-token';
  const clock = new FakeClock();
  const start = (setup: { receipt?: Promise<void>; signal?: AbortSignal; clock?: FakeClock } = {}) => owner.start(root, {}, clock, {
    ...setup, hubOptions: { syntheticRemoteSecrets: { [`${messenger}.token`]: token }, log: entry => { logs.push(entry); } },
  });
  return { owner, root, remove, logs, fetches, clock, start };
}

for (const messenger of ['discord', 'telegram'] as const) {
  test(`sealed hub refuses enabled ${messenger} without an extra root and keeps frames available`, async t => {
    const f = await endpointFixture(t, messenger);
    const hub = await f.start();
    const ui = await within(f.owner.observe(async () => {
      const ui = await connectUi(t, hub.discovery, 'nvim');
      f.owner.close(() => ui.close());
      return ui;
    }), 1_000);
    const status = await within(f.owner.observe(() => ui.request({ type: 'remote.status' }, 1_000)), 1_000);
    assert.equal(status.ok, true, status.error);
    const row = (status.value as { remotes: RemoteStatusRow[] }).remotes.find(row => row.messenger === messenger)!;
    assert.equal(row.connection, 'disabled');
    assert.match(String(f.logs.find(entry => entry.event === 'remote-disabled')?.reason), /API root must be/);
    assert.equal(f.fetches.mock.callCount(), 0, 'no native request to any host');
    await f.owner.dispose();
    await within(hub.stopped, 1_000);
    assert.equal(f.owner.observations(), 0);
    assert.equal(f.clock.pending, 0);
  });

  for (const failure of ['omitted', 'aborted'] as const) {
    test(`sealed ${messenger} hub drains ${failure} setup before removing its root`, async t => {
      const f = await endpointFixture(t, messenger);
      const setupClock = new FakeClock();
      const abort = new AbortController();
      const starting = f.start({ receipt: new Promise<void>(() => {}), clock: setupClock, signal: abort.signal });
      const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /setup cancelled/);
      const hub = await within(f.owner.serving, 1_000);
      if (failure === 'omitted') await setupClock.advance(1_000);
      else abort.abort(new Error('setup cancelled'));
      await rejected;
      await f.owner.dispose();
      await within(hub.stopped, 1_000); // The hub stop receipt joins its writers and Store.
      assert.equal(f.owner.observations(), 0);
      assert.equal(f.clock.pending, 0);
      assert.equal(setupClock.pending, 0);
      assert.equal(f.fetches.mock.callCount(), 0);
      await f.remove(); // Its own removal barrier also requires successful drainage.
      await assert.rejects(stat(f.root), { code: 'ENOENT' });
    });
  }
}
