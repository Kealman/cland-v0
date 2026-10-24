// T1: spend migration and admission use scratch HOME, a fake clock and injected process identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { hostLeases, inspectSpend, rememberProject, releaseShardSpend, reserveShardSpend, reserveSpend, settleSpend, spendPath, retireLegacySpend } from '../src/executor/droplet/spend.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
import { scratchMachine, legacyLedger, ledger, type SpendEntry } from './init-machine.ts';
import { FakeClock } from './fake-clock.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';

const clock = new FakeClock();
const processes = { alive: () => true, started: () => 'fixture identity' };
const entry = (lease: string, cost: number | null = 2): SpendEntry => ({
  project: '/fixture/project', lease, run: lease, size: 'c-8', reservation: 1, cost,
  created: '2026-10-16T10:00:00Z', deadline: '2026-10-16T11:00:00Z',
  ...(cost === null ? {} : { released: '2026-10-16T11:00:00Z' }),
});

test('project registration refuses filesystem roots, HOME and non-project paths before writing a ledger', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const file = join(machine.root, 'file');
  await writeFile(file, 'not a directory');
  await mkdir(join(machine.home, '.cland'));
  const rootAlias = join(machine.root, 'root-alias'), homeAlias = join(machine.root, 'home-alias');
  await symlink('/', rootAlias);
  await symlink(machine.home, homeAlias);
  for (const root of ['/', rootAlias, machine.home, homeAlias, file, machine.root, join(machine.root, 'missing'), 'relative']) {
    await assert.rejects(rememberProject(root, machine.env, processes), /executor project must be an existing project directory/);
    await assert.rejects(readFile(spendPath(machine.env)), { code: 'ENOENT' });
  }
  await mkdir(join(machine.root, '.cland'));
  await rememberProject(machine.root, machine.env, processes);
  const projectAlias = join(machine.root, 'project-alias');
  await symlink(machine.root, projectAlias);
  await rememberProject(projectAlias, machine.env, processes);
  assert.deepEqual((await ledger(machine)).projects, [machine.root]);
});

test('an unreadable project defers its sweep without pruning or forgiving spend', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await mkdir(join(machine.root, '.cland'));
  await rememberProject(machine.root, machine.env, processes, clock);
  const before = await readFile(spendPath(machine.env), 'utf8');
  const events: Record<string, unknown>[] = [];
  const nativeStat = fs.stat;
  const fault = t.mock.method(fs, 'stat', (...args: Parameters<typeof fs.stat>) => {
    if (args[0] === machine.root) return Promise.reject(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
    return nativeStat(...args);
  });
  syncBuiltinESMExports();
  const executor = new DropletExecutor(machine.root, undefined, event => events.push(event), machine.env, undefined, { clock, processes });
  try { clock.block(48 * 3600000); await executor.sweep(); }
  finally { await executor.close(); fault.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(await readFile(spendPath(machine.env), 'utf8'), before);
  assert.deepEqual(events.filter(event => event.event === 'executor-project-pruned'), []);
  assert.ok(events.some(event => event.event === 'executor-reconcile-failed' && event.reason === 'project registry sweep deferred'));
});

test('a sweep prunes invalid legacy registrations immediately without dropping accounting entries', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await mkdir(join(machine.root, '.cland'));
  await mkdir(join(machine.home, '.cland'));
  const ordinary = join(machine.root, 'ordinary'), file = join(machine.root, 'file'), alias = join(machine.root, 'root-alias');
  await mkdir(ordinary);
  await writeFile(file, 'not a directory');
  await symlink('/', alias);
  const invalid = ['/', machine.home, ordinary, file, alias, 'relative'];
  await legacyLedger(machine, [{ ...entry('pending', null), project: '/' }]);
  const old = join(machine.home, '.cland/executor/spend.json');
  const legacy = JSON.parse(await readFile(old, 'utf8'));
  legacy.projects = [machine.root, ...invalid];
  await writeFile(old, JSON.stringify(legacy));
  const events: Record<string, unknown>[] = [];
  const executor = new DropletExecutor(machine.root, undefined, event => events.push(event), machine.env, undefined, { clock, processes });
  try { await executor.sweep(); } finally { await executor.close(); }
  assert.deepEqual((await ledger(machine)).projects, [machine.root]);
  assert.deepEqual(JSON.parse(await readFile(old, 'utf8')).projects, [machine.root]);
  const pruned = events.filter(event => event.event === 'executor-project-pruned');
  assert.deepEqual(pruned.map(event => event.project), invalid);
  assert.ok(pruned.every(event => event.reason === 'invalid project directory'));
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 1);
  assert.deepEqual(await hostLeases(machine.root, machine.env, processes), []);
});

