// Web: the pushed public host projection, scratch projectHub and isolated Headless Shell.
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensureWebBuild } from '../../hub/test/web-build.ts';
import { projectSshHosts } from '../../hub/src/host/registry.ts';
import assert from 'node:assert/strict';
import type { HubFrame, HostsStatePool } from '../../shared/wire/index.ts';
import { until } from '../../hub/test/until.ts';
import { webFixture, pageUntil, resizePage, pausePageClock } from './harness.ts';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readHostPools } from '../../hub/src/host/pools.ts';
import { HostSecretStore } from '../../hub/src/host/records.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { projectHub, connectUi } from '../../hub/test/harness.ts';
import { testHost } from '../../hub/src/host/test-host.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { fakeLockProcesses } from '../../hub/test/fakes/lock-processes.ts';
import { FakeHostProvider } from '../../hub/src/host/provider/fake.ts';
import { fixtureEnvironment } from '../../hub/test/fixture-environment.ts';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';

before(() => ensureWebBuild(fileURLToPath(new URL('../../', import.meta.url))));

// Join even when the trigger or its assertions fail, before pageCase closes the page.
async function observed(receipt: Promise<unknown>, trigger: () => Promise<void>) {
  void receipt.catch(() => {});
  try { await trigger(); await receipt; }
  finally { await Promise.allSettled([receipt]); }
}

test('Sessions Hosts consumes the fake provider inventory snapshot and configuration push', async t => {
  const clock = new FakeClock();
  const hosts = ['fake-1', 'fake-2'].map(id => testHost(id, () => {}));
  const processes = fakeLockProcesses().processes;
  let tunnel!: (id: string, up: boolean) => void;
  const f = await webFixture(t, { clock,
    prepare: async root => {
      await mkdir(join(root, '.cland'), { recursive: true });
      const config = defaultConfig('Hosts fixture');
      config.hosts = readHostPools({ agents: { provider: 'fake', region: 'fake-1', slots: 8, min_hosts: 0, max_hosts: 4 } });
      await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n' + renderConfig(config));
      const store = new Store(join(root, '.cland/hub.db'));
      try {
        const provider = new FakeHostProvider({ env: fixtureEnvironment(root, {}, { CLAND_FAKE_HOST_ROOT: root }), now: () => clock.now().getTime() });
        for (const host of hosts) {
          const acquired = await provider.acquire({ project: root, pool: 'agents', architecture: 'arm64', region: 'fake-1' });
          assert.equal(acquired.state, 'created');
          if (acquired.state !== 'created') throw new Error('fake machine acquisition failed');
          ownDirectory(t, hostDirectory(root, acquired.machine.id));
          new HostSecretStore(root, store.hosts, () => {}).register({ id: host.name, address: acquired.machine.address, user: 'fixture', clientKeyPath: 'unused', knownHosts: 'unused' });
          store.hosts.provisions.ready({ id: host.name, pool: 'agents', provider: 'fake', region: 'fake-1', size: 's-4vcpu-8gb', state: 'ready', created: clock.now().toISOString(),
            machine: acquired.machine });
        }
      } finally { store.close(); }
    },
    startHub: (root, env, options) => projectHub(t, root, { ...env, CLAND_FAKE_HOST_ROOT: root }, { ...options, hosts, processes, droplet: { processes },
      createHostRegistry: async options => {
        const owner = await projectSshHosts(options);
        // The fake transport supplies observations; production HostHealth,
        // HostsState coalescing and socket publication remain unchanged.
        return { ...owner, subscribeStatus(listener) {
          const unsubscribe = owner.subscribeStatus(listener);
          tunnel = (id, up) => listener(id, up, clock.now());
          return () => { tunnel = () => {}; unsubscribe(); };
        } };
      },
    }),
  });
  await writeFile(join(f.root, '.cland/config.toml'), '# managed by cland\n' + await readFile(join(f.root, '.cland/config.toml'), 'utf8'));
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const line = page.locator('[data-host-pool="agents"]');
    await line.waitFor();
    assert.match(await line.innerText(), /agents 2\/4 hosts\s+· 0\/16 slots/);
    const cli = await connectUi(t, f.hub.discovery, 'cli');
    const receipt = until(() => line.evaluate(n => n.textContent?.includes('2/5 hosts') === true), { what: 'real hub pool configuration push renders', timeoutMs: 1000 });
    await observed(receipt, async () => {
      const changed = await cli.request({ type: 'config.set', key: 'hosts.agents.max_hosts', value: 5 });
      assert.equal(changed.ok, true, JSON.stringify(changed));
      assert.equal((changed.value as { applies: string }).applies, 'now');
      await clock.advance(1000);
    });
    assert.match(await line.innerText(), /agents 2\/5 hosts/);
    const plain = await line.evaluate(n => getComputedStyle(n).color);
    const red = until(() => line.evaluate(n => /fake-1 unreachable/.test(n.textContent ?? '') && getComputedStyle(n).color === 'rgb(255, 123, 114)'), { what: 'fake tunnel loss through hub to red DOM within one second', timeoutMs: 1000, loadFactor: 1 });
    await observed(red, async () => { tunnel('fake-1', false); await clock.advance(1000); });
    assert.match(await line.innerText(), /fake-1 unreachable/);
    assert.equal(await line.evaluate(n => getComputedStyle(n).color), 'rgb(255, 123, 114)');
    const recovered = until(() => line.evaluate(n => !n.textContent?.includes('unreachable') && getComputedStyle(n).color !== 'rgb(255, 123, 114)'), { what: 'fake tunnel recovery through hub to plain DOM', timeoutMs: 1000, loadFactor: 1 });
    await observed(recovered, async () => { tunnel('fake-1', true); await clock.advance(1000); });
    assert.equal(await line.evaluate(n => getComputedStyle(n).color), plain);
  });
});

