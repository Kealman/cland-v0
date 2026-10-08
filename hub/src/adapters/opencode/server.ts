// A session's own `opencode serve`: started detached in the session's cwd on 127.0.0.1 and a port the server
// picks (`--port 0`; it prints `server listening on http://127.0.0.1:<port>`), with the spoke's MCP server added
// through OpenCode's own configuration (`OPENCODE_CONFIG`, a file the server process reads at its start) and a
// password of its own (`OPENCODE_PASSWORD`: HTTP Basic, user `opencode`). The server outlives the hub.
//
// Its files live in `<project>/.cland/opencode/<name>/`, which carries a `.gitignore` of its own (`*`): the
// generated config (`opencode.json`), the password (`password`, mode 600) and the server's output (`serve.log`).
// Nothing is written into the project's committed files.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type ServerFiles = { dir: string; config: string; password: string; log: string };

export function serverFiles(clandDir: string, name: string): ServerFiles {
  const dir = join(clandDir, 'opencode', name);
  return { dir, config: join(dir, 'opencode.json'), password: join(dir, 'password'), log: join(dir, 'serve.log') };
}

/** Write the session's config and a fresh password (kept when one exists: a relaunch reuses it). */
export function prepareFiles(clandDir: string, files: ServerFiles, config: Record<string, unknown>, freshPassword: boolean): string {
  const root = join(clandDir, 'opencode');
  mkdirSync(files.dir, { recursive: true });
  const ignore = join(root, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '# managed by cland: generated OpenCode configs and server passwords, never committed\n*\n');
  writeFileSync(files.config, `${JSON.stringify(config, null, 2)}\n`);
  let password = !freshPassword && existsSync(files.password) ? readFileSync(files.password, 'utf8').trim() : '';
  if (!password) {
    password = randomBytes(24).toString('base64url');
    writeFileSync(files.password, `${password}\n`, { mode: 0o600 });
  }
  chmodSync(files.password, 0o600);
  return password;
}

export function readPassword(files: ServerFiles): string | null {
  try {
    return readFileSync(files.password, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** The url a starting server printed, read from its log. */
export function listeningUrl(log: string): string | null {
  return /listening on (https?:\/\/[^\s]+)/i.exec(log)?.[1]?.replace(/\/+$/, '') ?? null;
}

export async function startServer(options: { bin: string; cwd: string; env: NodeJS.ProcessEnv; files: ServerFiles; password: string; deadlineMs: number }): Promise<{ pid: number; url: string }> {
  const { files } = options;
  const out = openSync(files.log, 'a');
  const start = (() => {
    try {
      return readFileSync(files.log, 'utf8').length;
    } catch {
      return 0;
    }
  })();
  const child = spawn(options.bin, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
    cwd: options.cwd,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...options.env, OPENCODE_CONFIG: files.config, OPENCODE_PASSWORD: options.password },
  });
  closeSync(out);
  let exited: string | null = null;
  child.once('exit', (code, signal) => (exited = `exited ${code ?? signal}`));
  child.once('error', (err) => (exited = err.message));
  child.unref();
  const deadline = Date.now() + options.deadlineMs;
  while (Date.now() < deadline) {
    const log = readFileSync(files.log, 'utf8').slice(start);
    const url = listeningUrl(log);
    if (url && child.pid !== undefined) return { pid: child.pid, url };
    if (exited) throw new Error(`opencode serve ${exited}: ${log.trim().slice(-500)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
  if (child.pid !== undefined) process.kill(child.pid, 'SIGTERM');
  throw new Error(`opencode serve printed no url within ${options.deadlineMs} ms: ${readFileSync(files.log, 'utf8').slice(start).trim().slice(-500)}`);
}
