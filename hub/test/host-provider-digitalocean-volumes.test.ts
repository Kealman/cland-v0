import { admissionFixture } from './host-admission-fixture.ts';
import { seedPoolImages } from './digitalocean-pool-fixture.ts';
// T2: scripted provider boundary; disposable records, no native processes or sockets.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DigitalOceanHostProvider } from '../src/host/provider/digitalocean.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostProviderVolumeContract } from './host-provider-contract.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';

async function fixture(t: TestContext, scenario = 'normal', beforeClose?: () => Promise<void>) {
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('volume-sentinel', { machine: 'scripted', clock });
  t.after(async () => { await beforeClose?.(); await api.close(); });
  await seedPoolImages(api.stateRoot);
  api.account.droplet_limit = 10;
  api.faults.allocateAddressEarly = true;
  api.faults.activeAfter = 0;
  api.faults.actionAfter = 1;

  if (scenario === 'ignored-volume-delete') Object.assign(api.faults, { volumeDelete404Reads: 100 });
  const env = fixtureEnvironment(api.stateRoot, {}, { CLAND_FAKE_HOST_ROOT: api.stateRoot });
  const provider = new DigitalOceanHostProvider({ root: api.stateRoot, env, api: api.provider, clock, pool: 'agents' });
  await provider.refreshDeclarations();
  await admissionFixture(t,api.stateRoot,env,clock).wrap(provider);
  return { provider, api, clock, env };
}
hostProviderVolumeContract('digitalocean', async (t, scenario) => {
  const f = await fixture(t, scenario);
  return { provider: f.provider, region: 'lon1', otherRegion: 'fra1',
    snapshotRetryAt: new Date(f.clock.now().getTime() + 600000).toISOString(),
    advanceSnapshotWindow: () => f.clock.advance(600000), ready: async () => {} };
}, (name, run) => test(name, run));

test('digitalocean volume create carries lon1, 1 GiB and project/pool tags', async t => {
  const { provider, api } = await fixture(t);
  const result = await provider.createVolume({ project: 'contract', region: 'lon1', name: 'login', sizeGiB: 1 });
  assert.equal(result.state, 'created');
  const body = api.requests.find(r => r.method === 'POST' && r.path === '/v2/volumes')!.body!;
  assert.equal(body.size_gigabytes, 1); assert.equal(body.region, 'lon1');
  assert.deepEqual(body.tags, ['cland', projectTag(api.stateRoot, 'contract'), 'cland-pool-agents']);
});

