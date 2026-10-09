// All package suite entry points share this machine lock and temporary process boundary.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { link, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, captureRunProcesses, cleanupProcesses, pause, type ProcessIdentity } from './process-cleanup.ts';
import { acquireLock, holderAlive, HubLocked, processStarted } from '../src/hub/lock.ts';

type Holder = { pid: number; started: string | null; since: string; token: string; root?: string; device?: number; inode?: number };
type Lease = { publishRoot: (root: string) => Promise<void>; release: () => Promise<void> };
const RECOVERY_GRACE_MS = 1000;
async function holderAt(path: string): Promise<Holder | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (typeof value === 'object' && value !== null && 'pid' in value && 'token' in value && Number.isInteger(value.pid) && Number(value.pid) > 0 && typeof value.token === 'string') {
      const parsed = value as Partial<Holder>;
      return { ...parsed, pid: Number(value.pid), started: typeof parsed.started === 'string' ? parsed.started : null, since: parsed.since ?? parsed.started ?? 'unknown', token: value.token };
    }
  } catch { /* no complete ownership record */ }
  return null;
}
const readableStart = (started: string | null): boolean => started !== null && /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(started);
// Old runners stored an invocation ISO timestamp, not ps identity. Keep live unknowns held.
const liveHolder = (holder: Holder) => holderAlive({ pid: holder.pid, started: readableStart(holder.started) ? holder.started : null });

async function publish(path: string, holder: Holder, exclusive = false): Promise<void> {
  const staging = `${path}.${holder.token}`;
  await writeFile(staging, JSON.stringify(holder), { mode: 0o600 });
  try { if (exclusive) await link(staging, path); else await rename(staging, path); }
  finally { await rm(staging, { force: true }); }
}
async function sweep(holder: Holder): Promise<void> {
  const ownedRoot = async () => {
    if (!holder.root) return undefined;
    const info = await stat(holder.root).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    const plannedRoot = join(await realpath('/tmp'), `cland-suite-${holder.token}`);
    const identityMatches = holder.device === undefined && holder.inode === undefined ? holder.root === plannedRoot : info?.dev === holder.device && info?.ino === holder.inode;
    if (info && !identityMatches) throw new Error('suite root identity changed; refusing cleanup');
    return info ? holder.root : undefined;
  };
  // The run marker is unique per invocation, including workers whose cwd is the repository.
  for (let n = 0; n < 10; n++) {
    await cleanupProcesses(await ownedRoot(), captureRunProcesses(holder.token), line => process.stderr.write(`${line}\n`), holder.token);
    if (captureRunProcesses(holder.token).length === 0) break;
    if (n === 9) throw new Error('old suite still owns live processes; refusing to start another suite');
  }
  const root = await ownedRoot();
  if (root) await rm(root, { recursive: true, force: true });
}

