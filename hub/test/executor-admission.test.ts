// T1: refusal paths use scratch files and scripted provider/host, no sockets or children.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { access, mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DropletExecutor, ProviderCapacityUnavailable } from '../src/executor/droplet/droplet.ts';
import { keyHash } from '../src/executor/droplet/prepare.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { scriptedMachine } from './fakes/digitalocean/scripted-machine.ts';
import { readLeaseHistory } from '../src/executor/droplet/lease.ts';
import { inspectSpend } from '../src/executor/droplet/spend.ts';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { until } from './until.ts';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { syntheticProviderEnvironment } from './synthetic-provider.ts';
import { parseConfig } from '../src/init/config.ts';
import { readLease, leaseDir } from '../src/executor/droplet/lease.ts';

function regionalFixture(t: TestContext, options: { setup?: <T>(name: string, run: () => Promise<T>) => Promise<T>; adoptRoot?: (root: string) => void; step?: FixtureStep; beforeDispose?: () => Promise<void> } = {}) {
  const setup = options.setup ?? (<T>(_name: string, run: () => Promise<T>) => run());
  const work = fixtureWork();
  let root: string | undefined;
  const disposals: Array<() => Promise<void>> = [];
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    await work.close(); // Incomplete joins retain storage.
    const outcomes = await Promise.allSettled(disposals.map(dispose => dispose()));
    const errors = outcomes.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, 'regional fixture cleanup incomplete; root retained');
    if (root) await rm(root, { recursive: true, force: true });
  })();
  t.after(close); // Register before acquiring any directory or provider.
  const run = (sequence: (f: { root: string; clock: FakeClock; api: Awaited<ReturnType<typeof fakeDigitalOcean>>; machine: ReturnType<typeof scriptedMachine>; env: NodeJS.ProcessEnv; executor: DropletExecutor; step: FixtureStep }) => Promise<void>) => work.run(async localStep => {
    const step: FixtureStep = options.step ? operation => options.step!(() => localStep(operation)) : localStep;
    let api: Awaited<ReturnType<typeof fakeDigitalOcean>> | undefined;
    let executor: DropletExecutor | undefined;
    disposals.push(async () => {
      let releaseFailure: unknown;
      try { await options.beforeDispose?.(); } catch (error) { releaseFailure = error; }
      const outcomes = await Promise.allSettled([executor?.close(), api?.close()]);
      const errors = outcomes.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason);
      if (releaseFailure) errors.unshift(releaseFailure);
      if (errors.length) throw new AggregateError(errors, 'regional fixture resources did not close');
    });
    const directory = await step(() => setup('regional directory setup', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'cland-regional-'));
      root = directory; // Capture the original operation's late result before a raced setup can return.
      options.adoptRoot?.(directory);
      return directory;
    }));
    const clock = new FakeClock();
    const token = 'cland-test-regional';
    await step(() => setup('regional provider setup', async () => {
      api = await fakeDigitalOcean(token, { machine: 'scripted', clock });
    }));
    if (!api) throw new Error('regional provider setup returned no owner');
    const key = { node: process.version, lock: 'b'.repeat(64), base: 'c'.repeat(40) };
    const machine = scriptedMachine(directory, clock, key);
    const env = syntheticProviderEnvironment(fixtureEnvironment(directory, process.env, { CLAND_EXECUTOR_STATE: join(directory, 'state') }), { token, api: api.provider }, api.provider);
    executor = new DropletExecutor(directory, undefined, undefined, env, undefined, { ...machine.dependencies, api: api.provider });
    await step(() => setup('regional image setup', async () => {
      await mkdir(join(directory, '.cland/run/executor'), { recursive: true });
      await writeFile(join(directory, '.cland/config.toml'), '[verification.droplet]\nregions = ["lon1", "nyc1"]\n');
      await writeFile(join(directory, '.cland/run/executor/snapshot.json'), JSON.stringify({ image: 900, name: 'prepared', key, keyHash: keyHash(key), regions: ['lon1', 'nyc1'], minDiskSize: 10 }));
    }));
    api.faults.activeAfter = 0;
    await step(() => sequence({ root: directory, clock, api: api!, machine, env, executor: executor!, step }));
  });
  return { run, close };
}