test('an initialised project between hub runs survives registry sweeps beyond the missing-root grace', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await mkdir(join(machine.root, '.cland'));
  await writeFile(join(machine.root, '.cland/config.toml'), '[project]\nname="stopped-project"\n');
  for (const name of ['hub.json', 'hub.lock']) await assert.rejects(readFile(join(machine.root, '.cland', name)), { code: 'ENOENT' });
  await rememberProject(machine.root, machine.env, processes, clock);
  const events: Record<string, unknown>[] = [];
  const executor = new DropletExecutor(machine.root, undefined, event => events.push(event), machine.env, undefined, { clock, processes });
  try {
    await executor.sweep();
    clock.block(48 * 3600000);
    await executor.sweep();
  } finally { await executor.close(); }
  assert.deepEqual((await ledger(machine)).projects, [machine.root]);
  assert.deepEqual(events.filter(event => event.event === 'executor-project-pruned'), []);
});

test('a sweep gives missing projects a restart-safe grace, resets it on restoration and journals pruning', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  const gone = join(machine.root, 'gone'), moved = join(machine.root, 'moved');
  await mkdir(join(machine.root, '.cland'));
  await mkdir(join(gone, '.cland'), { recursive: true });
  await rememberProject(machine.root, machine.env, processes, clock);
  await rememberProject(gone, machine.env, processes, clock);
  await reserveShardSpend(gone, ['pending'], 'c-8', 1, 3600000, 10, machine.env, clock, processes);
  // Exercise mixed-version write-through as well as the primary ledger.
  await legacyLedger(machine, []);
  const events: Record<string, unknown>[] = [];
  const sweep = async () => {
    const executor = new DropletExecutor(machine.root, undefined, event => events.push(event), machine.env, undefined, { clock, processes });
    try { await executor.sweep(); } finally { await executor.close(); }
  };
  await rename(gone, moved); // No process or other writer owns either directory.
  await sweep();
  clock.block(24 * 3600000 - 1);
  await sweep();
  assert.ok((await ledger(machine)).projects!.includes(gone));
  assert.deepEqual(events.filter(event => event.event === 'executor-project-pruned'), []);
  await rename(moved, gone);
  await sweep();
  await rename(gone, moved);
  await sweep();
  clock.block(1);
  await sweep();
  assert.ok((await ledger(machine)).projects!.includes(gone), 'restoration resets the original grace');
  clock.block(24 * 3600000 - 1);
  await sweep();
  assert.deepEqual((await ledger(machine)).projects, [machine.root]);
  assert.deepEqual(JSON.parse(await readFile(join(machine.home, '.cland/executor/spend.json'), 'utf8')).projects, [machine.root]);
  assert.deepEqual(events.filter(event => event.event === 'executor-project-pruned').map(event => event.project), [gone]);
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 1, 'pruning never forgives unsettled spend');
  assert.deepEqual(await hostLeases(machine.root, machine.env, processes), []);
  await sweep();
  assert.equal(events.filter(event => event.event === 'executor-project-pruned').length, 1, 'a restarted sweep does not re-import a legacy registration');
  await rename(moved, gone);
  await sweep();
  assert.deepEqual((await ledger(machine)).projects, [machine.root, gone], 'a returning project restores ownership scans before provider cleanup');
  await rememberProject(gone, machine.env, processes, clock);
  assert.deepEqual((await ledger(machine)).projects, [machine.root, gone], 'registration remains idempotent after return');
});

