import { seedPoolImages } from './digitalocean-pool-fixture.ts';
// T2: scripted DigitalOcean boundary and disposable provider records; no sockets or processes.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { DigitalOceanHostProvider } from '../src/host/provider/digitalocean.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { testWaitMs, until } from './until.ts';
import { RateLimited } from '../src/executor/droplet/api.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostProviderContract, type ProviderScenario } from './host-provider-contract.ts';
import { HostProviderRegistry } from '../src/host/provider/registry.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';

const request = { project: 'contract', pool: 'agents', architecture: 'x86_64' as const };
async function fixture(t: TestContext, scenario: ProviderScenario = 'normal', beforeClose?: () => Promise<void>) {
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('provider-sentinel-secret', { machine: 'scripted', clock });
  t.after(async () => { await beforeClose?.(); await api.close(); });
  await seedPoolImages(api.stateRoot);
  api.account.droplet_limit = 10;
  api.faults.allocateAddressEarly = true;
  api.faults.activeAfter = scenario === 'delayed-boot' ? 3 : 0;
  api.faults.bootFailed = scenario === 'never-boot';
  if (scenario === 'ignored-delete') api.faults.deletePolls = 100;
  if (scenario === 'failed-acquire') api.faults.create = 503;
  if (scenario === 'refused') api.faults.rateLimits = 1;
  const env = fixtureEnvironment(api.stateRoot, {}, { DIGITALOCEAN_TOKEN: 'provider-sentinel-secret', CLAND_FAKE_HOST_ROOT: api.stateRoot });
  const provider = new DigitalOceanHostProvider({ root: api.stateRoot, env, api: api.provider, clock, size: 's-2vcpu-4gb', image: 'ubuntu-24-04-x64' });
  return { api, provider, clock };
}
test('digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call', async t => {
  const { api, provider } = await fixture(t);
  const invalid = await provider.acquire({ ...request, region: 'nyc1' });
  assert.equal(invalid.state, 'failed');
  assert.equal(api.requests.length, 0);
  const created = await provider.acquire({ ...request, region: 'fra1' });
  assert.equal(created.state, 'created');
  const body = api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets')!.body!;
  assert.equal(body.region, 'fra1'); assert.equal(body.size, 's-2vcpu-4gb'); assert.equal(body.image, 9001);
  assert.deepEqual((body.tags as string[]).slice(0, 3), ['cland', projectTag(api.stateRoot, 'contract'), 'cland-pool-agents']);
  assert.equal(api.keys.length, 1);
  assert.deepEqual(body.ssh_keys, [api.keys[0]!.id]);
});

hostProviderContract('digitalocean', async (t, scenario) => {
  const f = await fixture(t, scenario);
  f.api.faults.rateLimits = 0;
  await f.provider.refreshDeclarations();
  if (scenario === 'refused') f.api.faults.rateLimits = 1;
  return { provider: f.provider, prepared: true, ready: async () => {
    f.api.faults.activeAfter = 0;
    for (const d of f.api.droplets) await f.api.provider.droplet(d.id);
  } };
}, (name, run) => test(name, run));

