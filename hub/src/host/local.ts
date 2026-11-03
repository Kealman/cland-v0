import { LOCAL_MOD_DIR } from './launch-layout.ts';
import { folderFiles } from '../hub/artifact-folder.ts';
import { dirname, join } from 'node:path';
import { occupants } from './occupants.ts';
import { open } from 'node:fs/promises';
import { fileOperations } from './agent/files.ts';
import { worktreeOperations } from './agent/worktrees.ts';
import { spawn } from 'node:child_process';
import { processIdentityAsync } from '../process-identity.ts';
import { processStarted, processAlive, pidAlive } from '../adapters/processes.ts';
import { endProcess } from '../system-processes.ts';
import { run } from '../doctor/report.ts';
import type { Host, HostProcessUsage } from './host.ts';

export function localHost(env: NodeJS.ProcessEnv = process.env, log: (entry: Record<string, unknown>) => void = () => {}): Host {
  return {
    name: 'local',
    layout: input => Object.freeze({ ...input, modDir: LOCAL_MOD_DIR, runDirectory: join(dirname(input.discoveryFile), 'run'), logDirectory: join(dirname(input.discoveryFile), 'log') }),
    ...fileOperations,
    listFolder: path => folderFiles(path),
    forward: async (_sessionId, endpoint) => endpoint,
    unforward: async () => {},

    limitPolls: true,
    ...worktreeOperations(env),
    occupants,
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