async function acquire(dir: string, interrupted: () => boolean, holder: Holder): Promise<Lease> {
  const ownerPath = `${dir}.owner`;
  const metadataPath = join(dir, 'holder.json');
  let last = ''; let lastPrinted = 0;
  while (!interrupted()) {
    let guard: ReturnType<typeof acquireLock> | undefined;
    let previous: Holder | null = null;
    let info: Awaited<ReturnType<typeof stat>> | null = null;
    try {
      // Serializes publication/recovery. Its own PID/start-time guard can recover a killed reaper.
      guard = acquireLock(`${dir}.reaper`);
      info = await stat(dir).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      previous = await holderAt(ownerPath) ?? await holderAt(metadataPath);
      if (previous && !liveHolder(previous)) {
        const ownerInfo = await stat(ownerPath).catch(() => null);
        if (Date.now() - (ownerInfo?.mtimeMs ?? info?.mtimeMs ?? 0) >= RECOVERY_GRACE_MS) {
          // Keep the stale lock in place throughout cleanup: no replacement daemon can overlap it.
          await sweep(previous);
          await rm(dir, { recursive: true, force: true });
          await rm(ownerPath, { force: true });
          process.stderr.write(`taking over stale suite lock held by pid ${previous.pid}\n`);
          continue;
        }
      }
      if (!info && !previous) {
        // Publish whole PID/start identity BEFORE mkdir, covering death in the metadata gap.
        await publish(ownerPath, holder, true);
        try { await mkdir(dir); }
        catch (error) { await rm(ownerPath, { force: true }); if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; continue; }
        await publish(metadataPath, holder);
        return {
          publishRoot: async root => {
            const rootInfo = await stat(root);
            holder.root = root; holder.device = rootInfo.dev; holder.inode = rootInfo.ino;
            // Sidecar first: a crash between updates still retains full recovery ownership.
            await publish(ownerPath, holder);
            await publish(metadataPath, holder);
          },
          release: async () => {
            if ((await holderAt(ownerPath))?.token !== holder.token) return;
            await rm(dir, { recursive: true, force: true });
            await rm(ownerPath, { force: true });
          },
        };
      }
    } catch (error) {
      const contended = error instanceof Error && error.message === `could not take ${dir}.reaper: it keeps changing under this process`;
      if (!(error instanceof HubLocked) && !contended && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      previous = await holderAt(ownerPath) ?? await holderAt(metadataPath);
      info = await stat(dir).catch(() => null);
    } finally { guard?.release(); }
    const age = Math.max(0, Date.now() - (info?.mtimeMs ?? Date.now()));
    const line = previous ? `waiting for the suite lock held by pid ${previous.pid} since ${previous.since ?? previous.started}${readableStart(previous.started) ? '' : ' (holder from an older version; process start time unavailable)'}` :
      `waiting for the suite lock; age ${Math.floor(age / 1000)}s; no owner recorded (a manual lock); if no suite is running, remove it with \`rmdir /tmp/cland-suite.lock\``;
    if ((line !== last && previous !== null) || Date.now() - lastPrinted >= 60_000 || !lastPrinted) {
      process.stderr.write(`${line}\n`); last = line; lastPrinted = Date.now();
      if (!previous && age >= 15 * 60_000) process.stderr.write('WARNING: ownerless manual suite lock is over 15 minutes old and cannot recover automatically; verify no suite is running before removing it.\n');
    }
    await pause(250);
  }
  throw new Error('suite interrupted while waiting for the lock');
}

export async function runSuite(suites: string[][], options: { lockDir?: string; cwd?: string } = {}): Promise<number> {
  let interrupted: NodeJS.Signals | null = null;
  let active: ReturnType<typeof spawn> | undefined;
  const runId = randomBytes(10).toString('base64url');
  let activeIdentity: ProcessIdentity | null = null;
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = () => {
      interrupted = signal;
      if (activeIdentity) void cleanupProcesses(undefined, [activeIdentity], () => {}, runId).catch(error => process.stderr.write(String(error) + '\n'));
    };
    process.on(signal, handler);
    return { signal, handler };
  });
  const startedIdentity = processStarted(process.pid);
  if (!startedIdentity) throw new Error('cannot establish suite holder process identity');
  const holder: Holder = { pid: process.pid, started: startedIdentity, since: new Date().toISOString(), token: runId, root: join(await realpath('/tmp'), `cland-suite-${runId}`) };
  let lease: Lease | undefined;
  let root: string | undefined;
  const invoked = Date.now();
  let started = invoked;
  let peak = loadavg()[0]!;
  const sample = setInterval(() => { peak = Math.max(peak, loadavg()[0]!); }, 1000);
  try {
    if (process.env.CLAND_TEST_SKIP_LOCK !== '1') lease = await acquire(options.lockDir ?? '/tmp/cland-suite.lock', () => interrupted !== null, holder);
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    started = Date.now();
    peak = loadavg()[0]!;
    // The unique planned path was durably published with the initial lock, before mkdir.
    root = holder.root!;
    await mkdir(root, { mode: 0o700 });
    const rootInfo = await stat(root);
    holder.root = root; holder.device = rootInfo.dev; holder.inode = rootInfo.ino;
    await lease?.publishRoot(root);
    for (const args of suites) {
      if (interrupted) break;
      const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: root, TMP: root, TEMP: root, TEST_SUITE_RUN_ID: holder.token };
      delete env.NODE_TEST_CONTEXT;
      active = spawn(process.execPath, args, { cwd: options.cwd, env, detached: true, stdio: 'inherit' });
      activeIdentity = captureProcess(active.pid);
      const code = await new Promise<number>((resolve, reject) => { active!.once('error', reject); active!.once('exit', (value, signal) => resolve(value ?? (signal === 'SIGINT' ? 130 : 143))); });
      await cleanupProcesses(root, [...captureRunProcesses(holder.token), ...(activeIdentity ? [activeIdentity] : [])], (line) => process.stderr.write(`${line}\n`), holder.token);
      active = undefined; activeIdentity = null;
      if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
      if (code !== 0) return code;
    }
    return interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : 0;
  } catch (error) {
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    throw error;
  } finally {
    clearInterval(sample);
    try {
      if (root) await sweep(holder);
      await lease?.release();
    } finally {
      for (const { signal, handler } of handlers) process.off(signal, handler);
      process.stderr.write(`suite duration ${((Date.now() - started) / 1000).toFixed(2)}s; lock wait ${((started - invoked) / 1000).toFixed(2)}s; peak 1m load ${peak.toFixed(2)}\n`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] ?? 'all';
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const extra = process.argv.slice(3);
  const hub = ['--test', '--test-concurrency=4', ...(extra.length ? extra : ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'])];
  const nvim = ['--test', '--test-concurrency=4', ...(extra.length ? extra : ['nvim/test/**/*.test.ts'])];
  if (!['all', 'hub', 'nvim'].includes(mode)) throw new Error(`unknown suite: ${mode}`);
  process.exitCode = await runSuite(mode === 'all' ? [hub, nvim] : [mode === 'hub' ? hub : nvim], { cwd: repo });
}
