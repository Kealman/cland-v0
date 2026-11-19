// T2: orphan discovery/termination and worktree removal with injected OS facts; no real processes.
import { receiptFixtureCase, type ReceiptStep } from './receipt-fixture-case.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { fixtureOwnership, readFixtureReceipt, FixtureOwnershipRefused } from '../../shared/fixture-ownership.ts';
import { fixtureReceiptCase } from './fixture-receipt-case.ts';
import cp from 'node:child_process';
import { findFixtureOrphans, removeWorktreeWithFixtures, sweepFixtureOrphans, type FixtureProcesses } from '../src/fixture-processes.ts';
import { initialised, toolchain, probeTools } from './doctor-fixture.ts';
import { runDoctor } from '../src/cli/doctor.ts';
import type { SystemProcess } from '../src/system-processes.ts';

const sourceCheckout = '/repo/.cland/worktrees/T-1';
const row = (pid: number, command = 'nvim --clean -u /repo/.cland/worktrees/T-1/nvim/init.lua --headless'): SystemProcess => ({ pid, parent: 1, group: pid, started: 'Tue Oct 20 08:00:00 2026', state: 'S', command });
async function fixture(t: TestContext, step: ReceiptStep, adoptRoot: (root: string) => void) {
  const checkout = await step("fixture operation", async () => (tempProject(t)));
  adoptRoot(checkout);
  const scratch = checkout + '/cland-proj-1';
  await step("fixture operation", async () => (fs.promises.mkdir(scratch)));

  const receipts = [101, 102, 103].map(pid => {
    const receipt = fixtureOwnership([checkout, scratch]);
    onCleanup(t, () => { receipt.close(); receipt.remove(); });
    receipt.bind(pid, Date.parse(row(pid).started), Date.parse(row(pid).started));
    return receipt;
  });
  return receiptReaders(receipts, checkout, scratch, step);
}
function receiptReaders(receipts: Array<ReturnType<typeof fixtureOwnership>>, checkout: string, scratch: string, step: ReceiptStep) {
  let rows = [row(101), row(102, 'node /repo/nvim/test/stub-hub.ts hub serve --stdio'), row(103, 'node /repo/hub/bin/cland.ts hub serve'), row(104, `nvim --clean -u ${checkout}/nvim/init.lua --headless`)];
  const ended: number[] = [];
  const readers: FixtureProcesses = {
    rows: async () => rows,
    paths: async pid => ({ cwd: checkout, files: receipts[pid - 101] ? [receipts[pid - 101]!.path] : [] }),
    sameUser: async () => true,
    missing: path => path === checkout,
    end: async (identity, _log, _grace, beforeSignal, options) => {
      await step("fixture operation", async () => (beforeSignal?.()));
      if (!rows.some(row => row.pid === identity.pid && row.started === identity.pidStarted) || !options?.canSignal?.(rows)) return false;
      ended.push(identity.pid!); rows = rows.filter(row => row.pid !== identity.pid); return true;
    },
  };
  return { checkout, scratch, readers, ended, receipts, setRows: (value: SystemProcess[]) => { rows = value; } };
}

test('deleted-root discovery requires an open private receipt, including stub and fixture hubs', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  const orphans = await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)));
  assert.deepEqual(orphans.filter(p => p.owned).map(p => p.process.pid), [101, 102, 103]);
  assert.deepEqual(orphans.filter(p => !p.owned).map(p => p.process.pid), [104], 'legacy hints are reported conservatively');
  await step("fixture operation", async () => (sweepFixtureOrphans(() => {}, undefined, undefined, f.readers)));
  assert.deepEqual(f.ended, [101, 102, 103], 'human Neovim with identical argv/cwd is preserved');
}));

