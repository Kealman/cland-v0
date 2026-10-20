import { realClock, type Clock } from '../../hub/clock.ts';
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processStartedAsync } from '../../hub/lock.ts';
import { pidAlive } from '../../project.ts';
import { DigitalOceanApi } from './api.ts';
import { settleSpend } from './spend.ts';
import { deleteLeaseResources } from './cleanup.ts';
import { accountRelease, durableJson, readLease, type DropletLease, type WatchdogReceipt } from './lease.ts';

export const pause = (ms: number, clock: Clock = realClock): Promise<void> => new Promise(r => clock.setTimeout(r, ms));
export const testTiming = (key: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number => {
  const value = Number(env[key]);
  return value > 0 && Number.isFinite(value) ? value : fallback;
};
type WatchdogChild = { child: ChildProcess; startedUtc: string; closed: Promise<void> };
const children = new Map<number, WatchdogChild>();

async function closedWithin(closed: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([closed.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), ms); })]);
  } finally { clearTimeout(timer); }
}

async function stoppedWithin(watchdog: NonNullable<DropletLease['watchdog']>, owned: WatchdogChild | undefined, ms: number, env: NodeJS.ProcessEnv): Promise<boolean> {
  if (owned) return closedWithin(owned.closed, ms);
  // After a hub restart there is no ChildProcess receipt. Observe the persisted
  // identity disappearing; an unavailable ps probe alone is not proof of exit.
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!pidAlive(watchdog.pid)) return true;
    const started = await processStartedAsync(watchdog.pid, Math.max(1, Math.min(1000, deadline - Date.now())), undefined, 'UTC', env);
    if (started !== null && started !== watchdog.startedUtc) return true;
    await pause(Math.min(25, Math.max(0, deadline - Date.now())));
  }
  return false;
}
export async function watchdogAlive(lease: DropletLease, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!lease.watchdog) return false;
  return await processStartedAsync(lease.watchdog.pid, undefined, undefined, 'UTC', env) === lease.watchdog.startedUtc;
}
export async function stopWatchdog(lease: DropletLease, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!lease.watchdog) return;
  const watchdog = lease.watchdog;
  const candidate = children.get(watchdog.pid);
  const owned = candidate?.startedUtc === watchdog.startedUtc ? candidate : undefined;
  if (!owned && !await watchdogAlive(lease, env)) return;
  const signal = async (signal: NodeJS.Signals) => {
    if (owned) { owned.child.kill(signal); return; }
    // Revalidate before each signal, including escalation: the old PID may have
    // been reaped and reused while we waited for its exit.
    if (!await watchdogAlive(lease, env)) return;
    try { process.kill(watchdog.pid, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  const grace = testTiming('CLAND_TEST_DROPLET_WATCHDOG_STOP_MS', 5000, env);
  await signal('SIGTERM');
  if (await stoppedWithin(watchdog, owned, grace, env)) return;
  await signal('SIGKILL');
  if (!await stoppedWithin(watchdog, owned, grace, env)) throw new Error('droplet watchdog did not stop within its time bound');
}
export async function armWatchdog(dir: string, env: NodeJS.ProcessEnv = process.env): Promise<NonNullable<DropletLease['watchdog']>> {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), dir], { env, detached: true, stdio: 'ignore' });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  const pid = child.pid!;
  const startedUtc = await processStartedAsync(pid, undefined, undefined, 'UTC', env);
  if (!startedUtc) {
    // This child is still ours, so its ChildProcess handle is safe to stop.
    child.kill('SIGKILL');
    await closedWithin(closed, testTiming('CLAND_TEST_DROPLET_WATCHDOG_STOP_MS', 5000, env));
    throw new Error('could not verify the droplet watchdog process identity');
  }
  const owned = { child, startedUtc, closed };
  children.set(pid, owned);
  void closed.then(() => { if (children.get(pid) === owned) children.delete(pid); });
  return { pid, startedUtc };
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