test('digitalocean release confirms both droplet and key with GET after split DELETE 404', async t => {
  const { api, provider } = await fixture(t);
  const result = await provider.acquire(request); assert.equal(result.state, 'created');
  if (result.state !== 'created') return;
  api.faults.dropletDelete404Reads = 1;
  assert.equal((await provider.release(result.machine)).state, 'incomplete');
  assert.equal(api.droplets.length, 1); assert.equal(api.keys.length, 1);
  api.faults.keyDelete404Reads = 1;
  assert.equal((await provider.release(result.machine)).state, 'incomplete');
  assert.equal(api.droplets.length, 0); assert.equal(api.keys.length, 1);
  assert.equal((await provider.release(result.machine)).state, 'released');
  assert.equal(api.keys.length, 0);
  for (const deleted of api.requests.filter(r => r.method === 'DELETE')) {
    assert.ok(api.requests.some(r => r.method === 'GET' && r.path === deleted.path));
  }
});
test('digitalocean lost create response is reaped after provider restart; other pool and project survive', async t => {
  const { api, provider, clock } = await fixture(t);
  const other = await provider.acquire({ ...request, project: 'other' });
  const pool = await provider.acquire({ ...request, pool: 'other' });
  assert.equal(other.state, 'created'); assert.equal(pool.state, 'created');
  api.faults.loseCreateResponse = 1;
  assert.equal((await provider.acquire(request)).state, 'failed');
  assert.equal(api.droplets.length, 3); assert.equal(api.keys.length, 3);
  const orphan = api.droplets[2]!.id;
  const restarted = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock });
  assert.deepEqual(await restarted.reap(request), { state: 'reaped', released: [String(orphan)], incomplete: [] });
  assert.equal(api.droplets.length, 2); assert.equal(api.keys.length, 2);
  assert.ok(api.requests.some(r => r.method === 'GET' && r.path === `/v2/droplets/${orphan}`));
});
test('digitalocean owned host and its key survive reap while an unowned host is removed', async t => {
  const { api, provider, clock } = await fixture(t);
  const owned = await provider.acquire(request), orphan = await provider.acquire(request);
  assert.equal(owned.state, 'created'); assert.equal(orphan.state, 'created');
  if (owned.state !== 'created' || orphan.state !== 'created') return;
  assert.notEqual(api.keys[0]!.public_key, api.keys[1]!.public_key);
  assert.notEqual(api.keys[0]!.name, api.keys[1]!.name);
  const p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, ownedMachineIds: async () => new Set([owned.machine.id]), admitReap: async (target, remove) => target.machineId === owned.machine.id ? undefined : remove() });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [orphan.machine.id], incomplete: [] });
  assert.equal(api.keys.length, 1); assert.equal(api.droplets[0]!.id, Number(owned.machine.id));
});
test('digitalocean configured base image does not override a prepared pool image', async t => {
  const { api, clock } = await fixture(t);
  const provider = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, image: 'unknown' });
  assert.equal((await provider.prepare()).state, 'current');
});
test('digitalocean provider keeps sentinel out of output, errors and user-data, and launches no child', async t => {
  const { api, provider } = await fixture(t);
  const containsSentinel = (value: unknown) => JSON.stringify(value).includes('provider-sentinel-secret');
  assert.equal(containsSentinel({ diagnostic: 'provider-sentinel-secret' }), true, 'secret scan positive control');
  const lines: unknown[] = [];
  const launches: unknown[] = [];
  for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
    t.mock.method(childProcess, method, (...args: unknown[]) => { launches.push(args); throw new Error('provider must not launch native children'); });
  }
  for (const method of ['log', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => { lines.push(args); });
  api.faults.echoToken = true; api.faults.create = 503;
  const failed = await provider.acquire(request);
  api.faults.create = 0;
  const success = await provider.acquire(request);
  assert.equal(success.state, 'created');
  assert.equal(failed.state, 'failed');
  assert.equal(containsSentinel({ lines, launches, failed, success, requests: api.requests }), false);
  assert.deepEqual(launches, []);
  // Scripted fake never starts native machines; all captured request bodies,
  // including user_data, are scanned above. Production module has no launcher.
});
test('digitalocean registry resolves and production acquisition refuses before any API request', async t => {
  const { api } = await fixture(t);
  const registry = new HostProviderRegistry({ env: {}, digitalocean: { root: api.stateRoot, api: api.provider } });
  const provider = registry.resolve({ provider: 'digitalocean' });
  assert.equal(registry.resolve({ provider: 'digitalocean' }), provider);
  assert.equal((await provider.acquire(request)).state, 'refused');
  assert.equal(api.requests.length, 0);
});
test('digitalocean reap finds tagged droplets and pool-prefixed keys without local intents', async t => {
  const { api, provider } = await fixture(t);
  const tag = projectTag(api.stateRoot, request.project);
  const key = await api.provider.importKey(`${tag}-pool-agents-host-12345678-1234-4234-8234-123456789abc`, 'ssh-ed25519 sentinel');
  const droplet = await api.provider.create({ name: 'cland-host-12345678-1234-4234-8234-123456789abc', tags: ['cland', tag, 'cland-pool-agents'], size: 's-2vcpu-4gb', region: 'lon1', image: 'ubuntu-24-04-x64', ssh_keys: [key.id] });
  assert.deepEqual(await provider.reap(request), { state: 'reaped', released: [String(droplet.id)], incomplete: [] });
  assert.equal(api.keys.length, 0);
});

