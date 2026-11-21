import { pgrepMembers } from './pgrep-result.ts';
import { readFile } from 'node:fs/promises';
import { parseLinuxStat } from './host/agent/proc-stat.ts';
import { readLinuxStat } from './host/agent/identity.ts';
import type { HostCapturedProcess } from './host/host.ts';
// Bounded asynchronous termination requires verified identities; recovery CONT has an explicit exception.
import { probeTimeout, run } from './doctor/report.ts';
import { processIdentitiesAsync, type IdentityExited } from './process-identity.ts';
import { processStartedAsync } from './hub/lock.ts';
import type { Resumed } from './hub/worktrees.ts';
import { pidAlive } from './project.ts';
import { TerminationOwner } from './termination-owner.ts';
import { withCleanupAsync } from './cleanup.ts';
import { parseProcessTable, processTableArgs, retainProcessAncestry, type SystemProcess } from './process-table.ts';
export type { SystemProcess } from './process-table.ts';

const untimed: Resumed = work => work();
export function branchAbsenceFailure(pid: number, rows: SystemProcess[]): string | null {
  const pending = [pid], seen = new Set<number>();
  for (const current of pending) {
    if (seen.has(current)) continue;
    seen.add(current);
    try { process.kill(current, 0); return `kill(0) pid ${current}: process still present`; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ESRCH') return `kill(0) pid ${current}: ${code ?? 'unknown error'}`;
    }
    for (const child of rows) if (child.parent === current && !seen.has(child.pid)) pending.push(child.pid);
  }
  return null;
}
export type ProcessEndOptions = {
  /** Synchronous owner receipt: initial tree, then newly verified descendants. */
  onCaptured?: (tree: readonly HostCapturedProcess[]) => void;
  env?: NodeJS.ProcessEnv;
  resumed?: Resumed;
  /** Recheck the caller's live authority immediately before destructive actions. */
  authorize?: (tree?: readonly HostCapturedProcess[]) => void;
  /** Atomically reserve each captured identity for this worker before any further await. */
  claim?: (identity: SystemProcess) => boolean;
  /** Relaunch of a row already marked exited may leave a proven reused PID alone. */
  allowReused?: boolean;
  /** Recheck reservations and running process trees immediately before each signal. */
  canSignal?: (rows: SystemProcess[]) => boolean;
  /** Optional owner scope for the captured tree and group, checked before each signal phase. */
  canSignalTargets?: (targets: SystemProcess[], snapshot: SystemProcess[]) => Promise<boolean>;
  /** A shared deadline bounds a sweep, including each OS probe. */
  deadline?: number;
  /** Inspect only captured roots/descendants, retaining a separate caller-ancestor fence. */
  inspection?: 'owned-tree';
};
function timeout(deadline?: number, env: NodeJS.ProcessEnv = process.env): number {
  const remaining = deadline === undefined ? 3000 : deadline - Date.now();
  if (remaining <= 0) throw new Error('process inspection deadline reached; remaining processes preserved');
  return Math.min(probeTimeout(env, 3000), remaining);
}
export async function systemProcesses(resumed: Resumed = untimed, deadline?: number, pids?: number[], descendants = false, env: NodeJS.ProcessEnv = process.env, reportExited?: IdentityExited): Promise<SystemProcess[]> {
  return processSnapshot(resumed, deadline, pids, descendants, env, reportExited);
}
async function processSnapshot(resumed: Resumed, deadline: number | undefined, pids: number[] | undefined, descendants: boolean, env: NodeJS.ProcessEnv, reportExited?: IdentityExited, protectedPids: number[] = []): Promise<SystemProcess[]> {
  if (pids && descendants) {
    const discoveryDeadline = Math.min(deadline ?? Infinity, Date.now() + 3000);
    const selected = new Set(pids);
    let parents = pids;
    while (parents.length) {
      // Select children of captured PIDs, then walk only those newly selected parents.
      // The ps snapshot below must still prove every ancestry edge before capture.
      const children = await run('pgrep', ['-P', parents.join(',')], env, timeout(discoveryDeadline, env));
      const discovered = pgrepMembers(children);
      parents = resumed(() => discovered.filter(pid => {
        if (selected.has(pid)) return false;
        selected.add(pid); return true;
      }));
    }
    pids = [...selected];
  }
  // Reuse the probe runner: a wrapper's grandchildren must not keep stdout open past the deadline.
  // Ancestors are denial-only rows. Never discover their children: PID 1 would
  // turn an owned-tree walk back into a whole-machine census.
  const selected = pids ? [...new Set([process.pid, ...pids, ...protectedPids])] : undefined;
  // An owned-tree selector already names every requested PID. Read their births
  // first, then one authoritative batched ps, then births again. Ordinary full
  // snapshots retain their selector discovery and its previous contract.
  let pidsInView = selected;
  if (!protectedPids.length || !pidsInView) {
    const discovery = await run('ps', processTableArgs(selected), env, timeout(deadline, env));
    if (discovery.code !== 0 || discovery.error) throw new Error('cannot inspect the OS process table: ps failed or timed out');
    pidsInView = parseProcessTable(discovery.stdout).map(row => row.pid);
  }
  if (!pidsInView.includes(process.pid)) throw new Error('cannot verify the OS process table format');
  // Selector discovery grants no ownership. Births must be stable on both sides
  // of the authoritative ancestry/group/command observation.
  const errors = new Map<number, string>();
  const before = await processIdentitiesAsync(pidsInView, env, timeout(deadline, env), (pid, error) => errors.set(pid, `before ownership snapshot: ${error}`));
  const result = await run('ps', processTableArgs(pidsInView), env, timeout(deadline, env));
  const exited = new Set<number>();
  const after = await processIdentitiesAsync(pidsInView, env, timeout(deadline, env), (pid, error) => errors.set(pid, `after ownership snapshot: ${error}`), pid => {
    exited.add(pid);
    reportExited?.(pid);
  });
  return resumed(() => {
    if (result.code !== 0 || result.error) throw new Error('cannot inspect the OS process table: ps failed or timed out');
    const rows = parseProcessTable(result.stdout);
    if (!rows.some(row => row.pid === process.pid)) throw new Error('cannot verify the OS process table format');
    // A final exit supersedes a running ps row only after its listed branch is
    // gone too. Preserve unknown ancestry rather than hide a surviving writer.
    return retainProcessAncestry(rows, exited).map(row => {
      const identity = before.get(row.pid) && before.get(row.pid) === after.get(row.pid) ? before.get(row.pid)! : null;
      return { ...row, identity, ...(!identity ? { identityError: exited.has(row.pid) ? 'native exit observed; listed descendants are not confirmed gone' : errors.get(row.pid) ?? 'native birth unavailable or changed across ownership snapshot' } : {}) };
    });
  });
}

