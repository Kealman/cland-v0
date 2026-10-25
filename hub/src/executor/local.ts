import { processIdentityAsync } from '../process-identity.ts';
import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
// The local worker and its process ownership stay behind this backend.
import { spawn } from 'node:child_process';
import { open, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pidAlive } from '../project.ts';
import { processStartedAsync } from '../hub/lock.ts';
import { systemProcesses, endProcess } from '../system-processes.ts';
import { compatibilityOccupied, compatibilityHolder } from '../suite-lock.ts';
import type { Executor, Lease, Platform, Released, RunRef, RunStatus } from './executor.ts';

export type LocalWorker = { pid: number | null; started: string | null; identity?: string | null; outcome: { code: number; cause: string } | null; cancelled?: boolean };
type Resource = LocalWorker & { run: RunRef; platform?: Platform; attempted?: boolean };

/** Machine-slot observations; scheduler fixtures supply facts without acquiring OS locks. */
export type LocalCompatibility = {
  holder: () => ReturnType<typeof compatibilityHolder>;
  occupied: () => Promise<boolean>;
};

export class LocalExecutor implements Executor {
  readonly #leases = new Map<string, Lease>();
  readonly #starting = new Map<string, Promise<void>>();
  #reserved: string | null = null;
  readonly #checkpoint: (lease: Lease, worker: LocalWorker) => void;
  readonly #admit: (run: string) => void;
  readonly #env: NodeJS.ProcessEnv;
  readonly #compatibility: LocalCompatibility;
  readonly #recover: (settled: { pid: number; started: string }) => Promise<boolean>;
  constructor(locks: string[], checkpoint: (lease: Lease, worker: LocalWorker) => void, admit: (run: string) => void, env: NodeJS.ProcessEnv = process.env, compatibility?: LocalCompatibility, log?: (entry: Record<string, unknown>) => void) {
    this.#env = env;
    this.#compatibility = compatibility ?? { holder: () => compatibilityHolder(locks, env), occupied: () => compatibilityOccupied(locks, env, log) };
    this.#recover = settled => compatibilityOccupied(locks, env, log, settled);
    this.#checkpoint = checkpoint; this.#admit = admit;
  }
  holder(): ReturnType<typeof compatibilityHolder> { return this.#compatibility.holder(); }
  occupied(): Promise<boolean> { return this.#compatibility.occupied(); }
  /** Old jobs stored these facts directly. Their persisted identity remains authoritative. */
  restore(run: RunRef, worker: LocalWorker, previous?: Lease): Lease {
    const lease: Lease = { kind: 'local', run: run.id, created: previous?.created ?? run.queued ?? new Date().toISOString(), deadline: previous?.deadline ?? new Date(Date.now() + 15000).toISOString(), resource: { ...(previous?.resource as Partial<Resource> | undefined), pid: worker.pid, started: worker.started, ...(worker.identity !== undefined ? { identity: worker.identity } : {}), outcome: worker.outcome, ...(worker.cancelled ? { cancelled: true } : {}), run } };
    this.#leases.set(run.id, lease);
    if (worker.pid && !worker.outcome) this.#reserved = run.id;
    return lease;
  }
  async acquire(run: RunRef, deadline: string): Promise<Lease> {
    const existing = this.#leases.get(run.id);
    if (existing) return existing;
    if (this.#reserved !== null) throw new Error('local executor slot is occupied');
    // The scheduler checks compatibility admission. A hand run racing that check
    // is fenced by the worker's atomic compatibility acquisition, as before.
    const lease = this.restore(run, { pid: null, started: null, outcome: null });
    lease.deadline = deadline;
    this.#reserved = run.id;
    this.#checkpoint(lease, lease.resource as Resource);
    return lease;
  }
  async prepare(_identity: string): Promise<void> {}
  async deliver(_lease: Lease, _run: RunRef): Promise<void> {}
  start(lease: Lease, run: RunRef): Promise<void> {
    const existing = this.#starting.get(run.id);
    if (existing) return existing;
    const work = this.#start(lease, run).finally(() => this.#starting.delete(run.id));
    this.#starting.set(run.id, work);
    return work;
  }
  async #start(lease: Lease, run: RunRef): Promise<void> {
    const resource = lease.resource as Resource;
    // A start already attempted never launches a second worker, even after its exit.
    if (resource.attempted || resource.pid || resource.outcome) return;
    const input = join(dirname(run.result), 'job.json');
    await writeFile(input, JSON.stringify(run), { mode: 0o600 });
    const fd = await open(run.log, 'a');
    try {
      this.#admit(run.id);
      const env = withoutExecutorCredentials(this.#env);
      delete env.NODE_TEST_CONTEXT;
      delete env.CLAND_SUITE_LEASE;
      resource.attempted = true;
      this.#checkpoint(lease, resource);
      const child = spawn(process.execPath, [fileURLToPath(new URL('../hub/suite-worker.ts', import.meta.url)), input], { cwd: run.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
      child.once('error', error => {
        resource.outcome ??= { code: 1, cause: `worker could not start: ${error.message}` };
        this.#checkpoint(lease, resource);
      });
      child.once('close', (code, signal) => {
        if (signal || code !== 0) resource.outcome ??= { code: code ?? 1, cause: signal ? `worker killed by ${signal}` : `worker exited ${code}` };
        this.#checkpoint(lease, resource);
      });
      child.unref();
      resource.pid = child.pid ?? null;
      resource.started = resource.pid ? await processStartedAsync(resource.pid, undefined, undefined, undefined, this.#env) : null;
      resource.identity = resource.pid ? await processIdentityAsync(resource.pid, this.#env) : null;
      this.#checkpoint(lease, resource);
      if (!resource.pid || !resource.started || !resource.identity) throw new Error('cannot establish suite worker process identity');
      this.#admit(run.id);
      await writeFile(run.gate, 'ready');
    } finally { await fd.close(); }
  }
  async status(lease: Lease): Promise<RunStatus> {
    const resource = lease.resource as Resource;
    const receipt = await readFile(resource.run.result, 'utf8').then(text => JSON.parse(text) as Omit<RunStatus, 'state'>, () => null);
    if (receipt) return { ...receipt, state: 'done' };
    // A killed worker may have measured the platform without reaching its receipt.
    const line = resource.platform ? null : (await this.log(lease, 0)).text.match(/^platform (\S+) (\S+) (\S+) · Node (\S+) · Neovim (\S+)$/m);
    const platform: Platform | undefined = resource.platform ?? (line ? { os: line[1]!, arch: line[2]!, release: line[3]!, node: line[4]!, nvim: line[5]! } : undefined);
    if (platform) resource.platform = platform;
    const measured = platform ? { platform } : {};
    if (resource.outcome) return { ...resource.outcome, ...measured, state: 'done' };
    if (resource.pid && pidAlive(resource.pid)) {
      const current = await processStartedAsync(resource.pid, undefined, undefined, undefined, this.#env);
      if (resource.started === null || current === null || current === resource.started) return { ...measured, state: 'running' };
    }
    return { ...measured, state: 'lost', code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
  }
  async log(lease: Lease, offset: number): Promise<{ text: string; next: number }> {
    const fd = await open((lease.resource as Resource).run.log, 'r');
    try {
      const length = Math.max(0, (await fd.stat()).size - offset);
      const bytes = Buffer.alloc(length);
      const { bytesRead } = await fd.read(bytes, 0, length, offset);
      return { text: bytes.subarray(0, bytesRead).toString('utf8'), next: offset + bytesRead };
    } finally { await fd.close(); }
  }
  async #upgradeLegacyWorker(lease: Lease): Promise<void> {
    const resource = lease.resource as Resource;
    if (!resource.pid || !resource.started || resource.identity || !pidAlive(resource.pid)) return;
    let row: Awaited<ReturnType<typeof systemProcesses>>[number] | undefined;
    try { row = (await systemProcesses(undefined, undefined, [resource.pid], false, this.#env)).find(row => row.pid === resource.pid); }
    catch { return; } // unavailable proof retains legacy liveness without authority
    if (row?.identity && row.started === resource.started) {
      const previous = resource.identity;
      resource.identity = row.identity;
      try { this.#checkpoint(lease, resource); }
      catch (error) {
        if (previous === undefined) delete resource.identity; else resource.identity = previous;
        throw error; // no signal may precede the durable upgrade receipt
      }
    }
  }
  async cancel(lease: Lease, _signal: string): Promise<void> {
    const resource = lease.resource as Resource;
    await this.#upgradeLegacyWorker(lease);
    resource.cancelled = true;
    if (!resource.pid || !resource.started || !pidAlive(resource.pid)) return;
    // Capture the complete ancestry before the worker forwards its interrupt.
    // Group signalling first loses detached fake harnesses as their parents exit.
    if (!await endProcess({ pid: resource.pid, pidStarted: resource.started, pidIdentity: resource.identity ?? null }, () => {}, 500, undefined, { env: this.#env, allowReused: true })) throw new Error('suite cancellation could not verify the worker tree');
  }
  async release(lease: Lease): Promise<Released> {
    await this.#upgradeLegacyWorker(lease);
    const resource = lease.resource as Resource;
    const { pid, started } = resource;
    const receipt = await readFile(resource.run.result, 'utf8').then(text => JSON.parse(text) as { code: number }, () => null);
    if (receipt?.code === 0 && !resource.cancelled) {
      if (this.#reserved === lease.run) this.#reserved = null;
      return { lifetimeMs: null, costUsd: null };
    }
    if (pid && !started && pidAlive(pid)) throw new Error('suite cleanup waiting for a verified worker identity; process preserved');
    if (pid && started) {
      if (!await endProcess({ pid, pidStarted: started, pidIdentity: resource.identity ?? null }, () => {}, resource.cancelled ? 10000 : 500, undefined, { env: this.#env, allowReused: true })) throw new Error('suite cleanup could not verify the worker identity');
      const rows = await systemProcesses(undefined, undefined, undefined, undefined, this.#env);
      const leader = rows.find(row => row.pid === pid);
      if (!leader || leader.identity != null && leader.identity === resource.identity) {
        for (const row of rows.filter(row => row.group === pid && row.pid !== pid)) {
          if (!await endProcess({ pid: row.pid, pidStarted: row.started, pidIdentity: row.identity ?? null }, () => {}, 500, undefined, { env: this.#env, allowReused: true })) throw new Error('suite crash cleanup could not verify a surviving process');
        }
      }
      // Interrupted workers leave their lease/root intact for this termination
      // owner. Recovery starts only after the captured tree has been reaped.
      await this.#recover({ pid, started });
    }
    if (this.#reserved === lease.run) this.#reserved = null;
    return { lifetimeMs: null, costUsd: null };
  }
  /** Restored leases reattach to receipts/live identities; Suites settles and reports them. */
  async reap(olderThanMs = 0): Promise<void> {
    for (const lease of this.#leases.values()) {
      if (Date.now() - Date.parse(lease.created) < olderThanMs) continue;
      const status = await this.status(lease);
      if (status.state === 'lost') {
        const resource = lease.resource as Resource;
        resource.outcome ??= { code: status.code ?? 1, cause: status.cause ?? 'worker disappeared' };
        this.#checkpoint(lease, resource);
      }
    }
  }
}
