import { admissionFixture, hostLockProcesses, ownAdmissionApi } from './host-admission-fixture.ts';
import { readdir } from 'node:fs/promises';
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
import { admissionCloseContract } from './host-admission-close-contract.ts';

async function refusedIntent(root:string):Promise<boolean> {
 const {readFile}=await import('node:fs/promises');
 try {for(const name of await readdir(root+'/.cland/host-provider/digitalocean'))if(name.startsWith('intent-')){const row=JSON.parse(await readFile(root+'/.cland/host-provider/digitalocean/'+name,'utf8'));if(row.dropletRefused==='429')return true;}}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 return false;
}
const request = { project: 'contract', pool: 'agents', architecture: 'x86_64' as const };
test('digitalocean provider fixture drains queued issuance before storage and root disposal',async t=>{
 await admissionCloseContract(t,context=>fixture(context));
});
async function fixture(t: TestContext, scenario: ProviderScenario = 'normal', beforeClose?: () => Promise<void>,requestsPerMinute?:number) {
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('provider-sentinel-secret', { machine: 'scripted', clock,...(requestsPerMinute?{requestsPerMinute}:{}) });
  ownAdmissionApi(t,api,beforeClose);
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
  const rawProvider=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock});
  const acquire=rawProvider.acquire.bind(rawProvider),createAdmission=rawProvider.createAdmission.bind(rawProvider);
  const admissions=admissionFixture(t,api.stateRoot,env,clock);
  await admissions.wrap(provider);
  return { api, provider, clock, admissions, raw:{acquire,createAdmission} };
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
  return { provider: f.provider, admissionEffects:async()=>({requests:f.api.requests.length,files:(await readdir(f.api.stateRoot,{recursive:true})).sort()}), prepared: true, ready: async () => {
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
  if(status===429) {
    const checkpoint=until(()=>refusedIntent(api.stateRoot),{what:'durable refused POST and exact imported key',timeoutMs:testWaitMs()});
    const initial=provider.acquire(request);
    try {
      await checkpoint;assert.equal(api.keys.length,1);
      await clock.advance(1999);
      assert.equal(api.requests.filter(r=>r.method==='DELETE').length,0);
      assert.equal(api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/droplets').length,1);
      await clock.advance(1);
      const result=await initial;assert.equal(result.state,'refused');
      assert.ok(result.state==='refused'&&result.nonAcquisition);assert.equal(api.keys.length,0);
      api.faults.create=0;
      assert.equal((await provider.acquire(request)).state,'created');
      assert.equal(api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/droplets').length,2);
    }finally {await clock.advance(60000);await initial;}
    return;
  }
  const initial = await provider.acquire(request);
  assert.equal(initial.state,'refused');assert.equal(api.keys.length,0);assert.ok(initial.state==='refused'&&initial.nonAcquisition);
  const first={state:'refused',reason:'DigitalOcean creation paused',retryAt:new Date(start+2000).toISOString()};
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
  assert.deepEqual(results.map(r => r.state), ['created', 'created', 'created'], JSON.stringify(results.map(r => r.state === 'created' ? { state: r.state } : r)));
  assert.equal(postCount(), 4);
});

for(const boundary of ['key import','droplet POST'] as const)test(`digitalocean acquire survives an unrelated reservation during ${boundary} watchdog observation`, async t => {
  const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{});
  const owner=admissionFixture(t,api.stateRoot,env,clock);
  const admission=await owner.issue(request.project,request.pool);
  let observations=0,changed=false;
  t.mock.method(owner.processes,'identity',async()=>{
    // Checks: preflight, key outer/send, droplet outer/send.
    if(++observations===(boundary==='key import'?2:4)){changed=true;await owner.issue(request.project,'unrelated');}
    return 'scripted-birth';
  });
  const result=await raw.acquire({...request,admission});
  t.diagnostic(JSON.stringify({keyPosts:api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/account/keys').length,dropletPosts:api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/droplets').length,droplets:api.droplets.length,keys:api.keys.length}));
  assert.equal(changed,true);
  assert.equal(result.state,'created',JSON.stringify(result.state==='created'?{state:result.state}:result));
  assert.equal(api.droplets.length,1);
});

