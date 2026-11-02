import { statDirectory } from '../adapters/session-cwd.ts';
import { occupants } from './occupants.ts';
import { worktreeInstall } from './worktree-install.ts';
import { stat, lstat, realpath, readFile, open } from 'node:fs/promises';
import { folderFiles } from '../hub/artifact-folder.ts';
import { spawn } from 'node:child_process';
import { processIdentityAsync } from '../process-identity.ts';
import { processStarted, processAlive, pidAlive } from '../adapters/processes.ts';
import { endProcess } from '../system-processes.ts';
import { run } from '../doctor/report.ts';
import type { Host, HostProcessUsage } from './host.ts';

export function localHost(env: NodeJS.ProcessEnv = process.env, log: (entry: Record<string, unknown>) => void = () => {}): Host {
  return {
    name: 'local',
    limitPolls: true,
    worktreeAdd: async ({ root, path, branch, territory, reuseOnly, detached, beforeInstall }) => {
      if (!reuseOnly) {
        if (territory) {
          const fetched = await run('git', ['-c', 'gc.auto=0', 'fetch', '--no-auto-maintenance', '--no-tags', '--no-write-fetch-head', territory.path, territory.tip], env, undefined, false, undefined, 'utf8', root);
          if (fetched.error || fetched.code !== 0) throw new Error(fetched.stderr || fetched.error || 'git fetch task branch failed');
          const current = await run('git', ['-c', 'gc.auto=0', 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], env, undefined, false, undefined, 'utf8', root);
          if (current.error || (current.code !== 0 && current.code !== 1)) throw new Error(current.stderr || current.error || 'git task branch inspection failed');
          const trees = await run('git', ['-c', 'gc.auto=0', 'worktree', 'list', '--porcelain'], env, undefined, false, undefined, 'utf8', root);
          if (trees.error || trees.code !== 0) throw new Error(trees.stderr || trees.error || 'git worktree inspection failed');
          if (trees.stdout.split('\n').includes(`branch refs/heads/${branch}`)) throw new Error(`task branch ${branch} is already checked out`);
          const updated = await run('git', ['-c', 'gc.auto=0', 'update-ref', '--no-deref', `refs/heads/${branch}`, territory.tip, current.code === 0 ? current.stdout.trim() : '0'.repeat(40)], env, undefined, false, undefined, 'utf8', root);
          if (updated.error || updated.code !== 0) throw new Error(updated.stderr || updated.error || 'git task branch failed');
        }
        const result = await run('git', ['-c', 'gc.auto=0', 'worktree', 'add', ...(detached ? ['--detach'] : []), '--', path, branch], env, undefined, false, undefined, 'utf8', root);
        if (result.error || result.code !== 0) throw new Error(result.stderr || result.error || 'git worktree add failed');
      }
      if (await beforeInstall?.() === false) return {};
      const warning = await worktreeInstall(root, path);
      return warning ? { warning } : {};
    },
    worktreeRemove: async ({ root, path }) => {
      const result = await run('git', ['-c', 'gc.auto=0', 'worktree', 'remove', '--', path], env, undefined, false, undefined, 'utf8', root);
      if (result.error || result.code !== 0) throw new Error(result.stderr || result.error || 'git worktree remove failed');
    },
    occupants,
    statDirectory,
    realpath: path => realpath(path).catch(() => path),
    fileType: async path => {
      const info = await lstat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
      });
      return !info ? 'missing' : info.isSymbolicLink() ? 'symlink' : info.isFile() ? 'file' : info.isDirectory() ? 'directory' : 'other';
    },
    readFile: async path => {
      if (!(await stat(path)).isFile()) throw new Error('Host readFile requires a regular file');
      return readFile(path);
    },
    listFolder: path => folderFiles(path),
    run: command => run(command.command, command.args, command.env, command.timeoutMs, false, command.signal, 'utf8', command.cwd),
    spawn: async (command, options) => {
      const output = command.logFile ? await open(command.logFile, 'a') : undefined;
      let accepted: Awaited<ReturnType<Host['spawn']>> | undefined;
      try {
        options?.authorize?.();
        const result = await new Promise<Awaited<ReturnType<Host['spawn']>>>((resolve, reject) => {
          const child = spawn(command.command, command.args, { cwd: command.cwd, env: command.env, detached: true, stdio: output ? ['ignore', output.fd, output.fd] : 'ignore' });
          const exited = new Promise<{ code: number | null; signal: string | null }>(done => child.once('exit', (code, signal) => done({ code, signal })));
          child.once('error', reject);
          child.once('spawn', () => { child.unref(); resolve({ pid: child.pid!, exited }); });
        });
        accepted = result;
        return result;
      } finally {
        try { await output?.close(); }
        catch (error) {
          if (!accepted) throw error;
          // A cleanup diagnostic cannot hide the accepted native owner.
          try { log({ event: 'host-spawn-log-close-failed', pid: accepted.pid, error: String(error) }); } catch { /* ownership wins over observers */ }
        }
      }
    },
    identity: async pid => {
      if (!Number.isSafeInteger(pid) || pid <= 0) return null;
      const pidStarted = await processStarted(pid, undefined, undefined, undefined, env);
      const pidIdentity = await processIdentityAsync(pid, env);
      return pidStarted && pidIdentity ? { pid, pidStarted, pidIdentity } : null;
    },
    // An existence-only request has no recorded birth to compare. Keep it a
    // native signal-0 probe so local adapter polling introduces no subprocess I/O.
    alive: row => row.pid !== null && row.pidStarted == null && row.pidIdentity == null
      ? Promise.resolve(pidAlive(row.pid))
      : processAlive({ pid: row.pid, pidStarted: row.pidStarted ?? null, pidIdentity: row.pidIdentity ?? null }, undefined, env),
    stop: async (row, options) => {
      const recorded = { pid: row.pid, pidStarted: row.pidStarted ?? null, pidIdentity: row.pidIdentity ?? null };
      return endProcess(recorded, options?.log ?? log, options?.graceMs, options?.beforeSignal ? tree => options.beforeSignal!(tree ?? []) : undefined, { env, ...(options?.authorize ? { authorize: tree => options.authorize!(tree ?? []) } : {}), ...(options?.allowReused ? { allowReused: true } : {}) });
    },
    processes: async () => {
      const result = await run('ps', ['-e', '-o', 'pid=,ppid=,rss=,pcpu=,stat='], { ...env, LC_ALL: 'C' });
      if (result.error || result.code !== 0) throw new Error('cannot inspect Host resource usage: ps failed');
      const rows: HostProcessUsage[] = [];
      for (const line of result.stdout.split('\n').filter(line => line.trim())) {
        const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\S+)\s*$/.exec(line);
        if (!match) throw new Error('cannot inspect Host resource usage: unknown ps format');
        if (/^[ZX]/.test(match[5]!)) continue;
        rows.push({ pid: Number(match[1]), parent: Number(match[2]), rssBytes: Number(match[3]) * 1024, cpuPercent: Number(match[4]) });
      }
      if (!rows.length) throw new Error('cannot inspect Host resource usage: empty ps table');
      const byPid = new Map(rows.map(row => [row.pid, row]));
      const children = new Map<number, number>();
      for (const row of rows) if (byPid.has(row.parent)) children.set(row.parent, (children.get(row.parent) ?? 0) + 1);
      const leaves = rows.filter(row => !children.has(row.pid));
      for (const row of leaves) {
        const parent = byPid.get(row.parent);
        if (!parent) continue;
        parent.rssBytes += row.rssBytes;
        parent.cpuPercent += row.cpuPercent;
        const remaining = children.get(parent.pid)! - 1;
        children.set(parent.pid, remaining);
        if (!remaining) leaves.push(parent);
      }
      if (leaves.length !== rows.length) throw new Error('cannot inspect Host resource usage: cyclic ancestry');
      return rows;
    },
  };
}
