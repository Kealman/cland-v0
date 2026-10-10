// One machine queue admits each phase; Neovim acquires both locks together when free.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { link, mkdir, readFile, realpath, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, captureRunProcesses, cleanupProcesses, pause, type ProcessIdentity } from './process-cleanup.ts';
import { acquireLock, holderAlive, HubLocked, processStarted } from '../src/hub/lock.ts';

type Holder = { pid: number; started: string | null; since: string; token: string; root?: string; worktree?: string; queued?: string; device?: number; inode?: number; runner?: ProcessIdentity };
type Interruption = { signal: 'SIGINT' | 'SIGTERM' | null };
type Lease = { publishRunner: (identity: ProcessIdentity) => Promise<void>; publishRoot: (root: string) => Promise<void>; release: () => Promise<void> };
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
    const anchors = holder.runner ? [holder.runner] : [];
    const count = await cleanupProcesses(await ownedRoot(), [...captureRunProcesses(holder.token), ...anchors], line => process.stderr.write(`${line}\n`), holder.token, anchors);
    if (count === 0) break;
    if (n === 9) throw new Error('old suite still owns live processes; refusing to start another suite');
  }
  const root = await ownedRoot();
  if (root) await rm(root, { recursive: true, force: true });
}

async function liveTickets(queueDir: string): Promise<Array<Holder & { queued: string }>> {
  const tickets: Array<Holder & { queued: string }> = [];
  for (const name of await readdir(queueDir)) {
    if (!name.endsWith('.json')) continue;
    const path = join(queueDir, name);
    const waiting = await holderAt(path);
    if (!waiting && !await stat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; })) continue;
    if (!waiting || typeof waiting.queued !== 'string' || !/^\d+$/.test(waiting.queued)) throw new Error(`invalid suite ticket ${path}`);
    if (!liveHolder(waiting)) await rm(path, { force: true });
    else tickets.push({ ...waiting, queued: waiting.queued });
  }
  return tickets.sort((a, b) => BigInt(a.queued) < BigInt(b.queued) ? -1 : BigInt(a.queued) > BigInt(b.queued) ? 1 : a.token.localeCompare(b.token));
}

