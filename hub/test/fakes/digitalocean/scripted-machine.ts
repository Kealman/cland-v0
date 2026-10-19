import { remoteWaits } from '../../remote-clock.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FakeClock } from '../../fake-clock.ts';
import type { DropletDependencies, RemoteRun } from '../../../src/executor/droplet/dependencies.ts';
import type { RunRef, RunStatus } from '../../../src/executor/executor.ts';
import { writeLease, type DropletLease } from '../../../src/executor/droplet/lease.ts';
import type { PrepareKey } from '../../../src/executor/droplet/prepare.ts';

export type MachineScript = { outcome?: 'green' | 'red' | 'lost' | 'slow'; code?: number; afterMs?: number; failures?: string[]; log?: string };
/** Semantic remote receipts, without shell parsing, SSH or a worker process.
 * Native writers are injectable so tests can hold their completion receipts. */
export function scriptedMachine(root: string, clock: FakeClock, key: PrepareKey, initial: MachineScript = {}, io = { writeFile, writeLease }) {
  const waits = remoteWaits(clock);
  const scripts: MachineScript[] = [];
  const starts = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  const startReceipt = (id: string) => {
    let receipt = starts.get(id);
    if (!receipt) { receipt = Promise.withResolvers<void>(); starts.set(id, receipt); }
    return receipt;
  };
  const executions = new Map<string, { script: MachineScript; ref: RunRef; started?: number; cancelled?: boolean; finished?: number }>();
  const calls: { step: string; run: string }[] = [];
  const record = (step: string, lease: DropletLease) => { calls.push({ step, run: lease.run }); };
  const state = (lease: DropletLease) => {
    const run = executions.get(lease.run);
    if (!run) throw new Error('scripted machine has no delivered run');
    return run;
  };
  const run: RemoteRun = {
    async deliver(lease, ref) {
      return waits.track(async () => {
        record('deliver', lease);
        if (!executions.has(lease.run)) executions.set(lease.run, { script: scripts.shift() ?? initial, ref });
        lease.execution = { head: ref.head, delivered: true };
        await io.writeLease(root, lease);
      });
    },
    async start(lease) {
      return waits.track(async () => {
        record('start', lease);
        if (!lease.execution?.delivered) throw new Error('remote run is not delivered');
        const execution = state(lease);
        execution.started ??= clock.now().getTime();
        lease.execution.started = true; lease.execution.startedAt = new Date(execution.started).toISOString();
        await io.writeLease(root, lease);
        startReceipt(lease.run).resolve();
      });
    },
    async status(lease): Promise<RunStatus> {
      record('status', lease);
      if (!executions.has(lease.run)) return { state: 'lost', code: 1, cause: 'remote machine lost' };
      const execution = state(lease);
      if (Date.parse(lease.deadline) <= clock.now().getTime()) return { state: 'lost', code: 1, cause: 'remote machine lifetime expired' };
      if (execution.started === undefined) return { state: 'pending' };
      if (execution.script.outcome === 'lost') return { state: 'lost', code: 1, cause: 'remote machine lost' };
      if (!execution.cancelled && (execution.script.outcome === 'slow' || clock.now().getTime() < execution.started + (execution.script.afterMs ?? 100))) return { state: 'running' };
      execution.finished ??= execution.started + (execution.script.afterMs ?? 100);
      return { state: 'done', code: execution.cancelled ? 1 : execution.script.code ?? (execution.script.outcome === 'red' ? 1 : 0), finished: new Date(execution.finished).toISOString(), platform: { os: 'linux', arch: 'x64', release: 'scripted', node: key.node, nvim: key.nvim?.tag ?? 'none' } };
    },
    async log(lease, offset) {
      record('log', lease);
      const script = state(lease).script;
      const output = script.log ?? `# tests 1\n# pass ${script.outcome === 'red' ? 0 : 1}\n${(script.failures ?? []).map(name => `✖ ${name}`).join('\n')}\n`;
      const bytes = Buffer.from(output).subarray(offset, offset + 262144);
      return { text: bytes.toString('utf8'), bytes, next: offset + bytes.length };
    },
    async cancel(lease) { record('cancel', lease); state(lease).cancelled = true; state(lease).finished = clock.now().getTime(); },
    async collectCoverage(lease, path) {
      return waits.track(async () => {
        record('collect', lease);
        const ref = state(lease).ref;
        await io.writeFile(path, JSON.stringify({ version: 1, head: ref.head, tree: ref.tree ?? '0'.repeat(40), created: clock.now().toISOString(), testFiles: [], files: {} }));
      });
    },
  };
  const armed = new Set<string>();
  const host: NonNullable<DropletDependencies['host']> = {
    async createKey(dir) {
      return waits.track(async () => {
        await io.writeFile(join(dir, 'key'), 'scripted-private-key', { mode: 0o600 });
        await io.writeFile(join(dir, 'key.pub'), 'ssh-ed25519 scripted-public-key');
      });
    },
    async armWatchdog(dir) { armed.add(dir); return { pid: 0, startedUtc: clock.now().toISOString() }; },
    async stopWatchdog(lease) { record('release', lease); armed.delete(join(root, '.cland/run/executor/leases', lease.lease)); },
    async watchdogAlive(lease) { return armed.has(join(root, '.cland/run/executor/leases', lease.lease)); },
  };
  const machine: NonNullable<DropletDependencies['machine']> = {
    root,
    async exec(lease, command) {
      record('ready', lease);
      if (!command.includes('.cland-image.json') && !command.includes('/var/lib/cland-ready')) throw new Error('scripted transport needs an explicit command response');
      return JSON.stringify(key);
    },
    async result() { throw new Error('scripted demo command needs an explicit response'); },
    async put() { throw new Error('scripted transport does not copy files'); },
    async get() { throw new Error('scripted transport does not copy files'); },
  };
  function finish(id: string, code = 0, log?: string) {
    const execution = executions.get(id);
    if (execution?.started === undefined) throw new Error('observe machine start before completing a scripted run');
    execution.script = { outcome: code ? 'red' : 'green', afterMs: 0, ...(log === undefined ? {} : { log }) };
    execution.finished = clock.now().getTime();
  }
  return { calls, waits, finish, started: (id: string) => startReceipt(id).promise, script: (...next: MachineScript[]) => scripts.push(...next), dependencies: { processes: { alive: pid => pid === process.pid, started: () => null }, clock, wait: waits.wait, run, host, machine, prepareKey: async () => key,
    prepareBundle: async (_root, dir) => waits.track(async () => { const bundle = join(dir, 'base.bundle'); await io.writeFile(bundle, 'scripted base bundle'); return bundle; }),
  } satisfies DropletDependencies };
}
