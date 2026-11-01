import { statDirectory } from '../adapters/session-cwd.ts';
import { occupants } from './occupants.ts';
import { worktreeInstall } from './worktree-install.ts';
import { stat, lstat, realpath, readFile } from 'node:fs/promises';
import { folderFiles } from '../hub/artifact-folder.ts';
import { spawn } from 'node:child_process';
import { processIdentityAsync } from '../process-identity.ts';
import { processStarted, processAlive, sameProcess } from '../adapters/processes.ts';
import { endProcess } from '../system-processes.ts';
import { run } from '../doctor/report.ts';
import type { Host, HostProcessUsage } from './host.ts';

export function localHost(env: NodeJS.ProcessEnv = process.env, log: (entry: Record<string, unknown>) => void = () => {}): Host {
  return {
    name: 'local',
    limitPolls: true,
    worktreeAdd: async ({ root, path, branch }) => {
      const result = await run('git', ['-c', 'gc.auto=0', 'worktree', 'add', '--', path, branch], env, undefined, false, undefined, 'utf8', root);
      if (result.error || result.code !== 0) throw new Error(result.stderr || result.error || 'git worktree add failed');
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
    spawn: command => new Promise((resolve, reject) => {
      const child = spawn(command.command, command.args, { cwd: command.cwd, env: command.env, detached: true, stdio: 'ignore' });
      child.once('error', reject);
      child.once('spawn', () => { child.unref(); resolve({ pid: child.pid! }); });
    }),
    identity: async pid => {
      if (!Number.isSafeInteger(pid) || pid <= 0) return null;
      const pidStarted = await processStarted(pid, undefined, undefined, undefined, env);
      const pidIdentity = await processIdentityAsync(pid, env);
      return pidStarted && pidIdentity ? { pid, pidStarted, pidIdentity } : null;
    },
    alive: row => processAlive({ pid: row.pid, pidStarted: row.pidStarted ?? null, pidIdentity: row.pidIdentity ?? null }, undefined, env),
    stop: async (row, options) => {
      const recorded = { pid: row.pid, pidStarted: row.pidStarted ?? null, pidIdentity: row.pidIdentity ?? null };
      if (!options?.allowReused && !await sameProcess(recorded, undefined, env)) return false;
      return endProcess(recorded, log, options?.graceMs, undefined, { env, ...(options?.allowReused ? { allowReused: true } : {}) });
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