for(const change of ['released','revoked','backing','reservation','cap','churn'] as const)test(`digitalocean admission ledger retry preserves ${change} policy`,async t=>{
  const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{});
  const owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue(request.project,request.pool);
  const {hostAdmissionEffect,HostAdmissionUnavailable}=await import('../src/host/create-admission.ts');
  const {reserveHostSpend,settleHostSpend}=await import('../src/executor/droplet/spend.ts');
  const {invalidateHostAdmission}=await import('../src/host/admission-fence.ts');
  let observations=0,sends=0;
  t.mock.method(owner.processes,'identity',async()=>{
    observations++;
    if(observations===1||change==='churn'){
      if(change==='released')await settleHostSpend(api.stateRoot,admission.lease!.id,clock.now().toISOString(),env,{clock,processes:hostLockProcesses});
      else if(change==='revoked')invalidateHostAdmission(api.stateRoot,admission.lease!.id);
      else if(change==='backing')owner.loseWatchdog();
      else if(change==='reservation'){
        const {readFile}=await import('node:fs/promises'),{spendPath}=await import('../src/executor/droplet/spend.ts'),{durableJson}=await import('../src/executor/droplet/lease.ts');
        const ledger=JSON.parse(await readFile(spendPath(env),'utf8'));
        ledger.entries.find((entry:{lease:string})=>entry.lease===admission.lease!.id).pool='changed';
        await durableJson(spendPath(env),ledger);
      }
      else {
        const input={project:api.stateRoot,lease:'unrelated-'+observations,pool:'other',size:'c-8',priceHourly:change==='cap'?1:0,billingMinimumMs:60000,created:clock.now().toISOString(),deadline:admission.lease!.deadline};
        if(change==='cap')await assert.rejects(reserveHostSpend(input,{shared:0,hosts:0},env,{clock,processes:hostLockProcesses}),/spend cap/);
        else await reserveHostSpend(input,{shared:10000,hosts:10000},env,{clock,processes:hostLockProcesses});
      }
    }
    return change==='backing'?null:'scripted-birth';
  });
  const effect=()=>hostAdmissionEffect(admission,async()=>{sends++;});
  if(change==='cap'){const result=await raw.acquire({...request,admission});assert.equal(result.state,'created',JSON.stringify(result.state==='created'?{state:result.state}:result));assert.equal(api.droplets.length,1);}
  else {await assert.rejects(effect(),error=>error instanceof HostAdmissionUnavailable&&(change!=='churn'||/did not stabilize/.test(error.message)));assert.equal(sends,0);}
  if(change==='churn')assert.equal(observations,8);
  if(change!=='cap')assert.equal(api.requests.length,0);
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
  const checkpoint=until(()=>refusedIntent(api.stateRoot),{what:'durable held POST refusal after refresh',timeoutMs:testWaitMs()});
  const initial = acquire();
  try {
    await until(() => entered, { what: 'create POST reached held provider response', timeoutMs: heldSetupMs, loadFactor: heldSetupScale });
    api.beforeSizes(async () => { throw new RateLimited(latest); });
    await provider.refreshDeclarations(); // Complete publication of the longer deadline.
  } finally {gate.resolve();await checkpoint;await clock.advance(2000);assert.equal(api.keys.length,1);assert.equal(api.requests.filter(r=>r.method==='DELETE').length,0);await clock.advance(8000);await initial;}
  const result = await initial;
  assert.equal(result.state,'refused');assert.ok(result.state==='refused'&&result.nonAcquisition);
  assert.equal(api.keys.length,0);if(result.state==='refused')assert.equal(result.retryAt,new Date(latest).toISOString());
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

 test('DigitalOcean requires lease, watchdog and hosts reservation even with an injected API',async t=>{
  const {api,raw}=await fixture(t);
  const admission=raw.createAdmission();
  assert.equal(admission.state,'refused');
  if(admission.state==='refused')assert.match(admission.reason,/lease.*watchdog.*reservation/);
  const result=await raw.acquire(request);
  assert.equal(result.state,'refused');assert.equal(api.requests.length,0);
 });

for(const [field,reason] of [['lease','lease'],['watchdog','armed watchdog'],['reservation','hosts reservation']] as const)test(`DigitalOcean missing ${field} refuses before any API call`,async t=>{
 const {api,clock,raw}=await fixture(t);
 const env=fixtureEnvironment(api.stateRoot,{},{});
 const receipt=await admissionFixture(t,api.stateRoot,env,clock).issue('contract','agents');
 const missing={...receipt};delete missing[field];
 const result=await raw.acquire({...request,admission:missing});
 assert.equal(result.state,'refused');if(result.state==='refused')assert.ok(result.reason.includes(reason));assert.equal(api.requests.length,0);
});

test('DigitalOcean binds create to durable watchdog input and discovers the exact lease after a lost checkpoint',async t=>{
 const {api,provider,clock}=await fixture(t);
 const env=fixtureEnvironment(api.stateRoot,{},{});
 const receipt=await admissionFixture(t,api.stateRoot,env,clock).issue('contract','agents');
 const result=await provider.acquire({...request,admission:receipt});
 assert.equal(result.state,'created');if(result.state!=='created')return;
 const body=api.requests.find(r=>r.method==='POST'&&r.path==='/v2/droplets')!.body!;
 assert.ok((body.tags as string[]).includes('cland-lease-'+receipt.lease!.id));
 const machine=await provider.findAdmission('contract','agents',receipt.lease!.id);
 assert.deepEqual(machine,result.machine);
 assert.equal(await provider.findAdmission('contract','agents','unrelated'),undefined);
});

test('DigitalOcean watchdog deletes an admitted droplet after owner closure before machine checkpoint',async t=>{
 const {api,clock,raw}=await fixture(t);
 const {readFile}=await import('node:fs/promises');
 const {hostWatchdogPaths,runHostWatchdog}=await import('../src/host/host-watchdog.ts');
 const env=fixtureEnvironment(api.stateRoot,{},{}),admissions=admissionFixture(t,api.stateRoot,env,clock);
 const receipt=await admissions.issue('contract','agents');
 const input=JSON.parse(await readFile(hostWatchdogPaths(api.stateRoot,receipt.lease!.id).input,'utf8'));
 let armedObserved=false;const effectOrder:string[]=[];
 const armed=async(effect:string)=>{
  const mirror=JSON.parse(await readFile((await import('../src/host/host-leases.ts')).hostLeasePath(api.stateRoot,input.id),'utf8'));
  assert.equal(mirror.watchdog.pidIdentity,'scripted-birth');armedObserved=true;effectOrder.push(effect);
 };
 api.beforeImport(()=>armed('key-import'));api.beforeCreate(()=>armed('droplet-post'));
 api.beforeDropletRead(async()=>{throw Error('hub lost address reply before machine checkpoint');});
 const result=await api.checked(raw.acquire({...request,admission:receipt}));assert.equal(result.state,'failed');assert.equal(armedObserved,true);assert.deepEqual(effectOrder,['key-import','droplet-post']);
 assert.equal(api.droplets.length,1);assert.equal(api.keys.length,1);
 await admissions.close();
 api.beforeDropletRead(async()=>{});
 await clock.advance(43200000);
 const worker=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock});
 // Discovery is the list by exact lease tag; no machine checkpoint is supplied.
 let retries=0;const abort=new AbortController();
 await runHostWatchdog(input,env,clock,async ms=>{await clock.advance(ms);if(++retries===5)abort.abort();},abort.signal,{processes:hostLockProcesses,provider:worker});
 assert.equal(api.droplets.length,0);assert.equal(api.keys.length,0);
 const absence=JSON.parse(await readFile(hostWatchdogPaths(api.stateRoot,input.id).receipt,'utf8'));
 assert.deepEqual(absence.reads.map((r:{resource:string})=>r.resource),['machine','key']);
 for(const deleted of api.requests.filter(r=>r.method==='DELETE'))assert.ok(api.requests.some(r=>r.method==='GET'&&r.path===deleted.path));
 const count=api.requests.length,restarted=new AbortController();let restartTicks=0;
 await runHostWatchdog(input,env,clock,async ms=>{await clock.advance(ms);if(++restartTicks===2)restarted.abort();},restarted.signal,{processes:hostLockProcesses,provider:worker,report:()=>{}});
 assert.equal(api.requests.length,count,'worker restart reuses durable bound absence without rediscovery');
});