test('retirement requires explicit confirmation and every registered live hub on the same new path', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled')]);
  await inspectSpend(10, machine.env, clock, processes);
  const current = await ledger(machine);
  current.projects = ['/other-project'];
  await writeFile(spendPath(machine.env), JSON.stringify(current));
  const checked = /registered projects: \/fixture\/project, \/other-project/;
  await assert.rejects(retireLegacySpend(false, machine.env, clock, processes, async () => { assert.fail('confirmation precedes probes'); }), checked);
  await assert.rejects(retireLegacySpend(true, machine.env, clock, processes, async () => ({ path: spendPath(machine.env) })), /does not support the legacy retirement marker.*registered projects/);
  const seen: string[] = [];
  await assert.rejects(retireLegacySpend(true, machine.env, clock, processes, async project => {
    seen.push(project);
    if (project === '/other-project') throw new Error('hub unreachable');
    return { path: spendPath(machine.env), legacyRetirement: 1 };
  }), error => { assert.match(String(error), /hub unreachable/); assert.match(String(error), checked); return true; });
  assert.deepEqual(seen, ['/fixture/project', '/other-project']);
  await assert.rejects(retireLegacySpend(true, machine.env, clock, processes, async () => ({ path: join(machine.home, '.cland/executor/spend.json'), legacyRetirement: 1 })), /does not report.*registered projects/);
  await assert.rejects(readFile(join(dirname(spendPath(machine.env)), 'spend-retirement.json')), { code: 'ENOENT' });
  assert.equal((await ledger(machine) as { legacyRetired?: boolean }).legacyRetired, undefined);
});

test('retirement retains legacy bytes and its archive snapshot while the shared cap still holds after restart', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled'), entry('active', null)]);
  const old = join(machine.home, '.cland/executor/spend.json');
  const bytes = await readFile(old, 'utf8');
  const result = await retireLegacySpend(true, machine.env, clock, processes, async () => ({ path: spendPath(machine.env), legacyRetirement: 1 }));
  const snapshot = await readFile(result.receipt, 'utf8');
  assert.equal(JSON.parse(snapshot).legacyBytes, bytes);
  assert.equal(JSON.parse(snapshot).event, 'executor-spend-retired');
  assert.deepEqual(result.projects, ['/fixture/project']);
  await reserveShardSpend('/second-project', ['fits'], 'c-8', 3, 3600000, 6, machine.env, clock, processes);
  assert.equal(await readFile(old, 'utf8'), bytes, 'retirement and later admission never write legacy state');
  assert.deepEqual(await inspectSpend(6, machine.env, clock, processes), { path: spendPath(machine.env), day: '2026-10-16', spent: 2, reserved: 4, cap: 6 });
  await assert.rejects(reserveShardSpend('/third-project', ['over-cap'], 'c-8', 1, 3600000, 6, { ...machine.env }, clock, processes), /spend cap/);
  await releaseShardSpend('/second-project', ['fits'], machine.env, clock, processes);
  assert.equal((await inspectSpend(6, machine.env, clock, processes, true)).reserved, 1);
  await retireLegacySpend(true, { ...machine.env }, clock, processes, async () => { assert.fail('an activated retirement survives restart'); });
  assert.equal(await readFile(result.receipt, 'utf8'), snapshot);
  assert.equal(await readFile(old, 'utf8'), bytes);
});

test('interrupted retirement activation retains mixed-version admission and safely retries its snapshot', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled'), entry('active', null)]);
  const old = join(machine.home, '.cland/executor/spend.json');
  const bytes = await readFile(old, 'utf8');
  const rename = fs.rename;
  const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (args[1] === spendPath(machine.env) && JSON.parse(await readFile(args[0], 'utf8')).legacyRetired) throw new Error('interrupted retirement activation');
    return rename(...args);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(retireLegacySpend(true, machine.env, clock, processes, async () => ({ path: spendPath(machine.env), legacyRetirement: 1 })), /interrupted retirement activation/);
  } finally { fault.mock.restore(); syncBuiltinESMExports(); }
  assert.equal((await ledger(machine) as { legacyRetired?: boolean }).legacyRetired, undefined);
  assert.equal(await readFile(old, 'utf8'), bytes);
  await reserveShardSpend('/second-project', ['pending'], 'c-8', 3, 3600000, 6, machine.env, clock, processes);
  const latest = await readFile(old, 'utf8');
  assert.notEqual(latest, bytes, 'unactivated snapshot does not stop compatibility write-through');
  const result = await retireLegacySpend(true, machine.env, clock, processes, async () => ({ path: spendPath(machine.env), legacyRetirement: 1 }));
  assert.equal(JSON.parse(await readFile(result.receipt, 'utf8')).legacyBytes, latest);
  await assert.rejects(reserveShardSpend('/third-project', ['too-much'], 'c-8', 1, 3600000, 6, machine.env, clock, processes), /spend cap/);
  assert.equal(await readFile(old, 'utf8'), latest);
});

