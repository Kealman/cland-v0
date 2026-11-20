import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { processStartedAsync as processStarted } from './hub/lock.ts';
import { processIdentityAsync } from './process-identity.ts';
import { endProcess } from './system-processes.ts';
import { pruneCommand, scopedCommandFailure } from './host/agent/prune-command.ts';
import { CommandOutput } from './host/agent/command.ts';
import { whichAsync } from './doctor/report.ts';
import { gitLockReport } from './git-lock-report.ts';
import { prepareGitCommand, type GitCommandLease, type GitProcess, type GitClose } from './git-command-owner.ts';
import type { HostRunResult } from './host/host.ts';
import { gitCommandPolicy } from './git-command-policy.ts';
import { stat } from 'node:fs/promises';
import { gitReadCapabilities, PROMISOR_CONFIG_KEYS } from './git-read-capability.ts';

const nativePrune = {
  ordinaryRepository: (_cwd: string, env: NodeJS.ProcessEnv, _bin: string, probe: () => Promise<HostRunResult>): Promise<boolean> => {
    // GIT_CONFIG redirects `git config` alone, so it cannot prove the effective
    // configuration of an object-reading command in that environment.
    return env.GIT_CONFIG === undefined ? gitReadCapabilities.ordinary(probe) : Promise.resolve(false);
  },
  readCapability: async (bin: string, probe: () => Promise<HostRunResult>) => {
    const file = await stat(bin, { bigint: true });
    return gitReadCapabilities.supports(`${bin}:${file.dev}:${file.ino}:${file.size}:${file.mtimeNs}:${file.ctimeNs}`, bin, probe);
  },
  prepare: prepareGitCommand,
  executable: (cwd: string, env: NodeJS.ProcessEnv) => whichAsync('git', env, cwd),
  launch: (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv, bin: string, gated = true): ChildProcess => {
    if (!gated) return spawn(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    return spawn(process.execPath, [fileURLToPath(new URL('../bin/owned-exec.mjs', import.meta.url)), bin, ...args], {
      cwd, env, stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    });
  },
  identity: async (pid: number, env: NodeJS.ProcessEnv): Promise<GitProcess | null> => {
    const pidStarted = await processStarted(pid, undefined, undefined, undefined, env);
    const pidIdentity = await processIdentityAsync(pid, env);
    return pidStarted && pidIdentity ? { pid, pidStarted, pidIdentity } : null;
  },
  end: endProcess,
  schedule: (callback: () => void, ms: number) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
};
type OwnedCommand = { stop(): Promise<boolean>; settled: Promise<void>; gate(): void; incomplete(failure?: unknown): Promise<void> };
export type GitCommandRecovery = { retry(): Promise<boolean>; settled: Promise<void> };

/** The result and the writer settlement are separate receipts. A bounded result
 * never releases the durable writer obligation or its reachable retry owner. */
export class PruneProcesses {
  readonly native: typeof nativePrune;
  constructor(native: typeof nativePrune = nativePrune) { this.native = native; }
  #cancelled = false;
  #reason = 'prune cancelled';
  readonly #children = new Set<OwnedCommand>();
  #cancellation: Promise<boolean> | undefined;
  run<T>(work: () => Promise<T>): Promise<T> { return pruneCommand.run({ run: this.git.bind(this), command: this.command.bind(this) }, work); }
  get settled(): Promise<void> {
    return (async () => { while (this.#children.size) await Promise.all([...this.#children].map(child => child.settled)); })();
  }
  cancel(reason = 'prune cancelled'): Promise<boolean> {
    if (this.#cancellation) return this.#cancellation;
    if (!this.#cancelled) this.#reason = reason;
    this.#cancelled = true;
    for (const child of this.#children) child.gate();
    const children = [...this.#children];
    const work = Promise.allSettled(children.map(child => child.stop())).then(async results => {
      await Promise.all(results.map((row, index) => row.status === 'rejected' ? children[index]!.incomplete(row.reason) : undefined));
      return results.every(row => row.status === 'fulfilled' && row.value);
    });
    this.#cancellation = work;
    void work.finally(() => { if (this.#cancellation === work) this.#cancellation = undefined; }).catch(() => {});
    return work;
  }
  git(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv, input?: string): Promise<string> {
    return this.#execute(cwd, args, env, input).then(result => args.includes('-z') || args.includes('--null') ? result.stdout : result.stdout.trim());
  }
  command(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv, input?: string): Promise<HostRunResult> {
    return this.#execute(cwd, args, env, input).catch(scopedCommandFailure);
  }
  #execute(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv, input?: string, executable?: string, forceOwned: boolean | 'config-read' = false): Promise<HostRunResult> {
    if (this.#cancelled) return Promise.reject(Object.assign(new Error(`${this.#reason}; no further Git command admitted`), {
      code: 'CLAND_GIT_CANCELLED', nativeAdmission: 'no-process', nativeCleanup: 'complete',
    }));
    const policy = gitCommandPolicy(args);
    let gated = forceOwned === true || forceOwned !== 'config-read' && policy.kind === 'writer';
    let directArgs = forceOwned === 'config-read' ? args : policy.args;
    const output = new CommandOutput(16 * 1024 * 1024);
    const result = Promise.withResolvers<HostRunResult>();
    const closeSaved = Promise.withResolvers<void>();
    const settlement = Promise.withResolvers<void>();
    const prepared = Promise.withResolvers<void>();
    let child: ChildProcess | undefined, lease: GitCommandLease | undefined, receipt: GitProcess | null = null;
    let nativeClose: GitClose | undefined, failure: Error | undefined, exited = false, closePersisted = false, spawnError = false;
    let clearDeadline: (() => void) | undefined;
    const captured = new Map<number, GitProcess>();
    const finish = async () => {
      await lease?.clear();
      this.#children.delete(owned);
      settlement.resolve();
    };
    const error = (incomplete: boolean) => Object.assign(new Error(`${this.#reason}; ${incomplete ? 'native cleanup incomplete; retry owner retained' : nativeClose ? `Git closed (code=${nativeClose.code}, signal=${nativeClose.signal})` : !child ? 'no Git process admitted' : 'native close unconfirmed'}`), {
      code: (incomplete ? 'CLAND_GIT_INCOMPLETE' : 'CLAND_GIT_CANCELLED') as string | number, stdout: output.stdout, stderr: output.stderr,
      ...(nativeClose ? { nativeClose } : {}), nativeCleanup: incomplete ? 'incomplete' : 'complete',
      ...(!child || spawnError && child.pid === undefined ? { nativeAdmission: 'no-process' } : {}),
      recovery: { retry: () => this.cancel(), settled: this.settled } satisfies GitCommandRecovery,
    });
    const rejectWithLocks = async (failure: Error) => {
      // The first incomplete result may remain the selected result even if a
      // later close settles ownership. Publish its retained-lock facts now.
      try { failure.message += `; ${await gitLockReport(cwd)}`; }
      catch (diagnostic) { failure.message += `; secondary Git lock diagnostic unavailable: ${String(diagnostic).slice(-2048)}`; }
      result.reject(failure);
    };
    const owned: OwnedCommand = { settled: settlement.promise,
      incomplete: async secondary => {
        const incomplete = error(true);
        if (!child && failure) {
          Object.assign(incomplete, { code: Reflect.get(failure, 'code'), cause: failure });
          incomplete.message = `${failure.message}; cleanup incomplete; retry owner retained`;
        } else if (!this.#cancelled && nativeClose) {
          incomplete.code = nativeClose.code ?? 'CLAND_GIT_INCOMPLETE';
          incomplete.message = `Git closed (code=${nativeClose.code}, signal=${nativeClose.signal}); cleanup incomplete; retry owner retained`;
        }
        if (secondary) incomplete.message += `; secondary cleanup diagnostic: ${String(secondary).slice(-4096)}`;
        await rejectWithLocks(incomplete);
      },
      gate: () => { child?.stdio[3]?.destroy(); },
      stop: async () => {
        await prepared.promise;
        if (!child) { await finish(); return true; }
        await lease!.incomplete();
        if (nativeClose && !closePersisted) {
          await lease!.close(nativeClose); closePersisted = true; closeSaved.resolve();
        }
        const stopDeadline = Date.now() + 1000;
        let confirmed = nativeClose !== undefined;
        if (!nativeClose && receipt) {
          confirmed = await this.native.end(receipt, () => {}, 100, async () => lease!.checkpoint([...captured.values()]), {
            env, deadline: stopDeadline, allowReused: true, inspection: 'owned-tree', onCaptured: tree => { for (const row of tree) captured.set(row.pid, row); },
          });
        }
        for (const row of captured.values()) if (row.pid !== receipt?.pid) confirmed = await this.native.end(row, () => {}, 100, undefined, { env, deadline: stopDeadline, allowReused: true, inspection: 'owned-tree' }) && confirmed;
        if (confirmed) confirmed = await Promise.race([closeSaved.promise.then(() => true), new Promise<boolean>(done => {
          const timer = setTimeout(() => done(false), 200);
          void closeSaved.promise.then(() => clearTimeout(timer));
        })]);
        if (!confirmed) { await rejectWithLocks(error(true)); return false; }
        await finish();
        await rejectWithLocks(error(false));
        return true;
      },
    };
    this.#children.add(owned);
    void (async () => {
      try {
        const bin = executable ?? await this.native.executable(cwd, env);
        if (!bin) throw new Error('missing executable: git');
        const probe = async (argv: readonly string[], mode: true | 'config-read' = true) => {
          try { return await this.#execute(cwd, argv, env, undefined, bin, mode); }
          catch (error) {
            if ((error as { nativeCleanup?: string; code?: string }).nativeCleanup === 'incomplete' || (error as { code?: string }).code === 'CLAND_GIT_CANCELLED') throw error;
            return scopedCommandFailure(error as Parameters<typeof scopedCommandFailure>[0]);
          }
        };
        if (!forceOwned && !gated && !await this.native.readCapability(bin, () => probe(['--no-lazy-fetch', '--no-optional-locks', 'version']))) {
          // This fixed config-only query cannot fetch objects. It has the same
          // in-memory native owner as a direct read, without a durable writer.
          const ordinary = policy.localRepository && await this.native.ordinaryRepository(cwd, env, bin, () => probe(['--no-optional-locks', 'config', '--null', '--name-only', '--includes', '--get-regexp', PROMISOR_CONFIG_KEYS], 'config-read'));
          gated = !ordinary;
          if (ordinary) directArgs = gitCommandPolicy(args, false).args;
          else gitReadCapabilities.writerFallback(bin, cwd);
        }
        if (this.#cancelled) { await finish(); result.reject(error(false)); return; }
        lease = await this.native.prepare(cwd, env, undefined, this, undefined, !gated);
        lease.onRecovery?.(() => this.cancel(), this);
        if (this.#cancelled) { await finish(); result.reject(error(false)); return; }
        if (this.#cancelled) { await finish(); result.reject(error(false)); return; }
        child = this.native.launch(cwd, gated ? args : directArgs, env, bin, gated);
        child.once('exit', () => { exited = true; });
        child.once('error', error => { spawnError = true; failure ??= error; });
        child.stdin?.on('error', () => {});
        child.stdio[3]?.on('error', () => {});
        const collect = (stream: 'stdout' | 'stderr', text: string) => {
          output.append(stream, text);
          if (output.overflow) void this.cancel('Git command output exceeds 16 MiB').catch(() => {});
        };
        child.stdout?.setEncoding('utf8').on('data', text => collect('stdout', text));
        child.stderr?.setEncoding('utf8').on('data', text => collect('stderr', text));
        child.once('close', (code, signal) => {
          nativeClose = { code, signal }; clearDeadline?.();
          void (async () => {
            await prepared.promise;
            if (this.#cancelled) {
              await lease!.close(nativeClose!);
              closePersisted = true;
              closeSaved.resolve();
              // A later native close retries the same retained owner; it never
              // equates leader close with disappearance of captured descendants.
              await this.#cancellation?.catch(() => false);
              await this.cancel();
              return;
            }
            await finish();
            // Ordinary native close retires its still-valid writer record.
            // A crash before retirement leaves that record for normal recovery.
            closeSaved.resolve();
            if (failure || code !== 0) result.reject(Object.assign(failure ?? new Error(output.stderr.trim() || `Git exited ${code}`), {
              code: failure ? (failure as NodeJS.ErrnoException).code : code, stdout: output.stdout, stderr: output.stderr, nativeClose, nativeCleanup: 'complete',
            }));
            else result.resolve({ code: 0, stdout: output.stdout, stderr: output.stderr, nativeClose, nativeCleanup: 'complete' });
          })().catch(error => owned.incomplete(error));
        });
        clearDeadline = this.native.schedule(() => { void this.cancel('Git command timed out after 30000 ms').catch(() => {}); }, 30_000);
        // The native child can be reaped while inherited pipes delay close.
        // Both sides of asynchronous observation must still name the original
        // live ChildProcess; a replacement PID never acquires authority.
        const live = () => !exited && child!.exitCode === null && child!.signalCode === null;
        if (child.pid !== undefined && live()) {
          const observed = await this.native.identity(child.pid, env);
          if (live()) receipt = observed;
        }
        if (!receipt && gated) {
          failure ??= new Error('original Git gate birth unavailable or child exited during identity capture');
          this.#cancelled = true; this.#reason = failure.message; owned.gate();
        } else if (receipt) {
          await lease.bind(receipt);
          if (!this.#cancelled && live()) {
            await lease.releaseGate();
            if (!this.#cancelled && live()) {
              lease.onLive?.(receipt, () => !this.#cancelled && live() && child!.pid === receipt!.pid);
              if (gated) (child.stdio[3] as NodeJS.WritableStream).end(Buffer.from([1]));
            }
            else owned.gate();
          } else owned.gate();
        }
        child.stdin?.end(input);
      } catch (error) {
        failure ??= error as Error;
        if (!child) {
          await finish();
          // A nested capability/config producer can have admitted a child even
          // though this outer command has not. Its receipt and retry owner win.
          const producer = error as Error;
          const native = ['nativeAdmission', 'nativeCleanup', 'nativeClose', 'recovery'].some(key => Object.hasOwn(producer, key));
          result.reject(native ? producer : Object.assign(producer, { nativeAdmission: 'no-process', nativeCleanup: 'complete' }));
        }
        else { this.#cancelled = true; this.#reason = failure.message; owned.gate(); }
      } finally {
        prepared.resolve();
        if (this.#cancelled) void this.cancel().catch(() => {});
      }
    })().catch(error => owned.incomplete(error));
    return result.promise;
  }
}
