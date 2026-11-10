import { beforeDirectories } from './process-cleanup.ts';
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

async function closeFixture(api: { close(options?: { retainRoot?: boolean }): Promise<void> }, beforeClose?: () => Promise<void>) {
  const failures: unknown[] = [];
  try { await beforeClose?.(); } catch (error) { failures.push(error); }
  try { await api.close({ retainRoot: failures.length > 0 }); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, 'volume fixture cleanup incomplete');
}

async function fixture(t: TestContext, scenario = 'normal', beforeClose?: () => Promise<void>) {
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('volume-sentinel', { machine: 'scripted', clock, testContext: t });
  beforeDirectories(t, () => closeFixture(api, beforeClose));
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
  const create = provider.createVolume.bind(provider);
  provider.createVolume = options => create({ ...options, admission: options.admission ?? { login: options.name, project: options.project, pool: 'agents' } });
  return { provider, api, clock, env };
}
hostProviderVolumeContract('digitalocean', async (t, scenario) => {
  const f = await fixture(t, scenario);
  return { provider: f.provider, region: 'lon1', otherRegion: 'fra1',
    snapshotRetryAt: new Date(f.clock.now().getTime() + 600000).toISOString(),
    advanceSnapshotWindow: () => f.clock.advance(600000), ready: async () => {} };
}, (name, run) => test(name, run), true);

test('digitalocean volume create carries lon1, 1 GiB and project/pool tags', async t => {
  const { provider, api } = await fixture(t);
  const result = await provider.createVolume({ project: 'contract', region: 'lon1', name: 'login', sizeGiB: 1 });
  assert.equal(result.state, 'created');
  const body = api.requests.find(r => r.method === 'POST' && r.path === '/v2/volumes')!.body!;
  assert.equal(body.size_gigabytes, 1); assert.equal(body.region, 'lon1');
  assert.deepEqual(body.tags, ['cland', projectTag(api.stateRoot, 'contract'), 'cland-pool-agents']);
});

test('digitalocean volume create requires login admission outside the fake-host fence', async t => {
  const { api, clock } = await fixture(t);
  const provider = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, pool: 'agents' });
  const input = { project: 'contract', region: 'lon1', name: 'login', sizeGiB: 1 };
  const before = api.requests.length;
  assert.deepEqual(await provider.createVolume(input), { state: 'refused', reason: 'DigitalOcean volume create requires login admission' });
  assert.equal(api.requests.length, before);
  for (const admission of [{ login: '', project: 'contract', pool: 'agents' }, { login: 'login', project: 'other', pool: 'agents' }, { login: 'login', project: 'contract', pool: 'other' }]) {
    assert.equal((await provider.createVolume({ ...input, admission })).state, 'refused');
    assert.equal(api.requests.length, before);
  }
  assert.equal((await provider.createVolume({ ...input, admission: { login: 'login', project: 'contract', pool: 'agents' } })).state, 'created');
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

