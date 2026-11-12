// Web: scratch projectHub metadata and isolated Headless Shell; fake pushed inventory.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { writeLoginKey } from '../../hub/src/host/login-keys.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { projectHub } from '../../hub/test/harness.ts';
import { testHost } from '../../hub/src/host/test-host.ts';
import { localHost } from '../../hub/src/host/local.ts';
import { fixtureEnvironment } from '../../hub/test/fixture-environment.ts';
import { FakeHostProvider } from '../../hub/src/host/provider/fake.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { HostSecretStore, type HostRecords } from '../../hub/src/host/records.ts';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { settledLogin } from '../../hub/test/settled-login-fixture.ts';
import { hostGenerationKey } from '../../hub/src/adapters/processes.ts';
import type { HarnessProcess } from '../../hub/src/adapters/contract.ts';
import { fakeLockProcesses } from '../../hub/test/fakes/lock-processes.ts';
import { projectSshHosts } from '../../hub/src/host/registry.ts';
import { join } from 'node:path';
import { ensureWebBuild } from '../../hub/test/web-build.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { webFixture, resizePage } from './harness.ts';
import { connectUi } from '../../hub/test/harness.ts';
import type { HubFrame, HostsStatePool } from '../../shared/wire/index.ts';
import { until, testWaitMs } from '../../hub/test/until.ts';

before(() => ensureWebBuild(fileURLToPath(new URL('../../', import.meta.url))));

test('Hosts login binding swap with equal pool totals renders from the durable mutation within one second', async t => {
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  let records!: HostRecords;
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n');
    const store = new Store(join(root, '.cland/hub.db'));
    try {
      new HostSecretStore(root, store.hosts, () => {}).register({ id: 'fake-1', address: 'fake-1', user: 'fixture', clientKeyPath: 'unused', knownHosts: 'unused' });
      store.hosts.provisions.ready({ id: 'fake-1', pool: 'agents', provider: 'fake', size: 'small', region: 'fake-1', state: 'ready', created: clock.now().toISOString(), machine: { id: 'fake-1', address: 'fake-1', architecture: 'arm64', created: clock.now().toISOString() } });
      for (const name of ['first', 'second']) {
        store.hosts.logins.insert({ name, harness: 'codex', account: name, kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: 'v-' + name, snapshotIds: [], lastSignIn: clock.now().toISOString() });
        store.hosts.logins.transition(name, 'ready');
      }
      store.hosts.logins.bind('first', { host: 'fake-1', role: 'writer', volumeId: 'v-first' });
    } finally { store.close(); }
  }, startHub: (root, env, options) => projectHub(t, root, env, { ...options, processes, droplet: { processes }, hosts: [testHost('fake-1', () => {})],
    createHostRegistry: async options => { records = options.records; return projectSshHosts(options); },
  }) });
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const first = page.locator('[data-login-name="first"]'), second = page.locator('[data-login-name="second"]');
    await first.waitFor();
    assert.match(await first.innerText(), /in-use.*fake-1/s);
    const before = records.logins.poolSummary('fake', 'fake-1', ['fake-1']);
    const receipt = until(async () => /ready.*hosts: none/s.test(await first.innerText()) && /in-use.*hosts: fake-1/s.test(await second.innerText()), { what: 'durable equal-total binding swap rendered', timeoutMs: 1000, loadFactor: 1 });
    void receipt.catch(() => {});
    try {
      records.logins.unbind('first', 'fake-1');
      records.logins.bind('second', { host: 'fake-1', role: 'writer', volumeId: 'v-second' });
      assert.deepEqual(records.logins.poolSummary('fake', 'fake-1', ['fake-1']), before);
      await clock.advance(1000);
      await receipt;
    } finally { await Promise.allSettled([receipt]); }
    assert.match(await first.innerText(), /ready.*hosts: none/s);
    assert.match(await second.innerText(), /in-use.*hosts: fake-1/s);
  });
});