test('digitalocean volume actions publish attachment only after completed', async t => {
  const { until, testWaitMs } = await import('./until.ts');
  let drain = async () => {};
  // Register the join before fixture close: a missed receipt retains the root.
  const { provider, api, clock } = await fixture(t, 'normal', () => drain());
  let pollQueued = false;
  const schedule = clock.setTimeout.bind(clock);
  t.mock.method(clock, 'setTimeout', (callback: () => void, ms: number) => {
    const timer = schedule(() => { if (ms === 100) pollQueued = false; callback(); }, ms);
    // Only the provider's action poll uses 100ms in this clock scope. The
    // scripted API's 15000ms transport timers never publish this receipt.
    if (ms === 100) pollQueued = true;
    return timer;
  });
  const a = await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64', region: 'lon1' });
  const v = await provider.createVolume({ project: 'contract', name: 'login', region: 'lon1', sizeGiB: 1 });
  assert.equal(a.state, 'created'); assert.equal(v.state, 'created');
  if (a.state !== 'created' || v.state !== 'created') return;
  api.faults.actionAfter = 2;
  for (const scenario of [{ type: 'attach', earlyFailure: true }, { type: 'detach', earlyFailure: true }, { type: 'attach', earlyFailure: false }, { type: 'detach', earlyFailure: false }] as const) {
    const { type, earlyFailure } = scenario;
    let settled = false;
    const work: Promise<import('../src/host/provider/provider.ts').AttachVolumeResult | import('../src/host/provider/provider.ts').DetachVolumeResult> = (type === 'attach' ? provider.attachVolume(v.volume, a.machine) : provider.detachVolume(v.volume, a.machine)).finally(() => { settled = true; });
    void work.catch(() => {});
    drain = async () => {
      await until(async () => {
        if (pollQueued) await clock.advance(100);
        return settled;
      }, { what: `${type} provider operation joined before fake/root close`, timeoutMs: testWaitMs(2000) });
      await work;
    };
    if (earlyFailure) {
      await assert.rejects(async () => {
        try { throw new Error('injected assertion before poll admission'); }
        finally { await drain(); }
      }, /injected assertion before poll admission/);
      assert.equal(settled, true);
      assert.deepEqual(await work, { state: type === 'attach' ? 'attached' : 'detached' });
      assert.deepEqual(api.volumes[0]!.droplet_ids, type === 'attach' ? [Number(a.machine.id)] : []);
      continue;
    }
    try {
      await until(() => pollQueued || settled, { what: `${type} exact action poll admitted`, timeoutMs: testWaitMs(2000) });
      assert.equal(pollQueued, true);
      assert.equal(settled, false);
      assert.deepEqual(api.volumes[0]!.droplet_ids, type === 'attach' ? [] : [Number(a.machine.id)]);
      await clock.advance(100);
      await until(() => settled, { what: `${type} completion returned`, timeoutMs: testWaitMs(2000) });
      assert.deepEqual(await work, { state: type === 'attach' ? 'attached' : 'detached' });
      const actionRead = api.requests.filter(r => r.method === 'GET' && /^\/v2\/actions\//.test(r.path)).at(-1)!;
      assert.equal((await api.provider.action(Number(actionRead.path.split('/').at(-1)))).status, 'completed');
      assert.deepEqual(api.volumes[0]!.droplet_ids, type === 'attach' ? [Number(a.machine.id)] : []);
    } finally { await drain(); }
  }
});

test('digitalocean volume creation requires a pool, shares pause and resolves acquire pool', async t => {
  const { provider, api, clock, env } = await fixture(t);
  const unbound = new DigitalOceanHostProvider({ root: api.stateRoot, env, api: api.provider, clock });
  const request = { project: 'contract', name: 'login', region: 'lon1', sizeGiB: 1 };
  let count = api.requests.length;
  assert.deepEqual(await unbound.createVolume(request), { state: 'refused', reason: 'volume pool unavailable' });
  assert.equal(api.requests.length, count);
  await admissionFixture(t,api.stateRoot,env,clock).wrap(unbound);
  await unbound.acquire({ project: 'contract', pool: 'actual', architecture: 'x86_64' });
  assert.equal((await unbound.createVolume(request)).state, 'created');
  assert.ok(api.volumes[0]!.tags.includes('cland-pool-actual'));
  api.faults.rateLimits = 1;
  api.faults.retryAfter = '2';
  const refused = await provider.createVolume(request);
  assert.deepEqual(refused, { state: 'refused', reason: 'DigitalOcean creation paused', retryAt: new Date(clock.now().getTime() + 2000).toISOString() });
  count = api.requests.length;
  assert.deepEqual(await provider.createVolume(request), refused);
  assert.equal((await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64' })).state, 'refused');
  assert.equal(api.requests.length, count);
  await clock.advance(2000);
  assert.equal((await provider.createVolume(request)).state, 'created');
});

test('digitalocean lost volume create reply retains discoverable resource without replay', async t => {
  const { provider, api } = await fixture(t);
  api.faults.loseVolumeCreateResponse = 1;
  const result = await provider.createVolume({ project: 'contract', name: 'lost', region: 'lon1', sizeGiB: 1 });
  assert.equal(result.state, 'failed');
  const inventory = await provider.listVolumes({ project: 'contract' });
  assert.equal(inventory.state, 'listed');
  if (inventory.state !== 'listed') return;
  assert.equal(inventory.volumes.length, 1);
  assert.equal(inventory.volumes[0]!.name, 'lost');
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/volumes').length, 1);
});

test('digitalocean known snapshot refusal returns immediately for the exact volume identity', async t => {
  const { provider, api, clock } = await fixture(t);
  const { until, testWaitMs } = await import('./until.ts');
  const v = await provider.createVolume({ project: 'contract', name: 'login', region: 'lon1', sizeGiB: 1 });
  assert.equal(v.state, 'created');
  if (v.state !== 'created') return;
  assert.equal((await provider.snapshotVolume(v.volume)).state, 'snapshotted');
  const refused = await provider.snapshotVolume(v.volume);
  assert.equal(refused.state, 'refused');
  const sent = api.requests.length;
  let settled = false;
  const work = provider.snapshotVolume({ ...v.volume }).then(result => { settled = true; return result; });
  try {
    await until(() => settled, { what: 'known snapshot refusal returned without advancing time', timeoutMs: testWaitMs(500) });
    assert.deepEqual(await work, refused);
    assert.equal(api.requests.length, sent);
    await clock.advance(599999);
    assert.deepEqual(await provider.snapshotVolume(v.volume), refused);
    assert.equal(api.requests.length, sent);
    await clock.advance(1);
    assert.equal(api.requests.length, sent, 'expiry does not replay a mutation');
    assert.equal((await provider.snapshotVolume(v.volume)).state, 'snapshotted');
  } finally { if (!settled) await clock.advance(600000); await work; }
});
