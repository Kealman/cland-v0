// T3: scratch filesystem copies and a native Python analyzer; pre-owned bounded hub/scheduler and native PID controls drain before Store/root cleanup.
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import type { Suites as SuiteScheduler } from '../src/hub/suites.ts';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyTree, swapPercent, physicalFootprint, prepareCopy } from './measure-memory.ts';
import { ownDirectory } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { checkDurations, readDurationManifest } from '../src/suite-durations.ts';

test('memory copy excludes secret-shaped entries and symlinks and sparsifies bodies', async t => {
  const root = await mkdtemp(join(tmpdir(), 'memory-copy-'));
  ownDirectory(t, root);
  await mkdir(join(root, 'source'));
  await writeFile(join(root, 'source', 'body'), 'message content');
  await writeFile(join(root, 'source', 'secrets.toml'), 'never copy');
  await symlink(join(root, 'source', 'secrets.toml'), join(root, 'source', 'link'));
  const result = await copyTree(join(root, 'source'), join(root, 'target'), true);
  assert.deepEqual(result, { files: 1, bytes: 15 });
  assert.equal((await stat(join(root, 'target', 'body'))).size, 15);
  assert.deepEqual(await readFile(join(root, 'target', 'body')), Buffer.alloc(15));
  await assert.rejects(stat(join(root, 'target', 'secrets.toml')), { code: 'ENOENT' });
  await assert.rejects(stat(join(root, 'target', 'link')), { code: 'ENOENT' });
});

test('swap receipt handles units, zero allocation and invalid output explicitly', () => {
  assert.equal(swapPercent('total = 100.00M  used = 81.00M free = 19.00M'), 81);
  assert.equal(swapPercent('total = 2.00G  used = 1024.00M'), 50);
  assert.equal(swapPercent('total = 0.00M  used = 0.00M'), 0);
  assert.throws(() => swapPercent('unavailable'), /unusable/);
});

test('offline dominators exclude weak edges and preserve shared ownership', async t => {
  const root = await mkdtemp(join(tmpdir(), 'memory-graph-'));
  ownDirectory(t, root);
  const snapshot = { meta: { node_fields: ['type', 'name', 'self_size', 'edge_count'], node_types: [['synthetic', 'object', 'string']], edge_fields: ['type', 'name_or_index', 'to_node'], edge_types: [['property', 'weak']] } };
  // Root -> Owner and Shared; Owner -> Private and Shared and weakly -> Unreachable.
  const nodes = [0, 0, 0, 2, 1, 1, 10, 3, 1, 2, 20, 0, 1, 3, 30, 0, 2, 4, 900, 0];
  const edges = [0, 1, 4, 0, 3, 12, 0, 2, 8, 0, 3, 12, 1, 4, 16];
  const path = join(root, 'input.heapsnapshot');
  await writeFile(path, JSON.stringify({ snapshot }).slice(0, -1) + ',\n"nodes":' + JSON.stringify(nodes) + ',\n"edges":' + JSON.stringify(edges) + ',\n"strings":' + JSON.stringify(['root', 'Owner', 'Private', 'Shared', ']']) + '}');
  const result = JSON.parse(execFileSync('python3', [new URL('./analyze-memory.py', import.meta.url).pathname, path], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000 }));
  assert.equal(result.reachable, 4);
  assert.equal(result.topTen.find((row: { name: string }) => row.name === 'Owner').retainedBytes, 30);
  assert.equal(result.topTen.find((row: { name: string }) => row.name === 'Shared').dominators[0].index, 0);
  assert.equal(result.topTen.some((row: { selfBytes: number }) => row.selfBytes === 900), false);
});

test('offline analyzer reads a real V8 snapshot and finds an owned large array', async t => {
  // Replay assertion-passing Linux c-8 samples A-14575 and A-14539 through the
  // shipped gate; native ownership assertions below remain the actual proof.
  const manifest = await readDurationManifest(new URL('../../', import.meta.url).pathname);
  assert.ok(manifest);
  for (const seconds of [5.133541762, 5.283094746]) {
    assert.deepEqual(checkDurations([{
      file: 'hub/test/measure-memory.test.ts',
      name: 'offline analyzer reads a real V8 snapshot and finds an owned large array', seconds,
    }], manifest).failures, []);
  }
  const root = await mkdtemp(join(tmpdir(), 'memory-native-'));
  ownDirectory(t, root);
  const path = join(root, 'native.heapsnapshot');
  execFileSync(process.execPath, ['--input-type=module', '-e', `import { writeHeapSnapshot } from 'node:v8'; globalThis.holder = new class MemoryProbeHolder { payload = new Array(100000).fill(42); }; writeHeapSnapshot(process.argv[1]);`, path], { env: fixtureEnvironment(root, process.env), timeout: 15_000 });
  const result = JSON.parse(execFileSync('python3', [new URL('./analyze-memory.py', import.meta.url).pathname, path], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 30_000 }));
  assert.ok(result.nodes > 1000);
  assert.ok(result.topTen.some((row: { name: string; retainedBytes: number }) => row.name === 'MemoryProbeHolder' && row.retainedBytes >= 800000));
});

for (const mode of ['normal', 'omitted', 'aborted', 'held', 'write-failure', 'disconnect', 'final-reading-failure'] as const) {
  test(`owned memory producer drains ${mode} setup before native receipt and root removal`, async t => {
    const { memoryProducer } = await import('./memory-producer.ts');
    const root = await mkdtemp(join(tmpdir(), 'memory-stop-'));
    const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
      '--run', '--worker', '--control', '--source', root, '--root', root,
      ...(mode === 'omitted' ? ['--control-omit-ready'] : []),
      ...(mode === 'held' ? ['--control-held'] : []),
      ...(mode === 'write-failure' ? ['--control-write-failure'] : []),
      ...(mode === 'final-reading-failure' ? ['--control-final-reading-failure'] : [])]);
    const remove = ownDirectory(t, root, { beforeRemove: producer.dispose });
    const child = producer.start();
    if (mode === 'aborted') {
      const cancel = new AbortController();
      const observation = producer.ready(cancel.signal);
      await producer.started();
      cancel.abort(new Error('injected abandoned setup'));
      await assert.rejects(observation, /abandoned setup/);
    } else if (mode === 'held') await producer.acquiring();
    else if (mode === 'omitted') { void producer.ready(); await producer.started(); }
    else await producer.ready();
    if (mode === 'disconnect') child.disconnect();
    if (mode === 'write-failure' || mode === 'disconnect') await producer.join(5000).catch(error => { throw new Error(`${error.message}; ${producer.tail()}`); });
    await producer.dispose();
    const native = await producer.native;
    assert.equal(producer.forced(), false, producer.tail());
    assert.equal(native.rootPresent, true);
    assert.equal(native.signal, null);
    const outcome = JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8'));
    assert.equal(outcome.stopped, true, producer.tail());
    if (mode === 'final-reading-failure') assert.equal(outcome.finalSystem.unavailable, 'final system reading failed');
    if (mode === 'write-failure') { assert.equal(outcome.outcome, 'incomplete'); assert.ok(outcome.writeFailures.length); }
    else assert.ok(['guard-stopped', 'incomplete'].includes(outcome.outcome));
    assert.ok((await stat(root)).isDirectory());
    await remove();
    await assert.rejects(stat(root), { code: 'ENOENT' });
  });
}

