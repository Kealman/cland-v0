// T2: doctor through the local hub with a scripted provider; no native harness.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { doctor, initialised, toolchain } from './doctor-fixture.ts';
import { projectHub } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { onCleanup } from './process-cleanup.ts';
import type { Check } from '../src/doctor/report.ts';
import { poolImageKey } from '../src/host/provider/pool-image.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { testHost } from '../src/host/test-host.ts';
import { reserveHostSpend, settleHostSpend } from '../src/executor/droplet/spend.ts';
import { legacyRemoteHubFixture } from './fakes/legacy-remote-hub.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';

const rows = (text: string): Check[] => JSON.parse(text).checks;
const named = (checks: Check[], name: string) => { const row = checks.find(c => c.name === name); assert.ok(row, name); return row; };
test('doctor warns for every missing role pool without writes or provider requests', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  const roles = '[implementer.launch]\nharness="codex"\npool="agents"\n[reviewer.launch]\nharness="codex"\npool="workers"\n';
  await writeFile(join(root, '.cland/roles.toml'), roles);
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const api = await fakeDigitalOcean('cland-test-missing-pool', { machine: 'scripted', clock, testContext: t });
  onCleanup(t, () => api.close());
  await projectHub(t, root, {}, { clock, processes, droplet: { processes, api: api.provider } });
  const config = await readFile(join(root, '.cland/config.toml'), 'utf8');
  for (const args of [[], ['--json']]) {
    const result = await doctor(root, tools.env, ...args);
    if (args.length) {
      const checks = rows(result.stdout);
      for (const [role, pool] of [['implementer', 'agents'], ['reviewer', 'workers']]) {
        assert.deepEqual(named(checks, `host ${role} placement`), { name: `host ${role} placement`, verdict: 'warn',
          detail: `role ${role}: pool ${pool} is not configured`,
          fix: `cland config set hosts.${pool}.provider digitalocean; cland hub reload OR cland role launch ${role} --pool local; cland hub reload` });
      }
    } else assert.match(result.stdout, /warn.*host implementer placement.*pool agents is not configured/);
  }
  assert.equal(await readFile(join(root, '.cland/roles.toml'), 'utf8'), roles);
  assert.equal(await readFile(join(root, '.cland/config.toml'), 'utf8'), config);
  assert.deepEqual(api.requests, []);
});
for (const present of [false, true]) test(`C1/C6 doctor reads hub token presence=${present} without provider calls`, async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n');
  const token = 'cland-test-provider-diagnostics', clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const api = await fakeDigitalOcean(token, { machine: 'scripted', clock, testContext: t });
  onCleanup(t, () => api.close());
  const hub = await projectHub(t, root, {}, { clock, processes, droplet: { processes, api: api.provider }, ...(present ? { syntheticProvider: { token, api: api.provider } } : {}) });
  const before = structuredClone(api.requests);
  for (const args of [[], ['--json']]) {
    const result = await doctor(root, tools.env, ...args);
    assert.equal(result.stdout.includes(token), false);
    if (args.length) {
      const row = named(rows(result.stdout), 'host digitalocean token');
      assert.equal(row.verdict, present ? 'ok' : 'warn');
      if (present) assert.match(row.detail, /aea02ac771f2/);
      else assert.match(row.fix!, /DIGITALOCEAN_TOKEN.*hub.*cland hub stop && cland hub start/);
    } else assert.match(result.stdout, /host digitalocean token/);
  }
  assert.deepEqual(api.requests, before);
  assert.equal(api.requests.length, 0);
  const inventory = await askHubFrame(hub.discovery, { type: 'host.status' }, 3000, tools.env) as { pools: { hosts: unknown[] }[] };
  assert.deepEqual(inventory.pools.flatMap(p => p.hosts), []);
});

