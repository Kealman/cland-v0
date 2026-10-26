// T1: persisted watchdog ownership at the injected OS boundary, no processes or wall time.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { stopWatchdog, watchdogAlive, type WatchdogProcesses } from '../src/executor/droplet/watchdog.ts';
import { leaseDir, readLease, writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';
import { FakeClock } from './fake-clock.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import fs, { mkdtemp, realpath, rm } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureEnvironment } from './fixture-environment.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { DigitalOceanApi } from '../src/executor/droplet/api.ts';

const startedUtc = 'Sun Oct 25 12:00:00 2026';
const original = 'linux:11111111-2222-3333-4444-555555555555:90001';
const replacement = 'linux:11111111-2222-3333-4444-555555555555:90002';
const lease = (pidIdentity?: string): DropletLease => ({ watchdog: { pid: 123, startedUtc, ...(pidIdentity ? { pidIdentity } : {}) } } as DropletLease);

test('persisted watchdog with same-second recycled PID is neither alive nor signalled', async () => {
  const signals: NodeJS.Signals[] = [];
  const processes: WatchdogProcesses = {
    started: async () => startedUtc,
    identity: async () => replacement,
    alive: () => true,
    signal: (_pid, signal) => { signals.push(signal); },
  };
  const row = lease(original);
  assert.equal(await watchdogAlive(row, {}, { processes }), false);
  await stopWatchdog(row, {}, { processes });
  assert.deepEqual(signals, [], 'a replacement in the same ps second receives no destructive signal');
});

test('a previous-shape watchdog upgrades durably once before its first signal', async () => {
  const row = lease();
  const checkpoints: unknown[] = [];
  const signals: NodeJS.Signals[] = [];
  let alive = true;
  const processes: WatchdogProcesses = {
    started: async () => startedUtc,
    identity: async () => original,
    alive: () => alive,
    signal: (_pid, signal) => {
      assert.deepEqual(checkpoints, [{ pid: 123, startedUtc, pidIdentity: original }]);
      signals.push(signal); alive = false;
    },
  };
  const checkpoint = async (watchdog: NonNullable<DropletLease['watchdog']>) => { checkpoints.push(structuredClone(watchdog)); };
  assert.equal(await watchdogAlive(row, {}, { processes, checkpoint }), true);
  assert.equal(row.watchdog?.pidIdentity, original);
  await stopWatchdog(row, {}, { processes, checkpoint });
  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(checkpoints.length, 1, 'precise rows never repeat legacy adoption');
});

for (const reason of ['different start', 'unreadable start', 'unreadable birth', 'changed birth', 'no checkpoint'] as const) {
  test(`a legacy watchdog with ${reason} never authorizes a signal or upgrade`, async () => {
    const row = lease();
    let observations = 0, checkpoints = 0;
    const signals: NodeJS.Signals[] = [];
    const processes: WatchdogProcesses = {
      started: async () => reason === 'different start' ? 'Sun Oct 25 11:59:59 2026' : reason === 'unreadable start' ? null : startedUtc,
      identity: async () => reason === 'unreadable birth' ? null : reason === 'changed birth' && ++observations % 2 === 0 ? replacement : original,
      alive: () => true,
      signal: (_pid, signal) => { signals.push(signal); },
    };
    const options = { processes, ...(reason === 'no checkpoint' ? {} : { checkpoint: async () => { checkpoints++; } }) };
    assert.equal(await watchdogAlive(row, {}, options), false);
    await stopWatchdog(row, {}, options);
    assert.deepEqual(signals, []);
    assert.equal(checkpoints, 0);
    assert.equal(row.watchdog?.pidIdentity, undefined);
  });
}

test('failed durable legacy checkpoint retains the previous record and refuses signals', async () => {
  const row = lease();
  const signals: NodeJS.Signals[] = [];
  const processes: WatchdogProcesses = {
    started: async () => startedUtc, identity: async () => original, alive: () => true,
    signal: (_pid, signal) => { signals.push(signal); },
  };
  await assert.rejects(stopWatchdog(row, {}, { processes, checkpoint: async () => { throw new Error('fixture fsync failed'); } }), /fixture fsync failed/);
  assert.equal(row.watchdog?.pidIdentity, undefined);
  assert.deepEqual(signals, []);
});

test('legacy watchdog signals wait for the durable checkpoint completion receipt', async () => {
  const row = lease();
  const entered = Promise.withResolvers<void>(), persisted = Promise.withResolvers<void>();
  const signals: NodeJS.Signals[] = [];
  let alive = true;
  const processes: WatchdogProcesses = {
    started: async () => startedUtc, identity: async () => original, alive: () => alive,
    signal: (_pid, signal) => { signals.push(signal); alive = false; },
  };
  const stop = stopWatchdog(row, {}, { processes, checkpoint: async () => { entered.resolve(); await persisted.promise; } });
  await entered.promise;
  assert.deepEqual(signals, [], 'an entered checkpoint grants no signal authority');
  assert.equal(row.watchdog?.pidIdentity, undefined);
  persisted.resolve();
  await stop;
  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(row.watchdog?.pidIdentity, original);
});

test('a persisted precise watchdog revalidates native ownership immediately before SIGTERM', async () => {
  let probes = 0;
  const signals: NodeJS.Signals[] = [];
  const processes: WatchdogProcesses = {
    started: async () => startedUtc,
    identity: async () => ++probes === 1 ? original : replacement,
    alive: () => true,
    signal: (_pid, signal) => { signals.push(signal); },
  };
  await stopWatchdog(lease(original), {}, { processes });
  assert.deepEqual(signals, [], 'reuse after the initial check is refused at the signal boundary');
});

for (const afterTerm of ['replacement', 'unreadable', 'owned'] as const) {
  test(`watchdog escalation after grace with ${afterTerm} native identity preserves signal authority`, async () => {
    const clock = new FakeClock(0);
    const signals: NodeJS.Signals[] = [];
    const terminated = Promise.withResolvers<void>();
    let alive = true;
    const processes: WatchdogProcesses = {
      started: async () => startedUtc,
      identity: async () => clock.now().getTime() < 50 || afterTerm === 'owned' ? original : afterTerm === 'replacement' ? replacement : null,
      alive: () => alive,
      signal: (_pid, signal) => {
        signals.push(signal);
        if (signal === 'SIGTERM') terminated.resolve(); else alive = false;
      },
    };
    const work = stopWatchdog(lease(original), { CLAND_TEST_DROPLET_WATCHDOG_STOP_MS: '50' }, { processes, clock });
    const completed = afterTerm === 'unreadable' ? assert.rejects(work, /watchdog did not stop within its time bound/) : work;
    await terminated.promise;
    await clock.advance(100);
    await completed;
    assert.deepEqual(signals, afterTerm === 'owned' ? ['SIGTERM', 'SIGKILL'] : ['SIGTERM']);
    assert.equal(alive, afterTerm !== 'owned', 'a replacement or unverified process remains untouched');
  });
}

for (const concurrent of ['state change', 'watchdog replacement'] as const) {
  test(`executor legacy watchdog checkpoint preserves a concurrent ${concurrent}`, async t => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-watchdog-')));
    // All writers are awaited in this process; no fixture child owns this root.
    t.after(() => rm(root, { recursive: true, force: true }));
    const env = fixtureEnvironment(root, process.env);
    const clock = new FakeClock();
    const row: DropletLease = {
      ...lease(), kind: 'droplet', provider: 'digitalocean', lease: 'legacy', run: 'run', name: 'cland-legacy',
      tags: ['cland'], size: 'c-8', region: 'lon1', priceHourly: 1, keyName: 'key', resource: 123, keyId: null,
      state: 'active', created: clock.now().toISOString(), deadline: new Date(clock.now().getTime() + 60000).toISOString(),
    };
    await writeLease(root, row);
    let checkpoints = 0;
    const executor = new DropletExecutor(root, undefined, () => {}, env, undefined, {
      clock, processes: { alive: () => true, started: () => 'fixture lock' },
      api: new DigitalOceanApi({}, clock, async () => ({ droplets: [], ssh_keys: [] })),
      host: {
        createKey: async () => {}, armWatchdog: async () => { throw new Error('unexpected rearm'); }, stopWatchdog: async () => {},
        watchdogAlive: async (observed, _env, options) => {
          const current = await readLease(leaseDir(root, row));
          if (concurrent === 'state change') current.state = 'releasing';
          else current.watchdog = { pid: 456, startedUtc, pidIdentity: replacement };
          await writeLease(root, current);
          assert.ok(options?.checkpoint, 'executor supplies the durable migration boundary');
          await options.checkpoint({ ...observed.watchdog!, pidIdentity: original });
          checkpoints++;
          return true;
        },
      },
    });
    try {
      const inspect = executor.inspect();
      if (concurrent === 'state change') {
        assert.equal((await inspect).leases[0]?.watchdogAlive, true);
        const persisted = await readLease(leaseDir(root, row));
        assert.equal(persisted.watchdog?.pidIdentity, original);
        assert.equal(persisted.state, 'releasing', 'migration merges only ownership into the latest lease');
        assert.equal(checkpoints, 1);
      } else {
        assert.equal((await inspect).leases[0]?.watchdogAlive, false);
        const persisted = await readLease(leaseDir(root, row));
        assert.deepEqual(persisted.watchdog, { pid: 456, startedUtc, pidIdentity: replacement });
        assert.equal(checkpoints, 0, 'stale migration cannot replace a newer watchdog');
      }
    } finally { await executor.close(); }
  });
}

