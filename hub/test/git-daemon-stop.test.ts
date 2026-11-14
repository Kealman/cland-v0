import test from 'node:test';
import assert from 'node:assert/strict';
import { stopGitDaemon } from '../src/host/git-daemon-stop.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

for (const proof of [null, { pid: 123 }]) {
  test(`close joins exiting daemon after ${proof ? 'stop returns false' : 'identity returns null'}`, async () => {
    const identity = deferred<typeof proof>();
    const close = deferred<void>();
    const stopping = deferred<boolean>();
    const entered = deferred<void>();
    let completed = false;
    let settled = false;
    let stopCalls = 0;
    const result = stopGitDaemon({
      disconnect() {}, identity: identity.promise, completed: () => completed,
      stop: async () => { stopCalls++; entered.resolve(); return stopping.promise; },
      done: close.promise,
    }).finally(() => { settled = true; });
    // Attach the rejection observer before releasing any boundary, including on red.
    const success = assert.doesNotReject(result);
    identity.resolve(proof);
    if (proof) { await entered.promise; stopping.resolve(false); }
    await Promise.resolve();
    assert.equal(settled, false, 'close receipt is still held');
    completed = true;
    close.resolve();
    await success;
    assert.equal(stopCalls, proof ? 1 : 0);
  });
}

for (const proof of [null, { pid: 123 }]) test(`live daemon with ${proof ? 'refused stop' : 'no identity'} fails bounded close`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let stopCalls = 0;
  const entered = deferred<void>();
  const result = stopGitDaemon({ disconnect() {}, identity: Promise.resolve(proof),
    completed: () => false, stop: async () => { stopCalls++; return false; },
    done: new Promise<void>(() => {}),
  });
  const rejected = assert.rejects(result, /Git daemon termination incomplete/);
  // Drain the identity and stop continuations before advancing the close bound.
  queueMicrotask(() => queueMicrotask(() => entered.resolve()));
  await entered.promise;
  t.mock.timers.tick(5_000);
  await rejected;
  assert.equal(stopCalls, proof ? 1 : 0);
});

test('close delivered during a refused stop settles the captured child', async () => {
  const close = deferred<void>();
  let completed = false;
  await stopGitDaemon({ disconnect() {}, identity: Promise.resolve({ pid: 123 }),
    completed: () => completed, done: close.promise,
    stop: async () => { completed = true; close.resolve(); return false; },
  });
  assert.equal(completed, true);
});
