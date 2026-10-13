import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { leaseDir, type DropletLease } from './lease.ts';

const run = promisify(execFile);
/** Provider credentials stay in API calls, including for local delivery tools. */
export function machineEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.DIGITALOCEAN_TOKEN;
  return env;
}
export const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

/** Private SSH implementation: no transport details cross the executor interface. */
export class Machine {
  readonly root: string;
  constructor(root: string) { this.root = root; }
  #options(lease: DropletLease): string[] {
    if (!lease.address) throw new Error('machine has no address');
    return ['-F', '/dev/null', '-i', join(leaseDir(this.root, lease), 'key'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=5', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=8'];
  }
  async exec(lease: DropletLease, command: string, options: { timeoutMs: number; user?: 'root' | 'runner'; signal?: AbortSignal | undefined }): Promise<string> {
    const args = [...this.#options(lease), `${options.user ?? 'runner'}@${lease.address}`, command];
    try { return (await run(process.env.CLAND_SSH_BIN ?? 'ssh', args, { env: machineEnv(), timeout: Math.max(1, options.timeoutMs), signal: options.signal, maxBuffer: 8 * 1024 * 1024 })).stdout; }
    catch { throw new Error('machine command failed or exceeded its time bound'); }
  }
  async put(lease: DropletLease, local: string, remote: string, options: { timeoutMs: number; signal?: AbortSignal | undefined } = { timeoutMs: 120000 }): Promise<void> {
    await this.#copy(lease, [local, `runner@${lease.address}:${remote}`], options.timeoutMs, options.signal);
  }
  async get(lease: DropletLease, remote: string, local: string, options: { timeoutMs: number } = { timeoutMs: 120000 }): Promise<void> {
    await this.#copy(lease, [`runner@${lease.address}:${remote}`, local], options.timeoutMs);
  }
  async #copy(lease: DropletLease, paths: string[], timeoutMs: number, signal?: AbortSignal): Promise<void> {
    try { await run(process.env.CLAND_SCP_BIN ?? 'scp', [...this.#options(lease), ...paths], { env: machineEnv(), timeout: Math.max(1, timeoutMs), signal, maxBuffer: 1024 * 1024 }); }
    catch { throw new Error('machine copy failed or exceeded its time bound'); }
  }
}