test('guarded cleanup preserves a source worktree named by a forged fixture receipt', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const source = await step("fixture operation", async () => (fs.promises.realpath(new URL('../../', import.meta.url).pathname)));
  assert.equal((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers, f.checkout)))).filter(row => row.owned).length, 3, 'positive control: unmodified scratch receipts grant authority');
  for (const receipt of f.receipts) {
    receipt.close();
    const value = JSON.parse(await step("fixture operation", async () => (fs.promises.readFile(receipt.path, 'utf8'))));
    await step("fixture operation", async () => (fs.promises.writeFile(receipt.path, JSON.stringify({ ...value, roots: [f.checkout, source] }))));
  }
  await step("fixture operation", async () => (sweepFixtureOrphans(() => {}, undefined, undefined, f.readers, source)));
  assert.deepEqual(f.ended, [], 'the actual cleanup path grants no signal authority from a foreign root');
  for (const receipt of f.receipts) assert.equal((await step("fixture operation", async () => (fs.promises.stat(receipt.path)))).isFile(), true, 'refused cleanup preserves its diagnostic receipt');
}));

test('live roots and other projects are outside deleted-root sweeping', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  assert.deepEqual(await step("fixture operation", async () => (findFixtureOrphans('/other', undefined, f.readers))), []);
  f.readers.missing = () => false;
  assert.deepEqual(await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers))), []);
  f.readers.missing = path => path === f.scratch;
  assert.deepEqual((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)))).map(p => p.process.pid), [101, 102, 103]);
}));

test('fake Claude session recovery requires its own PID and birth receipt', t => fixtureReceiptCase(t, sourceCheckout).run(async ({ root, step, receipt }) => {
  const f = await step('fake receipt fixture setup', async () => receiptReaders([101, 102, 103].map(pid => receipt(pid, Date.parse(row(pid).started))), root, root, step));
  const command = 'node /repo/hub/test/fakes/claude-code/fake-claude.ts __session abcd1234';
  f.setRows([row(101, command), row(104, command), row(102, command.replace('__session abcd1234', 'agents --json'))]);
  assert.deepEqual((await step('matching receipt discovery', () => findFixtureOrphans(undefined, undefined, f.readers))).filter(p => p.owned).map(p => p.process.pid), [101]);
  const birth = Date.parse(row(101).started);
  f.receipts[0]!.bind(999, birth, birth);
  assert.equal((await step('wrong PID receipt publication', () => readFixtureReceipt(f.receipts[0]!.path)))?.pid, 999, 'the mismatched receipt remains readable before refusal');
  assert.deepEqual((await step('inherited PID refusal', () => findFixtureOrphans(undefined, undefined, f.readers))).filter(p => p.owned), [], 'an inherited receipt cannot authorize another PID');
  f.receipts[0]!.bind(101, birth, birth);
  await step('owned fake session sweep', () => sweepFixtureOrphans(() => {}, undefined, undefined, f.readers));
  assert.deepEqual(f.ended, [101], 'matching argv without private ownership cannot authorize a signal');
}));

test('fake Claude cwd association selects scratch ownership without granting cwd cleanup', t => fixtureReceiptCase(t, sourceCheckout).run(async ({ root, step, receipt }) => {
  const owner = receipt(101, Date.parse(row(101).started));
  const f = receiptReaders([owner], root, root, step);
  const project = root + '/project';
  await step('separate project setup', () => fs.promises.mkdir(project));
  const paths = f.readers.paths;
  f.readers.paths = async (pid, deadline) => ({ ...await paths(pid, deadline), cwd: project });
  f.setRows([row(101, 'node /repo/hub/test/fakes/claude-code/fake-claude.ts __session owned'), row(104, 'node /repo/hub/test/fakes/claude-code/fake-claude.ts __session unowned')]);
  const registered = await step('scratch receipt observation', () => readFixtureReceipt(owner.path));
  assert.deepEqual(registered?.roots, [root]);
  assert.equal(registered?.sourceCheckout, sourceCheckout);
  await step('authorized observed-cwd worktree removal', () => removeWorktreeWithFixtures(project, async () => {
    assert.deepEqual(f.ended, [101], 'observed cwd alone does not authorize the unowned peer');
  }, f.readers));
  assert.equal(fs.lstatSync(project).isDirectory(), true, 'the callback alone owns project directory removal');
}));