test('retirement refuses aliased ledgers before changing the legacy bytes', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled')]);
  const old = join(machine.home, '.cland/executor/spend.json');
  const bytes = await readFile(old, 'utf8');
  await mkdir(dirname(spendPath(machine.env)), { recursive: true });
  await fs.symlink(old, spendPath(machine.env));
  await assert.rejects(retireLegacySpend(true, machine.env, clock, processes, async () => ({ path: spendPath(machine.env), legacyRetirement: 1 })), /alias the same file/);
  assert.equal(await readFile(old, 'utf8'), bytes);
});

test('spend defaults to the XDG state directory without a project marker', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  assert.equal(spendPath({ HOME: machine.home }), join(machine.home, '.local/state/cland/spend.json'));
  assert.equal(spendPath(machine.env), join(machine.env.XDG_STATE_HOME!, 'cland/spend.json'));
  assert.equal(spendPath({ ...machine.env, CLAND_EXECUTOR_STATE: join(machine.root, 'override') }), join(machine.root, 'override/spend.json'));
});

test('migration copies the ledger with a verified atomic destination and one durable log', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled'), entry('active', null)]);
  const oldPath = join(machine.home, '.cland/executor/spend.json');
  const original = await readFile(oldPath, 'utf8');
  const newPath = spendPath(machine.env);
  await mkdir(dirname(newPath), { recursive: true });
  // A crash before atomic publication can leave a partial temp file, never a partial ledger.
  await writeFile(`${newPath}.crashed.tmp`, '{"version":');
  const result = await inspectSpend(6, machine.env, clock, processes);
  assert.equal(result.spent, 2);
  assert.equal(result.reserved, 1);
  assert.deepEqual((await ledger(machine)).entries, [entry('settled'), entry('active', null)]);
  assert.equal(await readFile(oldPath, 'utf8'), original, 'legacy bytes are retained');
  const logPath = join(dirname(newPath), 'spend-migration.json');
  const log = await readFile(logPath, 'utf8');
  assert.deepEqual(JSON.parse(log), { event: 'executor-spend-migrated', from: oldPath, to: newPath });
  await writeFile(logPath, `${log}\n`);
  await inspectSpend(6, machine.env, clock, processes);
  assert.equal(await readFile(logPath, 'utf8'), `${log}\n`, 'repeat/restart preserves the original log bytes');
  await assert.rejects(reserveShardSpend('/fixture/project', ['over-cap'], 'c-8', 4, 3600000, 6, machine.env, clock, processes), /spend cap/);
});

test('migration reconciles the later day and larger costs from both ledgers', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('shared', 4), entry('old-only', 3)]);
  const oldPath = join(machine.home, '.cland/executor/spend.json');
  const old = JSON.parse(await readFile(oldPath, 'utf8'));
  old.entries[0].released = '2026-10-15T11:00:00Z';
  old.projects = ['/old-project'];
  await writeFile(oldPath, JSON.stringify(old));
  const newPath = spendPath(machine.env);
  await mkdir(dirname(newPath), { recursive: true });
  await writeFile(newPath, JSON.stringify({ version: 1, entries: [entry('shared', 1), entry('new-only', 2)], projects: ['/new-project'] }));
  const result = await inspectSpend(10, machine.env, clock, processes);
  assert.equal(result.spent, 9, 'the shared lease keeps the later day and larger cost, distinct leases count once');
  assert.deepEqual(new Set((await ledger(machine)).projects), new Set(['/old-project', '/new-project']));
  assert.deepEqual(JSON.parse(await readFile(oldPath, 'utf8')), old);
  // A still-running old hub can write more spend after the first copy.
  old.entries.push(entry('late-old', 2));
  await writeFile(oldPath, JSON.stringify(old));
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).spent, 11);
  await assert.rejects(reserveShardSpend('/fixture/project', ['blocked'], 'c-8', 1, 3600000, 10, machine.env, clock, processes), /spend cap/);
});

