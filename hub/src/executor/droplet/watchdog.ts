import { realClock, type Clock } from '../../hub/clock.ts';
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processStartedAsync } from '../../hub/lock.ts';
import { processIdentityAsync, processIdentitiesAsync } from '../../process-identity.ts';
import { DigitalOceanApi } from './api.ts';
import { settleSpend } from './spend.ts';
import { deleteLeaseResources } from './cleanup.ts';
import { accountRelease, durableJson, readLease, type DropletLease, type WatchdogReceipt } from './lease.ts';

export const pause = (ms: number, clock: Clock = realClock): Promise<void> => new Promise(r => clock.setTimeout(r, ms));
export const testTiming = (key: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number => {
  const value = Number(env[key]);
  return value > 0 && Number.isFinite(value) ? value : fallback;
};
type WatchdogChild = { child: ChildProcess; startedUtc: string; pidIdentity: string; closed: Promise<void> };
const children = new Map<number, WatchdogChild>();

/** OS boundary for restart recovery; native child handles stay owned separately. */
export type WatchdogProcesses = {
  started(pid: number, env: NodeJS.ProcessEnv): Promise<string | null>;
  identity(pid: number, env: NodeJS.ProcessEnv, timeoutMs?: number): Promise<string | null>;
  alive(pid: number): boolean;
  signal(pid: number, signal: NodeJS.Signals): void;
};
const nativeProcesses: WatchdogProcesses = {
  started: (pid, env) => processStartedAsync(pid, undefined, undefined, 'UTC', env),
  identity: async (pid, env, timeoutMs) => (await processIdentitiesAsync([pid], env, timeoutMs)).get(pid) ?? null,
  alive: pid => {
    try { process.kill(pid, 0); return true; }
    catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
  },
  signal: (pid, signal) => { process.kill(pid, signal); },
};
export type WatchdogOptions = {
  processes?: WatchdogProcesses;
  clock?: Clock;
  checkpoint?: (watchdog: NonNullable<DropletLease['watchdog']>) => Promise<void>;
};

async function closedWithin(closed: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([closed.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), ms); })]);
  } finally { clearTimeout(timer); }
}

async function stoppedWithin(watchdog: NonNullable<DropletLease['watchdog']>, owned: WatchdogChild | undefined, ms: number, env: NodeJS.ProcessEnv, options: WatchdogOptions): Promise<boolean> {
  if (owned) return closedWithin(owned.closed, ms);
  // After a hub restart there is no ChildProcess receipt. Observe the persisted
  // identity disappearing; an unavailable native probe alone is not proof of exit.
  const clock = options.clock ?? realClock;
  const processes = options.processes ?? nativeProcesses;
  const deadline = clock.now().getTime() + ms;
  while (clock.now().getTime() < deadline) {
    if (!processes.alive(watchdog.pid)) return true;
    const identity = await processes.identity(watchdog.pid, env, Math.max(1, Math.min(1000, deadline - clock.now().getTime())));
    if (identity !== null && identity !== watchdog.pidIdentity) return true;
    await pause(Math.min(25, Math.max(0, deadline - clock.now().getTime())), clock);
  }
  return false;
}
export async function watchdogAlive(lease: DropletLease, env: NodeJS.ProcessEnv = process.env, options: WatchdogOptions = {}): Promise<boolean> {
  if (!lease.watchdog) return false;
  const watchdog = lease.watchdog;
  const processes = options.processes ?? nativeProcesses;
  if (!watchdog.pidIdentity) {
    // Legacy timestamps alone cannot authorize a signal. Bind one matching UTC
    // start observation to a stable native birth, and persist before adopting it.
    if (!options.checkpoint) return false;
    const before = await processes.identity(watchdog.pid, env);
    const started = await processes.started(watchdog.pid, env);
    const after = await processes.identity(watchdog.pid, env);
    if (!before || before !== after || started !== watchdog.startedUtc) return false;
    await options.checkpoint({ ...watchdog, pidIdentity: before });
    if (lease.watchdog !== watchdog) return false;
    watchdog.pidIdentity = before;
  }
  const identity = await processes.identity(watchdog.pid, env);
  return identity !== null && identity === watchdog.pidIdentity;
}
export async function stopWatchdog(lease: DropletLease, env: NodeJS.ProcessEnv = process.env, options: WatchdogOptions = {}): Promise<void> {
  if (!lease.watchdog) return;
  const watchdog = lease.watchdog;
  const candidate = children.get(watchdog.pid);
  const owned = candidate?.startedUtc === watchdog.startedUtc && (!watchdog.pidIdentity || candidate.pidIdentity === watchdog.pidIdentity) ? candidate : undefined;
  if (!owned && (!await watchdogAlive(lease, env, options) || lease.watchdog !== watchdog)) return;
  const signal = async (signal: NodeJS.Signals) => {
    if (owned) { owned.child.kill(signal); return; }
    // Revalidate before each signal, including escalation: the old PID may have
    // been reaped and reused while we waited for its exit.
    if (!await watchdogAlive(lease, env, options) || lease.watchdog !== watchdog) return;
    try { (options.processes ?? nativeProcesses).signal(watchdog.pid, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  const grace = testTiming('CLAND_TEST_DROPLET_WATCHDOG_STOP_MS', 5000, env);
  await signal('SIGTERM');
  if (await stoppedWithin(watchdog, owned, grace, env, options)) return;
  await signal('SIGKILL');
  if (!await stoppedWithin(watchdog, owned, grace, env, options)) throw new Error('droplet watchdog did not stop within its time bound');
}
export async function armWatchdog(dir: string, env: NodeJS.ProcessEnv = process.env): Promise<NonNullable<DropletLease['watchdog']>> {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), dir], { env, detached: true, stdio: 'ignore' });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  const pid = child.pid!;
  const before = await processIdentityAsync(pid, env);
  const startedUtc = await processStartedAsync(pid, undefined, undefined, 'UTC', env);
  const pidIdentity = await processIdentityAsync(pid, env);
  if (!startedUtc || !before || before !== pidIdentity) {
    // This child is still ours, so its ChildProcess handle is safe to stop.
    child.kill('SIGKILL');
    await closedWithin(closed, testTiming('CLAND_TEST_DROPLET_WATCHDOG_STOP_MS', 5000, env));
    throw new Error('could not verify the droplet watchdog process identity');
  }
  const owned = { child, startedUtc, pidIdentity, closed };
  children.set(pid, owned);
  void closed.then(() => { if (children.get(pid) === owned) children.delete(pid); });
  return { pid, startedUtc, pidIdentity };
}

