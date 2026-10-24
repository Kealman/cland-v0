// T1: lock ownership and failed ledger publication on isolated files; no real processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { acquireLockAsync } from '../src/hub/lock.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { DigitalOceanApi, DigitalOceanError } from '../src/executor/droplet/api.ts';
import { writeLease, readLeases, type DropletLease } from '../src/executor/droplet/lease.ts';
import { rememberProject, reserveShardSpend, spendPath } from '../src/executor/droplet/spend.ts';
import { scratchMachine, legacyLedger } from './init-machine.ts';
import { FakeClock } from './fake-clock.ts';

const processes = { alive: () => true, started: () => 'fixture identity' };

test('a starved owner releases its lock without another acquisition deadline', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const path = join(machine.root, 'ledger.lock');
  const lock = await acquireLockAsync(path, undefined, Date.now() + 1000, 'UTC', processes);
  // Each continuation was starved past a normal two-second cleanup deadline.
  let time = Date.now();
  const now = t.mock.method(Date, 'now', () => time += 3000);
  try { await lock.release(); } finally { now.mock.restore(); }
  await assert.rejects(fs.stat(path), { code: 'ENOENT' });
  const successor = await acquireLockAsync(path, undefined, Date.now() + 1000, 'UTC', processes);
  await successor.release();
});

test('failed reconcile ledger publication releases ownership before next admission', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await fs.mkdir(join(machine.root, '.cland'));
  const path = spendPath(machine.env);
  const rename = fs.rename;
  const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (args[1] === path) throw new Error('failed reconcile publication');
    return rename(...args);
  });
  syncBuiltinESMExports();
  try { await assert.rejects(rememberProject(machine.root, machine.env, processes), /failed reconcile publication/); }
  finally { fault.mock.restore(); syncBuiltinESMExports(); }
  await assert.rejects(fs.stat(`${path}.lock`), { code: 'ENOENT' });
  await reserveShardSpend(machine.root, ['next'], 'c-8', 1, 60000, 10, machine.env, new FakeClock(), processes);
  await assert.rejects(fs.stat(`${path}.lock`), { code: 'ENOENT' });
});


test('restart takes a stale ledger lock whose holder is dead', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const path = join(machine.root, 'dead-owner.lock');
  await fs.writeFile(path, JSON.stringify({ pid: 123456, started: 'old identity', token: 'old-token' }));
  const lock = await acquireLockAsync(path, undefined, Date.now() + 1000, 'UTC', { alive: pid => pid === process.pid, started: () => 'new identity' });
  assert.notEqual(lock.holder.token, 'old-token');
  await lock.release();
  await assert.rejects(fs.stat(path), { code: 'ENOENT' });
});


test('legacy lock deferral releases the current ledger before retrying admission', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await fs.mkdir(join(machine.root, '.cland'));
  await legacyLedger(machine, []);
  const legacy = await acquireLockAsync(join(machine.home, '.cland/executor/spend.json.lock'), undefined, Date.now() + 1000, 'UTC', processes);
  try { await assert.rejects(rememberProject(machine.root, machine.env, processes), /another hub holds/); }
  finally { await legacy.release(); }
  await assert.rejects(fs.stat(`${spendPath(machine.env)}.lock`), { code: 'ENOENT' });
  await reserveShardSpend(machine.root, ['next'], 'c-8', 1, 60000, 10, machine.env, new FakeClock(), processes);
});

test('concurrent releases join one unlink while a successor acquires before its receipt', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const path = join(machine.root, 'receipt-gap.lock');
  const lock = await acquireLockAsync(path, undefined, Date.now() + 1000, 'UTC', processes);
  const unlinked = Promise.withResolvers<void>(), resume = Promise.withResolvers<void>();
  const rm = fs.rm;
  let unlinks = 0;
  const fault = t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    const result = await rm(...args);
    if (args[0] === path && ++unlinks === 1) { unlinked.resolve(); await resume.promise; }
    return result;
  });
  syncBuiltinESMExports();
  const first = lock.release();
  let successor: Awaited<ReturnType<typeof acquireLockAsync>> | undefined;
  try {
    await unlinked.promise;
    successor = await acquireLockAsync(path, undefined, Date.now() + 1000, 'UTC', processes);
    const concurrent = lock.release();
    assert.equal(unlinks, 1, 'the old handle joins its pending release');
    resume.resolve(); await Promise.all([first, concurrent]);
    await lock.release();
    assert.equal(JSON.parse(await fs.readFile(path, 'utf8')).token, successor.holder.token);
  } finally {
    resume.resolve(); await first;
    fault.mock.restore(); syncBuiltinESMExports();
    await successor?.release();
  }
});


test('settled legacy lease history cannot repeatedly defer a later release', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  const env = { ...machine.env, DIGITALOCEAN_TOKEN: 'fixture' };
  const created = clock.now().toISOString();
  const base: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'history', run: 'history',
    name: 'cland-history', tags: ['cland'], size: 'c-8', region: 'lon1', priceHourly: 1,
    keyName: 'history-key', keyId: null, resource: null, state: 'released', created,
    deadline: new Date(clock.now().getTime() + 3600000).toISOString(), released: created, costUsd: 0.5 };
  // Minimise the 970 released records in A-7125 by scaling publication latency,
  // not wall time. Both ledgers are already settled, just as on the healthy hub.
  const history = Array.from({ length: 16 }, (_, i) => ({ ...base, lease: `history-${i}`, run: `history-${i}` }));
  for (const lease of history) await writeLease(machine.root, lease);
  const pending: DropletLease = { ...base, lease: 'z-pending', run: 'pending', state: 'releasing', resource: 123 };
  delete pending.costUsd; delete pending.released;
  await writeLease(machine.root, pending);
  await legacyLedger(machine, [...history.map(lease => ({ project: machine.root, lease: lease.lease, run: lease.run, size: lease.size,
    reservation: 1, cost: 0.5, created, deadline: lease.deadline, released: created })),
    { project: machine.root, lease: 'z-pending', run: 'pending', size: base.size, reservation: 1, cost: null, created, deadline: base.deadline }]);
  const rename = fs.rename;
  const publication = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    const result = await rename(...args);
    if (args[1] === spendPath(env)) clock.block(1000);
    return result;
  });
  syncBuiltinESMExports();
  const events: Record<string, unknown>[] = [];
  const api = new DigitalOceanApi(env, clock, async (_method, path) => {
    if (path === '/droplets/123') throw new DigitalOceanError(404, 'not_found', 'gone');
    return { droplets: [], ssh_keys: [] };
  });
  const executor = new DropletExecutor(machine.root, undefined, event => events.push(event), env, undefined, {
    api, clock, processes, host: { createKey: async () => {}, armWatchdog: async () => { throw new Error('no live leases'); },
      stopWatchdog: async () => {}, watchdogAlive: async () => false },
  });
  try {
    await executor.sweep();
    await executor.sweep();
    assert.deepEqual(events.filter(event => event.event === 'executor-reconcile-failed'), []);
    assert.equal((await readLeases(machine.root)).find(lease => lease.lease === 'z-pending')!.state, 'released');
    const ledger = JSON.parse(await fs.readFile(spendPath(env), 'utf8'));
    assert.equal(ledger.entries.filter((entry: { cost: number | null }) => entry.cost === null).length, 0);
    assert.equal(ledger.entries.filter((entry: { cost: number }) => entry.cost === 0.5).length, 16);
  } finally { publication.mock.restore(); syncBuiltinESMExports(); }
});