test('submission probe refuses unavailable regions before reserving a machine', async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    await step(() => regionalFixture(scope.fixtures, { setup: scope.wait, adoptRoot: scope.adoptRoot, step }).run(async ({ api, executor, step }) => {
      api.regions.splice(0);
      await step(() => scope.wait('unavailable region receipt', () => assert.rejects(executor.checkReachability(), /lon1.*nyc1/)));
      assert.equal(api.requests.filter(row => row.method === 'POST').length, 0);
    }));
  });
});

test('submission probe reports API reachability failure with local fallback guidance', async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    await step(() => regionalFixture(scope.fixtures, { setup: scope.wait, adoptRoot: scope.adoptRoot, step }).run(async ({ api, executor, step }) => {
      scope.patch(api.provider, 'sizes', async () => { throw new Error('fixture API unreachable'); });
      await step(() => scope.wait('API refusal receipt', () => assert.rejects(executor.checkReachability(), /API.*fixture API unreachable.*verify executor local/)));
      assert.equal(api.requests.filter(row => row.method === 'POST').length, 0);
    }));
  });
});

test('submission probe names a skipped region while retaining an available region', async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    await step(() => regionalFixture(scope.fixtures, { setup: scope.wait, adoptRoot: scope.adoptRoot, step }).run(async ({ api, executor, step }) => {
      const events: Record<string, unknown>[] = [];
      scope.patch(executor, 'logger', (event: Parameters<typeof executor.logger>[0]) => { events.push(event); });
      api.regions.find(region => region.slug === 'lon1')!.available = false;
      await step(() => scope.wait('available-region probe receipt', () => executor.checkReachability()));
      assert.deepEqual(events.filter(event => event.event === 'executor-region-skipped'), [
        { event: 'executor-region-skipped', region: 'lon1', reason: 'region unavailable for size c-8' },
      ]);
      assert.equal(api.requests.filter(row => row.method === 'POST').length, 0);
    }));
  });
});

test('replacement allocation keeps the original lifetime cap in its persisted lease watchdog and spend', async t => {
  const leases: import('../src/executor/droplet/lease.ts').DropletLease[] = [];
  const scope = guardedLeaseCase(t, undefined, { canRestore: () => leases.every(lease => lease.state === 'released') });
  let releaseLeases = async () => {};
  return scope.run(async step => {
    await step(() => regionalFixture(scope.fixtures, { setup: scope.wait, adoptRoot: scope.adoptRoot, step, beforeDispose: () => releaseLeases() }).run(async ({ root, clock, machine, executor, env, step }) => {
      releaseLeases = async () => {
        for (const lease of leases) if (lease.state !== 'released') await machine.waits.run(executor.release(lease));
      };
      const config = parseConfig('[verification]\nlifetime="15m"\nrun_timeout="5m"\n[verification.droplet]\nregions=["lon1","nyc1"]', 'regional', env);
      const first = await step(() => scope.wait('original allocation receipt', () => machine.waits.run(executor.acquire({ id: 'same-run' }, new Date(clock.now().getTime() + 60000).toISOString(), undefined, config, lease => { leases.push(lease); }))));
      const originalDeadline = first.deadline;
      await step(() => scope.wait('original release receipt', () => machine.waits.run(executor.release(first))));
      assert.equal(first.state, 'released');
      await step(() => clock.advance(120000));
      const watchdogDeadlines: string[] = [];
      const arm = machine.dependencies.host.armWatchdog;
      scope.patch(machine.dependencies.host, 'armWatchdog', async (...args: Parameters<typeof arm>) => {
        watchdogDeadlines.push((await readLease(args[0])).deadline);
        return arm(...args);
      });
      config.verification.droplet.regions = ['nyc1'];
      const second = await step(() => scope.wait('replacement allocation receipt', () => machine.waits.run(executor.acquire({ id: 'same-run', leaseDeadline: originalDeadline }, originalDeadline, undefined, config, lease => { leases.push(lease); }))));
      assert.equal(second.region, 'nyc1');
      assert.equal(second.deadline, originalDeadline);
      assert.equal((await step(() => readLease(leaseDir(root, second)))).deadline, originalDeadline);
      assert.deepEqual(watchdogDeadlines, [originalDeadline]);
      const spend = await step(() => inspectSpend(5, env, clock, machine.dependencies.processes));
      assert.ok(Math.abs(spend.reserved - 0.25 * 13 / 60) < 0.000001, 'only the remaining thirteen minutes are reserved');
      await step(() => scope.wait('replacement release receipt', () => machine.waits.run(executor.release(second))));
      assert.equal(second.state, 'released');
    }));
  });
});

