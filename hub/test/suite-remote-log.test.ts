// T1: scripted remote receipts prove log collection across a pending start retry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { caseDeadlines } from './case-deadlines.ts';

test('pending remote start retains the entire collected receipt log', async t => {
  // The sole trailing section is the shared provenance footer.
  const run = caseDeadlines(t);
  const f = await run.wait('isolated suite setup', () => suiteUnit(run.fixtures, { executor: 'droplet', durationContext: null }));
  const entered = Promise.withResolvers<void>();
  const start = f.machine.dependencies.run.start.bind(f.machine.dependencies.run);
  let attempts = 0;
  t.mock.method(f.machine.dependencies.run, 'start', async (...args: Parameters<typeof start>) => {
    if (++attempts === 1) { entered.resolve(); return; }
    await start(...args);
  });
  const job = await run.wait('admitted suite', () => f.launch());
  await run.wait('first pending start', () => f.machine.waits.run(entered.promise));
  await run.wait('scheduler settled', () => f.suites.settled());
  await run.wait('retry start', () => f.tick());
  await run.wait('started machine', () => f.machine.waits.run(f.machine.started(job.id)));
  await run.wait('scheduler settled', () => f.suites.settled());
  const receipt = 'typecheck: host gate at dddddddddddddddddddddddddddddddddddddddd (not repeated)';
  const remoteLog = `${receipt}\n# tests 1\n# pass 1\n`;
  await run.wait('reported completion', () => f.finish(job.id, 0, remoteLog));
  const log = await run.wait('finalized log', () => f.log(job.id));
  assert.equal(attempts, 2);
  const footerStart = log.lastIndexOf('\nsuite provenance ');
  assert.ok(footerStart >= 0, 'final provenance record observed');
  assert.ok(log.slice(0, footerStart).endsWith(remoteLog), 'pending-start retry must not skip any remote log bytes');
  assert.equal(log.split('suite provenance ').length - 1, 1, 'one terminal footer');
  const footer = JSON.parse(log.slice(footerStart + '\nsuite provenance '.length));
  assert.equal(footer.head, f.candidate.head);
  assert.equal(footer.executor, 'droplet');
  assert.equal(log.match(/Workers .* admitted\n/g)?.length, 1, 'admission header is emitted once');
});