test('doctor accepts the previous host status shape and labels missing outage and spend unknown', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n');
  await legacyRemoteHubFixture(t, root, { hostStatus: () => ({ pools: [{ name: 'agents', capacity: { codex: 0 }, spend: { today: null, month: null }, hosts: [{ id: 'legacy', state: 'unreachable' }] }] }) }).start();
  const checks = rows((await doctor(root, tools.env, '--json')).stdout);
  assert.equal(named(checks, 'host legacy reachability').detail, 'unreachable; outage since unknown');
  assert.equal(named(checks, 'host spend').detail, 'unknown today / $3.0000 daily cap');
  assert.equal(named(checks, 'host spend').verdict, 'warn');
  assert.equal(named(checks, 'host digitalocean token').detail, 'provider status unavailable');
  assert.equal(named(checks, 'host agents logins').detail, 'free login count unavailable');
});

test('C2 doctor names a changed lock and the image prepare command', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n');
  await writeFile(join(root, 'package-lock.json'), 'original lock');
  const key = await poolImageKey(root, tools.env, 'digitalocean');
  await mkdir(join(root, '.cland/run/hosts'), { recursive: true });
  await writeFile(join(root, '.cland/run/hosts/agents-image.json'), JSON.stringify({ key }));
  assert.equal(named(rows((await doctor(root, tools.env, '--json')).stdout), 'host agents image').verdict, 'ok');
  await writeFile(join(root, 'package-lock.json'), 'changed lock');
  const row = named(rows((await doctor(root, tools.env, '--json')).stdout), 'host agents image');
  assert.equal(row.verdict, 'warn');
  assert.equal(row.detail, 'stale: lock');
  assert.equal(row.fix, 'cland host prepare agents');
});

test('C7 doctor reports no pool and hub-backed unknowns with their fix', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  const none = rows((await doctor(root, tools.env, '--json')).stdout).filter(c => c.name === 'hosts' || c.name.startsWith('host '));
  assert.deepEqual(none, [{ name: 'hosts', verdict: 'ok', detail: 'no host pool' }]);
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n');
  const checks = rows((await doctor(root, tools.env, '--json')).stdout);
  for (const name of ['host digitalocean token', 'host logins', 'host reachability', 'host spend']) {
    assert.deepEqual(named(checks, name), { name, verdict: 'warn', detail: 'hub not running', fix: 'cland hub start' });
  }
  assert.deepEqual(named(checks, 'host agents image'), { name: 'host agents image', verdict: 'warn', detail: 'absent', fix: 'cland host prepare agents' });
});

