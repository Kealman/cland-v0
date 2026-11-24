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
import { ownDirectory, onCleanup, beforeDirectories, guardDirectoryRemoval } from '../../hub/test/process-cleanup.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { settledLogin } from '../../hub/test/settled-login-fixture.ts';
import { hostGenerationKey } from '../../hub/src/adapters/processes.ts';
import type { HarnessProcess } from '../../hub/src/adapters/contract.ts';
import { fakeLockProcesses } from '../../hub/test/fakes/lock-processes.ts';
import { projectSshHosts } from '../../hub/src/host/registry.ts';
import { join } from 'node:path';
import { ensureWebBuild } from '../../hub/test/web-build.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { webFixture, resizePage, pausePageClock } from './harness.ts';
import { connectUi, tempProject } from '../../hub/test/harness.ts';
import { caseDeadlines } from '../../hub/test/case-deadlines.ts';
import type { AskCard, Inbox, TopicMessage, HubFrame, HostsStatePool } from '../../shared/wire/index.ts';
import { until, testWaitMs, waitTimeoutMs } from '../../hub/test/until.ts';

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

for (const harness of ['codex', 'claude-code'] as const) for (const renewal of [false, true]) for (const elsewhere of harness === 'claude-code' && renewal ? [false, true] : [false]) for (const slow of harness === 'codex' ? [false, true] : [false]) for (const boundary of slow ? ['held', 'fold', 'reload'] : ['held']) for (const legacy of !slow && harness === 'codex' && !renewal ? [false, true] : [false]) test(`Hosts ${renewal ? 'renew' : 'Add'} shows the shared ${harness} card and ${harness === 'claude-code' && !renewal ? 'expires without input' : 'clears sent input'}${elsewhere ? ' from another surface' : ''}${slow ? ' after slow preparation' : ''}${boundary === 'held' ? '' : ` before receipt ${boundary}`}${legacy ? ' at previous wire shape' : ''}`, async t => {
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const closed = Promise.withResolvers<import('../../hub/src/host/host.ts').SignInClose>();
  let received = '', prepares = 0;
  const allowed = Promise.withResolvers<void>();
  onCleanup(t, () => allowed.resolve());
  const sent: string[] = [];
  const receipts: Array<{ name: string; card: string }> = [];
  let records!: HostRecords;
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n');
    await writeFile(join(root, '.cland/roles.toml'), `[implementer.launch]\npool="agents"\nharness="${harness}"\n`);
  }, startHub: (root, env, options) => projectHub(t, root, fixtureEnvironment(root, env), {
    ...options, processes, droplet: { processes },
    prepareLogin: async (o, input) => {
      prepares++;
      if (slow) await allowed.promise;
      const name = input.name ?? 'web-login';
      records = o.records;
      if (!input.signin) o.records.logins.insert({ name, harness: input.harness, account: name, kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: 'v', snapshotIds: [], lastSignIn: null });
      const admission = input.signin ? o.records.logins.beginSignIn(name) : null;
      return { plan: { name, host: 'fake-host', command: 'ssh', args: [] }, pending: { name, path: '/cland/auth/' + name, complete: async code => {
        if (code === 0) return admission ? o.records.logins.finishSignIn(name, admission, clock.now().toISOString()) : o.records.logins.transition(name, 'ready');
        o.records.logins.markSignedOut(name, { host: null, reason: 'fixture closed' }); return o.records.logins.get(name)!;
      } } };
    }, runLoginSignIn: async (_input, output) => {
      output({ admission: 'web-run', stream: 'stdout', text: `https://login.example.test/${harness} Device code: FAKE-1234\n` });
      return { admission: 'web-run', closed: closed.promise, write: async text => { received = text; closed.resolve({ admission: 'web-run', state: 'closed', code: 0, signal: null }); }, cancel: async () => {
        const receipt = { admission: 'web-run', state: 'closed' as const, code: null, signal: 'SIGTERM' }; closed.resolve(receipt); return receipt;
      } };
    },
  }) });
  const cli = await connectUi(t, f.hub.discovery, 'cli');
  if (renewal) {
    const store = new Store(join(f.root, '.cland/hub.db'));
    try {
      store.hosts.logins.insert({ name: 'web-login', harness, account: 'web-login', kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: 'v', snapshotIds: [], lastSignIn: null });
      store.hosts.logins.markSignedOut('web-login', { host: null, reason: 'fixture signout' });
    } finally { store.close(); }
  }
  await f.pageCase(t, async page => {
    const output: string[] = []; page.on('console', m => output.push(m.text()));
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const pool = page.getByRole('region', { name: 'Hosts in agents' });
    if (renewal) await page.locator('[data-login-name="web-login"]').getByRole('button', { name: 'Sign in again' }).click();
    else {
    await pool.getByRole('button', { name: 'Add', exact: true }).click({ timeout: testWaitMs(1500) });
    await pool.getByLabel('Harness').selectOption(harness);
    await pool.getByLabel('Name').fill('web-login');
    await pool.getByRole('button', { name: 'Start sign-in' }).click();
    }
    if (slow) {
      await until(() => prepares === 1, { what: 'one sign-in preparation admitted before deadline advance' });
      await clock.advance(10_001); await page.clock.runFor(10_001);
      const submit = renewal ? page.locator('[data-login-name="web-login"]').getByRole('button', { name: 'Sign in again' }) : pool.getByRole('button', { name: 'Start sign-in' });
      assert.equal(await submit.isDisabled(), true, 'pending sign-in stays fenced past the generic deadline');
      const bounds = await submit.boundingBox(); assert.ok(bounds);
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      assert.equal(prepares, 1);
      assert.equal(sent.filter(type => type === (renewal ? 'login.signin' : 'login.add')).length, 1);
      if (boundary === 'fold') {
        const fold = page.getByRole('button', { name: 'Fold Hosts', exact: true }); await fold.click(); await fold.click();
      } else if (boundary === 'reload') await page.reload();
      allowed.resolve();
    }
    const row = page.locator('[data-login-name="web-login"]');
    await row.getByRole('link', { name: `https://login.example.test/${harness}` }).waitFor({ timeout: testWaitMs(2000) });
    const originalCard = await row.locator('[data-signin-card]').getAttribute('data-signin-card');
    if (boundary === 'reload') assert.deepEqual(receipts, [], 'reload destroyed the old result callback before capture');
    else assert.deepEqual(receipts, [{ name: 'web-login', card: originalCard }]);
    const persisted = new Store(join(f.root, '.cland/hub.db'));
    try { assert.equal(persisted.openAsks().find(ask => ask.hubKind === 'login-signin-code' && (ask.payload as {login?:string}).login === 'web-login')?.id, originalCard); }
    finally { persisted.close(); }
    const fold = page.getByRole('button', { name: 'Fold Hosts', exact: true });
    await fold.click(); await fold.click();
    await row.getByRole('link', { name: `https://login.example.test/${harness}` }).waitFor({ timeout: testWaitMs(1000) });
    assert.equal(await row.locator('[data-signin-card]').getAttribute('data-signin-card'), originalCard);
    await page.reload();
    await row.getByRole('link', { name: `https://login.example.test/${harness}` }).waitFor({ timeout: testWaitMs(2000) });
    assert.equal(await row.locator('[data-signin-card]').getAttribute('data-signin-card'), originalCard);
    if (harness === 'claude-code' && !renewal) {
      await clock.advance(15 * 60 * 1000);
      await until(async () => { const reply = await cli.request({ type: 'login.list' }); return (reply.value as Array<{state:string}>)[0]?.state === 'signed-out'; }, { what: 'expired writer closed and login signed out' });
      await clock.advance(1000);
      await until(async () => /signed-out/.test(await row.innerText()), { what: 'expired login rendered signed-out' });
      assert.match(await row.innerText(), /fixture closed/);
      assert.equal(await row.getByLabel('Sign-in code').count(), 0);
      assert.equal(received, ''); return;
    }
    if (harness === 'codex') {
      assert.match(await row.innerText(), /FAKE-1234/);
      closed.resolve({ admission: 'web-run', state: 'closed', code: 0, signal: null });
    } else {
      await row.getByLabel('Sign-in code').fill('SENTINEL-inline-code');
      if (elsewhere) {
        const answer = await cli.request({ type: 'topic.answer', ask: originalCard!, text: 'SENTINEL-inline-code' });
        assert.equal(answer.ok, true, answer.error);
        await row.getByLabel('Sign-in code').waitFor({ state: 'detached' });
      } else await row.getByRole('button', { name: 'Send code' }).click();
    }
    await until(async () => { const r = await cli.request({ type: 'login.list' }); return (r.value as Array<{state:string}>)[0]?.state === 'ready'; }, { what: 'login.list durable ready' });
    await clock.advance(1000); if (slow) await page.clock.runFor(1000);
    await until(async () => /ready/.test(await row.innerText()), { what: 'ready login rendered' });
    assert.equal(records.logins.get('web-login')?.kind === 'disk' && (records.logins.get('web-login') as {volumeId:string}).volumeId, 'v');
    assert.equal(received, harness === 'claude-code' ? 'SENTINEL-inline-code\n' : '');
    assert.equal((await page.locator('body').innerText()).includes('SENTINEL-inline-code'), false);
    assert.equal(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]).includes('SENTINEL-inline-code')), false);
    assert.equal(output.join('\n').includes('SENTINEL-inline-code'), false);
    assert.equal(prepares, 1);
    assert.equal(sent.filter(type => type === (renewal ? 'login.signin' : 'login.add')).length, 1);
  }, async page => {
    if (slow) await pausePageClock(page, clock.now());
    if (legacy) await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      const previousShape = (value: unknown): unknown => Array.isArray(value) ? value.map(previousShape) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'signInLogin').map(([key, child]) => [key, previousShape(child)])) : value;
      server.onMessage(message => route.send(JSON.stringify(previousShape(JSON.parse(String(message))))));
    });
    page.on('websocket', socket => {
      socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)) as { type: string }; sent.push(frame.type); });
      socket.on('framereceived', event => {
        const frame = JSON.parse(String(event.payload)) as HubFrame;
        if (frame.type !== 'result' || !frame.ok) return;
        const value = frame.value as { name?: string; card?: string } | undefined;
        if (typeof value?.name === 'string' && typeof value.card === 'string') receipts.push({ name: value.name, card: value.card });
      });
    });
  });
});

