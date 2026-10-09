// All package suite entry points share this machine lock and temporary process boundary.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupProcesses, pause } from './process-cleanup.ts';
import { acquireLock, HubLocked } from '../src/hub/lock.ts';

type Holder = { pid: number; started: string; token: string };
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; } };
const holderAt = async (dir: string): Promise<Holder | null> => {
  try {
    const value: unknown = JSON.parse(await readFile(join(dir, 'holder.json'), 'utf8'));
    if (typeof value === 'object' && value !== null && 'pid' in value && 'started' in value && 'token' in value && Number.isInteger(value.pid) && Number(value.pid) > 0 && typeof value.started === 'string' && typeof value.token === 'string') return value as Holder;
  } catch { /* a manual lock has no metadata: wait until its owner removes it */ }
  return null;
};
async function acquire(dir: string, interrupted: () => boolean): Promise<() => Promise<void>> {
  const holder: Holder = { pid: process.pid, started: new Date().toISOString(), token: randomUUID() };
  let last = '';
  while (!interrupted()) {
    try {
      await mkdir(dir);
      try { await writeFile(join(dir, 'holder.json'), JSON.stringify(holder)); }
      catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
      return async () => { if ((await holderAt(dir))?.token === holder.token) await rm(dir, { recursive: true, force: true }); };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const previous = await holderAt(dir);
    const line = previous ? `waiting for the suite lock held by pid ${previous.pid} since ${previous.started}` : 'waiting for the suite lock held by pid unknown since unknown (manual lock or holder starting)';
    if (line !== last) { process.stderr.write(`${line}\n`); last = line; }
    if (previous && !alive(previous.pid)) {
      // Reuse the hub's PID/start-time guard: a reaper that dies is itself recoverable.
      let guard: ReturnType<typeof acquireLock> | undefined;
      try {
        guard = acquireLock(`${dir}.reaper`);
        const current = await holderAt(dir);
        if (current?.token === previous.token && !alive(current.pid)) {
          const stale = `${dir}.stale-${holder.token}`;
          await rename(dir, stale);
          await rm(stale, { recursive: true, force: true });
          process.stderr.write(`taking over stale suite lock held by pid ${previous.pid}\n`);
        }
      } catch (error) {
        // The shared lock's short retry budget can expire before its dead breaker guard ages out.
        const contended = error instanceof Error && error.message === `could not take ${dir}.reaper: it keeps changing under this process`;
        if (!(error instanceof HubLocked) && !contended && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await pause(250);
      } finally { guard?.release(); }
      continue;
    }
    await pause(250);
  }
  throw new Error('suite interrupted while waiting for the lock');
}

export async function runSuite(suites: string[][], options: { lockDir?: string; cwd?: string } = {}): Promise<number> {
  let interrupted: NodeJS.Signals | null = null;
  let active: ReturnType<typeof spawn> | undefined;
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = () => { interrupted = signal; active?.kill(signal); };
    process.on(signal, handler);
    return { signal, handler };
  });
  let release: (() => Promise<void>) | undefined;
  let root: string | undefined;
  const invoked = Date.now();
  let started = invoked;
  let peak = loadavg()[0]!;
  const sample = setInterval(() => { peak = Math.max(peak, loadavg()[0]!); }, 1000);
  try {
    if (process.env.CLAND_TEST_SKIP_LOCK !== '1') release = await acquire(options.lockDir ?? '/tmp/cland-suite.lock', () => interrupted !== null);
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    started = Date.now();
    peak = loadavg()[0]!;
    root = await realpath(await mkdtemp('/tmp/cland-suite-'));
    for (const args of suites) {
      if (interrupted) break;
      const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: root, TMP: root, TEMP: root };
      delete env.NODE_TEST_CONTEXT;
      active = spawn(process.execPath, args, { cwd: options.cwd, env, detached: true, stdio: 'inherit' });
      const pid = active.pid;
      const code = await new Promise<number>((resolve, reject) => { active!.once('error', reject); active!.once('exit', (value, signal) => resolve(value ?? (signal === 'SIGINT' ? 130 : 143))); });
      await cleanupProcesses(root, pid ? [pid] : [], (line) => process.stderr.write(`${line}\n`));
      active = undefined;
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
      if (root) { await cleanupProcesses(root, active?.pid ? [active.pid] : [], (line) => process.stderr.write(`${line}\n`)); await rm(root, { recursive: true, force: true }); }
    } finally {
      await release?.();
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
