// T2: orphan discovery/termination and worktree removal with injected OS facts; no real processes.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fixtureOwnership } from '../../shared/fixture-ownership.ts';
import { findFixtureOrphans, removeWorktreeWithFixtures, sweepFixtureOrphans, type FixtureProcesses } from '../src/fixture-processes.ts';
import { initialised, toolchain, probeTools } from './doctor-fixture.ts';
import { runDoctor } from '../src/cli/doctor.ts';
import type { SystemProcess } from '../src/system-processes.ts';

const checkout = '/repo/.cland/worktrees/T-1';
const row = (pid: number, command = 'nvim --clean -u /repo/.cland/worktrees/T-1/nvim/init.lua --headless'): SystemProcess => ({ pid, parent: 1, group: pid, started: 'Tue Oct 20 08:00:00 2026', state: 'S', command });
function fixture(t: TestContext) {
  const receipts = [101, 102, 103].map(pid => {
    const receipt = fixtureOwnership([checkout, '/scratch/cland-proj-1']);
    receipt.bind(pid, Date.parse(row(pid).started), Date.parse(row(pid).started));
    t.after(() => { receipt.close(); receipt.remove(); });
    return receipt;
  });
  let rows = [row(101), row(102, 'node /repo/nvim/test/stub-hub.ts hub serve --stdio'), row(103, 'node /repo/hub/bin/cland.ts hub serve'), row(104)];
  const ended: number[] = [];
  const readers: FixtureProcesses = {
    rows: async () => rows,
    paths: async pid => ({ cwd: '/scratch/cland-proj-1', files: receipts[pid - 101] ? [receipts[pid - 101]!.path] : [] }),
    sameUser: async () => true,
    missing: path => path === checkout,
    end: async (identity, _log, _grace, beforeSignal, options) => {
      await beforeSignal?.();
      if (!rows.some(row => row.pid === identity.pid && row.started === identity.pidStarted) || !options?.canSignal?.(rows)) return false;
      ended.push(identity.pid!); rows = rows.filter(row => row.pid !== identity.pid); return true;
    },
  };
  return { readers, ended, receipts, setRows: (value: SystemProcess[]) => { rows = value; } };
}

test('deleted-root discovery requires an open private receipt, including stub and fixture hubs', async t => {
  const f = fixture(t);
  const orphans = await findFixtureOrphans(undefined, undefined, f.readers);
  assert.deepEqual(orphans.filter(p => p.owned).map(p => p.process.pid), [101, 102, 103]);
  assert.deepEqual(orphans.filter(p => !p.owned).map(p => p.process.pid), [104], 'legacy hints are reported conservatively');
  await sweepFixtureOrphans(() => {}, undefined, undefined, f.readers);
  assert.deepEqual(f.ended, [101, 102, 103], 'human Neovim with identical argv/cwd is preserved');
});

test('live roots and other projects are outside deleted-root sweeping', async t => {
  const f = fixture(t);
  assert.deepEqual(await findFixtureOrphans('/other', undefined, f.readers), []);
  f.readers.missing = () => false;
  assert.deepEqual(await findFixtureOrphans(undefined, undefined, f.readers), []);
  f.readers.missing = path => path === '/scratch/cland-proj-1';
  assert.deepEqual((await findFixtureOrphans(undefined, undefined, f.readers)).map(p => p.process.pid), [101, 102, 103]);
});

