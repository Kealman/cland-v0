import { pgrepMembers } from '../src/pgrep-result.ts';
// T1: durable collector ownership and bounded recovery policy with explicit native observations.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { MaintenanceRecoveryRequired, readMaintenanceOwner, recoverMaintenanceOwner, recoverMaintenanceOwnerSync, writeMaintenanceOwner, type MaintenanceOwner, type OwnerState, type RecoveryServices } from '../src/git-maintenance-owner.ts';
import { gitMaintenancePath, maintainProjectGit } from '../src/git-maintenance.ts';

// These policy fixtures launch no writers; every filesystem operation is awaited.
function ownPolicyDirectory(t: TestContext, root: string) {
  t.after(() => rm(root, { recursive: true, force: true }));
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-collector-recovery-'));
  ownPolicyDirectory(t, root);
  const owner: MaintenanceOwner = { token: 'owned-collector', root, cwd: root, gitDirectory: join(root, '.git'), host: hostname(), pid: 424242, group: 424242, started: 'Sun Oct 25 11:00:00 2026' };
  await mkdir(owner.gitDirectory);
  await writeMaintenanceOwner(root, owner);
  await writeFile(join(owner.gitDirectory, 'gc.pid'), `${owner.pid} ${owner.host}\n`);
  await writeFile(join(owner.gitDirectory, 'tmp_pack_foreign'), 'another writer');
  let observed: OwnerState = 'gone', time = 0;
  const killed: number[] = [], reported: number[] = [];
  const io: RecoveryServices = { inspect: async () => observed, kill: value => { killed.push(value.pid); observed = 'gone'; }, wait: async () => { time += 250; }, now: () => time, alive: () => false, report: value => { reported.push(value.pid); } };
  return { root, owner, io, killed, reported, state(value: OwnerState) { observed = value; } };
}

test('a next pass recovers a transferred dead collector and only its matching gc.pid', async t => {
  const f = await fixture(t);
  await recoverMaintenanceOwner(f.root, {}, f.io);
  assert.equal(await readMaintenanceOwner(f.root), null);
  assert.deepEqual(f.killed, []);
  await assert.rejects(readFile(join(f.owner.gitDirectory, 'gc.pid')), { code: 'ENOENT' });
  assert.equal(await readFile(join(f.owner.gitDirectory, 'tmp_pack_foreign'), 'utf8'), 'another writer');
});

test('a surviving matching collector is killed and observed gone before ownership recovers', async t => {
  const f = await fixture(t); f.state('alive');
  await recoverMaintenanceOwner(f.root, {}, f.io);
  assert.deepEqual(f.killed, [f.owner.pid]);
  assert.equal(await readMaintenanceOwner(f.root), null);
});

test('a reused PID is never signalled and its possible replacement gc.pid is preserved', async t => {
  const f = await fixture(t); f.state('mismatch');
  await recoverMaintenanceOwner(f.root, {}, f.io);
  assert.deepEqual(f.killed, []);
  assert.equal(await readMaintenanceOwner(f.root), null);
  assert.match(await readFile(join(f.owner.gitDirectory, 'gc.pid'), 'utf8'), /^424242 /);
});

test('a collector that survives SIGKILL retains ownership and reports its PID within the bound', async t => {
  const f = await fixture(t); f.state('alive');
  f.io.kill = owner => { f.killed.push(owner.pid); };
  await assert.rejects(recoverMaintenanceOwner(f.root, {}, f.io), MaintenanceRecoveryRequired);
  assert.deepEqual(f.killed, [f.owner.pid]);
  assert.deepEqual(f.reported, [f.owner.pid]);
  assert.deepEqual(await readMaintenanceOwner(f.root), f.owner);
});

test('an unverified native identity preserves ownership without signalling it', async t => {
  const f = await fixture(t); f.state('unknown');
  await assert.rejects(recoverMaintenanceOwner(f.root, {}, f.io), MaintenanceRecoveryRequired);
  assert.deepEqual(f.killed, []);
  assert.deepEqual(f.reported, [f.owner.pid]);
  assert.deepEqual(await readMaintenanceOwner(f.root), f.owner);
});

test('two unavailable inspections retry without signalling and release a confirmed gone collector', async t => {
  const f = await fixture(t);
  const observations: OwnerState[] = ['unknown', 'unknown', 'gone'];
  let attempts = 0;
  f.io.inspect = async () => observations[attempts++]!;
  f.io.wait = async () => {
    assert.deepEqual(await readMaintenanceOwner(f.root), f.owner);
    assert.deepEqual(f.killed, []);
  };
  await recoverMaintenanceOwner(f.root, {}, f.io);
  assert.equal(attempts, 3);
  assert.equal(await readMaintenanceOwner(f.root), null);
  await assert.rejects(readFile(join(f.owner.gitDirectory, 'gc.pid')), { code: 'ENOENT' });
  assert.deepEqual(f.killed, []);
});

