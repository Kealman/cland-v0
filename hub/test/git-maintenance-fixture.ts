// Native fixture commands keep their group owned through timeout, close and root cleanup.
import { spawn, type ChildProcess } from 'node:child_process';
import type { TestContext } from 'node:test';
import { beforeDirectories, ownProcess, recordedProcess } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { which } from '../src/doctor/report.ts';
import { fileURLToPath } from 'node:url';

type Options = { signal?: AbortSignal; timeoutMs?: number };
export class FixtureCommandError extends Error {
  readonly code: number | null;
  readonly stderr: string;
  readonly nativeFailure: boolean;
  constructor(message: string, code: number | null, stderr: string, nativeFailure: boolean) { super(message); this.code = code; this.stderr = stderr; this.nativeFailure = nativeFailure; }
}
export function fixtureCommand(t: TestContext, root: string, bin: string, args: string[], input?: string, options: Options = {}): Promise<string> {
  return fixtureCommandOutput(t, root, bin, args, input, options).then(result => result.stdout.trim());
}
export function fixtureCommandOutput(t: TestContext, root: string, bin: string, args: string[], input?: string, options: Options = {}): Promise<{ stdout: string; stderr: string }> {
  let child: ChildProcess | undefined;
  let stop = async () => {};
  const closed = Promise.withResolvers<void>();
  const result = Promise.withResolvers<{ stdout: string; stderr: string }>();
  let finished = false, stdout = '', stderr = '';
  let failure: string | undefined;
  let nativeFailure = false;
  let exit: number | null = null, nativeSignal: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drain = async () => { await stop(); await closed.promise; };
  // Register before spawn: a failed/abandoned setup still drains all writers.
  beforeDirectories(t, async () => { await drain(); await Promise.allSettled([result.promise]); });
  const finish = async () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    try {
      await drain();
      if (failure) result.reject(new FixtureCommandError(`${failure}; exit ${exit ?? nativeSignal ?? 'unknown'}; stderr: ${stderr.slice(-2000) || '(empty)'}`, exit, stderr, nativeFailure));
      else result.resolve({ stdout, stderr });
    } catch (error) { result.reject(error); }
  };
  const abort = () => { failure ??= 'fixture command cancelled'; void finish(); };
  const env = fixtureEnvironment(root, process.env);
  const command = which(bin, env, root);
  if (!command) { closed.resolve(); failure = `fixture command missing: ${bin}`; void finish(); return result.promise; }
  child = spawn(process.execPath, [fileURLToPath(new URL('../bin/owned-exec.ts', import.meta.url)), command, ...args], { cwd: root, env: fixtureEnvironment(root, env), detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
  stop = ownProcess(t, child.pid);
  child.stdout!.setEncoding('utf8').on('data', data => { stdout += data; });
  child.stderr!.setEncoding('utf8').on('data', data => { stderr += data; });
  child.stdin!.on('error', () => {});
  child.stdio[3]?.on('error', () => {});
  child.once('error', error => { failure ??= error.message; });
  child.once('close', (code, signal) => {
    exit = code; nativeSignal = signal;
    closed.resolve();
    if (code !== 0 && failure === undefined) { failure = `fixture command exited ${code ?? signal}`; nativeFailure = true; }
    void finish();
  });
  timer = setTimeout(() => { failure ??= 'fixture command timed out'; void finish(); }, options.timeoutMs ?? 10_000);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  child.stdin!.end(input);
  if (!finished && !options.signal?.aborted && child.pid !== undefined && recordedProcess(child.pid)) (child.stdio[3] as NodeJS.WritableStream).end(Buffer.from([1]));
  else { failure ??= 'fixture command ownership missing before launch'; child.stdio[3]?.destroy(); }
  void result.promise.catch(() => {});
  return result.promise;
}