// Register disposal before starting any held operation. The same receipt is
// awaited by the test and node:test's unconditional after hook.
async function heldWriterFixture(t: TestContext, boundary: 'provider' | 'rename', receipt = true) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-watchdog-writer-')));
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>(), actualEntered = Promise.withResolvers<void>(), resume = Promise.withResolvers<void>();
  const setupAbort = new AbortController();
  const works: Promise<unknown>[] = [];
  const settled: string[] = [];
  const signals: NodeJS.Signals[] = [];
  const nativeRename = fs.rename;
  let executor: DropletExecutor | undefined, restore = () => {}, disposing: Promise<void> | undefined;
  let starts = 0, alive = true, disposed = false;
  const dispose = () => disposing ??= (async () => {
    setupAbort.abort(new Error('fixture disposed'));
    resume.resolve();
    const outcomes = await Promise.allSettled(works);
    try { await executor?.close(); }
    finally { restore(); }
    for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
    await rm(root, { recursive: true, force: true });
    disposed = true;
  })();
  t.after(dispose);
  const track = <T>(name: string, work: Promise<T>): Promise<T> => {
    works.push(work);
    void work.then(() => { settled.push(name); }, () => { settled.push(name); });
    return work;
  };
  const env = fixtureEnvironment(root, process.env);
  const row: DropletLease = {
    ...lease(), kind: 'droplet', provider: 'digitalocean', lease: 'legacy', run: 'run', name: 'cland-legacy',
    tags: ['cland'], size: 'c-8', region: 'lon1', priceHourly: 1, keyName: 'key', resource: null, keyId: null,
    state: boundary === 'provider' ? 'active' : 'releasing', created: clock.now().toISOString(), deadline: new Date(clock.now().getTime() + 60000).toISOString(),
  };
  await writeLease(root, row);
  const hold = async () => {
    actualEntered.resolve();
    if (receipt) entered.resolve();
    await resume.promise;
  };
  if (boundary === 'rename') {
    const path = join(leaseDir(root, row), 'lease.json');
    const held = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (args[1] === path) {
        const candidate = JSON.parse(await fs.readFile(args[0], 'utf8'));
        if (candidate.state === 'releasing' && candidate.watchdog?.pidIdentity === original) await hold();
      }
      return nativeRename(...args);
    });
    restore = () => { held.mock.restore(); syncBuiltinESMExports(); };
    syncBuiltinESMExports();
  }
  const processes: WatchdogProcesses = {
    started: async () => { starts++; return startedUtc; }, identity: async () => original, alive: () => alive,
    signal: (_pid, signal) => { signals.push(signal); alive = false; },
  };
  executor = new DropletExecutor(root, undefined, () => {}, env, undefined, {
    clock, processes: { alive: () => true, started: () => 'fixture lock' },
    api: new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'fixture' }, clock, async () => { await hold(); return { ssh_keys: [], droplets: [] }; }),
    host: {
      createKey: async () => {}, armWatchdog: async () => { throw new Error('unexpected rearm'); },
      // inspect has its own bounded reply, which can finish before this writer.
      // Drain the underlying checkpoint too, not just that outer reply.
      watchdogAlive: (lease, env, options) => track('ownership', watchdogAlive(lease, env, { ...options, processes })),
      stopWatchdog: (lease, env, options) => stopWatchdog(lease, env, { ...options, processes, clock }),
    },
  });
  const setup = (work: Promise<void>) => within(abortable(work, AbortSignal.any([t.signal, setupAbort.signal])), 1000, clock, () => new Error('watchdog setup receipt deadline reached'));
  return {
    root, row, clock, executor, signals, settled, dispose, setupAbort,
    starts: () => starts, disposed: () => disposed, renameRestored: () => fs.rename === nativeRename,
    setup: () => setup(entered.promise), actualSetup: () => setup(actualEntered.promise), resume: () => resume.resolve(),
    begin: () => boundary === 'provider' ? track('release', executor!.release(row)) : track('inspect', executor!.inspect()),
    terminal: () => track('terminal', writeLease(root, { ...row, state: 'released' })),
  };
}

