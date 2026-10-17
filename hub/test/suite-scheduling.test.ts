// T1: scheduler arbitration at Suites with fake local executor receipts.
// Cross-process compatibility fencing stays in suite-runner-contract.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';

for (const budget of [1, 2]) test(`verify queues a second requester without a waiting worker (configured budget ${budget})`, async t => {
  const f = await suiteUnit(t, { budget });
  const first = await f.launch(); const second = await f.launch();
  assert.equal(second.pid, null); assert.equal(second.position, 1);
  assert.deepEqual([...f.delivered.keys()], [first.id], 'queued requester owns no worker');
  if (budget === 2) assert.ok(f.logs.some(e => e.event === 'verification-budget-capped' && e.configured === 2 && e.effective === 1 && String(e.reason).includes('T-215')));
  await f.finish(first.id);
  await f.when(() => f.delivered.has(second.id) ? true : undefined);
  await f.finish(second.id);
  assert.deepEqual(f.reports.map(r => r.id), [first.id, second.id]);
});

test('a dead queued requester is cancelled with one posted note even after its role is vacated', async t => {
  const f = await suiteUnit(t);
  const green = await f.launch(); await f.finish(green.id);
  f.hold(true);
  const dead = await f.launch({ fresh: true, actor: { name: 'doomed', sessionId: 'doomed-id', shell: true } });
  f.suites.requesterExited('doomed-id');
  assert.match((await f.result(dead.id)).outcome!.cause, /cancelled: requester died before admission/);
  assert.deepEqual(f.reports.find(j => j.id === dead.id)!.to, ['reviewer']);
  await f.reopen();
  await f.tick();
  assert.equal(f.reports.filter(r => r.id === dead.id).length, 1);
  const hit = await f.launch(); assert.equal(hit.cached?.run, green.id); await f.result(hit.id);
});

test('priority admits integrated dev first, then item rank, preserving the queue through restart', async t => {
  const f = await suiteUnit(t);
  f.hold(true);
  const low = await f.launch({ priority: 100 });
  const high = await f.launch({ priority: 1 });
  f.candidate.branch = 'dev';
  const integrated = await f.launch({ integrated: true });
  const order = [integrated.id, high.id, low.id];
  assert.deepEqual(f.suites.snapshot().waiters.map(w => w.id), order);
  assert.ok([low, high, integrated].every(j => j.pid === null));
  await f.reopen(); assert.equal(f.suites.status().filter(j => j.state === 'queued').length, 3);
  assert.deepEqual(f.suites.snapshot().waiters.map(w => w.id), order);
  f.hold(false); await f.tick();
  for (const id of order) {
    await f.when(() => f.delivered.has(id) ? true : undefined);
    assert.equal(f.suites.status().filter(j => j.state === 'running').length, 1);
    assert.equal(f.status(id).head, f.candidate.head);
    assert.equal(f.suites.snapshot().holder?.id, id);
    await f.finish(id);
  }
  assert.deepEqual(f.reports.map(r => r.id), order);
  assert.ok(f.reports.every(j => j.head === f.candidate.head));
});

test('a queued request cannot pass for a different head after its worktree advances', async t => {
  const f = await suiteUnit(t);
  f.hold(true); const job = await f.launch(); const head = f.candidate.head;
  assert.equal(job.pid, null);
  f.candidate.head = 'b'.repeat(40); f.hold(false); await f.tick();
  await f.when(() => f.status(job.id).outcome ?? undefined); await f.tick();
  const result = await f.result(job.id);
  assert.match(result.outcome!.cause, /queued head changed/); assert.ok(result.outcome!.cause.includes(head)); assert.equal(result.outcome!.code, 1);
  assert.equal(f.delivered.size, 0, 'candidate worker must never start'); assert.equal(f.reports.length, 1);
});