for(const discovery of ['no exact tag match','failed discovery list'] as const)test(`DigitalOcean watchdog with ${discovery} retains ownership and reports once`,async t=>{
 const {api,clock,provider}=await fixture(t);
 assert.equal((await provider.acquire(request)).state,'created','unrelated admitted machine is retained');
 if(discovery==='failed discovery list')api.beforeDropletList(async()=>{throw Error('scripted discovery list failure');});
 const {runHostWatchdog}=await import('../src/host/host-watchdog.ts');
 const env=fixtureEnvironment(api.stateRoot,{},{}),admissions=admissionFixture(t,api.stateRoot,env,clock);
 const receipt=await admissions.issue('contract','agents');
 const input={root:api.stateRoot,id:receipt.lease!.id,provider:'digitalocean',project:'contract',pool:'agents',deadline:receipt.lease!.deadline};
 await admissions.close();await clock.advance(43200000);
 const worker=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock}),abort=new AbortController(),reports:string[]=[];
 let ticks=0;
 await runHostWatchdog(input,env,clock,async ms=>{await clock.advance(ms);if(++ticks===3)abort.abort();},abort.signal,{processes:hostLockProcesses,provider:worker,report:message=>reports.push(message)});
 assert.equal(reports.length,1);assert.match(reports[0]!,/retained/);
 assert.equal(api.requests.filter(r=>r.method==='DELETE').length,0);assert.equal(api.droplets.length,1);assert.equal(api.keys.length,1);
 const {spendPath}=await import('../src/executor/droplet/spend.ts');
 const {readFile}=await import('node:fs/promises');
 const ledger=JSON.parse(await readFile(spendPath(env),'utf8'));
 assert.equal(ledger.entries.find((r:{lease:string})=>r.lease===input.id).cost,null);
});