for (const phase of ['save', 'bind'] as const) test(`receipt recovery owns a rejected ${phase} before constructor setup returns`, async t => {
  const owner = fixtureReceiptCase(t, sourceCheckout);
  const failure = new Error(`planted receipt ${phase} rejection`);
  const native = cp.spawn;
  let root = '';
  await owner.run(async c => {
    root = c.root;
    owner.faults[phase] = failure;
    let rejected: unknown;
    await assert.rejects(c.step('rejected receipt acquisition', async () => c.receipt(101, Date.parse(row(101).started))), error => {
      rejected = error;
      return phase === 'save'
        ? error instanceof FixtureOwnershipRefused && error.reason === 'receipt-write-failed' && error.cause === failure && error.nativeCode === null && error.cleanupCodes.length === 0
        : error === failure;
    });
    assert.deepEqual(owner.acquisitionErrors, [rejected], 'the original producer outcome remains recorded');
    const receipts = owner.opened.filter(entry => entry.receipt);
    assert.equal(receipts.length, 1, 'positive control: one native receipt was acquired before failure');
    const entry = receipts[0]!;
    if (phase === 'save') {
      assert.equal(entry.closed, true);
      assert.throws(() => fs.fstatSync(entry.fd!), { code: 'EBADF' }, 'initial save failure positively closes its captured descriptor');
      await assert.rejects(fs.promises.lstat(entry.path), { code: 'ENOENT' });
      assert.equal(entry.removed, true, 'the partial receipt unlink has its own positive receipt');
    } else {
      assert.equal(entry.closed, false);
      assert.ok(fs.fstatSync(entry.fd!), 'bind failure keeps its descriptor until owner cleanup');
      assert.equal(fs.lstatSync(entry.path).isFile(), true, 'bind failure retains its metadata separately');
    }
    assert.notEqual(cp.spawn, native, 'positive native guard remains installed');
  });
  await owner.close(); // The same registered cleanup also owns constructor rejections.
  assert.ok(owner.opened.every(entry => entry.closed && (!entry.receipt || entry.removed)));
  await assert.rejects(fs.promises.lstat(root), { code: 'ENOENT' });
  await owner.restore();
  assert.equal(cp.spawn, native);
});

for (const phase of ['close', 'remove'] as const) test(`receipt recovery retains its root and native guard after rejected ${phase}`, async t => {
  const owner = fixtureReceiptCase(t, sourceCheckout);
  const failure = new Error(`planted receipt ${phase} rejection`);
  const native = cp.spawn;
  let root = '', first: ReturnType<typeof fixtureOwnership> | undefined;
  await owner.run(async c => {
    root = c.root;
    [first] = await c.step('independent receipt setup', async () => [c.receipt(101, Date.parse(row(101).started)), c.receipt(102, Date.parse(row(102).started))]);
    assert.ok(first);
    if (phase === 'close') owner.faults.close = { fd: first.fd, error: failure };
    else owner.faults.remove = { path: first.path, error: failure };
  });
  await assert.rejects(owner.close(), error => error instanceof AggregateError && error.errors.includes(failure));
  assert.ok(owner.attempts[0]!.errors.includes(failure), 'the original failed attempt remains recorded');
  assert.equal(owner.attempts[0]!.pending.length, 1);
  assert.ok(owner.opened.some(entry => entry.owner !== first && entry.receipt && entry.closed && entry.removed), 'other receipt settles independently');
  assert.equal(fs.lstatSync(root).isDirectory(), true, 'actual cleanup keeps the root');
  assert.equal(fs.lstatSync(first!.path).isFile(), true, 'failed receipt metadata stays present until positive disposal');
  assert.notEqual(cp.spawn, native);
  await assert.rejects(owner.restore(), /resource close unconfirmed/);
  assert.notEqual(cp.spawn, native, 'failed restoration cannot release the native guard');
  if (phase === 'close') assert.ok(fs.fstatSync(first!.fd), 'failed close preserves its real descriptor');
  else assert.equal(owner.opened.find(entry => entry.owner === first)!.closed, true, 'removal failure retains positive close separately');
  delete owner.faults[phase]; // Explicit recovery, never an automatic retry presented as first-attempt proof.
  await owner.close();
  assert.equal(owner.attempts.length, 2);
  assert.equal(owner.attempts[0]!.pending[0]!.closed, phase === 'remove', 'explicit recovery never rewrites the earlier close outcome');
  assert.equal(owner.attempts[0]!.pending[0]!.removed, false);
  assert.deepEqual(owner.attempts[1]!.pending, []);
  await assert.rejects(fs.promises.lstat(root), { code: 'ENOENT' });
  await owner.restore();
  assert.equal(cp.spawn, native);
});

