// T1: idle polling consults the Host flag at every admission, using an in-process reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountPoller } from '../src/accounts/poller.ts';
import { Store } from '../src/hub/store.ts';
import { HubCore } from '../src/hub/core.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('idle poll checks the Host before every read and preserves admission when allowed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'host-poll-'));
  const env = fixtureEnvironment(root, process.env);
  let poller: AccountPoller | undefined;
  let core: HubCore | undefined;
  let store: Store | undefined;
  try {
    await mkdir(join(env.XDG_CONFIG_HOME!, 'cland'), { recursive: true });
    await writeFile(join(env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), '[accounts.cx]\nharness = "codex"\n');
    const clock = new FakeClock();
    store = new Store(join(root, 'hub.db'));
    core = new HubCore({ store, env, clock });
    let allowed = false;
    let checks = 0;
    let reads = 0;
    const host = { get limitPolls() { checks++; return allowed; } };
    poller = new AccountPoller(core, { list: () => [], readAccountLimits: async () => null }, root, () => {}, env, clock, async () => { reads++; return []; }, host);
    await poller.refresh();
    assert.equal(reads, 0);
    assert.ok(checks > 0);
    allowed = true;
    await poller.refresh();
    assert.equal(reads, 1);
    clock.advance(6 * 60_000);
    allowed = false;
    const previous = checks;
    await poller.refresh();
    assert.ok(checks > previous);
    assert.equal(reads, 1);
  } finally {
    await poller?.close();
    await core?.close();
    store?.close();
    await rm(root, { recursive: true, force: true });
  }
});