test('Hosts Add moves the real inbox login wait through booting to placed', async t => {
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const closed = Promise.withResolvers<import('../../hub/src/host/host.ts').SignInClose>();
  let records!: HostRecords;
  const booted = Promise.withResolvers<void>();
  onCleanup(t, () => booted.resolve());
  const f = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nslots=1\nmin_hosts=0\n');
    await writeFile(join(root, '.cland/roles.toml'), '[implementer.launch]\npool="agents"\nharness="codex"\n');
  }, startHub: (root, env, options) => {
    const sealed = fixtureEnvironment(root, env, { CLAND_FAKE_HOST_ROOT: root }), local = localHost(sealed);
    const host = { ...testHost('waiting-host', () => {}), layout: local.layout, realpath: local.realpath,
      statDirectory: async () => ({ refusal: null, identity: null }), loginDisk: async () => {}, listFolder: async () => [] };
    return projectHub(t, root, sealed, { ...options, processes, droplet: { processes }, hosts: [host],
      createHostRegistry: async options => { records = options.records; return projectSshHosts(options); },
      createHost: async o => {
        const provider = new FakeHostProvider({ env: sealed, now: () => clock.now().getTime() });
        const acquired = await provider.acquire({ project: root, pool: 'agents', architecture: 'arm64', region: 'fake-1' });
        assert.equal(acquired.state, 'created'); if (acquired.state !== 'created') throw Error('fixture machine');
        ownDirectory(t, hostDirectory(root, acquired.machine.id));
        const row = { id: host.name, pool: 'agents', provider: 'fake', size: 'small', region: 'fake-1', state: 'booting' as const, created: clock.now().toISOString(), machine: acquired.machine };
        new HostSecretStore(root, o.records, () => {}).register({ id: host.name, address: acquired.machine.address, user: 'fixture', clientKeyPath: '', knownHosts: '' });
        o.records.provisions.save(row); await booted.promise; return { ...row, state: 'ready' as const };
      },
      prepareLogin: async (o, input) => {
        const provider = new FakeHostProvider({ env: sealed, now: () => clock.now().getTime() });
        const made = await provider.createVolume({ project: root, name: 'web-login', region: 'fake-1', sizeGiB: 1 });
        assert.equal(made.state, 'created'); if (made.state !== 'created') throw Error('fixture volume');
        o.records.logins.insert({ name: 'web-login', harness: input.harness, account: 'web-login', kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: made.volume.id, snapshotIds: [], lastSignIn: null });
        return { plan: { name: 'web-login', host: host.name, command: 'ssh', args: [] }, pending: { name: 'web-login', path: '/cland/auth/web-login', complete: async code => {
          assert.equal(code, 0); return o.records.logins.transition('web-login', 'ready');
        } } };
      }, runLoginSignIn: async (_input, output) => {
        output({ admission: 'waiting-signin', stream: 'stdout', text: 'https://login.example.test/codex Device code: FAKE-1234\n' });
        return { admission: 'waiting-signin', closed: closed.promise, write: async () => {}, cancel: async () => {
          const receipt = { admission: 'waiting-signin', state: 'closed' as const, code: null, signal: 'SIGTERM' }; closed.resolve(receipt); return receipt;
        } };
      },
    });
  } });
  const cli = await connectUi(t, f.hub.discovery, 'cli');
  const launch = await cli.request({ type: 'session.launch', name: 'waiting-worker', role: 'implementer', harness: 'codex', cwd: f.root });
  assert.equal(launch.ok, true, launch.error);
  assert.equal((launch.value as { waiting: { reason: string } }).waiting.reason, 'waiting for a login codex');
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.getByRole('region', { name: 'Hosts in agents' }).getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Start sign-in' }).click();
    await page.locator('[data-signin-card]').waitFor();
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await page.locator('[data-waiting-launch="waiting-worker"] [data-waiting-reason]').filter({ hasText: 'waiting for a login codex' }).waitFor();
    closed.resolve({ admission: 'waiting-signin', state: 'closed', code: 0, signal: null });
    await until(() => records.provisions.get('waiting-host')?.state === 'booting', { what: 'pool runtime persisted booting host' });
    await clock.advance(1000);
    await page.locator('[data-waiting-launch="waiting-worker"] [data-waiting-reason]').filter({ hasText: 'waiting for host waiting-host to boot' }).waitFor({ timeout: waitTimeoutMs(15000) });
    records.provisions.ready({ ...records.provisions.get('waiting-host')!, state: 'ready' });
    booted.resolve();
    await clock.advance(1000);
    await until(async () => {
      const reply = await cli.request({ type: 'session.list' });
      return (reply.value as { processes: Array<{ name: string; host: string }> }).processes.some(row => row.name === 'waiting-worker' && row.host === 'waiting-host');
    }, { what: 'pool launch committed process on waiting-host', timeoutMs: 3000 });
    await clock.advance(1000);
    await page.locator('[data-waiting-launch="waiting-worker"] [data-waiting-reason]').filter({ hasText: 'waiting for host waiting-host to boot' }).waitFor({ state: 'detached' });
    const inbox = await cli.request({ type: 'inbox.list' });
    assert.deepEqual((inbox.value as { waitingLaunches: unknown[] }).waitingLaunches, []);
    assert.equal(f.hub.fakes.codex!.spawns.length, 1);
  });
});

