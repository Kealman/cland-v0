// T1: scripted remote receipts prove log collection across a pending start retry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';

test('pending remote start retains the entire collected receipt log', async t => {
  // This receipt-only scenario has no budget manifest or trailing report section.
  const f = await suiteUnit(t, { executor: 'droplet', durationContext: null });
  const entered = Promise.withResolvers<void>();
  const start = f.machine.dependencies.run.start.bind(f.machine.dependencies.run);
  let attempts = 0;
  t.mock.method(f.machine.dependencies.run, 'start', async (...args: Parameters<typeof start>) => {
    if (++attempts === 1) { entered.resolve(); return; }
    await start(...args);
  });
  const job = await f.launch();
  await f.machine.waits.run(entered.promise);
  await f.suites.settled();
  await f.tick();
  await f.machine.waits.run(f.machine.started(job.id));
  await f.suites.settled();
  const receipt = 'typecheck: host gate at dddddddddddddddddddddddddddddddddddddddd (not repeated)';
  const remoteLog = `${receipt}\n# tests 1\n# pass 1\n`;
  await f.finish(job.id, 0, remoteLog);
  const log = await f.log(job.id);
  assert.equal(attempts, 2);
  assert.ok(log.endsWith(remoteLog), 'pending-start retry must not skip any remote log bytes');
  assert.equal(log.match(/Workers .* admitted\n/g)?.length, 1, 'admission header is emitted once');
});
