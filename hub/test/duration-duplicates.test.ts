// T2: exercise the lint CLI in a disposable project; no harness or network.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratchMachine, commandIn, type InitMachine } from './init-machine.ts';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { eventually, testSetupWaitMs } from './until.ts';

/** Register before acquisition; collect late cleanup registrations until all work joins. */
function joinedWork(t: TestContext, body: (step: FixtureStep, acquire: (held?: () => Promise<void>) => Promise<InitMachine>) => Promise<void>, release: () => void = () => {}) {
  const owner = fixtureWork();
  const hooks: Array<() => unknown> = [];
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    await owner.close(); // An incomplete bounded join retains every root and hook.
    const errors: unknown[] = [];
    for (const hook of hooks) try { await hook(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'lint fixture cleanup failed');
  })();
  // Both native after hooks and signal cleanup release held work before joining.
  beforeDirectories(t, () => { release(); return close(); });
  const work = owner.run(async (step, signal) => {
    // These fixture helpers use only signal/after; collect even late registrations.
    const context = { signal: AbortSignal.any([t.signal, signal]), after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
    const acquire = (held?: () => Promise<void>) => step(async () => {
      await held?.(); // An already admitted acquisition may complete after close.
      const machine = await scratchMachine(context, { identity: false });
      guardDirectoryRemoval(machine.root, owner.close); // Adopt before the next fenced step.
      return machine;
    });
    await body(step, acquire);
  });
  void work.catch(() => {});
  return { work, close };
}

test('check lint reports duplicate allowances and preserves its successful exit status', async t => {
  await joinedWork(t, async (step, acquire) => {
    const machine = await acquire();
    await step(() => mkdir(join(machine.root, 'hub/test'), { recursive: true }));
    await step(() => writeFile(join(machine.root, 'hub/test/tiers.json'), '{"version":1,"tests":{}}'));
    const path = join(machine.root, 'hub/test/durations.json');
    const script = fileURLToPath(new URL('./lint-tests.ts', import.meta.url));
    const clean = await step(() => readFile(new URL('./durations.json', import.meta.url), 'utf8'));
    await step(() => writeFile(path, clean));
    const before = await step(() => commandIn(machine, machine.root, process.execPath, [script, machine.root]));
    assert.equal(before.code, 0, before.stderr + before.stdout);
    assert.doesNotMatch(before.stderr + before.stdout, /duration duplicate/);
    await step(() => writeFile(path, '{"allow":{"slow":{"seconds":48},"slow":{"seconds":24}}}'));
    const after = await step(() => commandIn(machine, machine.root, process.execPath, [script, machine.root]));
    assert.equal(after.code, before.code, after.stderr + after.stdout);
    assert.match(after.stderr + after.stdout, /duration duplicate \(report only\): allow\["slow"\] first=\{"seconds":48\} duplicate=\{"seconds":24\}/);
  }).work;
});

for (const phase of ['acquisition', 'write'] as const) test(`lint fixture joins held ${phase} before root removal and fences later work`, { timeout: testSetupWaitMs() * 4 }, async t => {
  const release = Promise.withResolvers<void>();
  let root = '', wrote = false, continued = false, reached = false;
  const owner = joinedWork(t, async (step, acquire) => {
    const machine = await acquire(phase === 'acquisition' ? async () => { reached = true; await release.promise; } : undefined);
    root = machine.root;
    await step(async () => {
      reached = true; await release.promise;
      await writeFile(join(machine.root, 'late-write'), 'joined');
      wrote = true;
    });
    await step(async () => { continued = true; });
  }, () => release.resolve());
  await eventually(`held ${phase} setup entry`, () => reached ? true : undefined, { timeoutMs: testSetupWaitMs(), loadFactor: 1 });
  const closing = owner.close();
  if (root) assert.equal((await stat(root)).isDirectory(), true);
  release.resolve();
  await assert.rejects(owner.work, /fixture work admission closed/);
  await closing;
  assert.equal(continued, false);
  assert.equal(wrote, phase === 'write');
  assert.ok(root, 'late acquisition was captured');
  await assert.rejects(stat(root), { code: 'ENOENT' });
});
