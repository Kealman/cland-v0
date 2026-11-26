// T2: whole-case ownership with injected time and in-memory phase work only.
import assert from 'node:assert/strict';
import { mergeTest as test } from './merge-case.ts';
import { casePhases } from './case-phase-recorder.ts';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { phase, phaseSync, phaseTests } from './case-phase-fixture.ts';
import type { TestContext } from 'node:test';

test('phase receipts count completions and failures without retaining per-operation history', async t => {
  await fixtureNativeGuard(t);
  let time = 0;
  const phases = casePhases(() => time);
  for (let i = 0; i < 100; i++) await phases.measure('setup', async () => { time += 2; });
  const failure = new Error('controlled phase failure');
  await assert.rejects(phases.measure('launch', async () => { time += 3; throw failure; }), error => error === failure);
  assert.deepEqual(phases.snapshot(), [
    { phase: 'setup', calls: 100, completed: 100, failed: 0, milliseconds: 200 },
    { phase: 'launch', calls: 1, completed: 0, failed: 1, milliseconds: 3 },
  ]);
});

test('phase receipts retain pending work and independent concurrent recorders', async t => {
  await fixtureNativeGuard(t);
  let time = 0;
  const phases = casePhases(() => time), other = casePhases(() => time);
  const release = Promise.withResolvers<void>();
  const work = phases.measure('completion', () => release.promise);
  assert.deepEqual(phases.snapshot(), [{ phase: 'completion', calls: 1, completed: 0, failed: 0, milliseconds: 0 }]);
  assert.deepEqual(other.snapshot(), []);
  time = 7; release.resolve(); await work;
  assert.deepEqual(phases.snapshot(), [{ phase: 'completion', calls: 1, completed: 1, failed: 0, milliseconds: 7 }]);
});

test('case phase wrapper preserves failure identity and reports after fixture hooks', async t => {
  await fixtureNativeGuard(t);
  const hooks: Array<() => unknown> = [], diagnostics: string[] = [];
  const context = { name: 'controlled case', after: (hook: () => unknown) => hooks.push(hook),
    diagnostic: (line: string) => diagnostics.push(line) } as unknown as TestContext;
  const base = (async (_name: string, body: (t: TestContext) => Promise<void>) => body(context)) as Parameters<typeof phaseTests>[0];
  const failure = new Error('controlled body failure');
  let closed = false;
  let syncCalls = 0;
  await assert.rejects(phaseTests(base, 'controlled.test.ts')('controlled case', async t => {
    t.after(() => { closed = true; });
    await phase('setup', async () => {});
    assert.equal(phaseSync('git', () => { syncCalls++; return undefined; }), undefined);
    throw failure;
  }), error => error === failure);
  assert.equal(diagnostics.length, 0);
  for (const hook of hooks) await hook();
  assert.equal(closed, true);
  assert.equal(syncCalls, 1);
  assert.equal(diagnostics.length, 1);
  const receipt = JSON.parse(diagnostics[0]!.slice('case phases '.length));
  assert.equal(receipt.outcome, 'failed');
  assert.equal(receipt.importCompileMilliseconds, null);
  assert.equal(receipt.phases[0].completed, 1);
  // Outside a case scope, callers keep their original result with no logging.
  assert.equal(await phase('launch', async () => 42), 42);
  assert.equal(diagnostics.length, 1);
});