test('sampling analysis assigns only new surviving sample ordinals to each stage', async t => {
  const root = await mkdtemp(join(tmpdir(), 'memory-samples-'));
  ownDirectory(t, root);
  await writeFile(join(root, 'boundaries.jsonl'), [{ ordinal: 0, boundary: 'before', ms: 0 }, { ordinal: 1, boundary: 'after', ms: 1 }].map(row => JSON.stringify(row)).join('\n'));
  const head = { id: 1, callFrame: { functionName: 'allocate', url: 'file:///fixture/owner.ts', lineNumber: 7, columnNumber: 2 }, children: [] };
  await writeFile(join(root, 'stage-0.heapprofile'), JSON.stringify({ head, samples: [{ ordinal: 1, nodeId: 1, size: 100 }] }));
  await writeFile(join(root, 'stage-1.heapprofile'), JSON.stringify({ head, samples: [{ ordinal: 1, nodeId: 1, size: 100 }, { ordinal: 2, nodeId: 1, size: 200 }] }));
  const result = JSON.parse(execFileSync('python3', [new URL('./analyze-memory.py', import.meta.url).pathname, '--profiles', root], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000 }));
  assert.equal(result.stages[0].sampledNewBytes, 100);
  assert.equal(result.stages[1].sampledNewBytes, 200);
  assert.equal(result.stages[1].topSites[0].stack[0].line, 8);
});

test('native diagnostic capture redacts a bearer split between writes before persistence', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-redact-'));
  const producer = memoryProducer(t, root, ['-e', "process.stdout.write('Bearer SYNTHETIC_');setImmediate(()=>process.stdout.end('PRIVATE_VALUE\\n'));if(process.connected)process.disconnect()"]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.join(5000); await producer.dispose();
  const receipt = JSON.parse(await readFile(join(root, 'supervisor-outcome.json'), 'utf8'));
  assert.match(receipt.diagnosticTail, /redacted/);
  assert.doesNotMatch(receipt.diagnosticTail, /SYNTHETIC_|PRIVATE_VALUE/);
});

// The failure is released by the positive native-close receipt, after closure
// starts but before the owning write observer has settled.
test('supervisor outcome includes a held write rejected during native drainage', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-late-write-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname, '--run', '--worker', '--control', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  const held = Promise.withResolvers<void>();
  producer.own(held.promise);
  const release = producer.native.then(async () => {
    await writeFile(join(root, 'late-write-release.json'), JSON.stringify({ nativeClosed: true }));
    held.reject(new Error('held write rejected after native close'));
  });
  producer.close(() => release);
  producer.start(); await producer.ready(); await producer.dispose();
  const receipt = JSON.parse(await readFile(join(root, 'supervisor-outcome.json'), 'utf8'));
  assert.equal(receipt.incomplete, true);
  assert.deepEqual(receipt.writeFailures, ['owned write failed']);
  assert.equal((await producer.native).code, 0);
  assert.ok((await stat(root)).isDirectory());
});

test('streamed startup publishes selected journal records and exact shared input bytes before tracker', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-streamed-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname, '--run', '--worker', '--control', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  await mkdir(join(root, '.cland'));
  const input = '{"event":"send"}\nnot-json\n{"event":"subagent-launched","parent":"synthetic-parent","id":"synthetic-child","model":"fixture"}\n';
  await writeFile(join(root, '.cland/journal.jsonl'), input);
  producer.start(); await producer.ready(); await producer.dispose();
  const rows = (await readFile(join(root, 'boundaries.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const selected = rows.find(row => row.boundary === 'journal-selection-complete');
  assert.ok(selected, producer.tail());
  assert.equal(selected.records, 1);
  assert.equal(selected.bytes, Buffer.byteLength(input));
  assert.ok(selected.peakBufferedBytes > 0);
  assert.ok(selected.ordinal < rows.find(row => row.boundary === 'before-tracker').ordinal);
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).stopped, true);
  assert.equal((await producer.native).code, 0);
});

