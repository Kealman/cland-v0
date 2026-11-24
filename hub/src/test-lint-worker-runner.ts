import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realClock, type Clock, type ClockTimer } from './hub/clock.ts';
import type { TierEntry } from './suite-shards.ts';
import type { CachedTestLintFacts } from './test-lint.ts';

export type LintSource = { file: string; text: string; entry: TierEntry };
export type LintWarmReceipt = { files: number; facts: CachedTestLintFacts[]; peakHeapBytes: number; heapSizeLimitBytes: number };
export type LintExit = { code: number | null; signal: NodeJS.Signals | null };
export type LintAnalysis = { ready: Promise<number>; result: Promise<LintWarmReceipt>; closed: Promise<LintExit>; close: (reason?: Error) => Promise<LintExit> };
export class LintAnalysisError extends Error {
  readonly stage: string;
  readonly exit: LintExit;
  readonly diagnostic: string;
  constructor(stage: string, exit: LintExit, diagnostic: string, cause?: unknown) {
    super(`lint analysis ${stage}: code ${exit.code}, signal ${exit.signal}${diagnostic ? `; ${diagnostic}` : ''}`, { cause });
    this.stage = stage; this.exit = exit; this.diagnostic = diagnostic;
  }
}

export function warmLintSources(entries: LintSource[], started: (pid: number) => void = () => {}): Promise<LintWarmReceipt> {
  return startLintAnalysis(entries, started).result;
}

/** A separate process is required: the parent's V8 heap flags override Worker
 * resourceLimits even with empty execArgv/env. Accept facts only at native close. */
export function startLintAnalysis(entries: LintSource[], started: (pid: number) => void = () => {}, options: {
  clock?: Clock; startupMs?: number; analysisMs?: number; stopMs?: number; launch?: typeof spawn;
} = {}): LintAnalysis {
  const clock = options.clock ?? realClock;
  const ready = Promise.withResolvers<number>();
  const result = Promise.withResolvers<LintWarmReceipt>();
  const closed = Promise.withResolvers<LintExit>();
  // cland-allow-child-env: pure analysis subprocess has no inherited environment, credentials, loaders or Git authority
  const child = (options.launch ?? spawn)(process.execPath, ['--max-old-space-size=256', '--max-semi-space-size=16', fileURLToPath(new URL('./test-lint-worker.ts', import.meta.url))], {
    env: {}, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stage = 'startup', terminating = false, exited = false;
  let failure: Error | undefined;
  let receipt: LintWarmReceipt | undefined;
  let diagnostic = '';
  let deadline: ClockTimer | undefined;
  let kill: ClockTimer | undefined;
  const close = (reason = new Error('lint analysis cancelled')) => {
    if (!exited && !terminating) {
      terminating = true; failure ??= reason;
      clock.clearTimeout(deadline);
      child.kill('SIGTERM');
      kill = clock.setTimeout(() => { if (!exited) child.kill('SIGKILL'); }, options.stopMs ?? 5000);
    }
    return closed.promise;
  };
  const bound = (name: string, ms: number) => {
    clock.clearTimeout(deadline);
    deadline = clock.setTimeout(() => { void close(new Error(`lint analysis ${name} receipt missing after ${ms} ms`)); }, ms);
  };
  bound('startup', options.startupMs ?? 30_000);
  child.stderr!.on('data', (data: Buffer) => {
    // Retain at most 4 KiB while draining the pipe to native close.
    diagnostic = Buffer.concat([Buffer.from(diagnostic), data.subarray(-4096)]).subarray(-4096).toString('utf8');
  });
  child.on('error', error => { failure ??= error; });
  child.on('spawn', () => {
    child.send(entries, error => { if (error) void close(error); });
  });
  child.on('message', (message: unknown) => {
    if (terminating || !message || typeof message !== 'object') return;
    const value = message as LintWarmReceipt & { type: string; pid: number };
    if (value.type === 'started') {
      stage = 'analysis';
      bound('completion', options.analysisMs ?? 120_000);
      ready.resolve(value.pid);
      try { started(value.pid); } catch (error) { void close(error instanceof Error ? error : new Error(String(error))); }
    } else if (value.type === 'completed') receipt = value;
  });
  child.once('close', (code, signal) => {
    exited = true;
    clock.clearTimeout(deadline); clock.clearTimeout(kill);
    const exit = { code, signal };
    closed.resolve(exit);
    const error = failure ?? (code !== 0 || !receipt ? new LintAnalysisError(stage, exit, diagnostic) : undefined);
    if (error) { Object.assign(error, { stage, exit, diagnostic }); ready.reject(error); result.reject(error); }
    else { ready.reject(new LintAnalysisError('missing startup', exit, diagnostic)); result.resolve(receipt!); }
  });
  // Both promises retain their native error for observers without unhandled rejections.
  void ready.promise.catch(() => {}); void result.promise.catch(() => {});
  return { ready: ready.promise, result: result.promise, closed: closed.promise, close };
}
