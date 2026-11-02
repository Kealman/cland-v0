import { hostname } from 'node:os';
import { readlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readLinuxBootIdSync } from '../process-identity.ts';
import type { LockHostIdentity } from './lock.ts';

type Readers = {
  hostname: () => string;
  linuxBoot: () => string;
  sysctl: (key: string) => string;
  pidNamespace: () => string;
};
const native: Readers = {
  hostname,
  linuxBoot: readLinuxBootIdSync,
  sysctl: key => execFileSync('/usr/sbin/sysctl', ['-n', key], { encoding: 'utf8', timeout: 3000 }).trim(),
  pidNamespace: () => readlinkSync('/proc/self/ns/pid'),
};
/** Capture once per acquisition. A failed identity read refuses acquisition rather than guessing a PID table. */
export function lockHostIdentity(platform: NodeJS.Platform = process.platform, readers: Readers = native): LockHostIdentity {
  return {
    hostname: readers.hostname(),
    bootId: platform === 'linux' ? readers.linuxBoot().trim() : platform === 'darwin' ? readers.sysctl('kern.bootsessionuuid').trim() : null,
    pidNamespace: platform === 'linux' ? readers.pidNamespace() : null,
  };
}