test('sealed rest phase records both boundary receipts and timed samples before successful native close', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-rest-'));
  const producer = memoryProducer(t, root, ['--heap-prof', `--heap-prof-dir=${root}`,new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--rest-seconds', '0.1', '--sample-ms', '20', '--heap-budget-mib', '0.000001', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start();
  await producer.ready();
  await producer.join(5000);
  await producer.dispose();
  const rows = (await readFile(join(root, 'boundaries.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(rows.find(row => row.boundary === 'rest-start'));
  assert.ok(rows.find(row => row.boundary === 'rest-end'));
  const samples = (await readFile(join(root, 'samples.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(samples.filter(row => row.phase === 'rest').length >= 2);
  assert.ok(samples.every(row => typeof row.heapUsed === 'number' && typeof row.rss === 'number'));
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).outcome, 'complete');
  const budget = JSON.parse(await readFile(join(root, 'memory-budget.json'), 'utf8'));
  assert.equal(budget.mode, 'report');
  assert.equal(budget.rest.heap.status, 'over');
  assert.equal(budget.readiness.heap.status, 'over');
  assert.equal(budget.rest.rss.status, 'within');
  assert.equal(budget.rest.rss.budget, 768 * 1024 * 1024);
  const profile = JSON.parse(await readFile(join(root, `stage-${rows.find(row => row.boundary === 'rest-end').ordinal}.heapprofile`), 'utf8'));
  assert.ok(profile.head);
  assert.equal((await producer.native).code, 0);
});

test('sampling analysis reports surviving sites as well as new allocations', async t => {
  const root = await mkdtemp(join(tmpdir(), 'memory-survivors-'));
  ownDirectory(t, root);
  await writeFile(join(root, 'boundaries.jsonl'), [{ ordinal: 0, boundary: 'rest-start', ms: 0 }, { ordinal: 1, boundary: 'rest-end', ms: 100 }].map(row => JSON.stringify(row)).join('\n'));
  const head = { id: 1, callFrame: { functionName: 'owner', url: 'file:///fixture/owner.ts', lineNumber: 0, columnNumber: 0 }, children: [] };
  await writeFile(join(root, 'stage-0.heapprofile'), JSON.stringify({ head, samples: [{ ordinal: 1, nodeId: 1, size: 100 }] }));
  await writeFile(join(root, 'stage-1.heapprofile'), JSON.stringify({ head, samples: [{ ordinal: 1, nodeId: 1, size: 100 }, { ordinal: 2, nodeId: 1, size: 200 }] }));
  const result = JSON.parse(execFileSync('python3', [new URL('./analyze-memory.py', import.meta.url).pathname, '--profiles', root], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000 }));
  assert.equal(result.stages[1].sampledSurvivingBytes, 300);
  assert.equal(result.stages[1].survivingSites[0].sampledBytes, 300);
});

test('memory budget comparison is report only and distinguishes missing limits and readings', async () => {
  const { memoryBudgetReport } = await import('./memory-budget.ts');
  const report = memoryBudgetReport({ heapUsed: 200, rss: 300 }, null, { heap: 100, rss: 400 });
  assert.equal(report.mode, 'report');
  assert.equal(report.readiness.heap.status, 'over');
  assert.equal(report.readiness.rss.status, 'within');
  assert.equal(report.rest.heap.status, 'unavailable');
  assert.equal(memoryBudgetReport({ heapUsed: 200, rss: 300 }, null, {}).readiness.heap.status, 'unconfigured');
});


test('physical footprint reads the current value and rejects missing native facts', () => {
  assert.equal(physicalFootprint('Physical footprint: 1.5G\nPhysical footprint (peak): 2G'), 1610612736);
  assert.equal(physicalFootprint('Physical footprint: 100B'), 100);
  assert.throws(() => physicalFootprint('Physical footprint (peak): 2G'), /unusable/);
});

test('sealed streaming phase persists six fake-run results through production suite collection', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-streaming-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--rest-seconds', '0.1', '--stream-runs', '6', '--sample-ms', '20', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(8000); await producer.dispose();
  const receipt = JSON.parse(await readFile(join(root, 'streaming.json'), 'utf8'));
  assert.equal(receipt.runs, 6);
  assert.equal(receipt.completed, 6);
  assert.ok(receipt.bytes > 0);
  assert.ok(receipt.checkpoints >= 6);
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).outcome, 'complete');
  assert.equal((await producer.native).code, 0);
});

test('copied probe seals unfinished suite capabilities and preserves finished history before readiness', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const { processIdentityAsync } = await import('../src/process-identity.ts');
  const { processStartedAsync } = await import('../src/hub/lock.ts');
  const lifetime = pacingOwner(t, { setupTimeoutMs: 5000 });
  const sourceOwner = pacingOwner(t), copyOwner = pacingOwner(t);
  const root = await mkdtemp(join(tmpdir(), 'memory-seal-'));
  const source = join(root, 'source'), scratch = join(root, 'scratch');
  await mkdir(join(source, '.cland'), { recursive: true });
  await mkdir(scratch);
  const producer = memoryProducer(t, source, ['-e', `
    process.on('message', message => { if (message.type === 'memory-stop') process.exit(0); });
    process.send({ type: 'memory-started' }); process.send({ type: 'memory-ready' });
  `]);
  ownDirectory(t, root, { beforeRemove: async () => { await lifetime.dispose(); await producer.dispose(); } });
  const child = producer.start();
  await producer.ready();
  assert.ok(child.pid);
  const env = fixtureEnvironment(source, process.env);
  const started = await within(processStartedAsync(child.pid, undefined, undefined, undefined, env), 5000);
  const identity = await within(processIdentityAsync(child.pid, env), 5000);
  assert.ok(started); assert.ok(identity);
  const outside = join(source, 'outside');
  await writeFile(outside, 'untouched');
  const store = sourceOwner.store(join(source, '.cland/hub.db'));
  const job = { id: 'planted', executor: 'local', mode: 'auto', cwd: source, log: outside, result: outside, gate: outside,
    locks: [outside], pid: child.pid, started, lease: { kind: 'local', resource: { identity } }, state: 'running', outcome: null,
    reported: false, cleaned: false, head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: null, error: null };
  const artifact = store.registerArtifact(id => ({ id, title: 'outside copied artifact', kind: 'file', path: outside,
    creator: 'hub', time: new Date().toISOString(), topic: 'general', status: 'shared' }), () => {});
  store.setMeta('suite-jobs', JSON.stringify([job]));
  store.setMeta('suite-job:finished', JSON.stringify({ position: 0, job: { ...job, id: 'finished', artifact: artifact.id, outcome: { code: 0, cause: '' }, reported: true, cleaned: true, state: 'finished' } }));
  store.setMeta('suite-job:legacy-empty', JSON.stringify({ position: 1, job: { ...job, id: 'legacy-empty',
    log: '', result: '', gate: '', state: 'finished', reported: true, cleaned: true,
    outcome: { code: 0, cause: 'legacy completed' } } }));
  await sourceOwner.dispose();
  await within(lifetime.observe(() => prepareCopy(source, scratch)), 5000);
  const copy = copyOwner.store(join(scratch, '.cland/hub.db'));
  assert.equal(copy.suiteJobHistory().length, 2);
  assert.equal(JSON.parse(copy.suiteJobHistory()[0]!).job.artifact, null);
  assert.equal(copy.artifacts().length, 1);
  assert.ok(copy.resolveArtifact(artifact.id)!.path.startsWith(scratch + '/'));
  assert.notEqual(copy.resolveArtifact(artifact.id)!.path, outside);
  assert.equal(copy.meta('suite-jobs')!.includes(outside), false);
  assert.equal(JSON.parse(copy.meta('suite-jobs')!)[0].pid, null);
  await copyOwner.dispose();
  const outsideAccesses: string[] = [];
  for (const method of ['readFile', 'open', 'writeFile', 'appendFile'] as const) {
    const original = fs.promises[method];
    t.mock.method(fs.promises, method, (...args: unknown[]) => {
      if (String(args[0]) === outside) outsideAccesses.push(method);
      return Reflect.apply(original, fs.promises, args);
    });
  }
  for (const method of ['readFileSync', 'openSync', 'writeFileSync', 'appendFileSync', 'createReadStream', 'createWriteStream'] as const) {
    const original = fs[method];
    t.mock.method(fs, method, (...args: unknown[]) => {
      if (String(args[0]) === outside) outsideAccesses.push(method);
      return Reflect.apply(original, fs, args);
    });
  }
  const kill = process.kill;
  t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
    if (Math.abs(pid) === child.pid && signal !== 0) { outsideAccesses.push('signal'); return true; }
    return kill(pid, signal);
  });
  syncBuiltinESMExports();
  t.after(async () => { await lifetime.dispose(); await producer.dispose(); t.mock.restoreAll(); syncBuiltinESMExports(); });
  const hub = await lifetime.start(scratch, {}, realClock);
  await within(lifetime.observe(() => hub.verificationSettled()), 5000);
  await within(lifetime.dispose(), 5000);
  await within(hub.stopped, 5000);
  assert.deepEqual(outsideAccesses, [], 'no native read, write or signal targets the planted outside capability');
  assert.equal(await readFile(outside, 'utf8'), 'untouched');
  assert.equal(await processIdentityAsync(child.pid, env), identity);
  await producer.dispose();
  assert.equal((await producer.native).code, 0);
  assert.deepEqual(outsideAccesses, ['readFile']);
  const manifest = JSON.parse(await readFile(join(scratch, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sealing.finishedHistoryRows, 2);
  assert.equal(manifest.sealing.activeRows, 1);
});

test('isolated scheduler refuses outside recovery before executor restoration and names the job', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { Suites } = await import('../src/hub/suites.ts');
  const { LocalExecutor } = await import('../src/executor/local.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const lifetime = pacingOwner(t);
  let suites: SuiteScheduler | undefined;
  lifetime.close(() => within(suites?.close() ?? Promise.resolve(), 5000));
  const root = await mkdtemp(join(tmpdir(), 'memory-refusal-'));
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const scratch = join(root, 'scratch');
  await mkdir(scratch);
  const outside = join(root, 'outside');
  await writeFile(outside, 'untouched');
  await symlink(root, join(scratch, 'escape'));
  const store = lifetime.store(join(scratch, 'hub.db'));
  const base = { executor: 'local', mode: 'auto', cwd: scratch, log: join(scratch, 'log'), result: join(scratch, 'result'), gate: join(scratch, 'gate'),
    pid: null, started: null, state: 'running', outcome: null, reported: false, cleaned: false,
    head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: null, error: null };
  store.setMeta('suite-jobs', JSON.stringify([
    { ...base, id: 'outside-result', result: outside },
    { ...base, id: 'symlink-log', log: join(scratch, 'escape/outside') },
    { ...base, id: 'nested-lease', lease: { resource: { run: { cwd: root } } } },
  ]));
  const restore = t.mock.method(LocalExecutor.prototype, 'restore');
  t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
  const logs: Record<string, unknown>[] = [];
  const clock = new FakeClock();
  suites = new Suites(store, scratch, async () => { assert.fail('unsafe job must not report'); }, {
    clock, env: fixtureEnvironment(scratch, process.env, { CLAND_TEST_ORPHAN_ROOT: scratch }), log: entry => logs.push(entry),
  });

  assert.equal(restore.mock.callCount(), 0);
  await clock.advance(1000);
  await within(lifetime.observe(() => suites!.settled()), 5000);
  assert.deepEqual(logs.filter(row => row.event === 'verification-recovery-refused').map(row => row.id).sort(), ['nested-lease', 'outside-result', 'symlink-log']);
  assert.equal(suites.status().length, 3);
  await within(lifetime.dispose(), 5000);
  assert.equal(await readFile(outside, 'utf8'), 'untouched');
});