/** Parent links grant no signal authority; an incomplete caller chain refuses. */
async function callerAncestors(resumed: Resumed, deadline: number | undefined, env: NodeJS.ProcessEnv): Promise<number[]> {
  const chain: number[] = [];
  for (let pid = process.pid; pid > 0;) {
    if (chain.includes(pid) || chain.length >= 64) throw new Error('cannot verify caller ancestry: cyclic or excessive parent chain');
    chain.push(pid);
    if (pid === 1) break;
    if (process.platform === 'linux') {
      const selected = pid;
      const record = parseLinuxStat(await readLinuxStat(() => readFile(`/proc/${selected}/stat`, { encoding: 'utf8', signal: AbortSignal.timeout(timeout(deadline, env)) })));
      if (!record || record.pid !== selected || record.parent === null || /^[ZX]/.test(record.state)) throw new Error('cannot verify caller ancestry: native parent inspection unavailable');
      pid = record.parent;
      continue;
    }
    const result = await run('ps', processTableArgs([pid]), env, timeout(deadline, env));
    const row = resumed(() => parseProcessTable(result.stdout).find(row => row.pid === pid));
    if (result.code !== 0 || result.error || !row) throw new Error('cannot verify caller ancestry: parent inspection unavailable');
    pid = row.parent;
  }
  return chain;
}
function verifyCallerAncestry(rows: SystemProcess[], roots: number[]): void {
  const seen = new Set<number>();
  for (let pid = process.pid; pid > 0;) {
    if (seen.has(pid)) throw new Error('cannot verify caller ancestry: cyclic parent chain');
    if (roots.includes(pid)) throw new Error('refusing to end this process or its ancestor');
    seen.add(pid);
    const row = rows.find(row => row.pid === pid);
    if (!row) throw new Error('cannot verify caller ancestry: parent changed or disappeared');
    if (pid === 1) return;
    pid = row.parent;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Capture descendants while ancestry is intact; verify each positive PID immediately before its signal.
 * Group membership can change during an identity probe, so never signal an entire group.
 */
export async function endProcess(p: { pid: number | null; pidStarted?: string | null; pidIdentity?: string | null }, log: (entry: Record<string, unknown>) => void = () => {}, graceMs = 5000, beforeSignal?: (tree?: readonly HostCapturedProcess[]) => Promise<void>, options: ProcessEndOptions = {}): Promise<boolean> {
  const resumed = options.resumed ?? untimed;
  const env = options.env ?? process.env;
  const observe = (entry: Record<string, unknown>) => { try { log(entry); } catch { /* observers cannot abort recovery */ } };
  if (p.pid === null) return false;
  const protectedPids = options.inspection === 'owned-tree' ? await callerAncestors(resumed, options.deadline, env) : undefined;
  if (protectedPids?.includes(p.pid)) throw new Error('refusing to end this process or its ancestor');
  const snapshot = async (deadline: number | undefined, roots?: number[], descendants = false, reportExited?: IdentityExited) => {
    const current = await processSnapshot(resumed, deadline, roots, descendants, env, reportExited, protectedPids);
    if (protectedPids) resumed(() => verifyCallerAncestry(current, roots ?? []));
    return current;
  };
  const rows = await snapshot(options.deadline, protectedPids ? [p.pid] : undefined, !!protectedPids);
  const owned = new Map<number, SystemProcess>();
  const capturedStopTree = (): HostCapturedProcess[] => [...owned.values()].map(row => ({ pid: row.pid, pidStarted: row.started, pidIdentity: row.identity! }));
  const publishCaptured = () => {
    // A partial validation has the same self/ancestor fence as a complete tree.
    for (let row = rows.find(row => row.pid === process.pid); row; row = rows.find(next => next.pid === row!.parent)) {
      if (owned.has(row.pid)) throw new Error('refusing to end this process or its ancestor');
    }
    options.onCaptured?.(capturedStopTree());
  };
  const leader = resumed(() => {
    const leader = rows.find(row => row.pid === p.pid);
    if (!leader) return undefined;
    if (!p.pidStarted || !p.pidIdentity || !leader.identity) {
      observe({ event: 'signal-refused', pid: p.pid, signal: 'SIGTERM', reason: `process identity cannot be verified: ${!p.pidIdentity ? 'recorded native birth missing; ' : ''}${leader.identityError ?? (!p.pidStarted ? 'recorded ps start missing' : 'native birth unavailable')}` });
      return null;
    }
    if (leader.started !== p.pidStarted || leader.identity !== p.pidIdentity) {
      observe({ event: 'signal-refused', pid: p.pid, signal: 'SIGTERM', reason: 'PID was reused; the recorded process is gone' });
      return options.allowReused ? undefined : null;
    }
    if (options.claim && !options.claim(leader)) return null;
    owned.set(leader.pid, leader);
    let incomplete = false;
    for (let changed = true; changed;) {
      changed = false;
      for (const row of rows) if (owned.has(row.parent) && !owned.has(row.pid)) {
        if (!row.identity) {
          // A short-lived child can exit between the ownership snapshot and its
          // second birth probe. Confirmed absence needs no signal or ownership.
          // A stale child row is not evidence of a surviving branch. Require
          // an ESRCH receipt for every listed member before dropping it.
          const absenceFailure = branchAbsenceFailure(row.pid, rows);
          if (absenceFailure === null) continue;
          observe({ event: 'signal-refused', pid: row.pid, reason: `descendant native identity cannot be verified: ${row.identityError ?? 'native birth unavailable'}; ${absenceFailure}` });
          incomplete = true;
          continue;
        }
        if (!options.claim || options.claim(row)) { owned.set(row.pid, row); changed = true; }
      }
    }
    if (incomplete) {
      if (options.onCaptured) publishCaptured();
      return null;
    }
    publishCaptured();
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
    const exited = new Set<number>();
    let latest = rows;
    let freezeDeadline: number | undefined;
    const extend = async (current: SystemProcess[], deadline?: number) => {
      let incomplete: Error | undefined;
      const discovered = new Set<number>();
      for (let changed = true; changed;) {
        changed = false;
        const children = resumed(() => {
          const byPid = new Map(current.map(row => [row.pid, row]));
          return current.filter(row => {
            const parent = byPid.get(row.parent);
            return parent && owned.get(parent.pid)?.identity === parent.identity && parent.identity != null && !owned.has(row.pid);
          });
        });
        for (const row of children) {
          if (!row.identity) {
            const absenceFailure = branchAbsenceFailure(row.pid, current);
            if (absenceFailure === null) continue;
            incomplete ??= new Error(`descendant native identity cannot be verified: ${row.identityError ?? 'native birth unavailable'}; ${absenceFailure}`);
            continue;
          }
          // Retain the entire verified reachable set before acquisition can
          // reject: ancestors may exit during the first await, losing siblings
          // or nested descendants that have not yet been published.
          resumed(() => {
            if (!options.claim || options.claim(row)) {
              owned.set(row.pid, row); changed = true;
              options.onCaptured?.([{ pid: row.pid, pidStarted: row.started, pidIdentity: row.identity! }]);
            }
          });
          discovered.add(row.pid);
        }
      }
      for (const pid of discovered) await owner.capture(pid, deadline);
      if (incomplete) throw incomplete;
    };
    const inspect = async (deadline = options.deadline) => {
      const current = await snapshot(deadline, protectedPids ? [...owned.keys()] : undefined, !!protectedPids, pid => exited.add(pid));
      await extend(current, deadline);
      return resumed(() => {
        latest = current;
        for (const [pid, identity] of frozen) {
          if (exited.has(pid) || current.some(row => row.pid === pid && row.identity != null && row.identity !== identity.identity) || !current.some(row => row.pid === pid) && !pidAlive(pid)) frozen.delete(pid);
        }
        return current;
      });
    };
    const matching = (current: SystemProcess[]) => current.filter(row => owned.has(row.pid) && (row.identity == null || owned.get(row.pid)?.identity === row.identity));
    const remaining = async (discoverChildren = false) => {
      const absent = resumed(() => [...owned.keys()].every(pid => !pidAlive(pid)));
      if (absent) return resumed(() => { latest = []; frozen.clear(); return []; });
      // Grace polls retain children born while a captured parent lives. After the
      // full-tree freeze/KILL, waiting needs only captured identities.
      const current = await snapshot(options.deadline, [...owned.keys()], discoverChildren, pid => exited.add(pid));
      if (discoverChildren) await extend(current, options.deadline);
      return resumed(() => {
        latest = current;
        for (const [pid, identity] of frozen) if (exited.has(pid) || current.some(row => row.pid === pid && row.identity != null && row.identity !== identity.identity) || !current.some(row => row.pid === pid) && !pidAlive(pid)) frozen.delete(pid);
        return matching(current);
      });
    };
    const signal = async (kind: NodeJS.Signals, leaderOnly = false, snapshot?: SystemProcess[]): Promise<boolean> => {
      const deadline = kind === 'SIGSTOP' ? freezeDeadline : options.deadline;
      const current = snapshot ?? await inspect(deadline);
      const captured = resumed(() => matching(current));
      if (options.canSignalTargets && !await options.canSignalTargets(captured, current)) {
        observe({ event: 'signal-refused', pid: p.pid, signal: kind, reason: 'live signal target outside owner scope or unavailable' });
        return false;
      }
      const targets = resumed(() => {
        return captured.filter(row => (!leaderOnly || row.pid === leaderPid) &&
          (kind !== 'SIGSTOP' || frozen.get(row.pid)?.identity !== row.identity || !row.state.startsWith('T')));
      });
      for (const row of targets) {
        // No other target's probe or await may intervene between this identity check and its signal.
        const stamp = await processStartedAsync(row.pid, timeout(deadline, env), resumed, undefined, env);
        let birthError: string | undefined;
        let exited = false;
        const started = (await processIdentitiesAsync([row.pid], env, timeout(deadline, env), (_pid, error) => { birthError = error; }, pid => { if (pid === row.pid) exited = true; })).get(row.pid) ?? null;
        const permitted = resumed(() => {
          // A preceding signal can end another captured descendant before its probe runs. An empty
          // answer alone is ambiguous; a confirmed absent PID needs no signal and is already finished.
          if (exited || started === null && !pidAlive(row.pid)) {
            frozen.delete(row.pid);
            observe({ event: 'signal-skipped', pid: row.pid, signal: kind, reason: 'process exited before its identity probe' });
            return true;
          }
          if (started !== null && started !== owned.get(row.pid)?.identity) frozen.delete(row.pid);
          timeout(deadline);
          if (options.canSignal && !options.canSignal(current)) return false;
          if (stamp === null || started === null || started !== owned.get(row.pid)?.identity) {
            observe({ event: 'signal-refused', pid: row.pid, signal: kind, reason: `process identity changed or cannot be verified: ${birthError ?? (stamp === null ? 'ps start unavailable' : 'native birth missing or mismatched')}` });
            return kind === 'SIGTERM';
          }
          options.authorize?.(capturedStopTree());
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
        if (resumed(() => matching(current).every(row => frozen.get(row.pid)?.identity === row.identity && row.state.startsWith('T')))) return current;
        await sleep(20);
      }
    };
    const thaw = async () => {
      if (!options.canSignalTargets) {
        // Preserve the ordinary recovery tradeoff for pre-existing callers.
        resumed(() => {
          for (const pid of frozen.keys()) {
            if (exited.has(pid)) { frozen.delete(pid); continue; }
            try { process.kill(pid, 'SIGCONT'); frozen.delete(pid); }
            catch (err) {
              if ((err as NodeJS.ErrnoException).code === 'ESRCH') frozen.delete(pid);
              else observe({ event: 'process-thaw-failed', pid, error: String(err) });
            }
          }
        });
        return;
      }
      let failed = false;
      for (const [pid, captured] of [...frozen]) {
        const proof = async (): Promise<'same' | 'gone' | 'unknown'> => {
          let nativeExited = false;
          const identity = (await processIdentitiesAsync([pid], env, timeout(options.deadline, env), undefined, () => { nativeExited = true; })).get(pid) ?? null;
          if (nativeExited || identity === null && !pidAlive(pid) || identity !== null && identity !== captured.identity) return 'gone';
          return identity !== null && identity === captured.identity ? 'same' : 'unknown';
        };
        try {
          const before = await proof();
          if (before === 'gone') { frozen.delete(pid); continue; }
          if (before !== 'same') throw new Error('native thaw identity unavailable');
          const current = await snapshot(options.deadline, protectedPids ? [...owned.keys()] : undefined, !!protectedPids);
          const target = current.find(row => row.pid === pid);
          if (!target?.identity || target.identity !== captured.identity) throw new Error('native thaw snapshot unavailable or changed');
          if (!await options.canSignalTargets([target], current)) throw new Error('thaw target outside owner scope or unavailable');
          const after = await proof();
          if (after === 'gone') { frozen.delete(pid); continue; }
          if (after !== 'same') throw new Error('native thaw identity unavailable after scope check');
          resumed(() => { options.authorize?.(capturedStopTree()); process.kill(pid, 'SIGCONT'); frozen.delete(pid); });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ESRCH') frozen.delete(pid);
          else { failed = true; observe({ event: 'process-thaw-failed', pid, error: String(err) }); }
        }
      }
      if (failed) throw new Error('isolated process thaw incomplete; live target identity or scope unavailable');
    };
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
      resumed(() => options.authorize?.(capturedStopTree()));
      await beforeSignal?.(capturedStopTree());
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
      if (frozen.size) await thaw();
    }
  }
}