test('DigitalOcean admission creates at most one provider intent per lease',async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{});
 const admission=await admissionFixture(t,api.stateRoot,env,clock).issue('contract','agents');
 assert.equal((await raw.acquire({...request,admission})).state,'created');
 const before=api.requests.length;
 const repeated=await raw.acquire({...request,admission});assert.equal(repeated.state,'refused');
 assert.equal(api.requests.length,before);assert.equal(api.droplets.length,1);assert.equal(api.keys.length,1);
});

test('DigitalOcean rejects a lease admitted for another provider before API access',async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{});
 const admission=await admissionFixture(t,api.stateRoot,env,clock).issue('contract','agents','fake');
 const result=await raw.acquire({...request,admission});assert.equal(result.state,'refused');assert.equal(api.requests.length,0);
});

for(const boundary of ['before acquire','after declarations','after key import'] as const)for(const invalidation of ['lease','watchdog','spend'] as const)test(`DigitalOcean revalidates ${invalidation} ${boundary} before provider mutations`,async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock);
 const admission=await owner.issue('contract','agents');
 const invalidate=async()=>{
  if(invalidation==='lease')await owner.leases.expireNow(admission.lease!.id,api.stateRoot,clock);
  if(invalidation==='watchdog')owner.loseWatchdog();
  if(invalidation==='spend')await (await import('../src/executor/droplet/spend.ts')).settleHostSpend(api.stateRoot,admission.lease!.id,clock.now().toISOString(),env,{clock,processes:hostLockProcesses});
 };
 if(boundary==='before acquire')await invalidate();
 if(boundary==='after declarations')api.beforeSizes(invalidate);
 if(boundary==='after key import')api.beforeImport(invalidate);
 const result=await raw.acquire({...request,admission});
 assert.notEqual(result.state,'created');
 assert.equal(api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/droplets').length,0);
 assert.equal(api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/account/keys').length,boundary==='after key import'?1:0);
 if(boundary==='before acquire')assert.equal(api.requests.length,0);
});