test('C3/C4/C5 doctor reports free and signed-out logins, outage start and 80 percent spend', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[hosts]\ndaily_spend_usd=1\n[hosts.agents]\nprovider="fake"\nmin_hosts=0\n');
  const rolesPath = join(root, '.cland/roles.toml');
  await writeFile(rolesPath, (await readFile(rolesPath, 'utf8')).replace('[implementer.launch]', '[implementer.launch]\npool="agents"'));
  const clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  let records!: import('../src/host/records.ts').HostRecords;
  let transition!: (id: string, up: boolean, at: Date) => void;
  const hub = await projectHub(t, root, {}, { clock, processes, droplet: { processes }, hosts: [testHost('offline', () => {})], createHostRegistry: async options => {
    records = options.records;
    const registry = await projectSshHosts(options), subscribe = registry.subscribeStatus;
    registry.subscribeStatus = listener => { transition = listener; return subscribe(listener); };
    return registry;
  } });
  const run = async () => rows((await doctor(root, tools.env, '--json')).stdout);
  let checks = await run();
  assert.equal(named(checks, 'host spend').verdict, 'ok');
  assert.equal(named(checks, 'host agents codex logins').detail, '0 free');
  assert.equal(named(checks, 'host agents codex logins').fix, 'cland login add codex --pool agents');
  records.logins.insert({ name: 'work', harness: 'codex', account: '', kind: 'disk', provider: 'fake', region: 'lon1', volumeId: 'fixture-volume', snapshotIds: [], lastSignIn: null });
  records.logins.transition('work', 'ready');
  checks = await run();
  assert.equal(named(checks, 'host agents codex logins').detail, '1 free');
  assert.equal(named(checks, 'host agents codex logins').verdict, 'ok');
  records.logins.markSignedOut('work', { reason: 'test expired', host: null });
  const now = clock.now().toISOString();
  records.insert({ id: 'offline', address: 'fixture', user: 'fixture', clientKeyPath: '', knownHosts: '' }, 'fixture-secret');
  records.provisions.ready({ id: 'offline', pool: 'agents', provider: 'fake', size: 'fake', region: 'lon1', created: now, state: 'ready', machine: { id: 'offline', address: 'fixture', architecture: 'arm64', created: now } });
  assert.equal(named(await run(), 'host offline reachability').detail, 'ready');
  transition('offline', false, clock.now());
  await clock.advance(180000);
  checks = await run();
  assert.equal(named(checks, 'host login work').fix, 'cland login signin work');
  assert.equal(named(checks, 'host offline reachability').detail, `unreachable; outage since ${now}`);
  assert.equal(named(checks, 'host offline reachability').fix, 'cland host destroy offline');
  const end = clock.now().toISOString(), created = new Date(clock.now().getTime() - 3600000).toISOString();
  await reserveHostSpend({ project: root, lease: 'settled', pool: 'agents', size: 'fake', priceHourly: 0.8, billingMinimumMs: 0, created, deadline: end }, { shared: 100, hosts: 100 }, hub.hostEnvironment, { clock, processes });
  await settleHostSpend(root, 'settled', end, hub.hostEnvironment, { clock, processes });
  // A row lacking billing makes spend unknown rather than pretending it is zero.
  records.provisions.save({ ...records.provisions.get('offline')!, state: 'destroyed', release: 'released' });
  checks = await run();
  assert.equal(named(checks, 'host spend').verdict, 'warn');
  assert.equal(named(checks, 'host spend').detail, '$0.8000 today / $1.0000 daily cap');
  assert.equal(named(checks, 'host spend').fix, 'cland config set hosts.daily_spend_usd 2');
});

for (const kind of ['key', 'shared', 'exclusive'] as const) test(`C3 doctor counts actual ${kind} logins only for placed harnesses`, async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  const harness = kind === 'key' ? 'opencode' : 'codex';
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nmin_hosts=0\nmax_hosts=2\n');
  await writeFile(join(root, '.cland/roles.toml'), `[implementer.launch]\npool="agents"\nharness="${harness}"\n`);
  let records!: import('../src/host/records.ts').HostRecords;
  const processes = fakeLockProcesses().processes;
  await projectHub(t, root, {}, { clock: new FakeClock(Date.now()), processes, droplet: { processes }, createHostRegistry: async options => { records = options.records; return projectSshHosts(options); } });
  const count = kind === 'exclusive' ? 3 : 1;
  for (let i = 0; i < count; i++) {
    records.logins.insert(kind === 'key'
      ? { name: `login-${i}`, harness: 'opencode', account: '', kind: 'key', lastSignIn: null }
      : { name: `login-${i}`, harness: 'codex', account: '', kind: 'disk', exclusive: kind === 'exclusive', provider: 'fake', region: 'lon1', volumeId: `volume-${i}`, snapshotIds: [], lastSignIn: null });
    records.logins.transition(`login-${i}`, 'ready');
  }
  records.logins.insert({ name: 'unplaced', harness: 'claude-code', account: '', kind: 'disk', provider: 'fake', region: 'other-region', volumeId: 'unplaced-volume', snapshotIds: [], lastSignIn: null });
  records.logins.transition('unplaced', 'ready');
  const created = new Date().toISOString();
  records.provisions.save({ id: 'historical', pool: 'removed', provider: 'fake', size: 'fake', region: 'lon1', created, state: 'failed' });
  const checks = rows((await doctor(root, tools.env, '--json')).stdout);
  assert.equal(named(checks, `host agents ${harness} logins`).detail, `${count} free`);
  assert.equal(checks.some(row => row.name === 'host agents claude-code logins'), false);
  assert.equal(checks.some(row => row.name.startsWith('host removed ') && row.name.endsWith(' logins')), false);
});