export async function watchdog(dir: string, clock: Clock = realClock): Promise<void> {
  const inhibitor = process.platform === 'darwin' ? spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }) : null;
  inhibitor?.on('error', () => { process.exitCode = 1; });
  const stop = () => { inhibitor?.kill(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  const interval = testTiming('CLAND_TEST_DROPLET_WATCHDOG_POLL_MS', 15000);
  try {
    for (;;) {
      const lease = await readLease(dir);
      if (lease.state === 'released') return;
      const remaining = Date.parse(lease.deadline) - clock.now().getTime();
      if (remaining <= 0) break;
      await pause(Math.min(interval, remaining), clock);
    }
    const api = new DigitalOceanApi(process.env, clock);
    const fired = clock.now().toISOString();
    let deleteStarted: string | undefined;
    let discoveredResource: number | null = null;
    let discoveredKey: number | null = null;
    const deleted = new Set<number>();
    for (;;) {
      const lease = await readLease(dir);
      lease.resource ??= discoveredResource;
      lease.keyId ??= discoveredKey;
      if (deleteStarted) lease.deleteStarted ??= deleteStarted;
      if (lease.state === 'released') return;
      lease.state = 'releasing';
      try {
        const result = await deleteLeaseResources(api, lease, undefined, attention => appendFile(join(dir, 'watchdog.log'), `${JSON.stringify({ ts: clock.now().toISOString(), event: 'executor-release-identity-recheck', attention })}\n`, { mode: 0o600 }), 300000, clock);
        deleteStarted ??= lease.deleteStarted;
        for (const id of result.deleted) deleted.add(id);
        if (result.confirmed) {
          const receipt: WatchdogReceipt = { fired, deleted: [...deleted], confirmedAt: clock.now().toISOString(), deleteStarted: deleteStarted ?? clock.now().toISOString() };
          await durableJson(join(dir, 'watchdog.json'), receipt);
          accountRelease(lease, receipt.deleteStarted, clock); lease.released = receipt.confirmedAt;
          await settleSpend(lease);
          return;
        }
      } catch { /* the lease remains the recovery record; secrets never enter a receipt */ }
      finally { deleteStarted ??= lease.deleteStarted; discoveredResource ??= lease.resource; discoveredKey ??= lease.keyId; }
      await pause(interval, clock);
    }
  } finally { inhibitor?.kill(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // A malformed/missing lease must not turn into a command line or token-bearing log.
  try { await watchdog(process.argv[2]!); }
  catch { process.exitCode = 1; }
}
