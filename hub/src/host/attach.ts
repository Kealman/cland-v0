import { remoteCommandEnvironment } from './agent/command-environment.ts';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { sshConnectionArguments } from '../transport/ssh.ts';
import type { HostRecord } from './records.ts';
import type { HostLaunchLayout } from './host.ts';
import type { Host } from './host.ts';
import type { HarnessProcess } from '../adapters/contract.ts';
import type { LaunchFiles } from '../adapters/launch-files.ts';
import { localHost } from './local.ts';

const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
export const attachRecordPath = (run: string, name: string) => join(run, 'attach', createHash('sha256').update(name).digest('hex') + '.json');
type AttachRecord = { version: 1; name: string; sessionId: string; host: string; cwd: string; command: string; pid: number | null; pidStarted: string | null; pidIdentity: string | null };
/** The launch transaction owns publication/rollback; never copy launch credentials here. */
export async function writeAttachRecord(machine: Host, run: string, p: HarnessProcess, command: string, files: LaunchFiles): Promise<void> {
  if (machine.name === 'local') return;
  const path = attachRecordPath(run, p.name);
  await files.directory(join(run, 'attach'), 0o700);
  const record: AttachRecord = { version: 1, name: p.name, sessionId: p.sessionId, host: machine.name, cwd: p.cwd, command, pid: p.pid, pidStarted: p.pidStarted ?? null, pidIdentity: p.pidIdentity ?? null };
  await files.file(path);
  await machine.publishFile(path, Buffer.from(JSON.stringify(record)), {mode:0o600, replace:true});
}
/** Read only this agent's private run folder; a foreign/missing or exited session refuses. */
export async function hostAttachPlan(run: string, name: string, env: NodeJS.ProcessEnv): Promise<{ command: string; args: string[]; cwd: string }> {
  let record: AttachRecord;
  try {
    const file = await open(attachRecordPath(run, name), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || (process.getuid && stat.uid !== process.getuid())) throw new Error('unsafe attach record');
      record = JSON.parse(await file.readFile('utf8')) as AttachRecord;
    } finally { await file.close(); }
  } catch { throw new Error(`session "${name}" is not on this host (no private attach record)`); }
  if (record.version !== 1 || record.name !== name || !record.sessionId || !record.host || record.host === 'local' || typeof record.command !== 'string' || !record.command || typeof record.cwd !== 'string' || !record.pidIdentity || !Number.isSafeInteger(record.pid) || !await localHost(env).alive(record)) throw new Error(`session "${name}" is not running on this host`);
  return { command: 'sh', args: ['-c', `stty susp undef || exit; ${record.command}`], cwd: record.cwd };
}
export function hostAttachRemoteCommand(node: string, cli: string, run: string, name: string): string {
  return `CLAND_HOST_RUN_DIR=${quote(run)} ${quote(node)} ${quote(cli)} host attach ${quote(name)}`;
}

export function terminalAttachCommand(root: string, record: HostRecord, layout: HostLaunchLayout, name: string): string {
  return ['ssh', '-t', ...sshConnectionArguments(root, record), '-o', 'ControlPath=none', '-o', 'ControlMaster=no', '-o', 'ClearAllForwardings=yes', `${record.user}@${record.address}`, hostAttachRemoteCommand(layout.node, layout.cli, layout.runDirectory, name)].map(quote).join(' ');
}

/** The attach client gets account paths, never the session's hub admission credential. */
export function terminalAccountPrefix(env: Record<string, string> | null | undefined): string {
  const safe = terminalEnvironment(env ?? {});
  for (const key of Object.keys(safe)) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error('invalid attach environment name');
  return (safe.XDG_DATA_HOME !== undefined ? 'unset OPENCODE_DB; ' : safe.OPENCODE_DB !== undefined ? 'unset XDG_DATA_HOME; ' : '') + Object.entries(safe).map(([key,value]) => `export ${key}=${quote(String(value))}; `).join('');
}

export function terminalEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safe = remoteCommandEnvironment(env);
  delete safe.CLAND_LAUNCH_TOKEN;
  return safe;
}
