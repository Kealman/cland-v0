// T2: scripted DigitalOcean boundary and disposable provider records; no sockets or processes.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { DigitalOceanHostProvider } from '../src/host/provider/digitalocean.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostProviderContract, type ProviderScenario } from './host-provider-contract.ts';
import { HostProviderRegistry } from '../src/host/provider/registry.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';

const request = { project: 'contract', pool: 'agents', architecture: 'x86_64' as const };
async function fixture(t: TestContext, scenario: ProviderScenario = 'normal') {
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('provider-sentinel-secret', { machine: 'scripted', clock });
  t.after(() => api.close());
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
  assert.equal(body.region, 'fra1'); assert.equal(body.size, 's-2vcpu-4gb'); assert.equal(body.image, 'ubuntu-24-04-x64');
  assert.deepEqual((body.tags as string[]).slice(0, 3), ['cland', projectTag(api.stateRoot, 'contract'), 'cland-pool-agents']);
  assert.equal(api.keys.length, 1);
  assert.deepEqual(body.ssh_keys, [api.keys[0]!.id]);
});

hostProviderContract('digitalocean', async (t, scenario) => {
  const f = await fixture(t, scenario);
  return { provider: f.provider, ready: async () => {
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
test('digitalocean missing configured image fails without a preparation receipt', async t => {
  const { api, clock } = await fixture(t);
  const provider = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, image: 'unknown' });
  assert.equal((await provider.prepare()).state, 'failed');
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
test('digitalocean keyed pool preparation refuses through preparePools and registry without publishing a recipe receipt', async t => {
  const { api } = await fixture(t);
  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  const { preparePools } = await import('../src/host/provider/pool-image.ts');
  const { DigitalOceanApi } = await import('../src/executor/droplet/api.ts');
  // Keep the real composed pool caller and registry; route the external image
  // boundary to the scripted API, never the real DigitalOcean service.
  const image = api.provider.image.bind(api.provider);
  t.mock.method(DigitalOceanApi.prototype, 'image', image);
  await mkdir(`${api.stateRoot}/.cland`, { recursive: true });
  const config = '[hosts]\nharnesses = { codex = "1.0.0" }\n[hosts.agents]\nprovider="digitalocean"\nsize="s-2vcpu-4gb"\nregion="lon1"\n';
  await writeFile(`${api.stateRoot}/.cland/config.toml`, config);
  const env = fixtureEnvironment(api.stateRoot, {}, { CLAND_FAKE_HOST_ROOT: api.stateRoot });
  const receipt = `${api.stateRoot}/.cland/run/hosts/agents-image.json`;
  await assert.rejects(preparePools(api.stateRoot, 'agents', env), /DigitalOcean pool image preparation unsupported/);
  await assert.rejects(readFile(receipt), { code: 'ENOENT' });
  await assert.rejects(readFile(`${api.stateRoot}/.cland/host-provider/digitalocean/image.json`), { code: 'ENOENT' });
  // Changing the requested recipe key must not claim current or overwrite an
  // earlier caller receipt either.
  await mkdir(`${api.stateRoot}/.cland/run/hosts`, { recursive: true });
  const previous = JSON.stringify({ key: { harnesses: { codex: '0.9.0' } }, diagnostic: 'previous-receipt' });
  await writeFile(receipt, previous);
  await writeFile(`${api.stateRoot}/.cland/config.toml`, config.replace('1.0.0', '2.0.0'));
  await assert.rejects(preparePools(api.stateRoot, 'agents', env), /DigitalOcean pool image preparation unsupported/);
  assert.equal(await readFile(receipt, 'utf8'), previous);
  assert.equal(api.requests.length, 0, 'unsupported keyed prepare refuses before any provider call');
});