for (const mode of ['async', 'sync'] as const) {
  test(`${mode} recovery preserves unknown ownership and reports exhausted inspection attempts`, async t => {
    const f = await fixture(t);
    let attempts = 0, time = 0;
    const delays: number[] = [];
    const inspect = () => { attempts++; return 'unknown' as const; };
    const wait = (ms: number) => { delays.push(ms); time += ms; };
    const diagnostic = (error: unknown) => {
      assert.ok(error instanceof MaintenanceRecoveryRequired);
      assert.deepEqual(error.inspection, { state: 'unknown', reason: 'inspection unavailable', attempts: 3 });
      return true;
    };
    const services = { ...f.io, inspect, wait, now: () => time };
    if (mode === 'sync') assert.throws(() => recoverMaintenanceOwnerSync(f.root, {}, services), diagnostic);
    else await assert.rejects(recoverMaintenanceOwner(f.root, {}, { ...services, inspect: async () => inspect(), wait: async ms => wait(ms) }), diagnostic);
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [50, 100]);
    assert.deepEqual(f.killed, []);
    assert.deepEqual(f.reported, [f.owner.pid]);
    assert.deepEqual(await readMaintenanceOwner(f.root), f.owner);
  });
}

test('synchronous recovery retries two unavailable inspections before releasing a gone collector', async t => {
  const f = await fixture(t);
  let attempts = 0;
  const delays: number[] = [];
  recoverMaintenanceOwnerSync(f.root, {}, {
    ...f.io, inspect: () => ++attempts < 3 ? 'unknown' : 'gone', wait: ms => { delays.push(ms); },
  });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [50, 100]);
  assert.equal(await readMaintenanceOwner(f.root), null);
  await assert.rejects(readFile(join(f.owner.gitDirectory, 'gc.pid')), { code: 'ENOENT' });
  assert.deepEqual(f.killed, []);
});

for (const sample of [
  { name: 'idle', key: '', value: '', expire: '2.weeks.ago' },
  { name: 'retained batch', key: 'merge-batch', value: '{}', expire: 'never' },
  { name: 'running verification', key: 'suite-jobs', value: '[{"state":"running"}]', expire: 'never' },
  { name: 'retained finished verification', key: 'suite-jobs', value: '[{"state":"finished"}]', expire: 'never' },
  { name: 'malformed activity', key: 'suite-jobs', value: 'malformed', expire: 'never' },
  { name: 'cached unreleased lease', key: 'executor-leases', value: '[{"state":"active"}]', expire: 'never' },
  { name: 'incomplete on-disk lease', key: '', value: '', expire: 'never', disk: 'incomplete' },
  { name: 'expired unreleased on-disk lease', key: '', value: '', expire: 'never', disk: 'expired' },
]) test(`maintenance grace for ${sample.name}`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  const root = await mkdtemp(join(tmpdir(), 'cland-maintenance-policy-'));
  ownPolicyDirectory(t, root);
  await mkdir(join(root, '.git'));
  if (sample.disk) {
    const lease = join(root, '.cland/run/executor/leases/held');
    await mkdir(lease, { recursive: true });
    if (sample.disk === 'expired') await writeFile(join(lease, 'lease.json'), JSON.stringify({ provider: 'digitalocean', name: 'held', tags: ['cland'], deadline: '2001-01-01T00:00:00Z', state: 'active' }));
  }
  const commands: string[][] = [];
  await maintainProjectGit(root, key => key === sample.key ? sample.value : null, {}, {
    lock: async (_root, operation) => operation(),
    run: async (_bin, args) => { commands.push([...args]); return { code: 0, stdout: '', stderr: '' }; },
  });
  const gc = commands.filter(args => args.includes('gc'));
  assert.equal(gc.length, 1, 'the native command boundary was actually reached');
  assert.ok(gc[0]!.includes('--cruft'));
  assert.ok(gc[0]!.includes(`--prune=${sample.expire}`));
  assert.equal(JSON.parse(await readFile(gitMaintenancePath(root), 'utf8')).expire, sample.expire);
});

test('incomplete cleanup with unreadable ownership stops the pass before a second repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-maintenance-incomplete-'));
  ownPolicyDirectory(t, root);
  await mkdir(join(root, '.git'));
  await mkdir(join(root, '.cland/territory.git'), { recursive: true });
  await mkdir(join(root, '.cland/run'));
  const commands: string[][] = [];
  await assert.rejects(maintainProjectGit(root, () => null, {}, {
    lock: async (_root, operation) => operation(),
    run: async (_bin, args) => {
      commands.push([...args]);
      if (args.includes('gc')) {
        await writeFile(join(root, '.cland/run/git-maintenance-owner.json'), 'unreadable receipt');
        return { code: null, stdout: '', stderr: '', error: 'collector pid 42; cleanup incomplete' };
      }
      return { code: 0, stdout: '', stderr: '' };
    },
  }), /cleanup incomplete/);
  assert.equal(commands.filter(args => args.includes('gc')).length, 1);
});

test('pgrep inspection separates confirmed empty lists from unavailable and malformed results', () => {
  for (const code of [0, 1]) {
    assert.deepEqual(pgrepMembers({ code, stdout: '', stderr: '' }), []);
    assert.deepEqual(pgrepMembers({ code, stdout: '123\n456\n', stderr: '' }), [123, 456]);
    for (const stderr of ['warning', ' ', 'sysmon request failed with error: sysmond service not found\npgrep: Cannot get process list']) {
      assert.throws(() => pgrepMembers({ code, stdout: '', stderr }), /process inspection unavailable/);
    }
  }
  for (const stdout of ['pgrep: Cannot get process list', 'sysmon request failed', '123 garbage', '0', '9007199254740992']) {
    assert.throws(() => pgrepMembers({ code: 0, stdout, stderr: '' }), /process inspection unavailable/);
  }
  assert.throws(() => pgrepMembers({ code: 2, stdout: '', stderr: '' }), /process inspection unavailable/);
  assert.throws(() => pgrepMembers({ code: null, stdout: '', stderr: '', error: 'timeout' }), /process inspection unavailable/);
});
