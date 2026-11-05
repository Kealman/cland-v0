// Native process birth, independent of ps's whole-second display timestamp.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { run } from './doctor/report.ts';

import { readLinuxStat, linuxIdentity, readLinuxBootId, readLinuxBootIdSync, type IdentityFailure, type IdentityExited } from './host/agent/identity.ts';
export { linuxIdentity, readLinuxBootId, readLinuxBootIdSync, type IdentityFailure, type IdentityExited } from './host/agent/identity.ts';
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException)?.code ?? 'unknown error';
function exited(report: IdentityExited | undefined, pid: number): null {
  try { report?.(pid); } catch { /* observers cannot grant authority */ }
  return null;
}
function failure(report: IdentityFailure | undefined, pid: number, message: string): null {
  try { report?.(pid, message); } catch { /* diagnostics grant no authority */ }
  return null;
}

// Darwin's observed 64-bit kinfo_proc layout (xnu bsd/sys/{proc,sysctl}.h):
// 648-byte records, extern_proc starts with timeval, p_pid at byte 40.
// Reject unknown layouts rather than interpreting them as authority to signal.
export function darwinIdentities(bytes: Buffer, reportExited?: IdentityExited): Map<number, string> {
  const identities = new Map<number, string>();
  if (bytes.length % 648) return identities;
  for (let offset = 0; offset < bytes.length; offset += 648) {
    const seconds = bytes.readBigInt64LE(offset), micros = bytes.readInt32LE(offset + 8);
    const pid = bytes.readInt32LE(offset + 40);
    if (pid > 0 && seconds > 0n && micros >= 0 && micros < 1_000_000) {
      // extern_proc.p_stat at byte 36; sys/proc.h SZOMB (5) awaits parent collection.
      if (bytes.readUInt8(offset + 36) === 5) exited(reportExited, pid);
      else identities.set(pid, `darwin:${seconds}:${micros}`);
    }
  }
  return identities;
}
const valid = (pids: number[]) => [...new Set(pids.filter(pid => Number.isSafeInteger(pid) && pid > 0))];
// Darwin exposes KERN_PROC_PID through sysctl(3), not named sysctl CLI OIDs.
// macOS ships Perl; its syscall boundary avoids an addon or a compiler at runtime.
const darwinProbe = `for $pid (@ARGV) {
  $mib = pack("i*", 1, 14, 1, $pid);
  $bytes = "\\0" x 648; $size = pack("L!", 648);
  $result = syscall(202, $mib, 4, $bytes, $size, 0, 0);
  print $bytes if $result == 0 && unpack("L!", $size) == 648;
}`;
const selectors = (pids: number[]) => ['-e', darwinProbe, '--', ...pids.map(String)];
export function processIdentities(pids: number[], report?: IdentityFailure, reportExited?: IdentityExited): Map<number, string> {
  pids = valid(pids);
  if (!pids.length) return new Map();
  try {
    if (process.platform === 'darwin' && ['arm64', 'x64'].includes(process.arch)) {
      return darwinIdentities(execFileSync('/usr/bin/perl', selectors(pids), { timeout: 3000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }), reportExited);
    }
    if (process.platform === 'linux') {
      let boot: string;
      try { boot = readLinuxBootIdSync(); }
      catch (error) { for (const pid of pids) failure(report, pid, `Linux boot-id read: ${errorCode(error)}`); return new Map(); }
      const result = new Map<number, string>();
      for (const pid of pids) {
        try { const identity = linuxIdentity(pid, readLinuxStat(() => readFileSync(`/proc/${pid}/stat`, 'utf8')), boot, report, reportExited); if (identity) result.set(pid, identity); }
        catch (error) { failure(report, pid, `Linux /proc/${pid}/stat read: ${errorCode(error)}`); }
      }
      return result;
    }
  } catch { /* no native proof */ }
  return new Map();
}
export async function processIdentitiesAsync(pids: number[], env: NodeJS.ProcessEnv = process.env, timeoutMs = 3000, report?: IdentityFailure, reportExited?: IdentityExited): Promise<Map<number, string>> {
  pids = valid(pids);
  if (!pids.length) return new Map();
  try {
    if (process.platform === 'darwin' && ['arm64', 'x64'].includes(process.arch)) {
      const result = await run('/usr/bin/perl', selectors(pids), env, timeoutMs, false, undefined, 'latin1');
      // The helper omits gone/unreadable PIDs; interpreter failures provide no proof.
      if (!result.error && result.code === 0) return darwinIdentities(Buffer.from(result.stdout, 'latin1'), reportExited);
    }
    if (process.platform === 'linux') {
      let boot: string;
      try { boot = await readLinuxBootId(); }
      catch (error) { for (const pid of pids) failure(report, pid, `Linux boot-id read: ${errorCode(error)}`); return new Map(); }
      const result = new Map<number, string>();
      await Promise.all(pids.map(async pid => {
        try { const identity = linuxIdentity(pid, await readLinuxStat(() => readFile(`/proc/${pid}/stat`, 'utf8')), boot, report, reportExited); if (identity) result.set(pid, identity); }
        catch (error) { failure(report, pid, `Linux /proc/${pid}/stat read: ${errorCode(error)}`); }
      }));
      return result;
    }
  } catch { /* no native proof */ }
  return new Map();
}
export async function processIdentityAsync(pid: number, env: NodeJS.ProcessEnv = process.env, report?: IdentityFailure, reportExited?: IdentityExited): Promise<string | null> {
  return (await processIdentitiesAsync([pid], env, 3000, report, exitedPid => {
    if (exitedPid === pid) reportExited?.(pid);
  })).get(pid) ?? null;
}