for (const harness of ['codex', 'claude-code'] as const) test(`Hosts native ${harness} Add completes the fake harness disk sign-in`, { timeout: testWaitMs(60000) }, async t => {
  const { fixture } = await import('../../hub/test/login-native-fixture.ts');
  const { nativeSignInTrace } = await import('../../hub/test/login-card-signin-trace.ts');
  const trace = nativeSignInTrace();
  let records!: HostRecords;
  const plans: Array<{ name: string; host: string; signin: boolean }> = [];
  const prepare: typeof trace.prepare = async (options, input) => {
    records = options.records;
    const prepared = await trace.prepare(options, input);
    plans.push({ name: prepared.plan.name, host: prepared.plan.host, signin: input.signin === true });
    return prepared;
  };
  const native = await fixture(t, { cardSignIn: { prepareLogin: prepare } });
  let readyPublished = false, signedOutPublished = false;
  const f = await webFixture(t, { project: async () => ({ root: native.root }), startHub: async () => native.hub });
  const cli = await connectUi(t, native.hub.discovery, 'cli');
  const configured = await cli.request({ type: 'role.launch', role: 'implementer', fields: { harness, pool: 'agents' } });
  assert.equal(configured.ok, true, configured.error);
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const pool = page.getByRole('region', { name: 'Hosts in agents' });
    await pool.getByRole('button', { name: 'Add', exact: true }).click();
    await pool.getByLabel('Harness').selectOption(harness);
    await pool.getByLabel('Name').fill('native-web');
    await pool.getByRole('button', { name: 'Start sign-in' }).click();
    const row = page.locator('[data-login-name="native-web"]');
    if (harness === 'claude-code') {
      await row.getByRole('link', { name: 'https://login.example.test/claude', exact: true }).waitFor({ timeout: testWaitMs(15000) });
      await row.getByLabel('Sign-in code').fill('SENTINEL-native-web');
      await row.getByRole('button', { name: 'Send code' }).click();
    }
    await until(async () => {
      const reply = await cli.request({ type: 'login.list' });
      return (reply.value as Array<{ name: string; state: string }>).some(login => login.name === 'native-web' && login.state === 'ready');
    }, { what: 'native fake harness committed ready disk', timeoutMs: testWaitMs(15000) });
    await until(async () => /ready/.test(await row.innerText()), { what: 'native ready disk rendered' });
    assert.equal((await page.locator('body').innerText()).includes('SENTINEL-native-web'), false);
    const store = native.own(new Store(join(native.root, '.cland/hub.db')));
    const login = store.hosts.logins.get('native-web')!;
    assert.equal(login.kind, 'disk');
    if (login.kind !== 'disk') throw Error('fixture disk');
    assert.equal(login.snapshotIds.length, 1);
    assert.ok(login.lastSignIn);
    const hosts = store.hosts.provisions.list().map(host => host.id);
    assert.equal(hosts.length, 1);
    await until(() => readyPublished, { what: 'prior ready coalesced hosts.state observed by browser', timeoutMs: testWaitMs(3000) });
    assert.equal(readyPublished, true);
    const path = join(native.root, 'volumes', login.volumeId! + '.contents/login.json');
    const { readFile } = await import('node:fs/promises');
    const stamp = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, JSON.stringify({ ...stamp, dead: true }));
    records.logins.markSignedOut(login.name, { host: null, reason: 'native renewal control' });
    await until(() => signedOutPublished, { what: 'hub-owned sign-out published independently', timeoutMs: testWaitMs(3000) });
    await until(async () => /signed-out.*native renewal control/s.test(await row.innerText()), { what: 'hub-owned sign-out rendered before renewal' });
    assert.match(await row.innerText(), /signed-out.*native renewal control/s);
    await row.getByRole('button', { name: 'Sign in again' }).click({ timeout: testWaitMs(5000) });
    if (harness === 'claude-code') {
      await row.getByLabel('Sign-in code').waitFor({ timeout: testWaitMs(15000) });
      await row.getByLabel('Sign-in code').fill('SENTINEL-native-renew');
      await row.getByRole('button', { name: 'Send code' }).click();
    }
    await until(() => store.hosts.logins.get(login.name)?.state === 'ready', { what: 'native renewed disk ready', timeoutMs: testWaitMs(15000) });
    await until(async () => /ready/.test(await row.innerText()), { what: 'native renewed ready rendered' });
    const renewed = store.hosts.logins.get(login.name)!;
    assert.equal(renewed.kind === 'disk' && renewed.volumeId, login.volumeId);
    assert.deepEqual(store.hosts.provisions.list().map(host => host.id), hosts);
    assert.deepEqual(plans, [{ name: login.name, host: hosts[0], signin: false }, { name: login.name, host: hosts[0], signin: true }]);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).dead, false);
    assert.deepEqual(trace.diagnostics().runs.map(run => ({ status: run.status, close: 'close' in run ? run.close : null })).map(run => [run.status, run.close && 'code' in run.close ? run.close.code : null]), [['closed', 0], ['closed', 0]]);
    t.diagnostic(JSON.stringify({ admittedPlans: plans, nativeCloses: trace.diagnostics().runs.map(run => 'close' in run ? run.close : null), volumeBefore: login.volumeId, volumeAfter: renewed.kind === 'disk' ? renewed.volumeId : null, priorReadyPublished: readyPublished, signedOutPublished }));
    assert.equal(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]).includes('SENTINEL-native-renew')), false);
    assert.equal((await page.locator('body').innerText()).includes('SENTINEL-native-renew'), false);
  }, async page => {
    // Observe real frames before navigation/action; no carrier or fabricated push.
    page.on('websocket', socket => socket.on('framereceived', event => {
      const frame = JSON.parse(String(event.payload)) as HubFrame;
      if (frame.type !== 'hosts.state') return;
      const login = frame.pools.find(pool => pool.name === 'agents')?.logins[harness];
      if (login?.usable === 1 && login.signedOut === 0) readyPublished = true;
      if (login?.signedOut === 1 && login.usable === 0) signedOutPublished = true;
    }));
  });
});