for (const confirmed of [true, false]) test(`Hosts Stop preserves cancellation and reports native deletion outcome: confirmed ${confirmed}`, async t => {
  if (!confirmed) t.mock.method(FakeHostProvider.prototype, 'release', async () => ({ state: 'incomplete', reason: 'fixture held deletion' }));
  const clock = new FakeClock(Date.now());
  let records!: HostRecords;
  const processes = fakeLockProcesses().processes;
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nslots=4\nmin_hosts=0\n');
  }, startHub: async (root, env, options) => {
    const local = localHost(fixtureEnvironment(root, env));
    const hosts = ['z-host', 'a-host'].map(id => ({ ...testHost(id, () => {}), layout: local.layout,
      listFolder: async () => [], realpath: local.realpath, statDirectory: async () => ({ refusal: null, identity: null }), loginDisk: async () => {} }));
    const hub = await projectHub(t, root, fixtureEnvironment(root, env, { CLAND_FAKE_HOST_ROOT: root }), { ...options, processes, droplet: { processes }, hosts,
      createHost: async o => { records = o.records; return { id: 'z-host', pool: 'agents', provider: 'fake', size: 'small', region: 'fake', created: clock.now().toISOString(), state: 'creating' }; } });
    hub.hostOwner!.hosts.push(...hosts);
    return hub;
  } });
  const cli = await connectUi(t, f.hub.discovery, 'cli');
  const provider = new FakeHostProvider({ env: f.hub.hostEnvironment, now: () => clock.now().getTime() });
  const acquired = await provider.acquire({ project: f.root, pool: 'agents', architecture: 'arm64', region: 'fake' });
  assert.equal(acquired.state, 'created'); if (acquired.state !== 'created') throw Error('fixture machine');
  const machine = acquired.machine;
  ownDirectory(t, hostDirectory(f.root, machine.id));
  assert.equal((await cli.request({ type: 'host.create', pool: 'agents' })).ok, true);
  records.provisions.save({ id: 'z-host', pool: 'agents', provider: 'fake', size: 'small', region: 'fake', created: machine.created, state: 'booting', machine });
  new HostSecretStore(f.root, records, () => {}).register({ id: 'z-host', address: machine.address, user: 'fixture', clientKeyPath: '', knownHosts: '' });
  records.provisions.ready({ ...records.provisions.get('z-host')!, state: 'ready' });
  const volume = await provider.createVolume({ project: f.root, name: 'login', region: 'fake', sizeGiB: 1 });
  assert.equal(volume.state, 'created'); if (volume.state !== 'created') throw Error('fixture volume');
  await settledLogin(records.logins, 'z-host', 'codex', { provider: 'fake', region: 'fake', volumeId: volume.volume.id });
  Object.assign(f.hub.fakes.codex!, { releaseUnreachableGeneration: async (p: HarnessProcess) => ({ generation: hostGenerationKey(p), released: true, dropped: [], forwardIds: [] }) });
  const launch = await cli.request({ type: 'session.launch', name: 'stop-worker', harness: 'codex', host: 'z-host', cwd: f.root });
  assert.equal(launch.ok, true, launch.error);
  await clock.advance(1000);
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-host-id="z-host"]');
    const stop = row.getByRole('button', { name: 'Stop', exact: true });
    await stop.click();
    const group = row.getByRole('group', { name: 'Confirm Stop z-host' });
    assert.match(await group.innerText(), /z-host.*1 sessions end as exited/s);
    await group.getByRole('button', { name: 'Cancel', exact: true }).click();
    await stop.waitFor();
    assert.equal(records.provisions.get('z-host')?.state, 'ready');
    await stop.click();
    const fold = page.getByRole('button', { name: 'Fold Hosts', exact: true });
    await fold.click(); await fold.click();
    await stop.waitFor();
    assert.equal(await group.count(), 0);
    const preserved = await cli.request({ type: 'session.list' });
    assert.equal((preserved.value as { processes: Array<{ name: string; status: string }> }).processes.find(row => row.name === 'stop-worker')?.status, 'running');
    assert.equal(records.provisions.get('z-host')?.state, 'ready');
    await stop.click();
    // Arm the durable outcome before the web request; advance only the coalesced push afterwards.
    const stopped = until(() => records.provisions.get('z-host')?.state === (confirmed ? 'destroyed' : 'destroying') && (confirmed || records.provisions.get('z-host')?.release === 'incomplete'), { what: 'confirmed host destruction', timeoutMs: 3000 });
    void stopped.catch(() => {});
    try { await group.getByRole('button', { name: 'Confirm', exact: true }).click(); await stopped; }
    finally { await Promise.allSettled([stopped]); }
    await clock.advance(1000);
    if (confirmed) {
      await row.waitFor({ state: 'detached' });
      assert.equal(await row.count(), 0);
    } else {
      await row.getByRole('alert').waitFor({ timeout: 1000 });
      assert.match(await row.innerText(), /destroying.*deletion not confirmed: fixture held deletion/s);
      assert.equal(records.provisions.get('z-host')?.release, 'incomplete');
      return;
    }
    const listed = await cli.request({ type: 'session.list' });
    assert.equal((listed.value as { processes: Array<{ name: string; status: string }> }).processes.find(row => row.name === 'stop-worker')?.status, 'exited');
  });
});

