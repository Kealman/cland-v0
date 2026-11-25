import type { ChildProcess } from 'node:child_process';
import type { TestContext } from 'node:test';
import { stageCase } from './stage-case-fixture.ts';
import { tempProject } from './harness.ts';
import { cleanupProcesses, ownProcess } from './process-cleanup.ts';
import { eventually, testDeadlineMs } from './until.ts';

export type HandoverStep = <T>(name: string, run: () => Promise<T>) => Promise<T>;

/** Retain the complete callback and late acquisition producers before setup. */
export function handoverCase(t: TestContext) {
  const owner = stageCase(t, { native: true });
  const cancellation = new AbortController();
  owner.releaseOnClose(() => cancellation.abort(new Error('handover fixture closing')));
  const wait = <T>(name: string, run: () => Promise<T>) => owner.wait(name, run, testDeadlineMs(30_000));
  return {
    ...owner, wait, signal: cancellation.signal,
    root: () => wait('handover root setup', async () => {
      const root = await tempProject(owner.fixtures);
      owner.adoptRoot(root);
      return root;
    }),
    acquire<T>(name: string, run: () => Promise<T>, dispose: (value: T) => Promise<void>) {
      cancellation.signal.throwIfAborted();
      let value: T, acquired = false, closing: Promise<void> | undefined;
      const close = () => acquired ? closing ??= dispose(value) : Promise.resolve();
      owner.requireClose(close);
      owner.releaseOnClose(() => { void close().catch(() => {}); });
      return wait(name, async () => { value = await run(); acquired = true; return value; });
    },
    run: (body: (step: HandoverStep) => Promise<void>) =>
      wait('whole handover callback', () => owner.run(admit => body((name, run) => admit(() => wait(name, run))))),
  };
}

/** Enroll the close fence before spawn, then capture inside the retained producer. */
export function handoverChild(owner: ReturnType<typeof handoverCase>, root: string, launch: () => ChildProcess,
  control: { afterCapture?: () => void; beforeClose?: () => void } = {}) {
  let child: ChildProcess | undefined, stop: (() => Promise<void>) | undefined;
  let receipt: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  let stopping: Promise<void> | undefined;
  let tail = Buffer.alloc(0);
  const append = (bytes: Buffer | string) => {
    const chunk = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    tail = chunk.length >= 12_000 ? Buffer.from(chunk.subarray(-12_000))
      : Buffer.concat([tail.subarray(Math.max(0, tail.length + chunk.length - 12_000)), chunk]);
  };
  const stopKnown = () => {
    if (stop) return stopping ??= stop();
    return Promise.resolve();
  };
  owner.releaseOnClose(() => { void stopKnown().catch(() => {}); });
  owner.requireClose(async () => {
    control.beforeClose?.();
    if (!child) return;
    if (!stop) throw new Error('child ownership capture incomplete; root retained');
    await stopKnown();
    await cleanupProcesses(root, [], undefined, undefined, undefined, { discover: true });
    await owner.wait('child native close fence', async () => eventually('child native close', () => receipt));
  });
  child = launch();
  child.once('close', (code, signal) => { receipt = { code, signal }; });
  child.on('error', error => append(String(error)));
  for (const stream of [child.stdout, child.stderr]) stream?.on('data', append);
  stop = ownProcess(undefined, child.pid);
  control.afterCapture?.();
  return {
    child,
    stop: stopKnown,
    closeReceipt: () => receipt,
    observe: () => owner.wait('child native completion', async () => {
      try { return await eventually('child native completion', () => receipt, { timeoutMs: testDeadlineMs(30_000), loadFactor: 1 }); }
      catch (cause) { throw new Error(`incomplete child: code ${child?.exitCode}, signal ${child?.signalCode}; tail:\n${tail.toString()}`, { cause }); }
    }),
    diagnostic: () => tail.toString(),
  };
}