test('isolated retained receipts refuse outside resolved artifact paths before reading', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { Suites } = await import('../src/hub/suites.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const lifetime = pacingOwner(t);
  let suites: SuiteScheduler | undefined;
  lifetime.close(() => within(suites?.close() ?? Promise.resolve(), 5000));
  const root = await mkdtemp(join(tmpdir(), 'memory-artifact-fence-'));
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const scratch = join(root, 'scratch');
  await mkdir(scratch);
  const outside = join(root, 'outside');
  await writeFile(outside, 'outside receipt must never be read');
  const store = lifetime.store(join(scratch, 'hub.db'));
  const artifact = store.registerArtifact(id => ({ id, title: 'outside', kind: 'file', path: outside,
    creator: 'hub', time: new Date().toISOString(), topic: 'general', status: 'shared' }), () => {});
  const job = { id: 'finished', executor: 'local' as const, mode: 'auto', cwd: scratch,
    log: join(scratch, 'missing-log'), result: join(scratch, 'result'), gate: join(scratch, 'gate'),
    pid: null, started: null, state: 'finished' as const, outcome: { code: 0, cause: '' }, reported: true, cleaned: true,
    head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: artifact.id, error: null };
  store.setMeta('suite-job:finished', JSON.stringify({ position: 0, job }));
  suites = new Suites(store, scratch, async () => {}, { clock: new FakeClock(),
    env: fixtureEnvironment(scratch, process.env, { CLAND_TEST_ORPHAN_ROOT: scratch }) });

  const nativeOpen = t.mock.method(fs, 'createReadStream');
  syncBuiltinESMExports();
  t.after(async () => { await lifetime.dispose(); t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(suites.receipt('finished'), /isolated verification refused.*finished/);
  await assert.rejects(async () => suites!.evidence(job), /isolated verification refused.*finished/);
  const folder = store.registerArtifact(id => ({ id, title: 'outside folder', kind: 'file', path: root,
    creator: 'hub', time: new Date().toISOString(), topic: 'general', status: 'shared', folder: true }), () => {});
  store.updateArtifact({ ...artifact, path: join(scratch, 'placeholder'), movedTo: { folder: folder.id, path: 'outside' } });
  await assert.rejects(suites.receipt('finished'), /isolated verification refused.*finished/);
  const cached = { ...job, id: 'cached', cached: { run: job.id, head: job.head, tree: 'b'.repeat(40) } };
  await assert.rejects(async () => suites!.evidence(cached), /isolated verification refused/);
  store.updateArtifact({ ...artifact, path: job.log });
  await writeFile(job.log, 'tier T1: safe retained evidence\n');
  const receipt = await suites.receipt('finished');
  assert.match(receipt.log, /safe retained evidence/);
  assert.equal(nativeOpen.mock.calls.some(call => String(call.arguments[0]) === outside), false);
  assert.equal(suites.status().length, 1);
  await within(lifetime.dispose(), 5000);
});

test('copied suite sealing rewrites relative path fields and removes retained artifact capabilities', async t => {
  const { sealSuiteJob, outsideSuitePath } = await import('../src/hub/suite-isolation.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-relative-seal-'));
  ownDirectory(t, root);
  const job = { id: 'relative', executor: 'local' as const, mode: 'auto', cwd: '../live', log: '../live/log',
    result: '../live/result', gate: '../live/gate', pid: null, started: null, outcome: null, reported: false,
    head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: 'A-1', error: null };
  const sealed = sealSuiteJob(job, root);
  assert.equal(outsideSuitePath(root, sealed), false);
  assert.equal(sealed.artifact, null);
});

for (const location of ['outside', 'inside'] as const) {
  test(`isolated recovery accepts native PID authority only with ${location} scratch ownership`, async t => {
    const { memoryProducer } = await import('./memory-producer.ts');
    const { processIdentityAsync } = await import('../src/process-identity.ts');
    const { processStartedAsync } = await import('../src/hub/lock.ts');
    const { Suites } = await import('../src/hub/suites.ts');
    const { LocalExecutor } = await import('../src/executor/local.ts');
    const { FakeClock } = await import('./fake-clock.ts');
    const lifetime = pacingOwner(t);
    let suites: SuiteScheduler | undefined;
    lifetime.close(() => within(suites?.close() ?? Promise.resolve(), 5000));
    const root = await mkdtemp(join(tmpdir(), 'memory-native-authority-'));
    const scratch = join(root, 'scratch'), outside = join(root, 'outside');
    await mkdir(scratch); await mkdir(outside);
    const producer = memoryProducer(t, location === 'inside' ? scratch : outside, ['-e', `
      process.on('message', message => { if (message.type === 'memory-stop') process.exit(0); });
      process.send({ type: 'memory-started' }); process.send({ type: 'memory-ready' });
    `]);
    ownDirectory(t, root, { beforeRemove: async () => { await lifetime.dispose(); await producer.dispose(); } });
    const child = producer.start();
    await producer.ready();
    assert.ok(child.pid);
    const env = fixtureEnvironment(scratch, process.env, { CLAND_TEST_ORPHAN_ROOT: scratch });
    const started = await within(processStartedAsync(child.pid, undefined, undefined, undefined, env), 5000);
    const identity = await within(processIdentityAsync(child.pid, env), 5000);
    assert.ok(started); assert.ok(identity);
    const store = lifetime.store(join(scratch, 'hub.db'));
    const job = { id: 'native', executor: 'local' as const, mode: 'auto', cwd: scratch,
      log: join(scratch, 'log'), result: join(scratch, 'result'), gate: join(scratch, 'gate'), pid: child.pid,
      started, state: 'running' as const, outcome: null, reported: false, cleaned: false,
      head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: null, error: null,
      lease: { kind: 'local', run: 'native', created: new Date().toISOString(), deadline: new Date().toISOString(), resource: { identity } } };
    await writeFile(job.log, '');
    await writeFile(job.result, JSON.stringify({ code: 1, cause: 'planted failed result' }));
    store.setMeta('suite-jobs', JSON.stringify([job]));
    const attempts: string[] = [];
    const kill = process.kill;
    t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
      if (Math.abs(pid) === child.pid && signal !== 0) { attempts.push(String(signal)); return true; }
      return kill(pid, signal);
    });
    t.after(async () => { await lifetime.dispose(); await producer.dispose(); t.mock.restoreAll(); });
    const restore = t.mock.method(LocalExecutor.prototype, 'restore');
    const clock = new FakeClock();
    suites = new Suites(store, scratch, async () => {}, { clock, env });
    await within(lifetime.observe(() => suites!.settled()), 5000);
    assert.equal(restore.mock.callCount(), location === 'inside' ? 1 : 0);
    if (location === 'outside') {
      await clock.advance(1000);
      await within(lifetime.observe(() => suites!.settled()), 5000);
      assert.match(suites.status()[0]!.error ?? '', /isolated verification refused/);
    } else assert.equal(suites.status()[0]!.pid, child.pid);
    assert.deepEqual(attempts, []);
    assert.equal(await processIdentityAsync(child.pid, env), identity);
    await within(lifetime.dispose(), 5000);
    await producer.dispose();
    assert.equal((await producer.native).code, 0);
    assert.deepEqual(attempts, []);
  });
}

test('sealing unfinished code-zero recovery is unavailable while completed history retains its outcome', async t => {
  const { sealSuiteJob } = await import('../src/hub/suite-isolation.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-outcome-seal-'));
  ownDirectory(t, root);
  const completed = { id: 'outcome', executor: 'local' as const, mode: 'auto', cwd: root, log: join(root, 'log'),
    result: join(root, 'result'), gate: join(root, 'gate'), pid: null, started: null, state: 'finished' as const,
    outcome: { code: 0, cause: 'completed original' }, reported: true, cleaned: true, accountingPending: false,
    head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: null, error: null };
  for (const patch of [{ reported: false }, { cleaned: false }, { accountingPending: true }, { state: 'running' as const }]) {
    const sealed = sealSuiteJob({ ...completed, ...patch }, root);
    assert.equal(sealed.outcome?.notRun, 'infrastructure');
    assert.notEqual(sealed.outcome?.code, 0);
    assert.equal(sealed.state, 'finished');
  }
  assert.deepEqual(sealSuiteJob(completed, root).outcome, { code: 0, cause: 'completed original' });
});