test('release retains an inspect-time native upgrade without adopting the legacy watchdog twice', { timeout: 2000 }, async t => {
  const f = await heldWriterFixture(t, 'provider');
  const setup = f.setup(); // arm before starting release
  const release = f.begin();
  try {
    await setup;
    assert.equal((await readLease(leaseDir(f.root, f.row))).state, 'releasing');
    assert.equal((await f.executor.inspect()).leases[0]?.watchdogAlive, true);
    assert.equal((await readLease(leaseDir(f.root, f.row))).watchdog?.pidIdentity, original);
    f.resume();
    await release;
    const persisted = await readLease(leaseDir(f.root, f.row));
    assert.equal(persisted.state, 'released');
    assert.equal(persisted.watchdog?.pidIdentity, original);
    assert.equal(f.starts(), 1, 'release must retain the persisted upgrade instead of adopting a second birth');
    assert.deepEqual(f.signals, ['SIGTERM']);
  } finally { await f.dispose(); }
});

test('overlapping ownership checkpoint and terminal lease write retain both durable facts', { timeout: 2000 }, async t => {
  const f = await heldWriterFixture(t, 'rename');
  const setup = f.setup(); // arm before starting checkpoint
  const inspect = f.begin();
  try {
    await setup;
    const terminal = f.terminal();
    f.resume();
    await Promise.all([inspect, terminal]);
    const persisted = await readLease(leaseDir(f.root, f.row));
    assert.equal(persisted.state, 'released', 'checkpoint cannot overwrite the terminal state with its earlier snapshot');
    assert.equal(persisted.watchdog?.pidIdentity, original, 'a full writer cannot downgrade the checkpointed birth');
  } finally { await f.dispose(); }
});

