// T2: real multi-MB receipt files exercise concurrent admission and store recovery;
// executor receipts stay in-process because no process lifecycle is under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import streams from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { aggregateSuiteLogs, readSuiteEvidence } from '../src/suite-log.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { appendSuiteProvenance } from '../src/suite-provenance.ts';

test('interrupted child disclosures survive aggregation and parent finalization retries', t => {
  const scope = caseDeadlines(t, { timeoutMs: 5000, ownership: { beforeDirectories, guardDirectoryRemoval } });
  return scope.run(async step => {
    const root = await step(() => scope.wait('aggregate disclosure setup', async () => {
      const root = await fs.mkdtemp(join(tmpdir(), 'cland-child-disclosures-'));
      scope.adoptRoot(root); scope.fixtures.after(() => fs.rm(root, { recursive: true, force: true }));
      return root;
    }));
    await step(() => scope.wait('aggregate disclosure behaviour', async () => {
      const parent = join(root, 'parent.log'), first = join(root, 'first.log'), second = join(root, 'second.log');
      const input = { head: 'head', executor: 'droplet' as const };
      await fs.writeFile(parent, 'parent output\n');
      await fs.writeFile(first, 'first child partial'); await fs.writeFile(second, 'second child partial');
      await appendSuiteProvenance(first, { ...input, packageClosure: { state: 'incomplete', nativeExit: 137 } }, '', async () => {});
      await appendSuiteProvenance(second, { ...input, packageClosure: { state: 'incomplete', nativeExit: null } }, '', async () => {});
      const marker = 'machine metrics unavailable: run interrupted before collection; cause: package closure incomplete; foreground exit ';
      assert.ok((await fs.readFile(first, 'utf8')).includes(marker + '137'), 'the child supplied the disclosure before aggregation');
      for (let attempt = 0; attempt < 2; attempt++) {
        await aggregateSuiteLogs(parent, [{ log: first, shardName: 'first' }, { log: second, shardName: 'second' }], 'aggregate complete\n');
        await fs.rename(parent + '.shards.tmp', parent);
        for (let retry = 0; retry < 2; retry++) await appendSuiteProvenance(parent, input, await readSuiteEvidence(parent), async () => {});
        const finalLog = await fs.readFile(parent, 'utf8');
        assert.ok(finalLog.includes('--- first ---\nfirst child partial\n' + marker + '137'));
        assert.ok(finalLog.includes('--- second ---\nsecond child partial\n' + marker + 'unknown'));
        assert.equal(finalLog.split(marker).length - 1, 2, 'one disclosure per child across both retry boundaries');
        assert.equal(finalLog.split('suite provenance ').length - 1, 1, 'one parent provenance footer');
      }
    }));
  });
});

for (const commandOnly of [false, true]) test(`stall ${commandOnly ? 'command state without census' : 'census'} survives semantic retention and capped reporting after command noise`, async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'cland-stall-evidence-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const path = join(root, 'suite.log');
  const census = { commandPid: 40001, total: 32, processes: Array.from({ length: 32 }, (_, i) => ({ pid: 40001 + i, name: `worker-${i}` })) };
  const record = `suite stall processes ${JSON.stringify(census)}`;
  const state = 'suite stall command {"commandPid":40001,"exit":{"code":0,"signal":null},"stdout":"open","stderr":"open"}';
  await fs.writeFile(path, ['suite command start {"id":"test","name":"T2","line":"fake command"}',
    state, ...(commandOnly ? [] : [record]), ...Array.from({ length: 40 }, () => 'later output '.repeat(40)), 'suite command end test 1'].join('\n'));
  const evidence = await readSuiteEvidence(path);
  assert.ok(evidence.split('\n').includes(state));
  const retained = evidence.split('\n').find(line => line.startsWith('suite stall processes '));
  assert.equal(retained, commandOnly ? undefined : record);
  if (!commandOnly) assert.deepEqual(JSON.parse(retained!.slice('suite stall processes '.length)), census);
  assert.match(suiteSummary(evidence, [], { logArtifact: 'A-1', priorityOnly: true }), /stall process detail: log A-1/);
});

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