test('digitalocean volume admission selects pool and shares the creation pause', async t => {
  const { provider, api, clock, env } = await fixture(t);
  const unbound = new DigitalOceanHostProvider({ root: api.stateRoot, env, api: api.provider, clock });
  const request = { project: 'contract', name: 'login', region: 'lon1', sizeGiB: 1 };
  assert.equal((await unbound.createVolume({ ...request, admission: { login: 'login', project: 'contract', pool: 'actual' } })).state, 'created');
  assert.ok(api.volumes[0]!.tags.includes('cland-pool-actual'));
  api.faults.rateLimits = 1;
  api.faults.retryAfter = '2';
  const refused = await provider.createVolume(request);
  assert.deepEqual(refused, { state: 'refused', reason: 'DigitalOcean creation paused', retryAt: new Date(clock.now().getTime() + 2000).toISOString() });
  const count = api.requests.length;
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

test('digitalocean snapshot restore sends source region and tags; deletion needs observed absence', async t => {
  const { provider, api } = await fixture(t);
  const v = await provider.createVolume({ project: 'contract', region: 'lon1', name: 'login', sizeGiB: 1 });
  assert.equal(v.state, 'created'); if (v.state !== 'created') return;
  const s = await provider.snapshotVolume(v.volume);
  assert.equal(s.state, 'snapshotted'); if (s.state !== 'snapshotted') return;
  const restored = await provider.createVolume({ project: 'contract', region: 'fra1', name: 'copy', sizeGiB: 1, fromSnapshot: s.snapshot });
  assert.equal(restored.state, 'created');
  assert.deepEqual(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/volumes').at(-1)!.body, {
    name: 'copy', region: 'lon1', size_gigabytes: 1, snapshot_id: s.snapshot.id,
    tags: ['cland', projectTag(api.stateRoot, 'contract'), 'cland-pool-agents'],
  });
  api.faults.snapshotDelete404Reads = 1;
  const before = api.requests.length;
  assert.equal((await provider.deleteSnapshot(s.snapshot)).state, 'incomplete');
  assert.deepEqual(api.requests.slice(before).map(r => [r.method, r.path]), [
    ['GET', `/v2/snapshots/${s.snapshot.id}`], ['DELETE', `/v2/snapshots/${s.snapshot.id}`], ['GET', `/v2/snapshots/${s.snapshot.id}`],
  ]);
  assert.deepEqual(await provider.listSnapshots(v.volume), { state: 'listed', snapshots: [s.snapshot] });
  api.faults.snapshotDelete404Reads = 0;
  assert.deepEqual(await provider.deleteSnapshot(s.snapshot.id), { state: 'deleted' });
  assert.deepEqual(await provider.deleteSnapshot(s.snapshot.id), { state: 'deleted' });
  assert.equal((await provider.getSnapshot(s.snapshot.id)).state, 'failed');
});

test('digitalocean snapshot receipts and source project fence destructive use across restart', async t => {
  const { provider, api, clock } = await fixture(t);
  const v = await provider.createVolume({ project: 'contract', region: 'lon1', name: 'login', sizeGiB: 1 });
  assert.equal(v.state, 'created'); if (v.state !== 'created') return;
  const s = await provider.snapshotVolume(v.volume);
  assert.equal(s.state, 'snapshotted'); if (s.state !== 'snapshotted') return;
  for (const forged of [{ ...s.snapshot, volumeId: 'other' }, { ...s.snapshot, created: '2000-01-01T00:00:00Z' }]) {
    const before = api.requests.length;
    assert.equal((await provider.deleteSnapshot(forged)).state, 'incomplete');
    assert.equal(api.requests.slice(before).filter(r => r.method === 'DELETE').length, 0);
  }
  await provider.deleteVolume(v.volume);
  const restarted = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock, pool: 'agents' });
  for (const source of [s.snapshot, s.snapshot.id]) {
    const before = api.requests.length;
    assert.equal((await restarted.createVolume({ project: 'other', name: 'foreign', region: 'lon1', sizeGiB: 1, fromSnapshot: source, admission: { login: 'foreign', project: 'other', pool: 'agents' } })).state, 'failed');
    assert.equal(api.requests.slice(before).filter(r => r.method === 'POST').length, 0);
  }
  assert.equal((await restarted.createVolume({ project: 'contract', name: 'own', region: 'fra1', sizeGiB: 1, fromSnapshot: s.snapshot.id, admission: { login: 'own', project: 'contract', pool: 'agents' } })).state, 'created');
  assert.deepEqual(await restarted.deleteSnapshot(s.snapshot), { state: 'deleted' });
});

test('digitalocean volume fixture closes API and retains root after rejected owner drain', async () => {
  let closed = false;
  const drainError = new Error('injected owner drain failure');
  const closeError = new Error('injected API close failure');
  await assert.rejects(closeFixture({ close: async options => {
    closed = true;
    assert.deepEqual(options, { retainRoot: true });
    throw closeError;
  } }, async () => { throw drainError; }), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [drainError, closeError]);
    return true;
  });
  assert.equal(closed, true);
});

test('digitalocean snapshot restore keeps retained region when API region order changes', async t => {
  const { provider, api } = await fixture(t);
  const v = await provider.createVolume({ project: 'contract', region: 'lon1', name: 'login', sizeGiB: 1 });
  assert.equal(v.state, 'created'); if (v.state !== 'created') return;
  const s = await provider.snapshotVolume(v.volume);
  assert.equal(s.state, 'snapshotted'); if (s.state !== 'snapshotted') return;
  api.faults.volumeSnapshotRegions = ['fra1', 'lon1'];
  const clone = await provider.createVolume({ project: 'contract', region: 'ams3', name: 'copy', sizeGiB: 1, fromSnapshot: s.snapshot.id });
  assert.equal(clone.state, 'created'); if (clone.state !== 'created') return;
  assert.equal(clone.volume.region, 'lon1');
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/volumes').at(-1)!.body!.region, 'lon1');
});
