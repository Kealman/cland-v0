// T3: native bare-PID existence remains a signal-0 probe with no identity subprocess.
// Lifecycle: disposable root/environment; the positive-controlled spawn guard refuses every child.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { localHost } from '../src/host/local.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('local Host bare-PID liveness reads existence without identity subprocess work', async t => {
  const root = await tempProject(t);
  const spawns = t.mock.method(cp, 'spawn', () => { throw new Error('unexpected native identity subprocess'); });
  syncBuiltinESMExports();
  t.after(() => { spawns.mock.restore(); syncBuiltinESMExports(); });
  // cland-allow-child-env: positive control throws at the installed spawn guard; no native child executes
  assert.throws(() => cp.spawn('fixture-positive-control'), /unexpected native identity subprocess/);
  spawns.mock.resetCalls();
  const host = localHost(fixtureEnvironment(root, process.env));
  assert.equal(await host.alive({ pid: process.pid }), true, 'observe the test process with signal 0 only');
  assert.equal(await host.alive({ pid: null }), false);
  assert.equal(spawns.mock.callCount(), 0, 'no birth identity is compared for an existence-only request');
});
