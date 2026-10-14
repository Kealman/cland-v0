import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processStartedAsync } from '../../hub/lock.ts';
import { DigitalOceanApi } from './api.ts';
import { settleSpend } from './spend.ts';
import { deleteLeaseResources } from './cleanup.ts';
import { accountRelease, durableJson, readLease, type DropletLease, type WatchdogReceipt } from './lease.ts';

export const pause = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
export const testTiming = (key: string, fallback: number): number => {
  const value = Number(process.env[key]);
  return value > 0 && Number.isFinite(value) ? value : fallback;
};
export async function watchdogAlive(lease: DropletLease): Promise<boolean> {
  if (!lease.watchdog) return false;
  return await processStartedAsync(lease.watchdog.pid, undefined, undefined, 'UTC') === lease.watchdog.startedUtc;
}
export async function stopWatchdog(lease: DropletLease): Promise<void> {
  if (!await watchdogAlive(lease)) return;
  try { process.kill(lease.watchdog!.pid, 'SIGTERM'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}
export async function armWatchdog(dir: string): Promise<NonNullable<DropletLease['watchdog']>> {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), dir], { detached: true, stdio: 'ignore' });
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  const pid = child.pid!;
  const startedUtc = await processStartedAsync(pid, undefined, undefined, 'UTC');
  if (!startedUtc) {
    // This child is still ours, so its ChildProcess handle is safe to stop.
    child.kill();
    throw new Error('could not verify the droplet watchdog process identity');
  }
  return { pid, startedUtc };
}

async function watchdog(dir: string): Promise<void> {
  const inhibitor = process.platform === 'darwin' ? spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }) : null;
  inhibitor?.on('error', () => { process.exitCode = 1; });
  const stop = () => { inhibitor?.kill(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  const interval = testTiming('CLAND_TEST_DROPLET_WATCHDOG_POLL_MS', 15000);
  try {
    for (;;) {
      const lease = await readLease(dir);
      if (lease.state === 'released') return;
      const remaining = Date.parse(lease.deadline) - Date.now();
      if (remaining <= 0) break;
      await pause(Math.min(interval, remaining));
    }
    const api = new DigitalOceanApi();
    const fired = new Date().toISOString();
    let deleteStarted: string | undefined;
    let discoveredResource: number | null = null;
    let discoveredKey: number | null = null;
    const deleted = new Set<number>();
    for (;;) {
      const lease = await readLease(dir);
      lease.resource ??= discoveredResource;
      lease.keyId ??= discoveredKey;
      if (lease.state === 'released') return;
      try {
        const result = await deleteLeaseResources(api, lease);
        deleteStarted ??= lease.deleteStarted;
        for (const id of result.deleted) deleted.add(id);
        if (result.confirmed) {
          const receipt: WatchdogReceipt = { fired, deleted: [...deleted], confirmedAt: new Date().toISOString(), deleteStarted: deleteStarted ?? new Date().toISOString() };
          await durableJson(join(dir, 'watchdog.json'), receipt);
          accountRelease(lease, receipt.deleteStarted); lease.released = receipt.confirmedAt;
          await settleSpend(lease);
          return;
        }
      } catch { /* the lease remains the recovery record; secrets never enter a receipt */ }
      finally { discoveredResource ??= lease.resource; discoveredKey ??= lease.keyId; }
      await pause(interval);
    }
  } finally { inhibitor?.kill(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // A malformed/missing lease must not turn into a command line or token-bearing log.
  try { await watchdog(process.argv[2]!); }
  catch { process.exitCode = 1; }
}
