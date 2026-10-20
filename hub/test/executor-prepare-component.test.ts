// T2: snapshot replacement, refusal and recovery rules use a scripted provider/transport.
// Native image bytes, shell setup, key boot hooks and hub-stop drain stay in executor-prepare.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, clandWithEnv, connectUi, tempProject, inProcessSpoke, eventually, flushProjectLogs } from './harness.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { scriptedMachine } from './fakes/digitalocean/scripted-machine.ts';
import { FakeClock } from './fake-clock.ts';
import { drive } from './remote-clock.ts';
import { onCleanup, beforeDirectories } from './process-cleanup.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { keyHash, snapshotPath, type Snapshot } from '../src/executor/droplet/prepare.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { Machine } from '../src/executor/droplet/machine.ts';

async function fixture(t: TestContext, overrides: Record<string, string> = {}) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('sentinel-prepare', { machine: 'scripted', clock });
  const key = { node: process.version, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };
  const machine = scriptedMachine(root, clock, key);
  const hubs: Awaited<ReturnType<typeof projectHub>>[] = [];
  beforeDirectories(t, async () => {
    for (const served of hubs) await drive({ waits: machine.waits }, served.stop());
    await api.close();
  });
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nprepare = "npm ci"\n[verification.droplet]\nregions=["lon1", "nyc1", "sfo2"]\n');
  api.sizes[0]!.regions.push('sfo2'); api.regions.push({ slug: 'sfo2', available: true, sizes: ['c-8'] });
  let failure = '';
  const dependencies = { ...machine.dependencies, api: api.provider, prepareKey: async () => structuredClone(key),
    machine: { ...machine.dependencies.machine,
      exec: async (_lease: unknown, command: string) => {
        if (failure === 'ssh' || failure === 'unready' || failure === 'install' && command.includes('npm ci')) throw new Error('scripted machine failed');
        return JSON.stringify(failure === 'marker' ? { ...key, base: 'bad' } : key);
      },
      result: async () => {
        if (failure === 'install') return { stdout: 'install-output', stderr: '', code: 8 };
        return { stdout: 'installed', stderr: '', code: 0 };
      },
      put: async () => {},
    },
  };
  const env = { DIGITALOCEAN_TOKEN: 'sentinel-prepare', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '200', CLAND_TEST_DROPLET_ACTION_MS: '2000', CLAND_TEST_DROPLET_RELEASE_MS: '100', CLAND_TEST_EXECUTOR_SWEEP_MS: '200', ...overrides };
  const options = { clock, droplet: dependencies };
  const hub = await projectHub(t, root, env, options);
  hubs.push(hub);
  return { root, api, env, clock, waits: machine.waits, dependencies, options, key,
    ui: await connectUi(t, hub.discovery), stop: () => drive({ waits: machine.waits }, hub.stop()),
    setFailure: (value: string) => { failure = value; },
    moveBase: () => { key.base = 'd'.repeat(40); },
    reopen: async () => { const served = await projectHub(t, root, env, options); hubs.push(served); return served; },
  };
}
async function sweep<T>(f: Awaited<ReturnType<typeof fixture>>, what: string, check: () => Promise<T | undefined> | T | undefined): Promise<T> {
  return eventually(what, async () => { await f.clock.advance(200); return drive(f, Promise.resolve().then(check)); });
}
const prepare = (ui: Awaited<ReturnType<typeof connectUi>>) => ui.request({ type: 'executor.prepare' });

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
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { text: string }[] };
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
    for (const lease of await readLeases(root)) {
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
  await writeFile(config, (await readFile(config, 'utf8')) + 'prepare_size = "big"\n');
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
  await assert.rejects(drive(f, executor.acquire({ id: 'timeout' }, deadline())), /readiness deadline/);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
});

// T2: bundle bytes are injected; the real acquire/deliver policy sees a snapshot
// switch at the provider create boundary, without Git, SSH or a worker process.
test('delivery survives a snapshot replacement during machine creation', async t => {
  const f = await fixture(t);
  await f.stop();
  const old: Snapshot = { image: 900, name: 'old', key: f.key, keyHash: keyHash(f.key), regions: ['lon1'], sizeGb: 1, minDiskSize: 10, created: f.clock.now().toISOString() };
  const nextKey = { ...f.key, base: 'd'.repeat(40) };
  const next: Snapshot = { ...old, image: 901, name: 'next', key: nextKey, keyHash: keyHash(nextKey) };
  await mkdir(join(f.root, '.cland/run/executor'), { recursive: true });
  await writeFile(snapshotPath(f.root), JSON.stringify(old));
  f.api.beforeCreate(async () => { await writeFile(snapshotPath(f.root), JSON.stringify(next)); });
  const bundles: Array<string | undefined> = [];
  const uploads: Array<string | undefined> = [];
  let attempts = 0;
  let failure: 'race' | 'fetch' | 'persistent' | 'prepare' | 'none' = 'race';
  const commands: string[] = [];
  const { run: _scriptedRun, ...dependencies } = f.dependencies;
  const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, {
    ...dependencies,
    runBundle: async (_run, path, base) => { bundles.push(base); await writeFile(path, JSON.stringify({ base })); },
    machine: { ...f.dependencies.machine,
      put: async (_lease, path, remote) => { if (remote.endsWith('/tree.bundle')) uploads.push(JSON.parse(await readFile(path, 'utf8')).base); },
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
  const lease = await drive(f, executor.acquire({ id: 'snapshot-race' }, new Date(f.clock.now().getTime() + 600000).toISOString()));
  try {
    const create = f.api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets')!.body!;
    assert.equal(create.image, old.image);
    const dir = join(f.root, '.cland/run/snapshot-race');
    await mkdir(dir, { recursive: true });
    const run = { id: lease.run, cwd: f.root, head: 'e'.repeat(40), mode: 'auto', log: join(dir, 'log'), result: join(dir, 'result'), gate: join(dir, 'gate'), commands: { check: '', prepare: 'prepare-fixture', test: '' } };
    await executor.deliver(lease, run);
    assert.equal(lease.execution?.delivered, true);
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
  } finally { await drive(f, executor.release(lease)); }
  assert.deepEqual(f.api.droplets, []);
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
  const transportFailure = new Error('machine command failed (exit 255): ssh: connection reset');
  const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, {
    ...dependencies,
    wait: ms => f.clock.advance(ms),
    runBundle: async (_run, path) => { await writeFile(path, 'scripted bundle'); },
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
      await assert.rejects(executor.deliver(lease, run), row.error);
      assert.equal(lease.execution, undefined);
      assert.equal(f.clock.now().getTime() - started, row.elapsed);
      assert.ok(setupTimeouts.every(ms => ms > 0 && ms <= Math.min(10000, row.remaining)));
      if (consumeTimeout) assert.deepEqual(setupTimeouts, [10000, 10000, 6000]);
      if (step === 'setup') assert.equal(uploads, 0, 'failed setup never reaches upload');
      assert.equal(prepares, step === 'prepare' ? 1 : 0, 'prepare is never replayed');
    }
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
      assert.ok(error.message.length < 4300);
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
