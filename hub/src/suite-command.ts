// Observe the command's bytes, rather than reporter totals, so silent test teardown is bounded too.
import { spawn } from 'node:child_process';
import { processStartedAsync } from './hub/lock.ts';
import { endProcess, systemProcesses } from './system-processes.ts';
import { suiteLimits } from './suite-limits.ts';

export async function suiteCommand(line: string, cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<{ code: number; cause: string }> {
  const { stallTimeoutMs } = await suiteLimits(cwd, 'local', env);
  const child = spawn('/bin/sh', ['-c', line], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const identity = child.pid ? processStartedAsync(child.pid) : Promise.resolve(null);
  let cause = '';
  let interrupted = false;
  let ending: Promise<void> | undefined;
  const stopped = Promise.withResolvers<void>();
  let timer: NodeJS.Timeout | undefined;
  let observeTimer: NodeJS.Timeout | undefined;
  let closed = false;
  const owned = new Map<number, { pid: number; started: string }>();
  // Preserve proof across parent exit/reparenting. Cwd, command text and group
  // membership alone never admit a process into this ownership set.
  const capture = async () => {
    const started = await identity;
    if (child.pid && started && !owned.has(child.pid)) owned.set(child.pid, { pid: child.pid, started });
    const rows = await systemProcesses();
    const byPid = new Map(rows.map(row => [row.pid, row]));
    for (let changed = true; changed;) {
      changed = false;
      for (const row of rows) {
        const parent = byPid.get(row.parent);
        if (parent && owned.get(parent.pid)?.started === parent.started && !owned.has(row.pid)) {
          owned.set(row.pid, { pid: row.pid, started: row.started }); changed = true;
        }
      }
    }
    for (const [pid, proof] of owned) {
      if (pid !== child.pid && byPid.get(pid)?.started !== proof.started) owned.delete(pid);
    }
  };
  let observing: Promise<void> = Promise.resolve();
  const observe = () => {
    observing = capture().catch(() => { /* failed inspection establishes no new ownership */ }).finally(() => {
      if (!ending && !interrupted && !closed) observeTimer = setTimeout(observe, 1000);
    });
  };
  const partial = new Map<NodeJS.WriteStream, string>();
  const lastTests: string[] = [];
  const ended = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const stop = (reason: string) => {
    if (ending || interrupted) return;
    cause = reason;
    clearTimeout(timer);
    clearTimeout(observeTimer);
    ending = (async () => {
      await observing;
      const started = await identity;
      if (!child.pid || !started) throw new Error('cannot verify silent command identity');
      // The root may be gone while inherited pipes are still open. Retained
      // identities still authorize cleanup; endProcess rechecks each before signalling.
      for (const proof of owned.values()) {
        if (!await endProcess({ pid: proof.pid, pidStarted: proof.started }, () => {}, 500, undefined, { allowReused: true })) throw new Error('cannot reap silent command tree');
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
      stop(`stalled: no output for ${minutes} min; last started tests: ${lastTests.join(' | ') || '(none reported)'}`);
    }, stallTimeoutMs);
  };
  const output = (chunk: string, stream: NodeJS.WriteStream) => {
    arm();
    stream.write(chunk);
    let pending = (partial.get(stream) ?? '') + chunk;
    let newline: number;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (line.startsWith('suite start ')) {
        lastTests.push(line.slice('suite start '.length).slice(0, 1000));
        if (lastTests.length > 8) lastTests.shift();
      }
    }
    partial.set(stream, pending.slice(-16384));
  };
  child.stdout.setEncoding('utf8').on('data', chunk => output(chunk, process.stdout));
  child.stderr.setEncoding('utf8').on('data', chunk => output(chunk, process.stderr));
  const handlers = (['SIGINT', 'SIGTERM'] as const).map(signal => {
    // Hub cancellation already owns termination of the worker tree. Do not
    // acquire a competing termination owner from inside that captured tree.
    const handler = () => { interrupted = true; clearTimeout(timer); clearTimeout(observeTimer); child.kill(signal); };
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
    return { code: cause ? 1 : outcome.code ?? 1, cause: cause || (outcome.signal ? `command terminated by ${outcome.signal}` : '') };
  } finally {
    closed = true;
    clearTimeout(timer);
    clearTimeout(observeTimer);
    await observing;
    for (const { signal, handler } of handlers) process.off(signal, handler);
  }
}
