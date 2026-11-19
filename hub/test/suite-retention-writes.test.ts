// T2: scheduler writes on a fake local executor; no worker, SSH or provider runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { retentionCase } from './suite-retention-fixture.ts';

test('a fake suite accounts for scheduler run files and write operations', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    // The existing counted guard covers setup, callback/custom/sync/prototype
    // routes and fixture cleanup; its final-zero verification precedes restore.
    const f = await step(() => scope.unit({ machineReceiptsOnly: true }));
    const writes: string[] = [];
    for (const method of ['writeFile', 'appendFile', 'open'] as const) {
      const original = fs[method];
      scope.patch(fs, method, (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('/.cland/run/suites/')) writes.push(`${method}:${basename(args[0])}`);
        return Reflect.apply(original, fs, args);
      });
    }
    const run = await step(() => f.launch({ fresh: true }));
    await step(() => f.finish(run.id));
    await step(() => f.suites.settled());
    const files = [...new Set(writes.map(write => write.split(':')[1]!))].sort();
    assert.deepEqual(files, ['suite.log']);
    assert.ok(writes.length >= files.length);
    t.diagnostic(JSON.stringify({ executor: 'fake local', scope: 'scheduler; excludes unexecuted worker and remote delivery', files, fileCount: files.length, writeCalls: writes.length, operations: writes }));
  });
});