test('digitalocean reap rechecks owner admission after held inventory and preceding deletion', async t => {
  for (const boundary of ['inventory', 'deletion'] as const) {
    const { api, provider, clock } = await fixture(t);
    const a = await provider.acquire(request), b = await provider.acquire(request);
    assert.equal(a.state, 'created'); assert.equal(b.state, 'created');
    if (a.state !== 'created' || b.state !== 'created') return;
    const owned = new Set<string>();
    const key = api.keys[1]!.id;
    if (boundary === 'inventory') api.beforeKeyList(async () => { owned.add(b.machine.id); });
    else api.beforeDropletRead(async id => { if (id === Number(a.machine.id)) owned.add(b.machine.id); });
    const p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock,
      ownedMachineIds: async () => new Set(owned),
      admitReap: async (target, remove) => owned.has(target.machineId ?? '') ? undefined : remove(),
    });
    assert.deepEqual(await p.reap(request), { state: 'reaped', released: [a.machine.id], incomplete: [] });
    assert.equal(api.droplets.length, 1); assert.equal(api.keys.length, 1);
    assert.ok(!api.requests.some(r => r.method === 'DELETE' && (r.path === `/v2/droplets/${b.machine.id}` || r.path === `/v2/account/keys/${key}`)));
  }
});
test('digitalocean reap preserves overlapping pool keys with and without intent records', async t => {
  for (const localIntent of [true, false]) {
    const { api, provider } = await fixture(t);
    if (localIntent) assert.equal((await provider.acquire({ ...request, pool: 'agents-host-x' })).state, 'created');
    else {
      const tag = projectTag(api.stateRoot, request.project);
      const key = await api.provider.importKey(`${tag}-pool-agents-host-x-host-12345678-1234-4234-8234-123456789abc`, 'ssh-ed25519 sentinel');
      await api.provider.create({ name: 'cland-host-12345678-1234-4234-8234-123456789abc', tags: ['cland', tag, 'cland-pool-agents-host-x'], size: 's-2vcpu-4gb', region: 'lon1', image: 'ubuntu-24-04-x64', ssh_keys: [key.id] });
    }
    assert.deepEqual(await provider.reap(request), { state: 'reaped', released: [], incomplete: [] });
    assert.equal(api.droplets.length, 1); assert.equal(api.keys.length, 1);
    assert.ok(!api.requests.some(r => r.method === 'DELETE'));
  }
});
test('digitalocean reap holds owner admission through both confirmed deletes; snapshot-only callers fail closed', async t => {
  const { api, provider, clock } = await fixture(t);
  const machine = await provider.acquire(request); assert.equal(machine.state, 'created');
  if (machine.state !== 'created') return;
  const legacy = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, ownedMachineIds: async () => new Set() });
  assert.equal((await legacy.reap(request)).state, 'failed');
  assert.ok(!api.requests.some(r => r.method === 'DELETE'));
  let fenced = false;
  const receipts: string[] = [];
  api.beforeDropletRead(async () => { assert.equal(fenced, true); receipts.push('droplet'); });
  api.beforeKeyRead(async () => { assert.equal(fenced, true); receipts.push('key'); });
  const p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock,
    admitReap: async (_target, remove) => { fenced = true; try { return await remove(); } finally { fenced = false; } },
  });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [machine.machine.id], incomplete: [] });
  assert.deepEqual(receipts, ['droplet', 'key']); assert.equal(fenced, false);
});
test('digitalocean reap admits orphan key cleanup through its current owner', async t => {
  const { api, clock } = await fixture(t);
  const name = `${projectTag(api.stateRoot, request.project)}-pool-agents-host-12345678-1234-4234-8234-123456789abc`;
  await api.provider.importKey(name, 'ssh-ed25519 sentinel');
  let owned = false;
  api.beforeKeyList(async () => { owned = true; });
  const p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock,
    admitReap: async (target, remove) => owned && target.keyName === name ? undefined : remove(),
  });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [], incomplete: [] });
  assert.equal(api.keys.length, 1); assert.ok(!api.requests.some(r => r.method === 'DELETE'));
});
test('digitalocean incomplete retirement blocks owner claims through restart until both resources reconcile', async t => {
  const { api, provider, clock } = await fixture(t);
  const acquired = await provider.acquire(request); assert.equal(acquired.state, 'created');
  if (acquired.state !== 'created') return;
  const id = acquired.machine.id, keyId = api.keys[0]!.id;
  const { readFile, writeFile } = await import('node:fs/promises');
  const path = `${api.stateRoot}/owner-retirement.json`;
  // Reference host-record owner: reservation is separate from the ephemeral lock.
  // Persistence is the exact boundary under assertion; each claim reloads it.
  const owner = () => ({
    claim: async () => { const r = JSON.parse(await readFile(path, 'utf8')); return r.retiring ? 'refused' : 'claimable'; },
    admit: async (target: import('../src/host/provider/digitalocean.ts').ReapTarget, remove: () => Promise<import('../src/host/provider/provider.ts').ReleaseResult>) => {
      await writeFile(path, JSON.stringify({ target, retiring: true }));
      const result = await remove();
      if (result.state === 'released') await writeFile(path, JSON.stringify({ target, retiring: false }));
      return result;
    },
  });
  let authority = owner();
  let p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, admitReap: authority.admit });
  api.faults.dropletDelete404Reads = 2;
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [], incomplete: [id] });
  assert.equal(await authority.claim(), 'refused');
  authority = owner(); // Loads reservation from durable owner storage, no memory transfer.
  p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, admitReap: authority.admit });
  assert.equal(await authority.claim(), 'refused');
  // A list omission is not an absence receipt. Key reconciliation must GET the
  // known droplet too, and retain the reservation while that GET is still 200.
  api.faults.omitDropletIds = [Number(id)];
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [], incomplete: [`key:${keyId}`] });
  assert.equal(await authority.claim(), 'refused');
  assert.equal(api.keys.length, 1);
  api.faults.omitDropletIds = [];
  api.beforeKeyRead(async () => { assert.equal(await authority.claim(), 'refused'); });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [id], incomplete: [] });
  assert.equal(await authority.claim(), 'claimable');
  assert.equal(api.droplets.length, 0); assert.equal(api.keys.length, 0);
});
test('digitalocean pending retirement reconciles after transient key GET failure and empty inventories', async t => {
  const { api, provider, clock } = await fixture(t);
  const acquired = await provider.acquire(request); assert.equal(acquired.state, 'created');
  if (acquired.state !== 'created') return;
  const id = acquired.machine.id;
  const { readFile, writeFile } = await import('node:fs/promises');
  const path = `${api.stateRoot}/pending-owner.json`;
  const owner = () => ({
    claim: async () => JSON.parse(await readFile(path, 'utf8')).retiring ? 'refused' : 'claimable',
    admit: async (target: import('../src/host/provider/digitalocean.ts').ReapTarget, remove: () => Promise<import('../src/host/provider/provider.ts').ReleaseResult>) => {
      await writeFile(path, JSON.stringify({ target, retiring: true }));
      const result = await remove();
      if (result.state === 'released') await writeFile(path, JSON.stringify({ target, retiring: false }));
      return result;
    },
  });
  let authority = owner();
  let p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, admitReap: authority.admit });
  api.beforeKeyRead(async () => { throw new Error('transient key GET transport failure'); });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [], incomplete: [id] });
  assert.equal(await authority.claim(), 'refused');
  assert.equal(api.droplets.length, 0); assert.equal(api.keys.length, 0);
  authority = owner();
  p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, admitReap: authority.admit });
  const receipts: string[] = [];
  api.beforeDropletRead(async () => { receipts.push('droplet'); assert.equal(await authority.claim(), 'refused'); });
  api.beforeKeyRead(async () => { receipts.push('key'); assert.equal(await authority.claim(), 'refused'); });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [id], incomplete: [] });
  assert.deepEqual(receipts, ['droplet', 'key']);
  assert.equal(await authority.claim(), 'claimable');
});
test('digitalocean pending retirement survives a lost owner settlement acknowledgement', async t => {
  const { api, provider, clock } = await fixture(t);
  const acquired = await provider.acquire(request); assert.equal(acquired.state, 'created');
  if (acquired.state !== 'created') return;
  const { readFile, writeFile } = await import('node:fs/promises');
  const path = `${api.stateRoot}/owner-ack.json`;
  let loseAck = true;
  const admit = async (_target: import('../src/host/provider/digitalocean.ts').ReapTarget, remove: () => Promise<import('../src/host/provider/provider.ts').ReleaseResult>) => {
    await writeFile(path, 'retiring');
    const result = await remove();
    if (loseAck) throw new Error('owner acknowledgement lost before durable settlement');
    if (result.state === 'released') await writeFile(path, 'settled');
    return result;
  };
  let p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, admitReap: admit });
  assert.equal((await p.reap(request)).state, 'failed');
  assert.equal(await readFile(path, 'utf8'), 'retiring');
  assert.equal(api.droplets.length, 0); assert.equal(api.keys.length, 0);
  loseAck = false;
  p = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, admitReap: admit });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [acquired.machine.id], incomplete: [] });
  assert.equal(await readFile(path, 'utf8'), 'settled');
});

