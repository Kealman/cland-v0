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
import { stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { localHost } from '../../host/local.ts';
import { prepareIgnore } from '../../host/local-opencode-files.ts';
import { LaunchFiles } from '../launch-files.ts';
import { dirname, join } from 'node:path';

export type ServerFiles = { dir: string; config: string; password: string; log: string };

export function serverFiles(clandDir: string, name: string): ServerFiles {
  const dir = join(clandDir, 'opencode', name);
  return { dir, config: join(dir, 'opencode.json'), password: join(dir, 'password'), log: join(dir, 'serve.log') };
}

/** Write the session's config and a fresh password (kept when one exists: a relaunch reuses it). */
export async function prepareFiles(clandDir: string, files: ServerFiles, config: Record<string, unknown>, freshPassword: boolean, transaction: LaunchFiles, resumed: Resumed = untimed, log: (entry: Record<string, unknown>) => void = () => {}, host: Host = localHost()): Promise<string> {
  return continueWith((function* (): Generator<Promise<unknown>, string, unknown> {
    const root = join(clandDir, 'opencode');
    yield* wait(transaction.directory(files.dir));
    if (host.name !== 'local') throw new Error('nonlocal OpenCode shared ignore needs Host atomic publish/append (T-1644)');
    yield* wait(prepareIgnore(root, transaction, resumed, log));
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

export async function startServer(options: { host: Host; bin: string; cwd: string; env: NodeJS.ProcessEnv; files: ServerFiles; password: string; deadlineMs: number; transaction: LaunchFiles; log: (entry: Record<string, unknown>) => void; stopGraceMs: number; resumed?: Resumed; authorize?: () => void }): Promise<{ pid: number; url: string }> {
  return continueWith((function* (): Generator<Promise<unknown>, {
    pid: number;
    url: string;
  }, unknown> {
    const { files } = options;
    // The shared database outlives a launch transaction and is never rolled back with its session files.
    if (options.env.OPENCODE_DB) yield* wait(new LaunchFiles(options.resumed, options.host).directory(dirname(options.env.OPENCODE_DB), 0o700));
    const deadline = Date.now() + options.deadlineMs;
    let start = 0;
    if (options.host.name === 'local') start = yield* wait(stat(files.log).then(s => s.size, err => { if (err.code === 'ENOENT') return 0; throw err; }));
    else if ((yield* wait(options.host.fileType(files.log))) !== 'missing') throw new Error('nonlocal log append needs Host size metadata (T-1644)');
    let explanation = '';
    const attempted = new Set<number>();
    while (Date.now() < deadline) {
      const port = yield* wait(options.host.freePort());
      if (attempted.has(port)) continue;
      attempted.add(port);
      const url = `http://127.0.0.1:${port}`;
      const client = new OpenCodeClient(url, options.password);
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
      options.authorize?.();
      void child.exited.then(({ code, signal }) => { exited = `exited ${code ?? signal}`; });
      while (Date.now() < deadline && !exited) {
        const ready = yield* wait(client.request('GET', '/api/session/active', undefined, Math.max(1, Math.min(250, deadline - Date.now()))).then(() => true, () => false));
        options.authorize?.();
        if (ready && !exited && child.pid !== undefined) return { pid: child.pid, url };
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
