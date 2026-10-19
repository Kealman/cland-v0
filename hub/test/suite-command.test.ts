// T2: diagnostic wording uses a fake child; no real processes or wall-clock waits.
// T1 lint conservatively rejects the mocked child_process import (T-682).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { suiteCommand } from '../src/suite-command.ts';

test('non-npm command signal diagnostic uses stack-neutral wording', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
  t.mock.method(cp, 'spawn', (bin: string, args: string[]) => {
    // Process-table inspection is irrelevant to the signal diagnostic.
    if (bin === 'ps') throw new Error('no real process table in this fixture');
    assert.equal(bin, '/bin/sh');
    assert.deepEqual(args, ['-c', 'python -m pytest']);
    queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => {
    child.stdout.destroy(); child.stderr.destroy();
    t.mock.restoreAll(); syncBuiltinESMExports();
  });
  const outcome = await suiteCommand('python -m pytest', process.cwd(), {
    CLAND_SUITE_LIMITS_CWD: process.cwd(),
    CLAND_SUITE_LIMITS: JSON.stringify({ stallTimeoutMs: 1000 }),
  });
  assert.deepEqual(outcome, { code: 1, cause: 'command terminated by SIGTERM' });
});
