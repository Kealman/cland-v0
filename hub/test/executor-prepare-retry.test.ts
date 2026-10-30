// T2: one fixture drives the builder release policy against an in-process provider.
// Scripted transport acknowledges provisioning; shell/image contents remain in executor-prepare.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { DigitalOceanError } from '../src/executor/droplet/api.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import type { Executor } from '../src/executor/executor.ts';
import { projectHub, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import { uploadOwner } from './web-upload-owner.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { guardDirectoryRemoval } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';

test('prepare retries transient builder deletion failures within its release window', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_DROPLET_RELEASE_MS: '5000' } });
  await f.stop();
  const records: { event?: unknown; cause?: { status?: number; id?: string } }[] = [];
  const provider = f.api.provider;
  let transportTimeout = false;
  const executor = new DropletExecutor(f.root, undefined, record => records.push(record), f.env, undefined, {
    ...f.dependencies,
    api: new Proxy(provider, { get(target, property) {
      if (property === 'deleteDroplet') return async (...args: Parameters<typeof provider.deleteDroplet>) => {
        if (transportTimeout) { transportTimeout = false; throw new DigitalOceanError(0, 'transport', 'request failed or exceeded its time bound'); }
        return provider.deleteDroplet(...args);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } }),
    machine: { ...f.dependencies.machine!, exec: async () => '', result: async () => ({ stdout: '', stderr: '', code: 0 }), put: async () => {} },
  });
  let index = 0;
  for (const failure of [409, 422, 503, 'timeout', 'key-503'] as const) {
    records.length = 0;
    if (failure === 'key-503') f.api.faults.keyDeleteFailures = [503];
    else if (failure === 'timeout') transportTimeout = true;
    else f.api.faults.deleteFailures = [failure];
    f.api.faults.echoToken = true;
    const key = { ...f.key, lock: String(++index).repeat(64) };
    const result = await drive(f, executor.prepare(key));
    assert.equal(result.state, 'prepared', String(failure));
    assert.notEqual(result.lifetimeMs, null, String(failure));
    assert.ok(result.costUsd! > 0, String(failure));
    assert.deepEqual(f.api.droplets, [], String(failure));
    assert.deepEqual(f.api.keys, [], String(failure));
    assert.equal(f.api.images.length, 1, String(failure));
    assert.ok(!JSON.stringify(records).includes('cland-test-remote-suite-token'));
    const retry = records.find(record => record.event === 'executor-release-retry');
    assert.equal(retry?.cause?.status, failure === 'timeout' ? 0 : failure === 'key-503' ? 503 : failure);
    assert.equal(retry?.cause?.id, failure === 'timeout' ? 'transport' : failure === 'key-503' ? 'key_delete_failed' : 'delete_failed');
  }
});


/** Compose existing setup/result/drain owners; no new timeout or cancellation policy. */
async function interfaceFixture(t: TestContext, heldKey = false) {
  let acquisition: Promise<Awaited<ReturnType<typeof fixture>>> | undefined;
  let backend: DropletExecutor | undefined;
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const owner = uploadOwner(t, async () => {
    const f = await acquisition;
    await backend?.close();
    await f?.stop();
  }, () => release.resolve());
  // Deferred fixture hooks retain even partially acquired roots until setup joins.
  const setup = caseDeadlines(t);
  acquisition = owner.track(setup.wait('interface fixture acquisition', () =>
    fixture(setup.fixtures, { machine: 'scripted', hub: projectHub })));
  const f = await acquisition;
  for (const root of [f.root, f.territory, f.api.stateRoot]) guardDirectoryRemoval(root, owner.dispose);
  await owner.join(owner.track(f.stop().then(() => {})));
  backend = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, {
    ...f.dependencies,
    ...(heldKey ? { prepareKey: async () => { entered.resolve(); await release.promise; return f.key; } } : {}),
  });
  return { f, backend, owner, entered: entered.promise };
}

test('executor interface prepares the current image and reaps through neutral options', async t => {
  const { f, backend, owner } = await interfaceFixture(t);
  const executor: Executor = backend;
  try {
    const prepared = await owner.join(owner.track(drive(f, executor.prepare({}))));
    assert.equal(prepared.state, 'current');
    const legacy = await owner.join(owner.track(backend.prepare(f.key)));
    assert.equal(prepared.summary, legacy.summary);
    let authorized = 0;
    const reaped = await owner.join(owner.track(executor.reap({ authorize: () => { authorized++; } })));
    assert.deepEqual(reaped, { deleted: [], deletedKeys: [], summary: 'reaped: 0 droplets' });
    assert.equal(authorized, 1);
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  } finally { await owner.dispose(); }
});

for (const failure of ['omitted', 'aborted'] as const) {
  test(`executor interface drains pending preparation after ${failure} setup`, async t => {
    const { f, backend, owner, entered } = await interfaceFixture(t, true);
    const setupClock = new FakeClock();
    const abort = new AbortController();
    const preparing = owner.track(backend.prepare({}));
    await owner.setup(entered);
    const observing = owner.setup(new Promise<void>(() => {}), { clock: setupClock, signal: abort.signal });
    const rejected = assert.rejects(observing, failure === 'omitted' ? /setup receipt deadline/ : /setup cancelled/);
    if (failure === 'omitted') await setupClock.advance(1000);
    else abort.abort(new Error('setup cancelled'));
    await rejected;
    await owner.dispose();
    assert.equal((await owner.join(preparing)).state, 'current', 'disposal joins the actual preparation result');
    assert.equal(owner.pending(), 0);
    assert.equal(setupClock.pending, 0);
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
}


test('local executor preparation and provider reaping are typed no-ops', async t => {
  const root = await tempProject(t, 'executor-interface-');
  const backend = new LocalExecutor([], () => assert.fail('no checkpoint'), () => assert.fail('no admission'), fixtureEnvironment(root, process.env));
  const executor: Executor = backend;
  assert.deepEqual(await executor.prepare({ step: () => assert.fail('no preparation') }), {
    state: 'not-applicable', summary: 'local executor needs no preparation',
  });
  assert.deepEqual(await executor.reap({ authorize: () => assert.fail('no provider mutation') }), {
    state: 'not-applicable', summary: 'local executor has no provider resources to reap',
  });
});