test('digitalocean declarations load API prices and limit atomically and retain the last good read', async t => {
  const { api, provider, clock } = await fixture(t);
  assert.deepEqual(provider.declarations, { state: 'unavailable', reason: 'DigitalOcean declarations not loaded' });
  Object.assign(api.account, { droplet_limit: 37 });
  api.sizes.push({ slug: 'second', available: true, price_hourly: 0.123, regions: ['lon1'] });
  const first = await provider.refreshDeclarations();
  assert.ok(!('state' in first));
  if ('state' in first) return;
  assert.equal(first.machineLimit, 37);
  assert.deepEqual(first.prices, { 'c-8': { livePerHour: 0.25, idleComputePerHour: 0, idlePerHour: 0 }, second: { livePerHour: 0.123, idleComputePerHour: 0, idlePerHour: 0 } });
  assert.equal(first.apiRequestsPerMinute, 250);
  assert.equal(first.billingMinimumMs, 60000); assert.equal(first.billingGranularityMs, 1000);
  assert.equal(first.stoppedBills, true); assert.equal(first.extraAddressPerHour, 0);
  assert.equal(first.tokenConfinement, 'account'); assert.deepEqual(first.architectures, ['x86_64']);
  api.faults.rateLimits = 1;
  assert.equal(await provider.refreshDeclarations(), first);
  await clock.advance(1000);
  api.beforeSizes(async () => { throw new Error('lost reply provider-sentinel-secret'); });
  assert.equal(await provider.refreshDeclarations(), first);
  api.beforeSizes(async () => { throw new (await import('../src/executor/droplet/api.ts')).DigitalOceanError(503, 'unavailable', 'try later'); });
  assert.equal(await provider.refreshDeclarations(), first);
});