for(const status of [429,422])test(`DigitalOcean ${status} refusal confirms imported key absence before returning non-acquisition`,async t=>{
 const {api,provider}=await fixture(t);api.faults.create=status;api.faults.createLimit=status===422;
 const result=await provider.acquire(request);assert.equal(result.state,'refused');assert.equal(api.keys.length,0);
 if(result.state==='refused'){assert.ok(result.nonAcquisition);assert.match(result.nonAcquisition!.key!.read,/GET.*404/);}
 const deletion=api.requests.findIndex(r=>r.method==='DELETE'&&r.path.startsWith('/v2/account/keys/'));
 assert.ok(deletion>=0);assert.ok(api.requests.slice(deletion+1).some(r=>r.method==='GET'&&r.path===api.requests[deletion]!.path));
});

test('DigitalOcean unconfirmed refused-create key deletion stays owned and key-only watchdog replay confirms it',async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock);
 const admission=await owner.issue('contract','agents');api.faults.create=429;api.faults.keyDeleteFailures=[403];
 const result=await raw.acquire({...request,admission});assert.equal(result.state,'failed');assert.equal(api.keys.length,1);
 const {readFile}=await import('node:fs/promises'),{spendPath}=await import('../src/executor/droplet/spend.ts');
 const {runHostWatchdog,hostWatchdogPaths}=await import('../src/host/host-watchdog.ts');
 const input=JSON.parse(await readFile(hostWatchdogPaths(api.stateRoot,admission.lease!.id).input,'utf8'));
 const ledger=()=>readFile(spendPath(env),'utf8').then(JSON.parse);
 assert.equal((await ledger()).entries.find((r:{lease:string})=>r.lease===input.id).cost,null);
 await owner.close();await clock.advance(43200000);
 const worker=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock}),abort=new AbortController();let ticks=0;
 await runHostWatchdog(input,env,clock,async ms=>{await clock.advance(ms);if(++ticks===3)abort.abort();},abort.signal,{processes:hostLockProcesses,provider:worker,report:()=>{}});
 assert.equal(api.keys.length,0);assert.equal((await ledger()).entries.find((r:{lease:string})=>r.lease===input.id).cost,0);
});

test('DigitalOcean machine-less watchdog replays a hub-originated absence receipt without API rediscovery',async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue('contract','agents');
 const created=await raw.acquire({...request,admission});assert.equal(created.state,'created');if(created.state!=='created')return;
 const {runHostWatchdog,recordHostAbsence,hostWatchdogPaths}=await import('../src/host/host-watchdog.ts'),{readFile}=await import('node:fs/promises');
 const input=JSON.parse(await readFile(hostWatchdogPaths(api.stateRoot,admission.lease!.id).input,'utf8'));
 const reads:Array<{resource:'machine'|'key';read:string}>=[];
 const provider=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock});
 assert.equal((await provider.release(created.machine,read=>reads.push(read))).state,'released');
 const receipt=await recordHostAbsence({root:api.stateRoot,id:input.id,provider:'digitalocean',machine:created.machine},clock,reads);
 await owner.close();const count=api.requests.length;
 await runHostWatchdog(input,env,clock,async()=>{throw Error('receipt replay must not wait');},undefined,{processes:hostLockProcesses,provider});
 assert.equal(api.requests.length,count);
 const {spendPath}=await import('../src/executor/droplet/spend.ts');
 const entry=JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id);
 assert.equal(entry.released,receipt.confirmedAt);
});