for (const phone of [false, true]) test(`Hosts view lists login metadata and refreshes pushed changes (${phone ? 'phone' : 'desktop'})`, async t => {
  const f = await webFixture(t, { prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const store = new Store(join(root, '.cland/hub.db'));
    try {
      for (const name of ['first', 'second']) {
        store.hosts.logins.insert({ name, harness: 'opencode', account: `${name}@example.test`, kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: 'v-' + name, snapshotIds: [], lastSignIn: '2026-11-01T12:00:00Z' });
        store.hosts.logins.transition(name, 'ready');
      }
    } finally { store.close(); }
  } });
  const pools: HostsStatePool[] = [{ name: 'agents', provider: 'fake', region: 'fake-1', hostCount: 2, maxHosts: 4, slotsUsed: 0, slotsTotal: 8,
    logins: { opencode: { inUse: 0, usable: 2, signedOut: 0 } }, alert: null,
    hosts: ['fake-1', 'fake-2'].map(id => ({ id, size: 'small', region: 'fake-1', state: 'ready', created: new Date().toISOString(), sessions: [], priceHourly: 0.25, spendToday: 1 })) }];
  let push!: (frame: HubFrame) => void;
  const requests: string[] = [];
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const view = page.locator('[data-session-slot="hosts"]');
    const first = view.locator('[data-login-name="first"]');
    await first.waitFor({ timeout: 1500 });
    const cli = await connectUi(t, f.hub.discovery, 'cli');
    const listed = await cli.request({ type: 'login.list' });
    assert.equal(listed.ok, true);
    for (const row of listed.value as Array<{ name: string; account: string; harness: string; state: string; lastSignIn: string }>) {
      const text = await view.locator(`[data-login-name="${row.name}"]`).innerText();
      for (const fact of [row.account, row.harness, row.state, row.lastSignIn, 'disk', 'none']) assert.ok(text.includes(fact), fact);
    }
    assert.equal(await view.locator('[data-host-id]').count(), 2);
    const host = view.locator('[data-host-id="fake-1"]');
    await host.getByRole('button', { name: 'Stop', exact: true }).click();
    await host.getByRole('button', { name: 'Confirm', exact: true }).click();
    await host.getByRole('alert').waitFor();
    assert.equal(await host.getByRole('alert').innerText(), 'fixture stop refused');
    assert.equal(await view.locator('[data-host-id]').count(), 2);
    assert.equal(requests.includes('host.status'), false);
    const store = new Store(join(f.root, '.cland/hub.db'));
    try {
      for (const state of ['in-use', 'ready', 'signed-out'] as const) {
        const receipt = until(() => first.evaluate((n, state) => n.textContent?.includes(state) === true, state), { what: `login ${state} rendered`, timeoutMs: 1000, loadFactor: 1 });
        void receipt.catch(() => {});
        try {
          if (state === 'in-use') store.hosts.logins.transition('first', state, { host: 'fake-1', role: 'writer', volumeId: 'v-first' });
          else if (state === 'signed-out') store.hosts.logins.markSignedOut('first', { host: null, reason: 'fixture sign out' });
          else store.hosts.logins.unbind('first', 'fake-1');
          push({ type: 'hosts.state', pools: structuredClone(pools) });
          await receipt;
        } finally { await Promise.allSettled([receipt]); }
        assert.match(await first.innerText(), new RegExp(state));
        if (state === 'in-use') assert.match(await first.innerText(), /fake-1/);
      }
    } finally { store.close(); }
    assert.equal(await first.evaluate(n => getComputedStyle(n).color), 'rgb(240, 180, 41)');
    if (phone) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
      assert.equal(await view.evaluate(n => n.scrollWidth <= n.clientWidth), true);
    }
  }, async page => {
    if (phone) await resizePage(page, { width: 320, height: 844 });
    await page.routeWebSocket('**/ws', route => {
      push = frame => route.send(JSON.stringify(frame));
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        requests.push(frame.type);
        if (frame.type === 'host.stop') route.send(JSON.stringify({ type: 'result', id: frame.id, ok: false, error: 'fixture stop refused' }));
        else server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message)) as HubFrame;
        if (frame.type === 'hosts.state') frame.pools = pools;
        if (frame.type === 'snapshot' && frame.domain === 'sessions') frame.value.hosts = pools;
        route.send(JSON.stringify(frame));
      });
    });
  }, { phone });
});

