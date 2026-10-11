// A session's own `opencode serve`: started detached in the session's cwd on 127.0.0.1 and a port the server
// picks (`--port 0`; it prints `server listening on http://127.0.0.1:<port>`), with the spoke's MCP server added
// through OpenCode's own configuration (`OPENCODE_CONFIG`, a file the server process reads at its start) and a
// password of its own (`OPENCODE_PASSWORD`: HTTP Basic, user `opencode`). The server outlives the hub.
//
// Its files live in `<project>/.cland/opencode/<name>/`, which carries a `.gitignore` of its own (`*`): the
// generated config (`opencode.json`), the password (`password`, mode 600) and the server's output (`serve.log`).
// Nothing is written into the project's committed files.
import type { Resumed } from '../../hub/worktrees.ts';
import { continueWith, wait, untimed } from '../continuations.ts';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, link, open, readFile, rm, writeFile } from 'node:fs/promises';
import { LaunchFiles } from '../launch-files.ts';
import { join } from 'node:path';

export type ServerFiles = { dir: string; config: string; password: string; log: string };

export function serverFiles(clandDir: string, name: string): ServerFiles {
  const dir = join(clandDir, 'opencode', name);
  return { dir, config: join(dir, 'opencode.json'), password: join(dir, 'password'), log: join(dir, 'serve.log') };
}

const GENERATED_IGNORE = '# managed by cland: generated OpenCode configs and server passwords, never committed\n*\n';

/** Publish new metadata without clobbering; repair existing contents only by appending the missing rule. */
async function prepareIgnore(root: string, transaction: LaunchFiles, resumed: Resumed, log: (entry: Record<string, unknown>) => void): Promise<void> {
  return continueWith((function* (): Generator<Promise<unknown>, void, unknown> {
    const ignore = join(root, '.gitignore');
    function* wildcard(content: string): Generator<Promise<unknown>, void, unknown> {
      if (content.split(/\r?\n/).includes('*')) return;
      // Always include a separator: a concurrent edit may have removed the final newline.
      yield* wait(writeFile(ignore, '\n*\n', { flag: 'a' }));
    }
    let before: string | null;
    try { before = yield* wait(readFile(ignore, 'utf8')); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; before = null; }
    if (before !== null) { yield* wildcard(before); return; }
    const staging = join(root, `.stage-${randomUUID()}.gitignore`);
    transaction.removeOnFailure(staging);
    try {
      yield* wait(writeFile(staging, GENERATED_IGNORE, { flag: 'wx' }));
      let current: string | null;
      try { current = yield* wait(readFile(ignore, 'utf8')); }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; current = null; }
      const conflict = () => log({ event: 'opencode-ignore-conflict', path: ignore, warning: 'shared .gitignore changed during launch preparation; preserved its contents and added only a missing wildcard rule' });
      if (current !== null) { conflict(); yield* wildcard(current); return; }
      // No-clobber publication also protects a file created after the last read.
      try { yield* wait(link(staging, ignore)); }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        conflict();
        yield* wildcard(yield* wait(readFile(ignore, 'utf8')));
      }
    } finally { yield* wait(rm(staging, { force: true })); }
  })(), resumed);
}

/** Write the session's config and a fresh password (kept when one exists: a relaunch reuses it). */
export async function prepareFiles(clandDir: string, files: ServerFiles, config: Record<string, unknown>, freshPassword: boolean, transaction: LaunchFiles, resumed: Resumed = untimed, log: (entry: Record<string, unknown>) => void = () => {}): Promise<string> {
  return continueWith((function* (): Generator<Promise<unknown>, string, unknown> {
    const root = join(clandDir, 'opencode');
    yield* wait(transaction.directory(files.dir));
    yield* wait(prepareIgnore(root, transaction, resumed, log));
    yield* wait(transaction.file(files.config));
    yield* wait(writeFile(files.config, `${JSON.stringify(config, null, 2)}\n`));
    let password = !freshPassword ? yield* wait(readPassword(files, resumed)) ?? '' : '';
    yield* wait(transaction.file(files.password));
    if (!password) {
      password = randomBytes(24).toString('base64url');
      yield* wait(writeFile(files.password, `${password}\n`, { mode: 0o600 }));
    }
    yield* wait(chmod(files.password, 0o600));
    return password;
  })(), resumed);
}

export async function readPassword(files: ServerFiles, resumed: Resumed = untimed): Promise<string | null> {
  return continueWith((function* (): Generator<Promise<unknown>, string | null, unknown> {
    try {
      return (yield* wait(readFile(files.password, 'utf8'))).trim() || null;
    } catch {
      return null;
    }
  })(), resumed);
}

/** The url a starting server printed, read from its log. */
export function listeningUrl(log: string): string | null {
  return /listening on (https?:\/\/[^\s]+)/i.exec(log)?.[1]?.replace(/\/+$/, '') ?? null;
}

export async function startServer(options: { bin: string; cwd: string; env: NodeJS.ProcessEnv; files: ServerFiles; password: string; deadlineMs: number; transaction: LaunchFiles; log: (entry: Record<string, unknown>) => void; stopGraceMs: number; resumed?: Resumed; authorize?: () => void }): Promise<{ pid: number; url: string }> {
  return continueWith((function* (): Generator<Promise<unknown>, {
    pid: number;
    url: string;
  }, unknown> {
    const { files, resumed = untimed } = options;
    const start = (yield* wait(readFile(files.log, 'utf8').catch(err => { if (err.code === 'ENOENT')
      return ''; throw err; }))).length;
    const out = yield* wait(open(files.log, 'a'));
    let child;
    let exited: string | null = null;
    try {
      options.authorize?.();
      child = spawn(options.bin, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
        cwd: options.cwd,
        detached: true,
        stdio: ['ignore', out.fd, out.fd],
        env: { ...options.env, OPENCODE_CONFIG: files.config, OPENCODE_PASSWORD: options.password },
      });
      child.once('exit', (code, signal) => (exited = `exited ${code ?? signal}`));
      child.once('error', (err) => (exited = err.message));
      child.unref();
      options.transaction.child(child, options.log, options.stopGraceMs);
    }
    finally {
      yield* wait(out.close());
    }
    const deadline = Date.now() + options.deadlineMs;
    while (Date.now() < deadline) {
      const log = (yield* wait(readFile(files.log, 'utf8'))).slice(start);
      const url = listeningUrl(log);
      if (url && child.pid !== undefined)
        return { pid: child.pid, url };
      if (exited)
        throw new Error(`opencode serve ${exited}: ${log.trim().slice(-500)}`);
      yield* wait(new Promise((r) => setTimeout(r, 50)));
    }
    throw new Error(`opencode serve printed no url within ${options.deadlineMs} ms: ${(yield* wait(readFile(files.log, 'utf8'))).slice(start).trim().slice(-500)}`);
  })(), options.resumed ?? untimed);
}