for(const stop of [false,true])test(`DigitalOcean cooldown key cleanup completes through ${stop?'stopped-hub watchdog':'live acquisition owner'}`,async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue('contract','agents'),abort=new AbortController();
 const {readFile,access}=await import('node:fs/promises'),{hostWatchdogPaths,runHostWatchdog}=await import('../src/host/host-watchdog.ts'),{spendPath,cancelHostSpend}=await import('../src/executor/droplet/spend.ts');
 const path=hostWatchdogPaths(api.stateRoot,admission.lease!.id),input=JSON.parse(await readFile(path.input,'utf8'));
 const entry=async()=>JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id);
 Object.assign(api.faults,{create:429,createRetryHeaders:true,retryAfter:'2'});
 const checkpoint=until(()=>refusedIntent(api.stateRoot),{what:'durable cooldown ownership',timeoutMs:testWaitMs()});
 const pending=raw.acquire({...request,admission,signal:abort.signal});
 try {
  await checkpoint;const key=api.keys[0]!.id;
  assert.equal((await entry()).cost,null);assert.equal(api.requests.filter(r=>r.method==='DELETE').length,0);
  if(stop) {
   abort.abort();assert.equal((await pending).state,'failed');await access(path.input);assert.equal((await entry()).cost,null);
   await owner.close();await clock.advance(43200000);
   const worker=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock});
   await runHostWatchdog(input,env,clock,async()=>{throw Error('exact key replay must complete');},undefined,{processes:hostLockProcesses,provider:worker});
   const receipt=JSON.parse(await readFile(path.nonAcquisition,'utf8'));assert.equal(receipt.key.id,key);
  }else {
   await clock.advance(1999);assert.equal(api.keys.length,1);assert.equal((await entry()).cost,null);
   await clock.advance(1);const result=await pending;assert.equal(result.state,'refused');
   assert.ok(result.state==='refused'&&result.nonAcquisition);if(result.state!=='refused'||!result.nonAcquisition)return;
   await owner.retire(input.id);await cancelHostSpend({project:api.stateRoot,lease:input.id},result.nonAcquisition,env,{clock,processes:hostLockProcesses});
   await assert.rejects(access(path.input),{code:'ENOENT'});
  }
  assert.equal(api.keys.length,0);assert.equal((await entry()).cost,0);
  assert.equal(api.requests.filter(r=>r.method==='DELETE'&&r.path===`/v2/account/keys/${key}`).length,1);
  assert.ok(api.requests.some(r=>r.method==='GET'&&r.path===`/v2/account/keys/${key}`));
 }finally {abort.abort();await pending;}
});

for(const phase of ['key import','droplet POST'] as const)for(const invalidation of ['lease','watchdog','spend','signal'] as const)test(`DigitalOcean ${phase} revalidates ${invalidation} inside API pacing`,async t=>{
 const abort=new AbortController();let pending:Promise<unknown>|undefined;
 const f=await fixture(t,'normal',async()=>{abort.abort();await f.clock.advance(180000);await pending;},phase==='key import'?2:3);
 const {api,clock,raw}=f,env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock);
 const admission=await owner.issue('contract','agents');
 let queuedUntil:number|undefined;const queued=(value:number)=>{queuedUntil=value;};
 if(phase==='key import') {const original=api.provider.importKey.bind(api.provider);t.mock.method(api.provider,'importKey',(...[name,key,deadline,scope]:Parameters<typeof original>)=>original(name,key,deadline,{...scope,onWait:until=>queued(until)}));}
 else {const original=api.provider.create.bind(api.provider);t.mock.method(api.provider,'create',(...[input,deadline,scope]:Parameters<typeof original>)=>original(input,deadline,{...scope,onWait:until=>queued(until)}));}
 const observed=until(()=>queuedUntil!==undefined,{what:'API owns a paced mutation',timeoutMs:testWaitMs()});
 pending=raw.acquire({...request,admission,signal:abort.signal});
 try {
  await observed;
  const mutations=api.requests.filter(r=>r.method==='POST').length;
  assert.equal(mutations,phase==='key import'?0:1,'budget exhausted before native mutation');
  if(invalidation==='lease')await owner.leases.expireNow(admission.lease!.id,api.stateRoot,clock);
  if(invalidation==='watchdog')owner.loseWatchdog();
  if(invalidation==='spend')await (await import('../src/executor/droplet/spend.ts')).settleHostSpend(api.stateRoot,admission.lease!.id,clock.now().toISOString(),env,{clock,processes:hostLockProcesses});
  if(invalidation==='signal')abort.abort();
  await clock.advance(queuedUntil!-clock.now().getTime());
  await clock.advance(120000);
  const result=await pending as {state:string};assert.notEqual(result.state,'created');
  assert.equal(api.requests.filter(r=>r.method==='POST').length,mutations,'paced request never sends after invalidation');
 }finally {abort.abort();await clock.advance(180000);await pending;}
});

