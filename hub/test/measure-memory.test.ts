// T3: scratch filesystem copies and a native Python analyzer; embedded-hub IPC stop receipts and native child close precede root cleanup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyTree, swapPercent } from './measure-memory.ts';
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
