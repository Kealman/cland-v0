import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileOperations } from '../src/host/agent/files.ts';
import { localHostLayout } from '../src/host/launch-layout.ts';
import type { Host } from '../src/host/host.ts';
type HostMember = keyof Host;

/** Scratch files and synthetic children only. Native work must be an explicit override. */
export function recordingHost(storageRoot: string, options: {
  sourceRoot?: string;
  record?: (operation: HostMember) => void;
  overrides?: Partial<Host>;
} = {}): Host {
  const sourceRoot = resolve(options.sourceRoot ?? storageRoot);
  const storage = resolve(storageRoot);
  // An identity-mapped fixture can expose a real scratch alias, whose canonical
  // receipts must remain usable by the other file operations.
  const canonicalSource = sourceRoot === storage ? realpathSync(storage) : sourceRoot;
  const mapped = (path: string) => {
    for (const root of [sourceRoot, canonicalSource]) {
      const part = relative(root, resolve(path));
      if (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part)) return join(storage, part);
    }
    throw new Error(`outside recording Host: ${path}`);
  };
  const unmapped = (path: string) => join(sourceRoot, relative(storage, path));
  const refuse = (operation: string): never => { throw new Error(`recording Host refuses ${operation}`); };
  const children = new Map<number, ReturnType<typeof Promise.withResolvers<{code: number | null; signal: string | null}>>>();
  let nextPid = 987000;
  // Required mapped keys include optional operations, even those deliberately absent
  // for older-agent compatibility. Adding any Host member fails typecheck here.
  const operations = {
    name: 'local', limitPolls: true,
    signIn: undefined, loginDisk: undefined, loginDiskReachable: undefined,
    onCapacityChanged: undefined, flushBranch: undefined, terminalAttachCommand: undefined,
    launchClaude: undefined, adopt: undefined,
    layout: localHostLayout,
    writeFile: async (path, bytes, opts) => fileOperations.writeFile(mapped(path), bytes, opts),
    publishFile: async (path, bytes, opts) => fileOperations.publishFile(mapped(path), bytes, opts),
    appendFile: async (path, bytes) => fileOperations.appendFile(mapped(path), bytes),
    stat: async path => fileOperations.stat(mapped(path)),
    makeDirectory: async (path, mode) => fileOperations.makeDirectory(mapped(path), mode),
    removePath: async (path, opts) => fileOperations.removePath(mapped(path), opts),
    statDirectory: async path => fileOperations.statDirectory(mapped(path)),
    realpath: async path => unmapped(await fileOperations.realpath(mapped(path))),
    fileType: async path => fileOperations.fileType(mapped(path)),
    readFile: async path => fileOperations.readFile(mapped(path)),
    listFolder: async path => fileOperations.listFolder(mapped(path)),
    freePort: async () => 43210,
    forward: async (_id, endpoint) => endpoint,
    unforward: async () => {},
    spawn: async (_command, opts) => {
      opts?.authorize?.();
      const pid = nextPid++, receipt = Promise.withResolvers<{code: number | null; signal: string | null}>();
      children.set(pid, receipt);
      return {pid, exited: receipt.promise};
    },
    run: async () => refuse('run'),
    identity: async pid => ({pid, pidStarted: 'recording', pidIdentity: `linux:recording:${pid}`}),
    alive: async process => process.pid !== null && children.has(process.pid),
    stop: async process => {
      const receipt = process.pid === null ? undefined : children.get(process.pid);
      if (!receipt) return false;
      children.delete(process.pid!); receipt.resolve({code: 0, signal: null}); return true;
    },
    processes: async () => [...children.keys()].map(pid => ({pid, parent: 1, rssBytes: 0, cpuPercent: 0})),
    worktreeAdd: async () => refuse('worktreeAdd'),
    worktreeRemove: async () => refuse('worktreeRemove'),
    occupants: async () => [],
  } satisfies {[K in HostMember]: Host[K]};
  // Optional absent operations intentionally remain enumerable for the interface
  // contract census, but behave as absent to callers' capability checks.
  const recorded = Object.fromEntries(Object.entries(operations).map(([key, value]) => [key,
    typeof value === 'function' && options.record ? (...args: unknown[]) => {
      options.record!(key as HostMember);
      return Reflect.apply(value, operations, args);
    } : value,
  ]));
  return {...recorded, ...options.overrides} as unknown as Host;
}
