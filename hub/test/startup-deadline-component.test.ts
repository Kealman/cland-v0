// T2: CLI start's deadline path with a fake spawned child and a fake clock.
// No daemon is launched: killing/reaping a real process is covered by startup-smoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { runHub } from '../src/cli/hub.ts';
import { tempProject } from './harness.ts';

test('hub start names this attempt\'s pending step before killing a child at its deadline', async t => {
  const root = await tempProject(t);
  const log = join(root, '.cland/log/hub.log');
  await mkdir(join(root, '.cland/log'), { recursive: true });
  await writeFile(log, JSON.stringify({ event: 'tracker-storage-stalled', operation: 'old attempt', item: 'T-99' }) + '\n');
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const spawned = Promise.withResolvers<void>();
  let killed = false;
  const child = Object.assign(new EventEmitter(), { pid: 99999999, unref() {}, kill(signal: string) { assert.equal(signal, 'SIGKILL'); killed = true; return true; } });
  t.mock.method(childProcess, 'spawn', () => {
    appendFileSync(log, JSON.stringify({ event: 'hub-startup-step', step: 'indexing tracker' }) + '\n' + JSON.stringify({ event: 'hub-startup-storage', suiteJobsBytes: 226304 }) + '\n');
    spawned.resolve();
    return child as unknown as ChildProcess;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let stderr = '';
  const starting = runHub(['start'], root, { out: () => assert.fail('unexpected success'), err: line => {
    assert.equal(killed, false, 'the diagnostic is emitted before SIGKILL'); stderr += line;
  } });
  await spawned.promise;
  t.mock.timers.tick(15_001);
  assert.equal(await starting, 1);
  assert.equal(killed, true);
  assert.match(stderr, /within 15 s/);
  assert.match(stderr, /last startup step: indexing tracker/);
  assert.match(stderr, /suite-jobs: 226304 bytes/);
  assert.doesNotMatch(stderr, /old attempt|T-99/);
});
