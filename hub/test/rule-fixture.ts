// In-process hub-rule fixture: no repository, native process table or Git reader.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { projectHub } from './harness.ts';
import type { FakeClock } from './fake-clock.ts';

export function ruleHub(t: TestContext, root: string, clock: FakeClock, env: Record<string, string> = {}) {
  // TaskWorktrees has a separate reader from the tracker. Answer only its
  // no-territory predicate; unexpected commands fail instead of spawning Git.
  const reader = t.mock.method(childProcess, 'execFile', ((file: string, args: string[], _options: unknown, callback: (...args: unknown[]) => void) => {
    assert.equal(file, 'git');
    assert.deepEqual(args, ['config', '--get', 'cland.managed']);
    queueMicrotask(() => callback(new Error('no territory'), '', 'no territory'));
    return new EventEmitter() as childProcess.ChildProcess;
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => {
    try {
      // Native Git absence is normally caught by the territory reader. Check the
      // calls again after the test so that catch cannot hide an unexpected command.
      for (const call of reader.mock.calls) {
        assert.equal(call.arguments[0], 'git');
        assert.deepEqual(call.arguments[1], ['config', '--get', 'cland.managed']);
      }
    } finally { reader.mock.restore(); syncBuiltinESMExports(); }
  });
  return projectHub(t, root, env, { clock, harnesses: 'fake', probes: 'fake' });
}
