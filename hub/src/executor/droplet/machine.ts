import { withoutExecutorCredentials } from '../../../../shared/executor-credentials.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { leaseDir, type DropletLease } from './lease.ts';

const run = promisify(execFile);
type Execute = (file: string, args: string[], options: { env: NodeJS.ProcessEnv; timeout: number; signal?: AbortSignal | undefined; maxBuffer: number }) => Promise<{ stdout: string }>;
/** Keep transport facts, never execFile's message (which contains the command). */
function failure(kind: string, error: unknown, env: NodeJS.ProcessEnv): Error {
  const detail = error as { code?: unknown; signal?: unknown; stderr?: unknown } | null;
  const code = typeof detail?.code === 'number' ? String(detail.code) : typeof detail?.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(detail.code) ? detail.code : 'unknown';
  const signal = typeof detail?.signal === 'string' && /^SIG[A-Z0-9]+$/.test(detail.signal) ? `; signal ${detail.signal}` : '';
  let stderr = typeof detail?.stderr === 'string' ? detail.stderr : '';
  if (env.DIGITALOCEAN_TOKEN) stderr = stderr.replaceAll(env.DIGITALOCEAN_TOKEN, '<REDACTED>');
  return new Error(`machine ${kind} failed or exceeded its time bound (exit ${code}${signal})${stderr ? `: ${stderr.slice(0, 4096).trim()}` : ''}`);
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
  async exec(lease: DropletLease, command: string, options: { timeoutMs: number; user?: 'root' | 'runner'; signal?: AbortSignal | undefined }): Promise<string> {
    const args = [...this.#options(lease), `${options.user ?? 'runner'}@${lease.address}`, command];
    try { return (await this.#execute(this.#env.CLAND_SSH_BIN ?? 'ssh', args, { env: machineEnv(this.#env), timeout: Math.max(1, options.timeoutMs), signal: options.signal, maxBuffer: 8 * 1024 * 1024 })).stdout; }
    catch (error) { throw failure('command', error, this.#env); }
  }
  /** Shell outcomes cross the transport unchanged; SSH failures still fail the request. */
  async result(lease: DropletLease, command: string, timeoutMs: number, signal?: AbortSignal): Promise<{ stdout: string; stderr: string; code: number }> {
    const program = `const cp=require('child_process');const r=cp.spawnSync('sh',['-c',process.argv[1]],{encoding:'utf8',maxBuffer:8*1024*1024});console.log(JSON.stringify({stdout:r.stdout||'',stderr:r.stderr||(r.error?'shell command could not complete':''),code:r.status===null?1:r.status}));`;
    const output = await this.exec(lease, `node -e ${shellQuote(program)} ${shellQuote(command)}`, { timeoutMs, signal });
    return JSON.parse(output) as { stdout: string; stderr: string; code: number };
  }

  async put(lease: DropletLease, local: string, remote: string, options: { timeoutMs: number; signal?: AbortSignal | undefined } = { timeoutMs: 120000 }): Promise<void> {
    await this.#copy(lease, [local, `runner@${lease.address}:${remote}`], options.timeoutMs, options.signal);
  }
  async get(lease: DropletLease, remote: string, local: string, options: { timeoutMs: number } = { timeoutMs: 120000 }): Promise<void> {
    await this.#copy(lease, [`runner@${lease.address}:${remote}`, local], options.timeoutMs);
  }
  async #copy(lease: DropletLease, paths: string[], timeoutMs: number, signal?: AbortSignal): Promise<void> {
    try { await this.#execute(this.#env.CLAND_SCP_BIN ?? 'scp', [...this.#options(lease), ...paths], { env: machineEnv(this.#env), timeout: Math.max(1, timeoutMs), signal, maxBuffer: 1024 * 1024 }); }
    catch (error) { throw failure('copy', error, this.#env); }
  }
}