for (const actual of [false, true]) test(`Hosts Add harness choices use only pool roles and actual logins: actual ${actual}`, async t => {
  const f = await webFixture(t, { prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n[hosts.empty]\nprovider="fake"\nregion="empty-region"\nmin_hosts=0\n[hosts.logins]\nprovider="fake"\nregion="login-region"\nmin_hosts=0\n');
    await writeFile(join(root, '.cland/roles.toml'), '[implementer.launch]\npool="agents"\nharness="codex"\n');
    const store = new Store(join(root, '.cland/hub.db'));
    try {
      for (const [name, harness, region] of [['other', 'claude-code', 'other-region'], ['login-only', 'claude-code', 'login-region'], ...(actual ? [['actual', 'opencode', 'fake-1']] : [])]) {
        store.hosts.logins.insert({ name: name!, harness: harness as 'claude-code' | 'opencode', account: name!, kind: 'disk', provider: 'fake', region: region!, volumeId: 'v-' + name, snapshotIds: [], lastSignIn: null });
        store.hosts.logins.markSignedOut(name!, { host: null, reason: 'fixture signed out' });
      }
    } finally { store.close(); }
  } });
  await f.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const pool = page.getByRole('region', { name: 'Hosts in agents' });
    await pool.getByRole('button', { name: 'Add', exact: true }).click();
    assert.deepEqual(await pool.getByLabel('Harness').locator('option').allTextContents(), actual ? ['codex', 'opencode'] : ['codex']);
    assert.equal(await page.getByRole('region', { name: 'Hosts in empty' }).getByRole('button', { name: 'Add', exact: true }).isDisabled(), true);
    const loginPool = page.getByRole('region', { name: 'Hosts in logins' });
    await loginPool.getByRole('button', { name: 'Add', exact: true }).click();
    assert.deepEqual(await loginPool.getByLabel('Harness').locator('option').allTextContents(), ['claude-code']);
  });
});