test('ordinary cancellation durably settles its requested run while unrelated constructor reap stays held', async t => {
  const { Suites } = await import('../src/hub/suites.ts');
  const { LocalExecutor } = await import('../src/executor/local.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const lifetime = pacingOwner(t);
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let suites: SuiteScheduler | undefined, reaped = false;
  lifetime.close(async () => { release.resolve(); await within(suites?.close() ?? Promise.resolve(), 5000); });
  const root = await mkdtemp(join(tmpdir(), 'memory-cancel-reap-'));
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const store = lifetime.store(join(root, 'hub.db'));
  const job = { id: 'requested', executor: 'local' as const, mode: 'auto', cwd: root,
    log: join(root, 'log'), result: join(root, 'result'), gate: join(root, 'gate'), pid: null, started: null,
    state: 'queued', outcome: null, reported: false, cleaned: false, head: 'a'.repeat(40), branch: 'fixture',
    topic: 'general', to: [], actor: null, artifact: null, error: null };
  await writeFile(job.log, '');
  store.setMeta('suite-jobs', JSON.stringify([job, { ...job, id: 'unrelated', state: 'running' }]));
  t.mock.method(LocalExecutor.prototype, 'status', async (lease: import('../src/executor/executor.ts').Lease) => {
    assert.equal(lease.run, 'unrelated');
    entered.resolve(); await release.promise; reaped = true;
    return { state: 'running' };
  });
  suites = new Suites(store, root, async () => {}, { clock: new FakeClock(), env: fixtureEnvironment(root, process.env) });
  await within(entered.promise, 5000);
  const cancelled = await within(lifetime.observe(() => suites!.cancel('requested', null, () => {})), 1000);
  assert.deepEqual(cancelled, { id: 'requested', topic: 'general', cancelled: true });
  assert.equal(reaped, false);
  const active = JSON.parse(store.meta('suite-jobs') ?? '[]') as Array<{ id: string; cancelled?: boolean; outcome?: { code: number } }>;
  const archived = store.suiteJob('requested');
  const receipt = active.find(row => row.id === 'requested') ?? (archived ? JSON.parse(archived).job : null);
  assert.equal(receipt?.cancelled, true);
  assert.equal(receipt?.outcome?.code, 143);
  assert.equal(reaped, false);
  await within(lifetime.dispose(), 5000);
  assert.equal(reaped, true);
});

for (const isolated of [false, true]) {
  test(`${isolated ? 'isolated' : 'ordinary'} legacy empty-path history retains row count and its scoped recovery policy`, async t => {
    const { Suites } = await import('../src/hub/suites.ts');
    const { FakeClock } = await import('./fake-clock.ts');
    const lifetime = pacingOwner(t);
    let suites: SuiteScheduler | undefined;
    lifetime.close(() => within(suites?.close() ?? Promise.resolve(), 5000));
    const root = await mkdtemp(join(tmpdir(), 'memory-legacy-history-'));
    ownDirectory(t, root, { beforeRemove: lifetime.dispose });
    const store = lifetime.store(join(root, 'hub.db'));
    const job = { id: 'legacy', executor: 'local' as const, mode: 'auto', cwd: root,
      log: '', result: '', gate: '', pid: null, started: null, state: 'finished' as const,
      outcome: { code: 0, cause: 'original completed receipt' }, reported: true, cleaned: true,
      head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: 'A-1', error: null };
    const original = JSON.stringify({ position: 0, job });
    store.setMeta('suite-job:legacy', original);
    const logs: Record<string, unknown>[] = [];
    const env = fixtureEnvironment(root, process.env, isolated ? { CLAND_TEST_ORPHAN_ROOT: root } : {});
    suites = new Suites(store, root, async () => { assert.fail('completed history must not be reported again'); }, {
      clock: new FakeClock(), env, log: entry => logs.push(entry),
    });
    await within(lifetime.observe(() => suites!.settled()), 5000);
    assert.equal(suites.status().length, 1);
    assert.equal(store.suiteJobHistory().length, 1);
    assert.deepEqual(suites.status()[0]!.outcome, job.outcome);
    const retained = JSON.parse(store.suiteJob('legacy')!).job as typeof job;
    if (isolated) {
      assert.equal(retained.artifact, null);
      assert.match(suites.status()[0]!.error ?? '', /isolated verification refused recovery for legacy/);
      assert.equal(logs.filter(row => row.event === 'verification-recovery-refused').length, 1);
    } else {
      assert.equal(retained.artifact, 'A-1');
      assert.equal(suites.status()[0]!.error, null);
      assert.equal(store.suiteJob('legacy'), original);
      assert.equal(logs.some(row => row.event === 'verification-recovery-refused'), false);
    }
    await within(lifetime.dispose(), 5000);
  });
}

test('isolated recovery accepts builder-owned scratch and temp paths while refusing an unrelated sibling', async t => {
  const { Suites } = await import('../src/hub/suites.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const lifetime = pacingOwner(t);
  let suites: SuiteScheduler | undefined;
  lifetime.close(() => within(suites?.close() ?? Promise.resolve(), 5000));
  const root = await mkdtemp(join(tmpdir(), 'memory-owned-roots-'));
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const project = join(root, 'project'), scratch = join(root, 'owned'), foreign = join(root, 'foreign');
  await mkdir(project); await mkdir(join(scratch, 'tmp'), { recursive: true }); await mkdir(foreign);
  const store = lifetime.store(join(project, 'hub.db'));
  const jobs = [scratch, join(scratch, 'tmp'), foreign].map((path, index) => ({
    id: String(index), executor: 'local', mode: 'auto', cwd: project, log: join(path, 'log'),
    result: join(path, 'result'), gate: join(path, 'gate'), pid: null, started: null,
    state: 'queued', outcome: null, reported: false, cleaned: false,
    head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: null, error: null,
  }));
  store.setMeta('suite-jobs', JSON.stringify(jobs));
  suites = new Suites(store, project, async () => assert.fail('stationary fake clock must not report'), {
    clock: new FakeClock(), env: fixtureEnvironment(scratch, process.env, { CLAND_TEST_ORPHAN_ROOT: project }),
  });
  await within(lifetime.observe(() => suites!.settled()), 5000);
  assert.deepEqual(suites.status().map(row => row.state), ['queued', 'queued', 'finished']);
  assert.match(suites.status()[2]!.error ?? '', /outside root/);
  await within(lifetime.dispose(), 5000);
});

for (const legacy of [false, true]) test(`report-only recovery publishes log unavailable for ${legacy ? 'legacy' : 'terminal'} state without reading an outside stored file`, async t => {
  const { sessionDispatcherUi } = await import('./session-credential-fixture.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const lifetime = pacingOwner(t, { setupTimeoutMs: 5000 });
  const seedOwner = pacingOwner(t);
  let ui: Awaited<ReturnType<typeof sessionDispatcherUi>> | undefined;
  const root = await mkdtemp(join(tmpdir(), 'memory-unavailable-report-'));
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const project = join(root, 'project'), outside = join(root, 'outside-log');
  await mkdir(join(project, '.cland'), { recursive: true });
  await writeFile(outside, 'outside original bytes');
  const store = seedOwner.store(join(project, '.cland/hub.db'));
  store.setMeta('suite-jobs', JSON.stringify([{ id: 'outside-report', executor: 'local', mode: 'auto', cwd: project,
    log: outside, result: outside, gate: outside, pid: null, started: null, ...(legacy ? {} : { state: 'finished' }),
    outcome: { code: 1, cause: 'worker failed' }, reported: false, cleaned: true,
    head: 'a'.repeat(40), branch: 'fixture', topic: 'general', to: [], actor: null, artifact: null, error: null }]));
  await seedOwner.dispose();
  const opens = t.mock.method(fs, 'createReadStream');
  const copies = t.mock.method(fs.promises, 'copyFile');
  const reads = t.mock.method(fs.promises, 'readFile');
  const files = t.mock.method(fs.promises, 'open');
  const gates = t.mock.method(fs.promises, 'access');
  syncBuiltinESMExports();
  t.after(async () => { await lifetime.dispose(); t.mock.restoreAll(); syncBuiltinESMExports(); });
  const clock = new FakeClock();
  const hub = await lifetime.start(project, {}, clock);
  ui = await within(lifetime.observe(async signal => {
    const client = await sessionDispatcherUi(t, hub.dispatcher, project);
    if (signal.aborted) { client.close(); signal.throwIfAborted(); }
    lifetime.close(() => client.close());
    return client;
  }), 5000);
  await ui.request({ type: 'subscribe' });
  const posted = lifetime.observe(() => ui!.waitFor(frame => frame.type === 'message' && (frame.message as { id: string }).id === 'suite:outside-report'));
  await clock.advance(1000);
  const frame = await within(posted, 5000);
  assert.match((frame.message as { text: string }).text, /log unavailable \(outside isolated root\)/);
  await within(lifetime.observe(() => hub.verificationSettled()), 5000);
  const status = await ui.request({ type: 'hub.status', history: true });
  const report = (status.value as { suites: Array<{ id: string; reported: boolean; outcome: { code: number; notRun?: string } }> }).suites.find(row => row.id === 'outside-report');
  assert.equal(report?.reported, true);
  assert.equal(report?.outcome.notRun, 'infrastructure');
  assert.equal(report?.outcome.code, 1);
  await within(lifetime.dispose(), 5000);
  assert.equal(opens.mock.calls.some(call => String(call.arguments[0]) === outside), false);
  assert.equal(copies.mock.calls.some(call => String(call.arguments[0]) === outside), false);
  for (const probe of [reads, files, gates]) assert.equal(probe.mock.calls.some(call => String(call.arguments[0]) === outside), false);
  assert.equal(await readFile(outside, 'utf8'), 'outside original bytes');
});

for (const acquisition of ['normal', 'omitted', 'aborted'] as const) test(`gone-leader outside group ownership drains ${acquisition} acquisition and refuses foreign signals`, async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const { LocalExecutor } = await import('../src/executor/local.ts');
  const { processIdentityAsync } = await import('../src/process-identity.ts');
  const { processStartedAsync } = await import('../src/hub/lock.ts');
  const { systemProcesses } = await import('../src/system-processes.ts');
  const { ownProcess, cleanupProcesses } = await import('./process-cleanup.ts');
  const lifetime = pacingOwner(t);
  let stopChild = async () => {}, stopProducer = async () => {};
  const root = await mkdtemp(join(tmpdir(), 'memory-gone-group-'));
  // Root discovery is owned before launch, even if the leader exits before its
  // child/readiness receipt can be acquired. Stop every producer before sweep.
  lifetime.close(async () => {
    t.mock.restoreAll();
    await stopProducer(); await stopChild();
    await cleanupProcesses(root, [], undefined, undefined, [], { discover: true });
  });
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const project = join(root, 'project'), outside = join(root, 'outside');
  await mkdir(project); await mkdir(outside);
  const receipt = join(outside, 'child.json');
  const childCode = `require('node:fs').writeFileSync(${JSON.stringify(receipt)},JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);`;
  const producer = memoryProducer(t, project, ['--input-type=module', '-e', `
    import { spawn } from 'node:child_process';
    import { existsSync } from 'node:fs';
    import { fixtureEnvironment } from ${JSON.stringify(new URL('./fixture-environment.ts', import.meta.url).href)};
    spawn(process.execPath, ['-e', ${JSON.stringify(childCode)}], { cwd: ${JSON.stringify(outside)}, env: fixtureEnvironment(${JSON.stringify(outside)}, process.env), stdio: 'ignore' }).unref();
    process.on('message', message => { if (message.type === 'memory-stop') process.exit(0); });
    while (!existsSync(${JSON.stringify(receipt)})) await new Promise(resolve => setTimeout(resolve,10));
    process.send({ type:'memory-started' });
    if (${JSON.stringify(acquisition !== 'omitted')}) process.send({ type:'memory-ready' });
  `], 5000, { detached: true });
  stopProducer = producer.dispose;
  const leader = producer.start();
  if (acquisition === 'aborted') {
    const abandoned = new AbortController();
    abandoned.abort(new Error('abandoned group acquisition'));
    await assert.rejects(producer.ready(abandoned.signal), /abandoned group acquisition/);
    await producer.started();
  } else if (acquisition === 'omitted') {
    await producer.started();
    await assert.rejects(within(producer.ready(), 100), /deadline/);
  } else await producer.ready();
  assert.ok(leader.pid);
  const child = JSON.parse(await readFile(receipt, 'utf8')) as { pid: number };
  const env = fixtureEnvironment(project, process.env, { CLAND_TEST_ORPHAN_ROOT: project });
  const started = await processStartedAsync(leader.pid, undefined, undefined, undefined, env);
  const identity = await processIdentityAsync(leader.pid, env);
  assert.ok(started); assert.ok(identity);
  const childIdentity = await processIdentityAsync(child.pid, env);
  assert.ok(childIdentity, 'native child birth must be positively captured');
  if (acquisition !== 'normal') {
    await producer.dispose();
    assert.equal((await producer.native).code, 0);
    await within(lifetime.dispose(), 5000);
    assert.equal(await processIdentityAsync(child.pid, env), null);
    return;
  }
  stopChild = ownProcess(undefined, child.pid);
  const row = (await systemProcesses(undefined, undefined, [child.pid], false, env)).find(row => row.pid === child.pid);
  assert.equal(row?.group, leader.pid);
  await producer.dispose();
  assert.equal((await producer.native).code, 0);
  assert.equal(await processIdentityAsync(leader.pid, env), null);
  const { isolatedSuiteSignalTargets } = await import('../src/hub/suite-isolation.ts');
  assert.ok(row);
  assert.equal(await isolatedSuiteSignalTargets(project, [row], [row], env, {
    pid: leader.pid, identity, births: new Map([[leader.pid, identity]]),
  }), false, 'gone launch leader cannot grant authority through a group number');
  assert.equal(await isolatedSuiteSignalTargets(project, [row], [row], env, {
    pid: leader.pid, identity, births: new Map([[child.pid, 'old-native-birth']]),
  }), false, 'a recycled captured PID supplies no native launch authority');
  const attempts: string[] = [];
  const kill = process.kill;
  t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
    if (Math.abs(pid) === child.pid && signal !== 0) { attempts.push(String(signal)); throw new Error('guarded outside signal attempt'); }
    return kill(pid, signal);
  });
  const executor = new LocalExecutor([join(project, 'suite.lock')], () => {}, () => {}, env);
  const run = { id: 'gone', cwd: project, head: 'a'.repeat(40), mode: 'auto', log: join(project, 'log'), result: join(project, 'result'), gate: join(project, 'gate') };
  await writeFile(run.log, '');
  await writeFile(run.result, JSON.stringify({ code: 1 }));
  const lease = executor.restore(run, { pid: leader.pid, started, identity, outcome: null });
  await assert.rejects(within(lifetime.observe(() => executor.release(lease)), 5000), /could not verify/);
  assert.deepEqual(attempts, []);
  assert.equal(await processIdentityAsync(child.pid, env), childIdentity);
  await within(lifetime.dispose(), 5000);
  assert.equal(await processIdentityAsync(child.pid, env), null);
});