test('receipt PID binding, private permissions, same user and open descriptor are required', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  // Linux ps lstart adds integer boot seconds to truncated start ticks. Its
  // reported second can precede the parent's wall-clock spawn second by one.
  const spawnSecond = Date.parse(row(101).started) + 1000;
  f.receipts[0]!.bind(101, spawnSecond, spawnSecond + 100);
  assert.ok((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)))).some(p => p.process.pid === 101 && p.owned), 'an open child receipt covers Linux ps second truncation');
  const originalRows = f.readers.rows;
  for (const offset of [-2000, 1000]) {
    f.readers.rows = async () => [{ ...row(101), started: new Date(spawnSecond + offset).toString() }];
    assert.deepEqual((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)))).filter(p => p.owned), [], 'births outside the bounded spawn window remain unowned');
  }
  f.readers.rows = originalRows;
  f.receipts[0]!.bind(999);
  // A stale receipt cannot authorize a replacement PID even if it opens that old file.
  const replacement = [{ ...row(101), started: 'Tue Oct 20 09:00:00 2026' }];
  f.receipts[0]!.bind(101, Date.parse(row(101).started), Date.parse(row(101).started));
  f.readers.rows = async () => replacement;
  assert.deepEqual((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)))).filter(p => p.owned), []);
  f.readers.rows = originalRows;
  f.receipts[0]!.bind(999);
  chmodSync(f.receipts[1]!.path, 0o644);
  writeFileSync(f.receipts[2]!.path, '{}');
  assert.deepEqual((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)))).filter(p => p.owned), []);
  f.readers.sameUser = async () => false;
  assert.deepEqual((await step("fixture operation", async () => (findFixtureOrphans(undefined, undefined, f.readers)))).filter(p => p.owned), []);
  f.readers.paths = async () => ({ cwd: checkout, files: [] });
  await step("fixture operation", async () => (sweepFixtureOrphans(() => {}, undefined, undefined, f.readers)));
  assert.deepEqual(f.ended, []);
}));

test('PID reuse between discovery and termination never acquires fixture authority', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  let calls = 0;
  f.readers.rows = async () => ++calls === 1 ? [row(101)] : [{ ...row(101), started: 'replacement' }];
  await step("fixture operation", async () => (sweepFixtureOrphans(() => {}, undefined, undefined, f.readers)));
  assert.deepEqual(f.ended, []);
}));

test('receipt withdrawal, root recreation and a pending launch prevent signals', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  for (const change of ['receipt', 'root', 'pending']) {
    const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
    const checkout = f.checkout;
    const end = f.readers.end;
    let pending = false;
    f.readers.end = async (...args) => {
      if (change === 'receipt') f.readers.paths = async () => ({ cwd: checkout, files: [] });
      if (change === 'root') f.readers.missing = () => false;
      if (change === 'pending') pending = true;
      return end(...args);
    };
    await step("fixture operation", async () => (sweepFixtureOrphans(() => {}, undefined, undefined, f.readers, undefined, () => pending)));
    assert.deepEqual(f.ended, [], change);
  }
}));

test('worktree removal observes owned fixture completion before Git and preserves human processes', { timeout: 2000 }, t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  release(() => finish.resolve());
  const end = f.readers.end;
  f.readers.end = async (...args) => { entered.resolve(); await step("fixture operation", async () => (finish.promise)); return end(...args); };
  let removed = false;
  const removal = step('original worktree removal', async () => removeWorktreeWithFixtures(checkout, async () => { removed = true; assert.deepEqual(f.ended, [101, 102, 103]); return 'removed'; }, f.readers));
  void removal.catch(error => entered.reject(error));
  await step("fixture operation", async () => (entered.promise));
  assert.equal(removed, false, 'removal waits for the termination completion receipt');
  finish.resolve();
  assert.equal(await removal, 'removed');
}));

test('failed fixture termination keeps the worktree', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  f.readers.end = async () => false;
  await step("fixture operation", async () => (assert.rejects(removeWorktreeWithFixtures(checkout, async () => assert.fail('removed live fixture root'), f.readers), /could not be stopped/)));
}));