test('retained cards keep Inbox, Hosts sign-in and remote thread order across delta and inbox publication', async t => {
  const owner = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  await owner.run(async step => {
    const f = await step(() => webFixture(owner.fixtures, { project: async () => {
      const root = await tempProject(owner.fixtures);
      owner.adoptRoot(root);
      return { root };
    }, prepare: async root => {
      await step(() => mkdir(join(root, '.cland'), { recursive: true }));
      const store = new Store(join(root, '.cland/hub.db'));
      try {
        for (const name of ['first', 'second']) {
          store.hosts.logins.insert({ name, harness: 'codex', account: name, kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: 'v-' + name, snapshotIds: [], lastSignIn: null });
          store.hosts.logins.transition(name, 'ready');
        }
      } finally { store.close(); }
    } }));
    const ts = new Date().toISOString();
    const cards: Record<string, AskCard> = {
      'host-z': { question: 'First login', options: [], free: true, state: 'open', signInLogin: 'first' },
      'host-a': { question: 'Second login', options: [], free: true, state: 'open', signInLogin: 'second' },
      'remote-z': { question: 'Telegram question', options: ['Keep', 'Wait'], free: true, state: 'open' },
      'remote-a': { question: 'Discord question', options: ['Keep', 'Wait'], free: true, state: 'open' },
    };
    // Three deliberately different caller orders; none matches id sorting or ingestion.
    const inboxOrder = ['host-a', 'remote-z', 'host-z', 'remote-a'];
    const hostOrder = ['host-z', 'host-a'], remoteOrder = ['remote-a', 'remote-z'];
    const messages: TopicMessage[] = remoteOrder.map((id, n) => ({ id, seq: n + 1, topic: 'general', from: 'human', fromKind: 'human', via: id === 'remote-a' ? 'discord' : 'telegram', to: [], text: cards[id]!.question, ts, ask: cards[id]! }));
    const inbox: Inbox = { asks: inboxOrder.map(id => ({ id, topic: { id: 'general', title: 'General' }, from: 'hub', label: 'hub', ts, since: ts, question: cards[id]!.question, options: cards[id]!.options, free: true, ...(cards[id]!.signInLogin ? { signInLogin: cards[id]!.signInLogin } : {}) })), approvals: [], plans: [], requests: [], messages: [], waiting: [], needsYou: 4 };
    const pools: HostsStatePool[] = [{ name: 'agents', provider: 'fake', region: 'fake-1', hostCount: 0, maxHosts: 4, slotsUsed: 0, slotsTotal: 0, logins: { codex: { inUse: 0, usable: 2, signedOut: 0 } }, alert: null, hosts: [] }];
    let push!: (frame: HubFrame) => void;
    await step(() => f.pageCase(owner.fixtures, async page => {
      for (const id of ['remote-z', 'host-a', 'remote-a', 'host-z']) push({ type: 'ask', topic: 'general', ask: id, card: cards[id]! });
      push({ type: 'inbox', inbox });
      const assertSurfaces = async () => {
        await page.getByRole('button', { name: 'Inbox', exact: true }).click();
        const list = page.getByRole('list', { name: 'Inbox objects', exact: true });
        await list.locator('[data-object-id="host-a"]').waitFor();
        assert.deepEqual(await list.locator('[data-inbox-section="asks"] [data-object-id]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-object-id'))), inboxOrder);
        for (const id of inboxOrder) {
          await list.locator(`[data-object-id="${id}"]`).click();
          const card = list.locator(`[data-ask-id="${id}"]`);
          await card.getByRole('heading', { name: cards[id]!.question, exact: true }).waitFor();
          assert.equal(await card.getByRole('heading').innerText(), cards[id]!.question);
        }
        assert.deepEqual(await list.locator('[data-inbox-section="asks"] [data-object-id]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-object-id'))), inboxOrder);
        await page.getByRole('button', { name: 'Sessions', exact: true }).click();
        const hosts = page.locator('[data-session-slot="hosts"]');
        await hosts.locator('[data-signin-card="host-z"]').waitFor();
        assert.deepEqual(await hosts.locator('[data-signin-card]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-signin-card'))), hostOrder);
        for (const [n, id] of hostOrder.entries()) {
          const row = hosts.locator(`[data-login-name="${n === 0 ? 'first' : 'second'}"] [data-signin-card="${id}"]`);
          assert.ok((await row.innerText()).includes(cards[id]!.question));
        }
        await page.getByRole('button', { name: 'Topics', exact: true }).click();
        await page.locator('[data-object-id="general"]').click();
        const log = page.getByRole('log', { name: 'General thread', exact: true });
        await log.locator('[data-ask-id="remote-z"]').waitFor();
        assert.deepEqual(await log.locator('[data-ask-id]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-ask-id'))), remoteOrder);
        for (const id of remoteOrder) {
          const row = log.locator(`[data-message-id="${id}"]`);
          assert.equal(await row.getByRole('heading').innerText(), cards[id]!.question);
          assert.match(await row.innerText(), id === 'remote-a' ? /via Discord/ : /via Telegram/);
        }
      };
      await step(assertSurfaces);
      const changed = page.getByRole('log', { name: 'General thread', exact: true }).getByRole('heading', { name: 'Telegram updated', exact: true }).waitFor();
      cards['remote-z'] = { ...cards['remote-z']!, question: 'Telegram updated' };
      cards['host-a'] = { ...cards['host-a']!, question: 'Second login updated' };
      push({ type: 'ask', topic: 'general', ask: 'remote-z', card: cards['remote-z'] });
      push({ type: 'ask', topic: 'general', ask: 'host-a', card: cards['host-a'] });
      await step(() => changed);
      // A unique flattened-row fact proves this exact publication was consumed;
      // its stale question must still not overwrite the newer retained card.
      const staleQuestion = 'Stale inbox republication receipt';
      const published = page.locator('[data-object-id="remote-z"]').getByText(staleQuestion, { exact: true }).waitFor();
      void published.catch(() => {});
      push({ type: 'inbox', inbox: { ...inbox, asks: inbox.asks.map(row => row.id === 'remote-z' ? { ...row, question: staleQuestion } : row) } });
      await step(() => page.getByRole('button', { name: 'Inbox', exact: true }).click());
      await step(() => published);
      assert.equal(await page.locator('[data-object-id="remote-z"]').getByText(staleQuestion, { exact: true }).innerText(), staleQuestion);
      await step(assertSurfaces);
    }, async page => {
      await step(() => page.routeWebSocket('**/ws', route => {
        push = frame => route.send(JSON.stringify(frame));
        const server = route.connectToServer();
        route.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; id: string };
          if (frame.type === 'topic.history') route.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { messages, runs: [], more: false } }));
          else server.send(message);
        });
        server.onMessage(message => {
          const frame = JSON.parse(String(message)) as HubFrame;
          if (frame.type === 'hosts.state') frame.pools = pools;
          if (frame.type === 'snapshot' && frame.domain === 'sessions') frame.value.hosts = pools;
          route.send(JSON.stringify(frame));
        });
      }));
    }));
  });
});
