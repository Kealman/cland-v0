// T2: real multi-MB receipt files exercise concurrent admission and store recovery;
// executor receipts stay in-process because no process lifecycle is under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import streams from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { suiteUnit } from './suite-unit-fixture.ts';

test('concurrent admissions stream each retained log once and reuse durable proofs', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true,
    taskLanding: () => ({ tip: f.candidate.head, branch: f.candidate.branch, base: 'dev' }) });
  f.candidate.selection.loadGate = true;
  const first = await f.launch({ item: 'T-1', fresh: true });
  await f.finish(first.id);
  const original = (await f.suites.receipt(first.id)).job;
  const identities = Array.from({ length: 8 }, (_, i) => `hub/test/example.test.ts::retained-${i}`);
  const paths = identities.map((_, i) => join(f.root, `retained-${i}.log`));
  // Ordinary output dominates production logs; proofs can appear anywhere.
  const noise = ('x'.repeat(1023) + '\n').repeat(2048);
  const jobs = [];
  for (const [i, path] of paths.entries()) {
    await fs.writeFile(path, `load gate: ${identities[i]} 5/5 passed\n${noise}load gate: ${identities[i]} 5/5 passed\n`);
    const artifact = f.store.registerArtifact(id => ({ id, title: `Retained ${i}`, kind: 'file', path,
      creator: 'hub', time: f.clock.now().toISOString(), topic: 'unit-topic', status: 'shared' }), () => {});
    // Exercise both durable artifact lookup and legacy worker-log fallback.
    const job = { ...original, id: `retained-${i}`, log: i % 2 ? path : `${path}.removed`, artifact: i % 2 ? null : artifact.id };
    delete job.loadProofs;
    jobs.push(job);
  }
  await f.reopen(jobs);
  f.hold(true);
  const reads = new Map(paths.map(path => [path, 0]));
  let wholeReads = 0, activeStreams = 0, peakStreams = 0;
  const readFile = fs.readFile, createReadStream = streams.createReadStream;
  t.mock.method(fs, 'readFile', (async (...args: Parameters<typeof fs.readFile>) => {
    const path = String(args[0]);
    if (reads.has(path)) { reads.set(path, reads.get(path)! + 1); wholeReads++; }
    return readFile(...args);
  }) as typeof fs.readFile);
  t.mock.method(streams, 'createReadStream', (...args: Parameters<typeof streams.createReadStream>) => {
    const path = String(args[0]);
    const stream = createReadStream(...args);
    if (reads.has(path)) {
      reads.set(path, reads.get(path)! + 1);
      peakStreams = Math.max(peakStreams, ++activeStreams);
      let finished = false;
      const finish = () => { if (!finished) { activeStreams--; finished = true; } };
      stream.once('end', finish); stream.once('close', finish);
    }
    return stream;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const admit = async () => {
    const callers = await Promise.all(Array.from({ length: 6 }, () => f.launch({ item: 'T-2', fresh: true })));
    for (const caller of callers) assert.deepEqual(f.status(caller.id).selection?.loadGateKnownTests, identities);
  };
  await admit();
  t.diagnostic(`retained log reads: ${[...reads.values()].join(', ')}; whole-file reads: ${wholeReads}`);
  assert.deepEqual([...reads.values()], paths.map(() => 1), 'concurrent callers share one scan per log');
  assert.equal(wholeReads, 0, 'proof scanning never materializes whole logs');
  assert.equal(peakStreams, 1, 'backfill streams logs sequentially');
  await admit();
  await f.reopen();
  await admit();
  assert.deepEqual([...reads.values()], paths.map(() => 1), 'proofs persist across repeated calls and store reopen');
});
