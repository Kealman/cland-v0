// OS process identities and bounded, asynchronous termination. Never signal a PID on a guess.
import { probeTimeout, run } from './doctor/report.ts';
import { processStartedAsync } from './hub/lock.ts';
import type { Resumed } from './hub/worktrees.ts';

const untimed: Resumed = work => work();
export type SystemProcess = { pid: number; parent: number; group: number; started: string; command: string };
export type ProcessEndOptions = {
  resumed?: Resumed;
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
export async function systemProcesses(resumed: Resumed = untimed, deadline?: number): Promise<SystemProcess[]> {
  // Reuse the probe runner: a wrapper's grandchildren must not keep stdout open past the deadline.
  const result = await run('ps', ['ww', '-axo', 'pid=,ppid=,pgid=,lstart=,stat=,command='], process.env, timeout(deadline));
  return resumed(() => {
    if (result.code !== 0 || result.error) throw new Error('cannot inspect the OS process table: ps failed or timed out');
    const rows = result.stdout.split('\n').flatMap(line => {
      const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(\S+)\s+(.+)$/.exec(line);
      return m && !m[5]!.startsWith('Z') ? [{ pid: Number(m[1]), parent: Number(m[2]), group: Number(m[3]), started: m[4]!.replace(/\s+/g, ' '), command: m[6]! }] : [];
    });
    if (!rows.some(row => row.pid === process.pid)) throw new Error('cannot verify the OS process table format');
    return rows;
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Capture descendants while ancestry is intact; verify each identity again before every signal.
 * A group is signalled only when its leader and every current member belong to this captured tree.
 */
export async function endProcess(p: { pid: number | null; pidStarted?: string | null }, log: (entry: Record<string, unknown>) => void = () => {}, graceMs = 5000, beforeSignal?: () => Promise<void>, options: ProcessEndOptions = {}): Promise<boolean> {
  const resumed = options.resumed ?? untimed;
  if (p.pid === null) return false;
  const rows = await systemProcesses(resumed, options.deadline);
  const owned = new Map<number, SystemProcess>();
  const leader = resumed(() => {
    const leader = rows.find(row => row.pid === p.pid);
    if (!leader) return undefined;
    if (!p.pidStarted) {
      log({ event: 'signal-refused', pid: p.pid, signal: 'SIGTERM', reason: 'process identity cannot be verified' });
      return null;
    }
    if (leader.started !== p.pidStarted) {
      log({ event: 'signal-refused', pid: p.pid, signal: 'SIGTERM', reason: 'PID was reused; the recorded process is gone' });
      return options.allowReused ? undefined : null;
    }
    owned.set(leader.pid, leader);
    for (let changed = true; changed;) {
      changed = false;
      for (const row of rows) if (owned.has(row.parent) && !owned.has(row.pid)) { owned.set(row.pid, row); changed = true; }
    }
    // Protect the hub and its ancestors even if a corrupt row names one of them.
    for (let row = rows.find(row => row.pid === process.pid); row; row = rows.find(next => next.pid === row!.parent)) {
      if (owned.has(row.pid)) throw new Error('refusing to end this process or its ancestor');
    }
    return leader;
  });
  if (leader === undefined) return true;
  if (leader === null) return false;
  const extend = (current: SystemProcess[]) => {
    const byPid = new Map(current.map(row => [row.pid, row]));
    for (let changed = true; changed;) {
      changed = false;
      for (const row of current) {
        const parent = byPid.get(row.parent);
        if (parent && owned.get(parent.pid)?.started === parent.started && !owned.has(row.pid)) {
          owned.set(row.pid, row); changed = true;
        }
      }
    }
  };
  const remaining = async () => {
    const current = await systemProcesses(resumed, options.deadline);
    return resumed(() => { extend(current); return current.filter(row => owned.get(row.pid)?.started === row.started); });
  };
  const signal = async (kind: NodeJS.Signals, leaderOnly = false): Promise<boolean> => {
    const current = await systemProcesses(resumed, options.deadline);
    let plans: Array<{ pid: number; identities: SystemProcess[] }> = [];
    const starts = await resumed(() => {
      extend(current);
      const targets = current.filter(row => owned.get(row.pid)?.started === row.started && (!leaderOnly || row.pid === leader.pid));
      const groups = new Set<number>();
      plans = targets.flatMap(row => {
        if (groups.has(row.group)) return [];
        const members = current.filter(member => member.group === row.group);
        const whole = !leaderOnly && members.some(member => member.pid === row.group) && members.every(member => owned.get(member.pid)?.started === member.started);
        if (whole) groups.add(row.group);
        return [{ pid: whole ? -row.group : row.pid, identities: whole ? members : [row] }];
      });
      // Probe dispatch belongs to this same synchronous stretch; waiting for their answers does not.
      return Promise.all(plans.map(plan => Promise.all(plan.identities.map(member => processStartedAsync(member.pid, timeout(options.deadline), resumed)))));
    });
    return resumed(() => {
      timeout(options.deadline);
      if (options.canSignal && !options.canSignal(current)) return false;
      for (const [i, plan] of plans.entries()) {
        if (!starts[i]!.every((start, n) => start === plan.identities[n]!.started)) continue;
        try { process.kill(plan.pid, kind); }
        catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err; }
      }
      return true;
    });
  };
  const wait = async (ms: number) => {
    const deadline = Date.now() + ms;
    for (;;) {
      const alive = await remaining();
      const result = resumed(() => !alive.length ? true : Date.now() >= deadline ? false : null);
      if (result !== null) return result;
      await sleep(50);
    }
  };
  await beforeSignal?.();
  // Let the harness close its own bridges gracefully; terminate descendants after this grace too.
  if (!await signal('SIGTERM', true)) return false;
  let forced = false;
  if (!await wait(graceMs)) {
    forced = true;
    if (!await signal('SIGKILL')) return false;
    if (!await wait(3000)) throw new Error(`pid ${p.pid}'s process tree did not exit after SIGKILL`);
  }
  resumed(() => log({ event: 'harness-ended', pid: p.pid, pids: [...owned.keys()], forced }));
  return true;
}