test('receipt PID binding, private permissions, same user and open descriptor are required', async t => {
  const f = fixture(t);
  // Linux ps lstart adds integer boot seconds to truncated start ticks. Its
  // reported second can precede the parent's wall-clock spawn second by one.
  const spawnSecond = Date.parse(row(101).started) + 1000;
  f.receipts[0]!.bind(101, spawnSecond, spawnSecond + 100);
  assert.ok((await findFixtureOrphans(undefined, undefined, f.readers)).some(p => p.process.pid === 101 && p.owned), 'an open child receipt covers Linux ps second truncation');
  const originalRows = f.readers.rows;
  for (const offset of [-2000, 1000]) {
    f.readers.rows = async () => [{ ...row(101), started: new Date(spawnSecond + offset).toString() }];
    assert.deepEqual((await findFixtureOrphans(undefined, undefined, f.readers)).filter(p => p.owned), [], 'births outside the bounded spawn window remain unowned');
  }
  f.readers.rows = originalRows;
  f.receipts[0]!.bind(999);
  // A stale receipt cannot authorize a replacement PID even if it opens that old file.
  const replacement = [{ ...row(101), started: 'Tue Oct 20 09:00:00 2026' }];
  f.receipts[0]!.bind(101, Date.parse(row(101).started), Date.parse(row(101).started));
  f.readers.rows = async () => replacement;
  assert.deepEqual((await findFixtureOrphans(undefined, undefined, f.readers)).filter(p => p.owned), []);
  f.readers.rows = originalRows;
  f.receipts[0]!.bind(999);
  chmodSync(f.receipts[1]!.path, 0o644);
  writeFileSync(f.receipts[2]!.path, '{}');
  assert.deepEqual((await findFixtureOrphans(undefined, undefined, f.readers)).filter(p => p.owned), []);
  f.readers.sameUser = async () => false;
  assert.deepEqual((await findFixtureOrphans(undefined, undefined, f.readers)).filter(p => p.owned), []);
  f.readers.paths = async () => ({ cwd: checkout, files: [] });
  await sweepFixtureOrphans(() => {}, undefined, undefined, f.readers);
  assert.deepEqual(f.ended, []);
});

test('PID reuse between discovery and termination never acquires fixture authority', async t => {
  const f = fixture(t);
  let calls = 0;
  f.readers.rows = async () => ++calls === 1 ? [row(101)] : [{ ...row(101), started: 'replacement' }];
  await sweepFixtureOrphans(() => {}, undefined, undefined, f.readers);
  assert.deepEqual(f.ended, []);
});

test('receipt withdrawal, root recreation and a pending launch prevent signals', async t => {
  for (const change of ['receipt', 'root', 'pending']) {
    const f = fixture(t);
    const end = f.readers.end;
    let pending = false;
    f.readers.end = async (...args) => {
      if (change === 'receipt') f.readers.paths = async () => ({ cwd: checkout, files: [] });
      if (change === 'root') f.readers.missing = () => false;
      if (change === 'pending') pending = true;
      return end(...args);
    };
    await sweepFixtureOrphans(() => {}, undefined, undefined, f.readers, undefined, () => pending);
    assert.deepEqual(f.ended, [], change);
  }
});

test('worktree removal observes owned fixture completion before Git and preserves human processes', { timeout: 2000 }, async t => {
  const f = fixture(t);
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const end = f.readers.end;
  f.readers.end = async (...args) => { entered.resolve(); await finish.promise; return end(...args); };
  let removed = false;
  const removal = removeWorktreeWithFixtures(checkout, async () => { removed = true; assert.deepEqual(f.ended, [101, 102, 103]); return 'removed'; }, f.readers);
  await entered.promise;
  assert.equal(removed, false, 'removal waits for the termination completion receipt');
  finish.resolve();
  assert.equal(await removal, 'removed');
});

test('failed fixture termination keeps the worktree', async t => {
  const f = fixture(t);
  f.readers.end = async () => false;
  await assert.rejects(removeWorktreeWithFixtures(checkout, async () => assert.fail('removed live fixture root'), f.readers), /could not be stopped/);
});

