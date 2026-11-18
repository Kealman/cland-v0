// Native fixture commands keep their group owned through timeout, close and root cleanup.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import type { TestContext } from 'node:test';
import { beforeDirectories, guardDirectoryRemoval, ownProcess, recordedProcess } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { which } from '../src/doctor/report.ts';
import { fileURLToPath } from 'node:url';
import { pgrepMembers } from '../src/pgrep-result.ts';
import { processIdentitiesAsync } from '../src/process-identity.ts';
import { writerReceipt, type CapturedWriter } from './git-maintenance-writer.ts';

type Options = { signal?: AbortSignal; timeoutMs?: number; observe?: typeof processIdentitiesAsync };
export type WriterExit = CapturedWriter & { kind: 'close' | 'reaped'; code?: number | null; signal?: string | null };
type Output = { stdout: string; stderr: string; writers: WriterExit[]; cleanupDiagnostics: string[] };
export class FixtureCommandError extends Error {
  readonly code: number | null;
  readonly stderr: string;
  readonly nativeFailure: boolean;
  readonly writers: WriterExit[];
  readonly cleanupDiagnostics: string[];
  constructor(message: string, code: number | null, stderr: string, nativeFailure: boolean, writers: WriterExit[] = [], cleanupDiagnostics: string[] = []) { super(message); this.code = code; this.stderr = stderr; this.nativeFailure = nativeFailure; this.writers = writers; this.cleanupDiagnostics = cleanupDiagnostics; }
}
export function fixtureCommand(t: TestContext, root: string, bin: string, args: string[], input?: string, options: Options = {}): Promise<string> {
  return fixtureCommandOutput(t, root, bin, args, input, options).then(result => result.stdout.trim());
}
export function fixtureCommandOutput(t: TestContext, root: string, bin: string, args: string[], input?: string, options: Options = {}): Promise<Output> {
  let child: ChildProcess | undefined;
  let stop = async () => {};
  const closed = Promise.withResolvers<void>();
  const result = Promise.withResolvers<Output>();
  const writers = new Map<number, WriterExit>();
  const cleanupDiagnostics: string[] = [];
  const env = fixtureEnvironment(root, process.env);
  const observe = options.observe ?? processIdentitiesAsync;
  let admitted: CapturedWriter | undefined;
  let nativeClosed = false;
  const diagnostic = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (cleanupDiagnostics.length < 16 && !cleanupDiagnostics.includes(message)) cleanupDiagnostics.push(message.slice(-2000));
  };
  const pause = () => new Promise<void>(resolve => setTimeout(resolve, 10));
  let finished = false, stdout = '', stderr = '';
  let failure: string | undefined;
  let nativeFailure = false;
  let exit: number | null = null, nativeSignal: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let draining: Promise<void> | undefined;
  const drain = () => draining ??= (async () => {
    const list = () => {
      if (!admitted) return [];
      const listing = spawnSync('pgrep', ['-g', String(admitted.group)], { env: fixtureEnvironment(root, env), encoding: 'utf8', timeout: 3000 });
      return pgrepMembers({ code: listing.status, stdout: listing.stdout ?? '', stderr: listing.stderr ?? '', error: listing.error }).filter(pid => pid !== admitted!.pid);
    };
    let captured: CapturedWriter[] | undefined;
    // Bind group membership to stable births before cleanup. Missing listing or
    // identity stays incomplete; it cannot authorize rejection or native work.
    while (!captured) {
      try {
        const pids = list();
        const before = await observe(pids, env);
        const again = list();
        const after = await observe(pids, env);
        if (pids.length !== again.length || pids.some(pid => !again.includes(pid) || !before.get(pid) || before.get(pid) !== after.get(pid))) throw new Error('fixture writer capture incomplete: group or native birth changed');
        captured = pids.map(pid => ({ pid, birth: before.get(pid)!, group: admitted!.group }));
      } catch (error) { diagnostic(error); await pause(); }
    }
    // A bounded cleanup refusal is diagnostic, not the writer's exit receipt.
    // Keep the original cancellation and join native exit before publishing it.
    for (;;) {
      try { await stop(); break; }
      catch (error) { diagnostic(error); }
      if (nativeClosed) break;
      await pause();
    }
    await closed.promise;
    const deadline = Date.now() + 10_000;
    for (;;) {
      const pending = captured.filter(owner => !writers.has(owner.pid));
      if (!pending.length) return;
      // No new lifetime can inherit this receipt. The shared reader's zombie
      // callback lacks birth metadata, so await independent ESRCH instead.
      try {
        const identities = await observe(pending.map(owner => owner.pid), env);
        for (const owner of pending) {
          const birth = identities.get(owner.pid);
          let observation: Parameters<typeof writerReceipt>[1] = { kind: 'present', ...(birth ? { birth } : {}) };
          if (birth && birth !== owner.birth) diagnostic(`fixture writer ${owner.pid}: replacement birth observed; captured lifetime retained without signal authority`);
          try { process.kill(owner.pid, 0); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') observation = { kind: 'absent' };
            else { diagnostic(error); continue; }
          }
          const receipt = writerReceipt(owner, observation);
          if (receipt) writers.set(owner.pid, receipt);
        }
      } catch (error) { diagnostic(error); }
      if (pending.every(owner => writers.has(owner.pid))) return;
      if (Date.now() >= deadline) diagnostic(`incomplete fixture writer exit; exit ${exit ?? nativeSignal ?? 'unknown'}; stderr: ${stderr.slice(-2000) || '(empty)'}`);
      await pause();
    }
  })();
  // Register before spawn: a failed/abandoned setup still drains all writers.
  beforeDirectories(t, async () => { await drain(); await Promise.allSettled([result.promise]); });
  guardDirectoryRemoval(root, drain);
  const finish = async () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    try {
      await drain();
      if (failure || cleanupDiagnostics.length) result.reject(new FixtureCommandError(`${failure ?? 'fixture cleanup incomplete'}; exit ${exit ?? nativeSignal ?? 'unknown'}; stderr: ${stderr.slice(-2000) || '(empty)'}`, exit, stderr, nativeFailure, [...writers.values()], cleanupDiagnostics));
      else result.resolve({ stdout, stderr, writers: [...writers.values()], cleanupDiagnostics });
    } catch (error) { diagnostic(error); /* Unknown exit retains the result and guarded root. */ }
  };
  const abort = () => { failure ??= 'fixture command cancelled'; void finish(); };
  const command = which(bin, env, root);
  if (!command) { closed.resolve(); failure = `fixture command missing: ${bin}`; void finish(); return result.promise; }
  child = spawn(process.execPath, [fileURLToPath(new URL('../bin/owned-exec.ts', import.meta.url)), command, ...args], { cwd: root, env: fixtureEnvironment(root, env), detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
  stop = ownProcess(t, child.pid);
  const identity = child.pid === undefined ? undefined : recordedProcess(child.pid);
  if (identity?.identity && identity.group !== undefined && identity.group === child.pid) admitted = { pid: identity.pid, birth: identity.identity, group: identity.group };
  child.stdout!.setEncoding('utf8').on('data', data => { stdout += data; });
  child.stderr!.setEncoding('utf8').on('data', data => { stderr += data; });
  child.stdin!.on('error', () => {});
  child.stdio[3]?.on('error', () => {});
  child.once('error', error => { failure ??= error.message; });
  child.once('close', (code, signal) => {
    exit = code; nativeSignal = signal;
    nativeClosed = true;
    if (admitted) writers.set(admitted.pid, { ...admitted, kind: 'close', code, signal });
    closed.resolve();
    if (code !== 0 && failure === undefined) { failure = `fixture command exited ${code ?? signal}`; nativeFailure = true; }
    void finish();
  });
  timer = setTimeout(() => { failure ??= 'fixture command timed out'; void finish(); }, options.timeoutMs ?? 10_000);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  child.stdin!.end(input);
  if (!finished && !options.signal?.aborted && admitted) (child.stdio[3] as NodeJS.WritableStream).end(Buffer.from([1]));
  else { failure ??= 'fixture command ownership missing before launch'; child.stdio[3]?.destroy(); }
  void result.promise.catch(() => {});
  return result.promise;
}
