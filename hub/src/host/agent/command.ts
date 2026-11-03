import { spawn } from 'node:child_process';
export type RunResult = { code: number | null; stdout: string; stderr: string; error?: string };
const PROBE_CLOSE_TIMEOUT_MS = 1000;

/** A probe's deadline: `fallbackMs`, or `CLAND_DOCTOR_PROBE_TIMEOUT_MS` (tests that fake a tool that never answers). */
export const probeTimeout = (env: NodeJS.ProcessEnv, fallbackMs: number): number => {
  const n = Number(env.CLAND_DOCTOR_PROBE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : fallbackMs;
};

/**
 * Run `bin args`, never throwing: a missing binary, a crash or the timeout come back as `error`.
 * Stdin is closed unless explicitly inherited for a tty inspection.
 * The child leads its own process group: past the deadline the whole group is killed and the pipes are closed, so a
 * grandchild holding stdout open (a wrapper script's real tool) neither outlives the check nor keeps it waiting.
 * Await close and native cleanup after termination. If close never arrives, report incomplete cleanup after 1 s.
 * Optional cancellation uses that same owned-group termination/close boundary; older calls are unchanged.
 * Cancellation is sixth; optional output encoding is seventh, defaulting to utf8.
 * Optional eighth cwd serves Host commands; omitted preserves every existing caller.
 */
export function run(bin: string, args: readonly string[], env: NodeJS.ProcessEnv, timeoutMs = probeTimeout(env, 20_000), inheritStdin = false, signal?: AbortSignal, encoding: BufferEncoding = 'utf8', cwd?: string): Promise<RunResult> {
  return new Promise((done) => {
    let stdout = '';
    let stderr = '';
    let error: string | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
      signal?.removeEventListener('abort', abort);
      // ChildProcess close (or a thrown spawn) can precede libuv's native close callbacks.
      // Cross a complete loop turn so they drain too, without a wall-clock grace period.
      setImmediate(() => setImmediate(() => done(r)));
    };
    const abort = () => { error ??= 'cancelled'; terminate(); };
    if (signal?.aborted) {
      finish({ code: null, stdout, stderr, error: 'cancelled' });
      return;
    }
    let child;
    try {
      child = spawn(bin, args, { env, cwd, stdio: [inheritStdin ? 0 : 'ignore', 'pipe', 'pipe'], detached: true });
    } catch (err) {
      finish({ code: null, stdout, stderr, error: err instanceof Error ? err.message : String(err) });
      return;
    }
    const terminate = () => {
      if (settled || cleanupTimer !== undefined) return;
      clearTimeout(timer);
      cleanupTimer = setTimeout(() => finish({
        code: null, stdout, stderr,
        error: `${error}; cleanup incomplete: child did not close within ${PROBE_CLOSE_TIMEOUT_MS / 1000} s of SIGKILL`,
      }), PROBE_CLOSE_TIMEOUT_MS);
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
    };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      error ??= `no answer within ${timeoutMs / 1000} s`;
      terminate();
    }, timeoutMs);
    child.stdout?.setEncoding(encoding).on('data', (c: string) => (stdout += c));
    child.stderr?.setEncoding(encoding).on('data', (c: string) => (stderr += c));
    child.on('error', (err) => { error ??= err.message; terminate(); });
    child.once('close', (code) => finish({ code: error === undefined ? code : null, stdout, stderr, ...(error === undefined ? {} : { error }) }));
  });
}
