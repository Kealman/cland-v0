// A session's own `opencode serve`: started detached in the session's cwd on 127.0.0.1 and a port
// cland picks and polls over authenticated HTTP, with the spoke's MCP server added
// through OpenCode's own configuration (`OPENCODE_CONFIG`, a file the server process reads at its start) and a
// password of its own (`OPENCODE_PASSWORD`: HTTP Basic, user `opencode`). The server outlives the hub.
//
// Its files live in `<project>/.cland/opencode/<name>/`, which carries a `.gitignore` of its own (`*`): the
// generated config (`opencode.json`), the password (`password`, mode 600) and the server's output (`serve.log`).
// Nothing is written into the project's committed files.
import type { Resumed } from '../../hub/worktrees.ts';
import { continueWith, wait, untimed } from '../continuations.ts';
import { OpenCodeClient } from './client.ts';
import type { Host } from '../../host/host.ts';
import { randomBytes } from 'node:crypto';
import { localHost } from '../../host/local.ts';
import { prepareIgnore } from './ignore.ts';
import { LaunchFiles } from '../launch-files.ts';
import { dirname, join, basename } from 'node:path';

export type ServerFiles = { dir: string; config: string; password: string; log: string };

/** Includes repeated selections, which must not spin until the launch deadline. */
export const SERVER_PORT_ATTEMPTS = 8;

export class OpenCodePortRetryError extends Error {
  readonly port: number;
  readonly attempts: number;
  constructor(port: number, attempts: number) {
    super(`opencode serve exhausted ${attempts} port selections; last port ${port}`);
    this.name = 'OpenCodePortRetryError';
    this.port = port;
    this.attempts = attempts;
  }
}

export function serverFiles(clandDir: string, name: string): ServerFiles {
  const dir = join(clandDir, 'opencode', name);
  return { dir, config: join(dir, 'opencode.json'), password: join(dir, 'password'), log: join(dir, 'serve.log') };
}

/** One private-file policy for cleanup and read-only retirement inventory. */
export const privateServerPaths=(files:ServerFiles):readonly string[]=>[files.config,files.password];
export function retainedPrivateServerFiles(paths:readonly string[]):Array<{session:string;files:string[]}> {
  const names=new Set(privateServerPaths(serverFiles('','')).map(path=>basename(path))),found=new Map<string,string[]>();
  for(const path of paths){const parts=path.split('/');if(parts.length!==2||!parts[0]||!names.has(parts[1]!))continue;const files=found.get(parts[0])??[];files.push(parts[1]!);found.set(parts[0],files);}
  return [...found].map(([session,files])=>({session,files}));
}

/** Write the session's config and a fresh password (kept when one exists: a relaunch reuses it). */
export async function prepareFiles(clandDir: string, files: ServerFiles, config: Record<string, unknown>, freshPassword: boolean, transaction: LaunchFiles, resumed: Resumed = untimed, log: (entry: Record<string, unknown>) => void = () => {}, host: Host = localHost()): Promise<string> {
  return continueWith((function* (): Generator<Promise<unknown>, string, unknown> {
    const root = join(clandDir, 'opencode');
    yield* wait(transaction.directory(files.dir));
    yield* wait(prepareIgnore(root, resumed, log, host));
    yield* wait(transaction.write(files.config, Buffer.from(`${JSON.stringify(config, null, 2)}\n`)));
    let password = !freshPassword ? yield* wait(readPassword(files, resumed, host)) ?? '' : '';
    if (!password) password = randomBytes(24).toString('base64url');
    const bytes = !freshPassword && (yield* wait(readPassword(files, resumed, host))) ? yield* wait(host.readFile(files.password)) : Buffer.from(`${password}\n`);
    yield* wait(transaction.write(files.password, bytes, 0o600));
    return password;
  })(), resumed);
}