for (const status of [429, 422]) test(`digitalocean ${status} pauses every create until retry time without POST cascades or token leaks`, { timeout: testWaitMs(2000) }, async t => {
  const { api, provider, clock } = await fixture(t);
  await provider.refreshDeclarations();
  Object.assign(api.faults, { create: status, createLimit: status === 422, createRetryHeaders: true, echoToken: true, retryAfter: '2' });
  const start = clock.now().getTime();
  const first = await provider.acquire(request);
  assert.equal(first.state, 'refused');
  if (first.state !== 'refused') return;
  assert.equal(first.retryAt, new Date(start + 2000).toISOString());
  assert.ok(!JSON.stringify(first).includes('provider-sentinel-secret'));
  const sent = api.requests.length;
  const postCount = () => api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length;
  assert.equal(postCount(), 1);
  api.faults.create = 0;
  const held = await Promise.all([provider.acquire({ ...request, pool: 'second' }), provider.acquire({ ...request, pool: 'third' })]);
  assert.deepEqual(held, [first, first]);
  assert.equal(api.requests.length, sent);
  await clock.advance(1999);
  assert.deepEqual(await provider.acquire(request), first);
  assert.equal(api.requests.length, sent);
  await clock.advance(1);
  const results = await Promise.all([provider.acquire(request), provider.acquire({ ...request, pool: 'second' }), provider.acquire({ ...request, pool: 'third' })]);
  assert.deepEqual(results.map(r => r.state), ['created', 'created', 'created']);
  assert.equal(postCount(), 4);
});