for(const identity of ['id','name'] as const)for(const outcome of ['confirmed','delete-failed','lookup-missing'] as const)test(`DigitalOcean stopped-hub key recovery by ${identity}: ${outcome}`,async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue('contract','agents');
 api.faults.create=503;
 const failed=await raw.acquire({...request,admission});assert.equal(failed.state,'failed');assert.equal(api.keys.length,1);
 const {readFile,writeFile}=await import('node:fs/promises');
 const directory=api.stateRoot+'/.cland/host-provider/digitalocean';
 const name=(await readdir(directory)).find(name=>name.startsWith('intent-'))!;
 const record=JSON.parse(await readFile(directory+'/'+name,'utf8'));
 // Reopen the last durable pre-POST checkpoint, or the lost-import-reply checkpoint.
 record.postState='not-started';delete record.dropletRefused;delete record.nonAcquisition;
 if(identity==='name')delete record.keyId;
 await writeFile(directory+'/'+name,JSON.stringify(record),{mode:0o600});
 const key=api.keys[0]!.id;
 if(outcome==='delete-failed')api.faults.keyDeleteFailures=[403];
 if(outcome==='lookup-missing')api.faults.omitKeyIds=[key];
 const {runHostWatchdog,hostWatchdogPaths}=await import('../src/host/host-watchdog.ts'),{spendPath}=await import('../src/executor/droplet/spend.ts');
 const path=hostWatchdogPaths(api.stateRoot,admission.lease!.id),input=JSON.parse(await readFile(path.input,'utf8'));
 await owner.close();await clock.advance(43200000);
 const provider=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock}),abort=new AbortController(),reports:string[]=[];let retries=0;
 await runHostWatchdog(input,env,clock,async ms=>{await clock.advance(ms);if(++retries===2)abort.abort();},abort.signal,{provider,processes:hostLockProcesses,report:message=>reports.push(message)});
 const receipt=JSON.parse(await readFile(path.nonAcquisition,'utf8'));
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id).cost,0);
 if(outcome==='delete-failed'||identity==='name'&&outcome==='lookup-missing') {assert.ok(receipt.orphan);assert.equal(reports.length,1);assert.equal(api.keys.length,1);}
 else {assert.equal(receipt.key.id,key);assert.equal(api.keys.length,0);assert.ok(api.requests.some(r=>r.method==='GET'&&r.path===`/v2/account/keys/${key}`));}
});

test('DigitalOcean lost import reply recovers the unique exact key name after owner closes',async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue('contract','agents');
 const original=api.provider.importKey.bind(api.provider);
 t.mock.method(api.provider,'importKey',async(...args:Parameters<typeof original>)=>{await original(...args);throw Error('import reply lost after native acceptance');});
 assert.equal((await raw.acquire({...request,admission})).state,'failed');assert.equal(api.keys.length,1);
 const {readFile}=await import('node:fs/promises'),{hostWatchdogPaths,runHostWatchdog}=await import('../src/host/host-watchdog.ts'),{spendPath}=await import('../src/executor/droplet/spend.ts');
 const path=hostWatchdogPaths(api.stateRoot,admission.lease!.id),input=JSON.parse(await readFile(path.input,'utf8'));
 await owner.close();await clock.advance(43200000);
 const provider=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock});
 await runHostWatchdog(input,env,clock,async()=>{throw Error('known no-POST key recovery must settle');},undefined,{provider,processes:hostLockProcesses});
 assert.equal(api.keys.length,0);assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id).cost,0);
 assert.equal(api.requests.filter(r=>r.method==='POST'&&r.path==='/v2/droplets').length,0);
});