for (const authority of ['fresh', 'restored', 'restored-owned', 'replaced', 'replaced-during-cancel', 'reused-pid'] as const) test(`native launch authority is lease-and-birth bound for ${authority} cleanup`, async t => {
  const { LocalExecutor } = await import('../src/executor/local.ts');
  const { processIdentityAsync } = await import('../src/process-identity.ts');
  const { processStartedAsync } = await import('../src/hub/lock.ts');
  const { cleanupProcesses } = await import('./process-cleanup.ts');
  const { until } = await import('./until.ts');
  const lifetime = pacingOwner(t);
  let starting: Promise<void> | undefined;
  const root = await mkdtemp(join(tmpdir(), 'cland-suite-foreign-'));
  lifetime.close(async () => {
    await starting?.catch(() => {});
    t.mock.restoreAll();
    await cleanupProcesses(root, [], undefined, undefined, [], { discover: true });
  });
  ownDirectory(t, root, { beforeRemove: lifetime.dispose });
  const project = join(root, 'project'), outside = join(root, 'outside');
  await mkdir(project); await mkdir(outside);
  const receipt = join(outside, 'child.json');
  const childCwd = authority === 'restored-owned' ? project : outside;
  const env = fixtureEnvironment(project, process.env, { CLAND_TEST_ORPHAN_ROOT: project });
  await writeFile(join(project, 'native.mjs'), `
    import { spawn } from 'node:child_process';
    import { fixtureEnvironment } from ${JSON.stringify(new URL('./fixture-environment.ts', import.meta.url).href)};
    spawn(process.execPath, ['-e', ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(receipt)},JSON.stringify({pid:process.pid}));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`)}], {
      cwd: ${JSON.stringify(childCwd)}, env: fixtureEnvironment(${JSON.stringify(childCwd)}, process.env), detached: true, stdio: 'ignore'
    }).unref();
    setInterval(()=>{},1000);
  `);
  const locks = [join(project, 'suite.lock'), join(project, 'suite-nvim.lock')];
  const executor = new LocalExecutor(locks, () => {}, () => {}, env);
  const run = { id: 'launch', cwd: project, head: '', mode: 'auto', log: join(project, 'log'), result: join(project, 'result'), gate: join(project, 'gate'), locks,
    commands: { prepare: '', check: '', test: `${JSON.stringify(process.execPath)} native.mjs` } };
  const lease = await within(lifetime.observe(() => executor.acquire(run, new Date(Date.now() + 15000).toISOString())), 5000);
  await within(lifetime.observe(() => starting = executor.start(lease, run)), 5000);
  let child: { pid: number } | undefined;
  await until(async () => { child = await readFile(receipt, 'utf8').then(JSON.parse, () => undefined); return child !== undefined; }, { what: 'owned native outside child receipt', timeoutMs: 5000 });
  assert.ok(child);
  const identity = await processIdentityAsync(child.pid, env);
  assert.ok(identity, 'positive child birth');
  const worker = lease.resource as import('../src/executor/local.ts').LocalWorker;
  assert.ok(worker.pid); assert.ok(worker.started); assert.ok(worker.identity);
  const persisted = JSON.parse(JSON.stringify(lease)) as import('../src/executor/executor.ts').Lease;
  assert.deepEqual(Object.keys(persisted), ['kind', 'run', 'created', 'deadline', 'resource']);
  assert.equal(JSON.stringify(persisted).includes('births'), false, 'launch authority is never persisted');
  const attempts: string[] = [];
  let replacedDuringCancel = false;
  const kill = process.kill;
  t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
    if (authority === 'replaced-during-cancel' && !replacedDuringCancel && pid === child!.pid && signal === 0) {
      replacedDuringCancel = true;
      executor.restore(run, worker, persisted);
    }
    if (authority !== 'fresh' && authority !== 'restored-owned' && Math.abs(pid) === child!.pid && signal !== 0) { attempts.push(String(signal)); throw new Error('guarded foreign signal attempt'); }
    return kill(pid, signal);
  });
  if (authority === 'fresh') {
    await within(lifetime.observe(() => executor.cancel(lease, 'SIGTERM')), 5000);
    assert.equal(await processIdentityAsync(child.pid, env), null, 'own captured detached descendant reaped');
  } else if (authority === 'restored' || authority === 'restored-owned') {
    const restarted = new LocalExecutor(locks, () => {}, () => {}, env);
    const restored = restarted.restore(run, worker, persisted);
    const cancelled = lifetime.observe(() => restarted.cancel(restored, 'SIGTERM'));
    if (authority === 'restored-owned') {
      await within(cancelled, 5000);
      assert.equal(await processIdentityAsync(child.pid, env), null, 'restored owned child reaps through native cwd/birth fence');
    } else await assert.rejects(within(cancelled, 5000), /could not verify/);
  } else if (authority === 'replaced') {
    const replaced = executor.restore(run, worker, persisted);
    for (const candidate of [lease, replaced]) await assert.rejects(within(lifetime.observe(() => executor.cancel(candidate, 'SIGTERM')), 5000), /could not verify/);
  } else if (authority === 'replaced-during-cancel') {
    await assert.rejects(within(lifetime.observe(() => executor.cancel(lease, 'SIGTERM')), 5000), /could not verify/);
    assert.equal(replacedDuringCancel, true, 'lease replacement occurred during the native scope proof');
  } else {
    // A real foreign PID stands in for reuse; retain the original captured birth.
    assert.notEqual(worker.identity, identity, 'replacement has a different positively observed native birth');
    worker.pid = child.pid;
    worker.started = await processStartedAsync(child.pid, undefined, undefined, undefined, env);
    await within(lifetime.observe(() => executor.cancel(lease, 'SIGTERM')), 5000);
  }
  assert.deepEqual(attempts, []);
  if (authority !== 'fresh' && authority !== 'restored-owned') assert.equal(await processIdentityAsync(child.pid, env), identity);
  await within(lifetime.dispose(), 5000);
  assert.equal(await processIdentityAsync(child.pid, env), null);
});

test('probe instrumentation restores its owner without retaining recurring call payloads', async t => {
  const { memoryInstrumentation } = await import('./memory-instrumentation.ts');
  const target = { read: (value: string) => value.length };
  const original = target.read;
  await t.test('bounded wrapper lifetime', child => {
    const instrument = memoryInstrumentation(child);
    instrument(target, 'read', (value: string) => original(value) + 1);
    for (let i = 0; i < 1000; i++) assert.equal(target.read('synthetic-payload'), 18);
    assert.equal(Reflect.get(target.read, 'mock'), undefined, 'recording mocks retain every argument/result in a long probe');
  });
  assert.equal(target.read, original);
});

test('held late sample drains before immutable rest budget receipt and disposal rejects new samples', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-endpoint-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--control-late-sample', '--rest-seconds', '0.1', '--sample-ms', '20', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(5000); await producer.dispose();
  const endpoint = JSON.parse(await readFile(join(root, 'rest-end.json'), 'utf8'));
  const budget = JSON.parse(await readFile(join(root, 'memory-budget.json'), 'utf8'));
  const held = JSON.parse(await readFile(join(root, 'sampling-control.json'), 'utf8'));
  assert.equal(endpoint.hubRunning, true);
  assert.equal(budget.rest.heap.bytes, endpoint.heapUsed);
  assert.equal(budget.rest.rss.bytes, endpoint.rss);
  assert.equal(held.admittedPhase, 'rest');
  assert.equal(held.writtenPhase, 'rest');
  assert.equal(held.releasePhase, 'rest-drain');
  assert.equal(held.disposalAdmissionRejected, true);
  const samples = (await readFile(join(root, 'samples.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(samples.every(row => row.ms <= endpoint.ms));
  assert.equal((await producer.native).code, 0);
});

test('held streaming settlement records incomplete then releases and joins before native close and root removal', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-settlement-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--control-held-settlement', '--rest-seconds', '0.1', '--stream-runs', '6', '--source', root, '--root', root]);
  const remove = ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(5000); await producer.dispose();
  const result = JSON.parse(await readFile(join(root, 'streaming.json'), 'utf8'));
  assert.equal(result.incomplete, true);
  assert.match(result.reason, /settlement\/result deadline/);
  const release = JSON.parse(await readFile(join(root, 'settlement-control.json'), 'utf8'));
  assert.equal(release.entered, true);
  assert.equal(release.released, true);
  assert.equal(release.joined, true);
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).outcome, 'incomplete');
  assert.equal((await producer.native).code, 1);
  assert.equal(producer.forced(), false);
  assert.ok((await stat(root)).isDirectory());
  await remove();
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('startup native receipt stays at readiness before rest and marks synthetic readings unavailable', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-native-order-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--rest-seconds', '0.1', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(5000); await producer.dispose();
  const captures = (await readFile(join(root, 'native-captures.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const boundaries = (await readFile(join(root, 'boundaries.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(captures.length, 1);
  assert.equal(captures[0].stage, 'startup');
  assert.equal(captures[0].phase, 'startup-ready');
  assert.equal(captures[0].available, false);
  assert.ok(captures[0].completedMs <= boundaries.find(row => row.boundary === 'rest-start').ms);
  assert.match(await readFile(join(root, 'startup-vmmap.txt'), 'utf8'), /unavailable/);
  assert.equal((await producer.native).code, 0);
});

test('quiet slot waives allocated swap only and refuses active pressure, paging, load or expired grant', async () => {
  const { quietSlotRefusal, swapOutPages } = await import('./memory-machine-guard.ts');
  const normal = { load1: 1.66, swapPercent: 83.5, pressure: 0, pressureLevel: 1, freeMemoryPercent: 64, swapOuts: 100 };
  assert.equal(swapOutPages('Swapins: 4.\nSwapouts: 100.'), 100);
  assert.throws(() => swapOutPages('unavailable'), /unusable/);
  assert.equal(quietSlotRefusal(normal, 100, 200, 100), null);
  assert.match(quietSlotRefusal({ ...normal, pressureLevel: 2 }, 100, 200, 100)!, /pressure/);
  assert.match(quietSlotRefusal({ ...normal, swapOuts: 101 }, 100, 200, 100)!, /swap-outs/);
  assert.match(quietSlotRefusal({ ...normal, load1: 6.1 }, 100, 200, 100)!, /load1/);
  assert.match(quietSlotRefusal(normal, 100, 200, 200)!, /expired/);
});

test('short quiet window reserves held graceful fallback and confirms native close before grant expiry', async t => {
  const { memoryProducer, memoryStopReserveMs } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-slot-close-'));
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const timing = { graceMs: 40, fallbackMs: 1000, closeMs: 100, drainMs: 100, probeSlackMs: 100, schedulingSlackMs: 100 };
  const producer = memoryProducer(t, root, ['-e', "process.on('message',()=>{});process.send({type:'memory-ready'});setInterval(()=>{},1000)"], timing.graceMs, {
    boundedTermination: true, timing,
    beforeFallback: async () => { await writeFile(join(root, 'fallback-entered.json'), '{"entered":true}'); entered.resolve(); await release.promise; },
  });
  ownDirectory(t, root, { beforeRemove: async () => { release.resolve(); await producer.dispose(); } });
  producer.start(); await producer.ready();
  const reserve = memoryStopReserveMs(timing);
  const grantEnd = Date.now() + reserve + 30;
  let disposal: Promise<void> | undefined;
  const stopTimer = setTimeout(() => { disposal = producer.dispose(); void disposal.catch(() => {}); }, grantEnd - reserve - Date.now());
  t.after(() => clearTimeout(stopTimer));
  await within(entered.promise, 2000);
  assert.equal(JSON.parse(await readFile(join(root, 'fallback-entered.json'), 'utf8')).entered, true);
  release.resolve();
  await disposal;
  const native = await producer.native;
  assert.ok(native.closedAt < grantEnd, 'native pipe/exit receipt must precede the granted endpoint');
  const receipt = JSON.parse(await readFile(join(root, 'supervisor-outcome.json'), 'utf8'));
  assert.equal(receipt.forced, true);
  assert.equal(receipt.incomplete, true);
  assert.equal(receipt.nativeClose, 'confirmed');
  assert.ok((await stat(root)).isDirectory());
});

test('failed worker machine reader retains native cause and code-zero stop stays guard-interrupted', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-machine-failure-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--control-machine-failure', '--rest-seconds', '0.1', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(5000); await producer.dispose();
  const guard = JSON.parse((await readFile(join(root, 'guard-stops.jsonl'), 'utf8')).trim());
  assert.equal(guard.source, 'worker');
  assert.match(guard.unavailable, /reader/);
  assert.equal(guard.nativeCode, 7);
  assert.equal(guard.nativeSignal, 'SIGTERM');
  assert.match(guard.diagnosticTail, /redacted/);
  assert.doesNotMatch(guard.diagnosticTail, /SYNTHETIC_MACHINE_SECRET/);
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).outcome, 'guard-stopped');
  assert.equal((await producer.native).code, 0);
});

for (const condition of ['pressure', 'load', 'swapouts'] as const) test(`worker quiet-slot ${condition} refusal persists before graceful guard stop`, async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-machine-refusal-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', `--control-machine-${condition}`, '--quiet-slot-until', new Date(Date.now() + 120_000).toISOString(), '--rest-seconds', '0.1', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(5000); await producer.dispose();
  const guard = JSON.parse((await readFile(join(root, 'guard-stops.jsonl'), 'utf8')).trim());
  assert.equal(guard.source, 'worker');
  assert.match(guard.refusal, condition === 'swapouts' ? /swap-outs/ : condition === 'load' ? /load1/ : /pressure/);
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).outcome, 'guard-stopped');
  assert.equal((await producer.native).code, 0);
});

test('parent failed-reader guard commits bounded native diagnostics before requesting stop', async t => {
  const { readGuardedMachine } = await import('./memory-machine-guard.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-parent-machine-'));
  ownDirectory(t, root);
  let stopped = false;
  const reading = await readGuardedMachine(root, 'parent', () => { throw Object.assign(new Error('synthetic native failure'), { status: 9, signal: 'SIGTERM', stderr: 'Bearer SYNTHETIC_PARENT_SECRET' }); }, 100, Date.now() + 60_000, () => {
    assert.equal(fs.existsSync(join(root, 'guard-stops.jsonl')), true);
    stopped = true;
  }, true);
  assert.equal(reading, null); assert.equal(stopped, true);
  const cause = JSON.parse((await readFile(join(root, 'guard-stops.jsonl'), 'utf8')).trim());
  assert.equal(cause.nativeCode, 9); assert.equal(cause.nativeSignal, 'SIGTERM');
  assert.match(cause.diagnosticTail, /redacted/);
  assert.doesNotMatch(cause.diagnosticTail, /SYNTHETIC_PARENT_SECRET/);
});

test('transient pressure spike stays informational while native pressure level governs the guard', async () => {
  const { quietSlotRefusal } = await import('./memory-machine-guard.ts');
  const normal = { load1: 3, swapPercent: 83, pressure: 2285, pressureLevel: 1, freeMemoryPercent: 64, swapOuts: 100 };
  assert.equal(quietSlotRefusal(normal, 100, 200, 100), null);
  assert.match(quietSlotRefusal({ ...normal, pressure: 0, pressureLevel: 2 }, 100, 200, 100)!, /pressure/);
  assert.match(quietSlotRefusal({ ...normal, pressure: 0, pressureLevel: 4 }, 100, 200, 100)!, /pressure/);
});


test('native pressure receipt retains transient counter, actual level and free-memory context separately', async () => {
  const { quietSlotPressure } = await import('./memory-machine-guard.ts');
  assert.deepEqual(quietSlotPressure('2285\n1\n64\n'), { pressure: 2285, pressureLevel: 1, freeMemoryPercent: 64 });
  assert.throws(() => quietSlotPressure('2285\n64\n'), /unusable/);
  assert.throws(() => quietSlotPressure('2285\nunknown\n64\n'), /unusable/);
});

test('sealed worker completes rest with a transient counter spike and normal native level', async t => {
  const { memoryProducer } = await import('./memory-producer.ts');
  const root = await mkdtemp(join(tmpdir(), 'memory-counter-context-'));
  const producer = memoryProducer(t, root, [new URL('./measure-memory.ts', import.meta.url).pathname,
    '--run', '--worker', '--control', '--control-machine-transient', '--quiet-slot-until', new Date(Date.now() + 120_000).toISOString(), '--rest-seconds', '0.1', '--source', root, '--root', root]);
  ownDirectory(t, root, { beforeRemove: producer.dispose });
  producer.start(); await producer.ready(); await producer.join(5000); await producer.dispose();
  const reading = JSON.parse((await readFile(join(root, 'system.jsonl'), 'utf8')).trim());
  assert.equal(reading.pressure, 2285); assert.equal(reading.pressureLevel, 1);
  assert.equal(reading.freeMemoryPercent, 64);
  assert.equal(JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')).outcome, 'complete');
  assert.equal((await producer.native).code, 0);
});