for (const kind of ['disk', 'key'] as const) test(`Hosts Remove confirms and cancels ${kind} login deletion`, async t => {
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n');
  }, startHub: (root, env, options) => projectHub(t, root,
    fixtureEnvironment(root, env, { CLAND_FAKE_HOST_ROOT: root }), { ...options, processes, droplet: { processes } }) });
  const provider = new FakeHostProvider({ env: f.hub.hostEnvironment, now: () => clock.now().getTime() });
  const store = new Store(join(f.root, '.cland/hub.db'));
  let volumeId = '', snapshotId = '';
  try {
    if (kind === 'disk') {
      const made = await provider.createVolume({ project: f.root, name: 'work', region: 'fake-1', sizeGiB: 1 });
      assert.ok(made.state === 'created'); volumeId = made.volume.id;
      const snap = await provider.snapshotVolume(made.volume);
      assert.ok(snap.state === 'snapshotted'); snapshotId = snap.snapshot.id;
      store.hosts.logins.insert({ name: 'work', kind, harness: 'codex', account: 'work', provider: 'fake', region: 'fake-1', volumeId, snapshotIds: [snapshotId], lastSignIn: null });
    } else {
      writeLoginKey(f.root, 'sentinel-project', 'work', 'SENTINEL-web-key');
      store.hosts.logins.insert({ name: 'work', kind, harness: 'opencode', account: 'work', lastSignIn: null });
    }
    store.hosts.logins.transition('work', 'ready');
  } finally { store.close(); }
  const cli = await connectUi(t, f.hub.discovery, 'cli');
  const listed = async () => { const reply = await cli.request({ type: 'login.list' }); assert.equal(reply.ok, true); return reply.value as Array<{ name: string }>; };
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-login-name="work"]');
    if (kind === 'key') assert.equal(await row.getByRole('button', { name: 'Snapshot', exact: true }).count(), 0);
    const remove = row.getByRole('button', { name: 'Remove', exact: true });
    await remove.click({ timeout: testWaitMs(1500) });
    const group = row.getByRole('group', { name: 'Confirm Remove work' });
    assert.match(await group.innerText(), kind === 'disk' ? /work.*volume and snapshots.*deleted/s : /work.*key file.*deleted/s);
    await group.getByRole('button', { name: 'Cancel', exact: true }).click();
    await remove.waitFor(); assert.deepEqual((await listed()).map(r => r.name), ['work']);
    await remove.click();
    const fold = page.getByRole('button', { name: 'Fold Hosts', exact: true });
    await fold.click(); await fold.click(); await remove.waitFor();
    assert.equal(await group.count(), 0);
    assert.deepEqual((await listed()).map(r => r.name), ['work']);
    if (kind === 'disk') {
      assert.equal((await provider.listVolumes({ project: f.root })).state, 'listed');
      assert.equal((await provider.getSnapshot(snapshotId)).state, 'found');
    } else assert.equal(existsSync(join(f.root, '.cland/auth/work.key')), true);
    await remove.click();
    const removed = until(async () => (await listed()).length === 0, { what: 'login removal committed' });
    void removed.catch(() => {});
    try { await group.getByRole('button', { name: 'Confirm', exact: true }).click(); await removed; }
    finally { await Promise.allSettled([removed]); }
    await row.waitFor({ state: 'detached' });
    assert.deepEqual(await listed(), []);
    if (kind === 'disk') {
      assert.deepEqual(await provider.listVolumes({ project: f.root }), { state: 'listed', volumes: [] });
      assert.equal((await provider.getSnapshot(snapshotId)).state, 'failed');
    } else assert.equal(existsSync(join(f.root, '.cland/auth/work.key')), false);
  });
});