test('regional fixture joins held work and fences its next write before disposal', async t => {
  const fixture = regionalFixture(t);
  const release = Promise.withResolvers<void>();
  let entered = false, disposed = false, directory = '';
  const sequence = fixture.run(async ({ root, api, step }) => {
    directory = root;
    const close = api.close.bind(api);
    t.mock.method(api, 'close', async (...args: Parameters<typeof close>) => {
      assert.equal(await readFile(join(root, 'held-write'), 'utf8'), 'complete');
      await assert.rejects(access(join(root, 'forbidden-write')), { code: 'ENOENT' });
      disposed = true;
      return close(...args);
    });
    await step(async () => {
      entered = true;
      await release.promise;
      await writeFile(join(root, 'held-write'), 'complete');
    });
    await step(() => writeFile(join(root, 'forbidden-write'), 'late'));
  });
  const fenced = assert.rejects(sequence, /fixture work admission closed/);
  try {
    await until(() => entered, { what: 'regional fixture admitted held write' });
    const closing = fixture.close();
    assert.equal(disposed, false);
    await access(directory);
    release.resolve();
    await fenced;
    await closing;
    assert.equal(disposed, true);
    await assert.rejects(access(directory), { code: 'ENOENT' });
  } finally {
    release.resolve();
    await Promise.allSettled([fenced, fixture.close()]);
  }
});

