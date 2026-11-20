import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { TestContext } from 'node:test';
import { PruneProcesses } from '../src/prune-processes.ts';
import { stageCase } from './stage-case-fixture.ts';
import type { GitCommandLease, GitProcess } from '../src/git-command-owner.ts';

export type ExactProcessObservation = { state: 'alive' | 'absent' | 'unknown'; owner: GitProcess; cause: 'same-birth' | 'native-ESRCH' | 'birth-replaced' | 'observation-unknown'; native: { before: string; after?: string; birth?: string | null } };

export { withCleanupAsync } from '../src/cleanup.ts';
/** Fixture observations never grant signal authority. Missing native metadata
 * stays unknown unless an independent kill(0) ESRCH confirms absence. */
export async function exactProcessObservation(owner: GitProcess, io: {
  probe(pid: number): 'present' | string;
  birth(pid: number): Promise<string | null>;
}): Promise<ExactProcessObservation> {
  const before = io.probe(owner.pid);
  const native: ExactProcessObservation['native'] = { before };
  const receipt = (state: ExactProcessObservation['state'], cause: ExactProcessObservation['cause']): ExactProcessObservation => ({ state, cause, owner: { ...owner }, native: { ...native } });
  if (before !== 'present' && before !== 'ESRCH') return receipt('unknown', 'observation-unknown');
  if (before === 'ESRCH') { native.after = io.probe(owner.pid); return native.after === 'ESRCH' ? receipt('absent', 'native-ESRCH') : receipt('unknown', 'observation-unknown'); }
  const birth = await io.birth(owner.pid);
  const after = io.probe(owner.pid);
  native.birth = birth; native.after = after;
  if (after === 'ESRCH') return receipt('absent', 'native-ESRCH');
  if (after !== 'present' || !birth) return receipt('unknown', 'observation-unknown');
  return birth === owner.pidIdentity ? receipt('alive', 'same-birth') : receipt('absent', 'birth-replaced');
}

export function pruneCase(t: TestContext, body: (scope: ReturnType<typeof stageCase>, step: <T>(name: string, work: () => Promise<T>) => Promise<T>) => Promise<void>, native = false) {
  const scope = stageCase(t, { native });
  return scope.wait('whole prune acceptance case', () => scope.run(async admit => {
    await body(scope, (name, work) => admit(() => scope.wait(name, work, native ? 30_000 : 5000)));
  }), native ? 60_000 : 10_000);
}
/** Observe admission/results while retaining each real command owner before launch. */
export function observePruneGit(scope: ReturnType<typeof stageCase>, observer: (call: Parameters<PruneProcesses['git']>, run: () => Promise<string>) => Promise<string>) {
  const git = PruneProcesses.prototype.git;
  const owners = new WeakSet<PruneProcesses>();
  scope.patch(PruneProcesses.prototype, 'git', function (this: PruneProcesses, ...call: Parameters<typeof git>) {
    if (!owners.has(this)) {
      owners.add(this);
      scope.requireClose(async () => { await this.cancel(); await this.settled; });
    }
    return scope.wait('observed native Git admission/result', () => observer(call, () => Reflect.apply(git, this, call)), 30_000);
  });
}
export function fakePrune(scope: ReturnType<typeof stageCase>) {
  const started = Promise.withResolvers<void>();
  const identity: GitProcess = { pid: 41001, pidStarted: 'owned-start', pidIdentity: 'owned-birth' };
  const signals: GitProcess[] = [];
  const stream = () => Object.assign(new EventEmitter(), { setEncoding() { return this; } });
  const gate = Object.assign(new EventEmitter(), { end() { started.resolve(); }, destroy() {} });
  const child = Object.assign(new EventEmitter(), { pid: identity.pid, exitCode: null as number | null, signalCode: null as string | null,
    stdin: { on() {}, end() {} }, stdout: stream(), stderr: stream(), stdio: [null, null, null, gate] });
  let canConfirm = true, launches = 0, clearFails = false, launchFailure: Error | undefined;
  const calls: Array<{ args: readonly string[]; gated: boolean }> = [];
  const bound: GitProcess[] = [];
  let observe = async () => identity as GitProcess | null;
  let deadline: (() => void) | undefined;
  const lease: GitCommandLease = { path: '/fake/receipt', bind: async row => { bound.push(row); }, releaseGate: async () => {}, checkpoint: async () => {},
    incomplete: async () => {}, close: async () => {}, clear: async () => { if (clearFails) throw new Error('controlled lease clear rejection'); } };
  const owner = new PruneProcesses({ prepare: async () => lease,
    readCapability: async () => true,
    ordinaryRepository: async () => false,
    executable: async () => '/fake/git',
    launch: (_cwd, args, _env, _bin, gated = true) => { launches++; calls.push({ args, gated }); if (launchFailure) throw launchFailure; if (!gated) started.resolve(); return child as unknown as ChildProcess; }, identity: () => observe(),
    end: async row => { signals.push(row as GitProcess); return canConfirm; },
    schedule: callback => { deadline = callback; return () => { deadline = undefined; }; },
  });
  let didClose = false;
  const close = (code = 0, signal: string | null = null) => {
    if (didClose) return;
    didClose = true; child.exitCode = code; child.signalCode = signal;
    child.emit('exit', code, signal); child.emit('close', code, signal);
  };
  scope.releaseOnClose(() => { canConfirm = true; clearFails = false; close(); });
  scope.requireClose(async () => { canConfirm = true; clearFails = false; close(); await owner.cancel(); await owner.settled; });
  return { owner, child, identity, signals, bound, started: started.promise, close, deadline: () => deadline?.(),
    launches: () => launches, calls: () => calls, failLaunch: (error: Error) => { launchFailure = error; }, confirm: (value: boolean) => { canConfirm = value; }, observe: (value: typeof observe) => { observe = value; }, rejectClear: (value: boolean) => { clearFails = value; } };
}
