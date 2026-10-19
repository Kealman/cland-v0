// T1: pure startup-log interpretation, independent of daemon processes or time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startupDiagnostic } from '../src/cli/startup-diagnostic.ts';

const lines = (...entries: unknown[]) => entries.map(entry => JSON.stringify(entry)).join('\n');

test('startup diagnostic keeps the pending step and storage context past unrelated log noise', () => {
  const log = lines(
    { event: 'hub-startup-step', step: 'restoring hub state' },
    { event: 'hub-startup-storage', suiteJobsBytes: 226304 },
    { event: 'tracker-storage-stalled', operation: 'ready check', item: 'T-837' },
    ...Array.from({ length: 20 }, () => ({ event: 'request-slow' })),
  ) + '\nnon-JSON stderr\n{"event":';
  assert.equal(startupDiagnostic(log), 'last startup step: restoring hub state; tracker storage: ready check on T-837; suite-jobs: 226304 bytes; last log event: request-slow');
});

test('startup diagnostic handles absent and partial startup logs', () => {
  assert.equal(startupDiagnostic('stderr only\n'), 'last startup step: unknown; last log event: none recorded');
  assert.equal(startupDiagnostic(lines({ event: 'serving' }, { event: 'hub-startup-storage', suiteJobsBytes: 2 })), 'last startup step: serving; suite-jobs: 2 bytes; last log event: hub-startup-storage');
});
