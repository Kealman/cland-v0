// Durable collector ownership gates every territory mutation after bounded cleanup handoff.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { readFileSync, unlinkSync } from 'node:fs';
import { durableJson } from './executor/droplet/lease.ts';
import { parseStarted, processStartedAsync } from './hub/lock.ts';
import { run, which, type RunResult } from './doctor/report.ts';
import { pidAlive } from './project.ts';

export type MaintenanceOwner = { token: string; root: string; cwd: string; gitDirectory: string; host: string; pid: number; group: number; started: string };
export type OwnerState = 'gone' | 'mismatch' | 'alive' | 'unknown';
export type RecoveryServices = { inspect: (owner: MaintenanceOwner) => Promise<OwnerState>; kill: (owner: MaintenanceOwner) => void; wait: () => Promise<void>; now: () => number; alive?: (pid: number) => boolean; report?: (owner: MaintenanceOwner) => void };
export const maintenanceOwnerPath = (root: string): string => join(root, '.cland/run/git-maintenance-owner.json');
const reporters = new Map<string, (owner: MaintenanceOwner) => void>();
export function maintenanceRecoveryReporter(root: string, report: (owner: MaintenanceOwner) => void): () => void {
  reporters.set(root, report);
  return () => { if (reporters.get(root) === report) reporters.delete(root); };
}
export class MaintenanceRecoveryRequired extends Error {
  readonly owner: MaintenanceOwner;
  constructor(owner: MaintenanceOwner, nativeOutcome?: string) { super(`Git collector pid ${owner.pid} has unresolved ownership; territory mutations preserved until recovery confirms its group is gone${nativeOutcome ? `; native outcome: ${nativeOutcome}` : ''}`); this.owner = owner; }
}
function decode(root: string, text: string): MaintenanceOwner {
  const owner = JSON.parse(text) as MaintenanceOwner;
  if (owner.root !== resolve(root) || !owner.token || !Number.isSafeInteger(owner.pid) || owner.pid <= 1 || owner.pid === process.pid || owner.group !== owner.pid || typeof owner.started !== 'string' || !owner.started || owner.host !== hostname() || !isAbsolute(owner.gitDirectory) || ![resolve(root), join(resolve(root), '.cland/territory.git')].includes(owner.cwd)) throw new Error('invalid or foreign Git collector recovery receipt; preserve territory and inspect ownership');
  return owner;
}
export async function readMaintenanceOwner(root: string): Promise<MaintenanceOwner | null> {
  try { return decode(root, await readFile(maintenanceOwnerPath(root), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function writeMaintenanceOwner(root: string, owner: MaintenanceOwner): Promise<void> {
  await mkdir(dirname(maintenanceOwnerPath(root)), { recursive: true });
  await durableJson(maintenanceOwnerPath(root), owner);
}
function gcOwned(text: string, owner: MaintenanceOwner): boolean {
  const parts = text.trim().split(/\s+/);
  return parts[0] === String(owner.pid) && parts[1] === owner.host;
}
async function clearOwner(root: string, owner: MaintenanceOwner, clearGc = true, alive = pidAlive): Promise<void> {
  if ((await readMaintenanceOwner(root))?.token !== owner.token) throw new Error('Git collector ownership changed during recovery');
  const gc = join(owner.gitDirectory, 'gc.pid');
  try { if (clearGc && gcOwned(await readFile(gc, 'utf8'), owner) && !alive(owner.pid)) await unlink(gc); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await unlink(maintenanceOwnerPath(root));
}
function state(owner: MaintenanceOwner, started: string | null, members: string, valid: boolean): OwnerState {
  if (started !== null && started !== owner.started) return 'mismatch';
  if (!valid) return 'unknown';
  if (!members.trim()) return 'gone';
  return started === owner.started || !pidAlive(owner.pid) ? 'alive' : 'unknown';
}
async function inspect(owner: MaintenanceOwner, env: NodeJS.ProcessEnv): Promise<OwnerState> {
  const started = await processStartedAsync(owner.pid, 200, work => work(), 'UTC', env);
  const group = await run('pgrep', ['-g', String(owner.group)], env, 200);
  // Recheck after the group read: a replacement PID never authorizes a signal.
  const current = await processStartedAsync(owner.pid, 200, work => work(), 'UTC', env);
  if (started !== null && current !== null && started !== current) return 'mismatch';
  return state(owner, current, group.stdout, !group.error && (group.code === 0 || group.code === 1));
}
function kill(owner: MaintenanceOwner): void {
  try { process.kill(-owner.group, 'SIGKILL'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}
export async function recoverMaintenanceOwner(root: string, env: NodeJS.ProcessEnv = process.env, supplied?: RecoveryServices): Promise<void> {
  const owner = await readMaintenanceOwner(root);
  if (!owner) return;
  const io = supplied ?? { inspect: (value: MaintenanceOwner) => inspect(value, env), kill, wait: () => new Promise<void>(done => setTimeout(done, 20)), now: Date.now };
  const deadline = io.now() + 750;
  let observed = await io.inspect(owner);
  if (observed === 'alive') { io.kill(owner); do { observed = await io.inspect(owner); if (observed !== 'alive') break; await io.wait(); } while (io.now() < deadline); }
  if (observed === 'gone' || observed === 'mismatch') { await clearOwner(root, owner, observed === 'gone', io.alive ?? pidAlive); return; }
  (io.report ?? reporters.get(root))?.(owner);
  throw new MaintenanceRecoveryRequired(owner);
}
/** Init's synchronous territory path has the same bounded recovery and reuse refusal. */
export function recoverMaintenanceOwnerSync(root: string, env: NodeJS.ProcessEnv = process.env): void {
  let owner: MaintenanceOwner;
  try { owner = decode(root, readFileSync(maintenanceOwnerPath(root), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const inspectSync = (): OwnerState => {
    const start = spawnSync('ps', ['-o', 'lstart=', '-p', String(owner.pid)], { env: { ...env, TZ: 'UTC', LC_ALL: 'C' }, encoding: 'utf8', timeout: 200 });
    const group = spawnSync('pgrep', ['-g', String(owner.group)], { env, encoding: 'utf8', timeout: 200 });
    const again = spawnSync('ps', ['-o', 'lstart=', '-p', String(owner.pid)], { env: { ...env, TZ: 'UTC', LC_ALL: 'C' }, encoding: 'utf8', timeout: 200 });
    const before = start.status === 0 ? parseStarted(start.stdout) : null, current = again.status === 0 ? parseStarted(again.stdout) : null;
    if (before !== null && current !== null && before !== current) return 'mismatch';
    return state(owner, current, group.stdout ?? '', !start.error && !again.error && !group.error && (group.status === 0 || group.status === 1));
  };
  const deadline = Date.now() + 750;
  let observed = inspectSync();
  if (observed === 'alive') { kill(owner); do { observed = inspectSync(); if (observed !== 'alive') break; } while (Date.now() < deadline); }
  if (observed !== 'gone' && observed !== 'mismatch') { reporters.get(root)?.(owner); throw new MaintenanceRecoveryRequired(owner); }
  if (decode(root, readFileSync(maintenanceOwnerPath(root), 'utf8')).token !== owner.token) throw new Error('Git collector ownership changed during recovery');
  const gc = join(owner.gitDirectory, 'gc.pid');
  try { if (observed === 'gone' && gcOwned(readFileSync(gc, 'utf8'), owner) && !pidAlive(owner.pid)) unlinkSync(gc); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  unlinkSync(maintenanceOwnerPath(root));
}

/** The gate preserves PID/birth across execve, so gc.pid names the recorded owner. */
export function ownedMaintenanceRunner(root: string, cwd: string, gitDirectory: string): typeof run {
  return (bin, args, env, timeoutMs = 30_000, _stdin = false, signal) => new Promise<RunResult>(resolveResult => {
    if (signal?.aborted) { resolveResult({ code: null, stdout: '', stderr: '', error: 'cancelled' }); return; }
    const command = which(bin, env, cwd);
    if (!command) { resolveResult({ code: null, stdout: '', stderr: '', error: `missing executable: ${bin}` }); return; }
    const child = spawn(process.execPath, [fileURLToPath(new URL('../bin/owned-exec.ts', import.meta.url)), command, ...args], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', error: string | undefined, settled = false, closed = false;
    let owner: MaintenanceOwner | undefined;
    let signalAttempt: Promise<void> | undefined;
    const prepared = Promise.withResolvers<void>();
    let deadline: ReturnType<typeof setTimeout> | undefined, cleanup: ReturnType<typeof setTimeout> | undefined;
    const finish = async (code: number | null, incomplete = false) => {
      if (settled) return;
      settled = true; clearTimeout(deadline); clearTimeout(cleanup); signal?.removeEventListener('abort', abort);
      await signalAttempt;
      if (!incomplete && owner) {
        try { await recoverMaintenanceOwner(root, env); }
        catch (failure) { error = failure instanceof Error ? failure.message : String(failure); incomplete = true; }
      }
      if (incomplete) {
        // The durable owner takes over recovery; native observation handles must
        // not keep a stopped hub alive. Releasing them is no death receipt.
        child.unref();
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.stdio[3]?.destroy();
      }
      resolveResult({ code: error ? null : code, stdout, stderr, ...(error ? { error: incomplete ? `${error}; cleanup incomplete: collector pid ${owner?.pid ?? child.pid ?? 'unknown'} ownership retained` : error } : {}) });
    };
    const terminate = () => {
      error ??= 'cancelled';
      if (cleanup || settled) return;
      clearTimeout(deadline);
      child.stdio[3]?.destroy();
      if (owner && child.exitCode === null && child.signalCode === null) {
        // An unreaped native child handle pins this detached PID/group. It
        // cannot have been reused, so stop need not wait on an OS probe.
        kill(owner);
      } else if (owner) signalAttempt = inspect(owner, env).then(observed => { if (!closed && observed === 'alive') kill(owner!); }).catch(() => {});
      cleanup = setTimeout(() => { void prepared.promise.then(() => finish(null, true)); }, 750);
    };
    const abort = () => { error ??= 'cancelled'; terminate(); };
    child.stdout!.setEncoding('utf8').on('data', data => { stdout = (stdout + data).slice(-16 * 1024 * 1024); });
    child.stderr!.setEncoding('utf8').on('data', data => { stderr = (stderr + data).slice(-16 * 1024 * 1024); });
    child.once('error', failure => { error ??= failure.message; });
    child.once('close', (code, nativeSignal) => { closed = true; if (code === null) error ??= `native signal ${nativeSignal ?? 'unknown'}`; void prepared.promise.then(() => finish(code)); });
    child.stdio[3]?.on('error', () => { error ??= 'collector launch gate closed'; terminate(); });
    signal?.addEventListener('abort', abort, { once: true });
    void (async () => {
      try {
        const started = await processStartedAsync(child.pid!, 500, work => work(), 'UTC', env);
        if (closed || settled) return;
        if (!started) throw new Error('cannot establish collector birth identity before Git launch');
        owner = { token: randomUUID(), root: resolve(root), cwd: resolve(cwd), gitDirectory, host: hostname(), pid: child.pid!, group: child.pid!, started };
        await writeMaintenanceOwner(root, owner);
        if (closed || settled || signal?.aborted) { terminate(); return; }
        (child.stdio[3] as NodeJS.WritableStream).end(Buffer.from([1]));
        deadline = setTimeout(() => { error = `no answer within ${timeoutMs / 1000} s`; terminate(); }, timeoutMs);
      } catch (failure) { error ??= failure instanceof Error ? failure.message : String(failure); terminate(); }
      finally { prepared.resolve(); }
    })();
  });
}