for (const phone of [false, true]) test(`Sessions Hosts renders pushed facts and alert recovery (${phone ? 'phone' : 'desktop'})`, async t => {
  const clock = new FakeClock(Date.now());
  const f = await webFixture(t, { clock });
  const created = new Date(clock.now().getTime() - 3_600_000).toISOString();
  const pools: HostsStatePool[] = [{ name: 'agents', provider: 'fake', region: 'fake-1', hostCount: 2, maxHosts: 4,
    slotsUsed: 7, slotsTotal: 16, logins: { 'claude-code': { inUse: 2, usable: 3, signedOut: 1 }, codex: { inUse: 1, usable: 1, signedOut: 0 } }, alert: null,
    hosts: ['fake-1', 'fake-2'].map(id => ({ id, size: 's-4vcpu-8gb', region: 'fake-1', state: 'ready', created,
      sessions: ['worker'], priceHourly: id === 'fake-1' ? 0.25 : null, spendToday: id === 'fake-1' ? 1.5 : null })) }];
  let push!: (frame: HubFrame) => void;
  const reads: string[] = [];
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const section = page.locator('[data-session-slot="hosts"]');
    const line = section.locator('[data-host-pool="agents"]');
    await line.waitFor({ timeout: 3000 });
    assert.match(await line.innerText(), /agents 2\/4 hosts\s+· 7\/16 slots\s+· logins claude 2\/3.*codex 1\/1/s);
    assert.match(await line.innerText(), /1 signed out/);
    const plain = await line.evaluate(n => getComputedStyle(n).color);
    const fold = section.getByRole('button', { name: 'Fold Hosts', exact: true });
    if (await fold.getAttribute('aria-expanded') === 'false') await fold.click();
    for (const id of ['fake-1', 'fake-2']) {
      const host = section.locator(`[data-host-id="${id}"]`);
      assert.match(await host.innerText(), new RegExp(`${id}.*s-4vcpu-8gb.*fake-1.*1h.*worker`, 's'));
      assert.match(await host.innerText(), id === 'fake-1' ? /\$0.25\/h.*\$1.50 today/s : /unknown\/h.*unknown today/s);
    }
    await fold.click();
    assert.equal(await section.locator('[data-host-id="fake-1"]').isVisible(), false);
    await fold.click();
    const hostText = await section.locator('[data-host-id="fake-1"]').innerText();
    // The clock owns the interval from before navigation. Skip past its next
    // tick without spending real seconds or racing the observer against it.
    await clock.advance(2000);
    await page.clock.fastForward(2000);
    await pageUntil(page, () => document.querySelector('[data-host-id="fake-1"]')?.textContent?.includes('1h 0m 2s') === true, 'uptime advances without a push');
    assert.notEqual(await section.locator('[data-host-id="fake-1"]').innerText(), hostText);
    assert.match(await section.locator('[data-host-id="fake-1"]').innerText(), /\$1.50 today/);
    const red = until(() => line.evaluate(n => /fake-1 unreachable/.test(n.textContent ?? '') && getComputedStyle(n).color === 'rgb(255, 123, 114)'), { what: 'pushed outage rendered within one second', timeoutMs: 1000, loadFactor: 1 });
    await observed(red, async () => {
      pools[0]!.alert = { kind: 'outage', host: 'fake-1', since: clock.now().toISOString() };
      push({ type: 'hosts.state', pools });
    });
    assert.equal(await line.evaluate(n => getComputedStyle(n).color), 'rgb(255, 123, 114)');
    if (phone) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
      assert.equal(await section.evaluate(n => n.scrollWidth <= n.clientWidth), true);
    }
    const refused = line.getByText('fake provider capacity refused').waitFor({ timeout: 1000 });
    await observed(refused, async () => {
      pools[0]!.alert = { kind: 'provider', reason: 'fake provider capacity refused' };
      push({ type: 'hosts.state', pools });
    });
    assert.equal(await line.evaluate(n => getComputedStyle(n).color), 'rgb(255, 123, 114)');
    const recovered = until(() => line.evaluate(n => !n.textContent?.includes('refused') && getComputedStyle(n).color !== 'rgb(255, 123, 114)'), { what: 'recovered pool renders plain', timeoutMs: 1000 });
    await observed(recovered, async () => {
      pools[0]!.alert = null;
      push({ type: 'hosts.state', pools });
    });
    assert.equal(await line.evaluate(n => getComputedStyle(n).color), plain);
    const hidden = section.waitFor({ state: 'detached', timeout: 1000 });
    await observed(hidden, async () => { push({ type: 'hosts.state', pools: [] }); });
    assert.equal(await section.count(), 0);
    assert.equal(reads.includes('host.status'), false);
  }, async page => {
    await pausePageClock(page, clock.now());
    if (phone) await resizePage(page, { width: 320, height: 844 });
    await page.routeWebSocket('**/ws', route => {
      push = frame => route.send(JSON.stringify(frame));
      const server = route.connectToServer();
      route.onMessage(message => { reads.push(JSON.parse(String(message)).type); server.send(message); });
      server.onMessage(message => {
        const frame = JSON.parse(String(message)) as HubFrame;
        if (frame.type === 'hosts.state') frame.pools = pools;
        if (frame.type === 'snapshot' && frame.domain === 'sessions') frame.value.hosts = pools;
        route.send(JSON.stringify(frame));
      });
    });
  }, { phone });
});

test('Sessions hides Hosts for an empty pool list and a previous hub snapshot', async t => {
  const f = await webFixture(t);
  let previous = false;
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    assert.equal(await page.locator('[data-session-slot="hosts"]').count(), 0);
    previous = true;
    await page.reload();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'old snapshot is live');
    assert.equal(await page.locator('[data-session-slot="hosts"]').count(), 0);
    assert.equal(await page.locator('[data-session-slot="verification"]').count(), 1);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      server.onMessage(message => {
        const frame = JSON.parse(String(message)) as HubFrame;
        if (previous && frame.type === 'hosts.state') return;
        if (previous && frame.type === 'snapshot' && frame.domain === 'sessions') delete frame.value.hosts;
        route.send(JSON.stringify(frame));
      });
    });
  });
});