async function acquire(dirs: string[], interrupted: () => boolean, holder: Holder): Promise<Lease[]> {
  const primary = dirs[0];
  if (!primary) return [];
  // Registration never waits for a polled guard. Publish a whole ticket before
  // the first admission attempt, retaining its order through guard contention.
  // The persistent queue survives release/recovery of the ownership directories.
  const queueDir = `${primary}.queue`;
  const ticketPath = join(queueDir, `${holder.token}.json`);
  const ticket = { ...holder, queued: process.hrtime.bigint().toString() };
  mkdirSync(queueDir, { recursive: true, mode: 0o700 });
  const staging = `${ticketPath}.${holder.token}`;
  try {
    writeFileSync(staging, JSON.stringify(ticket), { mode: 0o600 });
    renameSync(staging, ticketPath);
  } finally { rmSync(staging, { force: true }); }
  let position = 1; let total = 1;
  let last = ''; let lastQueue = ''; let lastPrinted = 0;
  try {
    while (!interrupted()) {
      const guards: ReturnType<typeof acquireLock>[] = [];
      let previous: Holder | null = null;
      let info: Awaited<ReturnType<typeof stat>> | null = null;
      let blockedDir = primary;
      try {
        // Hold every recovery guard while inspecting/admitting the phase. Legacy
        // runners release these guards before waiting on the next lock, so this
        // cannot form a cycle with their Neovim-first acquisition order.
        for (const dir of dirs) guards.push(acquireLock(`${dir}.reaper`));
        const tickets = await liveTickets(queueDir);
        position = tickets.findIndex(waiting => waiting.token === holder.token) + 1;
        total = tickets.length;
        if (!position) throw new Error('suite ticket disappeared while waiting');
        let blocked = false;
        for (const dir of dirs) {
          const ownerPath = `${dir}.owner`;
          const currentInfo = await stat(dir).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
          const current = await holderAt(ownerPath) ?? await holderAt(join(dir, 'holder.json'));
          if (current && !liveHolder(current)) {
            const ownerInfo = await stat(ownerPath).catch(() => null);
            if (Date.now() - (ownerInfo?.mtimeMs ?? currentInfo?.mtimeMs ?? 0) >= RECOVERY_GRACE_MS) {
              // Keep stale ownership in place throughout verified process cleanup.
              await sweep(current);
              await rm(dir, { recursive: true, force: true });
              await rm(ownerPath, { force: true });
              await rm(`${ownerPath}.${current.token}`, { force: true });
              process.stderr.write(`taking over stale suite lock held by pid ${current.pid}\n`);
              continue;
            }
          }
          if (!blocked && (currentInfo || current)) {
            blocked = true; previous = current; info = currentInfo; blockedDir = dir;
          }
        }
        if (!blocked && position === 1 && !interrupted()) {
          const leases: Lease[] = [];
          const installed: Array<{ dir: string; created: boolean }> = [];
          try {
            for (const dir of dirs) {
              const ownerPath = `${dir}.owner`;
              const metadataPath = join(dir, 'holder.json');
              // Publish identity before mkdir, covering death in the metadata gap.
              await publish(ownerPath, holder, true);
              const pending = { dir, created: false };
              installed.push(pending);
              await mkdir(dir);
              pending.created = true;
              await publish(metadataPath, holder);
              leases.push({
                publishRunner: async identity => {
                  holder.runner = identity;
                  await publish(ownerPath, holder);
                  await publish(metadataPath, holder);
                },
                publishRoot: async root => {
                  const rootInfo = await stat(root);
                  holder.root = root; holder.device = rootInfo.dev; holder.inode = rootInfo.ino;
                  await publish(ownerPath, holder);
                  await publish(metadataPath, holder);
                },
                release: async () => {
                  if ((await holderAt(ownerPath))?.token !== holder.token) return;
                  await rm(dir, { recursive: true, force: true });
                  await rm(ownerPath, { force: true });
                },
              });
            }
            await rm(ticketPath, { force: true });
            return leases;
          } catch (error) {
            // Roll back only what this attempt installed; preserve a manual mkdir
            // that raced publication, and leave all waiter tickets intact.
            for (const { dir, created } of installed.reverse()) {
              if ((await holderAt(`${dir}.owner`))?.token !== holder.token) continue;
              if (created) await rm(dir, { recursive: true, force: true });
              await rm(`${dir}.owner`, { force: true });
            }
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            continue;
          }
        }
      } catch (error) {
        const contended = error instanceof Error && dirs.some(dir => error.message === `could not take ${dir}.reaper: it keeps changing under this process`);
        if (!(error instanceof HubLocked) && !contended && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const tickets = await liveTickets(queueDir);
        position = tickets.findIndex(waiting => waiting.token === holder.token) + 1;
        total = tickets.length;
        for (const dir of dirs) {
          previous = await holderAt(`${dir}.owner`) ?? await holderAt(join(dir, 'holder.json'));
          info = await stat(dir).catch(() => null);
          blockedDir = dir;
          if (previous || info) break;
        }
      } finally { for (const guard of guards.reverse()) guard.release(); }
      const age = Math.max(0, Date.now() - (info?.mtimeMs ?? Date.now()));
      const line = previous ? `waiting for the suite lock held by pid ${previous.pid} since ${previous.since ?? previous.started}${readableStart(previous.started) ? '' : ' (holder from an older version; process start time unavailable)'}` :
        !info ? 'waiting for the suite lock; an earlier live ticket has admission priority' :
        `waiting for the suite lock; age ${Math.floor(age / 1000)}s; no owner recorded (a manual lock); if no suite is running, remove it with \`rmdir ${blockedDir}\``;
      const queue = `${position}/${total}`;
      const message = `${line}; queue position ${queue}; holder worktree ${previous?.worktree ?? 'unavailable'}`;
      if ((message !== last && previous !== null) || queue !== lastQueue || Date.now() - lastPrinted >= 60_000 || !lastPrinted) {
        process.stderr.write(`${message}\n`); last = message; lastQueue = queue; lastPrinted = Date.now();
        if (!previous && info && age >= 15 * 60_000) process.stderr.write('WARNING: ownerless manual suite lock is over 15 minutes old and cannot recover automatically; verify no suite is running before removing it.\n');
      }
      await pause(250);
    }
    throw new Error('suite interrupted while waiting for the lock');
  } finally { await rm(ticketPath, { force: true }); }
}

export async function runSuite(suites: string[][], options: { lockDir?: string; lockDirs?: string[]; cwd?: string; interruption?: Interruption } = {}): Promise<number> {
  const interruption = options.interruption ?? { signal: null };
  let active: ReturnType<typeof spawn> | undefined;
  const runId = randomBytes(10).toString('base64url');
  let activeIdentity: ProcessIdentity | null = null;
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = () => {
      interruption.signal ??= signal;
      if (activeIdentity) void cleanupProcesses(undefined, [activeIdentity], () => {}, runId, [activeIdentity]).catch(error => process.stderr.write(String(error) + '\n'));
    };
    process.on(signal, handler);
    return { signal, handler };
  });
  const startedIdentity = processStarted(process.pid);
  if (!startedIdentity) throw new Error('cannot establish suite holder process identity');
  const holder: Holder = { pid: process.pid, started: startedIdentity, since: new Date().toISOString(), token: runId, worktree: await realpath(options.cwd ?? process.cwd()), root: join(await realpath('/tmp'), `cland-suite-${runId}`) };
  const leases: Lease[] = [];
  let root: string | undefined;
  const invoked = Date.now();
  let started = invoked;
  let peak = loadavg()[0]!;
  const sample = setInterval(() => { peak = Math.max(peak, loadavg()[0]!); }, 1000);
  try {
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    if (process.env.CLAND_TEST_SKIP_LOCK !== '1') {
      leases.push(...await acquire(options.lockDirs ?? [options.lockDir ?? '/tmp/cland-suite.lock'], () => interruption.signal !== null, holder));
    }
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    started = Date.now();
    peak = loadavg()[0]!;
    // The unique planned path was durably published with the initial lock, before mkdir.
    root = holder.root!;
    await mkdir(root, { mode: 0o700 });
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    const rootInfo = await stat(root);
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    holder.root = root; holder.device = rootInfo.dev; holder.inode = rootInfo.ino;
    for (const lease of leases) await lease.publishRoot(root);
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    for (const [index, args] of suites.entries()) {
      if (interruption.signal) break;
      const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: root, TMP: root, TEMP: root, TEST_SUITE_RUN_ID: holder.token };
      delete env.NODE_TEST_CONTEXT;
      const gate = join(root, `start-${index}`);
      const bootstrap = join(root, `bootstrap-${index}.mjs`);
      await writeFile(bootstrap, `import { access } from 'node:fs/promises'; import { setTimeout } from 'node:timers/promises';
const cwd = ${JSON.stringify(resolve(options.cwd ?? process.cwd()))};
while (!await access(${JSON.stringify(gate)}).then(() => true, () => false)) await setTimeout(25);
process.chdir(cwd);`);
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const cwd = resolve(options.cwd ?? process.cwd());
      // Node resolves test targets before imports; keep them absolute while spawning in the owned root.
      const absoluteArgs = args.map((arg, index) => {
        if (arg.startsWith('-') || ['--test-name-pattern', '--test-skip-pattern'].includes(args[index - 1] ?? '')) return arg;
        const path = resolve(cwd, arg);
        return existsSync(path) || arg.includes('*') ? path : arg;
      });
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      active = spawn(process.execPath, ['--import', bootstrap, ...absoluteArgs], { cwd: root, env, detached: true, stdio: 'inherit' });
      // Install exit listeners before publication awaits; the bootstrap cannot start tests yet.
      const done = new Promise<number>((resolve, reject) => { active!.once('error', reject); active!.once('exit', (value, signal) => resolve(value ?? (signal === 'SIGINT' ? 130 : 143))); });
      activeIdentity = captureProcess(active.pid);
      if (!activeIdentity) throw new Error('cannot establish suite runner process identity');
      holder.runner = activeIdentity;
      for (const lease of leases) await lease.publishRunner(activeIdentity);
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      await writeFile(gate, 'ready');
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const code = await done;
      await cleanupProcesses(root, [...captureRunProcesses(holder.token), activeIdentity], (line) => process.stderr.write(`${line}\n`), holder.token, [activeIdentity]);
      active = undefined; activeIdentity = null;
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      if (code !== 0) return code;
    }
    return interruption.signal ? (interruption.signal === 'SIGINT' ? 130 : 143) : 0;
  } catch (error) {
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    throw error;
  } finally {
    clearInterval(sample);
    try {
      if (root) await sweep(holder);
      for (const lease of leases.reverse()) await lease.release();
    } finally {
      for (const { signal, handler } of handlers) process.off(signal, handler);
      process.stderr.write(`suite duration ${((Date.now() - started) / 1000).toFixed(2)}s; lock wait ${((started - invoked) / 1000).toFixed(2)}s; peak 1m load ${peak.toFixed(2)}\n`);
    }
  }
}