test('digitalocean unavailable declarations refuse safely and recover without partial publication', async t => {
  const { api, provider } = await fixture(t);
  api.beforeSizes(async () => { throw new Error('lost provider-sentinel-secret'); });
  const unavailable = await provider.refreshDeclarations();
  assert.deepEqual(unavailable, { state: 'unavailable', reason: 'DigitalOcean declarations not loaded' });
  const refused = await provider.acquire(request);
  assert.equal(refused.state, 'refused');
  assert.ok(!JSON.stringify(refused).includes('provider-sentinel-secret'));
  assert.ok(!api.requests.some(r => r.method === 'POST'));
  api.beforeSizes(async () => {});
  api.account.droplet_limit = -1;
  assert.equal(await provider.refreshDeclarations(), unavailable);
  api.account.droplet_limit = 23;
  const before = api.requests.length;
  const [one, two] = await Promise.all([provider.refreshDeclarations(), provider.refreshDeclarations()]);
  assert.equal(one, two);
  assert.equal(api.requests.length - before, 2, 'concurrent refresh shares one complete API read');
  assert.ok(!('state' in one));
  if ('state' in one) return;
  assert.equal(one.machineLimit, 23);
  api.account.droplet_limit = -1;
  api.sizes[0]!.price_hourly = 99;
  assert.equal(await provider.refreshDeclarations(), one);
  assert.equal(one.prices['c-8']!.livePerHour, 0.25);
});
test('digitalocean initial declaration 429 holds subsequent creates without a request', async t => {
  const { api, provider, clock } = await fixture(t);
  api.faults.rateLimits = 1;
  const first = await provider.acquire(request);
  assert.equal(first.state, 'refused');
  const count = api.requests.length;
  assert.deepEqual(await provider.acquire(request), first);
  assert.equal(api.requests.length, count);
  await clock.advance(1000);
  assert.equal((await provider.acquire(request)).state, 'created');
});
test('digitalocean unrelated 422 is failed and does not pause creation', async t => {
  const { api, provider } = await fixture(t);
  api.faults.create = 422;
  assert.equal((await provider.acquire(request)).state, 'failed');
  api.faults.create = 0;
  assert.equal((await provider.acquire(request)).state, 'created');
});

