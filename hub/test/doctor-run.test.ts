// T2: probe cleanup deadlines at a mocked native child-process boundary, with a fake clock.
// No native process starts; the global child_process mock is outside the T1 source guard.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { run, type RunResult } from '../src/doctor/report.ts';

function fakeProbe(t: TestContext) {
  const child = Object.assign(new EventEmitter(), { pid: 42, stdout: new PassThrough(), stderr: new PassThrough(), kill() { return true; } });
  const signals: Array<[number, NodeJS.Signals | number | undefined]> = [];
  t.mock.method(cp, 'spawn', () => child as unknown as cp.ChildProcess);
  t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => { signals.push([pid, signal]); return true; });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  t.mock.timers.enable({ apis: ['setTimeout', 'setImmediate'] });
  return { child, signals };
}

test('a probe whose close never arrives reports bounded incomplete cleanup after SIGKILL', async t => {
  const { child, signals } = fakeProbe(t);
  let result: RunResult | undefined;
  const observed = (): RunResult | undefined => result;
  const pending = run('synthetic-probe', [], {}, 100).then(r => { result = r; });
  t.mock.timers.tick(100);
  assert.deepEqual(signals, [[-42, 'SIGKILL']], 'the deadline forcibly terminates the owned group');
  assert.equal(child.stdout.destroyed, true);
  assert.equal(child.stderr.destroyed, true);
  assert.equal(observed(), undefined, 'signalling and pipe destruction alone are not close');
  t.mock.timers.tick(1000);
  t.mock.timers.tick(0);
  await Promise.resolve();
  const receipt = observed();
  assert.ok(receipt, 'forced cleanup must produce its bounded failure receipt even when close never arrives');
  await pending;
  assert.deepEqual(receipt, { code: null, stdout: '', stderr: '', error: 'no answer within 0.1 s; cleanup incomplete: child did not close within 1 s of SIGKILL' });
  child.emit('close', null);
  t.mock.timers.tick(0);
  assert.equal(observed(), receipt, 'a late close cannot rewrite the failure receipt');
});

test('a probe error starts its own close bound without waiting for the answer deadline', async t => {
  const { child, signals } = fakeProbe(t);
  let result: RunResult | undefined;
  const observed = (): RunResult | undefined => result;
  const pending = run('synthetic-probe', [], {}, 20_000).then(r => { result = r; });
  child.emit('error', new Error('probe failure'));
  assert.deepEqual(signals, [[-42, 'SIGKILL']]);
  t.mock.timers.tick(999);
  await Promise.resolve();
  assert.equal(observed(), undefined, 'an error alone is not close');
  t.mock.timers.tick(1);
  t.mock.timers.tick(0);
  await Promise.resolve();
  const receipt = observed();
  assert.ok(receipt, 'the error cleanup bound ends independently of the 20 s answer deadline');
  await pending;
  assert.deepEqual(receipt, { code: null, stdout: '', stderr: '', error: 'probe failure; cleanup incomplete: child did not close within 1 s of SIGKILL' });
});
