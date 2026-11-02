import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const readLinuxBootIdSync = (): string => readFileSync('/proc/sys/kernel/random/boot_id', 'utf8');
export const readLinuxBootId = (): Promise<string> => readFile('/proc/sys/kernel/random/boot_id', 'utf8');

export type IdentityFailure = (pid: number, error: string) => void;
/** A native exited state proves absence for liveness, never ownership for a signal. */
export type IdentityExited = (pid: number) => void;
function exited(report: IdentityExited | undefined, pid: number): null {
  try { report?.(pid); } catch { /* observers cannot grant authority */ }
  return null;
}
function failure(report: IdentityFailure | undefined, pid: number, message: string): null {
  try { report?.(pid, message); } catch { /* diagnostics grant no authority */ }
  return null;
}
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException)?.code ?? 'unknown error';

/** Linux stat field 22 follows a parenthesized comm that may itself contain ')'. */
export function linuxIdentity(pid: number, stat: string, boot: string, report?: IdentityFailure, reportExited?: IdentityExited): string | null {
  if (!/^[a-f0-9-]{36}$/.test(boot.trim())) return failure(report, pid, 'Linux boot-id validation: invalid UUID');
  const match = /^(\d+) \([\s\S]*\) (\S+) ([\s\S]*)$/.exec(stat.trim());
  if (!match) return failure(report, pid, 'Linux stat parse: invalid PID, comm or state');
  if (Number(match[1]) !== pid) return failure(report, pid, 'Linux stat PID: selector mismatch');
  const ticks = match[3]!.split(/\s+/)[18];
  if (!ticks || !/^\d+$/.test(ticks)) return failure(report, pid, 'Linux stat field 22: missing or invalid start ticks');
  if (match[2] === 'Z' || match[2] === 'X') return exited(reportExited, pid);
  return `linux:${boot.trim()}:${ticks}`;
}

