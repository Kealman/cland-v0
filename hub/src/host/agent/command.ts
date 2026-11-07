import { spawn } from 'node:child_process';
import { MAX_LINE_BYTES } from './protocol.ts';
export type RunResult = import('../host.ts').HostRunResult;
/** Leave room for both reply envelopes; oversized results retain native facts and diagnostic tails. */
export function boundedCommandResult(result: RunResult): RunResult {
  if (Buffer.byteLength(JSON.stringify(result)) <= MAX_LINE_BYTES / 2) return result;
  return {
    code: result.code,
    ...(result.nativeAdmission ? {nativeAdmission:result.nativeAdmission} : {}),
    ...(result.claudeAdmission ? {claudeAdmission:result.claudeAdmission} : {}),
    stdout: result.stdout.slice(-4096),
    stderr: result.stderr.slice(-4096),
    error: `command output exceeds agent frame cap (${MAX_LINE_BYTES} bytes); stdout ${Buffer.byteLength(result.stdout)} bytes, stderr ${Buffer.byteLength(result.stderr)} bytes; native exit code ${result.code}${result.error ? `; ${result.error.slice(-4096)}` : ''}`,
  };
}
export const nativeCommandIncomplete = (result: Pick<RunResult,'error'|'nativeAdmission'|'claudeAdmission'>): boolean => {
  if(result.nativeAdmission==='no-process'||result.claudeAdmission?.outcome==='refused-before-spawn')return false;
  return result.error?.includes('cleanup incomplete') === true;
};
export function nativeCommandFailure(result: RunResult, fallback: string): Error {
  return Object.assign(new Error(result.error || result.stderr || fallback),nativeCommandIncomplete(result)?{code:'CLAND_NATIVE_INCOMPLETE'}:{});
}
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
      finish({ code: null, stdout, stderr, error: 'cancelled', nativeAdmission:'no-process' });
      return;
    }
    let child;
    try {
      child = spawn(bin, args, { env, cwd, stdio: [inheritStdin ? 0 : 'ignore', 'pipe', 'pipe'], detached: true });
    } catch (err) {
      finish({ code: null, stdout, stderr, error: err instanceof Error ? err.message : String(err), nativeAdmission:'no-process' });
      return;
    }
    let sawPid=child.pid!==undefined,noPidError=false;
    child.once('spawn',()=>{sawPid=true;});
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
    child.on('error', (err) => { sawPid ||= child.pid!==undefined;noPidError=!sawPid&&child.pid===undefined;error ??= err.message; terminate(); });
    child.once('close', (code) => finish({ code: error === undefined ? code : null, stdout, stderr, ...(error === undefined ? {} : { error }),...(!sawPid&&noPidError?{nativeAdmission:'no-process' as const}:{}) }));
  });
}