test('an empty destination or interrupted migration cannot reset today’s spend', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled')]);
  const newPath = spendPath(machine.env);
  await mkdir(dirname(newPath), { recursive: true });
  await writeFile(newPath, '{"version":1,"entries":[]}');
  assert.equal((await inspectSpend(6, machine.env, clock, processes)).spent, 2);
  // Crash after ledger publication but before recording the migration receipt.
  await rm(join(dirname(newPath), 'spend-migration.json'));
  assert.equal((await inspectSpend(6, machine.env, clock, processes)).spent, 2);
  assert.equal((await ledger(machine)).entries.length, 1);
});

test('legacy shard reservations stay consumed after the new ledger settles the lease', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [{ ...entry('reserved:run', null), run: 'run' }]);
  const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'actual', run: 'run', name: 'fixture', tags: ['cland'],
    size: 'c-8', region: 'lon1', priceHourly: 1, keyName: 'fixture-key', keyId: null, state: 'active', resource: null,
    created: '2026-10-16T10:00:00Z', deadline: '2026-10-16T11:00:00Z' };
  await reserveSpend('/fixture/project', lease, 6, machine.env, clock, undefined, processes);
  assert.equal((await inspectSpend(6, machine.env, clock, processes)).reserved, 1);
  await settleSpend({ ...lease, state: 'released', costUsd: 0.5, released: '2026-10-16T11:00:00Z' }, machine.env, processes);
  const result = await inspectSpend(6, machine.env, clock, processes);
  assert.equal(result.spent, 0.5);
  assert.equal(result.reserved, 0, 'the retained legacy reservation does not come back');
  const oldEnv = { ...machine.env, CLAND_EXECUTOR_STATE: join(machine.home, '.cland/executor') };
  const oldResult = await inspectSpend(6, oldEnv, clock, processes);
  assert.equal(oldResult.spent, 0.5, 'old readers see the real lease settlement');
  assert.equal(oldResult.reserved, 0);
});

test('explicit executor state never imports the legacy HOME ledger', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('legacy', 100)]);
  const env = { ...machine.env, CLAND_EXECUTOR_STATE: join(machine.root, 'isolated') };
  assert.equal((await inspectSpend(6, env, clock, processes)).spent, 0);
  await reserveShardSpend('/fixture/project', ['isolated'], 'c-8', 1, 3600000, 6, env, clock, processes);
  assert.equal((await inspectSpend(6, env, clock, processes)).reserved, 1);
  await assert.rejects(readFile(join(env.CLAND_EXECUTOR_STATE, 'spend-migration.json')), { code: 'ENOENT' });
});

test('malformed legacy state refuses admission and lease sweeping', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, []);
  const oldPath = join(machine.home, '.cland/executor/spend.json');
  await writeFile(oldPath, '{"version":');
  await assert.rejects(inspectSpend(6, machine.env, clock, processes), SyntaxError);
  await assert.rejects(reserveShardSpend('/fixture/project', ['blocked'], 'c-8', 1, 3600000, 6, machine.env, clock, processes), SyntaxError);
  await assert.rejects(hostLeases('/fixture/project', machine.env, processes), SyntaxError);
  await assert.rejects(readFile(spendPath(machine.env)), { code: 'ENOENT' });
});

test('a failed atomic publication leaves legacy spend intact for a successful retry', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [entry('settled')]);
  const oldPath = join(machine.home, '.cland/executor/spend.json');
  const original = await readFile(oldPath, 'utf8');
  const newPath = spendPath(machine.env);
  const rename = fs.rename;
  const fault = t.mock.method(fs, 'rename', async (...[from, to]: Parameters<typeof fs.rename>) => {
    if (to === newPath) throw new Error('interrupted migration publication');
    return rename(from, to);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(inspectSpend(6, machine.env, clock, processes), /interrupted migration publication/);
    assert.equal(await readFile(oldPath, 'utf8'), original);
    await assert.rejects(readFile(newPath), { code: 'ENOENT' });
    await assert.rejects(readFile(join(dirname(newPath), 'spend-migration.json')), { code: 'ENOENT' });
  } finally { fault.mock.restore(); syncBuiltinESMExports(); }
  assert.equal((await inspectSpend(6, machine.env, clock, processes)).spent, 2);
});

