import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileOperations } from './files.ts';
import { worktreeOperations } from './worktrees.ts';
import { occupants } from './occupants.ts';
import { run } from './command.ts';

/** Base64 plus JSON stays below the protocol's 1 MiB line cap. */
export const FILE_BYTE_CAP = 512 * 1024;
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new Error(`${name} must be a nonempty string`);
  return value;
}
function integer(value: unknown, name: string, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) throw new Error(`invalid ${name}`);
  return value as number;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected object');
  return value as Record<string, unknown>;
}
function flag(value: unknown): boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') throw new Error('expected boolean');
  return value as boolean | undefined;
}
async function boundedRead(path: string): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new Error('Host readFile requires a regular file');
    if (info.size > FILE_BYTE_CAP) throw new Error('readFile exceeds byte cap');
    const bytes = Buffer.alloc(FILE_BYTE_CAP + 1);
    let length = 0;
    while (length < bytes.length) {
      const {bytesRead} = await file.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > FILE_BYTE_CAP) throw new Error('readFile exceeds byte cap');
    return bytes.subarray(0, length).toString('base64');
  } finally { await file.close(); }
}

export function parseAgentRun(a: Record<string, unknown>) {
      if (!Array.isArray(a.args) || !a.args.every(v => typeof v === 'string' && !v.includes('\0'))) throw new Error('invalid command args');
      const commandEnv = object(a.env);
      if (!Object.values(commandEnv).every(v => typeof v === 'string')) throw new Error('invalid command env');
      const timeout = integer(a.timeoutMs, 'timeoutMs');
  return {command:text(a.command,'command'),args:a.args as string[],env:commandEnv as NodeJS.ProcessEnv,timeoutMs:timeout,cwd:text(a.cwd,'cwd')};
}

export function agentOperations(env: NodeJS.ProcessEnv, signal?: AbortSignal): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  const trees = worktreeOperations(env);
  const path = (a: Record<string, unknown>) => text(a.path, 'path');
  return {
    statDirectory: a => fileOperations.statDirectory(path(a)),
    realpath: a => fileOperations.realpath(path(a)),
    fileType: a => fileOperations.fileType(path(a)),
    readFile: a => boundedRead(path(a)),
    listFolder: a => fileOperations.listFolder(path(a)),
    writeFile: async a => {
      const options = a.options === undefined ? {} : object(a.options);
      if (typeof a.bytes !== 'string' || a.bytes.length > Math.ceil(FILE_BYTE_CAP / 3) * 4 || /[^A-Za-z0-9+/=]/.test(a.bytes)) throw new Error('invalid base64 bytes or byte cap exceeded');
      const bytes = Buffer.from(a.bytes, 'base64');
      if (bytes.toString('base64') !== a.bytes) throw new Error('invalid base64 bytes');
      if (bytes.length > FILE_BYTE_CAP) throw new Error('writeFile exceeds byte cap');
      await fileOperations.writeFile(path(a), bytes, { ...(options.mode === undefined ? {} : {mode: integer(options.mode, 'mode', 0o7777)!}), ...(options.truncate === undefined ? {} : {truncate: integer(options.truncate, 'truncate')!}) });
      return null;
    },
    makeDirectory: async a => { await fileOperations.makeDirectory(path(a), integer(a.mode, 'mode', 0o7777)); return null; },
    removePath: async a => { const options = a.options === undefined ? {} : object(a.options); await fileOperations.removePath(path(a), options.directory === undefined ? {} : {directory: flag(options.directory)!}); return null; },
    freePort: () => fileOperations.freePort(),
    occupants: a => {
      if (!Array.isArray(a.sessions)) throw new Error('sessions must be an array');
      return occupants(path(a), a.sessions.map(value => { const row = object(value); return {name:text(row.name,'name'),cwd:text(row.cwd,'cwd')}; }));
    },
    run: a => {
      const command=parseAgentRun(a);
      return run(command.command,command.args,command.env,command.timeoutMs,false,signal,'utf8',command.cwd);
    },
    worktreeAdd: a => {
      const territory = a.territory === undefined ? undefined : object(a.territory);
      return trees.worktreeAdd({root:text(a.root,'root'),path:path(a),branch:text(a.branch,'branch'),...(a.reuseOnly === undefined ? {} : {reuseOnly:flag(a.reuseOnly)!}),...(a.detached === undefined ? {} : {detached:flag(a.detached)!}), ...(territory ? {territory:{path:text(territory.path,'territory.path'),tip:text(territory.tip,'territory.tip')}} : {})});
    },
    worktreeRemove: async a => { await trees.worktreeRemove({root:text(a.root,'root'),path:path(a)}); return null; },
  };
}
