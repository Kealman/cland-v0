import cp from 'node:child_process';
import { promisify } from 'node:util';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { afterCleanup, fenceFixtureCleanup } from './process-cleanup.ts';
import { isClandCliLaunch } from './tier-cli.ts';

/** Keep the positive guard through shared resources, hubs and directory cleanup. */
export async function fixtureNativeGuard(t: TestContext, options: { fenced?: boolean } = {}): Promise<void> {
  return fixtureGuard(t, false, options.fenced ?? false);
}

/** CLI subjects retain only the same synchronous exception as the T2 tripwire. */
export async function fixtureCliNativeGuard(t: TestContext): Promise<void> {
  return fixtureGuard(t, true, true);
}

async function fixtureGuard(t: TestContext, allowCli: boolean, fenced: boolean): Promise<void> {
  const cleanup = fenced ? fenceFixtureCleanup(t) : undefined;
  let guard: Awaited<ReturnType<typeof fakeNativeGuard>> | undefined;
  guard = await fakeNativeGuard(restore => (cleanup ? cleanup.release : (step: () => void) => afterCleanup(t, step))(() => {
    try { guard?.verify(); } finally { restore(); }
  }), { allowCli });
}

/** Install before fake launch overrides; verify after their cleanup, before restore. */
export async function fakeNativeGuard(registerRestore: (restore: () => void) => void, options: { allowCli?: boolean; afterInstall?: (method: string) => void } = {}) {
  const denied: string[] = [];
  const originals = new Map<string, unknown>();
  const methods = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const;
  for (const method of methods) originals.set(method, cp[method]);
  const prototypeSpawn = Reflect.get(cp.ChildProcess.prototype, 'spawn');
  let cliLaunch = false;
  const restore = () => {
    for (const [method, original] of originals) Reflect.set(cp, method, original);
    Reflect.set(cp.ChildProcess.prototype, 'spawn', prototypeSpawn);
    syncBuiltinESMExports();
  };
  // The caller's cleanup owner exists before the first manual mutation.
  registerRestore(restore);
  try {
    for (const method of methods) {
      const deny = () => { denied.push(method); throw new Error(`native launch forbidden: ${method}`); };
      const mocked = (...args: unknown[]) => {
        if (options.allowCli && method === 'execFile' && isClandCliLaunch(args[0], args[1])) {
          cliLaunch = true;
          try { return Reflect.apply(originals.get(method) as Function, cp, args); }
          finally { cliLaunch = false; }
        }
        return deny();
      };
      if (method === 'exec' || method === 'execFile') Object.defineProperty(mocked, promisify.custom, {
        configurable: true, value: async () => {
          denied.push(`${method}.custom`); throw new Error(`native launch forbidden: ${method}.custom`);
        },
      });
      if (!Reflect.set(cp, method, mocked)) throw new Error(`native guard installation refused: ${method}`);
      options.afterInstall?.(method);
    }
    if (!Reflect.set(cp.ChildProcess.prototype, 'spawn', function (this: cp.ChildProcess, ...args: unknown[]) {
      if (cliLaunch) return Reflect.apply(prototypeSpawn as Function, this, args);
      denied.push('ChildProcess.spawn'); throw new Error('native launch forbidden: ChildProcess.spawn');
    })) throw new Error('native guard prototype installation refused');
    syncBuiltinESMExports();
    // cland-allow-child-env: positive control invokes only the installed throwing guard; no native child receives arguments or environment
    for (const method of methods) assert.throws(() => Reflect.apply(cp[method], cp, ['guard-control', []]), /native launch forbidden/);
    assert.throws(() => Reflect.apply(Reflect.get(cp.ChildProcess.prototype, 'spawn'), new cp.ChildProcess(), [{}]), /native launch forbidden/);
    // cland-allow-child-env: positive custom-promisify control invokes only the installed throwing guard, never a native command
    await assert.rejects(promisify(cp.exec)('guard-control'), /native launch forbidden: exec.custom/);
    // cland-allow-child-env: positive custom-promisify control invokes only the installed throwing guard, never a native command
    await assert.rejects(promisify(cp.execFile)('guard-control'), /native launch forbidden: execFile.custom/);
    const controls = denied.length;
    return { verify: () => assert.equal(denied.length, controls, 'unexpected native launch, including custom promisifiers and cleanup'), restore };
  } catch (error) { restore(); throw error; }
}