test('DigitalOcean unknown POST stays reserved through key cleanup until exact-tag droplet deletion',async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue('contract','agents');
 api.faults.loseCreateResponse=1;assert.equal((await raw.acquire({...request,admission})).state,'failed');
 const id=api.droplets[0]!.id;api.faults.omitDropletIds=[id];
 const {readFile}=await import('node:fs/promises'),{hostWatchdogPaths,runHostWatchdog}=await import('../src/host/host-watchdog.ts'),{spendPath}=await import('../src/executor/droplet/spend.ts');
 const path=hostWatchdogPaths(api.stateRoot,admission.lease!.id),input=JSON.parse(await readFile(path.input,'utf8'));
 await owner.close();await clock.advance(43200000);
 const provider=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock});let held=false;
 await runHostWatchdog(input,env,clock,async ms=>{
  assert.equal(api.keys.length,0,'non-billable key is settled separately');assert.equal(api.droplets.length,1);
  assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id).cost,null,'key absence never releases unknown droplet spend');
  held=true;api.faults.omitDropletIds=[];await clock.advance(ms);
 },undefined,{provider,processes:hostLockProcesses,report:()=>{}});
 assert.equal(held,true);assert.equal(api.droplets.length,0);assert.equal(api.keys.length,0);
 const receipt=JSON.parse(await readFile(path.receipt,'utf8'));assert.equal(receipt.machine.id,String(id));
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id).released,receipt.confirmedAt);
});

for(const outcome of ['lookup-failed','lookup-ambiguous'])test(`DigitalOcean exact-name orphan remains reported: ${outcome}`,async t=>{
 const {api,clock,raw}=await fixture(t),env=fixtureEnvironment(api.stateRoot,{},{}),owner=admissionFixture(t,api.stateRoot,env,clock),admission=await owner.issue('contract','agents');
 const original=api.provider.importKey.bind(api.provider);
 t.mock.method(api.provider,'importKey',async(...args:Parameters<typeof original>)=>{await original(...args);throw Error('lost accepted key reply');});
 assert.equal((await raw.acquire({...request,admission})).state,'failed');
 if(outcome==='lookup-failed')api.beforeKeyList(async()=>{throw Error('unavailable key inventory');});
 else await original(api.keys[0]!.name,'ssh-ed25519 other-exact-name-match');
 const count=api.keys.length;
 const {readFile}=await import('node:fs/promises'),{runHostWatchdog,hostWatchdogPaths}=await import('../src/host/host-watchdog.ts'),{spendPath}=await import('../src/executor/droplet/spend.ts');
 const paths=hostWatchdogPaths(api.stateRoot,admission.lease!.id),input=JSON.parse(await readFile(paths.input,'utf8'));
 await owner.close();await clock.advance(43200000);
 const provider=new DigitalOceanHostProvider({root:api.stateRoot,env,api:api.provider,clock}),reports:string[]=[];
 await runHostWatchdog(input,env,clock,async()=>{throw Error('reported non-billable orphan must settle droplet side');},undefined,{provider,processes:hostLockProcesses,report:message=>reports.push(message)});
 assert.equal(api.keys.length,count);assert.equal(api.requests.filter(r=>r.method==='DELETE').length,0);assert.equal(reports.length,1);
 const receipt=JSON.parse(await readFile(paths.nonAcquisition,'utf8'));assert.ok(receipt.orphan);assert.equal(receipt.droplet,'never-posted');
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.find((r:{lease:string})=>r.lease===input.id).cost,0);
});
