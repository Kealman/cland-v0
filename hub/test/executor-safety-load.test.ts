// T4: two lanes of five repeat the T2 foreign-lease case under owned CPU load.
// Run through cland verify: the package runner holds the machine lease.
import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { foreignLeaseCase, receipt } from './executor-safety-case.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tempProject } from './harness.ts';

test('foreign live leases settle 10/10 at two workers under CPU load', { concurrency: 2 }, async t => {
  const root = await tempProject(t, 'foreign-lease-load-');
  const state = new Int32Array(new SharedArrayBuffer(8));
  const load = new Worker(`const { parentPort, workerData } = require('node:worker_threads');
const state = new Int32Array(workerData);
parentPort.postMessage('ready');
while (!Atomics.load(state, 0)) {
  let sum = 0;
  for (let i = 0; i < 100000; i++) sum += Math.sqrt(i);
  Atomics.add(state, 1, 1);
}`, { eval: true, workerData: state.buffer, env: fixtureEnvironment(root, process.env) });
  const exited = once(load, 'exit');
  void exited.catch(() => {});
  try {
    await receipt('CPU worker ready', once(load, 'message'));
    const completed: string[] = [];
    await Promise.all([0, 1].map(lane => t.test(`lane ${lane + 1}`, async laneTest => {
      for (let repetition = 0; repetition < 5; repetition++) await laneTest.test(`repetition ${repetition + 1}`, async caseTest => {
        const before = Atomics.load(state, 1);
        await foreignLeaseCase(caseTest);
        assert.ok(Atomics.load(state, 1) > before && load.threadId !== -1, 'CPU sibling progressed during this settlement');
        completed.push(`${lane}:${repetition}`);
      });
    })));
    assert.equal(new Set(completed).size, 10, 'all ten cases observed their report and released lease');
    t.diagnostic(`foreign-lease settlements ${completed.length}/10; workers 2; CPU progress in every case; platform ${process.platform}/${process.arch}; executor ${process.env.CLAND_SUITE_EXECUTOR ?? 'local'}; browser none`);
  } finally {
    Atomics.store(state, 0, 1);
    // Termination also covers a worker that never delivered its ready receipt.
    await load.terminate();
    await exited;
  }
});
