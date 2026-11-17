import { spawn } from 'node:child_process';
import { MAX_LINE_BYTES } from './protocol.ts';
export type RunResult = import('../host.ts').HostRunResult;
/** Copy a UTF-8 byte-bounded suffix without splitting a code point. */
function utf8Tail(value: string, limit: number): string {
  if (limit === 0) return '';
  let suffix = value.slice(-limit);
  const first = suffix.charCodeAt(0);
  if (first >= 0xdc00 && first <= 0xdfff) suffix = suffix.slice(1);
  const bytes = Buffer.from(suffix);
  let start = Math.max(0, bytes.length - limit);
  while (start < bytes.length && (bytes[start]! & 0xc0) === 0x80) start++;
  return bytes.subarray(start).toString('utf8');
}
/** Shared retention budget; overflow keeps small rolling tails while draining until close. */
export class CommandOutput {
  stdout = '';
  stderr = '';
  retainedBytes = 0;
  overflow = false;
  readonly maxBytes: number;
  constructor(maxBytes = Infinity) { this.maxBytes = maxBytes; }
  append(stream: 'stdout' | 'stderr', chunk: string) {
    const bytes = Buffer.byteLength(chunk);
    if (this.overflow || bytes > this.maxBytes - this.retainedBytes) {
      this.overflow = true;
      const tailBytes = Math.min(4096, Math.floor(this.maxBytes / 2));
      this.stdout = utf8Tail(this.stdout, tailBytes);
      this.stderr = utf8Tail(this.stderr, tailBytes);
      this[stream] = utf8Tail(this[stream] + utf8Tail(chunk, tailBytes), tailBytes);
      this.retainedBytes = Buffer.byteLength(this.stdout) + Buffer.byteLength(this.stderr);
      return;
    }
    this[stream] += chunk;
    this.retainedBytes += bytes;
  }
}
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
 * Optional ninth collector bounds agent output; doctor callers keep complete output.
 */
export function run(bin: string, args: readonly string[], env: NodeJS.ProcessEnv, timeoutMs = probeTimeout(env, 20_000), inheritStdin = false, signal?: AbortSignal, encoding: BufferEncoding = 'utf8', cwd?: string, output = new CommandOutput()): Promise<RunResult> {
  return new Promise((done) => {
    let error: string | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: RunResult) => {
      if (settled) return;
      if (output.overflow) r = { ...r, error: `command output exceeds agent frame cap (${output.maxBytes} bytes); retained stdout ${Buffer.byteLength(r.stdout)} bytes, stderr ${Buffer.byteLength(r.stderr)} bytes; native exit code ${r.code}${r.error ? `; ${r.error}` : ''}` };
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
      finish({ code: null, stdout: output.stdout, stderr: output.stderr, error: 'cancelled', nativeAdmission:'no-process' });
      return;
    }
    let child;
    try {
      child = spawn(bin, args, { env, cwd, stdio: [inheritStdin ? 0 : 'ignore', 'pipe', 'pipe'], detached: true });
    } catch (err) {
      finish({ code: null, stdout: output.stdout, stderr: output.stderr, error: err instanceof Error ? err.message : String(err), nativeAdmission:'no-process' });
      return;
    }
    let sawPid=child.pid!==undefined,noPidError=false;
    child.once('spawn',()=>{sawPid=true;});
    const terminate = () => {
      if (settled || cleanupTimer !== undefined) return;
      clearTimeout(timer);
      cleanupTimer = setTimeout(() => finish({
        code: null, stdout: output.stdout, stderr: output.stderr,
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
    child.stdout?.setEncoding(encoding).on('data', (c: string) => output.append('stdout',c));
    child.stderr?.setEncoding(encoding).on('data', (c: string) => output.append('stderr',c));
    child.on('error', (err) => { sawPid ||= child.pid!==undefined;noPidError=!sawPid&&child.pid===undefined;error ??= err.message; terminate(); });
    child.once('close', (code) => finish({ code: error === undefined ? code : null, stdout: output.stdout, stderr: output.stderr, ...(error === undefined ? {} : { error }),...(!sawPid&&noPidError?{nativeAdmission:'no-process' as const}:{}) }));
  });
}