test('Hosts Snapshot reports durable success and provider window refusal on the disk line', async t => {
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n');
  }, startHub: (root, env, options) => projectHub(t, root,
    fixtureEnvironment(root, env, { CLAND_FAKE_HOST_ROOT: root }), { ...options, processes, droplet: { processes } }) });
  const provider = new FakeHostProvider({ env: f.hub.hostEnvironment, now: () => clock.now().getTime() });
  const made = await provider.createVolume({ project: f.root, name: 'work', region: 'fake-1', sizeGiB: 1 });
  assert.ok(made.state === 'created');
  const store = new Store(join(f.root, '.cland/hub.db'));
  try {
    store.hosts.logins.insert({ name: 'work', kind: 'disk', harness: 'codex', account: 'work', provider: 'fake', region: 'fake-1', volumeId: made.volume.id, snapshotIds: [], lastSignIn: null });
    store.hosts.logins.transition('work', 'ready');
  } finally { store.close(); }
  const cli = await connectUi(t, f.hub.discovery, 'cli');
  const listed = async () => { const reply = await cli.request({ type: 'login.list' }); assert.equal(reply.ok, true); return reply.value as Array<{ name: string; snapshotIds: string[] }>; };
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-login-name="work"]'), snapshot = row.getByRole('button', { name: 'Snapshot', exact: true });
    await row.waitFor();
    const committed = until(async () => (await listed())[0]?.snapshotIds.length === 1, { what: 'snapshot committed to login list' });
    void committed.catch(() => {});
    try { await snapshot.click({ timeout: testWaitMs(1500) }); await committed; }
    finally { await Promise.allSettled([committed]); }
    await row.getByRole('status').waitFor();
    const after = await listed();
    assert.equal(after[0]!.snapshotIds.length, 1);
    const id = after[0]!.snapshotIds[0]!;
    assert.match(await row.getByRole('status').innerText(), new RegExp('snapshotted: ' + id));
    assert.equal((await provider.getSnapshot(id)).state, 'found');
    await snapshot.click();
    await row.getByRole('alert').waitFor();
    assert.match(await row.getByRole('alert').innerText(), /refused: rate limited/);
    assert.deepEqual((await listed())[0]!.snapshotIds, [id]);
    assert.equal((await provider.getSnapshot(id)).state, 'found');
  });
});

test('Hosts Remove hides bound actions and keeps hub refusal on the retained login', async t => {
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n');
    const store = new Store(join(root, '.cland/hub.db'));
    try {
      for (const name of ['signing']) {
        store.hosts.logins.insert({ name, kind: 'disk', harness: 'codex', account: name, provider: 'fake', region: 'fake-1', volumeId: 'v-' + name, snapshotIds: [], lastSignIn: null });
      }
    } finally { store.close(); }
  }, startHub: (root, env, options) => projectHub(t, root, fixtureEnvironment(root, env, { CLAND_FAKE_HOST_ROOT: root }), { ...options, processes, droplet: { processes } }) });
  // Startup reconciliation is complete before this view-boundary fixture is admitted.
  // A real fake-provider disk avoids a missing-volume state; the clock stays still.
  const provider = new FakeHostProvider({ env: f.hub.hostEnvironment, now: () => clock.now().getTime() });
  const made = await provider.createVolume({ project: f.root, name: 'bound', region: 'fake-1', sizeGiB: 1 });
  assert.ok(made.state === 'created');
  const store = new Store(join(f.root, '.cland/hub.db'));
  try {
    store.hosts.logins.insert({ name: 'bound', kind: 'disk', harness: 'codex', account: 'bound', provider: 'fake', region: 'fake-1', volumeId: made.volume.id, snapshotIds: [], lastSignIn: null });
    store.hosts.logins.transition('bound', 'ready');
    store.hosts.logins.bind('bound', { host: 'host-sentinel', role: 'writer', volumeId: made.volume.id });
  } finally { store.close(); }
  const cli = await connectUi(t, f.hub.discovery, 'cli');
  const listed = async () => { const r = await cli.request({ type: 'login.list' }); assert.equal(r.ok, true); return r.value as Array<{ name: string; state: string; bindings: Array<{ host: string }> }>; };
  const before = await listed();
  const boundLogin = before.find(row => row.name === 'bound');
  assert.equal(boundLogin?.state, 'in-use');
  assert.deepEqual(boundLogin.bindings.map(binding => binding.host), ['host-sentinel']);
  const refused = await cli.request({ type: 'login.remove', name: 'signing' });
  assert.equal(refused.ok, false); assert.match(refused.error!, /sign-in.*running/);
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const bound = page.locator('[data-login-name="bound"]'); await bound.waitFor();
    assert.match(await bound.innerText(), /in-use.*hosts: host-sentinel/s);
    assert.equal(await bound.getByRole('button', { name: 'Remove', exact: true }).count(), 0);
    const row = page.locator('[data-login-name="signing"]');
    await row.getByRole('button', { name: 'Remove', exact: true }).click();
    await row.getByRole('button', { name: 'Confirm', exact: true }).click();
    await row.getByRole('alert').waitFor();
    assert.equal(await row.getByRole('alert').innerText(), refused.error);
    assert.deepEqual(await listed(), before);
    assert.equal(await row.count(), 1);
  });
});