test('worktree cleanup with private receipts crosses no synchronous filesystem boundary', async t => {
  const f = fixture(t);
  const saved = Object.fromEntries(Object.entries(fs).filter(([key, value]) => key.endsWith('Sync') && typeof value === 'function'));
  const calls: string[] = [];
  try {
    for (const key of Object.keys(saved)) Object.assign(fs, { [key]: () => { calls.push(key); throw new Error(`synchronous ${key} on cleanup path`); } });
    syncBuiltinESMExports();
    await removeWorktreeWithFixtures(checkout, async () => assert.deepEqual(f.ended, [101, 102, 103]), f.readers);
    for (const receipt of f.receipts) await assert.rejects(fs.promises.access(receipt.path), { code: 'ENOENT' });
    assert.deepEqual(calls, [], 'no synchronous filesystem call, including caught receipt errors');
  } finally {
    Object.assign(fs, saved);
    syncBuiltinESMExports();
  }
});


test('doctor lists missing fixture roots and --fix ends only proven fixtures with PID-only diagnostics', async t => {
  const f = fixture(t);
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const run = async (fix: boolean) => {
    let text = '';
    await runDoctor(['--json', ...(fix ? ['--fix'] : [])], root, tools.env, value => { text += value; }, probeTools, {
      remotes: async () => [], project: { started: async () => null, territoryProblems: () => null },
      findOrphans: () => findFixtureOrphans(undefined, undefined, f.readers),
      sweepOrphans: async (_root, log, kind) => kind === 'fixture' ? sweepFixtureOrphans(log, undefined, undefined, f.readers) : [],
    });
    assert.doesNotMatch(text, /--headless|stub-hub\.ts|hub serve|TEST_SUITE_RUN_ID|CLAND_TEST_/);
    return (JSON.parse(text) as { checks: Array<{ name: string; detail: string; fix?: string }> }).checks.filter(check => check.name === 'orphan fixture');
  };
  const report = await run(false);
  assert.equal(report.length, 4);
  assert.equal(report.filter(check => check.fix === 'cland doctor --fix').length, 3);
  assert.deepEqual(f.ended, [], 'read-only doctor never terminates fixtures');
  const fixed = await run(true);
  assert.equal(fixed.filter(check => check.detail.startsWith('ended pid ')).length, 3);
  assert.ok(fixed.some(check => check.detail.startsWith('pid 104:') && check.fix?.includes('preserved')));
  assert.deepEqual(f.ended, [101, 102, 103]);
});

test('worktree cleanup finishes captured descendants after their owning leader exits on TERM', { timeout: 2000 }, async t => {
  const f = fixture(t);
  const leader = row(101);
  const child = { ...row(102, 'node /repo/nvim/test/stub-hub.ts hub serve --stdio'), parent: leader.pid };
  f.setRows([leader, child]);
  const completed = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  f.readers.end = async (identity, _log, _grace, beforeSignal, options) => {
    assert.equal(identity.pid, leader.pid);
    assert.equal(identity.pidStarted, leader.started, 'original leader identity is retained');
    await beforeSignal?.();
    assert.equal(options?.canSignal?.([leader, child]), true, 'TERM is authorized for the verified leader');
    // endProcess has captured the child while this ancestry edge is intact. Its leader
    // then exits on TERM, while the captured child survives and is reparented.
    const surviving = { ...child, parent: 1 };
    f.setRows([surviving]);
    assert.equal(options?.canSignal?.([surviving]), true, 'the absent leader cannot veto verified captured-descendant signals');
    assert.equal(options?.canSignal?.([{ ...leader, started: 'reused' }, surviving]), false, 'a present reused leader still cannot acquire authority');
    // The terminator retains and checks the child's own original identity before
    // its STOP/KILL. Only after its disappearance does it issue completion.
    completed.resolve();
    await released.promise;
    f.setRows([]);
    return true;
  };
  let removed = false;
  const removing = removeWorktreeWithFixtures(checkout, async () => { removed = true; }, f.readers);
  // Propagate a failing injected assertion without leaving a pending setup wait.
  void removing.catch(error => completed.reject(error));
  await completed.promise;
  assert.equal(removed, false, 'the parent exit is not the captured-tree completion receipt');
  released.resolve();
  await removing;
  assert.equal(removed, true, 'removal follows captured-descendant completion');
});
