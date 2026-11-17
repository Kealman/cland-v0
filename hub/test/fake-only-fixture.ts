import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { mock, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Guard native delegation, including already-promisified async launchers. */
function launchGuard() {
  let attempts = 0;
  const refuse = () => { attempts++; throw new Error('native launch forbidden in fake-only fixture'); };
  const originals = [cp.exec, cp.execFile];
  const restores: Array<() => void> = [];
  for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
    const replacement = Object.assign(refuse.bind(null), { [promisify.custom]: refuse });
    const patched = mock.method(cp, key, replacement as never);
    restores.push(() => patched.mock.restore());
  }
  const prototype = cp.ChildProcess.prototype as unknown as { spawn(options: unknown): unknown };
  const native = mock.method(prototype, 'spawn', refuse);
  restores.push(() => native.mock.restore());
  syncBuiltinESMExports();
  return {
    async control() {
      // Original custom implementations delegate to the guarded native spawn;
      // replacement callback and custom forms refuse directly.
      // cland-allow-child-env: positive launch controls call the installed refusal guard, which never creates a child or reads an environment
      for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) assert.throws(() => (cp[key] as Function)('fixture-control'), /native launch forbidden/);
      for (const fn of originals) await assert.rejects(async () => promisify(fn)('fixture-control'), /native launch forbidden/);
      for (const fn of [cp.exec, cp.execFile]) assert.throws(() => promisify(fn)('fixture-control'), /native launch forbidden/);
      assert.throws(() => prototype.spawn.call(new cp.ChildProcess(), {}), /native launch forbidden/);
      assert.equal(attempts, 12);
      attempts = 0;
    },
    close() {
      for (const restore of restores.reverse()) restore();
      syncBuiltinESMExports();
      assert.equal(attempts, 0, 'setup, body and cleanup never delegate to native launch');
    },
  };
}

/** Enroll before acquisition and join the entire body before removing its root. */
export async function fakeOnlyFixture<T>(t: TestContext, body: (root: string) => Promise<T>): Promise<T> {
  const guard = launchGuard();
  let root: string | undefined, work: Promise<T> | undefined, closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    await work?.catch(() => {});
    try { if (root) await rm(root, { recursive: true, force: true }); }
    finally { guard.close(); }
  })();
  t.after(close);
  work = Promise.resolve().then(async () => {
    await guard.control();
    root = await mkdtemp(join(tmpdir(), 'cland-fake-only-'));
    return body(root);
  });
  let value: T;
  try { value = await work; }
  catch (error) {
    try { await close(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'fake-only body failed; cleanup also failed', { cause: error }); }
    throw error;
  }
  await close();
  return value;
}