test('worktree cleanup with private receipts crosses no synchronous filesystem boundary', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  const saved = Object.fromEntries(Object.entries(fs).filter(([key, value]) => key.endsWith('Sync') && typeof value === 'function'));
  const calls: string[] = [];
  try {
    for (const key of Object.keys(saved)) Object.assign(fs, { [key]: () => { calls.push(key); throw new Error(`synchronous ${key} on cleanup path`); } });
    syncBuiltinESMExports();
    await step("fixture operation", async () => (removeWorktreeWithFixtures(checkout, async () => assert.deepEqual(f.ended, [101, 102, 103]), f.readers)));
    for (const receipt of f.receipts) await step("fixture operation", async () => (assert.rejects(fs.promises.access(receipt.path), { code: 'ENOENT' })));
    assert.deepEqual(calls, [], 'no synchronous filesystem call, including caught receipt errors');
  } finally {
    Object.assign(fs, saved);
    syncBuiltinESMExports();
  }
}));


test('doctor lists missing fixture roots and --fix ends only proven fixtures with PID-only diagnostics', t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  const tools = await step("fixture operation", async () => (toolchain(t)));
  const root = await step("fixture operation", async () => (initialised(t, tools.env)));
  const run = async (fix: boolean) => {
    let text = '';
    await step("fixture operation", async () => (runDoctor(['--json', ...(fix ? ['--fix'] : [])], root, tools.env, value => { text += value; }, probeTools, {
      remotes: async () => [], project: { started: async () => null, territoryProblems: () => null },
      findOrphans: () => findFixtureOrphans(undefined, undefined, f.readers),
      sweepOrphans: async (_root, log, kind) => kind === 'fixture' ? sweepFixtureOrphans(log, undefined, undefined, f.readers) : [],
    })));
    assert.doesNotMatch(text, /--headless|stub-hub\.ts|hub serve|TEST_SUITE_RUN_ID|CLAND_TEST_/);
    return (JSON.parse(text) as { checks: Array<{ name: string; detail: string; fix?: string }> }).checks.filter(check => check.name === 'orphan fixture');
  };
  const report = await step("fixture operation", async () => (run(false)));
  assert.equal(report.length, 4);
  assert.equal(report.filter(check => check.fix === 'cland doctor --fix').length, 3);
  assert.deepEqual(f.ended, [], 'read-only doctor never terminates fixtures');
  const fixed = await step("fixture operation", async () => (run(true)));
  assert.equal(fixed.filter(check => check.detail.startsWith('ended pid ')).length, 3);
  assert.ok(fixed.some(check => check.detail.startsWith('pid 104:') && check.fix?.includes('preserved')));
  assert.deepEqual(f.ended, [101, 102, 103]);
}));

test('worktree cleanup finishes captured descendants after their owning leader exits on TERM', { timeout: 2000 }, t => receiptFixtureCase(t, false, async (t, step, adoptRoot, release) => {
  const f = await step("fixture setup", async () => (fixture(t, step, adoptRoot)));
  const checkout = f.checkout;
  const leader = row(101);
  const child = { ...row(102, 'node /repo/nvim/test/stub-hub.ts hub serve --stdio'), parent: leader.pid };
  f.setRows([leader, child]);
  const completed = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  release(() => released.resolve());
  f.readers.end = async (identity, _log, _grace, beforeSignal, options) => {
    assert.equal(identity.pid, leader.pid);
    assert.equal(identity.pidStarted, leader.started, 'original leader identity is retained');
    await step("fixture operation", async () => (beforeSignal?.()));
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
    await step("fixture operation", async () => (released.promise));
    f.setRows([]);
    return true;
  };
  let removed = false;
  const removing = step('original descendant removal', async () => removeWorktreeWithFixtures(checkout, async () => { removed = true; }, f.readers));
  // Propagate a failing injected assertion without leaving a pending setup wait.
  void removing.catch(error => completed.reject(error));
  await step("fixture operation", async () => (completed.promise));
  assert.equal(removed, false, 'the parent exit is not the captured-tree completion receipt');
  released.resolve();
  await removing;
  assert.equal(removed, true, 'removal follows captured-descendant completion');
}));