for (const scenario of ['fallback', 'exhausted', 'other 422', 'other 400', 'other 500', 'malformed success'] as const) test(`regional create ${scenario} preserves provider handling and resource accounting`, async t => regionalFixture(t).run(async ({ root, clock, api, machine, env, executor, step }) => {
  api.createRefusals.lon1 = { status: 422, id: 'unprocessable_entity', message: 'Size is not available in this region' };
  if (scenario === 'exhausted') api.createRefusals.nyc1 = { ...api.createRefusals.lon1 };
  if (scenario.startsWith('other')) api.createRefusals.lon1 = { status: Number(scenario.slice(-3)), id: 'unprocessable_entity', message: 'Other create refusal' };
  if (scenario === 'malformed success') { delete api.createRefusals.lon1; api.faults.malformedCreate = true; }
  const log = join(root, 'suite.log');
  if (scenario !== 'fallback') {
    await step(() => machine.waits.run(assert.rejects(executor.acquire({ id: 'regional', log }, new Date(clock.now().getTime() + 60000).toISOString()), error => {
      if (scenario === 'exhausted') {
        assert.ok(error instanceof ProviderCapacityUnavailable);
        assert.equal(error.message, 'droplet size c-8 unavailable: lon1: DigitalOcean 422 unprocessable_entity: Size is not available in this region; nyc1: DigitalOcean 422 unprocessable_entity: Size is not available in this region');
      } else if (scenario === 'malformed success') assert.equal(error instanceof ProviderCapacityUnavailable, false);
      else assert.match(String(error), /Other create refusal/);
      return true;
    })));
    assert.deepEqual(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').map(r => r.body?.region), scenario === 'exhausted' ? ['lon1', 'nyc1'] : ['lon1']);
  } else {
    const lease = await step(() => machine.waits.run(executor.acquire({ id: 'regional', log }, new Date(clock.now().getTime() + 60000).toISOString())));
    assert.equal(lease.region, 'nyc1');
    assert.equal(lease.resource, api.droplets[0]?.id);
    assert.deepEqual(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').map(r => r.body?.region), ['lon1', 'nyc1']);
    assert.match(await step(() => readFile(log, 'utf8')), /lon1.*422 unprocessable_entity: Size is not available in this region/);
    await step(() => machine.waits.run(executor.release(lease)));
  }
  const record = (await step(() => readLeaseHistory(root)))[0];
  assert.equal(record?.state, scenario === 'other 500' || scenario === 'malformed success' ? 'releasing' : 'released');
  if (scenario === 'malformed success') {
    assert.equal(record?.createFinished, undefined);
    assert.equal(record?.resource, null);
  }
  assert.deepEqual(api.droplets, []);
  assert.deepEqual(api.keys, []);
  const spend = await step(() => inspectSpend(14, env, clock, machine.dependencies.processes));
  if (scenario === 'other 500' || scenario === 'malformed success') assert.ok(spend.reserved > 0, 'ambiguous create retains its spend fence');
  else assert.equal(spend.reserved, 0);
  if (scenario === 'exhausted') assert.equal(spend.spent, 0);
}));

test('scripted provider native hooks block a peer clock driver until publication completes', async t => {
  const clock = new FakeClock(0);
  const advance = t.mock.method(clock, 'advance');
  const api = await fakeDigitalOcean('sentinel-publication', { machine: 'scripted', clock });
  t.after(() => api.close());
  const peer = scriptedMachine('/unused', clock, { node: process.version, lock: 'lock', base: 'base' });
  const entered = Promise.withResolvers<void>(), publication = Promise.withResolvers<void>();
  api.beforeImport(() => { entered.resolve(); return publication.promise; });
  const writer = api.provider.importKey('held', 'public');
  await entered.promise;
  const completion = peer.waits.run(Promise.all([writer, peer.waits.wait(60000)]));
  try {
    await peer.waits.run(Promise.resolve());
    assert.equal(advance.mock.callCount(), 0, 'provider native I/O must block the peer driver');
  } finally { publication.resolve(); await writer; await completion; }
  assert.equal(api.keys.length, 1);
  assert.equal(clock.now().getTime(), 60000);
  assert.equal(clock.pending, 0, 'the completed provider deadline was cancelled before time advanced');
});

test('remote admission refusal causes retain their reason and clean up resources', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-admission-'));
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('sentinel-admission', { machine: 'scripted', clock });
  t.after(async () => { await api.close(); await rm(root, { recursive: true, force: true }); });
  const key = { node: process.version, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };
  const machine = scriptedMachine(root, clock, key);
  const env = { DIGITALOCEAN_TOKEN: 'sentinel-admission', CLAND_EXECUTOR_STATE: join(root, 'state') };
  const executor = new DropletExecutor(root, undefined, undefined, env, undefined, { ...machine.dependencies, api: api.provider });
  const snapshotPath = join(root, '.cland/run/executor/snapshot.json');
  await mkdir(join(root, '.cland/run/executor'), { recursive: true });
  const snapshot = { image: 900, name: 'prepared', key, keyHash: keyHash(key), regions: ['lon1'], minDiskSize: 10 };
  const regions = structuredClone(api.regions);
  for (const [cause, reason, creates] of [
    ['token', /DIGITALOCEAN_TOKEN is required/, 0],
    ['422', /422/, 1],
    ['500', /500/, 1],
    ['snapshot', /no prepared snapshot/, 0],
    ['region', /unavailable in regions/, 0],
  ] as const) {
    await writeFile(snapshotPath, JSON.stringify(snapshot));
    env.DIGITALOCEAN_TOKEN = cause === 'token' ? '' : 'sentinel-admission';
    api.faults.create = cause === '422' || cause === '500' ? Number(cause) : 0;
    api.faults.echoToken = true;
    api.regions.splice(0, api.regions.length, ...(cause === 'region' ? [] : regions));
    if (cause === 'snapshot') await rm(snapshotPath);
    const before = api.requests.filter(request => request.method === 'POST' && request.path === '/v2/droplets').length;
    await machine.waits.run(assert.rejects(executor.acquire({ id: cause }, new Date(clock.now().getTime() + 60000).toISOString()), error => {
      assert.match(String(error), reason);
      assert.doesNotMatch(String(error), /sentinel-admission/);
      return true;
    }));
    assert.equal(api.requests.filter(request => request.method === 'POST' && request.path === '/v2/droplets').length - before, creates, cause);
    assert.deepEqual(api.droplets, [], cause);
    assert.deepEqual(api.keys, [], cause);
  }
});
