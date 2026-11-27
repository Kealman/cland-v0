import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/** Preserve git patch-id semantics without retaining the diff in the hub heap.
 * Pipe backpressure bounds the patch; scalar output is capped while reading.
 * Every failure joins both close receipts before returning to the caller.
 */
export async function streamedPatchId(cwd: string, env: NodeJS.ProcessEnv, args: string[], signal?: AbortSignal): Promise<string | null> {
  signal?.throwIfAborted();
  const children: Array<{ child: ChildProcessWithoutNullStreams; closed: Promise<void>; done: boolean }> = [];
  let failure: Error | undefined;
  let unavailable = false, hasDiff = false, output = '', kept = 0;
  let escalation: NodeJS.Timeout | undefined;
  const stop = () => {
    for (const owner of children) { owner.child.stdout.unpipe(); owner.child.stdout.resume(); }
    for (const owner of children) if (!owner.done) owner.child.kill('SIGTERM');
    escalation ??= setTimeout(() => { for (const owner of children) if (!owner.done) owner.child.kill('SIGKILL'); }, 1000);
    escalation.unref();
  };
  const fail = (error: Error) => { if (!unavailable) failure ??= error; stop(); };
  const start = (command: string[]) => {
    const child = spawn('git', command, { cwd, env, stdio: 'pipe' });
    const owner = { child, closed: Promise.resolve(), done: false };
    owner.closed = new Promise<void>(resolve => {
      child.on('error', fail);
      child.on('close', (code, signal) => {
        owner.done = true;
        if (signal) fail(new Error(`git ${command[0]} closed with signal ${signal}`));
        else if (code !== 0) { unavailable = true; stop(); }
        resolve();
      });
    });
    children.push(owner);
    // stderr carries no freshness fact; drain it without retaining bytes.
    child.stderr.resume();
    child.stderr.on('error', fail);
    child.stdin.on('error', fail);
    child.stdout.on('error', fail);
    return child;
  };
  const timer = setTimeout(() => fail(new Error('git patch identity timed out')), 5000);
  timer.unref();
  const abort = () => fail(signal!.reason);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const patch = start(['patch-id', '--stable']);
    patch.stdout.on('data', (chunk: Buffer) => {
      if (failure) return;
      if (chunk.length > 4096 - kept) { fail(new Error('git patch identity exceeds 4096 byte limit')); return; }
      kept += chunk.length;
      output += chunk.toString('utf8');
    });
    const diff = start(args);
    diff.stdout.on('data', () => { hasDiff = true; });
    diff.stdin.end();
    diff.stdout.pipe(patch.stdin);
    await Promise.all(children.map(owner => owner.closed));
    if (failure) throw failure;
    return unavailable ? null : output.trim().split(/\s+/)[0] || (hasDiff ? null : 'empty');
  } catch (error) {
    stop();
    await Promise.all(children.map(owner => owner.closed));
    throw error;
  } finally { clearTimeout(timer); clearTimeout(escalation); signal?.removeEventListener('abort', abort); }
}
