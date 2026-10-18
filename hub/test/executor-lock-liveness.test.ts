// T1: lock ownership and failed ledger publication on isolated files; no real processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { acquireLockAsync } from '../src/hub/lock.ts';
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
