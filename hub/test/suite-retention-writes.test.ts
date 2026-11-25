// T2: scheduler writes on a fake local executor; no worker, SSH or provider runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import nativeFs from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, relative, sep } from 'node:path';
import { retentionCase } from './suite-retention-fixture.ts';
import { testDeadlineMs } from './until.ts';

test('a fake suite accounts for scheduler run files and write operations', t => {
  const scope = retentionCase(t, undefined, { timeoutMs: testDeadlineMs(5000) });
  return scope.run(async step => {
    // The existing counted guard covers setup, callback/custom/sync/prototype
    // routes and fixture cleanup; its final-zero verification precedes restore.
    const f = await scope.wait('census fixture setup', () => step(() => scope.unit({ machineReceiptsOnly: true })));
    await scope.wait('census action and final inventory', async () => {
      const root = join(f.root, '.cland/run/suites');
      const writes: Array<{ method: string; path: string; destination?: string }> = [];
      const record = (method: string, path: unknown, destination?: unknown) => {
        if (typeof path !== 'string') return;
        if (!path.startsWith(root + sep) && !(typeof destination === 'string' && destination.startsWith(root + sep))) return;
        writes.push({ method, path: relative(root, path), ...(typeof destination === 'string' ? { destination: relative(root, destination) } : {}) });
      };
      for (const method of ['writeFile', 'appendFile', 'open', 'rename', 'copyFile'] as const) {
        const original = fs[method];
        scope.patch(fs, method, (...args: unknown[]) => {
          record(method, args[0], method === 'rename' || method === 'copyFile' ? args[1] : undefined);
          return Reflect.apply(original, fs, args);
        });
      }
      const stream = nativeFs.createWriteStream;
      scope.patch(nativeFs, 'createWriteStream', (...args: Parameters<typeof stream>) => {
        record('createWriteStream', args[0]);
        return Reflect.apply(stream, nativeFs, args);
      });
      const run = await step(() => f.launch({ fresh: true }));
      const directory = join(f.root, '.cland/run/suites', run.id);
      const other = await step(() => f.launch({ fresh: true }));
      const otherDirectory = join(root, other.id);
      const incoming = [
        { method: 'copyFile', source: join(f.root, 'outside-copy'), name: 'incoming-copy' },
        { method: 'rename', source: join(f.root, 'outside-move'), name: 'incoming-move' },
        { method: 'copyFile', source: join(otherDirectory, 'cross-copy'), name: 'cross-copy' },
        { method: 'rename', source: join(otherDirectory, 'cross-move'), name: 'cross-move' },
      ] as const;
      for (const control of incoming) {
        await step(() => fs.writeFile(control.source, 'incoming control\n'));
        await step(() => fs[control.method](control.source, join(directory, control.name)));
      }
      // Positive control: a stream-only file survives in the final inventory.
      await step(() => pipeline(['control\n'], createWriteStream(join(directory, 'control.tmp'))));
      await step(() => fs.rename(join(directory, 'control.tmp'), join(directory, 'control.txt')));
      await step(() => f.finish(run.id));
      await step(() => f.finish(other.id));
      await step(() => f.suites.settled());
      // Membership belongs to each endpoint independently: incoming/outgoing
      // operations may connect two runs or a run and an outside fixture path.
      const census = (id: string) => {
        const belongs = (path: string) => path.startsWith(id + sep);
        const operations = writes.filter(write => [write.path, ...(write.destination ? [write.destination] : [])].some(belongs));
        const paths = [...new Set(operations.flatMap(write => [write.path, ...(write.destination ? [write.destination] : [])]).filter(belongs).map(path => path.slice(id.length + 1)))].sort();
        return { operations, paths };
      };
      const { operations: observedWriteCalls, paths: files } = census(run.id);
      const inventory = (await step(() => fs.readdir(directory, { recursive: true }))).sort();
      assert.deepEqual(inventory, ['control.txt', 'cross-copy', 'cross-move', 'finalized.log', 'incoming-copy', 'incoming-move', 'suite.log']);
      for (const control of incoming) assert.ok(files.includes(control.name), `incoming ${control.method} ${control.name} is observed`);
      for (const control of incoming) {
        assert.ok(observedWriteCalls.some(write => write.method === control.method && write.path === relative(root, control.source) && write.destination === join(run.id, control.name)), `incoming ${control.method} retains both endpoints`);
      }
      assert.deepEqual(census(other.id).paths, ['cross-copy', 'cross-move', 'finalized.log', 'finalized.log.tmp', 'suite.log', 'suite.log.provenance.tmp'], 'each run receives only its own endpoints');
      assert.ok(files.includes('control.tmp'), 'stream positive control is observed');
      assert.ok(files.includes('suite.log.provenance.tmp'), 'provenance temp file is observed');
      assert.ok(files.includes('finalized.log.tmp'), 'publication temp file is observed');
      assert.ok(observedWriteCalls.some(write => write.method === 'createWriteStream' && write.path === join(run.id, 'control.tmp')));
      for (const [source, destination] of [['control.tmp', 'control.txt'], ['suite.log.provenance.tmp', 'suite.log'], ['finalized.log.tmp', 'finalized.log']]) {
        assert.ok(observedWriteCalls.some(write => write.method === 'rename' && write.path === join(run.id, source!) && write.destination === join(run.id, destination!)), `rename ${source} to ${destination} is observed`);
      }
      for (const file of inventory) assert.ok(files.includes(file), `final file ${file} is accounted for`);
      assert.ok(!inventory.includes('control.tmp'), 'renamed temp files are absent from final inventory');
      t.diagnostic(JSON.stringify({ executor: 'fake local', scope: 'scheduler; excludes unexecuted worker and remote delivery', observedFiles: files, observedWriteCalls, writeCallCount: observedWriteCalls.length, finalInventory: inventory, finalFileCount: inventory.length }));
    });
  });
});
