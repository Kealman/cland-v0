import { declareHostProvider, type HostProviderDeclarationInput, type HostProviderDeclarations } from './declarations.ts';
import { readFile, writeFile, opendir, stat, unlink } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostDirectory } from '../../../../shared/fake-host-directory.ts';
import { createFakeHost } from '../../../../shared/fake-host-machine.ts';
import type { HostProvider, Machine, AcquireOptions, AcquireResult, MachineStatus, ReleaseResult, ReapOptions, ReapResult, PrepareResult } from './provider.ts';

type Record = { machine: Machine; project: string; pool: string; readyAt: number; neverBoot: boolean };
export type FakeHostProviderOptions = {
  declarations?: HostProviderDeclarationInput;
  env: NodeJS.ProcessEnv; now?: () => number; bootDelayMs?: number;
  neverBoot?: boolean; refuseUntil?: string; failAcquire?: boolean;
  /** Simulates an acknowledged delete which did not delete the machine. */
  ignoreDelete?: boolean;
};
/** Directory-only provider: never starts a transport, process, socket or timer.
 * The caller adds acquired ids to CLAND_FAKE_HOSTS before transport startup. */
export class FakeHostProvider implements HostProvider {
  readonly transport = 'ssh' as const;
  readonly declarations: HostProviderDeclarations;
  readonly #root: string;
  readonly #options: FakeHostProviderOptions;
  readonly #now: () => number;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(options: FakeHostProviderOptions) {
    const root = options.env.CLAND_FAKE_HOST_ROOT;
    if (!root || !isAbsolute(root)) throw new Error('fake provider requires an absolute CLAND_FAKE_HOST_ROOT test environment');
    if (!Number.isFinite(options.bootDelayMs ?? 0) || (options.bootDelayMs ?? 0) < 0) throw new Error('fake provider requires a nonnegative boot delay');
    if (options.refuseUntil !== undefined && !Number.isFinite(Date.parse(options.refuseUntil))) throw new Error('fake provider requires a valid retry time');
    this.declarations = declareHostProvider(options.declarations ?? {
      prices: { fake: { livePerHour: 0, idleComputePerHour: 0 } },
      stoppedBills: false, billingGranularityMs: 1000, billingMinimumMs: 60_000,
      tokenConfinement: 'resource', apiRequestsPerMinute: 60, machineLimit: 100,
      architectures: ['x86_64', 'arm64'], extraAddressPerHour: 0,
    });
    this.#root = root; this.#options = { ...options }; this.#now = options.now ?? Date.now;
  }
  // A lifecycle operation drains its own writes before settling. Reap calls the
  // private operations to avoid recursively taking this serialization boundary.
  #serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(work); this.#tail = result.catch(() => {}); return result;
  }
  prepare(): Promise<PrepareResult> { return this.#serial(async () => {
    const path = join(this.#root, 'provider-image');
    try { await readFile(path); return { state: 'current', summary: 'fake image current' }; }
    catch (e) { if (!missing(e)) return { state: 'failed', reason: 'fake image read failed' }; }
    try { await writeFile(path, 'fake-image-v1', { flag: 'wx', mode: 0o600 }); return { state: 'prepared', summary: 'fake image prepared' }; }
    catch { return { state: 'failed', reason: 'fake image preparation failed' }; }
  }); }
  acquire(options: AcquireOptions): Promise<AcquireResult> { return this.#serial(async () => {
    if (!this.declarations.architectures.includes(options.architecture)) return { state: 'failed', reason: 'fake architecture unsupported' };
    if (this.#options.refuseUntil && Date.parse(this.#options.refuseUntil) > this.#now()) return { state: 'refused', reason: 'fake capacity unavailable', retryAt: this.#options.refuseUntil };
    if (this.#options.failAcquire) return { state: 'failed', reason: 'fake create failed' };
    const id = 'fake-' + randomUUID().replaceAll('-', '').slice(0, 12);
    const machine: Machine = { id, address: id, architecture: options.architecture, created: new Date(this.#now()).toISOString() };
    try {
      const host = await createFakeHost(this.#root, id);
      const record: Record = { machine, project: options.project, pool: options.pool, readyAt: this.#now() + (this.#options.bootDelayMs ?? 0), neverBoot: this.#options.neverBoot ?? false };
      await writeFile(join(host.directory, 'provider.json'), JSON.stringify(record), { mode: 0o600 });
      return { state: 'created', machine };
    } catch { return { state: 'failed', reason: 'fake create failed' }; }
  }); }
  async #record(machine: Machine): Promise<Record> {
    const record = JSON.parse(await readFile(join(hostDirectory(this.#root, machine.id), 'provider.json'), 'utf8')) as Record;
    const captured = record.machine;
    if (captured.id !== machine.id || captured.created !== machine.created || captured.address !== machine.address || captured.architecture !== machine.architecture) throw new Error('machine identity mismatch');
    return record;
  }
  async #status(machine: Machine): Promise<MachineStatus> {
    try {
      const directory = hostDirectory(this.#root, machine.id);
      try { await stat(directory); } catch (e) { if (missing(e)) return { state: 'gone' }; throw e; }
      const record = await this.#record(machine);
      try {
        const marker = await readFile(join(directory, 'gone'), 'utf8');
        if (marker !== 'deleted') return { state: 'failed', reason: 'fake machine unavailable' };
        for (const key of ['host-key.pub', 'client-key', 'known_hosts']) {
          try { await stat(join(directory, key)); return { state: 'failed', reason: 'fake machine key retained' }; }
          catch (e) { if (!missing(e)) throw e; }
        }
        return { state: 'gone' };
      }
      catch (e) { if (!missing(e)) throw e; }
      if (record.neverBoot) return { state: 'failed', reason: 'fake machine will not boot' };
      return { state: this.#now() < record.readyAt ? 'booting' : 'ready' };
    } catch (e) { return { state: 'failed', reason: 'fake machine read failed' }; }
  }
  status(machine: Machine): Promise<MachineStatus> { return this.#serial(() => this.#status(machine)); }
  async #release(machine: Machine): Promise<ReleaseResult> {
    try {
      const before = await this.#status(machine);
      if (before.state === 'gone') return { state: 'released' };
      // A failed boot remains deletable; an identity mismatch does not.
      await this.#record(machine);
      if (!this.#options.ignoreDelete) {
        const directory = hostDirectory(this.#root, machine.id);
        for (const key of ['host-key.pub', 'client-key', 'known_hosts']) {
          try { await unlink(join(directory, key)); } catch (e) { if (!missing(e)) throw e; }
        }
        await writeFile(join(directory, 'gone'), 'deleted');
      }
      return (await this.#status(machine)).state === 'gone' ? { state: 'released' } : { state: 'incomplete', reason: 'fake machine still exists after delete' };
    } catch { return { state: 'incomplete', reason: 'fake machine deletion unconfirmed' }; }
  }
  release(machine: Machine): Promise<ReleaseResult> { return this.#serial(() => this.#release(machine)); }
  reap(options: ReapOptions): Promise<ReapResult> { return this.#serial(async () => {
    const released: string[] = [], incomplete: string[] = [];
    try {
      let directory;
      try { directory = await opendir(join(this.#root, '.fixture-sockets')); }
      catch (e) { if (missing(e)) return { state: 'reaped', released, incomplete }; throw e; }
      for await (const entry of directory) {
        if (!entry.isDirectory() || !entry.name.startsWith('fake-')) continue;
        const record = JSON.parse(await readFile(join(this.#root, '.fixture-sockets', entry.name, 'provider.json'), 'utf8')) as Record;
        if (record.project !== options.project || record.pool !== options.pool || (await this.#status(record.machine)).state === 'gone') continue;
        ((await this.#release(record.machine)).state === 'released' ? released : incomplete).push(record.machine.id);
      }
      return { state: 'reaped', released, incomplete };
    } catch (e) { return { state: 'failed', reason: 'fake reap read failed' }; }
  }); }
}
function missing(e: unknown): boolean { return (e as NodeJS.ErrnoException).code === 'ENOENT'; }