test('an old-hub reader sees new reservations so the shared cap holds at 10', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [{ ...entry('old-reservation', null), reservation: 6 }]);
  await reserveShardSpend('/new-project', ['new-reservation'], 'c-8', 4, 3600000, 10, machine.env, clock, processes);
  // The pre-migration implementation uses only this path and the same cap rule.
  const oldEnv = { ...machine.env, CLAND_EXECUTOR_STATE: join(machine.home, '.cland/executor') };
  assert.equal((await inspectSpend(10, oldEnv, clock, processes)).reserved, 10);
  await assert.rejects(reserveShardSpend('/old-project', ['would-overspend'], 'c-8', 4, 3600000, 10, oldEnv, clock, processes), /spend cap/);
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 10);
  await releaseShardSpend('/new-project', ['new-reservation'], machine.env, clock, processes);
  assert.equal((await inspectSpend(10, oldEnv, clock, processes)).reserved, 6);
  await reserveShardSpend('/old-project', ['now-fits'], 'c-8', 4, 3600000, 10, oldEnv, clock, processes);
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 10, 'new readers see later old-hub admissions');
});

test('interrupted write-through keeps reservations visible to old admission', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  await legacyLedger(machine, [{ ...entry('old-reservation', null), reservation: 6 }]);
  const newPath = spendPath(machine.env);
  const oldEnv = { ...machine.env, CLAND_EXECUTOR_STATE: join(machine.home, '.cland/executor') };
  const rename = fs.rename;
  const fault = t.mock.method(fs, 'rename', async (...[from, to]: Parameters<typeof fs.rename>) => {
    if (to === newPath && JSON.parse(await readFile(from, 'utf8')).entries.some((e: SpendEntry) => e.run === 'new-reservation')) {
      throw new Error('interrupted after legacy publication');
    }
    return rename(from, to);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(reserveShardSpend('/new-project', ['new-reservation'], 'c-8', 4, 3600000, 10, machine.env, clock, processes), /interrupted after legacy publication/);
    assert.equal((await inspectSpend(10, oldEnv, clock, processes)).reserved, 10);
    await assert.rejects(reserveShardSpend('/old-project', ['would-overspend'], 'c-8', 4, 3600000, 10, oldEnv, clock, processes), /spend cap/);
    assert.equal(JSON.parse(await readFile(newPath, 'utf8')).entries.length, 1, 'the destination still holds the pre-mutation snapshot');
  } finally { fault.mock.restore(); syncBuiltinESMExports(); }
  await reserveShardSpend('/new-project', ['new-reservation'], 'c-8', 4, 3600000, 10, machine.env, clock, processes);
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 10, 'retry imports the old-first publication exactly once');
});


test('recovery settles a batch of interrupted releases without changing final legacy costs', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const leases: DropletLease[] = ['first', 'second', 'settled'].map(id => ({
    kind: 'droplet', provider: 'digitalocean', lease: id, run: id, name: `cland-${id}`, tags: ['cland'],
    size: 'c-8', region: 'lon1', priceHourly: 1, keyName: id, keyId: null, state: 'released', resource: null,
    created: '2026-10-16T10:00:00Z', deadline: '2026-10-16T11:00:00Z', released: '2026-10-16T11:00:00Z', costUsd: 0.5,
  }));
  await legacyLedger(machine, [entry('first', null), entry('second', null), entry('settled', 2)]);
  await settleSpend(leases, machine.env, processes);
  const expected = [0.5, 0.5, 2];
  assert.deepEqual((await ledger(machine)).entries.map(entry => entry.cost), expected);
  assert.deepEqual(JSON.parse(await readFile(join(machine.home, '.cland/executor/spend.json'), 'utf8')).entries.map((entry: SpendEntry) => entry.cost), expected);
  const entries = (await ledger(machine)).entries;
  await settleSpend(leases, machine.env, processes);
  assert.deepEqual((await ledger(machine)).entries, entries, 'repeated settlement preserves accounting entries');
});
