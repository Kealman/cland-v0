// Native ownership shared by the report command and lifecycle controls.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { TestContext } from 'node:test';
import { fixtureEnvironment } from './fixture-environment.ts';
import { beforeDirectories, ownDirectory, ownProcess, captureProcess, recordedProcess } from './process-cleanup.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { remoteRedactor } from '../src/remote/redact.ts';

type Options = { capture?: typeof captureProcess; t?: TestContext; signal?: AbortSignal; beforeSpawn?: Promise<void>; setupMs?: number; runMs?: number; stopMs?: number };
export function cliSmokeOwner(root: string, options: Options = {}) {
  const abort = new AbortController();
  const signal = AbortSignal.any([abort.signal, ...(options.signal ? [options.signal] : []), ...(options.t ? [options.t.signal] : [])]);
  const gated = Promise.withResolvers<void>();
  void gated.promise.catch(() => {});
  const ready = Promise.withResolvers<void>();
  void ready.promise.catch(() => {});
  const closed = Promise.withResolvers<void>();
  let child: ChildProcess | undefined;
  let acquired: Promise<void> | undefined, preparing: Promise<unknown> | undefined;
  let disposal: Promise<void> | undefined;
  let stopPid: (() => Promise<void>) | undefined;
  let admitted = false, gateObserved = false;
  let ownership: 'not-started' | 'missing' | 'captured' | 'settled' | 'settled-unstarted' = 'not-started';
  let ownershipFailure: string | undefined;
  let didClose = false, forced = false;
  let rootPresent: boolean | null = null;
  let code: number | null = null, nativeSignal: string | null = null;
  let tail = '';
  const redact = remoteRedactor();
  function capture() {
    let pending = '', dropping = false;
    const flush = () => {
      tail = (tail + (dropping ? '[overlong diagnostic omitted]' : redact.text(pending))).slice(-8192);
      pending = ''; dropping = false;
    };
    return {
      write: (chunk: Buffer) => {
        for (const part of String(chunk).split(/(?<=\n)/)) {
          if (!dropping) pending += part;
          if (pending.length > 8192) { pending = ''; dropping = true; }
          if (part.endsWith('\n')) flush();
        }
      },
      close: flush,
    };
  }
  const dispose = () => disposal ??= (async () => {
    abort.abort(new Error('smoke owner disposed'));
    await within(Promise.allSettled([...(preparing ? [preparing] : []), ...(acquired ? [acquired] : [])]), 5000,
      undefined, () => new Error(`smoke acquisition/write drainage incomplete; root retained: ${root}`));
    if (!child) return;
    if (!didClose) {
      child.kill('SIGTERM');
      try { await within(closed.promise, options.stopMs ?? 1000); }
      catch { forced = true; child.kill('SIGKILL'); }
    }
    if (ownership === 'settled-unstarted') return;
    if (!stopPid || ownershipFailure) throw new Error(`smoke ownership incomplete: ${ownershipFailure ?? 'no captured identity'}; native close ${didClose}; root retained: ${root}`);
    await within(Promise.all([closed.promise, stopPid()]), 5000, undefined,
      () => new Error(`smoke native close incomplete; exit ${code}; signal ${nativeSignal}; ${tail}; root retained: ${root}`));
    ownership = 'settled';
  })();
  // Registered before any acquisition or copy: signal cleanup repeats the same barrier.
  if (options.t) beforeDirectories(options.t, dispose);
  const remove = ownDirectory(options.t, root, { beforeRemove: dispose });
  return {
    remove, dispose,
    reconcileUnstarted: async () => {
      // The wrapper cannot run application code without our admission frame.
      // Only an unreleased gate AND observed native close prove no descendants.
      if (admitted || !didClose) throw new Error('smoke unstarted reconciliation lacks native close/unreleased gate');
      ownership = 'settled-unstarted'; ownershipFailure = undefined; disposal = undefined;
    },
    prepare: <T>(work: () => Promise<T>): Promise<T> => {
      const task = Promise.resolve().then(() => { signal.throwIfAborted(); return work(); });
      preparing = task;
      return task;
    },
    run: async (args: string[]) => {
      if (acquired) throw new Error('smoke owner already launched');
      let incomplete: string | null = null;
      acquired = (async () => {
        await abortable(options.beforeSpawn ?? Promise.resolve(), signal);
        signal.throwIfAborted();
        if (!(args.length === 1 || args.length === 2 && args[0] === '-e')) throw new Error('unsupported smoke arguments');
        const wrapper = `
          import {createRequire} from 'node:module';
          import {pathToFileURL} from 'node:url';
          import {resolve} from 'node:path';
          const admitted = new Promise(resolve => process.once('message', frame => { if (frame?.type === 'smoke-admit') resolve(); }));
          process.send({type:'smoke-gated'});
          await admitted;
          const args = ${JSON.stringify(args)};
          process.argv = [process.execPath, ...args];
          if (args[0] === '-e') new Function('require', args[1])(createRequire(pathToFileURL(resolve('smoke-eval.cjs'))));
          else await import(pathToFileURL(resolve(args[0])).href);
        `;
        ownership = 'missing';
        child = spawn(process.execPath, ['--input-type=module', '-e', wrapper], { cwd: root, env: fixtureEnvironment(root, process.env), detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
        const stdout = capture(), stderr = capture();
        child.stderr!.on('data', stderr.write); child.stdout!.on('data', stdout.write);
        child.stderr!.once('close', stderr.close); child.stdout!.once('close', stdout.close);
        child.on('message', message => {
          const type = (message as {type?: string}).type;
          if (type === 'smoke-gated') { gateObserved = true; gated.resolve(); }
          if (type === 'smoke-ready') ready.resolve();
        });
        child.once('error', error => ready.reject(error));
        child.once('close', (exit, stop) => {
          code = exit; nativeSignal = stop; rootPresent = existsSync(root); didClose = true;
          gated.reject(new Error(`smoke closed before gate receipt; exit ${exit}; signal ${stop}`));
          ready.reject(new Error(`smoke closed before setup receipt; exit ${exit}; signal ${stop}`));
          closed.resolve();
        });
        await abortable(gated.promise, signal);
        try {
          const captured = (options.capture ?? captureProcess)(child.pid);
          if (!captured?.identity || captured.pid !== child.pid || captured.group !== child.pid) throw new Error('native identity/group capture unavailable');
          stopPid = ownProcess(undefined, child.pid);
          const registered = recordedProcess(child.pid!);
          if (registered?.identity !== captured.identity || registered.group !== captured.group) throw new Error('native identity registration unavailable');
          ownership = 'captured';
        } catch (error) {
          ownershipFailure = error instanceof Error ? error.message : String(error);
          throw new Error(`smoke ownership incomplete: ${ownershipFailure}`);
        }
        signal.throwIfAborted();
        admitted = true; // Fence an accepted/unknown IPC send before native I/O.
        child.send({type:'smoke-admit'});
      })();
      try {
        await within(abortable(acquired.then(() => ready.promise), signal), options.setupMs ?? 5000, undefined, () => new Error('smoke setup receipt deadline'));
        await within(abortable(closed.promise, signal), options.runMs ?? 15000, undefined, () => new Error('smoke run deadline'));
      } catch (error) { incomplete = error instanceof Error ? error.message : String(error); }
      try { await dispose(); }
      catch (error) { incomplete = `${incomplete ?? ''}; ${error instanceof Error ? error.message : String(error)}`; }
      return { pid: child?.pid, started: Boolean(child), closed: didClose, code, signal: nativeSignal, rootPresent, forced, ownership, gateObserved, admitted, incomplete, tail };
    },
  };
}
