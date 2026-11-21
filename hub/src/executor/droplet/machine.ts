import { sshBinaries } from '../../host/ssh-binaries.ts';
import { withoutExecutorCredentials } from '../../../../shared/executor-credentials.ts';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { leaseDir, type DropletLease } from './lease.ts';

type Execute = (file: string, args: string[], options: { env: NodeJS.ProcessEnv; timeout: number; signal?: AbortSignal | undefined; maxBuffer: number }) => Promise<{ stdout: string }>;
const run = promisify(execFile);
export const COPY_STDERR_BYTES = 64 * 1024;
// Drain output through close, retaining only a byte-bounded diagnostic tail.
const copyRun: Execute = (file, args, options) => new Promise((resolve, reject) => {
  let timedOut = false;
  let stopped = false;
  let tail = Buffer.alloc(0), stderrBytes = 0;
  let nativeError: NodeJS.ErrnoException | undefined;
  const child = spawn(file, args, { env: options.env, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr!.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length;
    tail = chunk.length >= COPY_STDERR_BYTES ? Buffer.from(chunk.subarray(-COPY_STDERR_BYTES))
      : Buffer.concat([tail.subarray(Math.max(0, tail.length + chunk.length - COPY_STDERR_BYTES)), chunk]);
  });
  child.on('error', error => { nativeError = error; });
  const stop = () => { if (!stopped) { stopped = true; child.kill('SIGTERM'); } };
  const timer = setTimeout(() => { if (!stopped) { timedOut = true; stop(); } }, options.timeout);
  options.signal?.addEventListener('abort', stop, { once: true });
  if (options.signal?.aborted) stop();
  child.on('close', (code, signal) => {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', stop);
    // A raw tail can begin inside a credential. Discard its partial first line
    // before redaction/publication, retaining only complete trailing lines.
    if (stderrBytes > tail.length) {
      const newline = tail.indexOf(10);
      tail = newline < 0 ? Buffer.alloc(0) : tail.subarray(newline + 1);
    }
    if (nativeError || code !== 0 || signal || timedOut || options.signal?.aborted) reject({ code: nativeError?.code ?? code, signal, stderr: tail.toString('utf8'), stderrBytes, stderrDropped: stderrBytes - tail.length, timedOut });
    else resolve({ stdout: '' });
  });
});
type CopyReceipt = { code: string; signal: string; stderr: string; timedOut: boolean; timeoutMs: number; stderrBytes?: number; stderrDropped?: number };
export class MachineRequestError extends Error {
  readonly localClientUnavailable: boolean;
  readonly receipt: CopyReceipt | undefined;
  constructor(message: string, localClientUnavailable: boolean, receipt?: CopyReceipt) {
    super(message); this.localClientUnavailable = localClientUnavailable; this.receipt = receipt;
  }
}
/** Recognize only native spawn failures and explicit local identity diagnostics.
 * Network/authentication failures alone do not prove a broken local client. */
function localClientFailure(code: unknown, stderr: string): boolean {
  return ['ENOENT', 'EACCES', 'ENOEXEC'].includes(String(code))
    || /(?:^|\n)(?:No user exists for uid \d+|Load key "[^"\n]+": (?:invalid format|error in libcrypto|Permission denied|bad permissions))(?:[^\n]*)/i.test(stderr);
}
/** Keep transport facts, never execFile's message (which contains the command). */
function failure(kind: string, error: unknown, env: NodeJS.ProcessEnv, copy?: { timeoutMs: number; timedOut: boolean }): Error {
  const detail = error as { code?: unknown; signal?: unknown; stderr?: unknown; stderrBytes?: number; stderrDropped?: number } | null;
  const code = typeof detail?.code === 'number' ? String(detail.code) : typeof detail?.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(detail.code) ? detail.code : 'unknown';
  const signal = typeof detail?.signal === 'string' && /^SIG[A-Z0-9]+$/.test(detail.signal) ? `; signal ${detail.signal}` : '';
  let stderr = typeof detail?.stderr === 'string' ? detail.stderr : '';
  if (env.DIGITALOCEAN_TOKEN) stderr = stderr.replaceAll(env.DIGITALOCEAN_TOKEN, '<REDACTED>');
  const output = copy ? stderr : stderr.slice(0, 4096).trim();
  const reason = copy ? copy.timedOut ? 'exceeded its time bound' : 'failed' : 'failed or exceeded its time bound';
  const counts = copy && detail?.stderrBytes !== undefined ? `; stderr ${detail.stderrBytes} bytes seen, ${detail.stderrDropped} dropped, tail cap ${COPY_STDERR_BYTES}${detail.stderrDropped ? '; truncated prefix line dropped' : ''}` : '';
  return new MachineRequestError(`machine ${kind} ${reason} (exit ${code}${signal}${copy ? `; time bound ${copy.timeoutMs} ms` : ''}${counts})${output ? `: ${output}` : ''}`, localClientFailure(detail?.code, stderr), copy ? { code, signal: typeof detail?.signal === 'string' ? detail.signal : '', stderr, ...copy, ...(detail?.stderrBytes !== undefined ? { stderrBytes: detail.stderrBytes, stderrDropped: detail.stderrDropped } : {}) } : undefined);
}
/** Provider credentials stay in API calls, including for local delivery tools. */
export function machineEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return withoutExecutorCredentials(base);
}
export const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

