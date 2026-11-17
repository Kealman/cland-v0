import { suiteInfrastructureLine } from './suite-infrastructure.ts';
import { stdioWriters } from './stdio-writers.ts';
import { processIdentityAsync } from './process-identity.ts';
// Observe the command's bytes, rather than reporter totals, so silent test teardown is bounded too.
import { spawn } from 'node:child_process';
import { processStartedAsync } from './hub/lock.ts';
import { endProcess, systemProcesses } from './system-processes.ts';
import { suiteLimits } from './suite-limits.ts';
import type { TestProgress } from './suite-progress.ts';
import { availableParallelism, loadavg } from 'node:os';
import { suiteLoadFactor } from './suite-wait-budget.ts';
import { fileStartupTimeoutMs, watchFileStartup } from './file-startup-watchdog.ts';
import { stallCommandEvidence } from './suite-stall-evidence.ts';
import { parseStartupOwner } from './suite-startup-owner.ts';

const nativeProcesses = { processIdentityAsync, processStartedAsync, systemProcesses, stdioWriters, endProcess };
export interface SuiteInspectionReceipt {
  firstFailureAt: number;
  failures: number;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  lastErrorClass: string;
  unobservedBoundMs: number;
  unobservedPastBound: boolean;
}
const unobservedBoundMs = 5000;
export async function suiteCommand(line: string, cwd: string, env: NodeJS.ProcessEnv = process.env, native = nativeProcesses, reportInspection?: (receipt: SuiteInspectionReceipt) => void): Promise<{ code: number; cause: string; inspection?: SuiteInspectionReceipt }> {
  const { stallTimeoutMs, workers } = await suiteLimits(cwd, 'local', env);
  // Test-process startup/import readiness needs load headroom, independently of
  // test behaviour. Never let setup headroom consume the no-output guard.
  const startupMs = fileStartupTimeoutMs(stallTimeoutMs, suiteLoadFactor({
    load: loadavg()[0]!, parallelism: availableParallelism(), workers: workers ?? 1,
    ...(env.CLAND_SUITE_EXECUTOR ? { executor: env.CLAND_SUITE_EXECUTOR } : {}),
    ...(env.CLAND_TEST_LOAD_FACTOR ? { override: env.CLAND_TEST_LOAD_FACTOR } : {}),
  }));
  const child = spawn('/bin/sh', ['-c', line], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const birth = child.pid ? native.processIdentityAsync(child.pid, env) : Promise.resolve(null);
  const identity = child.pid ? native.processStartedAsync(child.pid) : Promise.resolve(null);
  let cause = '';
  let infrastructure = '';
  let interrupted = false;
  let ending: Promise<void> | undefined;
  const stopped = Promise.withResolvers<void>();
  let timer: NodeJS.Timeout | undefined;
  let observeTimer: NodeJS.Timeout | undefined;
  let closed = false;
  let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  child.once('exit', (code, signal) => { exit = { code, signal }; resumeStartup(); });
  const owned = new Map<number, { pid: number; started: string; identity: string }>();
  // Preserve proof across parent exit/reparenting. Cwd, command text and group
  // membership alone never admit a process into this ownership set.
  const capture = async () => {
    const started = await identity;
    const nativeBirth = await birth;
    if (child.pid && started && nativeBirth && !owned.has(child.pid)) owned.set(child.pid, { pid: child.pid, started, identity: nativeBirth });
    const rows = await native.systemProcesses(undefined, Date.now() + 3000);
    const byPid = new Map(rows.map(row => [row.pid, row]));
    for (let changed = true; changed;) {
      changed = false;
      for (const row of rows) {
        const parent = byPid.get(row.parent);
        if (parent && parent.identity != null && owned.get(parent.pid)?.identity === parent.identity && !owned.has(row.pid)) {
          if (row.identity) { owned.set(row.pid, { pid: row.pid, started: row.started, identity: row.identity }); changed = true; }
        }
      }
    }
    for (const [pid, proof] of owned) {
      if (pid !== child.pid && byPid.get(pid)?.identity !== proof.identity) owned.delete(pid);
    }
  };
  let observing: Promise<void> = Promise.resolve();
  let inspection: SuiteInspectionReceipt | undefined;
  let unobservedSince: number | undefined;
  const noteUnobserved = () => {
    if (inspection && unobservedSince !== undefined && Date.now() - unobservedSince > unobservedBoundMs) inspection.unobservedPastBound = true;
  };
  const observe = () => {
    const attemptedAt = Date.now();
    observing = capture().then(() => {
      noteUnobserved();
      unobservedSince = undefined;
      if (inspection) inspection.consecutiveFailures = 0;
    }).catch(error => {
      // No messages, argv or arbitrary class names: native errors can contain secrets.
      const lastErrorClass = error instanceof TypeError ? 'TypeError' : error instanceof Error ? 'Error' : 'NonError';
      inspection ??= { firstFailureAt: attemptedAt, failures: 0, consecutiveFailures: 0, maxConsecutiveFailures: 0, lastErrorClass, unobservedBoundMs, unobservedPastBound: false };
      unobservedSince ??= attemptedAt;
      inspection.failures++;
      inspection.consecutiveFailures++;
      inspection.maxConsecutiveFailures = Math.max(inspection.maxConsecutiveFailures, inspection.consecutiveFailures);
      inspection.lastErrorClass = lastErrorClass;
      noteUnobserved();
      // Failed inspection establishes no new descendant ownership; prior proofs remain.
    }).finally(() => {
      if (!ending && !interrupted && !closed) observeTimer = setTimeout(observe, 1000);
    });
  };
  const partial = new Map<NodeJS.WriteStream, string>();
  const unfinished = new Map<string, string>();
  const ended = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => { resumeStartup(); resolve({ code, signal }); });
  });
  const stop = (reason: string) => {
    if (ending || interrupted) return;
    const evidence = stallCommandEvidence(reason, { commandPid: child.pid ?? null, exit: exit ?? null, stdout: child.stdout.readableEnded ? 'closed' : 'open', stderr: child.stderr.readableEnded ? 'closed' : 'open' });
    cause = evidence.cause;
    process.stderr.write(evidence.line + '\n');
    if (evidence.startupLine) process.stderr.write(evidence.startupLine + '\n');
    process.stderr.write(cause + '\n');
    clearTimeout(timer);
    clearTimeout(observeTimer);
    startup.stop();
    ending = (async () => {
      await observing;
      const started = await identity;
      if (!child.pid || !started) throw new Error('cannot verify silent command identity');
      // Endpoint ownership survives reparenting even before the first ancestry
      // snapshot. Native birth is bracketed around the census and rechecked by
      // endProcess immediately before each signal.
      const rows = await native.systemProcesses(undefined, Date.now() + 3000);
      for (const row of await native.stdioWriters([child.stdout, child.stderr], rows, env)) {
        if (row.identity) owned.set(row.pid, { pid: row.pid, started: row.started, identity: row.identity });
      }
      // Do not dump argv or the environment. Only current, birth-matched owners
      // belong in this bounded diagnostic; a stale census is not a live receipt.
      const live = rows.filter(row => row.identity && owned.get(row.pid)?.identity === row.identity);
      process.stderr.write(`suite stall processes ${JSON.stringify({ commandPid: child.pid, total: live.length, processes: live.slice(0, 32).map(row => ({ pid: row.pid, name: row.command.split(/\s/)[0]!.split('/').pop()!.slice(0, 80) })) })}\n`);
      // The root may be gone while inherited pipes are still open. Retained
      // identities still authorize cleanup; endProcess rechecks each before signalling.
      for (const proof of owned.values()) {
        if (!await native.endProcess({ pid: proof.pid, pidStarted: proof.started, pidIdentity: proof.identity }, () => {}, 500, undefined, { allowReused: true })) throw new Error('cannot reap silent command tree');
      }
      const pipesClosed = await new Promise<boolean>(resolve => {
        const deadline = setTimeout(() => resolve(false), 500);
        void ended.then(() => { clearTimeout(deadline); resolve(true); }, () => { clearTimeout(deadline); resolve(false); });
      });
      if (!pipesClosed) cause += `; cleanup incomplete: unverified inherited-pipe writer (command pid ${child.pid}; stdout ${child.stdout.readableEnded ? 'closed' : 'open'}; stderr ${child.stderr.readableEnded ? 'closed' : 'open'})`;
    })();
    // Observe immediately; propagate cleanup failures below without an unhandled rejection.
    void ending.then(stopped.resolve, stopped.resolve);
  };
  const arm = () => {
    clearTimeout(timer);
    if (ending || interrupted) return;
    timer = setTimeout(() => {
      const minutes = Number((stallTimeoutMs / 60000).toFixed(3));
      stop(`stalled: no output for ${minutes} min; last started tests: ${[...unfinished.values()].slice(-8).join(' | ') || '(none reported)'}`);
    }, stallTimeoutMs);
  };
  const innerOwners = new Set<string>();
  let deferredStartup: string | undefined;
  const newStartup = () => watchFileStartup({ timeoutMs: startupMs, stalled: reason => {
    if (innerOwners.size) deferredStartup = reason;
    else stop(reason);
  } });
  let startup = newStartup();
  const resumeStartup = () => {
    innerOwners.clear();
    if (deferredStartup) { const reason = deferredStartup; deferredStartup = undefined; stop(reason); }
  };
  const output = (chunk: string, stream: NodeJS.WriteStream) => {
    arm();
    stream.write(chunk);
    let pending = (partial.get(stream) ?? '') + chunk;
    let newline: number;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (suiteInfrastructureLine(line)) infrastructure = line.slice(0, 4096);
      const owner = parseStartupOwner(line);
      if (owner && !ending && !interrupted && !closed) {
        if (owner.event === 'start') innerOwners.add(owner.id);
        else if (innerOwners.delete(owner.id) && innerOwners.size === 0) {
          // A finish follows the inner owner's joined native exit/timeout cleanup.
          startup.stop(); deferredStartup = undefined; startup = newStartup();
        }
      }
      if (line.startsWith('suite progress ')) {
        try {
          const row = JSON.parse(line.slice('suite progress '.length)) as TestProgress;
          if (typeof row.id !== 'string' || typeof row.file !== 'string' || typeof row.name !== 'string') continue;
          if (!ending && !interrupted && !closed) startup.progress(row);
          if (row.event === 'start') unfinished.set(row.id, JSON.stringify({ file: row.file, name: row.name }).slice(0, 1000));
          else if (row.event === 'finish' && ['pass', 'fail', 'skip', 'todo'].includes(row.outcome ?? '')) unfinished.delete(row.id);
        } catch { /* Torn progress cannot erase an observed start. */ }
      }
    }
    partial.set(stream, pending.slice(-16384));
  };
  child.stdout.setEncoding('utf8').on('data', chunk => output(chunk, process.stdout));
  child.stderr.setEncoding('utf8').on('data', chunk => output(chunk, process.stderr));
  const handlers = (['SIGINT', 'SIGTERM'] as const).map(signal => {
    // Hub cancellation already owns termination of the worker tree. Do not
    // acquire a competing termination owner from inside that captured tree.
    const handler = () => { interrupted = true; clearTimeout(timer); clearTimeout(observeTimer); startup.stop(); child.kill(signal); };
    process.on(signal, handler);
    return { signal, handler };
  });
  arm();
  observe();
  try {
    const outcome = await Promise.race([ended, stopped.promise.then(async () => {
      await ending;
      child.stdout.destroy(); child.stderr.destroy();
      return { code: 1, signal: null };
    })]);
    await ending;
    closed = true;
    clearTimeout(timer);
    clearTimeout(observeTimer);
    startup.stop();
    await observing;
    noteUnobserved();
    return { code: cause ? 1 : outcome.code ?? 1, cause: cause || infrastructure || (outcome.signal ? `command terminated by ${outcome.signal}` : ''), ...(inspection ? { inspection } : {}) };
  } finally {
    closed = true;
    clearTimeout(timer);
    clearTimeout(observeTimer);
    startup.stop();
    await observing;
    noteUnobserved();
    if (inspection) {
      process.stderr.write(`suite inspection ${JSON.stringify(inspection)}\n`);
      // The worker owns the durable result even when cleanup rejects this call.
      reportInspection?.(inspection);
    }
    for (const { signal, handler } of handlers) process.off(signal, handler);
  }
}