export async function readPassword(files: ServerFiles, resumed: Resumed = untimed, host: Host = localHost()): Promise<string | null> {
  return continueWith((function* (): Generator<Promise<unknown>, string | null, unknown> {
    try {
      return Buffer.from(yield* wait(host.readFile(files.password))).toString('utf8').trim() || null;
    } catch {
      return null;
    }
  })(), resumed);
}

export async function startServer(options: { host: Host; client?: (url: string, password: string) => Promise<OpenCodeClient>; bin: string; cwd: string; env: NodeJS.ProcessEnv; files: ServerFiles; password: string; deadlineMs: number; transaction: LaunchFiles; log: (entry: Record<string, unknown>) => void; stopGraceMs: number; resumed?: Resumed; authorize?: () => void }): Promise<{ pid: number; url: string; exited: Promise<{ code: number | null; signal: string | null }> }> {
  return continueWith((function* (): Generator<Promise<unknown>, {
    pid: number;
    url: string;
    exited: Promise<{ code: number | null; signal: string | null }>;
  }, unknown> {
    const { files } = options;
    // The shared database outlives a launch transaction and is never rolled back with its session files.
    if (options.env.OPENCODE_DB) yield* wait(new LaunchFiles(options.resumed, options.host).directory(dirname(options.env.OPENCODE_DB), 0o700));
    const deadline = Date.now() + options.deadlineMs;
    let start = yield* wait(options.host.stat(files.log).then(s => s.size, err => { if (err.code === 'ENOENT') return 0; throw err; }));
    let explanation = '';
    const attempted = new Set<number>();
    let selections = 0, lastPort = 0;
    while (Date.now() < deadline) {
      if (selections === SERVER_PORT_ATTEMPTS) throw new OpenCodePortRetryError(lastPort, selections);
      const port = yield* wait(options.host.freePort());
      selections++;
      lastPort = port;
      if (attempted.has(port)) continue;
      attempted.add(port);
      const url = `http://127.0.0.1:${port}`;

      let exited: string | null = null;
      const child = yield* wait(options.host.spawn({
        command: options.bin,
        args: ['serve', '--hostname', '127.0.0.1', '--port', String(port)],
        cwd: options.cwd,
        env: { ...options.env, OPENCODE_CONFIG: files.config, OPENCODE_PASSWORD: options.password },
        logFile: files.log,
      }, options.authorize ? { authorize: options.authorize } : undefined).then(child => {
        // Own the PID before the continuation can reject a late launch result.
        options.transaction.spawned(child, options.log, options.stopGraceMs);
        return child;
      }));
      const client = yield* wait(options.client ? options.client(url, options.password) : Promise.resolve(new OpenCodeClient(url, options.password)));
      options.authorize?.();
      void child.exited.then(({ code, signal }) => { exited = `exited ${code ?? signal}`; });
      while (Date.now() < deadline && !exited) {
        const ready = yield* wait(client.request('GET', '/api/session/active', undefined, Math.max(1, Math.min(250, deadline - Date.now()))).then(() => true, () => false));
        options.authorize?.();
        if (ready && !exited && child.pid !== undefined) return { pid: child.pid, url, exited: child.exited };
        yield* wait(new Promise(r => setTimeout(r, Math.max(0, Math.min(50, deadline - Date.now())))));
      }
      // Output is diagnostic only, never the readiness signal. Ignore earlier launch attempts' output.
      const log = yield* wait(options.host.readFile(files.log));
      const attemptLog = Buffer.from(log.subarray(start)).toString('utf8');
      explanation = attemptLog.trim().slice(-500);
      if (exited && /EADDRINUSE|address already in use/i.test(attemptLog)) {
        start = log.length;
        continue;
      }
      if (exited) throw new Error(`opencode serve ${exited}: ${explanation}`);
      break;
    }
    throw new Error(`opencode serve did not answer within ${options.deadlineMs} ms: ${explanation}`);
  })(), options.resumed ?? untimed);
}