/** Private SSH implementation: no transport details cross the executor interface. */
export class Machine {
  readonly root: string;
  readonly #env: NodeJS.ProcessEnv;
  readonly #execute: Execute;
  constructor(root: string, env: NodeJS.ProcessEnv = process.env, execute: Execute = run) { this.root = root; this.#env = env; this.#execute = execute; }
  #options(lease: DropletLease): string[] {
    if (!lease.address) throw new Error('machine has no address');
    return ['-F', '/dev/null', '-i', join(leaseDir(this.root, lease), 'key'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=5', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=8'];
  }
  async exec(lease: DropletLease, command: string, options: { timeoutMs: number; user?: 'root' | 'runner'; signal?: AbortSignal | undefined; maxOutputBytes?: number }): Promise<string> {
    const args = [...this.#options(lease), `${options.user ?? 'runner'}@${lease.address}`, command];
    try { return (await this.#execute(sshBinaries(this.#env).ssh, args, { env: machineEnv(this.#env), timeout: Math.max(1, options.timeoutMs), signal: options.signal, maxBuffer: options.maxOutputBytes ?? 8 * 1024 * 1024 })).stdout; }
    catch (error) { throw failure('command', error, this.#env); }
  }
  /** Shell outcomes cross the transport unchanged; SSH failures still fail the request. */
  async result(lease: DropletLease, command: string, timeoutMs: number, signal?: AbortSignal, user: 'root' | 'runner' = 'runner'): Promise<{ stdout: string; stderr: string; code: number }> {
    const program = `const cp=require('child_process');const r=cp.spawnSync('sh',['-c',process.argv[1]],{encoding:'utf8',maxBuffer:8*1024*1024});console.log(JSON.stringify({stdout:r.stdout||'',stderr:r.stderr||(r.error?'shell command could not complete':''),code:r.status===null?1:r.status}));`;
    const output = await this.exec(lease, `node -e ${shellQuote(program)} ${shellQuote(command)}`, { timeoutMs, signal, user });
    return JSON.parse(output) as { stdout: string; stderr: string; code: number };
  }

  async put(lease: DropletLease, local: string, remote: string, options: { timeoutMs: number; signal?: AbortSignal | undefined } = { timeoutMs: 120000 }): Promise<void> {
    await this.#copy(lease, [local, `runner@${lease.address}:${remote}`], options.timeoutMs, options.signal);
  }
  async get(lease: DropletLease, remote: string, local: string, options: { timeoutMs: number } = { timeoutMs: 120000 }): Promise<void> {
    await this.#copy(lease, [`runner@${lease.address}:${remote}`, local], options.timeoutMs);
  }
  async #copy(lease: DropletLease, paths: string[], timeoutMs: number, signal?: AbortSignal): Promise<void> {
    const bound = Math.max(1, timeoutMs);
    try { await (this.#execute === run ? copyRun : this.#execute)(sshBinaries(this.#env).scp, [...this.#options(lease), ...paths], { env: machineEnv(this.#env), timeout: bound, signal, maxBuffer: COPY_STDERR_BYTES }); }
    catch (error) { throw failure('copy', error, this.#env, { timeoutMs: bound, timedOut: (error as { timedOut?: unknown } | null)?.timedOut === true }); }
  }
}
