// T2: snapshot replacement, refusal and recovery rules use a scripted provider/transport.
// Native image bytes, shell setup, key boot hooks and hub-stop drain stay in executor-prepare.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import files from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { guardedLeaseCase } from './executor-lease-fixture.ts';
import { basename, join } from 'node:path';
import { projectHub, tempProject, inProcessSpoke, eventually, flushProjectLogs } from './harness.ts';
import { accountFixtureEnvironment } from './account-fixture-env.ts';
import { syntheticProviderEnvironment } from './synthetic-provider.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { scriptedMachine } from './fakes/digitalocean/scripted-machine.ts';
import { FakeClock } from './fake-clock.ts';
import { drive } from './remote-clock.ts';
import { onCleanup, beforeDirectories, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import type { DropletDependencies } from '../src/executor/droplet/dependencies.ts';
import { executorSnapshotNotice, Dispatcher } from '../src/hub/dispatch.ts';
import { DropletExecutor, projectName } from '../src/executor/droplet/droplet.ts';
import { keyHash, readSnapshot, snapshotPath, type Snapshot } from '../src/executor/droplet/prepare.ts';
import { readLeases, readLeaseHistory, type DropletLease } from '../src/executor/droplet/lease.ts';
import { Machine } from '../src/executor/droplet/machine.ts';
import { diagnosticResult } from '../src/hub/merge-batches.ts';
import { DeliveryTransportError } from '../src/executor/droplet/run.ts';
import { Store } from '../src/hub/store.ts';
import { DatabaseSync } from 'node:sqlite';
import { defaultConfig } from '../src/init/config.ts';
import { ReadinessDeadlineError } from '../src/executor/droplet/readiness-deadline.ts';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { copyFixtureCase } from './executor-copy-fixture.ts';
import { MachineRequestError } from '../src/executor/droplet/machine.ts';
import { readRecoveries } from '../src/executor/droplet/snapshot-recovery.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { DigitalOceanError } from '../src/executor/droplet/api.ts';
import { testDeadlineMs } from './until.ts';

for (const boundary of ['reservation', 'regional refusal'] as const) test(`acquisition preserves primary failure at ${boundary} cleanup boundary`, async t => {
  const scope = guardedLeaseCase(t, undefined, { timeoutMs: testDeadlineMs(5000) });
  return scope.run(async step => {
    const f = await step(() => scope.wait('boundary fixture setup', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    await step(() => scope.wait('fixture hub stop', () => f.stop()));
    const snapshot: Snapshot = { image: 900, name: 'ready', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
    await step(() => scope.wait('snapshot setup', async () => {
      await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
      await writeFile(snapshotPath(f.root), JSON.stringify(snapshot));
    }));
    const primary = boundary === 'reservation' ? new Error('reservation checkpoint failed') : new DigitalOceanError(422, 'unprocessable_entity', 'Size is not available in this region');
    const cleanup = new Error('secondary checkpoint or unlock failed');
    const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
    const rename = files.rename, remove = files.rm;
    let refused = false;
    const restoreRename = scope.patch(files, 'rename', async (...args: Parameters<typeof rename>) => {
      if (!refused && String(args[1]).endsWith('/lease.json')) { refused = true; throw boundary === 'reservation' ? primary : cleanup; }
      return rename(...args);
    });
    if (boundary === 'regional refusal') {
      restoreRename();
      scope.patch(f.dependencies.api, 'create', async () => {
        scope.patch(files, 'rename', async (...args: Parameters<typeof rename>) => {
          if (!refused && String(args[1]).endsWith('/lease.json')) { refused = true; throw cleanup; }
          return rename(...args);
        });
        throw primary;
      });
    }
    const lock = join(f.root, '.cland/run/executor/budget.lock');
    const restoreRemove = scope.patch(files, 'rm', async (...args: Parameters<typeof remove>) => {
      if (boundary === 'reservation' && String(args[0]) === lock) throw cleanup;
      return remove(...args);
    });
    try {
      await step(() => scope.wait('acquisition failure receipt', () => assert.rejects(drive(f, executor.acquire({ id: 'boundary-failure' }, new Date(f.clock.now().getTime() + 60000).toISOString())), error => {
        assert.equal(error, primary);
        assert.ok(primary.cause instanceof AggregateError);
        assert.deepEqual(primary.cause.errors, [cleanup]);
        return true;
      })));
      if (boundary === 'reservation') await step(() => scope.wait('retained lock receipt', () => stat(lock)));
    } finally { restoreRemove(); restoreRename(); }
    await step(() => scope.wait('retained owner reconciliation', () => drive(f, executor.reconcile(true))));
    await step(() => scope.wait('lock removal receipt', () => assert.rejects(stat(lock), { code: 'ENOENT' })));
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

test('prepare replaces a matching oversized snapshot so c-4 and c-8 restore it', async t => {
  await fixtureNativeGuard(t);
  const f = await fixture(t);
  await f.stop();
  f.api.sizes.push({ slug: 'c-4', available: true, price_hourly: 0.125, disk: 25, regions: ['lon1', 'nyc1'] });
  for (const region of f.api.regions) region.sizes.push('c-4');
  const config = join(f.root, '.cland/config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + 'snapshot_size = "c-4"\n');
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  const name = `cland-${projectName(basename(f.root))}-${keyHash(f.key)}`;
  await f.api.seedSnapshot({ id: 900, name, resource_id: 'old-builder', regions: ['lon1'], size_gigabytes: 1, min_disk_size: 50, created_at: f.clock.now().toISOString() }, f.key);
  await writeFile(snapshotPath(f.root), JSON.stringify({ image: 900, name, key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 50, created: f.clock.now().toISOString() }));
  const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
  const prepared = await drive(f, executor.prepare());
  assert.equal(prepared.state, 'prepared');
  assert.equal(prepared.snapshot.minDiskSize, 25);
  assert.notEqual(prepared.snapshot.image, 900);
  assert.equal(f.api.images.some(image => image.id === 900), false, 'old image retired after replacement');
  for (const size of ['c-4', 'c-8']) {
    await executor.validateSize(size);
    const lease = await drive(f, executor.acquire({ id: `restore-${size}`, size }, new Date(f.clock.now().getTime() + 60000).toISOString()));
    assert.equal(lease.snapshot?.image, prepared.snapshot.image);
    await drive(f, executor.release(lease));
  }
  assert.equal(f.api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets')?.body?.size, 'c-4');
  assert.equal((await drive(f, executor.prepare())).state, 'current');
});

test('copy timeout drains a byte-bounded stderr tail through native completion', async t => copyFixtureCase(t, async (root, _setup, step) => {
  const lease = { lease: 'fixture', address: '192.0.2.1' } as Parameters<Machine['put']>[0];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let kills = 0;
  let closed = false;
  let receipt: Promise<void> | undefined;
  const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: (signal: string) => { assert.equal(signal, 'SIGTERM'); kills++; return true; } });
  const finish = () => { if (!closed) { closed = true; child.emit('close', null, 'SIGTERM'); } };
  const patch = t.mock.method(cp, 'spawn', () => child);
  syncBuiltinESMExports();
  try {
    let settled = false;
    const copy = step(() => new Machine(root, { DIGITALOCEAN_TOKEN: 'secret-prefixcut-token-suffix' }).put(lease, 'input', 'output', { timeoutMs: 25 }));
    receipt = assert.rejects(copy, (error: unknown) => {
      assert.ok(error instanceof MachineRequestError);
      assert.equal(error.receipt?.timedOut, true);
      assert.ok(error.receipt?.stderr.endsWith('stderr received at close\n'));
      assert.ok(!error.receipt!.stderr.includes('cut-token-suffix'));
      assert.ok(error.message.includes('prefix line dropped'));
      assert.equal(error.receipt?.stderrBytes, 131085);
      assert.equal(error.receipt?.stderrDropped, 65566);
      return true;
    }).then(() => { settled = true; });
    t.mock.timers.tick(25);
    assert.equal(kills, 1);
    await Promise.resolve();
    assert.equal(settled, false, 'the timer signal alone is not native completion');
    child.stderr.emit('data', Buffer.from(`${'x'.repeat(65536)}secret-prefix`));
    child.stderr.emit('data', Buffer.from(`cut-token-suffix\n${'z'.repeat(65494)}stderr received at close\n`));
    finish();
    await receipt;
  } finally {
    finish(); await receipt?.catch(() => {});
    patch.mock.restore(); syncBuiltinESMExports(); t.mock.timers.reset();
  }
}));

async function fixture(t: TestContext, overrides: Record<string, string> = {}, adoptRoot?: (root: string) => void) {
  const root = await tempProject(t);
  adoptRoot?.(root);
  let closeResources = async () => {};
  beforeDirectories(t, () => closeResources());
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('cland-test-prepare-component', { machine: 'scripted', clock, testContext: t });
  closeResources = () => api.close();
  const key = { node: process.version, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };
  const machine = scriptedMachine(root, clock, key);
  const hubs: Awaited<ReturnType<typeof projectHub>>[] = [];
  closeResources = async () => {
    for (const served of hubs) await drive({ waits: machine.waits }, served.stop());
    await api.close();
  };
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nprepare = "npm ci"\n[verification.droplet]\nprepare_size = \"c-8\"\nregions=["lon1", "nyc1", "sfo2"]\n');
  api.sizes[0]!.regions.push('sfo2'); api.regions.push({ slug: 'sfo2', available: true, sizes: ['c-8'] });
  let failure = '';
  let keyInput: typeof import('../src/executor/droplet/prepare.ts').prepareKey = async () => structuredClone(key);
  const dependencies = { ...machine.dependencies, api: api.provider, prepareKey: async (...args: Parameters<typeof keyInput>) => keyInput(...args), prepareBase: async () => key.base,
    machine: { ...machine.dependencies.machine,
      exec: async (_lease: unknown, command: string) => {
        if (failure === 'ssh' || failure === 'unready' || failure === 'install' && command.includes('npm ci')) throw new Error('scripted machine failed');
        return JSON.stringify(failure === 'marker' ? { ...key, base: 'bad' } : key);
      },
      result: async (..._args: Parameters<Machine['result']>) => {
        if (failure === 'install') return { stdout: 'install-output', stderr: '', code: 8 };
        return { stdout: 'installed', stderr: '', code: 0 };
      },
      put: async () => {},
    },
  };
  const extras = { CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '200', CLAND_TEST_DROPLET_ACTION_MS: '2000', CLAND_TEST_DROPLET_RELEASE_MS: '100', CLAND_TEST_EXECUTOR_SWEEP_MS: '200', ...overrides };
  const syntheticProvider = { token: 'cland-test-prepare-component', api: api.provider } as const;
  const env = syntheticProviderEnvironment(await accountFixtureEnvironment(extras), syntheticProvider, api.provider) as Record<string, string>;
  const options = { clock, droplet: dependencies, syntheticProvider };
  await assert.rejects(() => stat(join(root, '.cland/run')), { code: 'ENOENT' });
  const hub = await projectHub(t, root, env, options);
  hubs.push(hub);
  return { root, api, env, clock, waits: machine.waits, dependencies, options, key,
    ui: await connectUi(t, hub.discovery), stop: () => drive({ waits: machine.waits }, hub.stop()),
    setKeyInput: (value: typeof keyInput) => { keyInput = value; },
    setFailure: (value: string) => { failure = value; },
    moveBase: () => { key.base = 'd'.repeat(40); },
    reopen: async () => { const served = await projectHub(t, root, env, options); hubs.push(served); return served; },
  };
}

test('boot readiness metadata survives acquisition cleanup rejection', async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const f = await step(() => scope.wait('readiness cleanup fixture', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    await step(() => f.stop());
    const snapshot: Snapshot = { image: 900, name: 'ready', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
    await step(() => mkdir(join(f.root, '.cland/run/executor'), { recursive: true }));
    await step(() => writeFile(snapshotPath(f.root), JSON.stringify(snapshot)));
    f.setFailure('unready');
    const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
    const cleanupError = new Error('scripted lease release rejected');
    let captured: DropletLease | undefined;
    const restore = scope.patch(executor, 'release', async (lease: DropletLease) => { captured = lease; throw cleanupError; });
    try {
      await step(() => assert.rejects(drive(f, executor.acquire({ id: 'readiness-cleanup' }, new Date(f.clock.now().getTime() + 60000).toISOString())), error => {
        assert.ok(error instanceof ReadinessDeadlineError);
        assert.equal(error.phase, 'boot-readiness');
        assert.equal(error.observedMs, error.deadlineMs);
        assert.deepEqual(error.cleanupFailures, [{ step: 'release', error: cleanupError }]);
        return true;
      }));
    } finally {
      restore();
      if (captured) await step(() => drive(f, executor.release(captured!)));
    }
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

for (const cleanupFailure of ['none', 'release', 'recovery-checkpoint', 'recovery'] as const) test(`snapshot preparation preserves boot readiness metadata (cleanup failure: ${cleanupFailure})`, async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const f = await step(() => scope.wait('builder readiness fixture', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    await step(() => f.stop());
    f.setFailure('unready');
    const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
    const cleanupError = new Error('scripted builder cleanup rejected');
    let captured: DropletLease | undefined;
    const release = executor.release;
    const rename = files.rename;
    const restore = scope.patch(executor, 'release', async (lease: DropletLease) => {
      captured = lease;
      if (cleanupFailure === 'release') throw cleanupError;
      const result = await release.call(executor, lease);
      if (cleanupFailure === 'recovery-checkpoint') scope.patch(files, 'rename', async (...args: Parameters<typeof rename>) => {
        if (String(args[1]).includes('/snapshot-recovery/')) throw cleanupError;
        return rename(...args);
      });
      if (cleanupFailure === 'recovery') scope.patch(f.dependencies.api, 'snapshots', async () => { throw cleanupError; });
      return result;
    });
    try {
      await step(() => assert.rejects(drive(f, executor.prepare()), error => {
        assert.ok(error instanceof Error);
        assert.ok(error.cause instanceof ReadinessDeadlineError);
        assert.equal(error.cause.phase, 'boot-readiness');
        assert.equal(error.cause.observedMs, error.cause.deadlineMs);
        assert.deepEqual(error.cause.cleanupFailures, cleanupFailure === 'none' ? [] : [{ step: cleanupFailure, error: cleanupError }]);
        assert.match(error.message, /builder: machine readiness deadline reached/);
        return true;
      }));
      const retained = await step(() => readRecoveries(f.root));
      assert.equal(retained.length, cleanupFailure === 'none' ? 0 : 1);
      if (cleanupFailure !== 'none') {
        assert.equal(retained[0]!.builder, captured!.resource);
        assert.equal(retained[0]!.phase, cleanupFailure === 'recovery' ? 'cleanup' : 'build');
      }
    } finally {
      restore();
      if (captured) await step(() => drive(f, executor.release(captured!)));
    }
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

for (const cleanupFailure of ['none', 'release', 'recovery-checkpoint', 'recovery'] as const) test(`snapshot preparation preserves non-readiness failure (cleanup failure: ${cleanupFailure})`, async t => {
  const scope = guardedLeaseCase(t, undefined, { timeoutMs: testDeadlineMs(5000) });
  return scope.run(async step => {
    const f = await step(() => scope.wait('builder readiness fixture', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    await step(() => scope.wait('fixture hub stop', () => f.stop()));
    f.setFailure('install');
    const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
    const cleanupError = new Error('scripted builder cleanup rejected');
    let captured: DropletLease | undefined;
    const release = executor.release;
    const rename = files.rename;
    const restore = scope.patch(executor, 'release', async (lease: DropletLease) => {
      captured = lease;
      if (cleanupFailure === 'release') throw cleanupError;
      const result = await release.call(executor, lease);
      if (cleanupFailure === 'recovery-checkpoint') scope.patch(files, 'rename', async (...args: Parameters<typeof rename>) => {
        if (String(args[1]).includes('/snapshot-recovery/')) throw cleanupError;
        return rename(...args);
      });
      if (cleanupFailure === 'recovery') scope.patch(f.dependencies.api, 'snapshots', async () => { throw cleanupError; });
      return result;
    });
    try {
      await step(() => scope.wait('preparation failure receipt', () => assert.rejects(drive(f, executor.prepare()), error => {
        assert.ok(error instanceof Error);
        assert.ok(error.cause instanceof Error);
        assert.match(error.cause.message, /prepare failed \(exit 8\)/);
        if (cleanupFailure !== 'none') {
          assert.ok(error.cause.cause instanceof AggregateError);
          assert.deepEqual(error.cause.cause.errors, [cleanupError]);
        }
        assert.match(error.message, /install: prepare failed/);
        return true;
      })));
      const retained = await step(() => readRecoveries(f.root));
      assert.equal(retained.length, cleanupFailure === 'none' ? 0 : 1);
      if (cleanupFailure !== 'none') {
        assert.equal(retained[0]!.builder, captured!.resource);
        assert.equal(retained[0]!.phase, cleanupFailure === 'recovery' ? 'cleanup' : 'build');
      }
      if (cleanupFailure === 'release') {
        const leases = await step(() => readLeases(f.root));
        assert.ok(leases.some(lease => lease.lease === captured!.lease && lease.resource === captured!.resource && lease.state !== 'released'));
        restore();
        const recovered = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
        await step(() => scope.wait('restart reconciliation receipt', () => drive(f, recovered.reconcile(true))));
        assert.deepEqual(f.api.droplets, []);
        assert.deepEqual(f.api.keys, []);
        assert.equal((await step(() => readRecoveries(f.root))).length, 0);
      }
    } finally {
      restore();
      if (captured) await step(() => scope.wait('builder release receipt', () => drive(f, executor.release(captured!))));
    }
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

for (const cleanupFailure of ['release', 'lease-checkpoint'] as const) test(`provider create failure survives acquisition ${cleanupFailure} rejection`, async t => {
  const scope = guardedLeaseCase(t, undefined, { timeoutMs: testDeadlineMs(5000) });
  return scope.run(async step => {
    const f = await step(() => scope.wait('provider failure fixture', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    await step(() => scope.wait('fixture hub stop', () => f.stop()));
    const snapshot: Snapshot = { image: 900, name: 'ready', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
    await step(() => mkdir(join(f.root, '.cland/run/executor'), { recursive: true }));
    await step(() => writeFile(snapshotPath(f.root), JSON.stringify(snapshot)));
    const previous = new Error('provider connection failed');
    const primary = new Error('provider create failed', { cause: previous });
    const cleanup = new Error('cleanup rejected');
    const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
    const rename = files.rename;
    let restoreCheckpoint = () => {};
    scope.patch(f.dependencies.api, 'create', async () => {
      if (cleanupFailure === 'lease-checkpoint') restoreCheckpoint = scope.patch(files, 'rename', async (...args: Parameters<typeof rename>) => {
        if (String(args[1]).endsWith('/lease.json')) throw cleanup;
        return rename(...args);
      });
      throw primary;
    });
    const restoreRelease = scope.patch(executor, 'release', async () => { throw cleanup; });
    try {
      await step(() => scope.wait('provider failure receipt', () => assert.rejects(drive(f, executor.acquire({ id: 'provider-cleanup' }, new Date(f.clock.now().getTime() + 60000).toISOString())), error => {
        assert.equal(error, primary);
        assert.ok(primary.cause instanceof AggregateError);
        assert.deepEqual(primary.cause.errors, [previous, cleanup]);
        return true;
      })));
      const retained = await step(() => readLeases(f.root));
      assert.equal(retained.length, 1);
      assert.equal(retained[0]!.run, 'provider-cleanup');
      assert.equal(retained[0]!.state, 'creating');
      assert.ok(retained[0]!.keyId);
      restoreCheckpoint(); restoreRelease();
      await step(() => scope.wait('provider recovery receipt', () => drive(f, executor.reconcile(true))));
      assert.deepEqual(f.api.droplets, []);
      assert.deepEqual(f.api.keys, []);
    } finally { restoreCheckpoint(); restoreRelease(); }
  });
});

test('fresh hub owns its run anchor before the first executor lease is written', async t => {
  const scope = guardedLeaseCase(t);
  return scope.run(async step => {
    const f = await step(() => scope.wait('fresh hub setup', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    assert.equal((await step(() => stat(join(f.root, '.cland/run')))).isDirectory(), true);
    assert.equal((await step(() => prepare(f.ui))).ok, true);
    await step(() => scope.wait('first prepared snapshot completion', () => drive(f, eventually('first prepared snapshot receipt', async () => {
      const status = (await f.ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
      return status.prepare?.state === 'done' ? true : undefined;
    }, 15000))));
    const leases = await step(() => readLeaseHistory(f.root));
    assert.equal(leases.length, 1);
    assert.equal(leases[0]!.state, 'released');
    assert.ok(leases[0]!.resource !== null, 'first builder acquired a provider identity and wrote its durable lease');
  });
});

for (const deleted of [false, true]) test(`hub stop joins held lease compaction and stops twice (project deleted: ${deleted})`, async t => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const scope = guardedLeaseCase(t, () => release.resolve());
  return scope.run(async step => {
    const owners = new Set<DropletExecutor>();
    const reconcile = DropletExecutor.prototype.reconcile;
    scope.patch(DropletExecutor.prototype, 'reconcile', function(this: DropletExecutor, restart?: boolean) {
      owners.add(this); return reconcile.call(this, restart);
    });
    const f = await step(() => scope.wait('held hub setup', () => fixture(scope.fixtures, {}, scope.adoptRoot)));
    const owner = [...owners].find(owner => owner.root === f.root);
    assert.ok(owner, 'startup admitted the hub-owned executor');
    await step(() => scope.wait('initial executor reconciliation', () => drive(f, owner.reconcile(false))));
    const mkdir = files.mkdir;
    const restoreHeld = scope.patch(files, 'mkdir', async (...args: Parameters<typeof files.mkdir>) => {
      if (String(args[0]) === join(owner.root, '.cland/run/executor/demo-leases')) { entered.resolve(); await release.promise; }
      return mkdir(...args);
    });
    syncBuiltinESMExports();
    const order: string[] = [];
    let work: Promise<void> | undefined, stopping: Promise<void> | undefined;
    try {
      work = owner.reconcile(false).then(() => { order.push('compacted'); });
      await step(() => scope.wait('held compaction directory receipt', () => Promise.race([entered.promise, work!.then(() => { throw new Error('compaction completed without held directory boundary'); })])));
      stopping = f.stop().then(() => { order.push('stopped'); });
      if (deleted) await step(() => files.rm(f.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 1 })); // Deliberate live-root deletion; bounded retries cover native removal contention.
      release.resolve();
      await step(() => scope.wait('compaction and hub-stop completion', () => Promise.all([work, stopping])));
      assert.deepEqual(order, ['compacted', 'stopped']);
      await step(() => f.stop());
      if (deleted) await assert.rejects(() => stat(f.root), { code: 'ENOENT' });
      else await assert.rejects(() => step(() => stat(join(f.root, '.cland/run/executor/lease-index.json'))), { code: 'ENOENT' });
    } finally {
      release.resolve(); await Promise.allSettled([work, stopping]);
      restoreHeld();
    }
  });
});

test('executor prepare defaults to Agents and honors an explicit report topic', async t => {
  const f = await fixture(t);
  for (const topic of ['agents', 'general']) {
    f.moveBase();
    const submitted = await f.ui.request({ type: 'executor.prepare', ...(topic === 'general' ? { report: topic } : {}) });
    assert.equal(submitted.ok, true, submitted.error);
    const messages = await sweep(f, 'prepare report published', async () => {
      const history = await f.ui.request({ type: 'topic.history', topic });
      const messages = (history.value as { messages: { text: string }[] }).messages;
      return messages.some(message => message.text.includes('snapshot')) ? messages : undefined;
    });
    assert.ok(messages.length);
    if (topic === 'agents') {
      const general = await f.ui.request({ type: 'topic.history', topic: 'general' });
      assert.deepEqual((general.value as { messages: unknown[] }).messages, []);
      const artifacts = await f.ui.request({ type: 'artifact.list', topic: 'general' });
      assert.deepEqual((artifacts.value as { artifacts: unknown[] }).artifacts, []);
    }
  }
});
async function sweep<T>(f: Awaited<ReturnType<typeof fixture>>, what: string, check: () => Promise<T | undefined> | T | undefined): Promise<T> {
  return eventually(what, async () => { await f.clock.advance(200); return drive(f, Promise.resolve().then(check)); });
}
const prepare = (ui: Awaited<ReturnType<typeof connectUi>>) => ui.request({ type: 'executor.prepare' });

/** Capture each synchronous acquisition before another operation can fail. */
function snapshotCase(t: TestContext) {
  type Owner = { backend?: DropletExecutor; store?: Store; database?: DatabaseSync; closed: boolean; closing?: Promise<void> };
  const owners: Owner[] = [];
  const released = () => owners.every(owner => owner.closed);
  const scope = guardedLeaseCase(t, undefined, { canRestore: released });
  const assertReleased = () => { if (!released()) throw new Error('snapshot owner closure unconfirmed; root retained'); };
  const close = (owner: Owner): Promise<void> => {
    if (owner.closed) return Promise.resolve();
    return scope.wait('snapshot owner closure', () => owner.closing ??= (async () => {
      await owner.backend?.close();
      if (owner.store) owner.store.close();
      else if (owner.database?.isOpen) owner.database.close();
      if (owner.database?.isOpen) throw new Error('snapshot database closure unconfirmed');
      owner.closed = true;
    })().finally(() => { delete owner.closing; }));
  };
  const dispose = async () => {
    const results = await Promise.allSettled(owners.map(close));
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
    if (errors.length) throw new AggregateError(errors, 'snapshot owners did not close');
    assertReleased();
  };
  beforeDirectories(t, dispose);
  const guardRoot = (root: string) => guardDirectoryRemoval(root, assertReleased);
  return { scope: { ...scope, adoptRoot(root: string) { scope.adoptRoot(root); guardRoot(root); } }, close, dispose, released, guardRoot,
    open(f: Pick<Awaited<ReturnType<typeof fixture>>, 'root' | 'env'>, dependencies: DropletDependencies, storage = false, configureDatabase?: (database: DatabaseSync) => void) {
      guardDirectoryRemoval(f.root, assertReleased);
      const owner: Owner = { closed: false };
      owners.push(owner);
      if (storage) owner.store = new Store(join(f.root, 'notice.db'), path => {
        const database = new DatabaseSync(path);
        owner.database = database;
        configureDatabase?.(database);
        return database;
      });
      owner.backend = new DropletExecutor(f.root, owner.store, undefined, f.env, undefined, dependencies);
      return owner as Owner & { backend: DropletExecutor };
    },
  };
}

test('snapshot status names recipe and hook drift after a slow local inspection', async t => {
  const ownership = snapshotCase(t);
  const { scope } = ownership;
  return scope.run(async step => {
    const f = await step(() => fixture(scope.fixtures, {}, scope.adoptRoot));
    await step(() => f.stop());
    await step(() => mkdir(join(f.root, '.cland/run/executor'), { recursive: true }));
    await step(() => writeFile(snapshotPath(f.root), JSON.stringify({ image: 123, name: 'legacy', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'] })));
    const owner = ownership.open(f, {
      ...f.dependencies, prepareBase: async () => f.key.base,
      prepareKey: async (_root, _env, _hook, refresh) => {
        assert.equal(refresh, false);
        await f.dependencies.wait!(300);
        return { ...f.key, recipe: 'new-recipe', provisionPath: 'system.sh', provision: 'new-hook' };
      },
    });
    const backend = owner.backend;
    try {
      const status = await step(() => drive(f, backend.inspect()));
      assert.equal(status.snapshot?.freshness, 'stale: recipe|provision');
      assert.deepEqual(f.api.droplets, []);
      assert.deepEqual(f.api.keys, []);
    } finally { await step(() => ownership.close(owner)); }
  });
});

test('stale snapshot acquisition reports each changed key once and keeps preparation explicit', async t => {
  const ownership = snapshotCase(t);
  const { scope } = ownership;
  return scope.run(async step => {
    const f = await step(() => fixture(scope.fixtures, {}, scope.adoptRoot));
    await step(() => f.stop());
    const notices: string[] = [];
    const oldKey = { ...f.key, recipe: 'old' };
    const dependencies = {
      ...f.dependencies, snapshotNotice: (id: string, text: string) => { notices.push(text); return notices.length === 1 ? null : id; },
      machine: { ...f.dependencies.machine, exec: async () => JSON.stringify(oldKey) },
    };
    let owner = ownership.open(f, dependencies, true);
    await step(() => mkdir(join(f.root, '.cland/run/executor'), { recursive: true }));
    await step(() => writeFile(snapshotPath(f.root), JSON.stringify({ image: 123, name: 'prepared', key: { ...f.key, recipe: 'old' }, keyHash: keyHash({ ...f.key, recipe: 'old' }), regions: ['lon1'] })));
    try {
      for (let i = 0; i < 3; i++) {
        if (i === 1) { await step(() => ownership.close(owner)); owner = ownership.open(f, dependencies, true); }
        if (i === 2) Object.assign(f.key, { provision: 'changed', provisionPath: 'hook.sh' });
        const lease = await step(() => drive(f, owner.backend.acquire({ id: `stale-${i}` }, new Date(f.clock.now().getTime() + 60000).toISOString())));
        assert.equal(lease.state, 'active');
        await step(() => drive(f, owner.backend.release(lease)));
      }
      assert.equal(notices.length, 3, 'a null publication receipt must be retried');
      assert.match(notices[0]!, /stale: recipe.*cland executor prepare/);
      assert.match(notices[2]!, /stale: recipe\|provision/);
      assert.equal(f.api.images.length, 0, 'no implicit builder or snapshot');
      assert.deepEqual(f.api.droplets, []);
      assert.deepEqual(f.api.keys, []);
    } finally { await step(() => ownership.dispose()); }
  });
});

for (const boundary of ['read', 'write', 'clear'] as const) test(`snapshot advisory metadata ${boundary} failure never gates acquisition`, async t => {
  const ownership = snapshotCase(t);
  const { scope } = ownership;
  return scope.run(async step => {
    const f = await step(() => fixture(scope.fixtures, {}, scope.adoptRoot));
    await step(() => f.stop());
    const oldKey = boundary === 'clear' ? f.key : { ...f.key, recipe: 'old' };
    const owner = ownership.open(f, { ...f.dependencies, snapshotNotice: id => id,
      machine: { ...f.dependencies.machine, exec: async () => JSON.stringify(oldKey) } }, true);
    const diagnostics: Parameters<DropletExecutor['logger']>[0][] = [];
    scope.patch(owner.backend, 'logger', (record: Parameters<DropletExecutor['logger']>[0]) => {
      if (record.event === 'executor-snapshot-advisory-deferred') {
        diagnostics.push(record);
        throw new Error('scripted diagnostic sink rejected');
      }
    });
    await step(() => mkdir(join(f.root, '.cland/run/executor'), { recursive: true }));
    await step(() => writeFile(snapshotPath(f.root), JSON.stringify({ image: 123, name: 'prepared', key: oldKey, keyHash: keyHash(oldKey), regions: ['lon1'] })));
    const store = owner.store!;
    const meta = store.meta, setMeta = store.setMeta;
    if (boundary === 'read') scope.patch(store, 'meta', function(key: string) {
      if (key === 'executor-stale-notice') throw new Error(`scripted advisory metadata read failed; Bearer synthetic-diagnostic-value ${'x'.repeat(800)}`);
      return meta.call(store, key);
    });
    else scope.patch(store, 'setMeta', function(key: string, value: string) {
      if (key === 'executor-stale-notice') throw new Error(`scripted advisory metadata write failed; Bearer synthetic-diagnostic-value ${'x'.repeat(800)}`);
      return setMeta.call(store, key, value);
    });
    const lease = await step(() => drive(f, owner.backend.acquire({ id: `metadata-${boundary}` }, new Date(f.clock.now().getTime() + 60000).toISOString())));
    assert.equal(lease.state, 'active');
    assert.equal(diagnostics.length, 1);
    const reason = String(diagnostics[0]!.reason);
    assert.match(reason, /scripted advisory metadata/);
    assert.ok(reason.length <= 500);
    assert.ok(!reason.includes('synthetic-diagnostic-value'));
    await step(() => drive(f, owner.backend.release(lease)));
    await step(() => ownership.dispose());
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

test('Agents publication retries a null core receipt before suppressing a stale snapshot notice', async t => {
  const ownership = snapshotCase(t);
  const { scope } = ownership;
  return scope.run(async step => {
    let core: Dispatcher['core'] | undefined;
    const open = Dispatcher.prototype.open;
    scope.patch(Dispatcher.prototype, 'open', function(this: Dispatcher, ...args: Parameters<typeof open>) { core = this.core; return open.apply(this, args); });
    const f = await step(() => fixture(scope.fixtures, {}, scope.adoptRoot));
    assert.ok(core, 'real dispatcher connection captured its producing core');
    const oldKey = { ...f.key, recipe: 'old' };
    const noticeTo = core.noticeTo.bind(core);
    let admitted = false;
    scope.patch(core, 'noticeTo', (...args: Parameters<typeof noticeTo>) => admitted ? noticeTo(...args) : null);
    const owner = ownership.open(f, { ...f.dependencies,
      snapshotNotice: executorSnapshotNotice(core),
      machine: { ...f.dependencies.machine, exec: async () => JSON.stringify(oldKey) },
    }, true);
    await step(() => mkdir(join(f.root, '.cland/run/executor'), { recursive: true }));
    await step(() => writeFile(snapshotPath(f.root), JSON.stringify({ image: 123, name: 'prepared', key: oldKey, keyHash: keyHash(oldKey), regions: ['lon1'] })));
    for (let index = 0; index < 3; index++) {
      admitted = index > 0;
      const lease = await step(() => drive(f, owner.backend.acquire({ id: `publication-${index}` }, new Date(f.clock.now().getTime() + 60000).toISOString())));
      assert.equal(lease.state, 'active');
      await step(() => drive(f, owner.backend.release(lease)));
      const history = await step(() => f.ui.request({ type: 'topic.history', topic: 'agents' }));
      const notices = (history.value as { messages: { id: string; text: string }[] }).messages.filter(row => row.id.startsWith('executor-stale:'));
      assert.equal(notices.length, admitted ? 1 : 0);
      assert.equal(Boolean(owner.store!.meta('executor-stale-notice')), admitted);
      if (admitted) assert.match(notices[0]!.text, /stale: recipe.*cland executor prepare/);
    }
    await step(() => ownership.dispose());
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

test('snapshot owner cleanup fences root, database and controls until rejected closure is confirmed', async t => {
  const ownership = snapshotCase(t);
  const { scope } = ownership;
  return scope.run(async step => {
    const f = await step(() => fixture(scope.fixtures, {}, scope.adoptRoot));
    await step(() => f.stop());
    const parent = join(f.root, 'snapshot-parent');
    const root = join(parent, 'snapshot-owner');
    await step(() => mkdir(root, { recursive: true }));
    ownership.guardRoot(parent);
    const hooks: Array<() => unknown> = [];
    const cleanupContext = { after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    beforeDirectories(cleanupContext, ownership.dispose);
    let removalAllowed = false, removalAttempts = 0;
    const removeParent = ownDirectory(cleanupContext, parent, { beforeRemove: () => {
      removalAttempts++;
      if (!removalAllowed) throw new Error('positive control: recursive removal reached before closure');
    } });
    const remove = ownDirectory(undefined, root);
    const owner = ownership.open({ ...f, root }, f.dependencies, true);
    const restore = scope.patch(owner.backend, 'close', async () => { throw new Error('scripted close rejected'); });
    try {
    // A setup write fails after resources were enrolled, with no body-finally.
    await assert.rejects(() => writeFile(join(root, 'missing', 'snapshot.json'), '{}'), { code: 'ENOENT' });
    await assert.rejects(async () => { for (const hook of hooks) await hook(); }, /fixture cleanup failed/);
    assert.equal(removalAttempts, 0, 'registered parent cleanup must stop at its resource fence');
    assert.equal((await step(() => stat(parent))).isDirectory(), true);
    await assert.rejects(remove, /closure unconfirmed/);
    assert.equal((await step(() => stat(root))).isDirectory(), true);
    owner.store!.setMeta('handle-receipt', 'open');
    assert.equal(owner.store!.meta('handle-receipt'), 'open');
    assert.throws(scope.releaseSeams, /native guard retained/);
    restore();
    await step(() => ownership.dispose());
    assert.equal(ownership.released(), true);
    assert.throws(() => owner.store!.meta('handle-receipt'), /closed|not open/i);
    removalAllowed = true;
    await step(removeParent);
    await assert.rejects(() => stat(parent), { code: 'ENOENT' });
    await assert.rejects(() => stat(root), { code: 'ENOENT' });
    } finally { restore(); await ownership.dispose(); }
  });
});

test('failed Store construction retains its native handle and containing parent until registered cleanup closes it', async t => {
  const ownership = snapshotCase(t);
  const { scope } = ownership;
  return scope.run(async step => {
    const f = await step(() => fixture(scope.fixtures, {}, scope.adoptRoot));
    await step(() => f.stop());
    const parent = join(f.root, 'constructor-parent'), root = join(parent, 'snapshot-owner');
    await step(() => mkdir(root, { recursive: true }));
    ownership.guardRoot(parent);
    const hooks: Array<() => unknown> = [];
    const cleanupContext = { after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    beforeDirectories(cleanupContext, ownership.dispose);
    let allowRemoval = false, removalAttempts = 0;
    const remove = ownDirectory(cleanupContext, parent, { beforeRemove: () => {
      removalAttempts++;
      if (!allowRemoval) throw new Error('positive control: recursive removal reached before native close');
    } });
    let database: DatabaseSync | undefined;
    let restoreClose = () => {};
    try {
      assert.throws(() => ownership.open({ ...f, root }, f.dependencies, true, native => {
        database = native;
        const exec = native.exec.bind(native);
        scope.patch(native, 'exec', (sql: string) => {
          if (sql === 'pragma busy_timeout = 5000;') return exec(sql);
          throw new Error('scripted Store schema construction rejected');
        });
        restoreClose = scope.patch(native, 'close', () => { throw new Error('scripted native close rejected'); });
      }), /schema construction rejected/);
      assert.ok(database);
      await assert.rejects(async () => { for (const hook of hooks) await hook(); }, /fixture cleanup failed/);
      assert.equal(removalAttempts, 0);
      assert.equal((await step(() => stat(parent))).isDirectory(), true);
      assert.equal((await step(() => stat(root))).isDirectory(), true);
      assert.equal(database.isOpen, true);
      assert.equal(database.prepare('select 1 as receipt').get()!.receipt, 1);
      assert.equal(ownership.released(), false);
      assert.throws(scope.releaseSeams, /native guard retained/);
      restoreClose();
      await step(() => ownership.dispose());
      assert.equal(database.isOpen, false);
      assert.equal(ownership.released(), true);
      allowRemoval = true;
      await step(remove);
      await assert.rejects(() => stat(parent), { code: 'ENOENT' });
      await assert.rejects(() => stat(root), { code: 'ENOENT' });
    } finally { restoreClose(); await ownership.dispose(); }
  });
});

for (const movedBeforeConsumption of [false, true]) {
test(`snapshot inspection consumes a completed deferred key with base moved before consumption=${movedBeforeConsumption}`, async t => {
  const f = await fixture(t);
  await f.stop();
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  await writeFile(snapshotPath(f.root), JSON.stringify({ image: 123, name: 'prepared', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'] }));
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  let first = true;
  const backend = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, {
    ...f.dependencies,
    prepareBase: async () => f.key.base,
    prepareKey: async () => {
      if (first) { first = false; entered.resolve(); await release.promise; completed.resolve(); }
      else await f.dependencies.wait!(300);
      return structuredClone(f.key);
    },
  });
  const observation = async (work: ReturnType<DropletExecutor['inspect']>) => {
    let value: Awaited<typeof work> | undefined;
    void work.then(result => { value = result; });
    return eventually('inspection result published', async () => {
      await f.clock.advance(5000);
      return value;
    });
  };
  try {
    const inspecting = backend.inspect();
    await eventually('inspection entered held key computation', () => entered.promise.then(() => true));
    await f.clock.advance(5000);
    const timedOut = await inspecting;
    assert.equal(timedOut.snapshot?.freshness, 'unknown (inspection deferred)');
    assert.equal(timedOut.snapshot?.inspectionReason, 'local inspection exceeded 5s');
    assert.match(timedOut.summary, /reason=local inspection exceeded 5s/);
    release.resolve();
    await completed.promise;
    if (movedBeforeConsumption) f.moveBase();
    // A new computation is deliberately also slower than the exact status budget.
    // The completed observation must be consumed, rather than discarded/restarted.
    const next = backend.inspect();
    const current = await observation(next);
    if (movedBeforeConsumption) {
      assert.notEqual(current.snapshot?.freshness, 'current', 'an old deferred key cannot claim current after the base moves');
      return;
    }
    assert.equal(current.snapshot?.freshness, 'current');
    assert.ok(current.summary.includes(`local=origin/dev@${f.key.base.slice(0, 12)}`));
    f.moveBase();
    const changed = backend.inspect();
    await observation(changed);
    // If the changed read was deferred, its next observation must still be stale.
    const stale = backend.inspect();
    const value = await observation(stale);
    assert.equal(value.snapshot?.freshness, 'stale: base');
  } finally { release.resolve(); await backend.close(); }
});
}

test('snapshot inspection validates the base after a pending key becomes consumable', async t => {
  const f = await fixture(t);
  await f.stop();
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  await writeFile(snapshotPath(f.root), JSON.stringify({ image: 123, name: 'prepared', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'] }));
  const keyEntered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const inspectionEntered = Promise.withResolvers<void>();
  let observing = false;
  const backend = new DropletExecutor(f.root, undefined, () => {}, f.env, () => {
    if (observing) inspectionEntered.resolve();
    return defaultConfig('inspection');
  }, {
    ...f.dependencies,
    prepareKey: async () => { const captured = structuredClone(f.key); keyEntered.resolve(); await release.promise; return captured; },
    prepareBase: async () => f.key.base,
  });
  try {
    const deferred = backend.inspect();
    await eventually('held key computation entered', () => keyEntered.promise.then(() => true));
    await f.clock.advance(5000);
    assert.equal((await deferred).snapshot?.freshness, 'unknown (inspection deferred)');
    observing = true;
    const inspecting = backend.inspect();
    await eventually('second inspection captured applied configuration', () => inspectionEntered.promise.then(() => true));
    // Drain ready continuations without advancing the budget: the old parallel
    // validation can capture A here while the admitted key is still held.
    await f.clock.advance(0);
    f.moveBase();
    release.resolve();
    const status = await inspecting;
    assert.equal(status.snapshot?.freshness, 'unknown (inspection deferred)');
    assert.ok(status.summary.includes(`local=origin/dev@${f.key.base.slice(0, 12)}`));
  } finally { release.resolve(); await backend.close(); }
});

test('prepare is a hub-owned control reserved for the human and Coordinator', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, { DIGITALOCEAN_TOKEN: '' });
  const ui = await connectUi(t, discovery);
  for (const role of ['implementer', 'reviewer', 'qa'] as const) {
    const name = `prepare-${role}`;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await inProcessSpoke(t, { discover: true, assignRole: false, cwd: root, name, role, sessionId: name });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
    if (role === 'implementer') {
      const result = await clandWithEnv(root, { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: name }, 'executor', 'prepare', '--json');
      assert.equal(result.code, 1);
      assert.match(result.stderr, /forbidden.*executor\.prepare/);
    } else {
      const result = await ui.request({ type: 'executor.prepare', as: { name, sessionId: name, shell: true } });
      assert.equal(result.ok, false);
      assert.match(result.error!, /forbidden.*executor\.prepare/);
    }
  }
});

test('prepare keeps its snapshot when builder deletion is unconfirmed, then the hub confirms release and cost', async t => {
  const f = await fixture(t);
  const { root, api, ui, env, stop } = f;
  api.faults.deleteError = 422;
  assert.equal((await prepare(ui)).ok, true);
  const result = await drive(f, eventually('prepare finishes despite pending builder deletion', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string; result?: { lifetimeMs: number | null; costUsd: number | null } }; snapshot?: { image: number }; leases: { state: string }[] };
    return value.prepare && value.prepare.state !== 'running' ? value : undefined;
  }, 15000));
  assert.equal(result.prepare!.state, 'done', result.prepare!.error);
  assert.equal(result.snapshot!.image, api.images[0]!.id);
  assert.equal(result.prepare!.result!.lifetimeMs, null);
  assert.equal(result.prepare!.result!.costUsd, null);
  assert.equal(result.leases[0]!.state, 'releasing');
  const history = (await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: { text: string }[] };
  assert.match(history.messages.find(message => message.text.startsWith('snapshot prepared:'))!.text, /builder lifetime unconfirmedms; cost \$unconfirmed/);
  // The final bounded attempt can hit its deadline (status 0) after a 422.
  // Wait for this builder's provider rejection and unconfirmed release separately.
  const { records, retry } = await drive(f, eventually('builder delete retry and unconfirmed release are journalled', async () => {
    await flushProjectLogs(t, root);
    const records = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const unconfirmed = records.find(record => record.event === 'executor-release-unconfirmed' && record.id === api.droplets[0]!.id);
    if (!unconfirmed) return undefined;
    const retry = records.find(record => record.event === 'executor-release-retry' && record.lease === unconfirmed.lease && record.cause?.status === 422);
    return retry && api.requests.filter(request => request.method === 'DELETE' && /^\/v2\/droplets\/\d+$/.test(request.path)).length >= 2 ? { records, retry } : undefined;
  }));
  assert.equal(retry.cause.status, 422);
  assert.equal(retry.cause.id, 'delete_failed');
  assert.match(retry.cause.message, /try later/);
  assert.ok(!records.some(record => record.event === 'executor-prepare-failed'));
  assert.ok(api.requests.filter(request => request.method === 'DELETE' && /^\/v2\/droplets\/\d+$/.test(request.path)).length >= 2);
  await stop();
  const restarted = await f.reopen();
  const next = await connectUi(t, restarted.discovery);
  const pending = (await drive(f, next.request({ type: 'executor.status' }))).value as { snapshot: { image: number }; leases: { state: string }[] };
  assert.equal(pending.snapshot.image, result.snapshot!.image);
  assert.equal(pending.leases[0]!.state, 'releasing');
  api.faults.deleteError = 0;
  await sweep(f, 'hub retries releasing builder', async () => {
    const value = (await next.request({ type: 'executor.status' })).value as { leases: unknown[]; spend: { reserved: number; spent: number }; snapshot?: { image: number } };
    return value.leases.length === 0 && value.spend.reserved === 0 ? value : undefined;
  });
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  assert.equal(api.images.length, 1);
  // Zero leases can be observed before the release record is published.
  const released = await drive(f, eventually('builder release and cost are journalled', async () => {
    await flushProjectLogs(t, root);
    return (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)).find(record => record.event === 'executor-lease-released');
  }));
  assert.ok(released.lifetimeMs >= 0); assert.ok(released.costUsd > 0);
});

test('failed replacement releases its builder, deletes a partial image and keeps the previous snapshot', async t => {
  const f = await fixture(t);
  const { root, api, ui } = f;
  assert.equal((await prepare(ui)).ok, true);
  const first = await drive(f, eventually('initial snapshot ready', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000));
  f.moveBase();
  const stale = (await ui.request({ type: 'executor.status' })).value as { snapshot: { freshness: string } };
  assert.equal(stale.snapshot.freshness, 'stale: base');
  for (const failure of ['snapshot', 'ssh', 'install', 'retire'] as const) {
    api.faults.failAction = failure === 'snapshot' ? 'snapshot' : '';
    api.faults.deleteSnapshot = failure === 'retire' ? first.image : 0;
    f.setFailure(failure);
    const submission = await prepare(ui);
    assert.equal(submission.ok, true, submission.error);
    const failed = await drive(f, eventually(`${failure} reports failure`, async () => {
      const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string; error: string } };
      return value.prepare?.state === 'failed' ? value : undefined;
    }, 15000));
    assert.equal(failed.snapshot!.image, first.image);
    assert.equal(api.images.length, 1, `${failure}: ${failed.prepare!.error}`); assert.equal(api.images[0]!.id, first.image);
    assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
    assert.match(failed.prepare!.error, /failed|deadline|time bound/);
    if (failure === 'install') assert.match(failed.prepare!.error, /install: prepare failed \(exit 8\)\ninstall-output/);
    for (const lease of await readLeaseHistory(root)) {
      assert.equal(await f.dependencies.host.watchdogAlive(lease), false, `${failure}: released builder watchdog has exited`);
    }
  }
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.equal(journal.split('\n').filter(line => line.includes('"event":"executor-prepare-failed"')).length, 4);
});

test('prepare refuses an oversized builder before create and reports one job while a CLI has exited', async t => {
  const f = await fixture(t);
  const { root, api, ui } = f;
  api.sizes.push({ slug: 'big', available: true, price_hourly: 0.5, disk: 100, regions: ['lon1'] });
  const config = join(root, '.cland/config.toml');
  await writeFile(config, (await readFile(config, 'utf8')).replace('prepare_size = "c-8"', 'prepare_size = "big"'));
  assert.equal((await ui.request({ type: 'hub.reload' })).ok, true);
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await drive(f, eventually('oversized disk refuses', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error: string } };
    return value.prepare?.state === 'failed' && /disk exceeds/.test(value.prepare.error) ? true : undefined;
  }));
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  await writeFile(config, (await readFile(config, 'utf8')).replace('prepare_size = "big"', 'prepare_size = "c-8"'));
  assert.equal((await ui.request({ type: 'hub.reload' })).ok, true);
  let resume!: () => void;
  const blocked = new Promise<void>(resolve => { resume = resolve; }); onCleanup(t, () => resume());
  api.beforeCreate(() => blocked);
  const submission = await clandWithEnv(root, {}, 'executor', 'prepare', '--json');
  assert.equal(submission.code, 0, submission.stderr);
  const status = (await ui.request({ type: 'executor.status' })).value as { prepare: { state: string; step: string; elapsedMs: number } };
  assert.equal(status.prepare.state, 'running'); assert.ok(status.prepare.elapsedMs >= 0);
  const second = await clandWithEnv(root, {}, 'executor', 'prepare', '--json');
  assert.equal(second.code, 1); assert.match(second.stderr, /already running/);
  resume();
  await drive(f, eventually('submitted job completes after CLI exit', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
    return value.prepare?.state === 'done' ? true : undefined;
  }, 15000));
});

test('acquire needs a prepared image, uses its regions without user data and refuses unready or mismatched machines', async t => {
  const f = await fixture(t);
  const { root, api, env, ui, stop } = f;
  const executor = new DropletExecutor(root, undefined, undefined, env, undefined, f.dependencies);
  const deadline = () => new Date(f.clock.now().getTime() + 60000).toISOString();
  await assert.rejects(executor.acquire({ id: 'unprepared' }, deadline()), /no prepared snapshot; run cland executor prepare/);
  assert.equal((await prepare(ui)).ok, true);
  const snapshot = await drive(f, eventually('prepared snapshot available', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000));
  // The rest exercises the executor directly; the hub's periodic sweep has its own tests.
  await stop();
  // A region preferred by current config but absent from the image cannot be used.
  await writeFile(join(root, '.cland/config.toml'), '[verification.droplet]\nregions = ["fra1", "nyc1"]\n');
  api.sizes[0]!.regions.push('fra1'); api.regions.push({ slug: 'fra1', available: true, sizes: ['c-8'] });
  const lease = await drive(f, executor.acquire({ id: 'snapshot-run' }, deadline()));
  assert.equal(lease.region, 'nyc1');
  const create = api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').at(-1)!.body!;
  assert.equal(create.image, snapshot.image); assert.ok(!('user_data' in create));
  // The native SSH user/command contract remains beside image/key-byte proofs in executor-prepare.
  assert.ok(await f.dependencies.host.watchdogAlive(lease));
  await drive(f, executor.release(lease));
  f.setFailure('marker');
  await assert.rejects(drive(f, executor.acquire({ id: 'bad-marker' }, deadline())), /image marker mismatch/);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  f.setFailure('unready');
  const bootStarted = f.clock.now().getTime();
  await assert.rejects(drive(f, executor.acquire({ id: 'timeout' }, deadline())), error => {
    assert.ok(error instanceof ReadinessDeadlineError);
    assert.equal(error.phase, 'boot-readiness');
    assert.ok(error.deadlineMs >= bootStarted + 200, 'readiness starts after acquisition');
    assert.equal(error.observedMs, error.deadlineMs);
    assert.equal(error.observedMs, f.clock.now().getTime());
    assert.match(error.message, /machine readiness deadline reached/);
    return true;
  });
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
});

// T2: bundle bytes are injected; the real acquire/deliver policy sees a snapshot
// switch at the provider create boundary, without Git, SSH or a worker process.
test('delivery survives a snapshot replacement during machine creation', async t => {
  let backend: DropletExecutor | undefined, lease: DropletLease | undefined;
  let fixtureOwner: Awaited<ReturnType<typeof fixture>> | undefined;
  let closed = true;
  const scope = guardedLeaseCase(t, undefined, { canRestore: () => closed });
  scope.fixtures.after(async () => {
    if (!closed && !backend) throw new Error('delivery constructor closure unconfirmed; fixture retained');
    if (lease) { await scope.wait('delivery lease cleanup', () => drive(fixtureOwner!, backend!.release(lease!))); lease = undefined; }
    await backend?.close(); closed = true;
  });
  return scope.run(async step => {
    const fixtureValue = await step(() => scope.wait('delivery fixture setup', () => fixture(scope.fixtures, {}, root => {
      scope.adoptRoot(root);
      guardDirectoryRemoval(root, () => { if (!closed) throw new Error('delivery resources not closed; root retained'); });
    })));
    const f = fixtureOwner = fixtureValue;
    await step(() => scope.wait('delivery fixture stop', () => f.stop()));
    const old: Snapshot = { image: 900, name: 'old', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
    const nextKey = { ...f.key, base: 'd'.repeat(40) };
    const next: Snapshot = { ...old, image: 901, name: 'next', key: nextKey, keyHash: keyHash(nextKey) };
    await step(() => scope.wait('delivery snapshot directory', () => mkdir(join(f.root, '.cland/run/executor'), { recursive: true })));
    await step(() => scope.wait('delivery snapshot persistence', () => writeFile(snapshotPath(f.root), JSON.stringify(old))));
    f.api.beforeCreate(async () => { await writeFile(snapshotPath(f.root), JSON.stringify(next)); });
    const bundles: Array<string | undefined> = [];
    const uploads: Array<string | undefined> = [];
    const telemetryUploads = new Map<string, string>();
    let attempts = 0;
    let failure: 'race' | 'fetch' | 'persistent' | 'prepare' | 'none' = 'race';
    const commands: string[] = [];
    const { run: _scriptedRun, ...dependencies } = f.dependencies;
    closed = false;
    const executor = backend = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, {
      ...dependencies,
      runBundle: async (_run, path, base) => { bundles.push(base); await writeFile(path, JSON.stringify({ base })); },
      machine: { ...f.dependencies.machine,
        put: async (_lease, path, remote) => {
          if (remote.endsWith('/tree.bundle')) uploads.push(JSON.parse(await readFile(path, 'utf8')).base);
          if (/\/(run\.sh|health\.ts|metrics\.ts)$/.test(remote)) telemetryUploads.set(remote.split('/').at(-1)!, await readFile(path, 'utf8'));
        },
        result: async (_lease, command) => {
          attempts++; commands.push(command);
          if (failure === 'fetch') return { code: 7, stdout: '', stderr: 'fetch refused' };
          const fetching = command.includes('git fetch');
          if ((failure === 'prepare' && !fetching) || failure === 'persistent') return { code: 1, stdout: '', stderr: 'Repository lacks these prerequisite commits' };
          // The machine booted the old image. Only its old base is present locally.
          const missing = failure === 'race' && uploads.at(-1) && uploads.at(-1) !== old.key.base;
          return missing ? { code: 1, stdout: '', stderr: `error: Repository lacks these prerequisite commits:\nerror: ${nextKey.base}\n` } : { code: 0, stdout: 'delivered\n', stderr: '' };
        },
      },
    });
    const acquired = await step(() => scope.wait('delivery lease acquisition', async () => {
      lease = await drive(f!, executor.acquire({ id: 'snapshot-race' }, new Date(f!.clock.now().getTime() + 600000).toISOString()));
      return lease;
    }));
    await step(() => scope.wait('delivery scenarios', async () => {
      const lease = acquired;
      const create = f.api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets')!.body!;
      assert.equal(create.image, old.image);
      const dir = join(f.root, '.cland/run/snapshot-race');
      await mkdir(dir, { recursive: true });
      const run = { id: lease.run, cwd: f.root, head: 'e'.repeat(40), mode: 'auto', log: join(dir, 'log'), result: join(dir, 'result'), gate: join(dir, 'gate'), commands: { check: '', prepare: 'prepare-fixture', test: '' } };
      await executor.deliver(lease, run);
      assert.equal(lease.execution?.delivered, true);
      assert.ok(telemetryUploads.has('metrics.ts'), 'pure sampler is delivered beside its native entry point');
      assert.match(telemetryUploads.get('health.ts')!, /withMachineMetrics/);
      const runner = telemetryUploads.get('run.sh')!;
      assert.ok(runner.includes('timeout --kill-after=10s "$(( ${seconds%.*} + 6 ))s" node "$run/health.ts" supervise "$run" "$seconds"'));
      assert.ok(!runner.includes('metrics_pid'), 'there is no independently stopped sampler child');
      const ordered = (script: string) => {
        const append = script.indexOf('node "$run/health.ts" append "$run"');
        const done = script.indexOf('>"$run/done.tmp"');
        return append >= 0 && done >= 0 && append < done;
      };
      assert.equal(ordered(runner), true, 'framed append is present before terminal publication');
      assert.equal(ordered(runner.replace('node "$run/health.ts" append "$run"', 'removed')), false, 'missing append positively fails the ordering check');
      assert.match(runner, /timeout --kill-after=1s 3s node "\$run\/health.ts" append/);
      const pending = runner.indexOf(': >"$run/package-pending"');
      assert.ok(pending >= 0 && pending < runner.indexOf('node "$run/health.ts" supervise "$run" "$seconds"'), 'closure fence precedes package launch');
      const fence = runner.slice(runner.indexOf('if test -f "$run/package-pending"'), runner.indexOf('# The foreground timeout'));
      assert.match(fence, /package-incomplete/);
      assert.match(fence, /return\s+fi/);
      assert.doesNotMatch(fence, /done\.tmp/);
      const healthSource = telemetryUploads.get('health.ts')!;
      const observe = healthSource.indexOf("process.on('SIGTERM'");
      assert.ok(observe >= 0 && observe < healthSource.indexOf("spawn('bash'"), 'native signal observation is armed before launch');
      assert.deepEqual(bundles, [old.key.base]);
      assert.deepEqual(uploads, bundles);
      assert.equal(attempts, 2); // fetch, then checkout/prepare, using the acquired image
      assert.ok(commands[1]!.includes(JSON.stringify(old.key)));
      assert.ok(!commands[1]!.includes(JSON.stringify(next.key)));
      // A lease persisted by an older hub may lack the pinned snapshot. Its
      // mismatched incremental bundle still receives the bounded full fallback.
      delete lease.snapshot;
      attempts = 0; bundles.length = 0; uploads.length = 0; commands.length = 0;
      await executor.deliver(lease, run);
      assert.deepEqual(bundles, [nextKey.base, undefined]);
      assert.deepEqual(uploads, bundles);
      assert.equal(attempts, 3); // failed fetch, full fetch, then checkout/prepare
      assert.ok(commands[0]!.includes('git fetch'));
      assert.ok(!commands[0]!.includes('git checkout'));
      assert.ok(commands[2]!.includes('git checkout'));
      assert.match(await readFile(join(dir, 'delivery.log'), 'utf8'), /retrying with a full bundle/);
      // Retry policy table shares one fixture. Unrelated fetch failures, a failed
      // full fetch, and prepare output resembling Git's error must remain failures.
      const delivered = () => lease.execution?.delivered;
      for (const row of [
        { failure: 'none', calls: 2, bundles: 1, error: undefined },
        { failure: 'fetch', calls: 1, bundles: 1, error: /fetch refused/ },
        { failure: 'persistent', calls: 2, bundles: 2, error: /Repository lacks/ },
        { failure: 'prepare', calls: 2, bundles: 1, error: /Repository lacks/ },
      ] as const) {
        failure = row.failure;
        attempts = 0; bundles.length = 0; uploads.length = 0; commands.length = 0;
        delete lease.execution;
        if (row.error) {
          await assert.rejects(executor.deliver(lease, run), row.error);
          assert.equal(lease.execution, undefined);
          assert.match(await readFile(join(dir, 'delivery.log'), 'utf8'), row.error);
        } else {
          await executor.deliver(lease, run);
          assert.equal(delivered(), true);
        }
        assert.equal(attempts, row.calls, row.failure);
        assert.equal(bundles.length, row.bundles, row.failure);
      }
    }));
    await step(() => scope.wait('delivery lease release', async () => { await drive(f!, executor.release(acquired)); lease = undefined; }));
    assert.deepEqual(f.api.droplets, []);
  });
});

test('delivery retries initial SSH setup within its bound and names failed transport steps', async t => {
  const f = await fixture(t);
  await f.stop();
  const snapshot: Snapshot = { image: 900, name: 'ready', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  await writeFile(snapshotPath(f.root), JSON.stringify(snapshot));
  const { run: _scriptedRun, ...dependencies } = f.dependencies;
  let failures = 1;
  let consumeTimeout = false;
  let step = '';
  const setupTimeouts: number[] = [];
  let uploads = 0;
  let prepares = 0;
  let bundleElapsed = 0;
  const transportFailure = new Error('machine command failed (exit 255): ssh: connection reset');
  const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, {
    ...dependencies,
    wait: ms => f.clock.advance(ms),
    runBundle: async (_run, path) => { await writeFile(path, 'scripted bundle'); f.clock.block(bundleElapsed); },
    machine: { ...f.dependencies.machine,
      exec: async (_lease, command, options) => {
        if (command.startsWith('mkdir')) {
          setupTimeouts.push(options.timeoutMs);
          if (failures-- > 0) { if (consumeTimeout) f.clock.block(options.timeoutMs); throw transportFailure; }
        }
        return JSON.stringify(f.key);
      },
      put: async (_lease, _path, remote) => { uploads++; if (step === 'upload' && remote.endsWith('/tree.bundle')) throw transportFailure; },
      result: async (_lease, command) => {
        if (command.includes('git fetch')) { if (step === 'fetch') throw transportFailure; }
        else { prepares++; if (step === 'prepare') throw transportFailure; }
        return { stdout: '', stderr: '', code: 0 };
      },
    },
  });
  const lease = await drive(f, executor.acquire({ id: 'delivery-readiness' }, new Date(f.clock.now().getTime() + 600000).toISOString()));
  try {
    const dir = join(f.root, '.cland/run/delivery-readiness');
    await mkdir(dir, { recursive: true });
    const run = { id: lease.run, cwd: f.root, head: 'e'.repeat(40), mode: 'auto', log: join(dir, 'log'), result: join(dir, 'result'), gate: join(dir, 'gate'), commands: { check: '', prepare: 'prepare-fixture', test: '' } };
    await executor.deliver(lease, run);
    assert.equal(lease.execution?.delivered, true);
    assert.equal(setupTimeouts.length, 2, 'retry only the idempotent mkdir after a transient SSH failure');
    assert.equal(prepares, 1);
    for (const row of [
      { step: 'setup', error: /delivery directory readiness: machine readiness deadline reached/, remaining: 0, elapsed: 0, phase: 'delivery-lease-expiry' },
      { step: 'setup', error: /delivery directory readiness: machine readiness deadline reached/, remaining: 900000, elapsed: 600000, phase: 'delivery-budget-expiry', bundleElapsed: 600000 },
      { step: 'setup', error: /delivery directory readiness.*exit 255.*connection reset/, remaining: 600000, elapsed: 30000 },
      { step: 'setup', error: /delivery directory readiness.*exit 255/, remaining: 600000, elapsed: 30000, consumeTimeout: true },
      { step: 'setup', error: /delivery directory readiness.*exit 255/, remaining: 1500, elapsed: 1500 },
      { step: 'upload', error: /delivery upload tree.bundle.*exit 255/, remaining: 600000, elapsed: 0 },
      { step: 'fetch', error: /delivery fetch.*exit 255/, remaining: 600000, elapsed: 0 },
      { step: 'prepare', error: /delivery checkout\/prepare.*exit 255/, remaining: 600000, elapsed: 0 },
    ]) {
      step = row.step; failures = step === 'setup' ? Infinity : 0;
      consumeTimeout = 'consumeTimeout' in row;
      uploads = 0; prepares = 0; setupTimeouts.length = 0; delete lease.execution;
      const started = f.clock.now().getTime();
      lease.deadline = new Date(started + row.remaining).toISOString();
      bundleElapsed = 'bundleElapsed' in row ? row.bundleElapsed : 0;
      await assert.rejects(executor.deliver(lease, run), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, row.error);
        if ('phase' in row) {
          assert.ok(error.cause instanceof ReadinessDeadlineError);
          assert.equal(error.cause.phase, row.phase);
          assert.equal(error.cause.deadlineMs, started + row.elapsed);
          assert.equal(error.cause.observedMs, started + row.elapsed);
        }
        return true;
      });
      assert.equal(lease.execution, undefined);
      assert.equal(f.clock.now().getTime() - started, row.elapsed);
      if ('phase' in row) assert.deepEqual(setupTimeouts, [], 'expired readiness never starts a machine command');
      assert.ok(setupTimeouts.every(ms => ms > 0 && ms <= Math.min(10000, row.remaining)));
      if (consumeTimeout) assert.deepEqual(setupTimeouts, [10000, 10000, 6000]);
      if (step === 'setup') assert.equal(uploads, 0, 'failed setup never reaches upload');
      assert.equal(prepares, step === 'prepare' ? 1 : 0, 'prepare is never replayed');
    }
  } finally { await drive(f, executor.release(lease)); }
  assert.deepEqual(f.api.droplets, []);
});

test('delivery retries a failed bundle with timed attempts and keeps exhausted delivery inconclusive', async t => {
  const f = await fixture(t);
  await f.stop();
  const snapshot: Snapshot = { image: 900, name: 'ready', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  await writeFile(snapshotPath(f.root), JSON.stringify(snapshot));
  const { run: _scriptedRun, ...dependencies } = f.dependencies;
  let failAll = false;
  let stall = false;
  let lastCopyError: Error | undefined;
  const bounds: number[] = [];
  const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, {
    ...dependencies,
    runBundle: async (_run, path) => { await writeFile(path, Buffer.alloc(9 * 1024 * 1024)); },
    machine: { ...dependencies.machine,
      put: async (_lease, _path, remote, options) => {
        if (!remote.endsWith('/tree.bundle')) return;
        bounds.push(options?.timeoutMs ?? 120000);
        f.clock.block(stall ? options!.timeoutMs : bounds.length === 1 ? 125000 : 250);
        if (failAll || bounds.length === 1) {
          lastCopyError = new MachineRequestError(`machine copy failed (exit 255): Warning: Permanently added fixture\ncopy attempt ${bounds.length}: connection reset\n`, false,
            { code: '255', signal: '', stderr: 'connection reset', timedOut: false, timeoutMs: options?.timeoutMs ?? 120000 });
          throw lastCopyError;
        }
      },
    },
  });
  const lease = await drive(f, executor.acquire({ id: 'delivery-retry' }, new Date(f.clock.now().getTime() + 1200000).toISOString()));
  try {
    const dir = join(f.root, '.cland/run/delivery-retry');
    await mkdir(dir, { recursive: true });
    const run = { id: lease.run, cwd: f.root, head: 'e'.repeat(40), mode: 'auto', log: join(dir, 'log'), result: join(dir, 'result'), gate: join(dir, 'gate'), commands: { check: '', prepare: '', test: '' } };
    await executor.deliver(lease, run);
    assert.equal(lease.execution?.delivered, true);
    assert.deepEqual(bounds, [318000, 318000]);
    let log = await readFile(run.log, 'utf8');
    assert.equal((await readLeaseHistory(f.root)).find(row => row.run === run.id)!.execution?.deliveryLogEnd, Buffer.byteLength(log));
    assert.match(log, /delivery upload tree.bundle attempt 1: failed; elapsed 125000 ms; timeout 318000 ms/);
    assert.match(log, /delivery upload tree.bundle attempt 2: succeeded; elapsed 250 ms; timeout 318000 ms/);
    assert.match(log, /copy attempt 1: connection reset/);
    failAll = true; bounds.length = 0; delete lease.execution;
    await writeFile(run.log, '');
    let cause = '';
    await assert.rejects(executor.deliver(lease, run), (error: Error) => {
      assert.ok(error instanceof DeliveryTransportError);
      assert.equal(error.attempts, 2);
      assert.equal(error.cause, lastCopyError);
      cause = error.message;
      assert.match(cause, /delivery upload tree.bundle: 2 attempts failed.*1=125000 ms.*2=250 ms.*exit 255/);
      return true;
    });
    assert.equal(lease.execution, undefined);
    log = await readFile(run.log, 'utf8');
    assert.match(log, /copy attempt 1: connection reset/);
    assert.match(log, /copy attempt 2: connection reset/);
    assert.equal(log.split('\n').filter(line => line.includes('attempt ') && line.includes('failed;')).length, 2);
    assert.equal(diagnosticResult({ state: 'finished', outcome: { code: 1, cause, notRun: 'infrastructure' } }, log).result, 'inconclusive');
    stall = true;
    for (const row of [
      { lifetime: 1200000, bounds: [318000, 282000], elapsed: 600000 },
      { lifetime: 180000, bounds: [180000], elapsed: 180000 },
    ]) {
      bounds.length = 0;
      const started = f.clock.now().getTime();
      lease.deadline = new Date(started + row.lifetime).toISOString();
      await assert.rejects(executor.deliver(lease, run), /delivery upload tree.bundle: .*attempts failed.*delivery deadline reached/s);
      assert.deepEqual(bounds, row.bounds);
      assert.equal(f.clock.now().getTime() - started, row.elapsed);
      assert.equal(lease.execution, undefined);
    }
    const append = files.appendFile;
    const patch = t.mock.method(files, 'appendFile', async (...args: Parameters<typeof files.appendFile>) => {
      if (args[0] === run.log && String(args[1]).includes('copy attempt')) throw new Error(`diagnostic sink unavailable ${'x'.repeat(5000)}`);
      return append(...args);
    });
    syncBuiltinESMExports();
    try {
      bounds.length = 0; stall = false;
      lease.deadline = new Date(f.clock.now().getTime() + 1200000).toISOString();
      await assert.rejects(executor.deliver(lease, run), (error: Error & { diagnosticFailure?: string }) => {
        assert.equal(error.cause, lastCopyError, 'the selected copy receipt remains primary');
        assert.match(error.message, /exit 255/);
        assert.match(error.message, /connection reset/);
        assert.match(error.diagnosticFailure!, /diagnostic sink unavailable/);
        assert.ok(error.diagnosticFailure!.length <= 1024);
        return true;
      });
      assert.equal(lease.execution, undefined);
      assert.equal(bounds.length, 1, 'missing diagnostic receipt does not admit a retry');
    } finally { patch.mock.restore(); syncBuiltinESMExports(); }
  } finally { await drive(f, executor.release(lease)); }
  assert.deepEqual(f.api.droplets, []);
});

test('machine failures preserve exit and bounded stderr without leaking credentials or command arguments', async () => {
  const token = 'sentinel-machine-secret';
  const machine = new Machine('/unused', { DIGITALOCEAN_TOKEN: token }, async () => {
    throw { code: 255, signal: null, stderr: `ssh: connection reset ${token}\n${'x'.repeat(5000)}`, message: 'secret command arguments' };
  });
  const lease = { lease: 'failure', address: '127.0.0.1' } as Parameters<Machine['exec']>[0];
  for (const action of [() => machine.exec(lease, 'secret command arguments', { timeoutMs: 10 }), () => machine.put(lease, 'private-file', 'remote-file')]) {
    await assert.rejects(action(), (error: Error) => {
      assert.match(error.message, /exit 255.*ssh: connection reset <REDACTED>/);
      assert.ok(!error.message.includes(token));
      assert.ok(!error.message.includes('secret command arguments'));
      if (error.message.startsWith('machine command')) assert.ok(error.message.length < 4300);
      else assert.ok(error.message.endsWith('x'.repeat(5000)), 'copy stderr is complete');
      return true;
    });
  }
  const timedOut = new Machine('/unused', {}, async () => { throw { code: null, signal: 'SIGTERM', stderr: '' }; });
  await assert.rejects(timedOut.exec(lease, 'true', { timeoutMs: 10 }), /exit unknown; signal SIGTERM/);
  const missing = new Machine('/unused', {}, async () => { throw { code: 'ENOENT', message: 'secret command arguments' }; });
  await assert.rejects(missing.exec(lease, 'true', { timeoutMs: 10 }), /exit ENOENT/);
});

test('completed transfers wait for snapshot regions to become visible before publishing the image', async t => {
  const f = await fixture(t);
  const { root, api, ui } = f;
  api.faults.visibilityPolls = 4;
  assert.equal((await prepare(ui)).ok, true);
  const result = await drive(f, eventually('prepare finishes after transfer visibility delay', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string }; snapshot?: { regions: string[] } };
    return value.prepare && value.prepare.state !== 'running' ? value : undefined;
  }, 15000));
  assert.equal(result.prepare!.state, 'done', result.prepare!.error);
  assert.deepEqual(result.snapshot!.regions, ['lon1', 'nyc1', 'sfo2']);
  assert.deepEqual(api.droplets, []);
});

test('a timed-out snapshot retains cleanup ownership through a late action, delayed catalogue and deletion refusal', async t => {
  const f = await fixture(t, { CLAND_TEST_DROPLET_ACTION_MS: '1000' });
  const { root, api, ui, env, stop } = f;
  api.faults.snapshotAfter = 100;
  api.faults.snapshotHiddenPolls = 4;
  assert.equal((await prepare(ui)).ok, true);
  await drive(f, eventually('prepare fails at its bounded action', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
    return value.prepare?.state === 'failed' ? true : undefined;
  }, 10000));
  api.faults.catalogueError = 503;
  const pending = (await ui.request({ type: 'executor.status' })).value as { snapshotRecovery?: unknown[] };
  assert.ok(pending.snapshotRecovery?.length, 'an unsuccessful catalogue read cannot forget the action');
  await stop();
  const restarted = await f.reopen();
  const next = await connectUi(t, restarted.discovery);
  api.faults.snapshotAfter = 1;
  api.faults.catalogueError = 0;
  // Refuse deletes as soon as the late image is created.
  await sweep(f, 'late action materializes its image', () => api.images.length ? true : undefined);
  api.faults.deleteSnapshot = api.images[0]!.id;
  await sweep(f, 'deletion refusal is retried', () => api.requests.filter(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${api.faults.deleteSnapshot}`).length >= 2 ? true : undefined);
  api.faults.deleteSnapshot = 0;
  await sweep(f, 'late image absence closes durable recovery', async () => {
    const value = (await next.request({ type: 'executor.status' })).value as { snapshotRecovery?: unknown[] };
    return !api.images.length && !value.snapshotRecovery?.length ? true : undefined;
  });
  assert.deepEqual(api.droplets, []);
});

test('lost successful retirement and an unavailable catalogue preserve the replacement through restart', async t => {
  const f = await fixture(t);
  const { root, api, env, ui, stop } = f;
  assert.equal((await prepare(ui)).ok, true);
  const old = await drive(f, eventually('initial image ready', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000));
  f.moveBase();
  api.faults.loseDeleteSnapshot = old.image; api.faults.failCatalogueAfterDelete = true;
  assert.equal((await prepare(ui)).ok, true);
  const uncertain = await drive(f, eventually('retirement retains its uncertainty', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string }; snapshotRecovery?: { phase: string }[] };
    return value.prepare?.state === 'failed' ? value : undefined;
  }, 15000));
  assert.notEqual(uncertain.snapshot!.image, old.image);
  assert.equal(api.images.length, 1); assert.equal(api.images[0]!.id, uncertain.snapshot!.image);
  assert.equal(uncertain.snapshotRecovery![0]!.phase, 'retire');
  await stop();
  const restarted = await f.reopen();
  const next = await connectUi(t, restarted.discovery);
  api.faults.catalogueError = 0;
  await sweep(f, 'confirmed old absence completes publication', async () => {
    const value = (await next.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; snapshotRecovery?: unknown[] };
    return value.snapshot?.image === uncertain.snapshot!.image && !value.snapshotRecovery?.length ? true : undefined;
  });
  assert.equal(api.images.length, 1);
  assert.ok(!api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${uncertain.snapshot!.image}`));
});

test('a timed-out accepted retirement keeps the replacement while old is listed, then completes the late deletion', async t => {
  const f = await fixture(t);
  const { root, api, ui } = f;
  assert.equal((await prepare(ui)).ok, true);
  const old = await drive(f, eventually('old image ready', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000));
  f.moveBase();
  let resume!: () => void; let released = false;
  const held = new Promise<void>(resolve => { resume = () => { released = true; resolve(); }; });
  onCleanup(t, () => resume());
  const entered = Promise.withResolvers<void>(), retried = Promise.withResolvers<void>();
  let attempts = 0;
  api.beforeSnapshotDelete(async id => { if (id === old.image && !released) { (++attempts === 1 ? entered : retried).resolve(); await held; } });
  assert.equal((await prepare(ui)).ok, true);
  await drive(f, entered.promise);
  await f.clock.advance(15000);
  await drive(f, retried.promise);
  await f.clock.advance(15000);
  const pending = await drive(f, eventually('the held delete times out but old remains visible', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string }; snapshotRecovery?: unknown[] };
    return value.prepare?.state === 'failed' ? value : undefined;
  }, 15000));
  assert.ok(api.images.some(image => image.id === old.image));
  assert.notEqual(pending.snapshot!.image, old.image, 'old presence does not prove the pending delete was rejected');
  assert.ok(api.images.some(image => image.id === pending.snapshot!.image));
  assert.ok(pending.snapshotRecovery?.length);
  resume();
  await sweep(f, 'late retirement completes without deleting the replacement', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; snapshotRecovery?: unknown[] };
    return api.images.length === 1 && value.snapshot?.image === pending.snapshot!.image && !value.snapshotRecovery?.length ? true : undefined;
  });
  assert.ok(!api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${pending.snapshot!.image}`));
});

for (const fails of [false, true]) test(`project provision runs as root before runner prepare, failure=${fails}`, async t => {
  const f = await fixture(t);
  const path = join(f.root, '.cland/config.toml');
  Object.assign(f.key, { provisionPath: 'system.sh', provision: 'a'.repeat(64) });
  await writeFile(path, (await readFile(path, 'utf8')).replace('[verification]', '[verification]\nprovision = "system.sh"'));
  assert.equal((await f.ui.request({ type: 'hub.reload' })).ok, true);
  const calls: { command: string; user: string }[] = [];
  f.dependencies.machine.result = async (_lease, command, _timeout, _signal, user = 'runner') => {
    calls.push({ command, user });
    return { stdout: 'hook-output', stderr: 'hook-stderr', code: fails && user === 'root' ? 17 : 0 };
  };
  assert.equal((await prepare(f.ui)).ok, true);
  const status = await drive(f, eventually('provision terminal receipt', async () => {
    const value = (await f.ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string } };
    return value.prepare && value.prepare.state !== 'running' ? value.prepare : undefined;
  }));
  assert.equal(status.state, fails ? 'failed' : 'done', status.error);
  await flushProjectLogs(t, f.root);
  const journal = (await readFile(join(f.root, '.cland/log/hub.log'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.ok(journal.some(row => row.event === 'executor-prepare-install' && row.phase === 'provision' && row.output === 'hook-outputhook-stderr'), JSON.stringify(journal.filter(row => row.event === 'executor-prepare-install')));
  assert.equal(calls[0]?.user, 'root');
  assert.match(calls[0]!.command, /system.sh/);
  if (fails) {
    assert.match(status.error!, /provision failed \(exit 17\)[\s\S]*hook-output[\s\S]*hook-stderr/);
    assert.equal(calls.length, 1);
  } else {
    assert.equal(calls[1]?.user, 'runner');
    assert.match(calls[1]!.command, /npm ci/);
  }
});

test('previous persisted snapshot wire shape remains readable before recipe rebuild', async t => {
  const f = await fixture(t);
  const snapshot: Snapshot = { image: 900, name: 'legacy', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  await writeFile(snapshotPath(f.root), JSON.stringify(snapshot));
  assert.deepEqual(await readSnapshot(f.root), snapshot);
});

test('prepare captures applied provision input despite disk edits and refuses an unbound supplied key before reuse', async t => {
  const f = await fixture(t);
  const path = join(f.root, '.cland/config.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('[verification]', '[verification]\nprovision = "applied.sh"'));
  assert.equal((await f.ui.request({ type: 'hub.reload' })).ok, true);
  await writeFile(path, (await readFile(path, 'utf8')).replace('applied.sh', 'disk.sh'));
  let captured: string | undefined;
  f.setKeyInput(async (_root, _env, provision) => {
    assert.ok(provision);
    captured = provision;
    return Object.assign(structuredClone(f.key), { provisionPath: provision, provision: 'a'.repeat(64) });
  });
  assert.equal((await prepare(f.ui)).ok, true);
  const outcome = await drive(f, eventually('captured provision preparation completes', async () => {
    const value = (await f.ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string } };
    return value.prepare && value.prepare.state !== 'running' ? value.prepare : undefined;
  }));
  assert.equal(captured, 'applied.sh');
  assert.equal(outcome.state, 'done', outcome.error);
  const { prepareSnapshot } = await import('../src/executor/droplet/prepare.ts');
  await assert.rejects(prepareSnapshot({ root: f.root, key: { ...f.key, provision: 'a'.repeat(64), provisionPath: 'other.sh' }, provision: 'applied.sh', project: 'fixture', regions: ['lon1'], tags: [], log: () => {}, step: () => {},
    builder: async () => { throw new Error('must refuse before builder'); }, release: async () => ({ lifetimeMs: 0, costUsd: 0 }),
  }), /provision.*key.*mismatch/);
});
