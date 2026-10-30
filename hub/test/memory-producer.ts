// One pre-registered native producer owner for manual probes and their controls.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { remoteRedactor } from '../src/remote/redact.ts';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownProcess, beforeDirectories, onCleanup } from './process-cleanup.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';

export type MemoryClose = { code: number | null; signal: string | null; pid: number | undefined; rootPresent: boolean };
export function requestMemoryStop(child: ChildProcess): void {
  if (child.connected) child.send({ type: 'memory-stop' }, () => {});
}
export function memoryProducer(t: TestContext, root: string, args: string[], stopMs = 10_000, options: { detached?: boolean } = {}) {
  const owner = pacingOwner(t);
  const ready = Promise.withResolvers<void>();
  void ready.promise.catch(() => {});
  const acquired = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<MemoryClose>(); // Never expires or rejects.
  let child: ChildProcess | undefined;
  let stopPid = async () => {};
  let forced = false;
  let tail = '';
  const writeFailures: string[] = [];
  let nativeReceipt: MemoryClose | undefined;
  let disposal: Promise<void> | undefined;
  owner.close(async () => {
    if (!child) return;
    requestMemoryStop(child);
    try { await within(closed.promise, stopMs); }
    catch { forced = true; await stopPid(); await within(closed.promise, stopMs); }
  });
  // Receipt finalization follows all closers AND owned observers/writes; closers
  // run concurrently inside pacingOwner and cannot publish the final facts.
  const dispose = () => disposal ??= (async () => {
    let failure: unknown;
    try { await owner.dispose(); } catch (error) { failure = error; }
    const receipt = nativeReceipt;
    await writeFile(join(root, 'supervisor-outcome.json'), JSON.stringify({
      ...(receipt ?? { code: null, signal: null, pid: child?.pid, rootPresent: existsSync(root) }),
      nativeClose: receipt ? 'confirmed' : child ? 'unconfirmed' : 'not-started', forced,
      incomplete: Boolean(failure) || forced || !receipt || receipt.code !== 0 || writeFailures.length > 0,
      writeFailures, diagnosticTail: tail,
    }));
    if (failure) throw failure;
    if (child && !receipt) throw new Error('memory producer native close is unconfirmed; root retained');
  })();
  onCleanup(t, dispose);
  beforeDirectories(t, dispose);
  // Register the owner and its native-close disposer before spawn.
  const start = () => {
    child = spawn(process.execPath, args, { cwd: root, env: fixtureEnvironment(root, process.env, { NODE_TEST_CONTEXT: undefined }), detached: options.detached ?? false, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    stopPid = ownProcess(undefined, child.pid);
    const redact = remoteRedactor();
    const capture = () => {
      let pending = '', dropping = false;
      const emit = (line: string) => { tail = (tail + redact.text(line) + '\n').slice(-4096); };
      return { write: (chunk: Buffer) => {
        for (const part of String(chunk).split(/(?<=\n)/)) {
          if (!dropping) pending += part;
          if (pending.length > 4096) { pending = ''; dropping = true; }
          if (part.endsWith('\n')) {
            if (dropping) emit('[overlong diagnostic line omitted]'); else emit(pending);
            pending = ''; dropping = false;
          }
        }
      }, close: () => { if (pending && !dropping) emit(pending); pending = ''; } };
    };
    const stdout = capture(), stderr = capture();
    child.stdout?.on('data', stdout.write); child.stderr?.on('data', stderr.write);
    child.stdout?.once('close', stdout.close); child.stderr?.once('close', stderr.close);
    child.once('error', error => { ready.reject(error); acquired.resolve(); });
    child.on('message', message => {
      const value = message as { type?: string };
      if (value.type === 'memory-started') started.resolve();
      if (value.type === 'memory-ready') ready.resolve();
      if (value.type === 'memory-acquiring') acquired.resolve();
    });
    let exit: { code: number | null; signal: string | null } | undefined;
    let stdoutClosed = !child.stdout, stderrClosed = !child.stderr;
    const maybeClosed = () => { if (exit && stdoutClosed && stderrClosed) finish(exit.code, exit.signal); };
    child.once('exit', (code, signal) => { exit = { code, signal }; maybeClosed(); });
    child.stdout?.once('close', () => { stdoutClosed = true; maybeClosed(); });
    child.stderr?.once('close', () => { stderrClosed = true; maybeClosed(); });
    const finish = (code: number | null, signal: string | null) => {
      ready.reject(new Error(`memory producer closed before readiness: ${code ?? signal}; ${tail}`));
      acquired.resolve(); started.resolve();
      nativeReceipt ??= { code, signal, pid: child?.pid, rootPresent: existsSync(root) };
      closed.resolve(nativeReceipt);
    };
    child.once('close', finish);
    return child;
  };
  const observe = (fact: Promise<void>, signal?: AbortSignal) => {
    const work = owner.observe(owned => within(abortable(fact, signal ? AbortSignal.any([owned, signal]) : owned), 5000));
    void work.catch(() => {});
    return work;
  };
  return { start, ready: (signal?: AbortSignal) => observe(ready.promise, signal), acquiring: () => observe(acquired.promise), started: () => observe(started.promise),
    native: closed.promise, dispose, close: owner.close,
    own: <T>(promise: Promise<T>) => { const work = owner.observe(() => promise, { drain: true }); void work.catch(() => { writeFailures.push('owned write failed'); }); return work; },
    join: (ms = 120_000) => { const work = owner.observe(() => within(closed.promise, ms), { drain: true }); void work.catch(() => {}); return work; },
    tail: () => tail, forced: () => forced };
}
