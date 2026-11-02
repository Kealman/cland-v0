import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { linuxIdentity, readLinuxBootId } from './identity.ts';
const exec = promisify(execFile);
export type Observation = { identity: string | null; ended: boolean };
export async function agentBootId(env: NodeJS.ProcessEnv): Promise<string> {
  if (process.platform === 'linux') return (await readLinuxBootId()).trim();
  if (!env.CLAND_FAKE_HOSTS || !env.CLAND_HOST_BOOT_ID_FILE) throw new Error('non-Linux agent requires fake host boot-id file');
  const boot = (await readFile(env.CLAND_HOST_BOOT_ID_FILE, 'utf8')).trim();
  if (!/^[a-f0-9-]{36}$/.test(boot)) throw new Error('invalid fake boot id');
  return boot;
}
export async function observeProcesses(pids: number[], env: NodeJS.ProcessEnv): Promise<Map<number, Observation>> {
  pids = [...new Set(pids.filter(pid => Number.isSafeInteger(pid) && pid > 1))];
  const result = new Map(pids.map(pid => [pid, { identity: null, ended: false } as Observation]));
  if (!pids.length) return result;
  let boot: string;
  try { boot = await agentBootId(env); } catch { return result; }
  if (process.platform === 'linux') {
    for (let i = 0; i < pids.length; i += 32) await Promise.all(pids.slice(i, i + 32).map(async pid => {
      try {
        let ended = false;
        const identity = linuxIdentity(pid, await readFile(`/proc/${pid}/stat`, 'utf8'), boot, undefined, () => { ended = true; });
        result.set(pid, { identity, ended });
      } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') result.set(pid, { identity: null, ended: true }); }
    }));
    return result;
  }
  let stdout: string;
  try { stdout = (await exec('ps', ['-p', pids.join(','), '-o', 'pid=,lstart=,stat='], { env: { ...env, LC_ALL: 'C', TZ: 'UTC' }, timeout: 3000, maxBuffer: 8 * 1024 * 1024 })).stdout; }
  catch (error) {
    const failure = error as { code?: number; stdout?: string };
    if (failure.code === 1 && !failure.stdout?.trim()) { for (const pid of pids) result.set(pid, { identity: null, ended: true }); }
    return result;
  }
  const seen = new Map<number, Observation>();
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    const match = /^\s*(\d+)\s+(\w+\s+\w+\s+\d+\s+\d+:\d+:\d+\s+\d+)\s+(\S+)\s*$/.exec(line);
    if (!match) return result;
    const start = Date.parse(match[2]! + ' UTC'); if (!Number.isFinite(start)) return result;
    const ended = /^[ZX]/.test(match[3]!);
    seen.set(Number(match[1]), { identity: ended ? null : `linux:${boot}:${start}`, ended });
  }
  for (const pid of pids) result.set(pid, seen.get(pid) ?? { identity: null, ended: true });
  return result;
}