export async function runPackageSuite(mode: string, extra: string[] = [], options: { cwd?: string; lockDirs?: { hub: string; nvim: string } } = {}): Promise<number> {
  if (!['all', 'hub', 'nvim'].includes(mode)) throw new Error(`unknown suite: ${mode}`);
  const cwd = options.cwd ?? fileURLToPath(new URL('../../', import.meta.url));
  const locks = options.lockDirs ?? { hub: '/tmp/cland-suite.lock', nvim: '/tmp/cland-suite-nvim.lock' };
  const phases: Array<'hub' | 'nvim'> = mode === 'all' ? ['hub', 'nvim'] : [mode === 'hub' ? 'hub' : 'nvim'];
  const interruption: Interruption = { signal: null };
  // Keep the first signal latched across final cleanup and gaps between phase handlers.
  const handlers = (['SIGINT', 'SIGTERM'] as const).map(signal => {
    const handler = () => { interruption.signal ??= signal; };
    process.on(signal, handler);
    return { signal, handler };
  });
  try {
    for (const phase of phases) {
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const targets = phase === 'hub' ? ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'] : ['nvim/test/**/*.test.ts'];
      // Release and sweep the previous phase before waiting for the next phase's lock.
      // One machine ticket covers all required locks; neither is held while waiting.
      const lockDirs = phase === 'nvim' ? [locks.hub, locks.nvim] : [locks.hub];
      const code = await runSuite([['--test', '--test-concurrency=4', ...(extra.length ? extra : targets)]], { cwd, lockDirs, interruption });
      // A signal during runSuite's finally must override its already evaluated return.
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      if (code !== 0) return code;
    }
    return 0;
  } finally {
    for (const { signal, handler } of handlers) process.off(signal, handler);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runPackageSuite(process.argv[2] ?? 'all', process.argv.slice(3));
}
