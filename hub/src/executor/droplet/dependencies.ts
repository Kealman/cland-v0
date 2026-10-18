import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod } from 'node:fs/promises';
import { join } from 'node:path';
import type { LockProcessTable } from '../../hub/lock.ts';
import type { Clock } from '../../hub/clock.ts';
import type { DigitalOceanApi } from './api.ts';
import { machineEnv, type Machine } from './machine.ts';
import type { DropletRun } from './run.ts';
import { armWatchdog, stopWatchdog, watchdogAlive } from './watchdog.ts';
import type { HostGate, RunRef } from '../executor.ts';
import type { prepareBundle, prepareKey } from './prepare.ts';

export type Provider = Pick<DigitalOceanApi, keyof DigitalOceanApi>;
export type MachineTransport = Pick<Machine, keyof Machine>;
export type RemoteRun = Pick<DropletRun, keyof DropletRun>;
/** Host process ownership is separate from provider state and remote execution. */
export const processHost = {
  async createKey(dir: string, name: string, env: NodeJS.ProcessEnv): Promise<void> {
    await promisify(execFile)('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', join(dir, 'key'), '-C', name], { timeout: 15000, env: machineEnv(env) });
    await chmod(join(dir, 'key'), 0o600);
  },
  armWatchdog, stopWatchdog, watchdogAlive,
};
export type DropletDependencies = {
  /** Host identities for durable executor and spend locks; file locking remains native. */
  processes?: LockProcessTable;
  clock?: Clock;
  /** Executor delays, separate from transport deadlines and native I/O. */
  wait?: (ms: number) => Promise<void>;
  hostGate?: (run: RunRef) => Promise<HostGate>;
  api?: Provider;
  machine?: MachineTransport;
  run?: RemoteRun;
  host?: typeof processHost;
  prepareKey?: typeof prepareKey;
  prepareBundle?: typeof prepareBundle;
};
