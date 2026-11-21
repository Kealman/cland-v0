// T2: real Suites persistence with semantic local/droplet executors, no native launches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteUnit } from './suite-unit-fixture.ts';
import { stageCase } from './stage-case-fixture.ts';
import type { TimingReceipt } from '../src/suite-timing-receipts.ts';
import { runStatusProgram } from '../src/executor/droplet/run.ts';
import { runInNewContext } from 'node:vm';
import type { SuiteJob } from '../src/hub/suites.ts';
import { Machine } from '../src/executor/droplet/machine.ts';

test('status transport can carry bounded timing detail while ordinary commands retain their output cap', async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
    const f = await step(() => owner.wait('transport fixture', () => suiteUnit(owner.resources, { machineReceiptsOnly: true, onRoot: owner.adoptRoot })));
    const caps: number[] = [];
    const machine = new Machine(f.root, f.env, async (_bin, _args, options) => { caps.push(options.maxBuffer); return { stdout: 'structured receipt' }; });
    const lease = { lease: 'fixture', run: 'fixture', address: '127.0.0.1' } as Parameters<Machine['exec']>[0];
    assert.equal(await step(() => machine.exec(lease, 'status', { timeoutMs: 10000, maxOutputBytes: 17 * 1024 * 1024 })), 'structured receipt');
    await step(() => machine.exec(lease, 'ordinary', { timeoutMs: 10000 }));
    assert.deepEqual(caps, [17825792, 8388608]);
  });
});

test('uploaded droplet status retains structured timings and accepts the previous receipt shape', () => {
  const row: TimingReceipt = { run: 'run', head: 'head', tree: 'tree', command: 'unit', step: 'T1', platform: 'linux', samples: [{ file: 'unit', name: 'case', seconds: 4, outcome: 'pass' }] };
  for (const content of [undefined, 'damaged', JSON.stringify([row])]) {
    const files = new Map([['/run/done', '2026-11-21T00:00:00Z'], ['/run/exit', '2']]);
    if (content !== undefined) files.set('/run/timing-receipts.json', content);
    const descriptors = new Map<number, string>();
    const fs = {
      existsSync: (path: string) => files.has(path),
      readFileSync: (path: string) => files.get(path)!,
      openSync: (path: string) => { if (!files.has(path)) throw new Error('missing'); descriptors.set(1, path); return 1; },
      readSync: (fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
        const bytes = Buffer.from(files.get(descriptors.get(fd)!)!).subarray(position, position + length);
        bytes.copy(buffer, offset); return bytes.length;
      },
      closeSync: (fd: number) => { descriptors.delete(fd); },
    };
    let output = '';
    runInNewContext(runStatusProgram(), { Buffer, require: () => fs, process: { argv: ['node', '/run'] }, console: { log: (text: string) => { output = text; } } });
    const status = JSON.parse(output);
    assert.equal(status.state, 'done'); assert.equal(status.code, 2);
    assert.deepEqual(status.timingReceipts, content?.startsWith('[') ? [row] : undefined);
    assert.equal(descriptors.size, 0);
  }
});

test('sharded parents name child receipt holders without synthesizing samples', async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
    const f = await step(() => owner.wait('sharded fixture', () => suiteUnit(owner.resources, { machineReceiptsOnly: true, onRoot: owner.adoptRoot })));
    const run = await step(() => owner.wait('run admission', () => f.launch()));
    await step(() => owner.wait('worker admission', () => f.when(() => f.delivered.get(run.id))));
    await step(() => owner.wait('original completion', () => f.finish(run.id)));
    const parent = (JSON.parse(f.store.suiteJob(run.id)!) as { job: SuiteJob }).job;
    const receipt: TimingReceipt = { run: 'child', head: parent.head, tree: parent.tree!, command: 'unit', step: 'T1', platform: 'linux', samples: [{ file: 'unit', name: 'child identity', seconds: 4, outcome: 'pass' }] };
    parent.shards = [{ ...parent, id: 'child', timingReceipts: [receipt] }];
    delete parent.timingReceipts;
    await step(() => owner.wait('sharded restart', () => f.reopen([parent])));
    assert.deepEqual(f.suites.status()[0]!.timingShards, { state: 'sharded', runs: ['child'] });
    assert.deepEqual(f.suites.timingReceiptForRun('child'), [receipt]);
    assert.equal(f.suites.timingReceiptForRun(parent.id), null);
    assert.equal(f.suites.timingReceipt(parent.head, parent.tree!), null);
    assert.ok(!JSON.stringify(f.suites.status()).includes('child identity'));
  });
});

for (const executor of ['local', 'droplet'] as const) test(`structured ${executor} timings remain queryable after store and Suites restart`, async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
    const f = await step(() => owner.wait('timing fixture setup', () => suiteUnit(owner.resources, { executor, machineReceiptsOnly: true, onRoot: owner.adoptRoot })));
    const run = await step(() => owner.wait('run admission', () => f.launch()));
    await step(() => owner.wait('delivered run', async () => { if (executor === 'local') await f.when(() => f.delivered.get(run.id)); else await f.machine.waits.run(f.machine.started(run.id)); }));
    const receipt: TimingReceipt = { run: run.id, head: f.candidate.head, tree: f.candidate.tree!, command: 'true', step: 'test', platform: executor === 'local' ? 'darwin' : 'linux', samples: [{ file: 'hub/test/example.test.ts', name: 'measured case', seconds: 4.1, outcome: 'pass' }] };
    await step(() => owner.wait('completion report', () => f.finish(run.id, 0, '# tests 1\n# pass 1\n', true, undefined, [receipt])));
    for (const restart of [false, true]) {
      if (restart) await step(() => owner.wait('store restart', () => f.reopen()));
      assert.deepEqual(f.suites.timingReceipt(receipt.head, receipt.tree), { id: run.id, receipts: [receipt] });
      assert.equal(f.suites.timingReceipt('another-head', receipt.tree), null);
      assert.deepEqual(f.suites.status()[0]!.timingSummary, [{ ...receipt, samples: 1 }]);
      assert.equal(Object.hasOwn(f.suites.status()[0]!, 'timingReceipts'), false);
      assert.equal(f.store.suiteJobSummaries().some(text => text.includes('measured case')), false);
    }
  });
});
