import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parseLinuxStat } from './proc-stat.ts';

export const readLinuxBootIdSync = (): string => readFileSync('/proc/sys/kernel/random/boot_id', 'utf8');
export const readLinuxBootId = (): Promise<string> => readFile('/proc/sys/kernel/random/boot_id', 'utf8');

const canonicalBootPattern = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const canonicalBoot = new RegExp('^'+canonicalBootPattern+'$');
const linuxBirth = new RegExp('^linux:('+canonicalBootPattern+'):\\d+$');
export const isCanonicalBootId = (value: unknown): value is string => typeof value === 'string' && canonicalBoot.test(value);
/** Parse the recorded boot without granting authority to malformed/legacy births. */
export const linuxBirthBootId = (identity: string | null | undefined): string | null => linuxBirth.exec(identity ?? '')?.[1] ?? null;

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
  const match = parseLinuxStat(stat);
  if (!match) return failure(report, pid, 'Linux stat parse: invalid PID, comm or state');
  if (match.pid !== pid) return failure(report, pid, 'Linux stat PID: selector mismatch');
  const ticks = match.ticks;
  if (!ticks) return failure(report, pid, 'Linux stat field 22: missing or invalid start ticks');
  if (match.state === 'Z' || match.state === 'X') return exited(reportExited, pid);
  return `linux:${boot.trim()}:${ticks}`;
}


/** Bounded procfs exit race: ESRCH alone is never a positive absence receipt. */
export function readLinuxStat(read: () => string): string;
export function readLinuxStat(read: () => Promise<string>): Promise<string>;
export function readLinuxStat(read: () => string | Promise<string>): string | Promise<string> {
  const retry = (attempt: number): string | Promise<string> => {
    const recover = (error: unknown): string | Promise<string> => {
      if (errorCode(error) === 'ESRCH' && attempt < 2) return retry(attempt + 1);
      throw error;
    };
    try {
      const result = read();
      return typeof result === 'string' ? result : result.catch(recover);
    } catch (error) { return recover(error); }
  };
  return retry(0);
}
