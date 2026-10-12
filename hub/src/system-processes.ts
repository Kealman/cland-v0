// Bounded asynchronous termination requires verified identities; recovery CONT has an explicit exception.
import { probeTimeout, run } from './doctor/report.ts';
import { processStartedAsync } from './hub/lock.ts';
import type { Resumed } from './hub/worktrees.ts';
import { pidAlive } from './project.ts';
import { TerminationOwner } from './termination-owner.ts';
import { withCleanupAsync } from './cleanup.ts';
import { parseProcessTable, processTableArgs, type SystemProcess } from './process-table.ts';
export type { SystemProcess } from './process-table.ts';

const untimed: Resumed = work => work();
export type ProcessEndOptions = {
  resumed?: Resumed;
  /** Recheck the caller's live authority immediately before destructive actions. */
  authorize?: () => void;
  /** Atomically reserve each captured identity for this worker before any further await. */
  claim?: (identity: SystemProcess) => boolean;
  /** Relaunch of a row already marked exited may leave a proven reused PID alone. */
  allowReused?: boolean;
  /** Recheck reservations and running process trees immediately before each signal. */
  canSignal?: (rows: SystemProcess[]) => boolean;
  /** A shared deadline bounds a sweep, including each OS probe. */
  deadline?: number;
};
function timeout(deadline?: number): number {
  const remaining = deadline === undefined ? 3000 : deadline - Date.now();
  if (remaining <= 0) throw new Error('process inspection deadline reached; remaining processes preserved');
  return Math.min(probeTimeout(process.env, 3000), remaining);
}
export async function systemProcesses(resumed: Resumed = untimed, deadline?: number, pids?: number[], descendants = false): Promise<SystemProcess[]> {
  if (pids && descendants) {
    const discoveryDeadline = Math.min(deadline ?? Infinity, Date.now() + 3000);
    const selected = new Set(pids);
    let parents = pids;
    while (parents.length) {
      // Select children of captured PIDs, then walk only those newly selected parents.
      // The ps snapshot below must still prove every ancestry edge before capture.
      const children = await run('pgrep', ['-P', parents.join(',')], process.env, timeout(discoveryDeadline));
      if (children.error || children.code !== 0 && children.code !== 1) throw new Error('cannot inspect captured process descendants: pgrep failed or timed out');
      parents = resumed(() => children.stdout.trim().split(/\s+/).filter(Boolean).map(value => {
        if (!/^\d+$/.test(value) || Number(value) <= 1) throw new Error('cannot verify captured process descendants');
        return Number(value);
      }).filter(pid => {
        if (selected.has(pid)) return false;
        selected.add(pid); return true;
      }));
    }
    pids = [...selected];
  }
  // Reuse the probe runner: a wrapper's grandchildren must not keep stdout open past the deadline.
  const selected = pids ? [...new Set([process.pid, ...pids])] : undefined;
  const result = await run('ps', processTableArgs(selected), process.env, timeout(deadline));
  return resumed(() => {
    if (result.code !== 0 || result.error) throw new Error('cannot inspect the OS process table: ps failed or timed out');
    const rows = parseProcessTable(result.stdout);
    if (!rows.some(row => row.pid === process.pid)) throw new Error('cannot verify the OS process table format');
    return rows;
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Capture descendants while ancestry is intact; verify each positive PID immediately before its signal.
 * Group membership can change during an identity probe, so never signal an entire group.
 */
export async function endProcess(p: { pid: number | null; pidStarted?: string | null }, log: (entry: Record<string, unknown>) => void = () => {}, graceMs = 5000, beforeSignal?: () => Promise<void>, options: ProcessEndOptions = {}): Promise<boolean> {
  const resumed = options.resumed ?? untimed;
  const observe = (entry: Record<string, unknown>) => { try { log(entry); } catch { /* observers cannot abort recovery */ } };
  if (p.pid === null) return false;
  const rows = await systemProcesses(resumed, options.deadline);
  const owned = new Map<number, SystemProcess>();
  const leader = resumed(() => {
    const leader = rows.find(row => row.pid === p.pid);
    if (!leader) return undefined;
    if (!p.pidStarted) {
      observe({ event: 'signal-refused', pid: p.pid, signal: 'SIGTERM', reason: 'process identity cannot be verified' });
      return null;
    }
    if (leader.started !== p.pidStarted) {
      observe({ event: 'signal-refused', pid: p.pid, signal: 'SIGTERM', reason: 'PID was reused; the recorded process is gone' });
      return options.allowReused ? undefined : null;
    }
    if (options.claim && !options.claim(leader)) return null;
    owned.set(leader.pid, leader);
    for (let changed = true; changed;) {
      changed = false;
      for (const row of rows) if (owned.has(row.parent) && !owned.has(row.pid) && (!options.claim || options.claim(row))) { owned.set(row.pid, row); changed = true; }
    }
    // Protect the hub and its ancestors even if a corrupt row names one of them.
    for (let row = rows.find(row => row.pid === process.pid); row; row = rows.find(next => next.pid === row!.parent)) {
      if (owned.has(row.pid)) throw new Error('refusing to end this process or its ancestor');
    }
    return leader;
  });
  if (leader === undefined) return true;
  if (leader === null) return false;
  const leaderPid = leader.pid;
  const owner = new TerminationOwner(resumed, options.deadline ?? Date.now() + graceMs + 30_000);
  return withCleanupAsync(async () => {
    await owner.acquire([...owned.keys()]);
    return await terminate();
  }, () => owner.release(), resumed);

  async function terminate(): Promise<boolean> {
    const frozen = new Map<number, SystemProcess>();
    let latest = rows;
    let freezeDeadline: number | undefined;
    const extend = async (current: SystemProcess[], deadline?: number) => {
      for (let changed = true; changed;) {
        changed = false;
        const children = resumed(() => {
          const byPid = new Map(current.map(row => [row.pid, row]));
          return current.filter(row => {
            const parent = byPid.get(row.parent);
            return parent && owned.get(parent.pid)?.started === parent.started && !owned.has(row.pid);
          });
        });
        for (const row of children) {
          await owner.capture(row.pid, deadline);
          resumed(() => {
            if (!options.claim || options.claim(row)) { owned.set(row.pid, row); changed = true; }
          });
        }
      }
    };
    const inspect = async (deadline = options.deadline) => {
      const current = await systemProcesses(resumed, deadline);
      await extend(current, deadline);
      return resumed(() => {
        latest = current;
        for (const [pid, identity] of frozen) {
          if (!current.some(row => row.pid === pid && row.started === identity.started)) frozen.delete(pid);
        }
        return current;
      });
    };
    const matching = (current: SystemProcess[]) => current.filter(row => owned.get(row.pid)?.started === row.started);
    const remaining = async (discoverChildren = false) => {
      const absent = resumed(() => [...owned.keys()].every(pid => !pidAlive(pid)));
      if (absent) return resumed(() => { latest = []; frozen.clear(); return []; });
      // Grace polls retain children born while a captured parent lives. After the
      // full-tree freeze/KILL, waiting needs only captured identities.
      const current = await systemProcesses(resumed, options.deadline, [...owned.keys()], discoverChildren);
      if (discoverChildren) await extend(current, options.deadline);
      return resumed(() => {
        latest = current;
        for (const [pid, identity] of frozen) if (!current.some(row => row.pid === pid && row.started === identity.started)) frozen.delete(pid);
        return matching(current);
      });
    };
    const signal = async (kind: NodeJS.Signals, leaderOnly = false, snapshot?: SystemProcess[]): Promise<boolean> => {
      const deadline = kind === 'SIGSTOP' ? freezeDeadline : options.deadline;
      const current = snapshot ?? await inspect(deadline);
      const targets = resumed(() => {
        return matching(current).filter(row => (!leaderOnly || row.pid === leaderPid) &&
          (kind !== 'SIGSTOP' || frozen.get(row.pid)?.started !== row.started || !row.state.startsWith('T')));
      });
      for (const row of targets) {
        // No other target's probe or await may intervene between this identity check and its signal.
        const started = await resumed(() => processStartedAsync(row.pid, timeout(deadline), resumed));
        const permitted = resumed(() => {
          // A preceding signal can end another captured descendant before its probe runs. An empty
          // answer alone is ambiguous; a confirmed absent PID needs no signal and is already finished.
          if (started === null && !pidAlive(row.pid)) {
            frozen.delete(row.pid);
            observe({ event: 'signal-skipped', pid: row.pid, signal: kind, reason: 'process exited before its identity probe' });
            return true;
          }
          if (started !== null && started !== row.started) frozen.delete(row.pid);
          timeout(deadline);
          if (options.canSignal && !options.canSignal(current)) return false;
          if (started !== row.started) {
            observe({ event: 'signal-refused', pid: row.pid, signal: kind, reason: 'process identity changed or cannot be verified' });
            return kind === 'SIGTERM';
          }
          options.authorize?.();
          try {
            process.kill(row.pid, kind);
            if (kind === 'SIGSTOP') frozen.set(row.pid, row);
          }
          catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err;
            frozen.delete(row.pid);
          }
          return true;
        });
        if (!permitted) return false;
      }
      return true;
    };
    const freeze = async (): Promise<SystemProcess[] | null> => {
      freezeDeadline = Math.min(options.deadline ?? Infinity, Date.now() + 3000);
      for (;;) {
        timeout(freezeDeadline);
        if (!await signal('SIGSTOP')) return null;
        // A fresh walk closes the fork-to-freeze gap, including children of newly discovered descendants.
        const current = await inspect(freezeDeadline);
        timeout(freezeDeadline);
        if (resumed(() => matching(current).every(row => frozen.get(row.pid)?.started === row.started && row.state.startsWith('T')))) return current;
        await sleep(20);
      }
    };
    const thaw = () => resumed(() => {
      // Resume every PID we stopped unless its identity is confirmed gone, even if inspection failed.
      // Unobserved reuse during inspection failure can CONT a replacement; this recovery tradeoff is explicit.
      // TERM, STOP and KILL still require an immediately verified identity.
      for (const pid of frozen.keys()) {
        try { process.kill(pid, 'SIGCONT'); frozen.delete(pid); }
        catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ESRCH') frozen.delete(pid);
          else observe({ event: 'process-thaw-failed', pid, error: String(err) });
        }
      }
    });
    const incomplete = async (reason: string) => {
      let confirmed = true;
      try { await inspect(); } catch { confirmed = false; }
      resumed(() => observe({ event: 'harness-end-incomplete', pid: p.pid, pids: matching(latest).map(row => row.pid), confirmed, reason }));
      return false;
    };
    const wait = async (ms: number, discoverChildren = false) => {
      const deadline = Date.now() + ms;
      for (;;) {
        const alive = await remaining(discoverChildren);
        const result = resumed(() => !alive.length ? true : Date.now() >= deadline ? false : null);
        if (result !== null) return result;
        await sleep(50);
      }
    };
    try {
      // A contending owner may have ended the captured tree while we waited. Retain the
      // original descendants across that wait so a surviving reparented child is still owned.
      if (!(await remaining()).length) return true;
      resumed(() => options.authorize?.());
      await beforeSignal?.();
      // Let the harness close its bridges gracefully. Before escalation, freeze and capture the entire tree.
      if (!await signal('SIGTERM', true)) return await incomplete('SIGTERM refused');
      let forced = false;
      if (!await wait(graceMs, true)) {
        forced = true;
        const snapshot = await freeze();
        if (!snapshot || !await signal('SIGKILL', false, snapshot)) return await incomplete('freeze or SIGKILL refused');
        if (!await wait(3000)) throw new Error(`pid ${p.pid}'s process tree did not exit after SIGKILL; surviving pids: ${matching(latest).map(row => row.pid).join(', ')}`);
      }
      resumed(() => observe({ event: 'harness-ended', pid: p.pid, pids: [...owned.keys()], forced }));
      return true;
    } catch (err) {
      await incomplete(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      if (frozen.size) thaw();
    }
  }
}