test('cached and stage admissions share derived evidence from several 20 MB logs', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('isolated stage setup', () => suiteUnit(run.fixtures, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true }));
  await run.wait('cached and stage proof receipts', async () => {
    f.candidate.branch = 'dev';
    f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
    const first = await f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true });
    await f.machine.started(first.id);
    await f.finish(first.id);
    const original = (await f.suites.receipt(first.id)).job;
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      const path = join(f.root, `stage-${i}.log`);
      const file = await fs.open(path, 'w');
      const noise = ('x'.repeat(1023) + '\n').repeat(1024);
      try { for (let mb = 0; mb < 20; mb++) await file.write(noise); }
      finally { await file.close(); }
      await fs.appendFile(path, 'suite timing {"file":"hub/test/example.test.ts","name":"old","seconds":0.1}\n# tests 1\n# pass 1\n');
      const artifact = f.store.registerArtifact(id => ({ id, title: `Stage ${i}`, kind: 'file', path, creator: 'hub', time: f.clock.now().toISOString(), topic: 'unit-topic', status: 'shared' }), () => {});
      const job = { ...original, sequence: i, id: `stage-${i}`, artifact: artifact.id, log: path, occasion: 'stage' as const };
      delete job.cached;
      delete job.timingIdentities;
      jobs.push(job);
    }
    await f.reopen(jobs);
    const paths = new Set(jobs.map(job => job.log)), reads = new Map<string, number>();
    let peakHeap = process.memoryUsage().heapUsed;
    const before = peakHeap;
    const readFile = fs.readFile, createReadStream = streams.createReadStream;
    t.mock.method(fs, 'readFile', (async (...args: Parameters<typeof fs.readFile>) => {
      assert.ok(!paths.has(String(args[0])), 'admission never decodes the whole source log');
      return readFile(...args);
    }) as typeof fs.readFile);
    t.mock.method(streams, 'createReadStream', (...args: Parameters<typeof streams.createReadStream>) => {
      const path = String(args[0]), stream = createReadStream(...args);
      if (paths.has(path)) {
        reads.set(path, (reads.get(path) ?? 0) + 1);
        stream.on('data', () => { peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed); });
      }
      return stream;
    });
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
    for (let i = 0; i < jobs.length; i++) {
      await f.reopen(jobs.slice(0, i + 1));
      const callers = await Promise.all(Array.from({ length: 6 }, () => f.launch({ mode: 'all', integrated: true, occasion: 'epic' })));
      for (const caller of callers) {
        assert.equal(caller.cached?.run, jobs[i]!.id);
        assert.deepEqual(f.status(caller.id).selection?.loadGateBaseline, { run: jobs[i]!.id, tests: ['hub/test/example.test.ts::old'] });
      }
      await f.suites.settled();
    }
    const observed = [...reads.values()];
    const repeat = await Promise.all(Array.from({ length: 6 }, () => f.launch({ mode: 'all', integrated: true, occasion: 'epic' })));
    // Drive the next scheduler inspection after concurrent cached admissions.
    await f.tick();
    await Promise.all(repeat.map(job => f.result(job.id)));
    assert.deepEqual([...reads.values()], observed, 'repeated admissions reuse stage and cached reporting evidence');
    await f.reopen();
    const dry = await f.suites.start({ mode: 'all', cwd: f.root, topic: 'unit-topic', to: [], actor: null, integrated: true, occasion: 'epic', dryRun: true }, () => {});
    assert.ok('dryRun' in dry);
    assert.deepEqual(dry.selection.loadGateBaseline, { run: jobs[2]!.id, tests: ['hub/test/example.test.ts::old'] });
    assert.deepEqual([...reads.values()], observed, 'stage identities survive store reopen');
    assert.ok([...reads.values()].every(count => count === 2), `one stage scan and one shared reporting scan: ${JSON.stringify([...reads])}`);
    assert.equal(reads.size, 3);
    assert.ok(peakHeap - before < 96 * 1024 * 1024, `heap growth ${peakHeap - before} stays below concurrent whole-log copies`);
  });
});


test('command excerpts and sequential shard copying bound heap on 50 MB output', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'suite-log-stream-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = join(root, 'command.log'), parent = join(root, 'parent.log');
  const noise = 'x'.repeat(1024 * 1024);
  const start = 'suite command start {"id":"test-1","name":"test","line":"test-command"}\n';
  const tail = Array.from({ length: 25 }, (_, i) => `assertion ${i + 1}`);
  const end = '\n' + tail.join('\n') + '\n\n'.repeat(30) + 'suite command end test-1 7\n';
  const file = await fs.open(source, 'w');
  try {
    await file.write(start);
    for (let mb = 0; mb < 50; mb++) await file.write(noise);
    await file.write(end);
  } finally { await file.close(); }
  let peakHeap = process.memoryUsage().heapUsed, active = 0, peakStreams = 0;
  const before = peakHeap, createReadStream = streams.createReadStream, readFile = fs.readFile;
  t.mock.method(fs, 'readFile', (async (...args: Parameters<typeof fs.readFile>) => {
    assert.ok(![source, parent].includes(String(args[0])), 'large output and parent logs must be streamed');
    return readFile(...args);
  }) as typeof fs.readFile);
  t.mock.method(streams, 'createReadStream', (...args: Parameters<typeof streams.createReadStream>) => {
    const stream = createReadStream(...args);
    if (String(args[0]) === source) {
      peakStreams = Math.max(peakStreams, ++active);
      stream.once('end', () => { active--; });
      stream.on('data', () => { peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed); });
    }
    return stream;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const evidence = await readSuiteEvidence(source);
  assert.equal(suiteSummary(evidence), `test exited 7: test-command\nFailures:\n${tail.slice(5).join('\n')}`);
  assert.ok(Buffer.byteLength(evidence) < 4096, 'only the last 20 bounded output lines survive');
  const suffix = 'not ok 1 - broken\ntier T2: exit 1\n';
  await fs.appendFile(source, suffix);
  await fs.writeFile(parent, 'Header\n--- close shards ---\nprevious partial aggregation\n');
  await aggregateSuiteLogs(parent, [{ log: source, shardName: 'shard-1' }, { log: source, shardName: 'shard-2' }], 'Footer\n');
  const expected = createHash('sha256');
  expected.update('Header\n\n--- close shards ---\n');
  for (const shard of ['shard-1', 'shard-2']) {
    expected.update(`--- ${shard} ---\n` + start);
    for (let mb = 0; mb < 50; mb++) expected.update(noise);
    expected.update(end + `not ok 1 - broken [${shard}]\n${shard} tier T2: exit 1\n\n`);
  }
  expected.update('Footer\n');
  const actual = createHash('sha256');
  for await (const chunk of streams.createReadStream(parent + '.shards.tmp')) actual.update(chunk);
  assert.equal(actual.digest('hex'), expected.digest('hex'), 'all output bytes survive with failure/tier labels and the old aggregation removed');
  assert.equal(peakStreams, 1, 'shard logs are copied sequentially');
  assert.ok(peakHeap - before < 96 * 1024 * 1024, `heap growth ${peakHeap - before} is below two whole shard logs`);
  t.diagnostic(`50 MB command and two shards: peak heap growth ${peakHeap - before} bytes; peak source streams ${peakStreams}`);
});