test('digitalocean accepted create followed by address GET 429 retains ownership and pauses later creates', async t => {
  const { api, provider, clock } = await fixture(t);
  const retry = clock.now().getTime() + 2000;
  api.beforeDropletRead(async () => { throw new RateLimited(retry); });
  const result = await provider.acquire(request);
  assert.equal(result.state, 'failed', 'an accepted create is never a safely refused create');
  assert.ok(!('retryAt' in result));
  assert.equal(api.droplets.length, 1); assert.equal(api.keys.length, 1);
  const count = api.requests.length;
  const held = await provider.acquire(request);
  assert.equal(held.state, 'refused');
  if (held.state === 'refused') assert.equal(held.retryAt, new Date(retry).toISOString());
  assert.equal(api.requests.length, count);
  await clock.advance(2000);
  api.beforeDropletRead(async () => {});
  const id = String(api.droplets[0]!.id);
  assert.deepEqual(await provider.reap(request), { state: 'reaped', released: [id], incomplete: [] });
  assert.equal(api.droplets.length, 0); assert.equal(api.keys.length, 0);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
});
// This scripted fixture explicitly admits 2x setup headroom on every executor.
// The outer watchdog includes that same setup scale plus behavior and drainage.
const heldSetupMs = testWaitMs(2000), heldSetupScale = 2;
const heldRemainingMs = testWaitMs(15000);
test('digitalocean held create refusal cannot shorten a concurrent declaration refresh pause', { timeout: heldSetupMs * heldSetupScale + heldRemainingMs * 2 }, async t => {
  const gate = Promise.withResolvers<void>();
  let closing = false;
  let pending: ReturnType<DigitalOceanHostProvider['acquire']> | undefined;
  // Install the release/join ahead of api.close before acquire can own a writer.
  const { api, provider, clock } = await fixture(t, 'normal', async () => {
    closing = true; gate.resolve();
    if (pending) await Promise.allSettled([pending]);
  });
  const acquire = () => {
    if (closing) throw new Error('held fixture is closing');
    return pending = provider.acquire(request);
  };
  await provider.refreshDeclarations();
  const latest = clock.now().getTime() + 10000;
  let entered = false;
  api.beforeCreate(async () => { entered = true; await gate.promise; });
  Object.assign(api.faults, { create: 429, createRetryHeaders: true, retryAfter: '2' });
  const initial = acquire();
  try {
    await until(() => entered, { what: 'create POST reached held provider response', timeoutMs: heldSetupMs, loadFactor: heldSetupScale });
    api.beforeSizes(async () => { throw new RateLimited(latest); });
    await provider.refreshDeclarations(); // Complete publication of the longer deadline.
  } finally { gate.resolve(); await initial; }
  const first = await initial;
  assert.equal(first.state, 'refused');
  if (first.state !== 'refused') return;
  assert.equal(first.retryAt, new Date(latest).toISOString());
  const count = api.requests.length;
  assert.deepEqual(await acquire(), first);
  await clock.advance(2000);
  assert.deepEqual(await acquire(), first);
  assert.equal(api.requests.length, count);
  await clock.advance(8000);
  api.faults.create = 0;
  assert.equal((await acquire()).state, 'created');
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});

for (const pool of ['agents_1', '-agents', 'a'.repeat(65)]) test(`digitalocean refuses invalid pool ${JSON.stringify(pool)} before acquire or reap API calls`, async t => {
  const { api, provider } = await fixture(t);
  assert.equal((await provider.acquire({ ...request, pool })).state, 'failed');
  assert.equal((await provider.reap({ ...request, pool })).state, 'failed');
  assert.equal(api.requests.length, 0);
});

for (const pool of ['agents-host-x', 'A' + 'a'.repeat(63)]) test(`digitalocean reaps valid pool tags and keys exactly: ${pool}`, async t => {
  const { api, provider } = await fixture(t);
  const tag = projectTag(api.stateRoot, request.project);
  const intent = '12345678-1234-4234-8234-123456789abc';
  const seed = async (name: string) => {
    const key = await api.provider.importKey(`${tag}-pool-${name}-host-${intent}`, 'ssh-ed25519 sentinel');
    return api.provider.create({ name: `cland-host-${intent}`, tags: ['cland', tag, `cland-pool-${name}`], size: 's-2vcpu-4gb', region: 'lon1', image: 'ubuntu-24-04-x64', ssh_keys: [key.id] });
  };
  const target = await seed(pool);
  await seed(pool + '_1');
  await api.provider.importKey(`${tag}-pool-${pool}-host-${intent}extra`, 'ssh-ed25519 sentinel');
  assert.deepEqual(await provider.reap({ ...request, pool }), { state: 'reaped', released: [String(target.id)], incomplete: [] });
  assert.equal(api.droplets.length, 1);
  assert.equal(api.keys.length, 2);
  assert.equal(api.droplets[0]!.tags.at(-1), `cland-pool-${pool}_1`);
});