for (const boundary of ['provider', 'rename'] as const) for (const failure of ['missing receipt', 'aborted setup'] as const) {
  test(`held ${boundary} writer cleanup settles after ${failure}`, { timeout: 2000 }, async t => {
    const f = await heldWriterFixture(t, boundary, false);
    const setup = f.setup();
    const failed = assert.rejects(setup, failure === 'missing receipt' ? /watchdog setup receipt deadline reached/ : /fixture setup cancelled/);
    const actual = f.actualSetup();
    const writer = f.begin();
    await actual; // exact held producer boundary, while the intended receipt is suppressed
    if (failure === 'missing receipt') await f.clock.advance(1000);
    else f.setupAbort.abort(new Error('fixture setup cancelled'));
    await failed;
    await f.dispose(); // the exact pre-start hook, also safely called again by node:test
    await writer;
    assert.deepEqual([...f.settled].sort(), boundary === 'provider' ? ['release'] : ['inspect', 'ownership']);
    assert.equal(f.renameRestored(), true, 'default fs rename binding is restored');
    assert.equal((await import('node:fs/promises')).rename, fs.rename, 'named ESM binding is synced');
    assert.equal(f.disposed(), true);
    await assert.rejects(fs.stat(f.root), { code: 'ENOENT' });
  });
}
