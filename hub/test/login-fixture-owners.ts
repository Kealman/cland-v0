import type { ChildProcess } from 'node:child_process';
import { until } from './until.ts';
import type { TestContext } from 'node:test';
import { guardDirectoryRemoval, ownDirectory, ownProcess } from './process-cleanup.ts';

type Join = () => void | Promise<void>;

/** Root disposal follows positive completion of each registered resource join.
 * Diagnostic-only failures are separate from owners whose closure is unknown. */
export function loginFixtureOwners(t: TestContext) {
  const stack = new AsyncDisposableStack();
  const pending = new Set<Join>();
  const owners = {
    defer(join: Join) {
      pending.add(join);
      stack.defer(async () => { await join(); pending.delete(join); });
    },
    diagnostic(check: Join) { stack.defer(check); },
    directory(root: string) {
      const remove = ownDirectory(undefined, root);
      guardDirectoryRemoval(root, () => {
        if (pending.size) throw new Error(`login fixture cleanup incomplete; root retained: ${root}`);
      });
      stack.defer(remove);
    },
    disposeAsync: () => stack.disposeAsync(),
  };
  t.after(() => owners.disposeAsync());
  return owners;
}

/** Observe close independently from the public error result, before returning to the caller. */
export function loginChild(owners: ReturnType<typeof loginFixtureOwners>, child: ChildProcess) {
  let closed = false, code: number | null = null, failure: Error | undefined;
  child.on('error', error => { failure = error; });
  child.once('close', value => { code = value; closed = true; });
  let stop: (() => Promise<void>) | undefined;
  owners.defer(async () => {
    child.stdin?.end();
    if (!stop) throw new Error('login child ownership capture incomplete');
    await stop();
    await until(() => closed, { what: 'owned login child native close' });
  });
  stop = ownProcess(undefined, child.pid);
  return async () => {
    await until(() => closed, { what: 'login command native close' });
    if (failure) throw failure;
    return code;
  };
}
